import React, { useState, useEffect, useRef } from "react";

import { useI18n } from "../i18n";

import { Dialog } from "./Dialog";

import { FilledButton } from "./FilledButton";

interface RemarkDialogProps {
  customData: {
    componentName: string;
    componentBehavior: string;
    componentInteraction: string;
    componentStyle: string;
    componentMapping: string;
    componentStatute: string;
  };
  onSubmit: (customData: ComponentDescription) => void;
  onClose: () => void;
}

interface ComponentDescription {
  componentName: string;
  componentBehavior: string;
  componentInteraction: string;
  componentStyle: string;
  componentMapping: string;
  componentStatute: string;
}

export const RemarkDialog = ({
  customData,
  onSubmit,
  onClose,
}: RemarkDialogProps) => {
  const { t } = useI18n();

  const initialDescription = customData;

  const [componentName, setComponentType] = useState(
    initialDescription.componentName,
  );

  const [componentBehavior, setComponentBehavior] = useState(
    initialDescription.componentBehavior,
  );

  const [componentInteraction, setComponentInteraction] = useState(
    initialDescription.componentInteraction,
  );

  const [componentStyle, setComponentStyle] = useState(
    initialDescription.componentStyle,
  );

  const [componentMapping, setComponentMapping] = useState(
    initialDescription.componentMapping,
  );

  const [componentStatute, setComponentStatute] = useState(
    initialDescription.componentStatute,
  );

  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 自动聚焦到第一个输入框
    if (firstFieldRef.current) {
      firstFieldRef.current.focus();
    }
  }, []);

  const handleSubmit = () => {
    const submitData: ComponentDescription = {
      componentName,
      componentBehavior,
      componentInteraction,
      componentStyle,
      componentMapping,
      componentStatute,
    };
    onSubmit(submitData);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === "Escape") {
      onClose();
    }
  };

  return (
    <Dialog
      onCloseRequest={onClose}
      title={t("labels.addRemark")}
      className="RemarkDialog"
      size="small"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <label>组件名称</label>
          <input
            ref={firstFieldRef}
            value={componentName}
            onChange={(e) => setComponentType(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入组件名称"
            // disabled
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontFamily: "inherit",
              fontSize: "inherit",
              backgroundColor: "#fff",
              color: "#333",
            }}
          />
        </div>
        {/* <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <label>组件功能</label>
          <textarea
            value={componentBehavior}
            onChange={(e) => setComponentBehavior(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入组件功能"
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontFamily: "inherit",
              fontSize: "inherit",
              whiteSpace: "pre-wrap",
            }}
          />
        </div> */}
        {/* <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <label>组件交互</label>
          <textarea
            value={componentInteraction}
            onChange={(e) => setComponentInteraction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入组件交互方式"
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontFamily: "inherit",
              fontSize: "inherit",
              whiteSpace: "pre-wrap",
            }}
          />
        </div> */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <label>组件规约</label>
          <textarea
            value={componentStatute}
            onChange={(e) => setComponentStatute(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入组件规约"
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontFamily: "inherit",
              fontSize: "inherit",
              whiteSpace: "pre-wrap",
            }}
          />
        </div>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <label>组件映射</label>
          <textarea
            value={componentMapping}
            onChange={(e) => setComponentMapping(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入组件映射"
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontFamily: "inherit",
              fontSize: "inherit",
              whiteSpace: "pre-wrap",
            }}
          />
        </div>
        {/* <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <label>组件样式</label>
          <textarea
            value={componentStyle}
            onChange={(e) => setComponentStyle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入组件样式"
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontFamily: "inherit",
              fontSize: "inherit",
              whiteSpace: "pre-wrap",
            }}
          />
        </div> */}
        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}
        >
          <FilledButton
            variant="outlined"
            color="muted"
            label={t("buttons.cancel")}
            onClick={onClose}
          >
            {t("buttons.cancel")}
          </FilledButton>
          <FilledButton
            label={t("buttons.submit")}
            onClick={handleSubmit}
            variant="filled"
          >
            {t("buttons.submit")}
          </FilledButton>
        </div>
      </div>
    </Dialog>
  );
};