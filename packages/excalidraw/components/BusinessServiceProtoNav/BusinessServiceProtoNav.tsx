import "./BusinessServiceProtoNav.scss";

import { exportToCanvas } from "@excalidraw/utils/export";

import { useState, useRef } from "react";

import { getNonDeletedElements, isFrameLikeElement } from "@excalidraw/element";

import {
  getDefaultFrameName,
  // getElementsOverlappingFrame,
  getFrameChildren,
} from "@excalidraw/element/frame";

import { newElementWith } from "@excalidraw/element";

import { newFrameElement } from "@excalidraw/element";

import type {
  ExcalidrawFrameLikeElement,
  ExcalidrawFrameElement,
} from "@excalidraw/element/types";

import { frameToolIcon, moreIcon } from "../icons";

import { useApp, useExcalidrawSetAppState } from "../App";

import excalidrawTemplate from "./excalidraw-template.json";

export const BusinessServiceProtoNav = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  const elements = app.scene.getNonDeletedElements();
  //   console.log("elements:", elements);

  const frames = elements.filter((el) =>
    isFrameLikeElement(el),
  ) as ExcalidrawFrameLikeElement[];
  frames.sort((a, b) => a.y - b.y);
  //   console.log("frames:", frames);

  const [selectedFrame, setSelectedFrame] =
    useState<ExcalidrawFrameLikeElement | null>(null);

  const [activeMenuFrameId, setActiveMenuFrameId] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [selectedTemplateType, setSelectedTemplateType] = useState<string>("BLANK");
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 模板类型数据
  const templateTypes = excalidrawTemplate?.map((temp) => {
    return {
      tempTypeName: temp.tempTypeName,
      tempType: temp.tempType,
    };
  }) || [
    {
      tempTypeName: "表格模版",
      tempType: "TABLE_TEMP",
    },
  ];

  const frameClick = (frame: ExcalidrawFrameLikeElement) => {
    // console.log("frame:", frame);
    setSelectedFrame(frame);
    setActiveMenuFrameId(null);

    // 主动选中frame元素
    setAppState({
      selectedElementIds: { [frame.id]: true },
    });
    app.scrollToContent(frame, { animate: true });
  };

  const frameExportPng = async (exportingFrame: ExcalidrawFrameLikeElement) => {
    const elementsInFrame = getFrameChildren(
      getNonDeletedElements(elements),
      exportingFrame.id,
    ).filter((element) => !(element.type === "text" && element.containerId));

    // const exportedElements = getElementsOverlappingFrame(
    //   elements,
    //   exportingFrame,
    // );
    const canvas = exportToCanvas({
      elements: elementsInFrame,
      appState: app.state,
      files: app.files,
      // exportingFrame, // 关键参数
      // exportPadding: 0,
    });
    // 转换为 PNG blob
    const blob = await new Promise<Blob>(async (resolve) => {
      (await canvas).toBlob((blob) => resolve(blob!), "image/png");
    });
    // 创建一个临时的 URL 对象
    const url = URL.createObjectURL(blob);

    // 创建一个隐藏的 <a> 标签
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = exportingFrame.name || "";

    // 将 <a> 标签添加到文档中
    document.body.appendChild(a);
    a.click();

    // 清理
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const deleteFrame = (frame: ExcalidrawFrameLikeElement) => {
    app.scene.replaceAllElements(
      app.scene.getElementsIncludingDeleted().map((el) => {
        if (el.id === frame.id) {
          return {
            ...el,
            isDeleted: true,
          };
        }
        // Also delete all elements in the frame
        if (el.frameId === frame.id) {
          return {
            ...el,
            isDeleted: true,
          };
        }
        return el;
      }),
    );
    setActiveMenuFrameId(null);
  };

  const addNewFrame = () => {
    setShowTemplateModal(true);
  };

  const createFrameWithTemplate = (
    templateType: string,
    tempTypeName?: string,
    templateData?: any,
  ) => {
    console.log(templateType, tempTypeName, templateData);
    let newFrame = newFrameElement({
      name: `新建${tempTypeName || ""}页面`,
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    }) as ExcalidrawFrameElement;

    if (templateType === "BLANK") {
      // 空白模板使用默认尺寸
      newFrame = newElementWith(newFrame, {
        width: 1920,
        height: 1080,
      });
    }

    // 确保新frame不会与其他frame重叠
    if (frames.length > 0) {
      const lastFrame = frames[frames.length - 1];
      newFrame = newElementWith(newFrame, {
        x: lastFrame.x,
        y: lastFrame.y + lastFrame.height + 100,
      });
    }

    let newElements;

    if (templateType !== "BLANK" && templateData?.elements) {
      let maxWidth = 0;
      let maxHeight = 0;
      let minTop = 0;
      let minLeft = 0;
      const templateElements = templateData?.elements?.map((el: any) => {
        maxWidth = Math.max(maxWidth, el.width);
        maxHeight = Math.max(maxHeight, el.height);
        if (minTop === 0 && minLeft === 0) {
          minTop = el.y;
          minLeft = el.x;
        } else {
          minTop = Math.min(minTop, el.y);
          minLeft = Math.min(minLeft, el.x);
        }
        return {
          ...el,
          frameId: newFrame.id,
        };
      });
      newFrame = newElementWith(newFrame, {
        width: maxWidth,
        height: maxHeight,
        x: minLeft,
        y: minTop,
      });
      newElements = [
        ...app.scene.getElementsIncludingDeleted(),
        newFrame,
        ...templateElements,
      ];
    } else {
      newElements = [...app.scene.getElementsIncludingDeleted(), newFrame];
    }

    app.scene.replaceAllElements(newElements);

    setShowTemplateModal(false);
    setSelectedFrame(newFrame);
    app.scrollToContent(newFrame, { animate: true });

    
  };

  const handleImagePreview = (imageUrl: string) => {
    setImagePreviewUrl(imageUrl);
  };

  const closeImagePreview = () => {
    setImagePreviewUrl(null);
  };

  return (
    <>
      <div className="business-service-proto-nav">
        <div className="business-service-proto-nav-header">
          <h4 className="business-service-proto-design">业务服务原型设计</h4>
          <h2 className="business-service-proto-name">业务服务名称</h2>
        </div>
        <div className="business-service-proto-nav-body">
          <div className="business-service-proto-nav-body-frames">
            <div className="add-page-button" onClick={addNewFrame}>
              + 添加页面
            </div>
            {(frames || []).map((frame) => (
              <div
                key={frame.id}
                className={`business-service-proto-nav-body-frames-item ${
                  selectedFrame?.id === frame.id ? "active" : ""
                }`}
                onClick={() => {
                  frameClick(frame);
                }}
              >
                <div className="frames-item-left">
                  <div className="title-icon">{frameToolIcon}</div>
                  <div className="title-text">
                    {frame.name ?? getDefaultFrameName(frame)}
                  </div>
                </div>
                <div className="frames-item-right">
                  <div
                    className="more-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFrame(frame);
                      setActiveMenuFrameId(
                        activeMenuFrameId === frame.id ? null : frame.id,
                      );
                    }}
                  >
                    {moreIcon}
                  </div>
                  {activeMenuFrameId === frame.id && (
                    <div className="frame-more-menu" ref={menuRef}>
                      <div
                        className="frame-more-menu-item"
                        onClick={() => frameExportPng(frame)}
                      >
                        导出页面PNG
                      </div>
                      <div 
                        className="frame-more-menu-item delete"
                        onClick={() => deleteFrame(frame)}
                      >
                        删除页面
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showTemplateModal && (
        <div
          className="template-modal-overlay"
          onClick={() => setShowTemplateModal(false)}
        >
          <div className="template-modal" onClick={(e) => e.stopPropagation()}>
            <div className="template-modal-header">
              <h3>选择页面模板</h3>
              <button 
                className="close-button" 
                onClick={() => setShowTemplateModal(false)}
              >
                ×
              </button>
            </div>
            <div className="template-modal-body">
              <div className="template-modal-layout">
                {/* 左侧模板类型切换侧边栏 */}
                <div className="template-sidebar">
                  {/* 添加创建空白模板的选项 */}
                  <div
                    className={`template-type-item ${
                      selectedTemplateType === "BLANK" ? "active" : ""
                    }`}
                    onClick={() => setSelectedTemplateType("BLANK")}
                  >
                    空白模板
                  </div>
                  {templateTypes.map((templateType, index) => (
                    <div 
                      key={index}
                      className={`template-type-item ${
                        selectedTemplateType === templateType.tempType
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedTemplateType(templateType.tempType)
                      }
                    >
                      {templateType.tempTypeName}
                    </div>
                  ))}
                </div>

                {/* 右侧模板内容区域 */}
                <div className="template-content">
                  {selectedTemplateType === "BLANK" ? (
                    <div className="template-modal-body-area">
                      <div className="template-option-list">
                        <div className="template-option">
                          <div className="template-preview desktop-preview">
                            <div
                              style={{
                                width: "100%",
                                height: "100%",
                                backgroundColor: "#f0f0f0",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#999",
                              }}
                            >
                              空白页面
                            </div>
                          </div>
                          <div className="template-opearte">
                            <button 
                              className="use-button"
                              onClick={() => createFrameWithTemplate("BLANK")}
                            >
                              创建
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    excalidrawTemplate
                      .filter(
                        (template) =>
                          template.tempType === selectedTemplateType,
                      )
                      .map((template, index) => (
                        <div className="template-modal-body-area" key={index}>
                          <div className="template-option-list">
                            {template.tempData.map((tempDataItem, index2) => (
                              <div className="template-option" key={index2}>
                                <div
                                  className="template-preview"
                                  onClick={() =>
                                    handleImagePreview(tempDataItem.cover)
                                  }
                                >
                                  <img src={tempDataItem.cover} alt="" />
                                </div>
                                <div className="template-name">
                                  {tempDataItem.tempName}
                                </div>
                                <div className="template-opearte">
                                  <button
                                    className="preview-button"
                                    onClick={() =>
                                      handleImagePreview(tempDataItem.cover)
                                    }
                                  >
                                    预览
                                  </button>
                                  <button
                                    className="use-button"
                                    onClick={() =>
                                      createFrameWithTemplate(
                                        template.tempType,
                                        template.tempTypeName,
                                        tempDataItem,
                                      )
                                    }
                                  >
                                    使用
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {imagePreviewUrl && (
        <div className="image-preview-overlay" onClick={closeImagePreview}>
          <div
            className="image-preview-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="image-preview-close" onClick={closeImagePreview}>
              ×
            </button>
            <img
              src={imagePreviewUrl}
              alt="Preview"
              className="image-preview-content"
            />
          </div>
        </div>
      )}
    </>
  );
};
