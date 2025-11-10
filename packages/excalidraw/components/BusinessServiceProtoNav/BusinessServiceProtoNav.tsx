import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useReducer,
} from "react";

// 导入优化的自定义hooks
import { useTimerManager } from "../../hooks/useTimerManager";
import { useDragDetection } from "../../hooks/useDragDetection";
import { useOptimizedFrames } from "../../hooks/useOptimizedFrames";
import { useFrameDataCache } from "../../hooks/useFrameDataCache";
import { useOptimizedEventHandlers } from "../../hooks/useOptimizedEventHandlers";
import {
  businessServiceReducer,
  initialState,
  type BusinessServiceAction
} from "./businessServiceReducer";

import { exportToCanvas } from "@excalidraw/utils/export";
import { isFrameLikeElement } from "@excalidraw/element";
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

// 定义组件暴露的方法接口
export interface BusinessServiceProtoNavRef {
  /**
   * 手动导出当前所有frames数据的方法
   * 可以被外部应用调用来保存画布数据
   * @returns 导出的frames数据，如果画布为空则返回null
   */
  manualExportFramesData: () => FramesExportData | null;
}

export const BusinessServiceProtoNav = forwardRef<BusinessServiceProtoNavRef>(
  (props, ref) => {
    const app = useApp();
    const appProps = useAppProps();
    const setAppState = useExcalidrawSetAppState();

    // 🚀 优化：使用useReducer统一状态管理
    const [state, dispatch] = useReducer(businessServiceReducer, initialState);

    // 🚀 优化：使用自定义hooks
    const { setTimer, clearTimer, clearAllTimers } = useTimerManager();
    const { isDragging } = useDragDetection();
    const { createClickOutsideHandler, createDebouncedCallback } = useOptimizedEventHandlers();

    // 定期检查元素变化
    useEffect(() => {
      const checkForUpdates = () => {
        const currentElements = app.scene.getNonDeletedElements();
        const currentSnapshot = currentElements
          .map((el) => `${el.id}-${el.versionNonce}`)
          .join("|");

        if (currentSnapshot !== lastElementsRef.current) {
          lastElementsRef.current = currentSnapshot;
          if (process.env.NODE_ENV === "development") {
            console.log(
              "🔍 Elements changed, triggering update:",
              currentElements.length,
              "elements",
            );
          }
          triggerUpdate();
        }
      };

      // 立即检查一次
      checkForUpdates();

      // 每1500ms检查一次变化
      const interval = setInterval(checkForUpdates, 1500);

      return () => {
        clearInterval(interval);
      };
    }, [app.scene, triggerUpdate]);

    // 🚀 优化：使用优化的frames计算hook
    const elements = app.scene.getNonDeletedElements();
    const { frames, generateFramesSnapshot, hasFramesChanged } = useOptimizedFrames(elements);

    // 🚀 优化：使用frame数据缓存hook
    const { generateFrameData } = useFrameDataCache(
      elements,
      app.state,
      app.files,
      isDragging
    );

    // 🚀 优化：状态已通过useReducer统一管理
    const {
      selectedFrame,
      activeMenuFrameId,
      showTemplateModal,
      imagePreviewUrl,
      selectedTemplateType,
      showRestoreConfirm,
      titleClickCount,
    } = state;

    // 🚀 优化：使用统一的定时器管理，移除了debounceTimer相关代码
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [, setPrevFramesData] = useState<FramesExportData | null>(null);

    // 存储上一次的frames快照，用于快速比较
    const prevFramesSnapshot = useRef<string>("");
    // 标记是否已完成初始化聚焦，避免多次触发
    const hasInitialFocusRef = useRef<boolean>(false);

    // 🚀 优化：使用优化的事件处理器
    useEffect(() => {
      const handleClickOutside = createClickOutsideHandler(
        activeMenuFrameId,
        menuRef,
        () => dispatch({ type: 'SET_ACTIVE_MENU_FRAME_ID', payload: null })
      );

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [activeMenuFrameId, createClickOutsideHandler, dispatch]);

    /**
     * 生成快速的frames快照，用于初步变化检测
     * 性能优化：使用节流和更轻量的比较策略
     */
    const generateFramesSnapshot = useMemo(() => {
      // 性能优化：只比较frame本身的关键属性，避免昂贵的子元素计算
      return frames
        .map((frame) => {
          // 只使用frame自身的属性，避免遍历所有elements
          return `${frame.id}:${frame.name || ""}:${frame.x}:${frame.y}:${
            frame.width
          }:${frame.height}:${frame.versionNonce}`;
        })
        .join("|");
    }, [frames]); // 移除elements依赖，减少重新计算频率

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

    // 性能优化：缓存frame数据生成结果
    const frameDataCache = useRef<
      Map<string, { data: FrameData; timestamp: number }>
    >(new Map());
    const FRAME_DATA_CACHE_TTL = 1000; // 1秒缓存有效期

    /**
     * 生成单个Frame的Excalidraw数据（性能优化版本）
     * 优化策略：
     * 1. 添加缓存机制，避免重复计算
     * 2. 延迟昂贵的JSON序列化操作
     * 3. 只在真正需要时才执行重叠元素计算
     */
    const generateFrameData = useCallback(
      (frame: ExcalidrawFrameLikeElement, forceRefresh = false): FrameData => {
        const now = Date.now();
        const cacheKey = `${frame.id}-${frame.versionNonce}`;

        // 检查缓存
        if (!forceRefresh) {
          const cached = frameDataCache.current.get(cacheKey);
          if (cached && now - cached.timestamp < FRAME_DATA_CACHE_TTL) {
            return cached.data;
          }
        }

        // 🚀 性能优化：智能的子元素收集策略
        // 同时考虑frameId关联和几何重叠，但避免重复计算

        let childrenElements: ExcalidrawElement[] = [];

        // 检查是否在拖拽状态或有未关联的元素需要几何检测
        const needsGeometricCheck =
          isDragging.current || // 拖拽时可能有元素位置变化但frameId未更新
          app.state.selectedElementsAreBeingDragged || // Excalidraw内部拖拽状态
          frame.versionNonce !==
            frameDataCache.current.get(`${frame.id}-${frame.versionNonce}`)
              ?.data.frameElement.versionNonce; // frame发生了变化

        if (!needsGeometricCheck) {
          // 🚀 快速路径：只使用frameId关联（适用于静态状态）
          childrenElements = getFrameChildren(elements, frame.id);
        } else {
          // 🚀 完整路径：同时使用frameId关联和几何重叠（适用于动态状态）
          const associatedChildren = getFrameChildren(elements, frame.id);
          const overlappingElements = getElementsOverlappingFrame(
            elements,
            frame,
          );

          // 合并两个集合，去重
          const allChildrenMap = new Map<string, ExcalidrawElement>();

          // 先添加frameId关联的元素
          associatedChildren.forEach((element) => {
            allChildrenMap.set(element.id, element);
          });

          // 再添加几何重叠的元素
          overlappingElements.forEach((element) => {
            if (element.id !== frame.id && !isFrameLikeElement(element)) {
              if (!allChildrenMap.has(element.id)) {
                allChildrenMap.set(element.id, element);
              }
            }
          });

          childrenElements = Array.from(allChildrenMap.values());
        }

        // 构建包含frame和其子元素的完整元素列表
        const frameElements = [frame, ...childrenElements];

        // 延迟JSON序列化 - 只在真正需要导出时才执行
        const excalidrawData = serializeAsJSON(
          frameElements,
          app.state,
          app.files,
          "local",
        );

        const frameData: FrameData = {
          frameId: frame.id,
          frameName: frame.name || getDefaultFrameName(frame),
          frameElement: frame,
          childrenElements,
          excalidrawData,
        };

        // 缓存结果
        frameDataCache.current.set(cacheKey, {
          data: frameData,
          timestamp: now,
        });

        // 清理过期缓存
        if (frameDataCache.current.size > 20) {
          const cutoffTime = now - FRAME_DATA_CACHE_TTL;
          for (const [key, cached] of frameDataCache.current.entries()) {
            if (cached.timestamp < cutoffTime) {
              frameDataCache.current.delete(key);
            }
          }
        }

        return frameData;
      },
      [elements, app.state, app.files],
    );

    /**
     * 生成所有Frames的导出数据
     */
    const generateFramesExportData = useCallback((): FramesExportData => {
      if (process.env.NODE_ENV === "development") {
        console.log(
          "🔍 Generating frames export data for",
          frames.length,
          "frames",
        );
      }
      const framesData: FrameData[] = frames.map((frame) => {
        const frameData = generateFrameData(frame);
        if (process.env.NODE_ENV === "development") {
          console.log(
            "🔍 Generated data for frame:",
            frame.name || frame.id,
            "children:",
            frameData.childrenElements.length,
          );
        }
        return frameData;
      });

      const exportData = {
        frames: framesData,
        timestamp: Date.now(),
        totalFrames: frames.length,
      };

      if (process.env.NODE_ENV === "development") {
        console.log("🔍 Final export data:", exportData.totalFrames, "frames");
      }
      return exportData;
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
     * 修复：移除useCallback，直接使用函数避免依赖问题
     */
    const hasFramesChangedQuick = (currentSnapshot: string): boolean => {
      const hasChanged = currentSnapshot !== prevFramesSnapshot.current;
      if (hasChanged) {
        prevFramesSnapshot.current = currentSnapshot;
      }
      return hasChanged;
    };

    /**
     * 🚀 优化：防抖导出函数 - 使用统一定时器管理
     */
    const debouncedExportFramesData = createDebouncedCallback(
      useCallback((framesData: FramesExportData) => {
        try {
          // exportFramesData(framesData);
          setPrevFramesData(framesData);
        } catch (error) {
          console.error("[BusinessServiceProtoNav] 导出数据时出错:", error);
        }
      }, [setPrevFramesData]),
      300 // 300ms 防抖延迟
    );

    // 性能优化：使用ref存储上次检查时间，实现节流
    const lastCheckTime = useRef<number>(0);
    const THROTTLE_INTERVAL = 2000; // 🚀 增加到2秒节流间隔，大幅减少拖动时的计算

    // 🚀 性能优化：拖拽状态检测，避免拖拽时进行昂贵计算
    const isDragging = useRef<boolean>(false);
    const dragTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      const handlePointerMove = () => {
        if (!isDragging.current) {
          isDragging.current = true;
          // 清除之前的拖拽结束定时器
          if (dragTimeout.current) {
            clearTimeout(dragTimeout.current);
          }
        }

        // 设置拖拽结束检测（1500ms无移动认为拖拽结束）
        dragTimeout.current = setTimeout(() => {
          isDragging.current = false;
        }, 1500);
      };

      const handlePointerUp = () => {
        // 指针抬起时立即结束拖拽状态
        isDragging.current = false;
        if (dragTimeout.current) {
          clearTimeout(dragTimeout.current);
        }
      };

      document.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      });
      document.addEventListener("pointerup", handlePointerUp, {
        passive: true,
      });

      return () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        if (dragTimeout.current) {
          clearTimeout(dragTimeout.current);
        }
      };
    }, []);

    /**
     * 监听frames变化的Effect（极端性能优化版本）
     * 优化策略：
     * 1. 拖拽时完全跳过计算
     * 2. 大幅增加节流间隔
     * 3. 使用更轻量的变化检测
     */
    useEffect(() => {
      const now = Date.now();

      // 🚀 拖拽时完全跳过计算
      if (isDragging.current) {
        return;
      }

      // 节流：如果距离上次检查时间不足THROTTLE_INTERVAL，跳过本次检查
      if (now - lastCheckTime.current < THROTTLE_INTERVAL) {
        return;
      }

      // 防抖定时器，避免频繁触发
      const timeoutId = setTimeout(() => {
        // 再次检查是否在拖拽中
        if (isDragging.current) {
          return;
        }

        lastCheckTime.current = Date.now();

        // 首先进行快速检测
        if (!hasFramesChangedQuick(generateFramesSnapshot)) {
          return; // 没有变化，直接返回
        }

        // 有变化时才生成完整数据（延迟处理）
        const currentFramesData = generateFramesExportData();

        // 使用防抖导出
        debouncedExportFramesData(currentFramesData);
      }, 800); // 🚀 增加到800ms防抖延迟，进一步减少计算频率

      return () => clearTimeout(timeoutId);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generateFramesSnapshot]); // 性能优化：只监听快照变化，避免函数依赖导致的频繁重渲染

    // 开发人员隐藏功能：点击标题六次触发恢复弹框
    const [titleClickCount, setTitleClickCount] = useState(0);
    const [titleClickTimer, setTitleClickTimer] =
      useState<NodeJS.Timeout | null>(null);

    /**
     * 组件卸载时清理所有定时器
     */
    useEffect(() => {
      return () => {
        // 使用统一的清理函数
        clearDebounceTimer();
        // 清理标题点击定时器
        if (titleClickTimer) {
          clearTimeout(titleClickTimer);
        }
      };
    }, [titleClickTimer, clearDebounceTimer]);

    /**
     * 监听依赖变化时清理定时器，防止内存泄漏
     */
    useEffect(() => {
      // 当依赖发生变化时，清理之前的定时器
      return () => {
        clearDebounceTimer();
      };
    }, [generateFramesSnapshot, generateFramesExportData, clearDebounceTimer]);

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

    // 🚀 优化：使用dispatch替代多个setState调用
    const frameClick = useCallback((frame: ExcalidrawFrameLikeElement) => {
      dispatch({ type: 'SET_SELECTED_FRAME', payload: frame });

      // 主动选中frame元素
      setAppState({
        selectedElementIds: { [frame.id]: true },
        selectedGroupIds: {}, // 清除组选择，避免跨frame影响
      });
      app.scrollToContent(frame, { animate: true });
    }, [dispatch, setAppState, app]);

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

    const frameExportPng = async (
      exportingFrame: ExcalidrawFrameLikeElement,
    ) => {
      // 🚀 PNG导出需要完整的视觉内容，必须包含所有几何重叠的元素
      // 不能只依赖frameId，因为用户期望看到frame区域内的所有视觉元素

      // 获取frameId关联的元素
      const associatedChildren = getFrameChildren(elements, exportingFrame.id);

      // 获取几何重叠的元素（PNG导出必须包含这些）
      const overlappingElements = getElementsOverlappingFrame(
        elements,
        exportingFrame,
      );

      // 合并去重，确保PNG包含所有可见内容
      const allElementsMap = new Map<string, ExcalidrawElement>();

      associatedChildren.forEach((element) => {
        allElementsMap.set(element.id, element);
      });

      overlappingElements.forEach((element) => {
        if (element.id !== exportingFrame.id && !isFrameLikeElement(element)) {
          allElementsMap.set(element.id, element);
        }
      });

      const elementsInFrame = Array.from(allElementsMap.values()).filter(
        (element) => !(element.type === "text" && element.containerId),
      );

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
      clearDebounceTimer();
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

      // 🚀 修复：确保新frame被添加到画布中
      // app.scene.replaceAllElements(newElements);
      if (process.env.NODE_ENV === "development") {
        console.log(
          "🔍 New frame added to canvas:",
          newFrame.name,
          "Total elements:",
          newElements.length,
        );
      }

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
      clearDebounceTimer();
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
      const isEmpty = nonDeletedElements.length === 0;
      if (process.env.NODE_ENV === "development") {
        console.log(
          "🔍 Canvas empty check:",
          isEmpty,
          "elements count:",
          nonDeletedElements.length,
        );
      }
      return isEmpty;
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
      clearDebounceTimer();

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
      clearDebounceTimer,
    ]);

    // 使用 useImperativeHandle 暴露方法给父组件
    useImperativeHandle(
      ref,
      () => ({
        manualExportFramesData,
      }),
      [manualExportFramesData],
    );

    /**
     * 从IndexedDB导入画布数据的函数
     */
    const importFromCanvasStorage = useCallback(async () => {
      const businessServiceSN =
        appProps.UIOptions.businessServiceInfo?.businessServiceSN || "default";

      try {
        const canvasData = await canvasStorage.loadCanvasData(
          businessServiceSN,
        );

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

    // 移除了hasLocalCacheData状态，快捷键功能不再依赖缓存数据检查

    // 确认对话框状态管理
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

    // 移除了showRestoreConfirmDialog函数，快捷键直接调用setShowRestoreConfirm(true)

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

    /**
     * 处理标题点击事件
     * 短时间内点击6次触发恢复功能（开发人员专用隐藏功能）
     */
    const handleTitleClick = useCallback(() => {
      const newCount = titleClickCount + 1;

      // 清除之前的定时器
      if (titleClickTimer) {
        clearTimeout(titleClickTimer);
      }

      // 如果达到6次点击，触发恢复功能
      if (newCount >= 6) {
        setTitleClickCount(0);
        setTitleClickTimer(null);

        // 触发恢复确认对话框
        setShowRestoreConfirm(true);

        // eslint-disable-next-line no-console
        console.log(
          "🔧 开发人员隐藏功能触发：从缓存恢复画布数据（标题点击6次）",
        );
        return;
      }

      // 更新点击次数
      setTitleClickCount(newCount);

      // 设置3秒后重置计数器
      const timer = setTimeout(() => {
        setTitleClickCount(0);
        setTitleClickTimer(null);
      }, 3000);

      setTitleClickTimer(timer);

      // 调试日志（仅在开发环境）
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log(`🔍 标题点击次数: ${newCount}/6`);
      }
    }, [titleClickCount, titleClickTimer]);

    // 清理定时器
    useEffect(() => {
      return () => {
        if (titleClickTimer) {
          clearTimeout(titleClickTimer);
        }
      };
    }, [titleClickTimer]);

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
            <h4
              className="business-service-proto-design"
              onClick={handleTitleClick}
              style={{ cursor: "pointer", userSelect: "none" }}
              title="业务服务原型设计"
            >
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
              {/* 🔍 调试按钮：手动刷新frame列表 */}
              {/* {process.env.NODE_ENV === "development" && (
                <div
                  className="export-all-button"
                  onClick={triggerUpdate}
                  title="刷新frame列表（调试用）"
                  style={{ backgroundColor: "#ff6b6b", marginBottom: "8px" }}
                >
                  🔍 刷新列表
                </div>
              )} */}
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
                  保存画布 ({elements.length} 元素, {frames.length} 页面)
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
            <div
              className="template-modal"
              onClick={(e) => e.stopPropagation()}
            >
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
              <button
                className="image-preview-close"
                onClick={closeImagePreview}
              >
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
  },
);

// 设置组件的显示名称，便于调试
BusinessServiceProtoNav.displayName = "BusinessServiceProtoNav";
