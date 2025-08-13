import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./PreviewModal.scss";

interface PreviewModalProps {
  svg: string;
  componentName: string;
  onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  svg,
  componentName,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // 处理 ESC 键关闭模态框
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEsc);
    // 防止背景滚动
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "auto";
    };
  }, [onClose]);

  // 点击遮罩层关闭模态框
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 确保DOM中存在用于挂载模态框的元素
  useEffect(() => {
    if (!document.getElementById('excalidraw-root')) {
      console.warn('Excalidraw root element not found, using document.body');
    }
  }, []);

  return createPortal(
    <div 
      ref={modalRef}
      className="preview-modal-overlay" 
      onClick={handleOverlayClick}
    >
      <div className="preview-modal">
        <button className="preview-modal__close" onClick={onClose}>
          ×
        </button>
        <div className="preview-modal__content">
          <div 
            className="preview-modal__svg" 
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          {componentName && (
            <div className="preview-modal__name">{componentName}</div>
          )}
        </div>
      </div>
    </div>,
    document.getElementById('excalidraw-root') || document.body,
  );
};