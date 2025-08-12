import React, { useState } from "react";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";

import { Dialog } from "./Dialog";
import { buildComponentDetails } from "./specification/buildComponentDetails";

interface SpecificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  frame: ExcalidrawFrameLikeElement;
  elements: readonly ExcalidrawElement[];
}

export const SpecificationDialog: React.FC<SpecificationDialogProps> = ({
  isOpen,
  onClose,
  frame,
  elements,
}) => {
  const [specification, setSpecification] = useState<string>("");

  React.useEffect(() => {
    if (isOpen && frame) {
      const description = buildComponentDetails(elements, frame);
      setSpecification(description);
    }
  }, [isOpen, frame, elements]);

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      onCloseRequest={onClose}
      title="前端规约构建"
      size="wide"
      className="SpecificationDialog"
    >
      <div style={{ padding: "20px" }}>
        <div style={{ marginBottom: "16px" }}>
          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: "16px",
              fontWeight: "600",
            }}
          >
            {frame.name || frame.id}
          </h3>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "600",
            }}
          >
            组件描述:
          </label>
          <textarea
            value={specification}
            onChange={(e) => setSpecification(e.target.value)}
            style={{
              width: "100%",
              height: "400px",
              padding: "12px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "12px",
              lineHeight: "1.4",
              resize: "vertical",
            }}
            placeholder="组件描述将在这里生成..."
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--color-gray-60)" }}>
            组件描述 → AI规约生成 → 规约评分 → 发布（需评分≥80分）
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                border: "1px solid var(--default-border-color)",
                borderRadius: "var(--border-radius-lg)",
                backgroundColor: "var(--island-bg-color)",
                color: "var(--color-on-surface)",
                cursor: "pointer",
                fontFamily: "var(--ui-font)",
                fontSize: "0.875rem",
                fontWeight: "600",
              }}
            >
              关闭
            </button>
            <button
              style={{
                padding: "8px 16px",
                border: "1px solid var(--color-primary)",
                borderRadius: "var(--border-radius-lg)",
                backgroundColor: "var(--color-primary)",
                color: "var(--color-icon-white)",
                cursor: "pointer",
                opacity: 0.6,
                fontFamily: "var(--ui-font)",
                fontSize: "0.875rem",
                fontWeight: "600",
              }}
              disabled
              title="此功能将在未来版本中实现"
            >
              生成规约
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
