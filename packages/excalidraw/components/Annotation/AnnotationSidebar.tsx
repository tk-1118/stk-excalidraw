import React, { useState, useRef, useEffect, useCallback } from "react";

import { useI18n } from "../../i18n";
import { CloseIcon } from "../icons";

import MentionInput, { type ApplicationService } from "./MentionInput";

import "./AnnotationSidebar.scss";

import type { AppClassProperties } from "../../types";

interface AnnotationSidebarProps {
  /** 关闭侧边栏的回调函数 */
  onClose: () => void;
  /** 确认提交注释内容的回调函数 */
  onConfirm: (text: string) => void;
  /** 默认填充的注释内容 */
  defaultValue?: string;
  /** 侧边栏是否可见 */
  isVisible: boolean;
  /** 强制重置表单的标识符，当此值变化时会重置表单 */
  resetKey?: string | number;
  /** 应用服务树数据，用于@提及功能 */
  applicationServiceTree?: ApplicationService[];
  /** 应用实例 */
  app: AppClassProperties;
}

/**
 * 注释侧边栏组件
 * 提供不遮挡画布的注释编辑界面，支持多个分类字段的结构化输入
 */
export const AnnotationSidebar = ({
  onClose,
  onConfirm,
  defaultValue = "",
  isVisible,
  resetKey,
  applicationServiceTree = [],
  app,
}: AnnotationSidebarProps) => {
  const { t } = useI18n();

  // 完全照抄 AnnotationDialog 的状态管理
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

  // 侧边栏特有的状态（保留）
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);

  // 完全照抄 AnnotationDialog 的 handleInputChange
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    // console.log("handleInputChange", field, value);
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // 完全照抄 AnnotationDialog 的 handleConfirm
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

    console.log("提交的jsonData:", jsonData);
    // console.log("formData.interaction:", formData.interaction);

    // 将JSON数据作为字符串传递
    onConfirm(JSON.stringify(jsonData));
    onClose();
  };

  // 完全照抄 AnnotationDialog 的 toggleSection
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // 完全照抄 AnnotationDialog 的第一个 useEffect（聚焦逻辑）
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

  // 完全照抄 AnnotationDialog 的第二个 useEffect（解析 defaultValue）
  useEffect(() => {
    // console.log("解析 defaultValue:", defaultValue);
    if (defaultValue) {
      try {
        // 尝试解析默认值为JSON
        const parsedData = JSON.parse(defaultValue);
        // console.log("解析后的 parsedData:", parsedData);
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

  // 处理 resetKey 变化：仅重置展开状态，不清空表单，避免回显丢失
  useEffect(() => {
    if (resetKey !== undefined) {
      setExpandedSections({
        purpose: true,
        operation: false,
        result: false,
        interaction: false,
        requirements: false,
        mapping: false,
      });
    }
  }, [resetKey]);

  /**
   * 处理拖拽调整侧边栏宽度
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) {
        return;
      }

      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 300;
      const maxWidth = Math.min(800, window.innerWidth * 0.6);

      setSidebarWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    },
    [isResizing],
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // 监听鼠标事件处理拖拽
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [handleMouseMove, handleMouseUp, isResizing]);

  // 使用原生事件监听器阻止wheel事件冒泡到画布
  useEffect(() => {
    if (!sidebarRef.current || !isVisible) {
      return;
    }

    const sidebar = sidebarRef.current;

    const handleWheelEvent = (e: WheelEvent) => {
      // 阻止wheel事件冒泡到Excalidraw容器
      e.stopPropagation();
    };

    const handleTouchStart = (e: TouchEvent) => {
      // 阻止触摸事件冒泡到Excalidraw容器
      e.stopPropagation();
    };

    const handleTouchMove = (e: TouchEvent) => {
      // 阻止触摸移动事件冒泡到Excalidraw容器
      e.stopPropagation();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // 阻止触摸结束事件冒泡到Excalidraw容器
      e.stopPropagation();
    };

    // 使用原生addEventListener，设置passive: false以便能够调用preventDefault
    sidebar.addEventListener("wheel", handleWheelEvent, {
      passive: false,
    });
    sidebar.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    sidebar.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    sidebar.addEventListener("touchend", handleTouchEnd, {
      passive: false,
    });

    return () => {
      sidebar.removeEventListener("wheel", handleWheelEvent);
      sidebar.removeEventListener("touchstart", handleTouchStart);
      sidebar.removeEventListener("touchmove", handleTouchMove);
      sidebar.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      ref={sidebarRef}
      className="annotation-sidebar"
      style={{ width: sidebarWidth }}
    >
      {/* 拖拽调整宽度的手柄 */}
      <div
        className="annotation-sidebar-resize-handle"
        onMouseDown={handleMouseDown}
      />

      {/* 侧边栏头部 */}
      <div className="annotation-sidebar-header">
        <h2 className="annotation-sidebar-title">{t("labels.addRemark")}</h2>
        <button
          className="annotation-sidebar-close"
          onClick={onClose}
          title={t("buttons.close")}
          aria-label={t("buttons.close")}
        >
          {CloseIcon}
        </button>
      </div>

      {/* 侧边栏内容区域 */}
      <div className="annotation-sidebar-content">
        {/* 作用对象 */}
        <div className="annotation-sidebar-section">
          <div
            className="annotation-sidebar-section-header"
            onClick={() => toggleSection("purpose")}
          >
            <span className="annotation-sidebar-section-title">作用对象</span>
            <span className="annotation-sidebar-section-toggle">
              {expandedSections.purpose ? "▲" : "▼"}
            </span>
          </div>
          {expandedSections.purpose && (
            <div className="annotation-sidebar-section-content">
              <textarea
                ref={firstFieldRef}
                className="annotation-sidebar-textarea"
                value={formData.purpose}
                onChange={(e) => handleInputChange("purpose", e.target.value)}
                placeholder={`说明该提示对应的页面元素或功能点，方便后续整理与实现。
建议写法：位置 + 元素类型 + 元素名称（可选其二）
示例：
  • 页面顶部的搜索条件标题
  • "客户列表"中的"状态"字段
  • "订单详情"信息展示表单
  • 表单中的"联系人电话"输入框`}
              />
            </div>
          )}
        </div>

        {/* 需求说明 */}
        <div className="annotation-sidebar-section">
          <div
            className="annotation-sidebar-section-header"
            onClick={() => toggleSection("operation")}
          >
            <span className="annotation-sidebar-section-title">需求说明</span>
            <span className="annotation-sidebar-section-toggle">
              {expandedSections.operation ? "▲" : "▼"}
            </span>
          </div>
          {expandedSections.operation && (
            <div className="annotation-sidebar-section-content">
              <textarea
                className="annotation-sidebar-textarea"
                value={formData.operation}
                onChange={(e) => handleInputChange("operation", e.target.value)}
                placeholder={`描述该组件的业务意义和目标。
示例：
  • 在客户列表中提供状态筛选，方便业务人员快速定位目标客户。
  • 在订单详情页展示快递单号，方便客户跟踪物流。`}
              />
            </div>
          )}
        </div>

        {/* 用户操作与交互 */}
        <div className="annotation-sidebar-section">
          <div
            className="annotation-sidebar-section-header"
            onClick={() => toggleSection("result")}
          >
            <span className="annotation-sidebar-section-title">
              用户操作与交互
            </span>
            <span className="annotation-sidebar-section-toggle">
              {expandedSections.result ? "▲" : "▼"}
            </span>
          </div>
          {expandedSections.result && (
            <div className="annotation-sidebar-section-content">
              <textarea
                className="annotation-sidebar-textarea"
                value={formData.result}
                onChange={(e) => handleInputChange("result", e.target.value)}
                placeholder={`说明用户如何使用该组件，交互流程是什么。
示例：
  • 用户选择状态下拉框中的"已签约" → 列表刷新显示匹配数据
  • 用户输入关键字 → 点击"搜索" → 展示结果列表`}
              />
            </div>
          )}
        </div>

        {/* 服务端接口交互 */}
        <div className="annotation-sidebar-section">
          <div
            className="annotation-sidebar-section-header"
            onClick={() => toggleSection("interaction")}
          >
            <span className="annotation-sidebar-section-title">
              服务端接口交互
            </span>
            <span className="annotation-sidebar-section-toggle">
              {expandedSections.interaction ? "▲" : "▼"}
            </span>
          </div>
          {expandedSections.interaction && (
            <div
              className="annotation-sidebar-section-content"
              onMouseEnter={() => {
                console.log("updateApplicationServiceTree");

                app.onHemaButtonClick("updateApplicationServiceTree", {});
              }}
            >
              <MentionInput
                value={formData.interaction}
                onChange={(html: string) => {
                  // MentionInput 直接传递HTML内容
                  handleInputChange("interaction", html);
                }}
                applicationServiceTree={applicationServiceTree}
                placeholder={`引用已配置的服务端应用服务，并说明调用目的、输入输出要点。
格式：
  • 应用服务：@服务端/应用服务名称
  • 调用目的：简要说明为何调用
  • 关键输入：说明哪些字段会传入（字段名可与应用服务定义一致）
  • 关键输出：说明需要用到的返回字段`}
                className="annotation-sidebar-mention-input"
                onMentionSelected={(mentions: any) => {
                  if (mentions.length > 0) {
                    // 可以触发其他回调或状态更新
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* 映射组件库 */}
        <div className="annotation-sidebar-section">
          <div
            className="annotation-sidebar-section-header"
            onClick={() => toggleSection("mapping")}
          >
            <span className="annotation-sidebar-section-title">映射组件库</span>
            <span className="annotation-sidebar-section-toggle">
              {expandedSections.mapping ? "▲" : "▼"}
            </span>
          </div>
          {expandedSections.mapping && (
            <div className="annotation-sidebar-section-content">
              <textarea
                className="annotation-sidebar-textarea"
                value={formData.mapping}
                onChange={(e) => handleInputChange("mapping", e.target.value)}
                placeholder={`示例：
商品上架数据表格使用了element-plus的el-table组件`}
              />
            </div>
          )}
        </div>
      </div>

      {/* 侧边栏底部按钮 */}
      <div className="annotation-sidebar-footer">
        <button
          type="button"
          className="annotation-sidebar-button cancel-button"
          onClick={onClose}
        >
          {t("buttons.cancel")}
        </button>
        <button
          type="button"
          className="annotation-sidebar-button confirm-button"
          onClick={handleConfirm}
        >
          {t("buttons.confirm")}
        </button>
      </div>
    </div>
  );
};
