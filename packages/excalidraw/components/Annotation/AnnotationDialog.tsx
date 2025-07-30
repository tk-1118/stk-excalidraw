import React, { useState } from "react";

import { Dialog } from "../Dialog";

import { t } from "../../i18n";

import "./AnnotationDialog.scss";

interface AnnotationDialogProps {
  onClose: () => void;
  onConfirm: (text: string) => void;
  defaultValue?: string;
}

export const AnnotationDialog = ({
  onClose,
  onConfirm,
  defaultValue = "",
}: AnnotationDialogProps) => {
  const [text, setText] = useState(defaultValue);

  const handleConfirm = () => {
    onConfirm(text);
    onClose();
  };

  return (
    <Dialog
      onCloseRequest={onClose}
      title="添加标注"
      className="annotation-dialog"
      size="small"
    >
      <div className="annotation-dialog-content">
        <div className="annotation-dialog-row">
          <textarea
            className="annotation-text"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="请输入标注内容"
            rows={5}
          />
        </div>
        <div className="annotation-dialog-buttons">
          <button
            type="button"
            className="annotation-dialog-button cancel-button"
            onClick={onClose}
          >
            {t("buttons.cancel")}
          </button>
          <button
            type="button"
            className="annotation-dialog-button confirm-button"
            onClick={handleConfirm}
            disabled={!text.trim()}
          >
            {t("buttons.confirm")}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
