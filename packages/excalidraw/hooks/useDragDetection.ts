import { useRef, useEffect, useCallback } from 'react';
import { useTimerManager } from './useTimerManager';

/**
 * 拖拽检测Hook
 * 优化拖拽状态管理，避免在拖拽过程中进行昂贵的计算
 */
export const useDragDetection = (dragEndDelay = 1500) => {
  const isDragging = useRef<boolean>(false);
  const { setTimer, clearTimer } = useTimerManager();

  const setDraggingState = useCallback((dragging: boolean) => {
    isDragging.current = dragging;
  }, []);

  const handlePointerMove = useCallback(() => {
    if (!isDragging.current) {
      setDraggingState(true);
    }

    // 清除之前的拖拽结束定时器，重新设置
    setTimer('dragEnd', () => {
      setDraggingState(false);
    }, dragEndDelay);
  }, [setDraggingState, setTimer, dragEndDelay]);

  const handlePointerUp = useCallback(() => {
    // 指针抬起时立即结束拖拽状态
    setDraggingState(false);
    clearTimer('dragEnd');
  }, [setDraggingState, clearTimer]);

  useEffect(() => {
    document.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    document.addEventListener("pointerup", handlePointerUp, {
      passive: true,
    });

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      clearTimer('dragEnd');
    };
  }, [handlePointerMove, handlePointerUp, clearTimer]);

  return {
    isDragging: () => isDragging.current,
    setDraggingState,
  };
};
