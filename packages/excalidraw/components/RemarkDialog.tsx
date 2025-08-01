import React, { useState, useEffect, useRef } from "react";

import { useI18n } from "../i18n";

import { Dialog } from "./Dialog";
import { TextField } from "./TextField";

import { FilledButton } from "./FilledButton";

interface RemarkDialogProps {
  remark: string;
  onSubmit: (remark: string) => void;
  onClose: () => void;
}

export const RemarkDialog = ({
  remark,
  onSubmit,
  onClose,
}: RemarkDialogProps) => {
  const { t } = useI18n();
  const [inputValue, setInputValue] = useState(remark);
  const textFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 自动聚焦到输入框
    if (textFieldRef.current) {
      textFieldRef.current.focus();
      textFieldRef.current.select();
    }
  }, []);

  const handleSubmit = () => {
    onSubmit(inputValue);
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
          ref={textFieldRef}
          value={inputValue}
          onChange={setInputValue}
          onKeyDown={handleKeyDown}
          fullWidth
          placeholder={t("labels.addRemark")}
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