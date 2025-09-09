import { useState, useRef, useEffect, useCallback, useMemo } from "react";

import { exportToCanvas } from "@excalidraw/utils/export";
import { getNonDeletedElements, isFrameLikeElement } from "@excalidraw/element";
import {
  getDefaultFrameName,
  getElementsOverlappingFrame,
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
import { useApp, useAppProps, useExcalidrawSetAppState } from "../App";
import { serializeAsJSON } from "../../data/json";
import { restore } from "../../data/restore";
import { canvasStorage } from "../../data/CanvasStorage";

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
  const appProps = useAppProps();
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
  // 标记是否已完成初始化聚焦，避免多次触发
  const hasInitialFocusRef = useRef<boolean>(false);

  // 处理点击菜单外部区域时隐藏菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        activeMenuFrameId &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        // 检查点击的是否是其他frame的more-icon
        const moreIconElements = document.querySelectorAll(".more-icon");
        let clickedOnMoreIcon = false;

        moreIconElements.forEach((icon) => {
          if (icon.contains(event.target as Node)) {
            clickedOnMoreIcon = true;
          }
        });

        // 只有当点击的不是more-icon时才隐藏菜单
        if (!clickedOnMoreIcon) {
          setActiveMenuFrameId(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeMenuFrameId]);

  /**
   * 生成快速的frames快照，用于初步变化检测
   * 修复bug：同样需要考虑所有在frame范围内的元素，不仅仅是已关联的元素
   */
  const generateFramesSnapshot = useMemo(() => {
    return frames
      .map((frame) => {
        // 获取已关联的子元素
        const associatedChildren = getFrameChildren(elements, frame.id);
        // 获取所有重叠的元素
        const overlappingElements = getElementsOverlappingFrame(
          elements,
          frame,
        );

        // 合并并去重，计算实际的子元素数量
        const allChildrenSet = new Set<string>();
        associatedChildren.forEach((el) => allChildrenSet.add(el.id));
        overlappingElements.forEach((el) => {
          if (el.id !== frame.id && !isFrameLikeElement(el)) {
            allChildrenSet.add(el.id);
          }
        });

        const actualChildrenCount = allChildrenSet.size;

        return `${frame.id}:${frame.name || ""}:${frame.x}:${frame.y}:${
          frame.width
        }:${frame.height}:${actualChildrenCount}:${frame.versionNonce}`;
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
            // 为groupIds生成新的ID，确保不同frame中的组不冲突
            updatedElement.groupIds = element.groupIds.map(
              (groupId: string) => {
                if (!idMap.has(groupId)) {
                  // 如果组ID不在映射中，创建一个新的组ID
                  const newGroupId = randomId();
                  idMap.set(groupId, newGroupId);
                }
                return idMap.get(groupId)!;
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
   * 修复bug：不仅收集已关联的子元素(frameId匹配)，还收集所有在frame几何范围内的元素
   */
  const generateFrameData = useCallback(
    (frame: ExcalidrawFrameLikeElement): FrameData => {
      // 获取frame内已正确关联的子元素（frameId匹配）
      const associatedChildren = getFrameChildren(elements, frame.id);

      // 获取所有与frame重叠/包含在frame内的元素（包括未正确关联frameId的元素）
      const overlappingElements = getElementsOverlappingFrame(elements, frame);

      // 合并两个集合，去重，确保收集到所有相关元素
      const allChildrenMap = new Map<string, ExcalidrawElement>();

      // 添加已关联的子元素
      associatedChildren.forEach((element) => {
        allChildrenMap.set(element.id, element);
      });

      // 添加重叠的元素（排除frame自身和其他frame元素）
      overlappingElements.forEach((element) => {
        if (element.id !== frame.id && !isFrameLikeElement(element)) {
          allChildrenMap.set(element.id, element);
        }
      });

      // 转换为数组
      const childrenElements = Array.from(allChildrenMap.values());

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
      selectedGroupIds: {}, // 清除组选择，避免跨frame影响
    });
    app.scrollToContent(frame, { animate: true });
  };

  // 默认将第一个 frame 聚焦到画布中心（仅初始化一次）
  useEffect(() => {
    if (hasInitialFocusRef.current || selectedFrame) {
      return;
    }
    if (frames.length > 0) {
      const firstFrame = frames[0];
      setSelectedFrame(firstFrame);
      setActiveMenuFrameId(null);
      setAppState({
        selectedElementIds: { [firstFrame.id]: true },
      });
      app.scrollToContent(firstFrame, { animate: true });
      hasInitialFocusRef.current = true;
    }
  }, [frames, selectedFrame, setAppState, app]);

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
          x: el.x - minTemplateX + newX,
          y: el.y - minTemplateY + newY,
          // 注意：不要重新生成ID，因为regenerateElementIds已经处理了ID和引用关系
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

    // app.scene.replaceAllElements(newElements);
    app.onHemaButtonClick("addNewFrame", {
      data: {
        frames: [
          {
            childrenElements: templateData?.elements || [],
            excalidrawData: serializeAsJSON(
              newElements,
              app.state,
              app.files,
              "local",
            ),
            newElements,
            frameElement: newFrame,
            frameName: newFrame.name,
            frameId: newFrame.id,
          },
        ],
      },
    });
    setShowTemplateModal(false);
    setSelectedFrame(newFrame);
    // 主动选中frame元素，清除组选择
    setAppState({
      selectedElementIds: { [newFrame.id]: true },
      selectedGroupIds: {}, // 确保不会选择到其他frame中的组
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
   * 检查画布是否为空（没有任何非删除的元素或frame元素）
   */
  const isCanvasEmpty = useMemo(() => {
    // 获取所有非删除的元素，包括frame元素
    const nonDeletedElements = elements.filter((el) => !el.isDeleted);
    return nonDeletedElements.length === 0;
  }, [elements]);

  /**
   * 手动导出当前所有frames数据的函数
   * 可以被外部调用或在特定事件时触发（立即执行，不使用防抖）
   */
  const manualExportFramesData = useCallback(() => {
    // 如果画布为空（没有任何元素包括frame），不执行保存操作
    if (isCanvasEmpty) {
      return null;
    }

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
  }, [
    generateFramesExportData,
    exportFramesData,
    generateFramesSnapshot,
    isCanvasEmpty,
  ]);

  /**
   * 从IndexedDB导入画布数据的函数
   */
  const importFromCanvasStorage = useCallback(async () => {
    const businessServiceSN =
      appProps.UIOptions.businessServiceInfo?.businessServiceSN || "default";

    try {
      const canvasData = await canvasStorage.loadCanvasData(businessServiceSN);

      if (canvasData) {
        return {
          elements: canvasData.elements,
          appState: canvasData.appState,
        };
      }

      return { elements: [], appState: null };
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error(
        `[${businessServiceSN}] 从IndexedDB导入画布数据失败:`,
        error,
      );
      return { elements: [], appState: null };
    }
  }, [appProps.UIOptions.businessServiceInfo?.businessServiceSN]);

  /**
   * 检查IndexedDB中是否有缓存数据
   * 为了更好的用户体验，按钮始终显示，在点击时再检查数据
   */
  const [hasLocalCacheData, setHasLocalCacheData] = useState(true);

  // 确认对话框状态管理
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  /**
   * 显示恢复确认对话框
   */
  const showRestoreConfirmDialog = useCallback(() => {
    // 如果按钮被禁用，直接返回
    if (!hasLocalCacheData) {
      alert("当前没有可用的缓存数据");
      return;
    }
    setShowRestoreConfirm(true);
  }, [hasLocalCacheData]);

  /**
   * 从IndexedDB缓存恢复画布数据的函数
   * 提供手动恢复功能，避免意外丢失数据
   */
  const executeRestoreFromCache = useCallback(async () => {
    const businessServiceSN =
      appProps.UIOptions.businessServiceInfo?.businessServiceSN || "default";

    setShowRestoreConfirm(false);

    try {
      // 从IndexedDB获取缓存数据
      const localData = await importFromCanvasStorage();

      if (!localData.elements.length && !localData.appState) {
        // eslint-disable-next-line no-console
        console.warn(`[${businessServiceSN}] 缓存中没有找到有效数据`);
        alert("缓存中没有找到有效的画布数据");
        return;
      }

      // 使用restore函数恢复数据
      const restoredData = restore(
        { elements: localData.elements, appState: localData.appState },
        null,
        null,
        { repairBindings: true, refreshDimensions: false },
      );

      // 更新画布
      app.scene.replaceAllElements(restoredData.elements);

      // 如果有appState，也更新应用状态
      if (restoredData.appState) {
        setAppState(restoredData.appState);
      }

      // eslint-disable-next-line no-console
      console.log(`[${businessServiceSN}] 成功从IndexedDB缓存恢复画布数据:`, {
        elementsCount: restoredData.elements.length,
        hasAppState: !!restoredData.appState,
      });

      // 显示成功提示
      // alert(
      //   `✅ 成功恢复画布数据！\n恢复了 ${restoredData.elements.length} 个元素`,
      // );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[${businessServiceSN}] 从IndexedDB缓存恢复失败:`, error);
      alert("恢复缓存数据失败，请稍后重试");
    }
  }, [
    app,
    setAppState,
    importFromCanvasStorage,
    appProps.UIOptions.businessServiceInfo?.businessServiceSN,
  ]);

  // 异步检查缓存数据（用于更新按钮状态，但不影响显示）
  useEffect(() => {
    const checkCacheData = async () => {
      const businessServiceSN =
        appProps.UIOptions.businessServiceInfo?.businessServiceSN || "default";
      try {
        const hasData = await canvasStorage.hasCanvasData(businessServiceSN);
        setHasLocalCacheData(hasData);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`[${businessServiceSN}] 检查缓存数据失败:`, error);
        setHasLocalCacheData(false);
      }
    };

    checkCacheData();
  }, [appProps.UIOptions.businessServiceInfo?.businessServiceSN, app]);

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
          <h4 className="business-service-proto-design">
            {appProps.UIOptions.businessServiceInfo?.designTitle ||
              "业务服务原型设计"}
          </h4>
          <h2 className="business-service-proto-name">
            {appProps.UIOptions.businessServiceInfo?.serviceName ||
              "业务服务名称"}
          </h2>
        </div>
        <div className="business-service-proto-nav-body">
          <div className="business-service-proto-nav-body-frames">
            {(appProps.UIOptions.visibility?.customButtons === true ||
              (typeof appProps.UIOptions.visibility?.customButtons ===
                "object" &&
                appProps.UIOptions.visibility?.customButtons?.saveCanvas !==
                  false)) && (
              <div
                className={`export-all-button ${
                  isCanvasEmpty ? "disabled" : ""
                }`}
                onClick={isCanvasEmpty ? undefined : manualExportFramesData}
                title={isCanvasEmpty ? "画布为空，无法保存" : "保存画布"}
              >
                保存画布
              </div>
            )}
            {(appProps.UIOptions.visibility?.customButtons === true ||
              (typeof appProps.UIOptions.visibility?.customButtons ===
                "object" &&
                appProps.UIOptions.visibility?.customButtons?.restoreCache !==
                  false)) && (
              <div
                className={`restore-cache-button ${
                  !hasLocalCacheData ? "disabled" : ""
                }`}
                onClick={showRestoreConfirmDialog}
                title="从本地缓存恢复画布数据（用于意外关闭后的数据找回）"
              >
                📥 从缓存恢复
              </div>
            )}
            {(appProps.UIOptions.visibility?.customButtons === true ||
              (typeof appProps.UIOptions.visibility?.customButtons ===
                "object" &&
                appProps.UIOptions.visibility?.customButtons?.addPage !==
                  false)) && (
              <div className="add-page-button" onClick={addNewFrame}>
                + 添加页面
              </div>
            )}
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
                  {(appProps.UIOptions.visibility?.customButtons === true ||
                    (typeof appProps.UIOptions.visibility?.customButtons ===
                      "object" &&
                      appProps.UIOptions.visibility?.customButtons
                        ?.frameMenu !== false)) && (
                    <div
                      className="more-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFrame(frame);
                        // 总是切换当前frame的菜单状态
                        setActiveMenuFrameId(
                          activeMenuFrameId === frame.id ? null : frame.id,
                        );
                      }}
                    >
                      {moreIcon}
                    </div>
                  )}
                  {activeMenuFrameId === frame.id && (
                    <div className="frame-more-menu" ref={menuRef}>
                      <div
                        className="frame-more-menu-item"
                        onClick={() => {
                          frameExportPng(frame);
                          // 点击菜单项后自动隐藏菜单
                          setActiveMenuFrameId(null);
                        }}
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
                          // 点击菜单项后自动隐藏菜单
                          setActiveMenuFrameId(null);
                        }}
                      >
                        导出页面数据
                      </div>
                      <div
                        className="frame-more-menu-item delete"
                        onClick={() => {
                          deleteFrame(frame);
                          // 点击菜单项后自动隐藏菜单
                          setActiveMenuFrameId(null);
                        }}
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

      {/* 恢复画布数据确认对话框 */}
      {showRestoreConfirm && (
        <div className="restore-confirm-overlay">
          <div className="restore-confirm-dialog">
            <div className="restore-confirm-header">
              <h3>恢复画布数据</h3>
            </div>
            <div className="restore-confirm-content">
              <p>确定要从缓存中恢复画布数据吗？</p>
              <div className="restore-confirm-warning">
                <span className="warning-icon">⚠️</span>
                <span>注意：这将会替换当前画布上的所有内容！</span>
              </div>
              {/* <p className="restore-confirm-tip">
                建议在恢复前先保存当前画布数据。
              </p> */}
            </div>
            <div className="restore-confirm-actions">
              <button
                className="restore-confirm-button cancel"
                onClick={() => setShowRestoreConfirm(false)}
              >
                取消
              </button>
              <button
                className="restore-confirm-button confirm"
                onClick={executeRestoreFromCache}
              >
                确认恢复
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
