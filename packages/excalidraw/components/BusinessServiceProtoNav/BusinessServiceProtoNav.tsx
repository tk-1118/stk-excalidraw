import { useState, useRef, useEffect, useCallback, useMemo } from "react";

import { exportToCanvas } from "@excalidraw/utils/export";
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
  ExcalidrawElement,
} from "@excalidraw/element/types";

import { frameToolIcon, moreIcon } from "../icons";
import { useApp, useExcalidrawSetAppState } from "../App";
import { serializeAsJSON } from "../../data/json";

import "./BusinessServiceProtoNav.scss";
import excalidrawTemplate from "./excalidraw-template.json";

// 定义单个Frame数据结构
export interface FrameData {
  frameId: string;
  frameName: string;
  frameElement: ExcalidrawFrameLikeElement;
  childrenElements: ExcalidrawElement[];
  excalidrawData: string; // 序列化的JSON数据
}

// 定义导出的数据结构
export interface FramesExportData {
  frames: FrameData[];
  timestamp: number;
  totalFrames: number;
}

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

  const [activeMenuFrameId, setActiveMenuFrameId] = useState<string | null>(
    null,
  );
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [selectedTemplateType, setSelectedTemplateType] =
    useState<string>("BLANK");
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 存储上一次的frames状态，用于检测变化（在防抖函数中使用）
  const [, setPrevFramesData] = useState<FramesExportData | null>(null);

  // 防抖定时器引用
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // 存储上一次的frames快照，用于快速比较
  const prevFramesSnapshot = useRef<string>("");

  /**
   * 生成快速的frames快照，用于初步变化检测
   */
  const generateFramesSnapshot = useMemo(() => {
    return frames
      .map((frame) => {
        const children = getFrameChildren(elements, frame.id);
        return `${frame.id}:${frame.name || ""}:${frame.x}:${frame.y}:${
          frame.width
        }:${frame.height}:${children.length}:${frame.versionNonce}`;
      })
      .join("|");
  }, [frames, elements]);

  /**
   * 生成单个Frame的Excalidraw数据
   */
  const generateFrameData = useCallback(
    (frame: ExcalidrawFrameLikeElement): FrameData => {
      // 获取frame内的所有子元素
      const childrenElements = getFrameChildren(elements, frame.id);

      // 构建包含frame和其子元素的完整元素列表
      const frameElements = [frame, ...childrenElements];

      // 生成Excalidraw格式的JSON数据
      const excalidrawData = serializeAsJSON(
        frameElements,
        app.state,
        app.files,
        "local",
      );

      return {
        frameId: frame.id,
        frameName: frame.name || getDefaultFrameName(frame),
        frameElement: frame,
        childrenElements,
        excalidrawData,
      };
    },
    [elements, app.state, app.files],
  );

  /**
   * 生成所有Frames的导出数据
   */
  const generateFramesExportData = useCallback((): FramesExportData => {
    const framesData: FrameData[] = frames.map((frame) =>
      generateFrameData(frame),
    );

    return {
      frames: framesData,
      timestamp: Date.now(),
      totalFrames: frames.length,
    };
  }, [frames, generateFrameData]);

  /**
   * 触发数据导出事件，类似onHemaButtonClick的机制
   */
  const exportFramesData = useCallback(
    (framesData: FramesExportData) => {
      // 通过onHemaButtonClick机制导出数据
      app.onHemaButtonClick("framesDataExport", {
        type: "FRAMES_DATA_CHANGED",
        data: framesData,
        timestamp: framesData.timestamp,
      });

      // eslint-disable-next-line no-console
      console.log("Frames data exported:", framesData);
    },
    [app],
  );

  /**
   * 快速检测frames是否发生变化（使用快照比较）
   */
  const hasFramesChangedQuick = useCallback(
    (currentSnapshot: string): boolean => {
      const hasChanged = currentSnapshot !== prevFramesSnapshot.current;
      if (hasChanged) {
        prevFramesSnapshot.current = currentSnapshot;
      }
      return hasChanged;
    },
    [],
  );

  /**
   * 防抖导出函数
   */
  const debouncedExportFramesData = useCallback(
    (framesData: FramesExportData) => {
      // 清除之前的定时器
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // 设置新的定时器
      debounceTimer.current = setTimeout(() => {
        // exportFramesData(framesData);
        setPrevFramesData(framesData);
      }, 300); // 300ms 防抖延迟
    },
    [exportFramesData],
  );

  /**
   * 监听frames变化的Effect（优化版本）
   */
  useEffect(() => {
    // 首先进行快速检测
    if (!hasFramesChangedQuick(generateFramesSnapshot)) {
      return; // 没有变化，直接返回
    }

    // 有变化时才生成完整数据（延迟处理）
    const currentFramesData = generateFramesExportData();

    // 使用防抖导出
    debouncedExportFramesData(currentFramesData);
  }, [
    generateFramesSnapshot,
    hasFramesChangedQuick,
    generateFramesExportData,
    debouncedExportFramesData,
  ]);

  /**
   * 组件卸载时清理定时器
   */
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

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

    // 手动触发一次数据导出（删除操作使用较短的防抖延迟）
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      const updatedFramesData = generateFramesExportData();
      // exportFramesData(updatedFramesData);
      setPrevFramesData(updatedFramesData);
    }, 150); // 删除操作使用较短延迟
  };

  const addNewFrame = () => {
    setShowTemplateModal(true);
  };

  const createFrameWithTemplate = (
    templateType: string,
    tempTypeName?: string,
    templateData?: any,
  ) => {
    // eslint-disable-next-line no-console
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
    // 主动选中frame元素
    setAppState({
      selectedElementIds: { [newFrame.id]: true },
    });
    app.scrollToContent(newFrame, {
      fitToContent: true,
      animate: true,
      viewportZoomFactor: 0.4, // 缩放到画布的80%，留一些边距
    });

    // 手动触发一次数据导出（新建frame使用较短延迟）
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      const updatedFramesData = generateFramesExportData();
      // exportFramesData(updatedFramesData);
      setPrevFramesData(updatedFramesData);
    }, 150); // 新建操作使用较短延迟
  };

  /**
   * 手动导出当前所有frames数据的函数
   * 可以被外部调用或在特定事件时触发（立即执行，不使用防抖）
   */
  const manualExportFramesData = useCallback(() => {
    // 清除防抖定时器，立即执行
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const currentFramesData = generateFramesExportData();
    exportFramesData(currentFramesData);
    setPrevFramesData(currentFramesData);

    // 更新快照以避免重复触发
    prevFramesSnapshot.current = generateFramesSnapshot;

    return currentFramesData;
  }, [generateFramesExportData, exportFramesData, generateFramesSnapshot]);

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
            <div className="export-all-button" onClick={manualExportFramesData}>
              保存画布
            </div>
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
                        className="frame-more-menu-item"
                        onClick={() => {
                          const frameData = generateFrameData(frame);
                          app.onHemaButtonClick("singleFrameExport", {
                            type: "SINGLE_FRAME_EXPORT",
                            frameData,
                            timestamp: Date.now(),
                          });
                          // eslint-disable-next-line no-console
                          console.log("Single frame exported:", frameData);
                        }}
                      >
                        导出页面数据
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
