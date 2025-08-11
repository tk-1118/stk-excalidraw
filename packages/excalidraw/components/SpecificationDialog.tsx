import React, { useState } from "react";

import { getFrameChildren } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";

import { Dialog } from "./Dialog";

interface SpecificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  frame: ExcalidrawFrameLikeElement;
  elements: readonly ExcalidrawElement[];
}

// 元素树节点类型
interface ElementTreeNode {
  element: ExcalidrawElement;
  children: ElementTreeNode[];
  depth: number;
}

// 判断一个元素是否在另一个元素内部
function isElementInside(
  inner: ExcalidrawElement,
  outer: ExcalidrawElement,
): boolean {
  if (!inner.width || !inner.height || !outer.width || !outer.height) {
    return false;
  }

  // 完全相同的元素不算包含关系
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

// 构建元素层级树
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

// 过滤出有customData的节点树
function buildSimplifiedTree(
  originalTree: ElementTreeNode[],
): ElementTreeNode[] {
  function filterNode(node: ElementTreeNode): ElementTreeNode | null {
    const hasCustomData =
      node.element.customData !== undefined &&
      node.element.customData !== null;

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

// 生成语义化描述
function generateSemanticTree(
  node: ElementTreeNode,
  level: number = 0,
): string {
  const indent = "  ".repeat(level);
  const hasChildren = node.children && node.children.length > 0;
  const customData = node.element.customData || {};

  const componentInfo = [
    `${indent}  组件层级: ${level + 1}`,
    `${indent}  组件用途: ${customData.componentPurpose || "无描述"}`,
    `${indent}  用户操作: ${customData.componentUserOperation || "无描述"}`,
    `${indent}  操作结果: ${customData.componentOperationResult || "无描述"}`,
    `${indent}  服务端交互: ${
      customData.componentServerInteraction || "无描述"
    }`,
    `${indent}  特殊要求: ${
      customData.componentSpecialRequirements || "无描述"
    }`,
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

export const SpecificationDialog: React.FC<SpecificationDialogProps> = ({
  isOpen,
  onClose,
  frame,
  elements,
}) => {
  const [specification, setSpecification] = useState<string>("");

  React.useEffect(() => {
    if (isOpen && frame) {
      // 获取frame内的所有子元素
      const frameChildren = getFrameChildren(elements, frame.id);

      // 包含frame本身和所有子元素
      const allElements = [frame, ...frameChildren];

      // 构建元素层级树
      const elementTree = buildElementTree(allElements);

      // 构建精简树（只包含有customData的节点）
      const simplifiedTree = buildSimplifiedTree(elementTree);

      // 生成语义化描述
      if (simplifiedTree.length > 0) {
        const semanticDescription = simplifiedTree
          .map((node) => generateSemanticTree(node))
          .join("\n\n");
        setSpecification(semanticDescription);
      } else {
        setSpecification(
          "当前frame及其子元素中没有找到包含customData的组件。\n\n请为相关元素添加组件描述信息：\n- componentPurpose: 组件用途\n- componentUserOperation: 用户操作\n- componentOperationResult: 操作结果\n- componentServerInteraction: 服务端交互\n- componentSpecialRequirements: 特殊要求\n- componentMapping: UI库映射",
        );
      }
    }
  }, [isOpen, frame, elements]);

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      onCloseRequest={onClose}
      title="前端规约构建"
      size="wide"
      className="SpecificationDialog"
    >
      <div style={{ padding: "20px" }}>
        <div style={{ marginBottom: "16px" }}>
          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: "16px",
              fontWeight: "600",
            }}
          >
            {frame.name || frame.id}
          </h3>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "600",
            }}
          >
            组件描述:
          </label>
          <textarea
            value={specification}
            onChange={(e) => setSpecification(e.target.value)}
            style={{
              width: "100%",
              height: "400px",
              padding: "12px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "12px",
              lineHeight: "1.4",
              resize: "vertical",
            }}
            placeholder="组件描述将在这里生成..."
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--color-gray-60)" }}>
            组件描述 → AI规约生成 → 规约评分 → 发布（需评分≥80分）
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                border: "1px solid var(--default-border-color)",
                borderRadius: "var(--border-radius-lg)",
                backgroundColor: "var(--island-bg-color)",
                color: "var(--color-on-surface)",
                cursor: "pointer",
                fontFamily: "var(--ui-font)",
                fontSize: "0.875rem",
                fontWeight: "600",
              }}
            >
              关闭
            </button>
            <button
              style={{
                padding: "8px 16px",
                border: "1px solid var(--color-primary)",
                borderRadius: "var(--border-radius-lg)",
                backgroundColor: "var(--color-primary)",
                color: "var(--color-icon-white)",
                cursor: "pointer",
                opacity: 0.6,
                fontFamily: "var(--ui-font)",
                fontSize: "0.875rem",
                fontWeight: "600",
              }}
              disabled
              title="此功能将在未来版本中实现"
            >
              生成规约
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
