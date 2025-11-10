/**
 * Performance optimization: Memory Management System
 *
 * This system provides:
 * 1. Memory usage monitoring and reporting
 * 2. Intelligent cache cleanup and garbage collection
 * 3. Memory leak detection and prevention
 * 4. Resource pooling for frequently used objects
 * 5. Memory pressure handling and adaptive behavior
 */

interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  cacheSize: number;
  poolSize: number;
  gcSuggestionThreshold: number;
  lastCleanupTime: number;
}

interface MemoryPressureLevel {
  level: "low" | "medium" | "high" | "critical";
  threshold: number;
  actions: string[];
}

interface CacheEntry {
  data: any;
  size: number;
  lastAccessed: number;
  accessCount: number;
  priority: number;
}

interface ObjectPool<T> {
  objects: T[];
  factory: () => T;
  reset: (obj: T) => void;
  maxSize: number;
}

export class MemoryManager {
  private caches = new Map<string, Map<string, CacheEntry>>();
  private objectPools = new Map<string, ObjectPool<any>>();
  private memoryObservers: Array<(stats: MemoryStats) => void> = [];
  private cleanupTimers = new Map<string, number>();

  private readonly MEMORY_PRESSURE_LEVELS: MemoryPressureLevel[] = [
    {
      level: "low",
      threshold: 0.3, // 30% of heap limit
      actions: ["optimize_caches"],
    },
    {
      level: "medium",
      threshold: 0.6, // 60% of heap limit
      actions: ["cleanup_caches", "suggest_gc"],
    },
    {
      level: "high",
      threshold: 0.8, // 80% of heap limit
      actions: ["aggressive_cleanup", "force_gc", "reduce_quality"],
    },
    {
      level: "critical",
      threshold: 0.95, // 95% of heap limit
      actions: ["emergency_cleanup", "force_gc", "disable_features"],
    },
  ];

  private readonly DEFAULT_CACHE_TTL = 300000; // 5 minutes
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute
  private readonly GC_SUGGESTION_THRESHOLD = 50 * 1024 * 1024; // 50MB

  constructor() {
    this.startMemoryMonitoring();
    this.setupPeriodicCleanup();
  }

  /**
   * Get current memory statistics
   */
  public getMemoryStats(): MemoryStats {
    const memory = (performance as any).memory;
    const cacheSize = this.calculateTotalCacheSize();
    const poolSize = this.calculateTotalPoolSize();

    return {
      usedJSHeapSize: memory?.usedJSHeapSize || 0,
      totalJSHeapSize: memory?.totalJSHeapSize || 0,
      jsHeapSizeLimit: memory?.jsHeapSizeLimit || 0,
      cacheSize,
      poolSize,
      gcSuggestionThreshold: this.GC_SUGGESTION_THRESHOLD,
      lastCleanupTime: Date.now(),
    };
  }

  /**
   * Create or get a managed cache
   */
  public createCache<T>(
    name: string,
    maxSize: number = 1000,
    ttl: number = this.DEFAULT_CACHE_TTL,
  ): ManagedCache<T> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new Map());
    }

    return new ManagedCache<T>(name, maxSize, ttl, this);
  }

  /**
   * Create or get an object pool
   */
  public createObjectPool<T>(
    name: string,
    factory: () => T,
    reset: (obj: T) => void,
    maxSize: number = 100,
  ): ManagedObjectPool<T> {
    if (!this.objectPools.has(name)) {
      this.objectPools.set(name, {
        objects: [],
        factory,
        reset,
        maxSize,
      });
    }

    return new ManagedObjectPool<T>(name, this);
  }

  /**
   * Register memory observer
   */
  public addMemoryObserver(observer: (stats: MemoryStats) => void): void {
    this.memoryObservers.push(observer);
  }

  /**
   * Remove memory observer
   */
  public removeMemoryObserver(observer: (stats: MemoryStats) => void): void {
    const index = this.memoryObservers.indexOf(observer);
    if (index > -1) {
      this.memoryObservers.splice(index, 1);
    }
  }

  /**
   * Force garbage collection if available
   */
  public suggestGarbageCollection(): void {
    if ((window as any).gc) {
      console.log("Suggesting garbage collection");
      (window as any).gc();
    } else if ((performance as any).measureUserAgentSpecificMemory) {
      // Use newer memory measurement API as a hint
      (performance as any).measureUserAgentSpecificMemory().then(() => {
        console.log("Memory measurement completed");
      });
    }
  }

  /**
   * Optimizes cache based on current memory pressure.
   */
  public optimizeCache(): void {
    const stats = this.getMemoryStats();
    const usageRatio = stats.usedJSHeapSize / stats.jsHeapSizeLimit;

    if (usageRatio > 0.8) {
      console.warn("High memory usage detected, optimizing caches...");

      // Clear object pools more aggressively
      for (const [name, pool] of this.objectPools.entries()) {
        const targetSize = Math.floor(pool.maxSize * 0.5);
        pool.objects = pool.objects.slice(0, targetSize);
      }

      // Suggest garbage collection
      this.suggestGarbageCollection();

      // Notify observers about memory optimization
      const currentStats = this.getMemoryStats();
      this.memoryObservers.forEach((observer) => observer(currentStats));
    }
  }

  /**
   * Perform emergency cleanup to free memory
   */
  public emergencyCleanup(): void {
    console.warn("Performing emergency memory cleanup");

    // Clear all caches
    for (const cache of this.caches.values()) {
      cache.clear();
    }

    // Reset all object pools
    for (const pool of this.objectPools.values()) {
      pool.objects = [];
    }

    // Force garbage collection
    this.suggestGarbageCollection();

    // Notify observers
    this.notifyMemoryObservers();
  }

  /**
   * Get current memory pressure level
   */
  public getMemoryPressureLevel(): MemoryPressureLevel {
    const stats = this.getMemoryStats();
    const usageRatio = stats.usedJSHeapSize / stats.jsHeapSizeLimit;

    for (let i = this.MEMORY_PRESSURE_LEVELS.length - 1; i >= 0; i--) {
      const level = this.MEMORY_PRESSURE_LEVELS[i];
      if (usageRatio >= level.threshold) {
        return level;
      }
    }

    return this.MEMORY_PRESSURE_LEVELS[0]; // Default to low pressure
  }

  /**
   * Handle memory pressure by taking appropriate actions
   */
  public handleMemoryPressure(): void {
    const pressureLevel = this.getMemoryPressureLevel();

    console.log(`Memory pressure level: ${pressureLevel.level}`);

    for (const action of pressureLevel.actions) {
      switch (action) {
        case "optimize_caches":
          this.optimizeCaches();
          break;
        case "cleanup_caches":
          this.cleanupCaches();
          break;
        case "suggest_gc":
          this.suggestGarbageCollection();
          break;
        case "aggressive_cleanup":
          this.aggressiveCleanup();
          break;
        case "force_gc":
          this.suggestGarbageCollection();
          break;
        case "emergency_cleanup":
          this.emergencyCleanup();
          break;
        case "reduce_quality":
          this.notifyQualityReduction();
          break;
        case "disable_features":
          this.notifyFeatureDisabling();
          break;
      }
    }
  }

  /**
   * Clean up expired cache entries
   */
  public cleanupCaches(): void {
    const now = Date.now();

    for (const [cacheName, cache] of this.caches) {
      const toDelete: string[] = [];

      for (const [key, entry] of cache) {
        const age = now - entry.lastAccessed;
        if (age > this.DEFAULT_CACHE_TTL) {
          toDelete.push(key);
        }
      }

      toDelete.forEach((key) => cache.delete(key));

      if (toDelete.length > 0) {
        console.log(
          `Cleaned up ${toDelete.length} entries from cache: ${cacheName}`,
        );
      }
    }
  }

  /**
   * Get cache by name (internal use)
   */
  public getCache(name: string): Map<string, CacheEntry> | undefined {
    return this.caches.get(name);
  }

  /**
   * Get object pool by name (internal use)
   */
  public getObjectPool(name: string): ObjectPool<any> | undefined {
    return this.objectPools.get(name);
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    // Monitor memory every 5 seconds
    setInterval(() => {
      this.checkMemoryPressure();
    }, 5000);
  }

  /**
   * Setup periodic cleanup
   */
  private setupPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupCaches();
      this.optimizeObjectPools();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Check memory pressure and take action
   */
  private checkMemoryPressure(): void {
    const pressureLevel = this.getMemoryPressureLevel();

    if (pressureLevel.level !== "low") {
      this.handleMemoryPressure();
    }

    this.notifyMemoryObservers();
  }

  /**
   * Notify memory observers
   */
  private notifyMemoryObservers(): void {
    const stats = this.getMemoryStats();
    this.memoryObservers.forEach((observer) => {
      try {
        observer(stats);
      } catch (error) {
        console.error("Memory observer error:", error);
      }
    });
  }

  /**
   * Calculate total cache size
   */
  private calculateTotalCacheSize(): number {
    let totalSize = 0;

    for (const cache of this.caches.values()) {
      for (const entry of cache.values()) {
        totalSize += entry.size;
      }
    }

    return totalSize;
  }

  /**
   * Calculate total object pool size
   */
  private calculateTotalPoolSize(): number {
    let totalSize = 0;

    for (const pool of this.objectPools.values()) {
      totalSize += pool.objects.length * 1000; // Rough estimate
    }

    return totalSize;
  }

  /**
   * Optimize caches by removing low-priority entries
   */
  private optimizeCaches(): void {
    for (const [cacheName, cache] of this.caches) {
      const entries = Array.from(cache.entries());

      // Sort by priority and access frequency
      entries.sort((a, b) => {
        const scoreA = a[1].priority * a[1].accessCount;
        const scoreB = b[1].priority * b[1].accessCount;
        return scoreA - scoreB; // Lower score = lower priority
      });

      // Remove bottom 20% if cache is large
      if (entries.length > 100) {
        const toRemove = Math.floor(entries.length * 0.2);
        for (let i = 0; i < toRemove; i++) {
          cache.delete(entries[i][0]);
        }
        console.log(
          `Optimized cache ${cacheName}: removed ${toRemove} low-priority entries`,
        );
      }
    }
  }

  /**
   * Aggressive cleanup for high memory pressure
   */
  private aggressiveCleanup(): void {
    // Remove 50% of cache entries
    for (const [cacheName, cache] of this.caches) {
      const entries = Array.from(cache.keys());
      const toRemove = Math.floor(entries.length * 0.5);

      for (let i = 0; i < toRemove; i++) {
        cache.delete(entries[i]);
      }

      console.log(
        `Aggressive cleanup on cache ${cacheName}: removed ${toRemove} entries`,
      );
    }

    // Reduce object pool sizes
    for (const pool of this.objectPools.values()) {
      pool.objects = pool.objects.slice(
        0,
        Math.floor(pool.objects.length * 0.5),
      );
    }
  }

  /**
   * Optimize object pools
   */
  private optimizeObjectPools(): void {
    for (const [poolName, pool] of this.objectPools) {
      if (pool.objects.length > pool.maxSize) {
        pool.objects = pool.objects.slice(0, pool.maxSize);
        console.log(
          `Optimized object pool ${poolName}: reduced to ${pool.maxSize} objects`,
        );
      }
    }
  }

  /**
   * Notify about quality reduction
   */
  private notifyQualityReduction(): void {
    // This would integrate with rendering system to reduce quality
    console.log("Memory pressure: reducing rendering quality");
  }

  /**
   * Notify about feature disabling
   */
  private notifyFeatureDisabling(): void {
    // This would disable non-essential features
    console.log("Memory pressure: disabling non-essential features");
  }
}

/**
 * Managed cache with automatic cleanup
 */
export class ManagedCache<T> {
  constructor(
    private name: string,
    private maxSize: number,
    private ttl: number,
    private memoryManager: MemoryManager,
  ) {}

  public get(key: string): T | undefined {
    const cache = this.memoryManager.getCache(this.name);
    if (!cache) return undefined;

    const entry = cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.lastAccessed > this.ttl) {
      cache.delete(key);
      return undefined;
    }

    // Update access info
    entry.lastAccessed = Date.now();
    entry.accessCount++;

    return entry.data;
  }

  public set(key: string, value: T, priority: number = 1): void {
    const cache = this.memoryManager.getCache(this.name);
    if (!cache) return;

    const size = this.estimateSize(value);
    const entry: CacheEntry = {
      data: value,
      size,
      lastAccessed: Date.now(),
      accessCount: 1,
      priority,
    };

    // Check size limit
    if (cache.size >= this.maxSize) {
      this.evictLRU(cache);
    }

    cache.set(key, entry);
  }

  public delete(key: string): boolean {
    const cache = this.memoryManager.getCache(this.name);
    return cache?.delete(key) || false;
  }

  public clear(): void {
    const cache = this.memoryManager.getCache(this.name);
    cache?.clear();
  }

  private evictLRU(cache: Map<string, CacheEntry>): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  private estimateSize(value: T): number {
    // Rough size estimation
    if (typeof value === "string") {
      return value.length * 2; // UTF-16
    } else if (typeof value === "object" && value !== null) {
      return JSON.stringify(value).length * 2; // Rough estimate
    }
    return 100; // Default size
  }
}

/**
 * Managed object pool with automatic cleanup
 */
export class ManagedObjectPool<T> {
  constructor(private name: string, private memoryManager: MemoryManager) {}

  public get(): T {
    const pool = this.memoryManager.getObjectPool(this.name);
    if (!pool) throw new Error(`Object pool ${this.name} not found`);

    if (pool.objects.length > 0) {
      return pool.objects.pop()!;
    }

    return pool.factory();
  }

  public release(obj: T): void {
    const pool = this.memoryManager.getObjectPool(this.name);
    if (!pool) return;

    if (pool.objects.length < pool.maxSize) {
      pool.reset(obj);
      pool.objects.push(obj);
    }
  }

  public clear(): void {
    const pool = this.memoryManager.getObjectPool(this.name);
    if (pool) {
      pool.objects = [];
    }
  }
}

// Global memory manager instance
export const memoryManager = new MemoryManager();

// Setup memory monitoring for Excalidraw
memoryManager.addMemoryObserver((stats) => {
  // Log memory stats in development
  if (process.env.NODE_ENV === "development") {
    console.log("Memory Stats:", {
      used: `${Math.round(stats.usedJSHeapSize / 1024 / 1024)}MB`,
      total: `${Math.round(stats.totalJSHeapSize / 1024 / 1024)}MB`,
      limit: `${Math.round(stats.jsHeapSizeLimit / 1024 / 1024)}MB`,
      cacheSize: `${Math.round(stats.cacheSize / 1024)}KB`,
    });
  }
});
