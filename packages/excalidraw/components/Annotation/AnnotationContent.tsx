import React from "react";

import "./AnnotationContent.scss";

import type { ExcalidrawAnnotationElement } from "../../../element/src/types";

interface AnnotationContentProps {
  element: ExcalidrawAnnotationElement;
  onClose?: () => void;
}

export const AnnotationContent = ({
  element,
  onClose,
}: AnnotationContentProps) => {
  return (
    <div className="annotation-content">
      <div className="annotation-content-box">
        <div className="annotation-content-text">
          {element.text || "无内容"}
        </div>
        {onClose && (
          <button className="annotation-content-close" onClick={onClose}>
            ×
          </button>
        )}
      </div>
    </div>
  );
};
