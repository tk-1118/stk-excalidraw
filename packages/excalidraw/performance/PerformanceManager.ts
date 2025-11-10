import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";
import type { AppState } from "../types";

import { frameCache } from "../cache/FrameCache";
import { enhancedShapeCache } from "../cache/SmartShapeCache";
import { spatialIndex } from "../spatial/Quadtree";
import { frameAwareVisibilityManager } from "../visibility/VisibilityManager";
import { memoryManager } from "../memory/MemoryManager";

/**
 * Performance optimization: Unified Performance Management System
 *
 * This is the central orchestrator for all performance optimizations:
 * 1. Coordinates between different optimization systems
 * 2. Provides unified performance monitoring and metrics
 * 3. Adapts optimization strategies based on real-time performance
 * 4. Manages performance budgets and priorities
 * 5. Provides performance profiling and debugging tools
 */

interface PerformanceMetrics {
  frameRate: number;
  renderTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  spatialQueryTime: number;
  visibilityCalculationTime: number;
  batchProcessingEfficiency: number;
  overallPerformanceScore: number;
}

interface PerformanceConfig {
  enableFrameCache: boolean;
  enableSmartShapeCache: boolean;
  enableSpatialIndex: boolean;
  enableBatchProcessing: boolean;
  enableMemoryManagement: boolean;
  adaptiveOptimization: boolean;
  performanceBudget: number; // ms per frame
  qualityLevel: "low" | "medium" | "high" | "ultra";
}

interface PerformanceProfile {
  name: string;
  description: string;
  config: PerformanceConfig;
  targetDeviceClass: "low-end" | "mid-range" | "high-end";
}

export class PerformanceManager {
  private config: PerformanceConfig;
  private metrics: PerformanceMetrics;
  private frameTimeHistory: number[] = [];
  private performanceObservers: Array<(metrics: PerformanceMetrics) => void> =
    [];
  private lastOptimizationTime = 0;
  private isProfilingEnabled = false;
  private profilingData: Map<string, number[]> = new Map();

  private readonly DEFAULT_CONFIG: PerformanceConfig = {
    enableFrameCache: true,
    enableSmartShapeCache: true,
    enableSpatialIndex: true,
    enableBatchProcessing: true,
    enableMemoryManagement: true,
    adaptiveOptimization: true,
    performanceBudget: 16.67, // 60fps
    qualityLevel: "high",
  };

  private readonly PERFORMANCE_PROFILES: PerformanceProfile[] = [
    {
      name: "Low-End Device",
      description: "Optimized for devices with limited CPU and memory",
      config: {
        ...this.DEFAULT_CONFIG,
        qualityLevel: "low",
        performanceBudget: 33.33, // 30fps
      },
      targetDeviceClass: "low-end",
    },
    {
      name: "Mid-Range Device",
      description: "Balanced performance and quality",
      config: {
        ...this.DEFAULT_CONFIG,
        qualityLevel: "medium",
        performanceBudget: 20, // 50fps
      },
      targetDeviceClass: "mid-range",
    },
    {
      name: "High-End Device",
      description: "Maximum quality and performance",
      config: {
        ...this.DEFAULT_CONFIG,
        qualityLevel: "ultra",
        performanceBudget: 8.33, // 120fps
      },
      targetDeviceClass: "high-end",
    },
  ];

  constructor(config?: Partial<PerformanceConfig>) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    this.metrics = this.initializeMetrics();
    this.setupPerformanceMonitoring();
    this.detectAndApplyOptimalProfile();
  }

  /**
   * Initialize the performance management system
   */
  public initialize(): void {
    console.log("🚀 Initializing Performance Manager");

    // Setup memory monitoring
    memoryManager.addMemoryObserver((memoryStats) => {
      this.metrics.memoryUsage = memoryStats.usedJSHeapSize / (1024 * 1024); // MB
      this.handleMemoryPressure(memoryStats);
    });

    // Setup periodic optimization
    setInterval(() => {
      this.performPeriodicOptimization();
    }, 5000); // Every 5 seconds

    // Setup frame rate monitoring
    this.startFrameRateMonitoring();

    console.log("✅ Performance Manager initialized");
  }

  /**
   * Process frame rendering with all optimizations
   */
  public processFrameRendering(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    elementsMap: Map<string, ExcalidrawElement>,
  ): {
    visibleElements: ExcalidrawElement[];
    renderingInstructions: RenderingInstruction[];
    performanceStats: Partial<PerformanceMetrics>;
  } {
    const startTime = performance.now();
    const stats: Partial<PerformanceMetrics> = {};

    // 1. Update spatial index
    if (this.config.enableSpatialIndex) {
      const spatialStartTime = performance.now();
      spatialIndex.update(Array.from(elements), elementsMap);
      stats.spatialQueryTime = performance.now() - spatialStartTime;
    }

    // 2. Calculate visibility with frame awareness
    const visibilityStartTime = performance.now();
    const visibleElements = this.config.enableSpatialIndex
      ? frameAwareVisibilityManager.getVisibleElementsWithFrameOptimization(
          elements,
          appState,
          elementsMap,
        )
      : Array.from(elements).filter((el) => !el.isDeleted);
    stats.visibilityCalculationTime = performance.now() - visibilityStartTime;

    // 3. Generate optimized rendering instructions
    const renderingInstructions = this.generateRenderingInstructions(
      visibleElements,
      appState,
      elementsMap,
    );

    // 4. Update metrics
    const totalTime = performance.now() - startTime;
    this.updateMetrics({
      renderTime: totalTime,
      ...stats,
    });

    return {
      visibleElements,
      renderingInstructions,
      performanceStats: stats,
    };
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance configuration
   */
  public getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Update performance configuration
   */
  public updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.applyConfigurationChanges();
  }

  /**
   * Apply a performance profile
   */
  public applyProfile(profileName: string): boolean {
    const profile = this.PERFORMANCE_PROFILES.find(
      (p) => p.name === profileName,
    );
    if (!profile) {
      console.warn(`Performance profile "${profileName}" not found`);
      return false;
    }

    this.updateConfig(profile.config);
    console.log(`Applied performance profile: ${profileName}`);
    return true;
  }

  /**
   * Get available performance profiles
   */
  public getAvailableProfiles(): PerformanceProfile[] {
    return [...this.PERFORMANCE_PROFILES];
  }

  /**
   * Add performance observer
   */
  public addPerformanceObserver(
    observer: (metrics: PerformanceMetrics) => void,
  ): void {
    this.performanceObservers.push(observer);
  }

  /**
   * Remove performance observer
   */
  public removePerformanceObserver(
    observer: (metrics: PerformanceMetrics) => void,
  ): void {
    const index = this.performanceObservers.indexOf(observer);
    if (index > -1) {
      this.performanceObservers.splice(index, 1);
    }
  }

  /**
   * Start performance profiling
   */
  public startProfiling(): void {
    this.isProfilingEnabled = true;
    this.profilingData.clear();
    console.log("🔍 Performance profiling started");
  }

  /**
   * Stop performance profiling and get results
   */
  public stopProfiling(): Map<string, number[]> {
    this.isProfilingEnabled = false;
    console.log("⏹️ Performance profiling stopped");
    return new Map(this.profilingData);
  }

  /**
   * Optimize performance based on current conditions
   */
  public optimize(): void {
    if (!this.config.adaptiveOptimization) return;

    const now = Date.now();
    if (now - this.lastOptimizationTime < 1000) return; // Throttle optimization

    this.lastOptimizationTime = now;

    // Analyze current performance
    const avgFrameTime = this.getAverageFrameTime();
    const isUnderPerforming = avgFrameTime > this.config.performanceBudget;

    if (isUnderPerforming) {
      this.applyPerformanceOptimizations();
    } else if (avgFrameTime < this.config.performanceBudget * 0.7) {
      this.relaxOptimizations();
    }
  }

  /**
   * Generate optimized rendering instructions
   */
  private generateRenderingInstructions(
    visibleElements: ExcalidrawElement[],
    appState: AppState,
    elementsMap: Map<string, ExcalidrawElement>,
  ): RenderingInstruction[] {
    const instructions: RenderingInstruction[] = [];

    // Group elements by type and frame for batch processing
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

    // Generate instructions for non-framed elements
    instructions.push({
      type: "render_elements",
      elements: nonFramedElements,
      useCache: this.config.enableSmartShapeCache,
      batchProcess: this.config.enableBatchProcessing,
    });

    // Generate instructions for framed elements
    for (const [frameId, frameElements] of frameGroups) {
      const frame = elementsMap.get(frameId) as ExcalidrawFrameLikeElement;
      if (frame) {
        instructions.push({
          type: "render_frame",
          frame,
          elements: frameElements,
          useCompositeCache: this.config.enableFrameCache,
          useBatchProcessing: this.config.enableBatchProcessing,
        });
      }
    }

    return instructions;
  }

  /**
   * Initialize performance metrics
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      frameRate: 60,
      renderTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      spatialQueryTime: 0,
      visibilityCalculationTime: 0,
      batchProcessingEfficiency: 0,
      overallPerformanceScore: 100,
    };
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // Monitor performance every second
    setInterval(() => {
      this.updatePerformanceScore();
      this.notifyObservers();
    }, 1000);
  }

  /**
   * Start frame rate monitoring
   */
  private startFrameRateMonitoring(): void {
    let lastTime = performance.now();
    let frameCount = 0;

    const measureFrameRate = () => {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;

      frameCount++;

      if (deltaTime >= 1000) {
        // Update every second
        this.metrics.frameRate = (frameCount * 1000) / deltaTime;
        this.frameTimeHistory.push(deltaTime / frameCount);

        // Keep only last 60 measurements (1 minute of history)
        if (this.frameTimeHistory.length > 60) {
          this.frameTimeHistory.shift();
        }

        frameCount = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(measureFrameRate);
    };

    requestAnimationFrame(measureFrameRate);
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(updates: Partial<PerformanceMetrics>): void {
    Object.assign(this.metrics, updates);

    // Update cache hit rates
    if (this.config.enableSmartShapeCache) {
      const cacheMetrics = enhancedShapeCache.getMetrics();
      this.metrics.cacheHitRate =
        cacheMetrics.hitCount /
          (cacheMetrics.hitCount + cacheMetrics.missCount) || 0;
    }

    // Profile data if enabled
    if (this.isProfilingEnabled) {
      Object.entries(updates).forEach(([key, value]) => {
        if (typeof value === "number") {
          if (!this.profilingData.has(key)) {
            this.profilingData.set(key, []);
          }
          this.profilingData.get(key)!.push(value);
        }
      });
    }
  }

  /**
   * Update overall performance score
   */
  private updatePerformanceScore(): void {
    const frameRateScore = Math.min(100, (this.metrics.frameRate / 60) * 100);
    const renderTimeScore = Math.max(
      0,
      100 - (this.metrics.renderTime / this.config.performanceBudget) * 100,
    );
    const memoryScore = Math.max(
      0,
      100 - (this.metrics.memoryUsage / 100) * 100,
    ); // Assuming 100MB is poor
    const cacheScore = this.metrics.cacheHitRate * 100;

    this.metrics.overallPerformanceScore =
      frameRateScore * 0.3 +
      renderTimeScore * 0.3 +
      memoryScore * 0.2 +
      cacheScore * 0.2;
  }

  /**
   * Get average frame time
   */
  private getAverageFrameTime(): number {
    if (this.frameTimeHistory.length === 0) return 0;
    return (
      this.frameTimeHistory.reduce((sum, time) => sum + time, 0) /
      this.frameTimeHistory.length
    );
  }

  /**
   * Apply performance optimizations when underperforming
   */
  private applyPerformanceOptimizations(): void {
    console.log("📉 Performance below target, applying optimizations");

    // Reduce quality level
    if (this.config.qualityLevel === "ultra") {
      this.config.qualityLevel = "high";
    } else if (this.config.qualityLevel === "high") {
      this.config.qualityLevel = "medium";
    } else if (this.config.qualityLevel === "medium") {
      this.config.qualityLevel = "low";
    }

    // Enable aggressive caching
    this.config.enableFrameCache = true;
    this.config.enableSmartShapeCache = true;

    // Optimize caches
    enhancedShapeCache.optimize();
    memoryManager.handleMemoryPressure();
  }

  /**
   * Relax optimizations when performing well
   */
  private relaxOptimizations(): void {
    console.log("📈 Performance above target, relaxing optimizations");

    // Increase quality level gradually
    if (this.config.qualityLevel === "low") {
      this.config.qualityLevel = "medium";
    } else if (this.config.qualityLevel === "medium") {
      this.config.qualityLevel = "high";
    } else if (this.config.qualityLevel === "high") {
      this.config.qualityLevel = "ultra";
    }
  }

  /**
   * Detect optimal performance profile based on device capabilities
   */
  private detectAndApplyOptimalProfile(): void {
    // Simple device detection based on available memory and CPU cores
    const memory = (navigator as any).deviceMemory || 4; // GB
    const cores = navigator.hardwareConcurrency || 4;

    let optimalProfile: PerformanceProfile;

    if (memory >= 8 && cores >= 8) {
      optimalProfile = this.PERFORMANCE_PROFILES[2]; // High-end
    } else if (memory >= 4 && cores >= 4) {
      optimalProfile = this.PERFORMANCE_PROFILES[1]; // Mid-range
    } else {
      optimalProfile = this.PERFORMANCE_PROFILES[0]; // Low-end
    }

    this.updateConfig(optimalProfile.config);
    console.log(`🎯 Auto-detected optimal profile: ${optimalProfile.name}`);
  }

  /**
   * Apply configuration changes to all systems
   */
  private applyConfigurationChanges(): void {
    // This would integrate with all optimization systems
    console.log("⚙️ Applying performance configuration changes");
  }

  /**
   * Handle memory pressure
   */
  private handleMemoryPressure(memoryStats: any): void {
    const memoryPressure = memoryManager.getMemoryPressureLevel();

    if (
      memoryPressure.level === "high" ||
      memoryPressure.level === "critical"
    ) {
      // Reduce quality and enable aggressive cleanup
      this.config.qualityLevel = "low";
      frameCache.clear();
      enhancedShapeCache.clear();
    }
  }

  /**
   * Perform periodic optimization
   */
  private performPeriodicOptimization(): void {
    this.optimize();

    // Cleanup caches periodically
    memoryManager.optimizeCache();
    enhancedShapeCache.optimize();
  }

  /**
   * Notify performance observers
   */
  private notifyObservers(): void {
    this.performanceObservers.forEach((observer) => {
      try {
        observer(this.metrics);
      } catch (error) {
        console.error("Performance observer error:", error);
      }
    });
  }
}

/**
 * Rendering instruction interface
 */
interface RenderingInstruction {
  type: "render_elements" | "render_frame";
  elements: ExcalidrawElement[];
  frame?: ExcalidrawFrameLikeElement;
  useCache?: boolean;
  useCompositeCache?: boolean;
  batchProcess?: boolean;
  useBatchProcessing?: boolean;
}

// Global performance manager instance
export const performanceManager = new PerformanceManager();

// Auto-initialize on import
performanceManager.initialize();
