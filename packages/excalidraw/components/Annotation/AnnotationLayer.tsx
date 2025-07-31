import { useEffect } from "react";
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
            appState
          );

          return (
            <div
              key={element.id}
              style={{
                position: "absolute",
                left: `${viewportX}px`,
                top: `${viewportY}px`,
                zIndex: 100, // 确保在其他元素之上
                pointerEvents: "auto", // 确保可以点击
              }}
              onClick={(e) => {
                e.stopPropagation();
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
