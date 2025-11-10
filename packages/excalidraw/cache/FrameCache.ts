import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";
import type { Drawable } from "roughjs/bin/core";
import { getElementAbsoluteCoords } from "@excalidraw/element";

/**
 * Performance optimization: Frame composite cache system
 *
 * This cache system optimizes frame rendering by:
 * 1. Caching composite shapes for entire frames
 * 2. Tracking children versions to detect changes
 * 3. Using intelligent cache invalidation
 * 4. Managing memory efficiently
 */

interface FrameCacheEntry {
  frameVersion: number;
  childrenVersion: number;
  childrenIds: Set<string>;
  compositeShape: Drawable | null;
  childrenShapes: Map<string, Drawable>;
  bounds: [number, number, number, number]; // [x1, y1, x2, y2]
  timestamp: number;
}

interface FrameRenderMetrics {
  hitCount: number;
  missCount: number;
  evictionCount: number;
  memoryUsage: number;
}

export class FrameCache {
  private cache = new WeakMap<ExcalidrawFrameLikeElement, FrameCacheEntry>();
  private childrenVersionCache = new Map<string, number>(); // elementId -> version
  private metrics: FrameRenderMetrics = {
    hitCount: 0,
    missCount: 0,
    evictionCount: 0,
    memoryUsage: 0,
  };

  private readonly MAX_CACHE_SIZE = 500;
  private readonly CACHE_TTL = 5000; // 5 seconds TTL for memory management

  /**
   * Get or generate composite cache for a frame and its children
   */
  public getFrameComposite(
    frame: ExcalidrawFrameLikeElement,
    children: ExcalidrawElement[],
    elementsMap: Map<string, ExcalidrawElement>,
    renderFunction: (elements: ExcalidrawElement[]) => Drawable | null,
  ): { composite: Drawable | null; fromCache: boolean } {
    const cached = this.cache.get(frame);
    const childrenVersion = this.calculateChildrenVersion(children);
    const childrenIds = new Set(children.map((el) => el.id));

    // Check cache validity
    if (this.isCacheValid(cached, frame, childrenVersion, childrenIds)) {
      this.metrics.hitCount++;
      return { composite: cached!.compositeShape, fromCache: true };
    }

    // Cache miss - generate new composite
    this.metrics.missCount++;

    const compositeShape = this.generateComposite(
      frame,
      children,
      renderFunction,
    );
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(frame, elementsMap);
    const bounds: [number, number, number, number] = [x1, y1, x2, y2];

    // Store in cache
    this.cache.set(frame, {
      frameVersion: frame.version,
      childrenVersion,
      childrenIds,
      compositeShape,
      childrenShapes: new Map(),
      bounds,
      timestamp: Date.now(),
    });

    // Update children version tracking
    children.forEach((child) => {
      this.childrenVersionCache.set(child.id, child.version);
    });

    // Cleanup old entries periodically
    this.cleanupIfNeeded();

    return { composite: compositeShape, fromCache: false };
  }

  /**
   * Get cached shape for individual child element
   */
  public getChildShape(
    frame: ExcalidrawFrameLikeElement,
    childId: string,
  ): Drawable | undefined {
    const cached = this.cache.get(frame);
    if (!cached) return undefined;

    return cached.childrenShapes.get(childId);
  }

  /**
   * Store shape for individual child element
   */
  public setChildShape(
    frame: ExcalidrawFrameLikeElement,
    childId: string,
    shape: Drawable,
  ): void {
    const cached = this.cache.get(frame);
    if (cached) {
      cached.childrenShapes.set(childId, shape);
    }
  }

  /**
   * Invalidate cache for specific frame
   */
  public invalidateFrame(frame: ExcalidrawFrameLikeElement): void {
    this.cache.delete(frame);
  }

  /**
   * Invalidate cache when child element changes
   */
  public invalidateChild(childId: string): void {
    // Remove from children version tracking
    this.childrenVersionCache.delete(childId);

    // Note: WeakMap doesn't allow iteration, so we can't directly
    // invalidate frames containing this child. The cache will be
    // invalidated on next access when version check fails.
  }

  /**
   * Get cache performance metrics
   */
  public getMetrics(): FrameRenderMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    // WeakMap will be garbage collected automatically
    this.childrenVersionCache.clear();
    this.metrics = {
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
      memoryUsage: 0,
    };
  }

  /**
   * Calculate combined version of all children
   */
  private calculateChildrenVersion(children: ExcalidrawElement[]): number {
    return children.reduce((sum, child) => sum + child.version, 0);
  }

  /**
   * Check if cached entry is still valid
   */
  private isCacheValid(
    cached: FrameCacheEntry | undefined,
    frame: ExcalidrawFrameLikeElement,
    childrenVersion: number,
    childrenIds: Set<string>,
  ): boolean {
    if (!cached) return false;

    // Check frame version
    if (cached.frameVersion !== frame.version) return false;

    // Check children version
    if (cached.childrenVersion !== childrenVersion) return false;

    // Check if children set changed
    if (cached.childrenIds.size !== childrenIds.size) return false;
    for (const id of childrenIds) {
      if (!cached.childrenIds.has(id)) return false;
    }

    // Check TTL
    if (Date.now() - cached.timestamp > this.CACHE_TTL) return false;

    return true;
  }

  /**
   * Generate composite shape for frame and children
   */
  private generateComposite(
    frame: ExcalidrawFrameLikeElement,
    children: ExcalidrawElement[],
    renderFunction: (elements: ExcalidrawElement[]) => Drawable | null,
  ): Drawable | null {
    // For now, we'll use the provided render function
    // In a more sophisticated implementation, we could:
    // 1. Combine individual child shapes
    // 2. Apply frame clipping
    // 3. Optimize for specific element types
    return renderFunction([frame, ...children]);
  }

  /**
   * Cleanup old cache entries to prevent memory leaks
   */
  private cleanupIfNeeded(): void {
    // Clean up children version cache if it gets too large
    if (this.childrenVersionCache.size > this.MAX_CACHE_SIZE) {
      const cutoffTime = Date.now() - this.CACHE_TTL;

      // Remove old entries (this is a simplified cleanup)
      // In a real implementation, we'd track timestamps for each entry
      const keysToDelete: string[] = [];
      for (const [key] of this.childrenVersionCache) {
        if (keysToDelete.length >= this.MAX_CACHE_SIZE / 2) break;
        keysToDelete.push(key);
      }

      keysToDelete.forEach((key) => {
        this.childrenVersionCache.delete(key);
        this.metrics.evictionCount++;
      });
    }
  }
}

// Global frame cache instance
export const frameCache = new FrameCache();
