import { getFrameChildren } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";

interface ElementTreeNode {
  element: ExcalidrawElement;
  children: ElementTreeNode[];
  depth: number;
}

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

function buildSimplifiedTree(originalTree: ElementTreeNode[]): ElementTreeNode[] {
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

function generateSemanticTree(node: ElementTreeNode, level: number = 0): string {
  const indent = "  ".repeat(level);
  const hasChildren = node.children && node.children.length > 0;
  const customData: any = (node.element as any).customData || {};

  const componentInfo = [
    `${indent}  组件层级: ${level + 1}`,
    `${indent}  组件用途: ${customData.componentPurpose || "无描述"}`,
    `${indent}  用户操作: ${customData.componentUserOperation || "无描述"}`,
    `${indent}  操作结果: ${customData.componentOperationResult || "无描述"}`,
    `${indent}  服务端交互: ${customData.componentServerInteraction || "无描述"}`,
    `${indent}  特殊要求: ${customData.componentSpecialRequirements || "无描述"}`,
    `${indent}  UI库映射: ${customData.componentMapping || "无描述"}`,
    `${indent}  组件样式: 宽度: ${
      (node.element.width as number)?.toFixed(2) || 0
    }px, 高度: ${
      (node.element.height as number)?.toFixed(2) || 0
    }px, 位置: left: ${node.element.x?.toFixed(2) || 0}px, top: ${
      node.element.y?.toFixed(2) || 0
    }px`,
  ].join("\n");

  let childrenInfo = "";
  if (hasChildren) {
    childrenInfo = `\n
    ${indent}子组件 >\n${node.children
      .map((child) => generateSemanticTree(child, level + 1))
      .join("\n")}`;
  }

  return `${componentInfo}${childrenInfo}`;
}

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
  if (simplifiedTree.length > 0) {
    const semanticDescription = simplifiedTree
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


