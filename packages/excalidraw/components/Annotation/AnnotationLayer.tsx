import React, { useEffect, useState } from "react";
import { KEYS } from "@excalidraw/common";

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
          // 计算标注内容的位置
          const centerX = element.x + element.width / 2;
          const centerY = element.y + element.height / 2;

          // 放在图标右侧
          const x = centerX + 24; // 24px是图标大小
          const y = centerY - 50; // 垂直居中

          // 计算屏幕坐标
          const screenX = x + appState.scrollX;
          const screenY = y + appState.scrollY;

          return (
            <div
              key={element.id}
              style={{
                position: "absolute",
                left: `${screenX}px`,
                top: `${screenY}px`,
                transform: `scale(${appState.zoom.value})`,
                transformOrigin: "left top",
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
