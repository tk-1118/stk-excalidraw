import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";
import { getElementAbsoluteCoords } from "@excalidraw/element";

/**
 * Performance optimization: Quadtree spatial index
 *
 * This quadtree implementation provides:
 * 1. Fast spatial queries for element intersection and containment
 * 2. Efficient frame membership testing
 * 3. Optimized viewport visibility calculations
 * 4. Dynamic tree restructuring for optimal performance
 */

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

interface QuadtreeItem {
  element: ExcalidrawElement;
  bounds: Bounds;
}

export class Quadtree {
  private bounds: Bounds;
  private items: QuadtreeItem[] = [];
  private nodes: Quadtree[] = [];
  private readonly MAX_ITEMS = 10;
  private readonly MAX_DEPTH = 8;
  private depth: number;

  constructor(bounds: Bounds, depth = 0) {
    this.bounds = bounds;
    this.depth = depth;
  }

  /**
   * Insert an element into the quadtree
   */
  public insert(
    element: ExcalidrawElement,
    elementsMap?: Map<string, ExcalidrawElement>,
  ): void {
    const bounds = this.getElementBounds(element, elementsMap);
    const item: QuadtreeItem = { element, bounds };

    // If we have subnodes, try to insert into them
    if (this.nodes.length > 0) {
      const index = this.getIndex(bounds);
      if (index !== -1) {
        this.nodes[index].insert(element, elementsMap);
        return;
      }
    }

    this.items.push(item);

    // Split if we exceed capacity and haven't reached max depth
    if (
      this.items.length > this.MAX_ITEMS &&
      this.depth < this.MAX_DEPTH &&
      this.nodes.length === 0
    ) {
      this.split();

      // Redistribute items to subnodes
      let i = 0;
      while (i < this.items.length) {
        const index = this.getIndex(this.items[i].bounds);
        if (index !== -1) {
          const item = this.items.splice(i, 1)[0];
          this.nodes[index].insert(item.element, elementsMap);
        } else {
          i++;
        }
      }
    }
  }

  /**
   * Remove an element from the quadtree
   */
  public remove(
    element: ExcalidrawElement,
    elementsMap?: Map<string, ExcalidrawElement>,
  ): boolean {
    const bounds = this.getElementBounds(element, elementsMap);

    // Try to remove from subnodes first
    if (this.nodes.length > 0) {
      const index = this.getIndex(bounds);
      if (index !== -1) {
        return this.nodes[index].remove(element, elementsMap);
      }
    }

    // Remove from current node
    const itemIndex = this.items.findIndex(
      (item) => item.element.id === element.id,
    );
    if (itemIndex !== -1) {
      this.items.splice(itemIndex, 1);
      return true;
    }

    return false;
  }

  /**
   * Query elements within a rectangular bounds
   */
  public query(queryBounds: Bounds): ExcalidrawElement[] {
    const results: ExcalidrawElement[] = [];

    // Check if query bounds intersect with this node
    if (!this.intersects(this.bounds, queryBounds)) {
      return results;
    }

    // Check items in this node
    for (const item of this.items) {
      if (this.intersects(item.bounds, queryBounds)) {
        results.push(item.element);
      }
    }

    // Query subnodes
    for (const node of this.nodes) {
      results.push(...node.query(queryBounds));
    }

    return results;
  }

  /**
   * Query elements within a circular area
   */
  public queryCircle(center: Point, radius: number): ExcalidrawElement[] {
    const queryBounds: Bounds = {
      x: center.x - radius,
      y: center.y - radius,
      width: radius * 2,
      height: radius * 2,
    };

    const candidates = this.query(queryBounds);

    // Filter by actual circle intersection
    return candidates.filter((element) => {
      const bounds = this.getElementBounds(element);
      return this.circleIntersectsRect(center, radius, bounds);
    });
  }

  /**
   * Find elements that contain a specific point
   */
  public queryPoint(point: Point): ExcalidrawElement[] {
    const results: ExcalidrawElement[] = [];

    // Check if point is within this node
    if (!this.containsPoint(this.bounds, point)) {
      return results;
    }

    // Check items in this node
    for (const item of this.items) {
      if (this.containsPoint(item.bounds, point)) {
        results.push(item.element);
      }
    }

    // Query subnodes
    for (const node of this.nodes) {
      results.push(...node.queryPoint(point));
    }

    return results;
  }

  /**
   * Find elements within a frame
   */
  public queryFrame(
    frame: ExcalidrawFrameLikeElement,
    elementsMap?: Map<string, ExcalidrawElement>,
  ): ExcalidrawElement[] {
    const frameBounds = this.getElementBounds(frame, elementsMap);
    return this.query(frameBounds);
  }

  /**
   * Get all elements in the quadtree
   */
  public getAllElements(): ExcalidrawElement[] {
    const results: ExcalidrawElement[] = [];

    // Add items from this node
    results.push(...this.items.map((item) => item.element));

    // Add items from subnodes
    for (const node of this.nodes) {
      results.push(...node.getAllElements());
    }

    return results;
  }

  /**
   * Clear all elements from the quadtree
   */
  public clear(): void {
    this.items = [];
    this.nodes = [];
  }

  /**
   * Get tree statistics for debugging
   */
  public getStats(): {
    totalNodes: number;
    totalItems: number;
    maxDepth: number;
    averageItemsPerLeaf: number;
  } {
    let totalNodes = 1;
    let totalItems = this.items.length;
    let maxDepth = this.depth;
    let leafNodes = this.nodes.length === 0 ? 1 : 0;

    for (const node of this.nodes) {
      const nodeStats = node.getStats();
      totalNodes += nodeStats.totalNodes;
      totalItems += nodeStats.totalItems;
      maxDepth = Math.max(maxDepth, nodeStats.maxDepth);
      leafNodes += this.nodes.length === 0 ? 1 : 0;
    }

    return {
      totalNodes,
      totalItems,
      maxDepth,
      averageItemsPerLeaf: leafNodes > 0 ? totalItems / leafNodes : 0,
    };
  }

  /**
   * Rebuild the quadtree for optimal performance
   */
  public rebuild(
    elements: ExcalidrawElement[],
    elementsMap?: Map<string, ExcalidrawElement>,
  ): void {
    this.clear();

    // Calculate optimal bounds based on elements
    if (elements.length > 0) {
      this.bounds = this.calculateOptimalBounds(
        elements,
        elementsMap || new Map(),
      );
    }

    // Insert all elements
    for (const element of elements) {
      this.insert(element, elementsMap || new Map());
    }
  }

  /**
   * Split the current node into four subnodes
   */
  private split(): void {
    const halfWidth = this.bounds.width / 2;
    const halfHeight = this.bounds.height / 2;
    const x = this.bounds.x;
    const y = this.bounds.y;

    // Create four subnodes
    this.nodes[0] = new Quadtree(
      {
        // Top-right
        x: x + halfWidth,
        y: y,
        width: halfWidth,
        height: halfHeight,
      },
      this.depth + 1,
    );

    this.nodes[1] = new Quadtree(
      {
        // Top-left
        x: x,
        y: y,
        width: halfWidth,
        height: halfHeight,
      },
      this.depth + 1,
    );

    this.nodes[2] = new Quadtree(
      {
        // Bottom-left
        x: x,
        y: y + halfHeight,
        width: halfWidth,
        height: halfHeight,
      },
      this.depth + 1,
    );

    this.nodes[3] = new Quadtree(
      {
        // Bottom-right
        x: x + halfWidth,
        y: y + halfHeight,
        width: halfWidth,
        height: halfHeight,
      },
      this.depth + 1,
    );
  }

  /**
   * Determine which subnode an object belongs to
   */
  private getIndex(bounds: Bounds): number {
    const midX = this.bounds.x + this.bounds.width / 2;
    const midY = this.bounds.y + this.bounds.height / 2;

    const topQuadrant = bounds.y < midY && bounds.y + bounds.height < midY;
    const bottomQuadrant = bounds.y > midY;
    const leftQuadrant = bounds.x < midX && bounds.x + bounds.width < midX;
    const rightQuadrant = bounds.x > midX;

    if (topQuadrant) {
      if (rightQuadrant) return 0; // Top-right
      if (leftQuadrant) return 1; // Top-left
    } else if (bottomQuadrant) {
      if (leftQuadrant) return 2; // Bottom-left
      if (rightQuadrant) return 3; // Bottom-right
    }

    return -1; // Object doesn't fit completely in any quadrant
  }

  /**
   * Check if two rectangles intersect
   */
  private intersects(rect1: Bounds, rect2: Bounds): boolean {
    return !(
      rect1.x > rect2.x + rect2.width ||
      rect1.x + rect1.width < rect2.x ||
      rect1.y > rect2.y + rect2.height ||
      rect1.y + rect1.height < rect2.y
    );
  }

  /**
   * Check if a rectangle contains a point
   */
  private containsPoint(rect: Bounds, point: Point): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  /**
   * Check if a circle intersects with a rectangle
   */
  private circleIntersectsRect(
    center: Point,
    radius: number,
    rect: Bounds,
  ): boolean {
    const closestX = Math.max(rect.x, Math.min(center.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(center.y, rect.y + rect.height));

    const distanceX = center.x - closestX;
    const distanceY = center.y - closestY;

    return distanceX * distanceX + distanceY * distanceY <= radius * radius;
  }

  /**
   * Get element bounds, using elementsMap if available
   */
  private getElementBounds(
    element: ExcalidrawElement,
    elementsMap?: Map<string, ExcalidrawElement>,
  ): Bounds {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(
      element,
      elementsMap || new Map(),
    );
    return {
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1,
    };
  }

  /**
   * Calculate optimal bounds for a set of elements
   */
  private calculateOptimalBounds(
    elements: ExcalidrawElement[],
    elementsMap?: Map<string, ExcalidrawElement>,
  ): Bounds {
    if (elements.length === 0) {
      return { x: 0, y: 0, width: 1000, height: 1000 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const element of elements) {
      const [x1, y1, x2, y2] = getElementAbsoluteCoords(
        element,
        elementsMap || new Map(),
      );
      minX = Math.min(minX, x1);
      minY = Math.min(minY, y1);
      maxX = Math.max(maxX, x2);
      maxY = Math.max(maxY, y2);
    }

    // Add some padding for better performance
    const padding = 100;
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + 2 * padding,
      height: maxY - minY + 2 * padding,
    };
  }
}

/**
 * Spatial index manager for Excalidraw elements
 */
export class SpatialIndex {
  private quadtree: Quadtree;
  private elementsMap: Map<string, ExcalidrawElement> = new Map();
  private lastUpdateTime = 0;
  private readonly UPDATE_THROTTLE = 16; // ~60fps

  constructor(bounds?: Bounds) {
    this.quadtree = new Quadtree(
      bounds || { x: 0, y: 0, width: 10000, height: 10000 },
    );
  }

  /**
   * Update the spatial index with new elements
   */
  public update(
    elements: ExcalidrawElement[],
    elementsMap?: Map<string, ExcalidrawElement>,
  ): void {
    const now = Date.now();
    if (now - this.lastUpdateTime < this.UPDATE_THROTTLE) {
      return; // Throttle updates
    }

    this.lastUpdateTime = now;
    this.elementsMap =
      elementsMap || new Map(elements.map((el) => [el.id, el]));

    // Rebuild quadtree with current elements
    this.quadtree.rebuild(elements, this.elementsMap);
  }

  /**
   * Find elements within a frame efficiently
   */
  public getElementsInFrame(
    frame: ExcalidrawFrameLikeElement,
  ): ExcalidrawElement[] {
    return this.quadtree.queryFrame(frame, this.elementsMap);
  }

  /**
   * Find elements in viewport efficiently
   */
  public getElementsInViewport(viewportBounds: Bounds): ExcalidrawElement[] {
    return this.quadtree.query(viewportBounds);
  }

  /**
   * Find elements at a specific point
   */
  public getElementsAtPoint(point: Point): ExcalidrawElement[] {
    return this.quadtree.queryPoint(point);
  }

  /**
   * Find elements within a circular area
   */
  public getElementsInCircle(
    center: Point,
    radius: number,
  ): ExcalidrawElement[] {
    return this.quadtree.queryCircle(center, radius);
  }

  /**
   * Get spatial index statistics
   */
  public getStats() {
    return this.quadtree.getStats();
  }

  /**
   * Clear the spatial index
   */
  public clear(): void {
    this.quadtree.clear();
    this.elementsMap.clear();
  }
}

// Global spatial index instance
export const spatialIndex = new SpatialIndex();
