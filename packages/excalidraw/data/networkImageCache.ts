/**
 * 网络图片缓存系统
 * 管理网络图片的加载和缓存
 */

export interface NetworkImageCacheEntry {
  /** 图片元素 */
  image: HTMLImageElement | Promise<HTMLImageElement>;
  /** 图片URL */
  url: string;
  /** 加载状态 */
  status: "loading" | "loaded" | "error";
  /** 错误信息 */
  error?: string;
  /** 创建时间 */
  created: number;
  /** 最后访问时间 */
  lastAccessed: number;
}

export class NetworkImageCache {
  private cache = new Map<string, NetworkImageCacheEntry>();
  private maxSize: number;
  private maxAge: number; // 毫秒

  constructor(maxSize: number = 100, maxAge: number = 30 * 60 * 1000) {
    // 默认30分钟
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  /**
   * 获取图片
   */
  get(url: string): NetworkImageCacheEntry | undefined {
    const entry = this.cache.get(url);
    if (entry) {
      entry.lastAccessed = Date.now();
      return entry;
    }
    return undefined;
  }

  /**
   * 设置图片缓存
   */
  set(url: string, entry: Omit<NetworkImageCacheEntry, "lastAccessed">): void {
    // 清理过期缓存
    this.cleanup();

    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(url, {
      ...entry,
      lastAccessed: Date.now(),
    });
  }

  /**
   * 检查是否存在
   */
  has(url: string): boolean {
    return this.cache.has(url);
  }

  /**
   * 删除缓存项
   */
  delete(url: string): boolean {
    return this.cache.delete(url);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [url, entry] of this.cache.entries()) {
      if (now - entry.lastAccessed > this.maxAge) {
        this.cache.delete(url);
      }
    }
  }

  /**
   * 删除最旧的缓存项
   */
  private evictOldest(): void {
    let oldestUrl: string | null = null;
    let oldestTime = Date.now();

    for (const [url, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestUrl = url;
      }
    }

    if (oldestUrl) {
      this.cache.delete(oldestUrl);
    }
  }
}

/**
 * 全局网络图片缓存实例
 */
export const networkImageCache = new NetworkImageCache();

/**
 * 加载网络图片
 */
export const loadNetworkImage = async (
  url: string,
): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve(img);
    };

    img.onerror = (error) => {
      reject(new Error(`Failed to load image: ${url}`));
    };

    // 设置跨域属性（如果需要）
    img.crossOrigin = "anonymous";
    img.src = url;
  });
};

/**
 * 获取或加载网络图片
 */
export const getOrLoadNetworkImage = async (
  url: string,
): Promise<HTMLImageElement> => {
  // 检查缓存
  const cached = networkImageCache.get(url);
  if (cached) {
    if (
      cached.status === "loaded" &&
      cached.image instanceof HTMLImageElement
    ) {
      return cached.image;
    }
    if (cached.status === "loading" && cached.image instanceof Promise) {
      return await cached.image;
    }
    if (cached.status === "error") {
      throw new Error(cached.error || "Failed to load image");
    }
  }

  // 开始加载
  const imagePromise = loadNetworkImage(url);

  // 添加到缓存（加载中状态）
  networkImageCache.set(url, {
    image: imagePromise,
    url,
    status: "loading",
    created: Date.now(),
  });

  try {
    const image = await imagePromise;

    // 更新缓存（加载完成状态）
    networkImageCache.set(url, {
      image,
      url,
      status: "loaded",
      created: Date.now(),
    });

    return image;
  } catch (error: any) {
    // 更新缓存（错误状态）
    networkImageCache.set(url, {
      image: imagePromise,
      url,
      status: "error",
      error: error.message,
      created: Date.now(),
    });

    throw error;
  }
};
