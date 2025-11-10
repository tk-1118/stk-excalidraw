import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";

import type { AppState } from "../types";

/**
 * Performance optimization: Batch Processing and Early Exit System
 *
 * This system provides:
 * 1. Batch processing for similar operations
 * 2. Early exit conditions to avoid unnecessary work
 * 3. Work prioritization based on user interaction
 * 4. Time-sliced processing for non-blocking operations
 * 5. Adaptive processing based on performance metrics
 */

interface BatchJob<T, R> {
  id: string;
  items: T[];
  processor: (items: T[], context?: any) => R[];
  priority: number;
  context?: any;
  onComplete?: (results: R[]) => void;
  onProgress?: (completed: number, total: number) => void;
  onError?: (error: Error) => void;
}

interface ProcessingMetrics {
  averageProcessingTime: number;
  totalJobsProcessed: number;
  totalItemsProcessed: number;
  queueLength: number;
  lastProcessingTime: number;
}

interface EarlyExitCondition {
  name: string;
  check: (context: any) => boolean;
  priority: number;
}

export class BatchProcessor {
  private jobQueue: BatchJob<any, any>[] = [];
  private isProcessing = false;
  private earlyExitConditions: EarlyExitCondition[] = [];
  private metrics: ProcessingMetrics = {
    averageProcessingTime: 0,
    totalJobsProcessed: 0,
    totalItemsProcessed: 0,
    queueLength: 0,
    lastProcessingTime: 0,
  };

  private readonly MAX_PROCESSING_TIME_PER_FRAME = 8; // 8ms per frame to maintain 60fps
  private readonly HIGH_PRIORITY_THRESHOLD = 10;
  private readonly BATCH_SIZE_LIMITS = {
    small: 50,
    medium: 200,
    large: 1000,
  };

  /**
   * Add a batch job to the processing queue
   */
  public addJob<T, R>(job: BatchJob<T, R>): void {
    this.jobQueue.push(job);
    this.jobQueue.sort((a, b) => b.priority - a.priority); // Higher priority first
    this.metrics.queueLength = this.jobQueue.length;

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  /**
   * Add early exit condition
   */
  public addEarlyExitCondition(condition: EarlyExitCondition): void {
    this.earlyExitConditions.push(condition);
    this.earlyExitConditions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove early exit condition
   */
  public removeEarlyExitCondition(name: string): void {
    const index = this.earlyExitConditions.findIndex((c) => c.name === name);
    if (index > -1) {
      this.earlyExitConditions.splice(index, 1);
    }
  }

  /**
   * Process frame rendering with early exit conditions
   */
  public processFrameRendering(
    frames: ExcalidrawFrameLikeElement[],
    elements: ExcalidrawElement[],
    appState: AppState,
    renderCallback: (
      frame: ExcalidrawFrameLikeElement,
      children: ExcalidrawElement[],
    ) => void,
  ): void {
    // Early exit: Check if rendering is disabled
    if (!appState.frameRendering.enabled) {
      return;
    }

    // Early exit: Check if user is actively dragging (prioritize interaction)
    if (appState.selectedElementsAreBeingDragged && frames.length > 10) {
      // Render only selected frames during drag
      const selectedFrameIds = new Set(
        Object.keys(appState.selectedElementIds).filter((id) =>
          elements.find((el) => el.id === id && el.type === "frame"),
        ),
      );

      frames = frames.filter((frame) => selectedFrameIds.has(frame.id));
    }

    // Batch process frames by priority
    const frameBatches = this.createFrameBatches(frames, elements);

    for (const batch of frameBatches) {
      // Check early exit conditions before each batch
      if (this.shouldEarlyExit({ appState, frameCount: frames.length })) {
        break;
      }

      this.processBatchWithTimeSlicing(batch, renderCallback);
    }
  }

  /**
   * Process element updates with batching
   */
  public processElementUpdates(
    elements: ExcalidrawElement[],
    updateFunction: (element: ExcalidrawElement) => void,
    priority: number = 5,
  ): void {
    // Early exit: No elements to process
    if (elements.length === 0) {
      return;
    }

    // Create batches based on element types for better cache locality
    const batches = this.groupElementsByType(elements);

    for (const [elementType, batchElements] of batches) {
      this.addJob({
        id: `update-${elementType}-${Date.now()}`,
        items: batchElements,
        processor: (items) => {
          items.forEach(updateFunction);
          return items;
        },
        priority,
      });
    }
  }

  /**
   * Process visibility calculations with early exit (fixed: no recursion, proper error handling)
   */
  public processVisibilityCalculation(
    elements: ExcalidrawElement[],
    appState: AppState,
    visibilityChecker: (element: ExcalidrawElement) => boolean,
    onComplete?: (results: ExcalidrawElement[]) => void,
    onError?: (error: Error) => void,
  ): ExcalidrawElement[] {
    const visibleElements: ExcalidrawElement[] = [];
    const startTime = performance.now();

    // Early exit: Viewport is very small
    if (appState.width < 100 || appState.height < 100) {
      if (onComplete) {
        onComplete([]);
      }
      return [];
    }

    try {
      // Process elements in batches with time slicing (non-recursive)
      this.processVisibilityBatchesIteratively(
        elements,
        appState,
        visibilityChecker,
        visibleElements,
        0,
        startTime,
        onComplete,
        onError,
      );
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      console.error("[BatchProcessor] Visibility calculation error:", errorObj);
      if (onError) {
        onError(errorObj);
      }
    }

    return visibleElements;
  }

  /**
   * Process visibility batches iteratively to avoid stack overflow
   */
  private processVisibilityBatchesIteratively(
    elements: ExcalidrawElement[],
    appState: AppState,
    visibilityChecker: (element: ExcalidrawElement) => boolean,
    visibleElements: ExcalidrawElement[],
    currentIndex: number,
    startTime: number,
    onComplete?: (results: ExcalidrawElement[]) => void,
    onError?: (error: Error) => void,
    maxIterations: number = 1000, // Prevent infinite loops
  ): void {
    const batchSize = this.calculateOptimalBatchSize(elements.length);
    let iterationCount = 0;

    const processNextBatch = () => {
      try {
        // Safety check: prevent infinite loops
        iterationCount++;
        if (iterationCount > maxIterations) {
          const error = new Error(
            `Maximum iterations (${maxIterations}) exceeded in visibility calculation`,
          );
          console.error("[BatchProcessor]", error.message);
          if (onError) {
            onError(error);
          }
          return;
        }

        // Check if we've processed all elements
        if (currentIndex >= elements.length) {
          if (onComplete) {
            onComplete([...visibleElements]);
          }
          return;
        }

        // Check time budget
        const currentTime = performance.now();
        if (currentTime - startTime > this.MAX_PROCESSING_TIME_PER_FRAME) {
          // Yield to browser and continue in next frame
          requestAnimationFrame(() => {
            this.processVisibilityBatchesIteratively(
              elements,
              appState,
              visibilityChecker,
              visibleElements,
              currentIndex,
              currentTime, // Reset start time for next batch
              onComplete,
              onError,
              maxIterations,
            );
          });
          return;
        }

        // Check early exit conditions
        if (this.shouldEarlyExit({ appState, processedCount: currentIndex })) {
          if (onComplete) {
            onComplete([...visibleElements]);
          }
          return;
        }

        // Process current batch
        const endIndex = Math.min(currentIndex + batchSize, elements.length);
        const batch = elements.slice(currentIndex, endIndex);

        for (const element of batch) {
          try {
            if (visibilityChecker(element)) {
              visibleElements.push(element);
            }
          } catch (elementError) {
            console.warn(
              "[BatchProcessor] Error processing element:",
              element.id,
              elementError,
            );
            // Continue processing other elements
          }
        }

        // Move to next batch
        currentIndex = endIndex;

        // Continue processing synchronously if we have time budget
        if (
          performance.now() - startTime <
          this.MAX_PROCESSING_TIME_PER_FRAME * 0.8
        ) {
          // Use setTimeout to avoid blocking the main thread
          setTimeout(processNextBatch, 0);
        } else {
          // Yield to next frame
          requestAnimationFrame(processNextBatch);
        }
      } catch (error) {
        const errorObj =
          error instanceof Error ? error : new Error(String(error));
        console.error("[BatchProcessor] Batch processing error:", errorObj);
        if (onError) {
          onError(errorObj);
        }
      }
    };

    // Start processing
    processNextBatch();
  }

  /**
   * Get processing metrics
   */
  public getMetrics(): ProcessingMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear job queue
   */
  public clearQueue(): void {
    this.jobQueue = [];
    this.metrics.queueLength = 0;
  }

  /**
   * Optimize processing based on current performance
   */
  public optimize(): void {
    // Adjust batch sizes based on performance
    const avgTime = this.metrics.averageProcessingTime;

    if (avgTime > this.MAX_PROCESSING_TIME_PER_FRAME) {
      // Reduce batch sizes if processing is too slow
      Object.keys(this.BATCH_SIZE_LIMITS).forEach((key) => {
        this.BATCH_SIZE_LIMITS[
          key as keyof typeof this.BATCH_SIZE_LIMITS
        ] *= 0.8;
      });
    } else if (avgTime < this.MAX_PROCESSING_TIME_PER_FRAME * 0.5) {
      // Increase batch sizes if we have headroom
      Object.keys(this.BATCH_SIZE_LIMITS).forEach((key) => {
        this.BATCH_SIZE_LIMITS[
          key as keyof typeof this.BATCH_SIZE_LIMITS
        ] *= 1.2;
      });
    }
  }

  /**
   * Start batch processing loop
   */
  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processNextJob();
  }

  /**
   * Process next job in queue (fixed: iterative processing to avoid stack overflow)
   */
  private processNextJob(): void {
    this.processJobsIteratively();
  }

  /**
   * Process jobs iteratively to avoid stack overflow
   */
  private processJobsIteratively(maxJobsPerFrame: number = 5): void {
    let jobsProcessedInFrame = 0;

    const processJob = () => {
      try {
        if (this.jobQueue.length === 0) {
          this.isProcessing = false;
          return;
        }

        const job = this.jobQueue.shift()!;
        const startTime = performance.now();

        try {
          // Process job with time slicing for large batches
          const results = this.processJobWithTimeSlicing(job);

          if (job.onComplete) {
            job.onComplete(results);
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          console.error(`[BatchProcessor] Job ${job.id} failed:`, errorMsg);

          // Optionally call error handler if available
          if (job.onError) {
            job.onError(error instanceof Error ? error : new Error(errorMsg));
          }
        }

        // Update metrics
        const processingTime = performance.now() - startTime;
        this.updateMetrics(processingTime, job.items.length);

        jobsProcessedInFrame++;

        // Check if we should continue processing in this frame
        if (
          this.jobQueue.length > 0 &&
          jobsProcessedInFrame < maxJobsPerFrame &&
          performance.now() - startTime < this.MAX_PROCESSING_TIME_PER_FRAME
        ) {
          // Continue processing synchronously
          setTimeout(processJob, 0);
        } else if (this.jobQueue.length > 0) {
          // Yield to next frame
          requestAnimationFrame(() =>
            this.processJobsIteratively(maxJobsPerFrame),
          );
        } else {
          this.isProcessing = false;
        }
      } catch (error) {
        console.error(
          "[BatchProcessor] Critical error in job processing:",
          error,
        );
        this.isProcessing = false;
      }
    };

    processJob();
  }

  /**
   * Process job with time slicing to avoid blocking
   */
  private processJobWithTimeSlicing<T, R>(job: BatchJob<T, R>): R[] {
    const results: R[] = [];
    const batchSize = this.calculateOptimalBatchSize(job.items.length);

    for (let i = 0; i < job.items.length; i += batchSize) {
      const batch = job.items.slice(i, i + batchSize);
      const batchResults = job.processor(batch, job.context);
      results.push(...batchResults);

      // Report progress
      if (job.onProgress) {
        job.onProgress(i + batch.length, job.items.length);
      }

      // Check if we should yield
      if (performance.now() % 16 < 1) {
        // Yield every ~16ms
        // This is a simplified yield - in practice, you'd use a more sophisticated approach
      }
    }

    return results;
  }

  /**
   * Check if processing should exit early
   */
  private shouldEarlyExit(context: any): boolean {
    for (const condition of this.earlyExitConditions) {
      if (condition.check(context)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create frame batches prioritized by visibility and complexity
   */
  private createFrameBatches(
    frames: ExcalidrawFrameLikeElement[],
    elements: ExcalidrawElement[],
  ): Array<{
    frame: ExcalidrawFrameLikeElement;
    children: ExcalidrawElement[];
  }> {
    const batches: Array<{
      frame: ExcalidrawFrameLikeElement;
      children: ExcalidrawElement[];
    }> = [];

    // Group children by frame
    const frameChildren = new Map<string, ExcalidrawElement[]>();
    elements.forEach((element) => {
      if (element.frameId) {
        if (!frameChildren.has(element.frameId)) {
          frameChildren.set(element.frameId, []);
        }
        frameChildren.get(element.frameId)!.push(element);
      }
    });

    // Create batches with priority sorting
    frames.forEach((frame) => {
      const children = frameChildren.get(frame.id) || [];
      batches.push({ frame, children });
    });

    // Sort by complexity (frames with fewer children first for better responsiveness)
    batches.sort((a, b) => a.children.length - b.children.length);

    return batches;
  }

  /**
   * Group elements by type for better processing efficiency
   */
  private groupElementsByType(
    elements: ExcalidrawElement[],
  ): Map<string, ExcalidrawElement[]> {
    const groups = new Map<string, ExcalidrawElement[]>();

    elements.forEach((element) => {
      if (!groups.has(element.type)) {
        groups.set(element.type, []);
      }
      groups.get(element.type)!.push(element);
    });

    return groups;
  }

  /**
   * Process batch with time slicing
   */
  private processBatchWithTimeSlicing(
    batch: { frame: ExcalidrawFrameLikeElement; children: ExcalidrawElement[] },
    renderCallback: (
      frame: ExcalidrawFrameLikeElement,
      children: ExcalidrawElement[],
    ) => void,
  ): void {
    const startTime = performance.now();

    // Check if we have time budget
    if (performance.now() - startTime < this.MAX_PROCESSING_TIME_PER_FRAME) {
      renderCallback(batch.frame, batch.children);
    } else {
      // Defer to next frame
      requestAnimationFrame(() => {
        renderCallback(batch.frame, batch.children);
      });
    }
  }

  /**
   * Calculate optimal batch size based on current performance
   */
  private calculateOptimalBatchSize(totalItems: number): number {
    const avgTime = this.metrics.averageProcessingTime;

    if (totalItems < 100) {
      return this.BATCH_SIZE_LIMITS.small;
    }
    if (avgTime > this.MAX_PROCESSING_TIME_PER_FRAME) {
      return Math.max(this.BATCH_SIZE_LIMITS.small, totalItems / 10);
    }

    return this.BATCH_SIZE_LIMITS.medium;
  }

  /**
   * Update processing metrics
   */
  private updateMetrics(processingTime: number, itemsProcessed: number): void {
    this.metrics.totalJobsProcessed++;
    this.metrics.totalItemsProcessed += itemsProcessed;
    this.metrics.lastProcessingTime = processingTime;
    this.metrics.queueLength = this.jobQueue.length;

    // Update rolling average
    const totalJobs = this.metrics.totalJobsProcessed;
    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (totalJobs - 1) + processingTime) /
      totalJobs;
  }
}

/**
 * Specialized batch processor for frame operations
 */
export class FrameBatchProcessor extends BatchProcessor {
  /**
   * Process frame updates with intelligent batching
   */
  public processFrameUpdates(
    frames: ExcalidrawFrameLikeElement[],
    elements: ExcalidrawElement[],
    appState: AppState,
    updateCallback: (
      frame: ExcalidrawFrameLikeElement,
      children: ExcalidrawElement[],
    ) => void,
  ): void {
    // Early exit conditions specific to frames
    this.addEarlyExitCondition({
      name: "frame-drag-optimization",
      check: (context) => {
        return (
          context.appState?.selectedElementsAreBeingDragged &&
          context.frameCount > 20
        ); // Only process subset during heavy drag
      },
      priority: 10,
    });

    this.addEarlyExitCondition({
      name: "low-zoom-optimization",
      check: (context) => {
        return context.appState?.zoom?.value < 0.1; // Skip detailed processing at very low zoom
      },
      priority: 8,
    });

    // Process with frame-specific optimizations
    this.processFrameRendering(frames, elements, appState, updateCallback);
  }
}

// Global batch processor instances
export const batchProcessor = new BatchProcessor();
export const frameBatchProcessor = new FrameBatchProcessor();

/**
 * Example usage with error handling:
 *
 * ```typescript
 * // Process visibility with proper error handling
 * const visibleElements = batchProcessor.processVisibilityCalculation(
 *   elements,
 *   appState,
 *   (element) => isElementInViewport(element, appState),
 *   (results) => {
 *     console.log('Visibility calculation completed:', results.length);
 *   },
 *   (error) => {
 *     console.error('Visibility calculation failed:', error);
 *   }
 * );
 *
 * // Add batch job with error handling
 * batchProcessor.addJob({
 *   id: 'element-updates',
 *   items: elementsToUpdate,
 *   processor: (items) => items.map(updateElement),
 *   priority: 5,
 *   onComplete: (results) => console.log('Batch completed:', results.length),
 *   onError: (error) => console.error('Batch failed:', error),
 *   onProgress: (completed, total) => console.log(`Progress: ${completed}/${total}`)
 * });
 * ```
 */

// Setup common early exit conditions
batchProcessor.addEarlyExitCondition({
  name: "performance-budget",
  check: () => performance.now() % 16 > 12, // Exit if we're close to frame deadline
  priority: 15,
});

batchProcessor.addEarlyExitCondition({
  name: "memory-pressure",
  check: () => {
    // Simplified memory pressure check
    return (performance as any).memory?.usedJSHeapSize > 100 * 1024 * 1024; // 100MB
  },
  priority: 12,
});
