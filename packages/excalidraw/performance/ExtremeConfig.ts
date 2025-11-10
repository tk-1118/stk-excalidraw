/**
 * 极端性能优化配置
 * 针对176000+元素场景的专门配置
 */

export interface ExtremePerformanceConfig {
  // 场景分类阈值
  LARGE_SCENE: number;
  EXTREME_SCENE: number;
  CRITICAL_SCENE: number;

  // 渲染限制
  MAX_VISIBLE_ELEMENTS: {
    NORMAL: number;
    LARGE: number;
    EXTREME: number;
    CRITICAL: number;
  };

  // 帧率目标
  TARGET_FPS: {
    NORMAL: number;
    LARGE: number;
    EXTREME: number;
    CRITICAL: number;
  };

  // 视口缓冲区
  VIEWPORT_BUFFER: {
    NORMAL: number;
    LARGE: number;
    EXTREME: number;
    CRITICAL: number;
  };

  // LOD设置
  LOD_THRESHOLDS: {
    MIN_ELEMENT_SIZE: number;
    SKIP_TEXT_ZOOM: number;
    SKIP_FREEDRAW_ZOOM: number;
    SKIP_COMPLEX_SHAPES_ZOOM: number;
  };

  // 缓存设置
  CACHE: {
    VIEWPORT_TTL: number;
    ELEMENT_TTL: number;
    MAX_CACHE_SIZE: number;
  };

  // 节流设置
  THROTTLE: {
    RENDER_INTERVAL: number;
    DRAG_INTERVAL: number;
    ZOOM_INTERVAL: number;
  };
}

// 针对176000+元素的激进配置
export const EXTREME_176K_CONFIG: ExtremePerformanceConfig = {
  // 场景分类 - 176K属于CRITICAL级别
  LARGE_SCENE: 10000,
  EXTREME_SCENE: 50000,
  CRITICAL_SCENE: 100000,

  // 渲染限制 - 176K场景下最多渲染1000个元素
  MAX_VISIBLE_ELEMENTS: {
    NORMAL: -1, // 无限制
    LARGE: 5000,
    EXTREME: 2000,
    CRITICAL: 1000, // 176K场景使用这个
  },

  // 帧率目标 - 176K场景目标20fps
  TARGET_FPS: {
    NORMAL: 60,
    LARGE: 45,
    EXTREME: 30,
    CRITICAL: 20, // 176K场景使用这个
  },

  // 视口缓冲区 - 176K场景使用最小缓冲区
  VIEWPORT_BUFFER: {
    NORMAL: 0.5,
    LARGE: 0.3,
    EXTREME: 0.2,
    CRITICAL: 0.1, // 176K场景使用这个
  },

  // LOD设置 - 176K场景下激进的细节层次控制
  LOD_THRESHOLDS: {
    MIN_ELEMENT_SIZE: 5, // 小于5px的元素不渲染
    SKIP_TEXT_ZOOM: 0.3, // 缩放小于30%时跳过小文本
    SKIP_FREEDRAW_ZOOM: 0.2, // 缩放小于20%时跳过自由绘制
    SKIP_COMPLEX_SHAPES_ZOOM: 0.15, // 缩放小于15%时跳过复杂形状
  },

  // 缓存设置
  CACHE: {
    VIEWPORT_TTL: 50, // 50ms缓存
    ELEMENT_TTL: 100, // 100ms元素缓存
    MAX_CACHE_SIZE: 500, // 最大缓存500个条目
  },

  // 节流设置 - 176K场景下激进节流
  THROTTLE: {
    RENDER_INTERVAL: 50, // 20fps
    DRAG_INTERVAL: 100, // 拖拽时10fps
    ZOOM_INTERVAL: 33, // 缩放时30fps
  },
};

// 根据元素数量自动选择配置
export const getOptimalConfig = (elementCount: number): ExtremePerformanceConfig => {
  if (elementCount >= EXTREME_176K_CONFIG.CRITICAL_SCENE) {
    console.log(`🔥 使用CRITICAL级配置 (${elementCount} 元素)`);
    return EXTREME_176K_CONFIG;
  }

  if (elementCount >= EXTREME_176K_CONFIG.EXTREME_SCENE) {
    console.log(`⚡ 使用EXTREME级配置 (${elementCount} 元素)`);
    return {
      ...EXTREME_176K_CONFIG,
      MAX_VISIBLE_ELEMENTS: { ...EXTREME_176K_CONFIG.MAX_VISIBLE_ELEMENTS },
      TARGET_FPS: { ...EXTREME_176K_CONFIG.TARGET_FPS },
    };
  }

  if (elementCount >= EXTREME_176K_CONFIG.LARGE_SCENE) {
    console.log(`⚠️ 使用LARGE级配置 (${elementCount} 元素)`);
    return {
      ...EXTREME_176K_CONFIG,
      MAX_VISIBLE_ELEMENTS: { ...EXTREME_176K_CONFIG.MAX_VISIBLE_ELEMENTS },
      TARGET_FPS: { ...EXTREME_176K_CONFIG.TARGET_FPS },
    };
  }

  // 正常场景
  return {
    ...EXTREME_176K_CONFIG,
    MAX_VISIBLE_ELEMENTS: {
      ...EXTREME_176K_CONFIG.MAX_VISIBLE_ELEMENTS,
      NORMAL: -1
    },
    TARGET_FPS: {
      ...EXTREME_176K_CONFIG.TARGET_FPS,
      NORMAL: 60
    },
  };
};

// 动态调整配置
export const adjustConfigForPerformance = (
  config: ExtremePerformanceConfig,
  currentFPS: number,
  targetFPS: number
): ExtremePerformanceConfig => {
  if (currentFPS < targetFPS * 0.8) {
    // 性能不足，降低质量
    return {
      ...config,
      MAX_VISIBLE_ELEMENTS: {
        NORMAL: config.MAX_VISIBLE_ELEMENTS.NORMAL,
        LARGE: Math.floor(config.MAX_VISIBLE_ELEMENTS.LARGE * 0.8),
        EXTREME: Math.floor(config.MAX_VISIBLE_ELEMENTS.EXTREME * 0.8),
        CRITICAL: Math.floor(config.MAX_VISIBLE_ELEMENTS.CRITICAL * 0.8),
      },
      THROTTLE: {
        RENDER_INTERVAL: config.THROTTLE.RENDER_INTERVAL + 10,
        DRAG_INTERVAL: config.THROTTLE.DRAG_INTERVAL + 20,
        ZOOM_INTERVAL: config.THROTTLE.ZOOM_INTERVAL + 10,
      },
    };
  }

  if (currentFPS > targetFPS * 1.2) {
    // 性能有余，提高质量
    return {
      ...config,
      MAX_VISIBLE_ELEMENTS: {
        NORMAL: config.MAX_VISIBLE_ELEMENTS.NORMAL,
        LARGE: Math.floor(config.MAX_VISIBLE_ELEMENTS.LARGE * 1.1),
        EXTREME: Math.floor(config.MAX_VISIBLE_ELEMENTS.EXTREME * 1.1),
        CRITICAL: Math.floor(config.MAX_VISIBLE_ELEMENTS.CRITICAL * 1.1),
      },
      THROTTLE: {
        RENDER_INTERVAL: Math.max(16, config.THROTTLE.RENDER_INTERVAL - 5),
        DRAG_INTERVAL: Math.max(33, config.THROTTLE.DRAG_INTERVAL - 10),
        ZOOM_INTERVAL: Math.max(16, config.THROTTLE.ZOOM_INTERVAL - 5),
      },
    };
  }

  return config;
};
