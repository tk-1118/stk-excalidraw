import { useRef, useCallback, useEffect } from 'react';

/**
 * 统一的定时器管理Hook
 * 解决组件中多个定时器管理混乱和潜在内存泄漏问题
 */
export const useTimerManager = () => {
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 清除指定定时器
  const clearTimer = useCallback((key: string) => {
    const timerId = timersRef.current.get(key);
    if (timerId) {
      clearTimeout(timerId);
      clearInterval(timerId);
      timersRef.current.delete(key);
    }
  }, []);

  // 设置定时器
  const setTimer = useCallback((key: string, callback: () => void, delay: number) => {
    // 清除已存在的同名定时器
    clearTimer(key);

    const timerId = setTimeout(() => {
      callback();
      // 执行完成后自动清除
      timersRef.current.delete(key);
    }, delay);

    timersRef.current.set(key, timerId);
    return timerId;
  }, [clearTimer]);

  // 设置间隔器
  const setIntervalTimer = useCallback((key: string, callback: () => void, delay: number): NodeJS.Timeout => {
    // 清除已存在的同名定时器
    clearTimer(key);

    const intervalId: NodeJS.Timeout = setInterval(callback, delay);
    timersRef.current.set(key, intervalId);
    return intervalId;
  }, [clearTimer]);

  // 清除所有定时器
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((timerId) => {
      clearTimeout(timerId);
      clearInterval(timerId);
    });
    timersRef.current.clear();
  }, []);

  // 检查定时器是否存在
  const hasTimer = useCallback((key: string) => {
    return timersRef.current.has(key);
  }, []);

  // 组件卸载时自动清理所有定时器
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  return {
    setTimer,
    setInterval: setIntervalTimer,
    clearTimer,
    clearAllTimers,
    hasTimer,
  };
};
