/**
 * 极端性能画布组件
 * 专门处理176000+元素的超大规模场景
 */

import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { AppState } from "../types";
import {
  NonDeletedExcalidrawElement,
  ElementsMap,
} from "@excalidraw/element/types";
import {
  useExtremePerformance,
  usePerformanceMonitor,
} from "../hooks/useExtremePerformance";

interface ExtremePerformanceCanvasProps {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: AppState;
  elementsMap: ElementsMap;
  renderCanvas: (
    elements: readonly NonDeletedExcalidrawElement[],
  ) => React.ReactNode;
  onPerformanceUpdate?: (stats: any) => void;
}

export const ExtremePerformanceCanvas: React.FC<
  ExtremePerformanceCanvasProps
> = ({
  elements,
  appState,
  elementsMap,
  renderCanvas,
  onPerformanceUpdate,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const renderCountRef = useRef(0);

  // 极端性能优化
  const {
    isExtremeScene,
    optimizedElements,
    performanceStats,
    shouldSkipRender,
  } = useExtremePerformance(elements, appState, elementsMap, {
    enabled: true,
    threshold: 50000,
    maxVisibleElements: 2000,
    targetFPS: 30,
  });

  // 性能监控
  const { getCurrentFPS, getAverageFPS } =
    usePerformanceMonitor(isExtremeScene);

  // 性能统计更新
  useEffect(() => {
    if (onPerformanceUpdate && isExtremeScene) {
      const stats = {
        ...performanceStats,
        currentFPS: getCurrentFPS(),
        averageFPS: getAverageFPS(),
        renderCount: renderCountRef.current,
      };
      onPerformanceUpdate(stats);
    }
  }, [
    performanceStats,
    getCurrentFPS,
    getAverageFPS,
    onPerformanceUpdate,
    isExtremeScene,
  ]);

  // 渲染决策
  const shouldRender = useMemo(() => {
    if (!isExtremeScene) return true;

    // 在极端场景下，如果应该跳过渲染，则返回false
    if (shouldSkipRender) {
      console.log("⏭️ 跳过渲染以保持性能");
      return false;
    }

    return true;
  }, [isExtremeScene, shouldSkipRender]);

  // 渲染内容
  const renderContent = useCallback(() => {
    if (!shouldRender) {
      return null;
    }

    renderCountRef.current++;

    if (isExtremeScene) {
      console.log(
        `🎨 极端场景渲染: ${optimizedElements.length}/${elements.length} 个元素`,
      );
    }

    return renderCanvas(optimizedElements);
  }, [
    shouldRender,
    isExtremeScene,
    optimizedElements,
    elements.length,
    renderCanvas,
  ]);

  // 性能警告
  useEffect(() => {
    if (isExtremeScene) {
      const currentFPS = getCurrentFPS();
      if (currentFPS < 15) {
        console.warn(
          `🚨 严重性能警告: FPS = ${currentFPS.toFixed(1)}, 元素数量 = ${
            elements.length
          }`,
        );
      }
    }
  }, [isExtremeScene, getCurrentFPS, elements.length]);

  // 渲染性能提示
  const renderPerformanceIndicator = () => {
    if (!isExtremeScene) return null;

    return (
      <div
        style={{
          position: "fixed",
          top: "10px",
          right: "10px",
          background: "rgba(255, 165, 0, 0.9)",
          color: "white",
          padding: "8px 12px",
          borderRadius: "4px",
          fontSize: "12px",
          fontFamily: "monospace",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        🚀 极端优化模式
        <br />
        {optimizedElements.length}/{elements.length} 元素
        <br />
        FPS: {getCurrentFPS().toFixed(1)}
        <br />
        减少: {(performanceStats.reductionRatio * 100).toFixed(1)}%
      </div>
    );
  };

  return (
    <div
      ref={canvasRef}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      {renderContent()}
      {renderPerformanceIndicator()}
    </div>
  );
};

export default ExtremePerformanceCanvas;
