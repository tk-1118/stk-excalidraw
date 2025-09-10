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
   * 生成元素签名：O(1)时间复杂度，无循环
   * 利用数组引用和长度变化检测数据变化
   */
  private generateElementsSignature(elements: ExcalidrawElement[]): string {
    // 使用元素数组的内存地址哈希 + 长度 + 最后修改时间
    const arrayHash = (elements as any).__hash__ || Math.random().toString(36);
    const timestamp = Date.now();

    // 如果数组没有哈希标记，给它添加一个（表示数据已变化）
    if (!(elements as any).__hash__) {
      (elements as any).__hash__ = arrayHash;
      (elements as any).__lastModified__ = timestamp;
    }

    return `${elements.length}-${arrayHash}-${
      (elements as any).__lastModified__
    }`;
  }

  /**
   * 极简数据变化检测：O(1)时间复杂度
   */
  private shouldSaveData(
    businessServiceSN: string,
    elements: ExcalidrawElement[],
  ): boolean {
    if (elements.length === 0) {
      return false;
    }

    const currentSignature = this.generateElementsSignature(elements);
    const lastSignature = this.lastSavedSignature.get(businessServiceSN);

    return currentSignature !== lastSignature;
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
