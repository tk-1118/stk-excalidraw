/**
 * 极端性能优化管理器
 * 专门处理超大规模场景（10万+元素）的性能问题
 */

import { AppState, StaticCanvasAppState } from "../types";
import {
  NonDeletedExcalidrawElement,
  ElementsMap,
} from "@excalidraw/element/types";
import { getElementAbsoluteCoords } from "@excalidraw/element";
import { viewportCoordsToSceneCoords } from "@excalidraw/common";

interface PerformanceConfig {
  // 元素数量阈值
  LARGE_SCENE_THRESHOLD: number;
  EXTREME_SCENE_THRESHOLD: number;

  // 渲染配置
  MAX_VISIBLE_ELEMENTS: number;
  VIEWPORT_BUFFER_RATIO: number;

  // LOD配置
  LOD_DISTANCE_THRESHOLDS: number[];
  MIN_ELEMENT_SIZE_TO_RENDER: number;

  // 帧率控制
  TARGET_FPS_DURING_DRAG: number;
  FRAME_SKIP_THRESHOLD: number;
}

const DEFAULT_CONFIG: PerformanceConfig = {
  LARGE_SCENE_THRESHOLD: 10000,
  EXTREME_SCENE_THRESHOLD: 50000,

  MAX_VISIBLE_ELEMENTS: 2000, // 最多渲染2000个元素
  VIEWPORT_BUFFER_RATIO: 0.2, // 视口缓冲区20%

  LOD_DISTANCE_THRESHOLDS: [0.1, 0.25, 0.5, 1.0, 2.0],
  MIN_ELEMENT_SIZE_TO_RENDER: 2, // 最小渲染尺寸2px

  TARGET_FPS_DURING_DRAG: 30,
  FRAME_SKIP_THRESHOLD: 33, // 33ms = 30fps
};

interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ElementWithPriority {
  element: NonDeletedExcalidrawElement;
  priority: number;
  distance: number;
  size: number;
}

export class ExtremePerformanceManager {
  private config: PerformanceConfig;
  private lastRenderTime = 0;
  private frameCount = 0;
  private isDragging = false;
  private currentViewport: ViewportBounds | null = null;

  // 分层缓存
  private visibilityCache = new Map<
    string,
    {
      isVisible: boolean;
      priority: number;
      lastUpdate: number;
    }
  >();

  // 空间分区缓存
  private spatialGrid = new Map<string, Set<string>>();
  private gridSize = 1000; // 1000px网格

  constructor(config?: Partial<PerformanceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 主要的元素过滤和优化方法
   */
  public optimizeElementsForRendering(
    elements: readonly NonDeletedExcalidrawElement[],
    appState: AppState | StaticCanvasAppState,
    elementsMap: ElementsMap,
    isDragging: boolean = false,
  ): readonly NonDeletedExcalidrawElement[] {
    this.isDragging = isDragging;
    const elementCount = elements.length;

    // 如果元素数量不多，直接返回
    if (elementCount < this.config.LARGE_SCENE_THRESHOLD) {
      return elements;
    }

    console.log(`🚀 ExtremePerformanceManager: 处理 ${elementCount} 个元素`);

    // 计算当前视口
    const viewport = this.calculateViewport(appState);
    this.currentViewport = viewport;

    // 帧率控制 - 拖拽时跳帧
    if (isDragging && this.shouldSkipFrame()) {
      console.log("⏭️ 跳过当前帧以保持流畅性");
      return this.getLastValidElements() || [];
    }

    // 多阶段过滤
    let filteredElements = elements;

    // 阶段1: 激进的视口裁剪
    filteredElements = this.aggressiveViewportCulling(
      filteredElements,
      viewport,
      elementsMap,
    );

    // 阶段2: LOD过滤
    filteredElements = this.applyLevelOfDetail(
      filteredElements,
      appState,
      elementsMap,
    );

    // 阶段3: 优先级排序和数量限制
    filteredElements = this.applyPriorityFiltering(
      filteredElements,
      viewport,
      elementsMap,
    );

    // 缓存结果
    this.cacheLastValidElements(filteredElements);

    console.log(`✅ 最终渲染元素数量: ${filteredElements.length}`);

    return filteredElements;
  }

  /**
   * 激进的视口裁剪 - 只保留视口内及附近的元素
   */
  private aggressiveViewportCulling(
    elements: readonly NonDeletedExcalidrawElement[],
    viewport: ViewportBounds,
    elementsMap: ElementsMap,
  ): readonly NonDeletedExcalidrawElement[] {
    const buffer =
      Math.min(viewport.width, viewport.height) *
      this.config.VIEWPORT_BUFFER_RATIO;

    const cullingBounds = {
      x: viewport.x - buffer,
      y: viewport.y - buffer,
      width: viewport.width + 2 * buffer,
      height: viewport.height + 2 * buffer,
    };

    return elements.filter((element) => {
      const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);

      // 快速边界检测
      return !(
        x2 < cullingBounds.x ||
        x1 > cullingBounds.x + cullingBounds.width ||
        y2 < cullingBounds.y ||
        y1 > cullingBounds.y + cullingBounds.height
      );
    });
  }

  /**
   * 应用多级细节层次(LOD)
   */
  private applyLevelOfDetail(
    elements: readonly NonDeletedExcalidrawElement[],
    appState: AppState | StaticCanvasAppState,
    elementsMap: ElementsMap,
  ): readonly NonDeletedExcalidrawElement[] {
    const zoom = appState.zoom.value;

    return elements.filter((element) => {
      const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
      const width = x2 - x1;
      const height = y2 - y1;

      // 计算元素在屏幕上的实际尺寸
      const screenWidth = width * zoom;
      const screenHeight = height * zoom;
      const maxScreenSize = Math.max(screenWidth, screenHeight);

      // 如果元素太小，跳过渲染
      if (maxScreenSize < this.config.MIN_ELEMENT_SIZE_TO_RENDER) {
        return false;
      }

      // 根据zoom级别决定是否渲染复杂元素
      if (zoom < 0.1 && element.type === "freedraw") {
        return false; // 极小缩放时跳过自由绘制
      }

      if (zoom < 0.25 && element.type === "text" && element.fontSize < 12) {
        return false; // 跳过小字体文本
      }

      return true;
    });
  }

  /**
   * 优先级过滤 - 只保留最重要的元素
   */
  private applyPriorityFiltering(
    elements: readonly NonDeletedExcalidrawElement[],
    viewport: ViewportBounds,
    elementsMap: ElementsMap,
  ): readonly NonDeletedExcalidrawElement[] {
    if (elements.length <= this.config.MAX_VISIBLE_ELEMENTS) {
      return elements;
    }

    // 计算每个元素的优先级
    const elementsWithPriority: ElementWithPriority[] = elements.map(
      (element) => {
        const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        const viewportCenterX = viewport.x + viewport.width / 2;
        const viewportCenterY = viewport.y + viewport.height / 2;

        // 计算到视口中心的距离
        const distance = Math.sqrt(
          Math.pow(centerX - viewportCenterX, 2) +
            Math.pow(centerY - viewportCenterY, 2),
        );

        // 计算元素大小
        const size = (x2 - x1) * (y2 - y1);

        // 计算优先级（距离越近、尺寸越大、优先级越高）
        let priority = 1000000 / (distance + 1) + Math.sqrt(size);

        // frame元素优先级更高
        if (element.type === "frame") {
          priority *= 2;
        }

        // 选中的元素优先级最高
        if (element.id in (elementsMap.get(element.id) || {})) {
          priority *= 5;
        }

        return {
          element,
          priority,
          distance,
          size,
        };
      },
    );

    // 按优先级排序并取前N个
    elementsWithPriority.sort((a, b) => b.priority - a.priority);

    return elementsWithPriority
      .slice(0, this.config.MAX_VISIBLE_ELEMENTS)
      .map((item) => item.element);
  }

  /**
   * 帧率控制 - 决定是否跳过当前帧
   */
  private shouldSkipFrame(): boolean {
    const now = performance.now();
    const timeSinceLastRender = now - this.lastRenderTime;

    if (timeSinceLastRender < this.config.FRAME_SKIP_THRESHOLD) {
      return true;
    }

    this.lastRenderTime = now;
    this.frameCount++;
    return false;
  }

  /**
   * 计算当前视口边界
   */
  private calculateViewport(
    appState: AppState | StaticCanvasAppState,
  ): ViewportBounds {
    const topLeft = viewportCoordsToSceneCoords(
      { clientX: 0, clientY: 0 },
      appState,
    );
    const bottomRight = viewportCoordsToSceneCoords(
      { clientX: appState.width, clientY: appState.height },
      appState,
    );

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }

  // 缓存最后有效的元素列表
  private lastValidElements: readonly NonDeletedExcalidrawElement[] | null =
    null;

  private cacheLastValidElements(
    elements: readonly NonDeletedExcalidrawElement[],
  ) {
    this.lastValidElements = elements;
  }

  private getLastValidElements():
    | readonly NonDeletedExcalidrawElement[]
    | null {
    return this.lastValidElements;
  }

  /**
   * 清理缓存
   */
  public clearCache(): void {
    this.visibilityCache.clear();
    this.spatialGrid.clear();
    this.lastValidElements = null;
    this.frameCount = 0;
  }

  /**
   * 获取性能统计
   */
  public getPerformanceStats() {
    return {
      frameCount: this.frameCount,
      cacheSize: this.visibilityCache.size,
      isDragging: this.isDragging,
      lastRenderTime: this.lastRenderTime,
      viewport: this.currentViewport,
    };
  }
}

// 导出全局实例
export const extremePerformanceManager = new ExtremePerformanceManager();
