import { useMemo, useRef, useCallback } from "react";

import { isFrameLikeElement } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";

/**
 * 优化的Frames计算Hook
 * 减少不必要的重新计算，提高性能
 */
export const useOptimizedFrames = (elements: ExcalidrawElement[]) => {
  // 缓存上一次的元素快照，用于快速比较
  const lastElementsSnapshotRef = useRef<string>("");
  const cachedFramesRef = useRef<ExcalidrawFrameLikeElement[]>([]);

  // 生成轻量级的元素快照，只包含frame相关的信息
  const generateElementsSnapshot = useCallback(
    (elements: ExcalidrawElement[]) => {
      return elements
        .filter((el) => isFrameLikeElement(el) && !el.isDeleted)
        .map((el) => `${el.id}:${el.versionNonce}:${el.isDeleted}`)
        .sort() // 排序确保一致性
        .join("|");
    },
    [],
  );

  // 计算frames的核心逻辑
  const computeFrames = useCallback((elements: ExcalidrawElement[]) => {
    const frameElements = elements
      .filter(
        (el): el is ExcalidrawFrameLikeElement =>
          isFrameLikeElement(el) && !el.isDeleted,
      )
      .reduce((unique, frame) => {
        // 去重：防止重复的frame
        if (!unique.find((f) => f.id === frame.id)) {
          unique.push(frame);
        }
        return unique;
      }, [] as ExcalidrawFrameLikeElement[]);

    // 按y坐标排序
    frameElements.sort((a, b) => a.y - b.y);

    return frameElements;
  }, []);

  // 使用优化的memoization策略
  const frames = useMemo(() => {
    const currentSnapshot = generateElementsSnapshot(elements);

    // 如果快照没有变化，返回缓存的结果
    if (
      currentSnapshot === lastElementsSnapshotRef.current &&
      cachedFramesRef.current.length > 0
    ) {
      return cachedFramesRef.current;
    }

    // 快照发生变化，重新计算
    const newFrames = computeFrames(elements);

    // 更新缓存
    lastElementsSnapshotRef.current = currentSnapshot;
    cachedFramesRef.current = newFrames;

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log(
        "🔍 Frames recomputed:",
        newFrames.length,
        "frames",
        newFrames.map((f) => f.name || f.id),
      );
    }

    return newFrames;
  }, [elements, generateElementsSnapshot, computeFrames]);

  // 生成frames快照，用于外部变化检测
  const generateFramesSnapshot = useCallback(() => {
    return frames
      .map(
        (frame) =>
          `${frame.id}:${frame.name || ""}:${frame.x}:${frame.y}:${
            frame.width
          }:${frame.height}:${frame.versionNonce}`,
      )
      .join("|");
  }, [frames]);

  // 检查frames是否发生变化
  const hasFramesChanged = useCallback(
    (previousSnapshot: string) => {
      const currentSnapshot = generateFramesSnapshot();
      return currentSnapshot !== previousSnapshot;
    },
    [generateFramesSnapshot],
  );

  return {
    frames,
    generateFramesSnapshot,
    hasFramesChanged,
  };
};
