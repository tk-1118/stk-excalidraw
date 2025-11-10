import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";
import type { AppState } from "../types";
import { spatialIndex, type Bounds } from "../spatial/Quadtree";
import { isElementInViewport } from "@excalidraw/element";
import { viewportCoordsToSceneCoords } from "@excalidraw/common";

/**
 * Performance optimization: Advanced Visibility Management System
 *
 * This system provides:
 * 1. Spatial index-based visibility calculations
 * 2. Frustum culling for large scenes
 * 3. Level-of-detail (LOD) optimization
 * 4. Cached visibility results with intelligent invalidation
 * 5. Frame-aware visibility optimization
 */

interface VisibilityCache {
  elementId: string;
  isVisible: boolean;
  lastChecked: number;
  viewportHash: string;
  lodLevel: number;
}

interface ViewportInfo {
  bounds: Bounds;
  zoom: number;
  hash: string;
}

interface VisibilityStats {
  totalElements: number;
  visibleElements: number;
  culledElements: number;
  cacheHits: number;
  cacheMisses: number;
  spatialQueryTime: number;
  totalQueryTime: number;
}

export class VisibilityManager {
  private visibilityCache = new Map<string, VisibilityCache>();
  private lastViewportInfo: ViewportInfo | null = null;
  private stats: VisibilityStats = {
    totalElements: 0,
    visibleElements: 0,
    culledElements: 0,
    cacheHits: 0,
    cacheMisses: 0,
    spatialQueryTime: 0,
    totalQueryTime: 0,
  };

  protected readonly CACHE_TTL = 100; // 100ms cache validity
  private readonly LOD_ZOOM_THRESHOLDS = [0.1, 0.25, 0.5, 1.0, 2.0];
  private readonly FRUSTUM_PADDING = 200; // Extra padding for frustum culling

  /**
   * Get visible elements using advanced culling techniques
   */
  public getVisibleElements(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    elementsMap: Map<string, ExcalidrawElement>,
  ): ExcalidrawElement[] {
    const startTime = performance.now();

    // Update spatial index if needed
    spatialIndex.update(Array.from(elements), elementsMap);

    // Calculate viewport bounds
    const viewportInfo = this.calculateViewportInfo(appState);
    const viewportChanged = this.hasViewportChanged(viewportInfo);

    // Use spatial index for initial culling
    const spatialStartTime = performance.now();
    const candidates = spatialIndex.getElementsInViewport(viewportInfo.bounds);
    this.stats.spatialQueryTime = performance.now() - spatialStartTime;

    // Apply detailed visibility checks
    const visibleElements: ExcalidrawElement[] = [];
    this.stats.totalElements = elements.length;
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;

    for (const element of candidates) {
      if (
        this.isElementVisible(
          element,
          appState,
          elementsMap,
          viewportInfo,
          viewportChanged,
        )
      ) {
        visibleElements.push(element);
      }
    }

    this.stats.visibleElements = visibleElements.length;
    this.stats.culledElements = elements.length - visibleElements.length;
    this.stats.totalQueryTime = performance.now() - startTime;
    this.lastViewportInfo = viewportInfo;

    return visibleElements;
  }

  /**
   * Get elements visible within a frame using spatial optimization
   */
  public getVisibleElementsInFrame(
    frame: ExcalidrawFrameLikeElement,
    appState: AppState,
    elementsMap: Map<string, ExcalidrawElement>,
  ): ExcalidrawElement[] {
    // Use spatial index to quickly find frame contents
    const frameElements = spatialIndex.getElementsInFrame(frame);

    // Filter by actual visibility and frame membership
    return frameElements.filter((element) => {
      // Skip the frame itself
      if (element.id === frame.id) return false;

      // Check if element is actually in the frame
      return (
        element.frameId === frame.id ||
        this.isElementContainedInFrame(element, frame, elementsMap)
      );
    });
  }

  /**
   * Perform frustum culling for large scenes
   */
  public performFrustumCulling(
    elements: readonly ExcalidrawElement[],
    viewportBounds: Bounds,
  ): ExcalidrawElement[] {
    // Expand viewport bounds for frustum culling
    const frustumBounds: Bounds = {
      x: viewportBounds.x - this.FRUSTUM_PADDING,
      y: viewportBounds.y - this.FRUSTUM_PADDING,
      width: viewportBounds.width + 2 * this.FRUSTUM_PADDING,
      height: viewportBounds.height + 2 * this.FRUSTUM_PADDING,
    };

    return spatialIndex.getElementsInViewport(frustumBounds);
  }

  /**
   * Get appropriate level of detail based on zoom and element size
   */
  public getLODLevel(element: ExcalidrawElement, zoom: number): number {
    const elementSize = Math.max(element.width, element.height);
    const screenSize = elementSize * zoom;

    // Determine LOD level based on screen size
    if (screenSize < 5) return 0; // Invisible/point
    if (screenSize < 20) return 1; // Low detail
    if (screenSize < 100) return 2; // Medium detail
    if (screenSize < 500) return 3; // High detail
    return 4; // Full detail
  }

  /**
   * Check if elements should be rendered based on LOD
   */
  public shouldRenderAtLOD(
    element: ExcalidrawElement,
    lodLevel: number,
  ): boolean {
    // Different element types have different LOD requirements
    switch (element.type) {
      case "text":
        return lodLevel >= 2; // Text needs medium detail to be readable
      case "arrow":
      case "line":
        return lodLevel >= 1; // Lines can be shown at low detail
      case "image":
      case "embeddable":
        return lodLevel >= 2; // Images need medium detail
      default:
        return lodLevel >= 1; // Most shapes can be shown at low detail
    }
  }

  /**
   * Invalidate visibility cache for specific elements
   */
  public invalidateCache(elementIds: string[]): void {
    elementIds.forEach((id) => {
      this.visibilityCache.delete(id);
    });
  }

  /**
   * Clear entire visibility cache
   */
  public clearCache(): void {
    this.visibilityCache.clear();
  }

  /**
   * Get visibility statistics for debugging
   */
  public getStats(): VisibilityStats {
    return { ...this.stats };
  }

  /**
   * Optimize visibility cache by removing old entries
   */
  public optimizeCache(): void {
    const now = Date.now();
    const cutoffTime = now - this.CACHE_TTL * 2;

    for (const [elementId, cache] of this.visibilityCache) {
      if (cache.lastChecked < cutoffTime) {
        this.visibilityCache.delete(elementId);
      }
    }
  }

  /**
   * Check if a single element is visible with caching
   */
  protected isElementVisible(
    element: ExcalidrawElement,
    appState: AppState,
    elementsMap: Map<string, ExcalidrawElement>,
    viewportInfo: ViewportInfo,
    viewportChanged: boolean,
  ): boolean {
    const now = Date.now();
    const cached = this.visibilityCache.get(element.id);

    // Check cache validity
    if (
      cached &&
      !viewportChanged &&
      cached.viewportHash === viewportInfo.hash &&
      now - cached.lastChecked < this.CACHE_TTL
    ) {
      this.stats.cacheHits++;
      return cached.isVisible;
    }

    this.stats.cacheMisses++;

    // Calculate LOD level
    const lodLevel = this.getLODLevel(element, viewportInfo.zoom);

    // Check if element should be rendered at this LOD
    if (!this.shouldRenderAtLOD(element, lodLevel)) {
      this.updateVisibilityCache(element.id, false, viewportInfo, lodLevel);
      return false;
    }

    // Perform detailed visibility check
    const isVisible = isElementInViewport(
      element,
      appState.width,
      appState.height,
      appState,
      elementsMap,
    );

    this.updateVisibilityCache(element.id, isVisible, viewportInfo, lodLevel);
    return isVisible;
  }

  /**
   * Update visibility cache entry
   */
  private updateVisibilityCache(
    elementId: string,
    isVisible: boolean,
    viewportInfo: ViewportInfo,
    lodLevel: number,
  ): void {
    this.visibilityCache.set(elementId, {
      elementId,
      isVisible,
      lastChecked: Date.now(),
      viewportHash: viewportInfo.hash,
      lodLevel,
    });
  }

  /**
   * Calculate current viewport information
   */
  protected calculateViewportInfo(appState: AppState): ViewportInfo {
    const topLeft = viewportCoordsToSceneCoords(
      { clientX: 0, clientY: 0 },
      appState,
    );
    const bottomRight = viewportCoordsToSceneCoords(
      { clientX: appState.width, clientY: appState.height },
      appState,
    );

    const bounds: Bounds = {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };

    const hash = `${bounds.x}-${bounds.y}-${bounds.width}-${bounds.height}-${appState.zoom.value}`;

    return {
      bounds,
      zoom: appState.zoom.value,
      hash,
    };
  }

  /**
   * Check if viewport has changed significantly
   */
  private hasViewportChanged(viewportInfo: ViewportInfo): boolean {
    if (!this.lastViewportInfo) return true;
    return this.lastViewportInfo.hash !== viewportInfo.hash;
  }

  /**
   * Check if element is contained within a frame
   */
  private isElementContainedInFrame(
    element: ExcalidrawElement,
    frame: ExcalidrawFrameLikeElement,
    elementsMap: Map<string, ExcalidrawElement>,
  ): boolean {
    // This is a simplified check - in practice, you'd want more sophisticated
    // containment logic based on the actual frame clipping rules
    return element.frameId === frame.id;
  }
}

/**
 * Enhanced visibility system with frame-aware optimizations
 */
export class FrameAwareVisibilityManager extends VisibilityManager {
  private frameVisibilityCache = new Map<
    string,
    {
      frameId: string;
      visibleChildren: string[];
      lastUpdated: number;
      childrenHash: string;
    }
  >();

  /**
   * Get visible elements with frame-aware optimizations
   */
  public getVisibleElementsWithFrameOptimization(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    elementsMap: Map<string, ExcalidrawElement>,
  ): ExcalidrawElement[] {
    const visibleElements = this.getVisibleElements(
      elements,
      appState,
      elementsMap,
    );

    // Group elements by frame for optimized processing
    const frameGroups = new Map<string, ExcalidrawElement[]>();
    const nonFramedElements: ExcalidrawElement[] = [];

    for (const element of visibleElements) {
      if (element.frameId) {
        if (!frameGroups.has(element.frameId)) {
          frameGroups.set(element.frameId, []);
        }
        frameGroups.get(element.frameId)!.push(element);
      } else {
        nonFramedElements.push(element);
      }
    }

    // Process frame groups with caching
    const result = [...nonFramedElements];

    for (const [frameId, frameElements] of frameGroups) {
      const frame = elementsMap.get(frameId) as ExcalidrawFrameLikeElement;
      if (frame) {
        const optimizedFrameElements = this.getOptimizedFrameElements(
          frame,
          frameElements,
          appState,
          elementsMap,
        );
        result.push(...optimizedFrameElements);
      } else {
        result.push(...frameElements);
      }
    }

    return result;
  }

  /**
   * Get optimized frame elements with caching
   */
  private getOptimizedFrameElements(
    frame: ExcalidrawFrameLikeElement,
    frameElements: ExcalidrawElement[],
    appState: AppState,
    elementsMap: Map<string, ExcalidrawElement>,
  ): ExcalidrawElement[] {
    const childrenHash = frameElements
      .map((el) => `${el.id}-${el.version}`)
      .join(",");
    const cached = this.frameVisibilityCache.get(frame.id);

    // Check cache validity
    if (
      cached &&
      cached.childrenHash === childrenHash &&
      Date.now() - cached.lastUpdated < this.CACHE_TTL
    ) {
      // Return cached visible children
      return frameElements.filter((el) =>
        cached.visibleChildren.includes(el.id),
      );
    }

    // Calculate visible children
    const visibleChildren = frameElements.filter((element) =>
      this.isElementVisible(
        element,
        appState,
        elementsMap,
        this.calculateViewportInfo(appState),
        false,
      ),
    );

    // Update cache
    this.frameVisibilityCache.set(frame.id, {
      frameId: frame.id,
      visibleChildren: visibleChildren.map((el) => el.id),
      lastUpdated: Date.now(),
      childrenHash,
    });

    return visibleChildren;
  }

  /**
   * Invalidate frame visibility cache
   */
  public invalidateFrameCache(frameId: string): void {
    this.frameVisibilityCache.delete(frameId);
  }
}

// Global visibility manager instances
export const visibilityManager = new VisibilityManager();
export const frameAwareVisibilityManager = new FrameAwareVisibilityManager();
