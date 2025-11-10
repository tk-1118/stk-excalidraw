import { useRef, useCallback } from 'react';
import { getFrameChildren, getElementsOverlappingFrame, getDefaultFrameName } from '@excalidraw/element/frame';
import { isFrameLikeElement } from '@excalidraw/element';
import { serializeAsJSON } from '../data/json';
import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement
} from '@excalidraw/element/types';
import type { FrameData } from '../components/BusinessServiceProtoNav/BusinessServiceProtoNav';

interface CachedFrameData {
  data: FrameData;
  timestamp: number;
}

/**
 * Frame数据缓存管理Hook
 * 优化frame数据生成性能，避免重复计算
 */
export const useFrameDataCache = (
  elements: ExcalidrawElement[],
  appState: any,
  files: any,
  isDragging: () => boolean,
  cacheTTL = 1000
) => {
  const frameDataCache = useRef<Map<string, CachedFrameData>>(new Map());

  // 清理过期缓存
  const cleanExpiredCache = useCallback(() => {
    const now = Date.now();
    const cutoffTime = now - cacheTTL;

    for (const [key, cached] of frameDataCache.current.entries()) {
      if (cached.timestamp < cutoffTime) {
        frameDataCache.current.delete(key);
      }
    }
  }, [cacheTTL]);

  // 生成单个Frame的数据
  const generateFrameData = useCallback((
    frame: ExcalidrawFrameLikeElement,
    forceRefresh = false
  ): FrameData => {
    const now = Date.now();
    const cacheKey = `${frame.id}-${frame.versionNonce}`;

    // 检查缓存
    if (!forceRefresh) {
      const cached = frameDataCache.current.get(cacheKey);
      if (cached && now - cached.timestamp < cacheTTL) {
        return cached.data;
      }
    }

    // 智能的子元素收集策略
    let childrenElements: ExcalidrawElement[] = [];

    // 检查是否需要几何检测
    const needsGeometricCheck =
      isDragging() ||
      appState.selectedElementsAreBeingDragged;

    if (!needsGeometricCheck) {
      // 快速路径：只使用frameId关联
      childrenElements = getFrameChildren(elements, frame.id);
    } else {
      // 完整路径：同时使用frameId关联和几何重叠
      const associatedChildren = getFrameChildren(elements, frame.id);
      const overlappingElements = getElementsOverlappingFrame(elements, frame);

      // 合并去重
      const allChildrenMap = new Map<string, ExcalidrawElement>();

      associatedChildren.forEach(element => {
        allChildrenMap.set(element.id, element);
      });

      overlappingElements.forEach(element => {
        if (element.id !== frame.id && !isFrameLikeElement(element)) {
          if (!allChildrenMap.has(element.id)) {
            allChildrenMap.set(element.id, element);
          }
        }
      });

      childrenElements = Array.from(allChildrenMap.values());
    }

    // 构建完整元素列表
    const frameElements = [frame, ...childrenElements];

    // 序列化数据
    const excalidrawData = serializeAsJSON(
      frameElements,
      appState,
      files,
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

    // 定期清理过期缓存
    if (frameDataCache.current.size > 20) {
      cleanExpiredCache();
    }

    return frameData;
  }, [elements, appState, files, isDragging, cacheTTL, cleanExpiredCache]);

  // 清除指定frame的缓存
  const clearFrameCache = useCallback((frameId: string) => {
    for (const [key] of frameDataCache.current.entries()) {
      if (key.startsWith(frameId)) {
        frameDataCache.current.delete(key);
      }
    }
  }, []);

  // 清除所有缓存
  const clearAllCache = useCallback(() => {
    frameDataCache.current.clear();
  }, []);

  return {
    generateFrameData,
    clearFrameCache,
    clearAllCache,
    cacheSize: frameDataCache.current.size,
  };
};
