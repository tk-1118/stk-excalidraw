/**
 * Canvas Storage Manager
 *
 * 使用IndexedDB存储画布数据，支持多个业务服务实例的数据隔离
 * 解决localStorage大小限制和多实例缓存冲突问题
 */

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { AppState } from "../types";

export interface CanvasData {
  elements: ExcalidrawElement[];
  appState: Partial<AppState>;
  timestamp: number;
  businessServiceSN: string;
}

export interface CanvasStorageConfig {
  businessServiceSN: string;
}

class CanvasStorageManager {
  private dbName = "excalidraw-business-canvas";
  private dbVersion = 1;
  private storeName = "business-canvas-data";
  private db: IDBDatabase | null = null;

  // 极简缓存：只存储关键标识信息，避免存储大量元素数据
  private lastSavedSignature = new Map<string, string>();
  private lastSavedElementsCount = new Map<string, number>(); // 记录上次保存的元素数量
  private lastSaveTime = new Map<string, number>(); // 记录上次保存时间

  // 缓存策略配置
  private readonly SAVE_INTERVAL = 60 * 1000; // 1分钟缓存间隔
  private readonly MIN_ELEMENTS_THRESHOLD = 1; // 最少元素数量阈值

  // 添加定时清理机制，防止内存累积
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 10 * 60 * 1000; // 10分钟清理一次
  private readonly MAX_SIGNATURE_CACHE_SIZE = 50; // 最大缓存签名数量
  private isCleanupTimerStarted = false; // 防止重复启动定时器
  private static instanceCount = 0; // 引用计数

  /**
   * 初始化IndexedDB数据库
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error("Failed to open IndexedDB"));
      };

      request.onsuccess = () => {
        this.db = request.result;

        // 设置数据库连接错误处理
        this.db.onerror = (event) => {
          console.error("IndexedDB error:", event);
          this.closeDB(); // 出错时关闭连接
        };

        // 启动定时清理（仅启动一次）
        this.ensureCleanupTimerStarted();

        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建对象存储，使用businessServiceSN作为主键
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: "businessServiceSN",
          });

          // 创建时间戳索引，用于查询和清理
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  /**
   * 生成元素签名：优化的快速哈希算法
   * 单次遍历，避免排序，O(n)时间复杂度
   */
  private generateElementsSignature(elements: ExcalidrawElement[]): string {
    if (elements.length === 0) {
      return "empty";
    }

    // 单次遍历收集所有必要信息 - O(n)
    let versionSum = 0;
    let lastUpdated = 0;
    let idHash = 0; // 使用数值哈希替代字符串排序

    for (const element of elements) {
      // 累加版本号
      versionSum += element.versionNonce || 0;

      // 更新最后修改时间
      const elementUpdated = element.updated || 0;
      if (elementUpdated > lastUpdated) {
        lastUpdated = elementUpdated;
      }

      // 使用简单的数值哈希替代字符串排序
      // 这样可以避免O(n log n)的排序开销
      idHash = this.combineHashes(idHash, this.simpleHash(element.id));
    }

    // 直接返回数值组合，避免字符串拼接
    return `${elements.length}-${idHash}-${versionSum}-${lastUpdated}`;
  }

  /**
   * 组合两个哈希值的辅助函数
   */
  private combineHashes(hash1: number, hash2: number): number {
    return ((hash1 << 5) - hash1 + hash2) & 0x7fffffff; // 保持正数
  }

  /**
   * 简单哈希函数，用于字符串快速哈希
   */
  private simpleHash(str: string): number {
    let hash = 0;
    if (str.length === 0) {
      return hash;
    }

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash);
  }

  /**
   * 优化的数据保存策略：1分钟间隔 + 元素数量检查 + 内容变化检测
   * 避免频繁的IndexedDB操作，提升性能
   */
  private shouldSaveData(
    businessServiceSN: string,
    elements: ExcalidrawElement[],
  ): boolean {
    const now = Date.now();
    const lastSaveTime = this.lastSaveTime.get(businessServiceSN) || 0;
    const lastElementsCount =
      this.lastSavedElementsCount.get(businessServiceSN) || 0;
    const currentElementsCount = elements.filter((el) => !el.isDeleted).length;

    // 1. 检查时间间隔：必须超过1分钟才能保存
    if (now - lastSaveTime < this.SAVE_INTERVAL) {
      return false;
    }

    // 2. 检查元素数量：如果新元素数量小于已缓存的，不保存
    if (currentElementsCount < lastElementsCount && lastElementsCount > 0) {
      return false;
    }

    // 3. 检查元素数量阈值：至少要有一定数量的元素才保存
    if (currentElementsCount < this.MIN_ELEMENTS_THRESHOLD) {
      return false;
    }

    // 4. 检查内容是否真的有变化（签名对比）
    const currentSignature = this.generateElementsSignature(elements);
    const lastSignature = this.lastSavedSignature.get(businessServiceSN);

    if (currentSignature === lastSignature) {
      return false;
    }

    // 更新缓存信息
    this.lastSavedSignature.set(businessServiceSN, currentSignature);
    this.lastSavedElementsCount.set(businessServiceSN, currentElementsCount);
    this.lastSaveTime.set(businessServiceSN, now);

    return true;
  }

  /**
   * 序列化AppState，移除不可序列化的属性（如函数）
   * 主要处理openDialog中的函数属性，避免IndexedDB序列化失败
   */
  private serializeAppState(appState: Partial<AppState>): Partial<AppState> {
    const serializedState = { ...appState };

    // 处理openDialog中的不可序列化属性
    if (serializedState.openDialog) {
      if (serializedState.openDialog.name === "annotation") {
        // 移除annotation对话框中的函数属性
        const { onClose, onConfirm, ...serializableDialog } =
          serializedState.openDialog;
        serializedState.openDialog = serializableDialog as any;
      }
      // 可以在这里添加其他对话框类型的处理逻辑
    }

    return serializedState;
  }

  /**
   * 保存画布数据到IndexedDB
   */
  async saveCanvasData(
    businessServiceSN: string,
    elements: ExcalidrawElement[],
    appState: Partial<AppState>,
  ): Promise<void> {
    try {
      // 快速检查是否需要保存
      if (!this.shouldSaveData(businessServiceSN, elements)) {
        return;
      }

      const nonDeletedElements = elements.filter((el) => !el.isDeleted);

      // 序列化appState，移除不可序列化的属性
      const serializedAppState = this.serializeAppState(appState);

      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      const canvasData: CanvasData = {
        elements: nonDeletedElements,
        appState: serializedAppState,
        timestamp: Date.now(),
        businessServiceSN,
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.put(canvasData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // 更新签名缓存
      this.lastSavedSignature.set(
        businessServiceSN,
        this.generateElementsSignature(elements),
      );

      // eslint-disable-next-line no-console
      console.log(`[${businessServiceSN}] 画布数据已保存到IndexedDB`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `[${businessServiceSN}] 保存画布数据到IndexedDB失败:`,
        error,
      );
      // 降级到localStorage作为备选方案
      this.fallbackToLocalStorage(businessServiceSN, elements, appState);
    }
  }

  /**
   * 从IndexedDB加载画布数据（无缓存，直接读取）
   */
  async loadCanvasData(businessServiceSN: string): Promise<CanvasData | null> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);

      return new Promise<CanvasData | null>((resolve, reject) => {
        const request = store.get(businessServiceSN);
        request.onsuccess = () => {
          const result = request.result as CanvasData | undefined;
          if (result) {
            // 更新签名缓存
            this.lastSavedSignature.set(
              businessServiceSN,
              this.generateElementsSignature(result.elements),
            );
          }
          resolve(result || null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      return this.fallbackFromLocalStorage(businessServiceSN);
    }
  }

  /**
   * 检查是否存在缓存数据
   */
  async hasCanvasData(businessServiceSN: string): Promise<boolean> {
    try {
      const data = await this.loadCanvasData(businessServiceSN);
      return data !== null && data.elements.length > 0;
    } catch (error) {
      console.error(`[${businessServiceSN}] 检查缓存数据失败:`, error);
      return false;
    }
  }

  /**
   * 删除指定业务服务的缓存数据
   */
  async deleteCanvasData(businessServiceSN: string): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(businessServiceSN);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // eslint-disable-next-line no-console
      console.log(`[${businessServiceSN}] 画布缓存数据已删除`);
    } catch (error) {
      console.error(`[${businessServiceSN}] 删除画布缓存数据失败:`, error);
    }
  }

  /**
   * 确保定时清理机制启动（防重复）
   */
  private ensureCleanupTimerStarted(): void {
    if (this.isCleanupTimerStarted) {
      return; // 已经启动，避免重复
    }
    this.isCleanupTimerStarted = true;
    this.startCleanupTimer();
  }

  /**
   * 启动定时清理机制
   */
  private startCleanupTimer(): void {
    // 清除已有定时器
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
    }

    this.cleanupTimer = setTimeout(() => {
      try {
        this.performCleanup();
      } catch (error) {
        console.error("[CanvasStorage] 清理过程中出现异常:", error);
      } finally {
        // 确保即使出现异常也能继续下一次清理
        this.startCleanupTimer();
      }
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * 停止定时清理机制
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.isCleanupTimerStarted = false; // 重置标志
  }

  /**
   * 执行清理操作
   */
  private async performCleanup(): Promise<void> {
    try {
      // 清理过期数据
      await this.cleanupExpiredData();

      // 清理签名缓存，防止内存累积
      this.cleanupSignatureCache();

      // eslint-disable-next-line no-console
      console.log("[CanvasStorage] 定时清理完成");
    } catch (error) {
      console.error("[CanvasStorage] 定时清理失败:", error);
    }
  }

  /**
   * 清理签名缓存，防止内存累积
   */
  private cleanupSignatureCache(): void {
    if (this.lastSavedSignature.size > this.MAX_SIGNATURE_CACHE_SIZE) {
      // 保留最近使用的一半缓存
      const entries = Array.from(this.lastSavedSignature.entries());
      const keepCount = Math.floor(this.MAX_SIGNATURE_CACHE_SIZE / 2);

      // 清理所有相关缓存
      this.lastSavedSignature.clear();
      this.lastSavedElementsCount.clear();
      this.lastSaveTime.clear();

      // 保留最新的缓存项（假设最新添加的在数组末尾）
      entries.slice(-keepCount).forEach(([key, value]) => {
        this.lastSavedSignature.set(key, value);
      });

      // eslint-disable-next-line no-console
      console.log(`[CanvasStorage] 清理缓存，保留 ${keepCount} 项`);
    }
  }

  /**
   * 关闭数据库连接
   */
  private closeDB(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.stopCleanupTimer();
  }

  /**
   * 清理过期的缓存数据（超过30天）
   */
  async cleanupExpiredData(): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const index = store.index("timestamp");

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const range = IDBKeyRange.upperBound(thirtyDaysAgo);

      const request = index.openCursor(range);
      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          // eslint-disable-next-line no-console
          console.log(`清理了 ${deletedCount} 个过期的画布缓存数据`);
        }
      };
    } catch (error) {
      console.error("清理过期缓存数据失败:", error);
    }
  }

  /**
   * 注册一个使用该存储的实例
   */
  public register(): void {
    CanvasStorageManager.instanceCount++;
  }

  /**
   * 清理当前实例的资源
   * 用于单个应用实例退出时的清理
   */
  public cleanup(): void {
    CanvasStorageManager.instanceCount--;

    // 清理所有缓存
    this.lastSavedSignature.clear();
    this.lastSavedElementsCount.clear();
    this.lastSaveTime.clear();

    // 如果没有实例在使用，可以考虑停止定时器
    if (CanvasStorageManager.instanceCount <= 0) {
      CanvasStorageManager.instanceCount = 0;
      // 可以在这里添加更积极的清理逻辑
      // eslint-disable-next-line no-console
      console.log("[CanvasStorage] 所有实例已清理，考虑深度清理");
    }
  }

  /**
   * 完全销毁资源，用于整个应用退出时清理
   * ⚠️ 谨慎使用：这会影响所有使用该单例的实例
   */
  public destroy(): void {
    this.stopCleanupTimer();
    this.closeDB();
    // 清空所有缓存
    this.lastSavedSignature.clear();
    this.lastSavedElementsCount.clear();
    this.lastSaveTime.clear();
  }

  /**
   * 降级到localStorage的备选方案
   */
  private fallbackToLocalStorage(
    businessServiceSN: string,
    elements: ExcalidrawElement[],
    appState: Partial<AppState>,
  ): void {
    try {
      const key = `excalidraw-${businessServiceSN}`;
      const data = {
        elements,
        appState,
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(data));
      // eslint-disable-next-line no-console
      console.log(`[${businessServiceSN}] 降级保存到localStorage成功`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `[${businessServiceSN}] 降级保存到localStorage失败:`,
        error,
      );
    }
  }

  /**
   * 从localStorage的备选方案加载数据
   */
  private fallbackFromLocalStorage(
    businessServiceSN: string,
  ): CanvasData | null {
    try {
      const key = `excalidraw-${businessServiceSN}`;
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        // eslint-disable-next-line no-console
        console.log(
          `[${businessServiceSN}] 从localStorage备选方案加载数据成功`,
        );
        return {
          ...parsed,
          businessServiceSN,
        };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `[${businessServiceSN}] 从localStorage备选方案加载数据失败:`,
        error,
      );
    }
    return null;
  }
}

// 导出单例实例
export const canvasStorage = new CanvasStorageManager();
