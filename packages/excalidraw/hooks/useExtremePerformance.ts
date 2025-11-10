/**
 * 极端性能优化Hook
 * 专门处理超大规模场景的性能问题
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import { AppState, StaticCanvasAppState } from "../types";
import {
  NonDeletedExcalidrawElement,
  ElementsMap,
} from "@excalidraw/element/types";
import { extremePerformanceManager } from "../performance/ExtremePerformanceManager";

interface UseExtremePerformanceOptions {
  enabled?: boolean;
  threshold?: number;
  maxVisibleElements?: number;
  targetFPS?: number;
}

interface ExtremePerformanceState {
  isExtremeScene: boolean;
  optimizedElements: readonly NonDeletedExcalidrawElement[];
  performanceStats: any;
  shouldSkipRender: boolean;
}

export const useExtremePerformance = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState | StaticCanvasAppState,
  elementsMap: ElementsMap,
  options: UseExtremePerformanceOptions = {},
): ExtremePerformanceState => {
  const {
    enabled = true,
    threshold = 50000,
    maxVisibleElements = 2000,
    targetFPS = 30,
  } = options;

  const lastOptimizationTime = useRef<number>(0);
  const optimizationCache = useRef<{
    elements: readonly NonDeletedExcalidrawElement[];
    timestamp: number;
    viewportHash: string;
  } | null>(null);

  // 检测是否为极端场景
  const isExtremeScene = useMemo(() => {
    return enabled && elements.length > threshold;
  }, [enabled, elements.length, threshold]);

  // 生成视口哈希用于缓存
  const viewportHash = useMemo(() => {
    return `${appState.scrollX}-${appState.scrollY}-${appState.zoom.value}-${
      (appState as any).width || 0
    }-${(appState as any).height || 0}`;
  }, [
    appState.scrollX,
    appState.scrollY,
    appState.zoom.value,
    (appState as any).width,
    (appState as any).height,
  ]);

  // 帧率控制
  const shouldSkipRender = useMemo(() => {
    if (!isExtremeScene) return false;

    const now = performance.now();
    const timeSinceLastOptimization = now - lastOptimizationTime.current;
    const targetFrameTime = 1000 / targetFPS;

    return timeSinceLastOptimization < targetFrameTime;
  }, [isExtremeScene, targetFPS]);

  // 优化元素列表
  const optimizedElements = useMemo(() => {
    if (!isExtremeScene) {
      return elements;
    }

    // 检查缓存
    const now = performance.now();
    if (
      optimizationCache.current &&
      optimizationCache.current.viewportHash === viewportHash &&
      now - optimizationCache.current.timestamp < 100 // 100ms缓存
    ) {
      return optimizationCache.current.elements;
    }

    // 如果应该跳过渲染，返回上次的结果
    if (shouldSkipRender && optimizationCache.current) {
      return optimizationCache.current.elements;
    }

    // 执行优化
    console.time("🚀 ExtremePerformance Optimization");
    const isDragging = appState.selectedElementsAreBeingDragged || false;

    const optimized = extremePerformanceManager.optimizeElementsForRendering(
      elements,
      appState,
      elementsMap,
      isDragging,
    );

    // 更新缓存
    optimizationCache.current = {
      elements: optimized,
      timestamp: now,
      viewportHash,
    };

    lastOptimizationTime.current = now;
    console.timeEnd("🚀 ExtremePerformance Optimization");

    return optimized;
  }, [
    elements,
    isExtremeScene,
    viewportHash,
    shouldSkipRender,
    appState.selectedElementsAreBeingDragged,
    elementsMap,
  ]);

  // 性能统计
  const performanceStats = useMemo(() => {
    if (!isExtremeScene) {
      return {
        originalCount: elements.length,
        optimizedCount: elements.length,
        reductionRatio: 0,
        isOptimized: false,
      };
    }

    return {
      originalCount: elements.length,
      optimizedCount: optimizedElements.length,
      reductionRatio: 1 - optimizedElements.length / elements.length,
      isOptimized: optimizedElements.length < elements.length,
      ...extremePerformanceManager.getPerformanceStats(),
    };
  }, [elements.length, optimizedElements.length, isExtremeScene]);

  // 清理缓存
  const clearCache = useCallback(() => {
    optimizationCache.current = null;
    extremePerformanceManager.clearCache();
  }, []);

  // 当场景发生重大变化时清理缓存
  useEffect(() => {
    const elementCountChanged =
      Math.abs(
        elements.length - (optimizationCache.current?.elements.length || 0),
      ) > 1000;

    if (elementCountChanged) {
      clearCache();
    }
  }, [elements.length, clearCache]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearCache();
    };
  }, [clearCache]);

  return {
    isExtremeScene,
    optimizedElements,
    performanceStats,
    shouldSkipRender,
  };
};

// 性能监控Hook
export const usePerformanceMonitor = (enabled: boolean = true) => {
  const frameCount = useRef(0);
  const lastLogTime = useRef(Date.now());
  const fpsHistory = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) return;

    let animationFrame: number;

    const measureFPS = () => {
      frameCount.current++;
      const now = Date.now();
      const timeSinceLastLog = now - lastLogTime.current;

      if (timeSinceLastLog >= 1000) {
        // 每秒统计一次
        const fps = (frameCount.current * 1000) / timeSinceLastLog;
        fpsHistory.current.push(fps);

        // 保持最近10秒的数据
        if (fpsHistory.current.length > 10) {
          fpsHistory.current.shift();
        }

        const avgFPS =
          fpsHistory.current.reduce((a, b) => a + b, 0) /
          fpsHistory.current.length;

        if (fps < 20) {
          console.warn(
            `⚠️ 性能警告: FPS = ${fps.toFixed(1)}, 平均FPS = ${avgFPS.toFixed(
              1,
            )}`,
          );
        }

        frameCount.current = 0;
        lastLogTime.current = now;
      }

      animationFrame = requestAnimationFrame(measureFPS);
    };

    measureFPS();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [enabled]);

  return {
    getCurrentFPS: () => {
      const now = Date.now();
      const timeSinceLastLog = now - lastLogTime.current;
      return timeSinceLastLog > 0
        ? (frameCount.current * 1000) / timeSinceLastLog
        : 0;
    },
    getAverageFPS: () => {
      return fpsHistory.current.length > 0
        ? fpsHistory.current.reduce((a, b) => a + b, 0) /
            fpsHistory.current.length
        : 0;
    },
  };
};
