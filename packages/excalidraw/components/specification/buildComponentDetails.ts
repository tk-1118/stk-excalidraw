import { getFrameChildren } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";

/**
 * 元素树节点接口
 * 用于表示元素的层级结构关系
 */
interface ElementTreeNode {
  element: ExcalidrawElement;
  children: ElementTreeNode[];
  depth: number;
}

/**
 * 布局节点接口（精简版）
 * 仅包含对布局/生成有帮助的字段
 */
interface LayoutNode {
  id: string;
  type: string;
  depth: number;
  siblingIndex: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation?: number;
  textContent?: string;
  points?: number[][];
  groupIds?: string[];
  role?: string; // 来自 customData.componentMapping（如存在）
  customData?: Partial<{
    componentPurpose: string;
    componentUserOperation: string;
    componentOperationResult: string;
    componentServerInteraction: string;
    componentSpecialRequirements: string;
    componentMapping: string;
  }>;
  children: LayoutNode[];
}

/**
 * 将数值保留指定小数位数
 * @param value 需要处理的数值
 * @param digits 保留的小数位数，默认为2位
 * @returns 处理后的数值或undefined
 */
function toFixedNumber(
  value: number | undefined,
  digits: number = 2,
): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }
  return Number(value.toFixed(digits));
}

/**
 * 提取有意义的自定义数据
 * @param raw 原始数据对象
 * @returns 精简后的自定义数据或undefined
 */
function pickMeaningfulCustomData(
  raw: any,
): LayoutNode["customData"] | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const picked: Record<string, any> = {};
  const keys = [
    "componentPurpose",
    "componentUserOperation",
    "componentOperationResult",
    "componentServerInteraction",
    "componentSpecialRequirements",
    "componentMapping",
  ];
  for (const key of keys) {
    if (raw[key] != null) {
      picked[key] = raw[key];
    }
  }
  return Object.keys(picked).length
    ? (picked as LayoutNode["customData"])
    : undefined;
}

/**
 * 移除元素中的布局属性，提取关键信息
 * @param element 原始元素对象
 * @returns 精简后的布局节点（不含children、depth、siblingIndex）
 */
function stripLayoutAttributes(
  element: ExcalidrawElement,
): Omit<LayoutNode, "children" | "depth" | "siblingIndex"> {
  const anyEl = element as any;
  const id = anyEl.id as string;
  const type = anyEl.type as string;
  const x = toFixedNumber(anyEl.x, 2) ?? 0;
  const y = toFixedNumber(anyEl.y, 2) ?? 0;
  const width = toFixedNumber(anyEl.width, 2) ?? 0;
  const height = toFixedNumber(anyEl.height, 2) ?? 0;
  const rotation = toFixedNumber(anyEl.angle, 4);

  const textContent: string | undefined =
    typeof anyEl.text === "string" ? anyEl.text : undefined;
  const groupIds: string[] | undefined = Array.isArray(anyEl.groupIds)
    ? [...anyEl.groupIds]
    : undefined;

  let points: number[][] | undefined;
  if (Array.isArray(anyEl.points)) {
    points = anyEl.points.map((pt: any) => {
      const px = toFixedNumber(pt?.[0], 2) ?? 0;
      const py = toFixedNumber(pt?.[1], 2) ?? 0;
      return [px, py];
    });
  }

  const customData = pickMeaningfulCustomData(anyEl.customData);
  const role =
    typeof anyEl?.customData?.componentMapping === "string"
      ? anyEl.customData.componentMapping
      : undefined;

  return {
    id,
    type,
    position: { x, y },
    size: { width, height },
    rotation,
    textContent,
    points,
    groupIds,
    role,
    customData,
  };
}

/**
 * 将元素树映射为布局JSON结构
 * @param node 元素树节点
 * @param siblingIndex 兄弟节点索引
 * @returns 布局节点
 */
function mapTreeToLayoutJSON(
  node: ElementTreeNode,
  siblingIndex: number = 0,
): LayoutNode {
  const base = stripLayoutAttributes(node.element);
  const children = node.children.map((child, index) =>
    mapTreeToLayoutJSON(child, index),
  );
  return {
    ...base,
    depth: node.depth,
    siblingIndex,
    children,
  };
}

/**
 * 判断元素是否在另一个元素内部
 * @param inner 内部元素
 * @param outer 外部元素
 * @returns 是否在内部
 */
function isElementInside(
  inner: ExcalidrawElement,
  outer: ExcalidrawElement,
): boolean {
  if (!inner.width || !inner.height || !outer.width || !outer.height) {
    return false;
  }

  if (
    inner.x === outer.x &&
    inner.y === outer.y &&
    inner.width === outer.width &&
    inner.height === outer.height
  ) {
    return false;
  }

  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/**
 * 构建元素层级树
 * @param elements 元素数组
 * @returns 元素树节点数组
 */
function buildElementTree(elements: ExcalidrawElement[]): ElementTreeNode[] {
  const sortedElements = [...elements].sort((a, b) => {
    if (a.y !== b.y) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });

  const root: { children: ElementTreeNode[]; depth: number } = {
    children: [],
    depth: -1,
  };

  function addToTree(
    parentNode: { children: ElementTreeNode[]; depth: number },
    element: ExcalidrawElement,
  ) {
    const candidates = parentNode.children.filter((child) =>
      isElementInside(element, child.element),
    );

    if (candidates.length === 0) {
      parentNode.children.push({
        element,
        children: [],
        depth: parentNode.depth + 1,
      });
      return;
    }

    let deepestParent = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i].depth > deepestParent.depth) {
        deepestParent = candidates[i];
      }
    }

    addToTree(deepestParent, element);
  }

  sortedElements.forEach((element) => {
    addToTree(root, element);
  });

  return root.children;
}

/**
 * 构建简化树（只保留有customData的节点）
 * @param originalTree 原始元素树
 * @returns 简化后的元素树
 */
function buildSimplifiedTree(
  originalTree: ElementTreeNode[],
): ElementTreeNode[] {
  function filterNode(node: ElementTreeNode): ElementTreeNode | null {
    const hasCustomData =
      (node.element as any).customData !== undefined &&
      (node.element as any).customData !== null;

    const filteredChildren: ElementTreeNode[] = [];
    for (const child of node.children) {
      const filteredChild = filterNode(child);
      if (filteredChild) {
        filteredChildren.push(filteredChild);
      }
    }

    if (hasCustomData || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren,
      };
    }

    return null;
  }

  const simplifiedRoots: ElementTreeNode[] = [];
  for (const rootNode of originalTree) {
    const filteredRoot = filterNode(rootNode);
    if (filteredRoot) {
      simplifiedRoots.push(filteredRoot);
    }
  }

  return simplifiedRoots;
}

/**
 * 生成语义化树结构描述
 * @param node 元素树节点
 * @param level 当前层级
 * @returns 语义化描述字符串
 */
function generateSemanticTree(
  node: ElementTreeNode,
  level: number = 0,
): string {
  const indent = "  ".repeat(level);
  const hasChildren = node.children && node.children.length > 0;
  const customData: any = (node.element as any).customData || {};
  const el: any = node.element as any;

  // helpers
  const toNumber2 = (value: any): number | null => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return null;
    }
    return Math.round(value * 100) / 100;
  };

  const normalizeStrokeStyle = (style: any): string | null => {
    if (style === "dashed") {
      return "虚线";
    }
    if (style === "dotted") {
      return "点线";
    }
    if (style === "solid") {
      return "实线";
    }
    return style ? "实线" : null;
  };

  const normalizeSharpness = (s: any): string | null => {
    if (s === "sharp") {
      return "直角";
    }
    if (s === "round") {
      return "圆角";
    }
    return null;
  };

  const normalizeTextAlign = (a: any): string | null => {
    if (a === "left") {
      return "左对齐";
    }
    if (a === "center") {
      return "居中";
    }
    if (a === "right") {
      return "右对齐";
    }
    if (a === "justify") {
      return "两端对齐";
    }
    return null;
  };

  const normalizeVerticalAlign = (a: any): string | null => {
    if (a === "top") {
      return "顶部";
    }
    if (a === "middle") {
      return "居中";
    }
    if (a === "bottom") {
      return "底部";
    }
    return null;
  };

  const normalizeArrowhead = (a: any): string | null => {
    if (a === "arrow") {
      return "箭头";
    }
    if (a === "bar") {
      return "条形";
    }
    if (a === "dot") {
      return "圆点";
    }
    if (a === "none") {
      return "无";
    }
    if (!a) {
      return "无";
    }
    return null;
  };

  // computed
  const angleDeg = toNumber2(
    typeof el.angle === "number" ? (el.angle * 180) / Math.PI : null,
  );
  const roughness = toNumber2(el.roughness);
  const opacity = toNumber2(el.opacity);
  const strokeWidth = toNumber2(el.strokeWidth);

  // human-friendly section
  const strokeStyleLabel = normalizeStrokeStyle(el.strokeStyle);
  const strokeSharpnessLabel = normalizeSharpness(el.strokeSharpness);

  const componentInfo = [
    `${indent}组件: type=${el.type ?? "unknown"}, id=${
      el.id ?? "unknown"
    }, 层级=${level + 1}`,
    `${indent}语义: 用途=${customData.componentPurpose || "无描述"}，用户操作=${
      customData.componentUserOperation || "无描述"
    }，结果=${customData.componentOperationResult || "无描述"}，服务端交互=${
      customData.componentServerInteraction || "无描述"
    }，特殊要求=${customData.componentSpecialRequirements || "无描述"}`,
    `${indent}UI库: 映射=${customData.componentMapping || "无描述"}`,
    `${indent}布局(px): x=${toNumber2(el.x) ?? 0}, y=${
      toNumber2(el.y) ?? 0
    }, w=${toNumber2(el.width) ?? 0}, h=${toNumber2(el.height) ?? 0}, 角度=${
      angleDeg ?? 0
    }°`,
    `${indent}样式: 背景=${el.backgroundColor ?? "默认"}，透明度=${
      opacity ?? 1
    }，粗糙度=${roughness ?? 1}，锁定=${!!el.locked}`,
    `${indent}  - 描边: 颜色=${el.strokeColor ?? "默认"}，宽度=${
      strokeWidth ?? 1
    }px，样式=${strokeStyleLabel ?? "默认"}，边角=${
      strokeSharpnessLabel ?? "默认"
    }`,
    ...(el.type === "text"
      ? [
          `${indent}文本: "${el.text ?? ""}"`,
          `${indent}  - 字体: 大小=${toNumber2(el.fontSize) ?? 16}px，类型=${
            el.fontFamily ?? "默认"
          }`,
          `${indent}  - 对齐: 水平=${
            normalizeTextAlign(el.textAlign) ?? "左对齐"
          }，垂直=${normalizeVerticalAlign(el.verticalAlign) ?? "顶部"}`,
        ]
      : []),
    ...(el.type === "arrow"
      ? [
          `${indent}箭头: 起点=${
            normalizeArrowhead(el.startArrowhead) ?? "无"
          }，终点=${normalizeArrowhead(el.endArrowhead) ?? "无"}`,
        ]
      : []),
    `${indent}关系: 分组=${
      Array.isArray(el.groupIds) ? el.groupIds.length : 0
    } 个，frameId=${el.frameId ?? "无"}，子组件=${
      node.children?.length ?? 0
    } 个`,
  ].join("\n");

  let childrenInfo = "";
  if (hasChildren) {
    childrenInfo = `\n  子组件=>  \n${node.children
      .map((child) => generateSemanticTree(child, level + 1))
      .join("\n")}`;
  }

  return `${componentInfo}${childrenInfo}`;
}

/**
 * 构建组件详情（第一种方式：按 customData 过滤，生成语义化描述）
 * @param elements 元素数组
 * @param frame 框架元素
 * @returns 语义化描述字符串
 */
export function buildComponentDetails(
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameLikeElement,
): string {
  // 获取frame内的所有子元素
  const frameChildren = getFrameChildren(elements, frame.id);

  // 包含frame本身和所有子元素
  const allElements = [frame, ...frameChildren] as ExcalidrawElement[];

  // 构建元素层级树
  const elementTree = buildElementTree(allElements);

  // 构建精简树（只包含有customData的节点）
  // const simplifiedTree = buildSimplifiedTree(elementTree);

  // 生成语义化描述
  if (elementTree.length > 0) {
    const semanticDescription = elementTree
      .map((node) => generateSemanticTree(node))
      .join("\n\n");
    return semanticDescription;
  }

  return (
    "当前frame及其子元素中没有找到包含customData的组件。\n\n" +
    "请为相关元素添加组件描述信息：\n" +
    "- componentPurpose: 组件用途\n" +
    "- componentUserOperation: 用户操作\n" +
    "- componentOperationResult: 操作结果\n" +
    "- componentServerInteraction: 服务端交互\n" +
    "- componentSpecialRequirements: 特殊要求\n" +
    "- componentMapping: UI库映射"
  );
}

/**
 * 构建组件布局JSON（第二种方式：不按 customData 过滤，基于全量元素生成"精简布局 JSON"）
 * @param elements 元素数组
 * @param frame 框架元素
 * @param pretty 是否格式化输出
 * @returns 布局JSON字符串
 */
export function buildComponentLayoutJSON(
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameLikeElement,
  pretty: boolean = true,
): string {
  const frameChildren = getFrameChildren(elements, frame.id);
  const allElements = [frame, ...frameChildren] as ExcalidrawElement[];

  const elementTree = buildElementTree(allElements);
  const layoutForest = elementTree.map((node, index) =>
    mapTreeToLayoutJSON(node, index),
  );

  return JSON.stringify(layoutForest, null, pretty ? 2 : 0);
}

/**
 * 语义化节点V2接口
 * 更语义化且更精简的JSON结构
 */
interface SemanticNodeV2 {
  id: string;
  as?: string; // UI 组件/标签映射
  role?: string; // 组件语义角色（来源于 componentMapping）
  text?: string; // 文本类元素内容
  layout: {
    position: "absolute";
    x: number;
    y: number;
    w: number;
    h: number;
    rotate?: number;
    order: number; // 同级顺序
  };
  geometry?: {
    points?: number[][]; // 线/多边形等
  };
  intent?: {
    purpose?: string;
    userOperation?: string;
    operationResult?: string;
    serverInteraction?: string;
    specialRequirements?: string;
  };
  children: SemanticNodeV2[];
}

/**
 * 转换为语义化节点V2
 * @param node 元素树节点
 * @param siblingIndex 兄弟节点索引
 * @returns 语义化节点V2
 */
function toSemanticNodeV2(
  node: ElementTreeNode,
  siblingIndex: number,
): SemanticNodeV2 {
  const anyEl = node.element as any;
  const x = toFixedNumber(anyEl.x, 2) ?? 0;
  const y = toFixedNumber(anyEl.y, 2) ?? 0;
  const w = toFixedNumber(anyEl.width, 2) ?? 0;
  const h = toFixedNumber(anyEl.height, 2) ?? 0;
  const rotate = toFixedNumber(anyEl.angle, 4);

  const text = typeof anyEl.text === "string" ? anyEl.text : undefined;
  const role =
    typeof anyEl?.customData?.componentMapping === "string"
      ? anyEl.customData.componentMapping
      : undefined;
  const as = role || (typeof anyEl.type === "string" ? anyEl.type : undefined);

  let points: number[][] | undefined;
  if (Array.isArray(anyEl.points)) {
    points = anyEl.points.map((pt: any) => {
      const px = toFixedNumber(pt?.[0], 2) ?? 0;
      const py = toFixedNumber(pt?.[1], 2) ?? 0;
      return [px, py];
    });
  }

  const intent = ((): SemanticNodeV2["intent"] => {
    const cd = anyEl.customData || {};
    const picked: SemanticNodeV2["intent"] = {};
    if (cd.componentPurpose) {
      picked.purpose = cd.componentPurpose;
    }
    if (cd.componentUserOperation) {
      picked.userOperation = cd.componentUserOperation;
    }
    if (cd.componentOperationResult) {
      picked.operationResult = cd.componentOperationResult;
    }
    if (cd.componentServerInteraction) {
      picked.serverInteraction = cd.componentServerInteraction;
    }
    if (cd.componentSpecialRequirements) {
      picked.specialRequirements = cd.componentSpecialRequirements;
    }
    return Object.keys(picked).length ? picked : undefined;
  })();

  return {
    id: String(anyEl.id ?? ""),
    as,
    role,
    text,
    layout: {
      position: "absolute",
      x,
      y,
      w,
      h,
      rotate,
      order: siblingIndex,
    },
    geometry: points ? { points } : undefined,
    intent,
    children: node.children.map((child, idx) => toSemanticNodeV2(child, idx)),
  };
}

/**
 * 构建组件布局V2（更语义化且更精简的JSON）
 * @param elements 元素数组
 * @param frame 框架元素
 * @param pretty 是否格式化输出
 * @returns 布局V2 JSON字符串
 */
export function buildComponentLayoutV2(
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameLikeElement,
  pretty: boolean = true,
): string {
  const frameChildren = getFrameChildren(elements, frame.id);
  const allElements = [frame, ...frameChildren] as ExcalidrawElement[];
  const elementTree = buildElementTree(allElements);

  // 语义化输出使用单一根（frame）优先；如存在多个顶层节点则全部输出
  const v2Forest = elementTree.map((node, index) =>
    toSemanticNodeV2(node, index),
  );
  const result = {
    version: "layout.v2",
    nodes: v2Forest,
  };
  return JSON.stringify(result, null, pretty ? 2 : 0);
}