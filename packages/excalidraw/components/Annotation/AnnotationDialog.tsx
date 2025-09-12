import React, { useState, useRef, useEffect } from "react";

import { useI18n } from "../../i18n";

import { Dialog } from "../Dialog";

import { AnnotationSidebar } from "./AnnotationSidebar";

import "./AnnotationDialog.scss";

interface AnnotationDialogProps {
  /** 关闭注释对话框的回调函数 */
  onClose: () => void;
  /** 确认提交注释内容的回调函数 */
  onConfirm: (text: string) => void;
  /** 默认填充的注释内容 */
  defaultValue?: string;
  /** 是否使用侧边栏模式（默认true，提供更好的用户体验） */
  useSidebar?: boolean;
  /** 强制重置表单的标识符，当此值变化时会重置表单 */
  resetKey?: string | number;
}

/**
 * 注释对话框组件
 * 支持传统Dialog模式和现代侧边栏模式
 * 侧边栏模式提供更好的用户体验，允许用户在编写注释时查看画布内容
 */
export const AnnotationDialog = ({
  onClose,
  onConfirm,
  defaultValue = "",
  useSidebar = true,
  resetKey,
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
    // 以JSON格式存储数据
    const jsonData = {
      purpose: formData.purpose || "无描述",
      operation: formData.operation || "无描述",
      result: formData.result || "无描述",
      interaction: formData.interaction || "无描述",
      requirements: formData.requirements || "无描述",
      mapping: formData.mapping || "无描述",
    };

    // 将JSON数据作为字符串传递
    onConfirm(JSON.stringify(jsonData));
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
      try {
        // 尝试解析默认值为JSON
        const parsedData = JSON.parse(defaultValue);
        if (typeof parsedData === "object" && parsedData !== null) {
          setFormData({
            purpose: parsedData.purpose || "",
            operation: parsedData.operation || "",
            result: parsedData.result || "",
            interaction: parsedData.interaction || "",
            requirements: parsedData.requirements || "",
            mapping: parsedData.mapping || "",
          });
          return;
        }
      } catch (e) {
        // 尝试解析显示文本格式（从App.tsx生成的格式）
        if (
          defaultValue.includes("作用对象:") ||
          defaultValue.includes("需求说明:")
        ) {
          const parsedData: Record<string, string> = {};

          // 解析显示文本格式
          const purposeMatch = defaultValue.match(/作用对象:\s*([^\n]*)/);
          const operationMatch = defaultValue.match(/需求说明:\s*([^\n]*)/);
          const resultMatch = defaultValue.match(/用户操作与交互:\s*([^\n]*)/);
          const interactionMatch =
            defaultValue.match(/服务端接口交互:\s*([^\n]*)/);
          const requirementsMatch = defaultValue.match(/特殊要求:\s*([^\n]*)/);

          if (
            purposeMatch &&
            purposeMatch[1] &&
            purposeMatch[1].trim() !== "无描述"
          ) {
            parsedData.purpose = purposeMatch[1].trim();
          }
          if (
            operationMatch &&
            operationMatch[1] &&
            operationMatch[1].trim() !== "无描述"
          ) {
            parsedData.operation = operationMatch[1].trim();
          }
          if (
            resultMatch &&
            resultMatch[1] &&
            resultMatch[1].trim() !== "无描述"
          ) {
            parsedData.result = resultMatch[1].trim();
          }
          if (
            interactionMatch &&
            interactionMatch[1] &&
            interactionMatch[1].trim() !== "无描述"
          ) {
            parsedData.interaction = interactionMatch[1].trim();
          }
          if (
            requirementsMatch &&
            requirementsMatch[1] &&
            requirementsMatch[1].trim() !== "无描述"
          ) {
            parsedData.requirements = requirementsMatch[1].trim();
          }

          setFormData((prev) => ({
            ...prev,
            ...parsedData,
          }));
          return;
        }

        // 兼容旧格式的解析逻辑（key=value，key=value格式）
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
    }
  }, [defaultValue]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // 优先使用侧边栏模式，提供更好的用户体验
  if (useSidebar) {
    return (
      <></>
      // <AnnotationSidebar
      //   onClose={onClose}
      //   onConfirm={onConfirm}
      //   defaultValue={defaultValue}
      //   isVisible={true}
      //   resetKey={resetKey}
      //   app={app}
      // />
    );
  }

  // 传统Dialog模式（保留向后兼容性）
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
              作用对象
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
              让用户搜索订单说明该提示对应的页面元素或功能点，方便后续整理与实现。
建议写法：位置 + 元素类型 + 元素名称（可选其二）
示例：
	•	页面顶部的搜索条件标题
	•	"客户列表"中的"状态"字段
	•	"订单详情"信息展示表单
	•	表单中的"联系人电话"输入框`}
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
              需求说明
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
                placeholder={`描述该组件的业务意义和目标。
示例：
	•	在客户列表中提供状态筛选，方便业务人员快速定位目标客户。
	•	在订单详情页展示快递单号，方便客户跟踪物流。`}
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
              用户操作与交互
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
                placeholder={`说明用户如何使用该组件，交互流程是什么。
示例：
	•	用户选择状态下拉框中的"已签约" → 列表刷新显示匹配数据
	•	用户输入关键字 → 点击"搜索" → 展示结果列表`}
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
              服务端接口交互
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
                placeholder={`引用已配置的服务端应用服务，并说明调用目的、输入输出要点。
格式：
	•	应用服务：@服务端/应用服务名称
	•	调用目的：简要说明为何调用
	•	关键输入：说明哪些字段会传入（字段名可与应用服务定义一致）
	•	关键输出：说明需要用到的返回字段`}
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
              映射组件库
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
