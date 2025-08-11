import { useState, useRef, useEffect, useCallback, useMemo } from "react";

import { exportToCanvas } from "@excalidraw/utils/export";
import { getNonDeletedElements, isFrameLikeElement } from "@excalidraw/element";
import {
  getDefaultFrameName,
  // getElementsOverlappingFrame,
  getFrameChildren,
} from "@excalidraw/element/frame";

import { newFrameElement } from "@excalidraw/element";
import { randomId } from "@excalidraw/common";

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
   * 为模板元素生成新的唯一ID，避免ID冲突
   *
   * 当重复使用同一个模板时，如果不重新生成ID，会导致：
   * 1. 元素ID冲突，可能导致意外的行为
   * 2. 引用关系错乱（如文本容器、箭头绑定等）
   * 3. 选择和编辑功能异常
   *
   * 该函数会：
   * 1. 为所有模板元素生成新的唯一ID
   * 2. 更新所有相关的引用关系（containerId、boundElements、binding等）
   * 3. 确保组关系正确维护
   * 4. 重置版本信息避免缓存冲突
   */
  const regenerateElementIds = useCallback(
    (elements: any[], frameId: string): any[] => {
      // 创建ID映射表，用于更新引用关系
      const idMap = new Map<string, string>();

      // 第一轮：为所有元素生成新ID
      const elementsWithNewIds = elements.map((element) => {
        const newId = randomId();
        idMap.set(element.id, newId);

        return {
          ...element,
          id: newId,
          frameId, // 设置新的frameId
          // 重置版本信息以避免冲突
          versionNonce: Math.floor(Math.random() * 2 ** 31),
          updated: Date.now(),
        };
      });

      // 第二轮：更新所有引用关系
      const elementsWithUpdatedReferences = elementsWithNewIds.map(
        (element) => {
          const updatedElement = { ...element };

          // 更新containerId引用（文本容器关系）
          if (element.containerId && idMap.has(element.containerId)) {
            updatedElement.containerId = idMap.get(element.containerId);
          }

          // 更新boundElements引用（绑定元素关系）
          if (element.boundElements && Array.isArray(element.boundElements)) {
            updatedElement.boundElements = element.boundElements.map(
              (boundElement: any) => {
                if (boundElement.id && idMap.has(boundElement.id)) {
                  return {
                    ...boundElement,
                    id: idMap.get(boundElement.id),
                  };
                }
                return boundElement;
              },
            );
          }

          // 更新箭头的startBinding和endBinding引用
          if (
            element.startBinding &&
            element.startBinding.elementId &&
            idMap.has(element.startBinding.elementId)
          ) {
            updatedElement.startBinding = {
              ...element.startBinding,
              elementId: idMap.get(element.startBinding.elementId),
            };
          }

          if (
            element.endBinding &&
            element.endBinding.elementId &&
            idMap.has(element.endBinding.elementId)
          ) {
            updatedElement.endBinding = {
              ...element.endBinding,
              elementId: idMap.get(element.endBinding.elementId),
            };
          }

          // 更新groupIds（如果有组引用）
          if (element.groupIds && Array.isArray(element.groupIds)) {
            updatedElement.groupIds = element.groupIds.map(
              (groupId: string) => {
                return idMap.has(groupId) ? idMap.get(groupId)! : groupId;
              },
            );
          }

          return updatedElement;
        },
      );

      return elementsWithUpdatedReferences;
    },
    [],
  );

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
    [],
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

    // 计算新frame的初始尺寸
    let frameWidth = 1920;
    let frameHeight = 1080;

    // 如果是模板，先计算模板的实际尺寸
    if (templateType !== "BLANK" && templateData?.elements) {
      let maxX = 0;
      let maxY = 0;
      let minX = Infinity;
      let minY = Infinity;

      templateData.elements.forEach((el: any) => {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
      });

      frameWidth = maxX - minX; // 添加一些边距
      frameHeight = maxY - minY;
    }

    // 计算新frame的位置，确保不与现有frame重叠
    let newX = 0;
    let newY = 0;

    if (frames.length > 0) {
      // 找到所有frame的最右边和最下边位置
      let maxRight = 0;
      let maxBottom = 0;

      frames.forEach((frame) => {
        maxRight = Math.max(maxRight, frame.x + frame.width);
        maxBottom = Math.max(maxBottom, frame.y + frame.height);
      });

      // 尝试在右侧放置新frame
      const rightX = maxRight + 100; // 100px间距
      const rightY = 0;

      // 检查右侧位置是否与现有frame冲突
      const rightConflict = frames.some(
        (frame) =>
          rightX < frame.x + frame.width + 50 &&
          rightX + frameWidth > frame.x - 50 &&
          rightY < frame.y + frame.height + 50 &&
          rightY + frameHeight > frame.y - 50,
      );

      if (!rightConflict) {
        newX = rightX;
        newY = rightY;
      } else {
        // 如果右侧有冲突，放在最下方
        newX = 0;
        newY = maxBottom + 100; // 100px间距
      }
    }

    const newFrame = newFrameElement({
      name: `新建${tempTypeName || ""}页面`,
      x: newX,
      y: newY,
      width: frameWidth,
      height: frameHeight,
    }) as ExcalidrawFrameElement;

    let newElements;

    if (templateType !== "BLANK" && templateData?.elements) {
      // 计算模板元素的偏移量
      let minTemplateX = Infinity;
      let minTemplateY = Infinity;

      templateData.elements.forEach((el: any) => {
        minTemplateX = Math.min(minTemplateX, el.x);
        minTemplateY = Math.min(minTemplateY, el.y);
      });

      // 为模板元素生成新的ID，避免冲突
      const elementsWithNewIds = regenerateElementIds(
        templateData.elements,
        newFrame.id,
      );

      // 将模板元素相对于新frame进行定位
      const templateElements = elementsWithNewIds.map((el: any) => {
        return {
          ...el,
          x: el.x - minTemplateX + newX + 50, // 添加50px内边距
          y: el.y - minTemplateY + newY + 50,
        };
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
