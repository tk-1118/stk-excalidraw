import React, { useState, useEffect, useCallback } from "react";

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
  const [isVisible, setIsVisible] = useState(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    return () => setIsVisible(false);
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    // 延迟调用onClose，让动画有时间完成
    setTimeout(() => {
      onClose?.();
    }, 200);
  }, [onClose]);

  const handleContentClick = useCallback(() => {
    setIsActive(true);
    setTimeout(() => setIsActive(false), 300);
  }, []);

  const contentClasses = [
    "annotation-content",
    isVisible ? "visible" : "closing",
    isActive ? "active" : ""
  ].filter(Boolean).join(" ");

  return (
    <div className={contentClasses}>
      <div className="annotation-content-box" onClick={handleContentClick}>
        <div className="annotation-content-text">
          {element.text || "无内容"}
        </div>
      </div>
    </div>
  );
};
