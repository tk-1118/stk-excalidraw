import React, { useState, useEffect, useRef } from "react";

import { useI18n } from "../i18n";

import { Dialog } from "./Dialog";
import { TextField } from "./TextField";

import { FilledButton } from "./FilledButton";

interface RemarkDialogProps {
  customData: {
    componentType: string;
    componentBehavior: string;
    componentInteraction: string;
  };
  onSubmit: (customData: ComponentDescription) => void;
  onClose: () => void;
}

interface ComponentDescription {
  componentType: string;
  componentBehavior: string;
  componentInteraction: string;
}

export const RemarkDialog = ({
  customData,
  onSubmit,
  onClose,
}: RemarkDialogProps) => {
  const { t } = useI18n();

  const initialDescription = customData;
  const [componentType, setComponentType] = useState(
    initialDescription.componentType,
  );
  const [componentBehavior, setComponentBehavior] = useState(
    initialDescription.componentBehavior,
  );
  const [componentInteraction, setComponentInteraction] = useState(
    initialDescription.componentInteraction,
  );

  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 自动聚焦到第一个输入框
    if (firstFieldRef.current) {
      firstFieldRef.current.focus();
    }
  }, []);

  const handleSubmit = () => {
    const customData: ComponentDescription = {
      componentType,
      componentBehavior,
      componentInteraction,
    };
    onSubmit(customData);
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
        <TextField
          ref={firstFieldRef}
          value={componentType}
          onChange={setComponentType}
          onKeyDown={handleKeyDown}
          fullWidth
          label="组件类型"
          placeholder="请输入组件类型"
        />
        <TextField
          value={componentBehavior}
          onChange={setComponentBehavior}
          onKeyDown={handleKeyDown}
          fullWidth
          label="组件功能"
          placeholder="请输入组件功能"
        />
        <TextField
          value={componentInteraction}
          onChange={setComponentInteraction}
          onKeyDown={handleKeyDown}
          fullWidth
          label="组件交互"
          placeholder="请输入组件交互方式"
        />
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