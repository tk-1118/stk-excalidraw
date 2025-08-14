import React, { useState, useRef, useEffect } from "react";

import { useI18n } from "../../i18n";

import { Dialog } from "../Dialog";

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
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    purpose: "",
    operation: "",
    result: "",
    interaction: "",
    requirements: "",
    mapping: "",
  });
  const [expandedSections, setExpandedSections] = useState({
    purpose: true,
    operation: false,
    result: false,
    interaction: false,
    requirements: false,
    mapping: false,
  });

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const firstFieldRef = useRef<HTMLTextAreaElement>(null);

  const handleConfirm = () => {
    // 按照指定模板格式化数据
    const formattedText =
      `组件：\n` +
      `\n用途: ${formData.purpose || "无描述"}\n` +
      `\n用户操作: ${formData.operation || "无描述"}\n` +
      `\n操作结果: ${formData.result || "无描述"}\n` +
      `\n服务端交互: ${formData.interaction || "无描述"}\n` +
      `\n特殊要求: ${formData.requirements || "无描述"}\n`;

    onConfirm(formattedText);
    onClose();
  };

  // 使用多种策略确保文本域获取焦点
  useEffect(() => {
    const timerId = setTimeout(() => {
      if (firstFieldRef.current) {
        firstFieldRef.current.focus();
      }
    }, 300);

    return () => {
      clearTimeout(timerId);
    };
  }, []);

  // 解析 defaultValue 并填充表单
  useEffect(() => {
    if (defaultValue) {
      // 尝试解析默认值并填充表单
      const fields = defaultValue.split("，").filter(Boolean);
      const parsedData: Record<string, string> = {};

      fields.forEach((field) => {
        const [key, ...valueParts] = field.split("=");
        const value = valueParts.join("=").replace(/^"(.*)"$/, "$1"); // 移除引号

        switch (key?.trim()) {
          case "用途":
            parsedData.purpose = value || "";
            break;
          case "用户操作":
            parsedData.operation = value || "";
            break;
          case "结果":
            parsedData.result = value || "";
            break;
          case "服务端交互":
            parsedData.interaction = value || "";
            break;
          case "特殊要求":
            parsedData.requirements = value || "";
            break;
          default:
            break;
        }
      });

      setFormData((prev) => ({
        ...prev,
        ...parsedData,
      }));
    }
  }, [defaultValue]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <Dialog
      onCloseRequest={onClose}
      title={t("labels.addRemark")}
      className="annotation-dialog"
      size="wide"
      autofocus={false}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "70vh" }}>
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "0 8px 0 0",
            marginBottom: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label
              onClick={() => toggleSection("purpose")}
              style={{ cursor: "pointer" }}
            >
              1. 它在页面上是干什么的？
              {!expandedSections.purpose && (
                <span style={{ float: "right" }}>▼</span>
              )}
              {expandedSections.purpose && (
                <span style={{ float: "right" }}>▲</span>
              )}
            </label>
            {expandedSections.purpose && (
              <textarea
                id="annotation-text"
                ref={firstFieldRef}
                className="annotation-text"
                value={formData.purpose}
                onChange={(e) => handleInputChange("purpose", e.target.value)}
                placeholder={`示例：
                展示商品信息
                让用户搜索订单
                显示订单当前状态`}
                style={{
                  boxSizing: "border-box",
                  width: "100%",
                  minHeight: "200px",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  whiteSpace: "pre-wrap",
                }}
              />
            )}
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label
              onClick={() => toggleSection("operation")}
              style={{ cursor: "pointer" }}
            >
              2. 用户会怎么操作它？
              {!expandedSections.operation && (
                <span style={{ float: "right" }}>▼</span>
              )}
              {expandedSections.operation && (
                <span style={{ float: "right" }}>▲</span>
              )}
            </label>
            {expandedSections.operation && (
              <textarea
                value={formData.operation}
                onChange={(e) => handleInputChange("operation", e.target.value)}
                placeholder={`示例：
                点击 / 输入文字 / 选择下拉项 / 拖拽 / 悬停显示 / 无操作 / 其他…`}
                style={{
                  boxSizing: "border-box",
                  width: "100%",
                  minHeight: "200px",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  whiteSpace: "pre-wrap",
                }}
              />
            )}
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label
              onClick={() => toggleSection("result")}
              style={{ cursor: "pointer" }}
            >
              3. 用户操作后会发生什么？
              {!expandedSections.result && (
                <span style={{ float: "right" }}>▼</span>
              )}
              {expandedSections.result && (
                <span style={{ float: "right" }}>▲</span>
              )}
            </label>
            {expandedSections.result && (
              <textarea
                value={formData.result}
                onChange={(e) => handleInputChange("result", e.target.value)}
                placeholder={`示例：
                点击"立即购买" → 跳转到支付页
                输入搜索词 → 列表实时刷新
                选择订单状态 → 筛选订单列表
                无操作 → 仅展示信息`}
                style={{
                  boxSizing: "border-box",
                  width: "100%",
                  minHeight: "200px",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  whiteSpace: "pre-wrap",
                }}
              />
            )}
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label
              onClick={() => toggleSection("interaction")}
              style={{ cursor: "pointer" }}
            >
              4. 需要和服务端交互吗？
              {!expandedSections.interaction && (
                <span style={{ float: "right" }}>▼</span>
              )}
              {expandedSections.interaction && (
                <span style={{ float: "right" }}>▲</span>
              )}
            </label>
            {expandedSections.interaction && (
              <textarea
                value={formData.interaction}
                onChange={(e) =>
                  handleInputChange("interaction", e.target.value)
                }
                placeholder={`示例：
                获取商品详情
                提交订单
                搜索订单列表
                上传文件
                ）*
                "成功后告诉用户什么？"
                *（示例：
                "订单提交成功！"
                "找到3个订单"
                "文件上传完成"
                ）*
                "失败时告诉用户什么？"
                *（示例：
                "网络错误，请重试"
                "库存不足"
                "文件格式不支持"
                ）*`}
                style={{
                  boxSizing: "border-box",
                  width: "100%",
                  minHeight: "200px",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  whiteSpace: "pre-wrap",
                }}
              />
            )}
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label
              onClick={() => toggleSection("requirements")}
              style={{ cursor: "pointer" }}
            >
              5. 有没有什么特殊要求？
              {!expandedSections.requirements && (
                <span style={{ float: "right" }}>▼</span>
              )}
              {expandedSections.requirements && (
                <span style={{ float: "right" }}>▲</span>
              )}
            </label>
            {expandedSections.requirements && (
              <textarea
                value={formData.requirements}
                onChange={(e) =>
                  handleInputChange("requirements", e.target.value)
                }
                placeholder={`示例：
                必须显示"新品"标签
                金额显示要保留两位小数
                超过1000字要折叠
                只允许输入数字`}
                style={{
                  boxSizing: "border-box",
                  width: "100%",
                  minHeight: "200px",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  whiteSpace: "pre-wrap",
                }}
              />
            )}
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label
              onClick={() => toggleSection("mapping")}
              style={{ cursor: "pointer" }}
            >
              6. 有没有使用UI库？
              {!expandedSections.mapping && (
                <span style={{ float: "right" }}>▼</span>
              )}
              {expandedSections.mapping && (
                <span style={{ float: "right" }}>▲</span>
              )}
            </label>
            {expandedSections.mapping && (
              <textarea
                value={formData.mapping}
                onChange={(e) => handleInputChange("mapping", e.target.value)}
                placeholder={`示例：
                商品上架数据表格使用了element-plus的el-table组件
                `}
                style={{
                  boxSizing: "border-box",
                  width: "100%",
                  minHeight: "200px",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  whiteSpace: "pre-wrap",
                }}
              />
            )}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
            paddingTop: "16px",
            borderTop: "1px solid var(--color-border)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="annotation-dialog-button cancel-button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              backgroundColor: "#fff",
              color: "#333",
              cursor: "pointer",
            }}
          >
            {t("buttons.cancel")}
          </button>
          <button
            type="button"
            className="annotation-dialog-button confirm-button"
            onClick={handleConfirm}
            style={{
              padding: "8px 16px",
              border: "1px solid var(--color-primary)",
              borderRadius: "4px",
              backgroundColor: "var(--color-primary)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {t("buttons.confirm")}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
