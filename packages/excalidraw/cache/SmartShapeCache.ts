import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { Drawable } from "roughjs/bin/core";
import { ShapeCache } from "@excalidraw/element";

/**
 * Performance optimization: Smart Shape Cache system
 *
 * This enhanced shape cache system provides:
 * 1. Intelligent cache prioritization based on usage frequency
 * 2. Memory-aware cache eviction
 * 3. Batch invalidation for related elements
 * 4. Performance metrics and monitoring
 */

interface CacheEntry {
  shape: Drawable | null;
  lastAccessed: number;
  accessCount: number;
  elementVersion: number;
  size: number; // Approximate memory usage
}

interface CacheMetrics {
  hitCount: number;
  missCount: number;
  evictionCount: number;
  memoryUsage: number;
  averageAccessTime: number;
}

export class SmartShapeCache {
  private cache = new Map<string, CacheEntry>(); // elementId -> CacheEntry
  private accessOrder: string[] = []; // LRU tracking
  private metrics: CacheMetrics = {
    hitCount: 0,
    missCount: 0,
    evictionCount: 0,
    memoryUsage: 0,
    averageAccessTime: 0,
  };

  private readonly MAX_CACHE_SIZE = 1000;
  private readonly MAX_MEMORY_USAGE = 50 * 1024 * 1024; // 50MB
  private readonly HIGH_PRIORITY_ACCESS_THRESHOLD = 3;
  private readonly CACHE_TTL = 30000; // 30 seconds for rarely accessed items

  /**
   * Get cached shape with intelligent prioritization
   */
  public get(element: ExcalidrawElement): Drawable | null | undefined {
    const startTime = performance.now();
    const cached = this.cache.get(element.id);

    if (!cached) {
      this.metrics.missCount++;
      return undefined;
    }

    // Check version validity
    if (cached.elementVersion !== element.version) {
      this.cache.delete(element.id);
      this.metrics.missCount++;
      return undefined;
    }

    // Check TTL for low-priority items
    if (cached.accessCount < this.HIGH_PRIORITY_ACCESS_THRESHOLD) {
      const age = Date.now() - cached.lastAccessed;
      if (age > this.CACHE_TTL) {
        this.cache.delete(element.id);
        this.metrics.evictionCount++;
        this.metrics.missCount++;
        return undefined;
      }
    }

    // Update access tracking
    cached.lastAccessed = Date.now();
    cached.accessCount++;
    this.updateAccessOrder(element.id);

    this.metrics.hitCount++;
    this.updateAverageAccessTime(performance.now() - startTime);

    return cached.shape;
  }

  /**
   * Set cached shape with intelligent storage
   */
  public set(element: ExcalidrawElement, shape: Drawable | null): void {
    const size = this.estimateShapeSize(shape);

    // Check if we need to evict items
    this.evictIfNeeded(size);

    const entry: CacheEntry = {
      shape,
      lastAccessed: Date.now(),
      accessCount: 1,
      elementVersion: element.version,
      size,
    };

    // Remove old entry if exists
    const oldEntry = this.cache.get(element.id);
    if (oldEntry) {
      this.metrics.memoryUsage -= oldEntry.size;
    }

    this.cache.set(element.id, entry);
    this.updateAccessOrder(element.id);
    this.metrics.memoryUsage += size;
  }

  /**
   * Delete specific element from cache
   */
  public delete(element: ExcalidrawElement): boolean {
    const cached = this.cache.get(element.id);
    if (cached) {
      this.metrics.memoryUsage -= cached.size;
      this.removeFromAccessOrder(element.id);
      return this.cache.delete(element.id);
    }
    return false;
  }

  /**
   * Batch invalidation for related elements (e.g., grouped elements)
   */
  public invalidateGroup(elementIds: string[]): void {
    elementIds.forEach((id) => {
      const cached = this.cache.get(id);
      if (cached) {
        this.metrics.memoryUsage -= cached.size;
        this.cache.delete(id);
        this.removeFromAccessOrder(id);
        this.metrics.evictionCount++;
      }
    });
  }

  /**
   * Preload shapes for elements likely to be accessed soon
   */
  public preload(
    elements: ExcalidrawElement[],
    shapeGenerator: (element: ExcalidrawElement) => Drawable | null,
  ): void {
    // Only preload if we have cache space
    if (this.cache.size >= this.MAX_CACHE_SIZE * 0.8) {
      return;
    }

    elements.forEach((element) => {
      if (!this.cache.has(element.id)) {
        const shape = shapeGenerator(element);
        this.set(element, shape);
      }
    });
  }

  /**
   * Get cache performance metrics
   */
  public getMetrics(): CacheMetrics {
    return {
      ...this.metrics,
      memoryUsage: this.metrics.memoryUsage,
    };
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.metrics = {
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
      memoryUsage: 0,
      averageAccessTime: 0,
    };
  }

  /**
   * Get cache hit ratio
   */
  public getHitRatio(): number {
    const total = this.metrics.hitCount + this.metrics.missCount;
    return total > 0 ? this.metrics.hitCount / total : 0;
  }

  /**
   * Optimize cache by removing low-value entries
   */
  public optimize(): void {
    const now = Date.now();
    const cutoffTime = now - this.CACHE_TTL;

    // Remove old, rarely accessed entries
    const toDelete: string[] = [];

    for (const [id, entry] of this.cache) {
      if (
        entry.accessCount < this.HIGH_PRIORITY_ACCESS_THRESHOLD &&
        entry.lastAccessed < cutoffTime
      ) {
        toDelete.push(id);
      }
    }

    toDelete.forEach((id) => {
      const entry = this.cache.get(id);
      if (entry) {
        this.metrics.memoryUsage -= entry.size;
        this.cache.delete(id);
        this.removeFromAccessOrder(id);
        this.metrics.evictionCount++;
      }
    });
  }

  /**
   * Estimate memory usage of a drawable shape
   */
  private estimateShapeSize(shape: Drawable | null): number {
    if (!shape) return 100; // Base size for null shapes

    // Rough estimation based on shape complexity
    // In a real implementation, we'd analyze the actual shape data
    return 1000; // Average shape size estimate
  }

  /**
   * Evict cache entries if needed to make room
   */
  private evictIfNeeded(newEntrySize: number): void {
    // Check size limit
    while (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLRU();
    }

    // Check memory limit
    while (this.metrics.memoryUsage + newEntrySize > this.MAX_MEMORY_USAGE) {
      this.evictLRU();
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    // Find LRU entry with lowest priority
    let lruId: string | null = null;
    let lowestPriority = Infinity;

    // Prioritize eviction of rarely accessed items
    for (let i = 0; i < Math.min(10, this.accessOrder.length); i++) {
      const id = this.accessOrder[i];
      const entry = this.cache.get(id);
      if (entry) {
        const priority =
          entry.accessCount + (Date.now() - entry.lastAccessed) / 1000;
        if (priority < lowestPriority) {
          lowestPriority = priority;
          lruId = id;
        }
      }
    }

    if (lruId) {
      const entry = this.cache.get(lruId);
      if (entry) {
        this.metrics.memoryUsage -= entry.size;
        this.cache.delete(lruId);
        this.removeFromAccessOrder(lruId);
        this.metrics.evictionCount++;
      }
    }
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(elementId: string): void {
    // Remove from current position
    this.removeFromAccessOrder(elementId);

    // Add to end (most recently used)
    this.accessOrder.push(elementId);
  }

  /**
   * Remove element from access order tracking
   */
  private removeFromAccessOrder(elementId: string): void {
    const index = this.accessOrder.indexOf(elementId);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Update average access time metric
   */
  private updateAverageAccessTime(accessTime: number): void {
    const totalAccesses = this.metrics.hitCount + this.metrics.missCount;
    this.metrics.averageAccessTime =
      (this.metrics.averageAccessTime * (totalAccesses - 1) + accessTime) /
      totalAccesses;
  }
}

// Enhanced shape cache that wraps the original ShapeCache
export class EnhancedShapeCache {
  private smartCache = new SmartShapeCache();

  /**
   * Get shape with fallback to original ShapeCache
   */
  public get<T extends ExcalidrawElement>(element: T): any {
    // Try smart cache first
    const smartResult = this.smartCache.get(element);
    if (smartResult !== undefined) {
      return smartResult;
    }

    // Fallback to original cache
    const originalResult = ShapeCache.get(element);
    if (originalResult !== undefined) {
      // Store in smart cache for future access
      // Handle array shapes (normalize to single Drawable for smart cache)
      const normalizedShape = Array.isArray(originalResult)
        ? originalResult[0]
        : originalResult;
      if (normalizedShape && !Array.isArray(normalizedShape)) {
        this.smartCache.set(element, normalizedShape);
      }
      return originalResult;
    }

    return undefined;
  }

  /**
   * Set shape in both caches
   */
  public set<T extends ExcalidrawElement>(element: T, shape: any): void {
    ShapeCache.set(element, shape);
    // Handle array shapes (e.g., for arrows/lines)
    const normalizedShape = Array.isArray(shape) ? shape[0] : shape;
    this.smartCache.set(element, normalizedShape);
  }

  /**
   * Delete from both caches
   */
  public delete(element: ExcalidrawElement): boolean {
    const smartDeleted = this.smartCache.delete(element);
    const originalDeleted = ShapeCache.delete(element);
    return smartDeleted || originalDeleted;
  }

  /**
   * Get smart cache metrics
   */
  public getMetrics() {
    return this.smartCache.getMetrics();
  }

  /**
   * Optimize cache performance
   */
  public optimize(): void {
    this.smartCache.optimize();
  }

  /**
   * Clear all caches
   */
  public clear(): void {
    this.smartCache.clear();
    ShapeCache.destroy();
  }
}

// Global enhanced shape cache instance
export const enhancedShapeCache = new EnhancedShapeCache();
