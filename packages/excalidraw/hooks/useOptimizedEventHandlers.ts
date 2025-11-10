import { useCallback, useRef, useEffect } from 'react';

/**
 * 优化的事件处理器Hook
 * 减少DOM查询，提高事件处理性能
 */
export const useOptimizedEventHandlers = () => {
  // 缓存DOM查询结果
  const moreIconElementsRef = useRef<NodeList | null>(null);
  const lastQueryTimeRef = useRef<number>(0);
  const QUERY_CACHE_TTL = 1000; // DOM查询缓存1秒

  // 获取more-icon元素（带缓存）
  const getMoreIconElements = useCallback(() => {
    const now = Date.now();

    // 如果缓存未过期且存在，直接返回
    if (
      moreIconElementsRef.current &&
      now - lastQueryTimeRef.current < QUERY_CACHE_TTL
    ) {
      return moreIconElementsRef.current;
    }

    // 重新查询并缓存
    moreIconElementsRef.current = document.querySelectorAll(".more-icon");
    lastQueryTimeRef.current = now;

    return moreIconElementsRef.current;
  }, []);

  // 检查点击是否在more-icon上（优化版本）
  const isClickOnMoreIcon = useCallback((target: EventTarget | null) => {
    if (!target || !(target instanceof Node)) return false;

    const moreIconElements = getMoreIconElements();

    // 使用for循环而不是forEach，可以提前退出
    for (let i = 0; i < moreIconElements.length; i++) {
      const icon = moreIconElements[i];
      if (icon.contains(target)) {
        return true;
      }
    }

    return false;
  }, [getMoreIconElements]);

  // 创建优化的点击外部处理器
  const createClickOutsideHandler = useCallback((
    activeMenuFrameId: string | null,
    menuRef: React.RefObject<HTMLDivElement>,
    onClickOutside: () => void
  ) => {
    return (event: MouseEvent) => {
      if (!activeMenuFrameId) return;

      const target = event.target;

      // 检查是否点击在菜单内部
      if (menuRef.current && menuRef.current.contains(target as Node)) {
        return;
      }

      // 检查是否点击在more-icon上
      if (isClickOnMoreIcon(target)) {
        return;
      }

      // 点击在外部，执行回调
      onClickOutside();
    };
  }, [isClickOnMoreIcon]);

  // 防抖函数工厂
  const createDebouncedCallback = useCallback(<T extends (...args: any[]) => void>(
    callback: T,
    delay: number
  ) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    return useCallback((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
        timeoutRef.current = null;
      }, delay);
    }, [callback, delay]) as T;
  }, []);

  // 节流函数工厂
  const createThrottledCallback = useCallback(<T extends (...args: any[]) => void>(
    callback: T,
    delay: number
  ) => {
    const lastCallTimeRef = useRef<number>(0);

    return useCallback((...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastCallTimeRef.current >= delay) {
        lastCallTimeRef.current = now;
        callback(...args);
      }
    }, [callback, delay]) as T;
  }, []);

  // 清理缓存
  const clearCache = useCallback(() => {
    moreIconElementsRef.current = null;
    lastQueryTimeRef.current = 0;
  }, []);

  // 组件卸载时清理缓存
  useEffect(() => {
    return () => {
      clearCache();
    };
  }, [clearCache]);

  return {
    createClickOutsideHandler,
    createDebouncedCallback,
    createThrottledCallback,
    isClickOnMoreIcon,
    clearCache,
  };
};
