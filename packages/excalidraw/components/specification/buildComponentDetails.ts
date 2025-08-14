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
  const customData: any = (node.element as any).customData;
  const el: any = node.element as any;

  // helpers
  const toNumber2 = (value: any): number | null => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return null;
    }
    return Math.round(value * 100) / 100;
  };

  // const normalizeStrokeStyle = (style: any): string | null => {
  //   if (style === "dashed") {
  //     return "虚线";
  //   }
  //   if (style === "dotted") {
  //     return "点线";
  //   }
  //   if (style === "solid") {
  //     return "实线";
  //   }
  //   return style ? "实线" : null;
  // };

  // const normalizeSharpness = (s: any): string | null => {
  //   if (s === "sharp") {
  //     return "直角";
  //   }
  //   if (s === "round") {
  //     return "圆角";
  //   }
  //   return null;
  // };

  // const normalizeTextAlign = (a: any): string | null => {
  //   if (a === "left") {
  //     return "左对齐";
  //   }
  //   if (a === "center") {
  //     return "居中";
  //   }
  //   if (a === "right") {
  //     return "右对齐";
  //   }
  //   if (a === "justify") {
  //     return "两端对齐";
  //   }
  //   return null;
  // };

  // const normalizeVerticalAlign = (a: any): string | null => {
  //   if (a === "top") {
  //     return "顶部";
  //   }
  //   if (a === "middle") {
  //     return "居中";
  //   }
  //   if (a === "bottom") {
  //     return "底部";
  //   }
  //   return null;
  // };

  // const normalizeArrowhead = (a: any): string | null => {
  //   if (a === "arrow") {
  //     return "箭头";
  //   }
  //   if (a === "bar") {
  //     return "条形";
  //   }
  //   if (a === "dot") {
  //     return "圆点";
  //   }
  //   if (a === "none") {
  //     return "无";
  //   }
  //   if (!a) {
  //     return "无";
  //   }
  //   return null;
  // };

  // computed
  // const angleDeg = toNumber2(
  //   typeof el.angle === "number" ? (el.angle * 180) / Math.PI : null,
  // );
  // const roughness = toNumber2(el.roughness);
  // const opacity = toNumber2(el.opacity);
  // const strokeWidth = toNumber2(el.strokeWidth);

  // human-friendly section
  // const strokeStyleLabel = normalizeStrokeStyle(el.strokeStyle);
  // const strokeSharpnessLabel = normalizeSharpness(el.strokeSharpness);
  const componentInfoList = [];
  componentInfoList.push(`${indent}组件: `);
  if (customData) {
    componentInfoList.push(
      `${indent}${indent}语义: 用途=${
        customData.componentPurpose || "无描述"
      }，用户操作=${customData.componentUserOperation || "无描述"}，结果=${
        customData.componentOperationResult || "无描述"
      }，服务端交互=${
        customData.componentServerInteraction || "无描述"
      }，特殊要求=${customData.componentSpecialRequirements || "无描述"}`,
    );
    componentInfoList.push(
      `${indent}${indent}UI库: 映射=${customData.componentMapping || "无描述"}`,
    );
  }
  componentInfoList.push(
    `${indent}${indent}布局(px): x=${toNumber2(el.x) ?? 0}, y=${
      toNumber2(el.y) ?? 0
    }, w=${toNumber2(el.width) ?? 0}, h=${toNumber2(el.height) ?? 0}`,
  );
  if (el.text) {
    componentInfoList.push(`${indent}${indent}文本: "${el.text ?? ""}"`);
  }

  const componentInfo = componentInfoList.join("\n");

  // const componentInfo = [
  //   // `${indent}组件: type=${el.type ?? "unknown"}, id=${
  //   //   el.id ?? "unknown"
  //   // }, 层级=${level + 1}`,
  //   `${indent}组件: `,
  //   customData
  //     ? `${indent}语义: 用途=${
  //         customData.componentPurpose || "无描述"
  //       }，用户操作=${customData.componentUserOperation || "无描述"}，结果=${
  //         customData.componentOperationResult || "无描述"
  //       }，服务端交互=${
  //         customData.componentServerInteraction || "无描述"
  //       }，特殊要求=${customData.componentSpecialRequirements || "无描述"}`
  //     : ``,
  //   customData
  //     ? `${indent}UI库: 映射=${customData.componentMapping || "无描述"}`
  //     : "",
  //   // `${indent}布局(px): x=${toNumber2(el.x) ?? 0}, y=${
  //   //   toNumber2(el.y) ?? 0
  //   // }, w=${toNumber2(el.width) ?? 0}, h=${toNumber2(el.height) ?? 0}, 角度=${
  //   //   angleDeg ?? 0
  //   // }°`,
  //   `${indent}布局(px): x=${toNumber2(el.x) ?? 0}, y=${
  //     toNumber2(el.y) ?? 0
  //   }, w=${toNumber2(el.width) ?? 0}, h=${toNumber2(el.height) ?? 0}`,
  //   // `${indent}样式: 背景=${el.backgroundColor ?? "默认"}，透明度=${
  //   //   opacity ?? 1
  //   // }，粗糙度=${roughness ?? 1}，锁定=${!!el.locked}`,
  //   `${indent}样式: 背景=${el.backgroundColor ?? "默认"}`,
  //   // `${indent}  - 描边: 颜色=${el.strokeColor ?? "默认"}，宽度=${
  //   //   strokeWidth ?? 1
  //   // }px，样式=${strokeStyleLabel ?? "默认"}，边角=${
  //   //   strokeSharpnessLabel ?? "默认"
  //   // }`,
  //   ...(el.type === "text"
  //     ? [
  //         `${indent}文本: "${el.text ?? ""}"`,
  //         `${indent}  - 字体: 大小=${toNumber2(el.fontSize) ?? 16}px，类型=${
  //           el.fontFamily ?? "默认"
  //         }`,
  //         // `${indent}  - 对齐: 水平=${
  //         //   normalizeTextAlign(el.textAlign) ?? "左对齐"
  //         // }，垂直=${normalizeVerticalAlign(el.verticalAlign) ?? "顶部"}`,
  //       ]
  //     : []),
  //   // ...(el.type === "arrow"
  //   //   ? [
  //   //       `${indent}箭头: 起点=${
  //   //         normalizeArrowhead(el.startArrowhead) ?? "无"
  //   //       }，终点=${normalizeArrowhead(el.endArrowhead) ?? "无"}`,
  //   //     ]
  //   //   : []),
  //   // `${indent}关系: 分组=${
  //   //   Array.isArray(el.groupIds) ? el.groupIds.length : 0
  //   // } 个，frameId=${el.frameId ?? "无"}，子组件=${
  //   //   node.children?.length ?? 0
  //   // } 个`,
  // ].join("\n");

  let childrenInfo = "";
  // if (hasChildren) {
  //   childrenInfo = `\n  子组件=>  \n${node.children
  //     .map((child) => generateSemanticTree(child, level + 1))
  //     .join("\n")}`;
  // }
  if (hasChildren) {
    childrenInfo = `\n${node.children
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
  const simplifiedTree = buildSimplifiedTree(elementTree);

  // 生成语义化描述
  if (elementTree.length > 0) {
    const semanticDescription = elementTree
      .map((node) => generateSemanticTree(node))
      .join("\n\n");
    return semanticDescription;
  }

  return ``;
  // return (
  //   "当前frame及其子元素中没有找到包含customData的组件。\n\n" +
  //   "请为相关元素添加组件描述信息：\n" +
  //   "- componentPurpose: 组件用途\n" +
  //   "- componentUserOperation: 用户操作\n" +
  //   "- componentOperationResult: 操作结果\n" +
  //   "- componentServerInteraction: 服务端交互\n" +
  //   "- componentSpecialRequirements: 特殊要求\n" +
  //   "- componentMapping: UI库映射"
  // );
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

/**
 * Group分组结构接口
 * 用于表示基于groupIds的分组结构
 */
interface GroupStructure {
  groupId: string;
  elements: LayoutNode[];
  children: GroupStructure[];
}

/**
 * 区域结构接口
 * 用于表示基于坐标和尺寸的智能区域划分
 */
interface AreaStructure {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  elements: LayoutNode[];
  groups: {
    groupId: string;
    elements: LayoutNode[];
  }[];
}

/**
 * 构建基于groupIds的分组结构
 * @param elements 元素数组
 * @param frame 框架元素
 * @param pretty 是否格式化输出
 * @returns 分组结构JSON字符串
 */
export function buildComponentGroups(
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameLikeElement,
  pretty: boolean = true,
): string {
  const frameChildren = getFrameChildren(elements, frame.id);
  const allElements = [frame, ...frameChildren] as ExcalidrawElement[];

  // 创建一个Map来存储groupIds和对应元素的关系
  const groupMap = new Map<string, LayoutNode[]>();
  const ungroupedElements: LayoutNode[] = [];

  // 分离有groupIds和没有groupIds的元素
  allElements.forEach((element) => {
    const anyEl = element as any;
    if (Array.isArray(anyEl.groupIds) && anyEl.groupIds.length > 0) {
      // 元素可能属于多个组，取最顶层的组（最后一个）
      const topGroupId = anyEl.groupIds[anyEl.groupIds.length - 1];
      if (!groupMap.has(topGroupId)) {
        groupMap.set(topGroupId, []);
      }
      const layoutNode = stripLayoutAttributes(element) as LayoutNode;
      // 添加depth和siblingIndex属性
      layoutNode.depth = 0;
      layoutNode.siblingIndex = 0;
      layoutNode.children = [];
      groupMap.get(topGroupId)!.push(layoutNode);
    } else {
      const layoutNode = stripLayoutAttributes(element) as LayoutNode;
      layoutNode.depth = 0;
      layoutNode.siblingIndex = 0;
      layoutNode.children = [];
      ungroupedElements.push(layoutNode);
    }
  });

  // 构建分组结构
  const groups: GroupStructure[] = [];
  groupMap.forEach((elements, groupId) => {
    groups.push({
      groupId,
      elements,
      children: [],
    });
  });

  const result = {
    version: "groups.v1",
    groups,
    ungrouped: ungroupedElements,
  };

  return JSON.stringify(result, null, pretty ? 2 : 0);
}

/**
 * 构建基于智能区域划分的组件结构
 * @param elements 元素数组
 * @param frame 框架元素
 * @param pretty 是否格式化输出
 * @returns 区域结构JSON字符串
 */
export function buildComponentAreas(
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameLikeElement,
  pretty: boolean = true,
): string {
  const frameChildren = getFrameChildren(elements, frame.id);
  const allElements = [frame, ...frameChildren] as ExcalidrawElement[];

  // 第一步：过滤无用属性，生成精简的布局节点
  const layoutNodes: LayoutNode[] = allElements.map((element, index) => {
    const base = stripLayoutAttributes(element);
    return {
      ...base,
      depth: 0, // 初始深度为0
      siblingIndex: index,
      children: [],
    };
  });

  // 第二步：构建元素层级树（类似第一种方法）
  const elementTree = buildElementTree(allElements);

  // 第三步：根据页面尺寸动态确定划分基准
  // 根据页面宽高动态计算区域基准大小
  const frameWidth = frame.width;
  const frameHeight = frame.height;

  // 基准区域宽度和高度在200~500像素之间
  const baseWidth = Math.min(Math.max(frameWidth / 5, 200), 500);
  const baseHeight = Math.min(Math.max(frameHeight / 5, 200), 500);

  // 计算网格行列数
  const cols = Math.max(Math.floor(frameWidth / baseWidth), 1);
  const rows = Math.max(Math.floor(frameHeight / baseHeight), 1);

  // 计算实际的网格大小
  const cellWidth = frameWidth / cols;
  const cellHeight = frameHeight / rows;

  // 第四步：初始化网格区域
  const grid: {
    x: number;
    y: number;
    width: number;
    height: number;
    elements: LayoutNode[];
  }[][] = [];

  for (let i = 0; i < cols; i++) {
    grid[i] = [];
    for (let j = 0; j < rows; j++) {
      grid[i][j] = {
        x: frame.x + i * cellWidth,
        y: frame.y + j * cellHeight,
        width: cellWidth,
        height: cellHeight,
        elements: [],
      };
    }
  }

  // 第五步：将元素分配到网格中
  layoutNodes.forEach((node) => {
    // 计算元素中心点
    const centerX = node.position.x + node.size.width / 2;
    const centerY = node.position.y + node.size.height / 2;

    // 确定元素属于哪个网格
    const col = Math.min(Math.floor((centerX - frame.x) / cellWidth), cols - 1);
    const row = Math.min(
      Math.floor((centerY - frame.y) / cellHeight),
      rows - 1,
    );

    // 确保网格索引有效
    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      grid[col][row].elements.push(node);
    }
  });

  // 第六步：创建区域
  const areas: any[] = [];

  // 遍历网格，为每个包含元素的网格创建区域
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cell = grid[i][j];
      if (cell.elements.length > 0) {
        // 计算该区域中所有元素的实际边界框
        let minX = Math.min(...cell.elements.map((e) => e.position.x));
        let minY = Math.min(...cell.elements.map((e) => e.position.y));
        let maxX = Math.max(
          ...cell.elements.map((e) => e.position.x + e.size.width),
        );
        let maxY = Math.max(
          ...cell.elements.map((e) => e.position.y + e.size.height),
        );

        // 确保区域不小于网格大小
        minX = Math.min(minX, cell.x);
        minY = Math.min(minY, cell.y);
        maxX = Math.max(maxX, cell.x + cell.width);
        maxY = Math.max(maxY, cell.y + cell.height);

        areas.push({
          id: `area-${i}-${j}`,
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          elements: cell.elements,
          gridPosition: { col: i, row: j },
          type: "grid-based",
        });
      }
    }
  }

  // 第七步：合并相邻区域（如果它们包含相同groupId的元素或距离很近）
  const mergedAreas = [...areas];
  let merged = true;

  while (merged) {
    merged = false;
    for (let i = 0; i < mergedAreas.length; i++) {
      for (let j = i + 1; j < mergedAreas.length; j++) {
        const area1 = mergedAreas[i];
        const area2 = mergedAreas[j];

        // 检查是否可以合并
        const canMerge =
          // 有重叠
          !(
            area1.x > area2.x + area2.width ||
            area2.x > area1.x + area1.width ||
            area1.y > area2.y + area2.height ||
            area2.y > area1.y + area1.height
          ) ||
          // 或者距离很近（50像素以内）
          Math.abs(area1.x + area1.width - area2.x) < 50 ||
          Math.abs(area2.x + area2.width - area1.x) < 50 ||
          Math.abs(area1.y + area1.height - area2.y) < 50 ||
          Math.abs(area2.y + area2.height - area1.y) < 50;

        if (canMerge) {
          // 合并区域
          const minX = Math.min(area1.x, area2.x);
          const minY = Math.min(area1.y, area2.y);
          const maxX = Math.max(area1.x + area1.width, area2.x + area2.width);
          const maxY = Math.max(area1.y + area1.height, area2.y + area2.height);

          const mergedArea = {
            id: `merged-${area1.id}-${area2.id}`,
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            elements: [...area1.elements, ...area2.elements],
            type: "merged",
          };

          // 移除原来的两个区域，添加合并后的区域
          mergedAreas.splice(j, 1);
          mergedAreas.splice(i, 1);
          mergedAreas.push(mergedArea);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }

  const result = {
    version: "areas.v3",
    frame: {
      id: frame.id,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
    },
    areas: mergedAreas,
  };

  return JSON.stringify(result, null, pretty ? 2 : 0);
}
