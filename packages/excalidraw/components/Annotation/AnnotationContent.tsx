import React, { useState, useEffect, useCallback, useRef } from "react";

import "./AnnotationContent.scss";

import type { ExcalidrawAnnotationElement } from "../../../element/src/types";

interface AnnotationData {
  purpose: string;
  operation: string;
  result: string;
  interaction: string;
  requirements: string;
  mapping: string;
}

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
  const [parsedData, setParsedData] = useState<AnnotationData | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(true);

    // 尝试解析结构化数据，优先使用customData中的rawData
    if (element.customData?.rawData) {
      try {
        const data = JSON.parse(element.customData.rawData);
        setParsedData(data);
      } catch (e) {
        console.error("Failed to parse annotation rawData", e);
        // 如果rawData解析失败，尝试解析text字段
        parseTextData();
      }
    } else {
      // 如果没有rawData，尝试解析text字段
      parseTextData();
    }

    return () => setIsVisible(false);
  }, [element]);

  // 解析text字段中的数据
  const parseTextData = () => {
    if (element.text) {
      const parsed: AnnotationData = {
        purpose: "",
        operation: "",
        result: "",
        interaction: "",
        requirements: "",
        mapping: "",
      };

      try {
        // 尝试解析text是否为JSON格式
        const jsonData = JSON.parse(element.text);
        if (typeof jsonData === "object" && jsonData !== null) {
          setParsedData({
            purpose: jsonData.purpose || "无描述",
            operation: jsonData.operation || "无描述",
            result: jsonData.result || "无描述",
            interaction: jsonData.interaction || "无描述",
            requirements: jsonData.requirements || "无描述",
            mapping: jsonData.mapping || "无描述",
          });
          return;
        }
      } catch (e) {
        // 如果不是JSON，按行解析文本
        const lines = element.text.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith("作用对象:")) {
            parsed.purpose = line.substring(4).trim() || "无描述";
          } else if (line.startsWith("需求说明:")) {
            parsed.operation = line.substring(6).trim() || "无描述";
          } else if (line.startsWith("用户操作与交互:")) {
            parsed.result = line.substring(6).trim() || "无描述";
          } else if (line.startsWith("服务端接口交互:")) {
            parsed.interaction = line.substring(7).trim() || "无描述";
          } else if (line.startsWith("特殊要求:")) {
            parsed.requirements = line.substring(6).trim() || "无描述";
          }
        }

        setParsedData(parsed);
      }
    }
  };

  const handleClose = useCallback(() => {
    setIsVisible(false);
    // 延迟调用onClose，让动画有时间完成
    setTimeout(() => {
      onClose?.();
    }, 200);
  }, [onClose]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    // 防止点击内容区域时关闭
    e.stopPropagation();
    setIsActive(true);
    setTimeout(() => setIsActive(false), 300);
  }, []);

  const handleMouseEnter = useCallback(() => {
    // 鼠标进入时取消可能的关闭操作
  }, []);

  const handleMouseLeave = useCallback(() => {
    // 鼠标离开时关闭注释
    handleClose();
  }, [handleClose]);

  const contentClasses = [
    "annotation-content",
    isVisible ? "visible" : "closing",
    isActive ? "active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // 渲染单个字段
  const renderField = (label: string, value: string, icon?: string) => {
    if (!value || value === "无描述") return null;

    return (
      <div className="annotation-field">
        <div className="annotation-field-header">
          {icon && <span className="annotation-field-icon">{icon}</span>}
          <span className="annotation-field-label">{label}</span>
        </div>
        <div className="annotation-field-value">{value}</div>
      </div>
    );
  };

  return (
    <div 
      ref={contentRef}
      className={contentClasses}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="annotation-content-box" onClick={handleContentClick}>
        {/* <button
          className="annotation-content-close"
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          aria-label="关闭"
        >
          ×
        </button> */}
        <div className="annotation-content-header">
          <h3>组件标注</h3>
        </div>
        <div className="annotation-content-body">
          {parsedData ? (
            <>
              {renderField("作用对象", parsedData.purpose, "🎯")}
              {renderField("需求说明", parsedData.operation, "👆")}
              {renderField("用户操作与交互", parsedData.result, "✅")}
              {renderField("服务端接口交互", parsedData.interaction, "📡")}
              {/* {renderField("特殊要求", parsedData.requirements, "⚠️")} */}
              {!parsedData.purpose &&
                !parsedData.operation &&
                !parsedData.result &&
                !parsedData.interaction &&
                !parsedData.requirements && (
                  <div className="annotation-empty-state">
                    <div className="annotation-empty-icon">📋</div>
                    <p>暂无标注内容</p>
                  </div>
                )}
            </>
          ) : (
            <div className="annotation-content-text">
              {element.text || "无内容"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};