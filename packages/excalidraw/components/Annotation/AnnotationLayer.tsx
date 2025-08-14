import { useEffect, useMemo } from "react";
import { KEYS } from "@excalidraw/common";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import { isAnnotationElement } from "../../../element/src/typeChecks";

import { AnnotationContent } from "./AnnotationContent";

import type { ExcalidrawAnnotationElement } from "../../../element/src/types";

import type { AppState } from "../../types";

interface AnnotationLayerProps {
  elements: readonly any[];
  appState: AppState;
  onCloseAnnotation?: (elementId: string) => void;
  setAppState: any;
}

// 计算调整后的位置，确保内容不会超出屏幕边界
const getAdjustedPosition = (
  viewportX: number,
  viewportY: number,
  zoomValue: number,
) => {
  // 使用更合理的注释内容尺寸估算
  const contentWidth = 200; // 与CSS中的max-width保持一致
  const contentHeight = 660; // 更合理的默认高度

  let adjustedX = viewportX;
  let adjustedY = viewportY;

  // 检查右侧是否超出屏幕
  if (viewportX + contentWidth > window.innerWidth) {
    // 如果右侧超出，则将其放在注释图标左侧
    adjustedX = viewportX - contentWidth - 48 / zoomValue;
  }

  // 检查底部是否超出屏幕
  if (viewportY + contentHeight > window.innerHeight) {
    // 如果底部超出，则将其向上调整，确保完全可见
    adjustedY = Math.max(30, window.innerHeight - contentHeight - 60);
  }

  // 检查顶部是否超出屏幕
  if (viewportY < 30) {
    adjustedY = 30;
  }

  // 检查左侧是否超出屏幕
  if (adjustedX < 30) {
    adjustedX = 30;
  }

  return { x: adjustedX, y: adjustedY };
};

export const AnnotationLayer = ({
  elements,
  appState,
  onCloseAnnotation,
  setAppState,
}: AnnotationLayerProps) => {
  // 监听ESC键关闭所有标注
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYS.ESCAPE) {
        // 关闭所有标注
        const annotationElements = elements.filter(isAnnotationElement);
        for (const element of annotationElements) {
          if (element.customData?.isExpanded) {
            onCloseAnnotation?.(element.id);
          }
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [elements, onCloseAnnotation]);

  // 渲染标注内容
  return (
    <>
      {elements.map((element) => {
        if (isAnnotationElement(element) && element.customData?.isExpanded) {
          // 计算标注内容的位置（场景坐标）
          const centerX = element.x + element.width / 2;
          const centerY = element.y + element.height / 2;

          // 添加偏移量（场景坐标中）
          const annotationX = centerX + 24 / appState.zoom.value; // 调整偏移量以适应缩放
          const annotationY = centerY - 25 / appState.zoom.value;

          // 使用sceneCoordsToViewportCoords将场景坐标转换为视口坐标
          const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
            { sceneX: annotationX, sceneY: annotationY },
            appState,
          );

          // 计算调整后的位置，确保内容不会超出屏幕边界
          const adjustedPosition = getAdjustedPosition(
            viewportX,
            viewportY,
            appState.zoom.value,
          );

          return (
            <div
              key={element.id}
              style={{
                position: "absolute",
                left: `${adjustedPosition.x}px`,
                top: `${adjustedPosition.y}px`,
                zIndex: 1000, // 提高z-index确保在其他元素之上
                pointerEvents: "auto", // 确保可以点击
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
              onMouseEnter={() => {
                setAppState((prev: AppState) => ({
                  hoveredElementIds: {
                    ...prev.hoveredElementIds,
                    [element.id]: true,
                  },
                }));
              }}
              onMouseLeave={() => {
                setAppState((prev: AppState) => {
                  const next = { ...prev.hoveredElementIds } as any;
                  delete next[element.id];
                  return { hoveredElementIds: next } as any;
                });
              }}
            >
              <AnnotationContent
                element={element as ExcalidrawAnnotationElement}
                onClose={() => onCloseAnnotation?.(element.id)}
              />
            </div>
          );
        }
        return null;
      })}
    </>
  );
};
