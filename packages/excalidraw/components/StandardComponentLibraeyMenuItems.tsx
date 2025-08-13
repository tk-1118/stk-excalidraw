import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { MIME_TYPES, arrayToMap } from "@excalidraw/common";

import { duplicateElements } from "@excalidraw/element";

import { serializeLibraryAsJSON } from "../data/json";
import { useLibraryCache } from "../hooks/useLibraryItemSvg";
import { useScrollPosition } from "../hooks/useScrollPosition";
//   import { t } from "../i18n";

//   import { LibraryMenuControlButtons } from "./LibraryMenuControlButtons";
//   import { LibraryDropdownMenu } from "./LibraryMenuHeaderContent";
import {
  LibraryMenuSection,
  LibraryMenuSectionGrid,
} from "./LibraryMenuSection";

//   import Spinner from "./Spinner";
import Stack from "./Stack";

import "./StandardComponentLibraeyMenuItems.scss";

import excalidrawComponetns from "./BusinessServiceProtoNav/excalidraw-components.json";

import type {
  ExcalidrawProps,
  LibraryItem,
  LibraryItems,
  UIAppState,
} from "../types";

// 基础组件
const baseLibraryItems =
  excalidrawComponetns.find((c) => c.id === "base-component")?.componentData ||
  [];
// 表单组件
const formLibraryItems =
  excalidrawComponetns.find((c) => c.id === "form-component")?.componentData ||
  [];
// 数据组件
const dataLibraryItems =
  excalidrawComponetns.find((c) => c.id === "data-component")?.componentData ||
  [];
// 信息组件
const messageLibraryItems =
  excalidrawComponetns.find((c) => c.id === "message-component")
    ?.componentData || [];
// 向导组件
const guideLibraryItems =
  excalidrawComponetns.find((c) => c.id === "guide-component")?.componentData ||
  [];
// 其他组件
const otherLibraryItems =
  excalidrawComponetns.find((c) => c.id === "other-component")?.componentData ||
  [];

// using an odd number of items per batch so the rendering creates an irregular
// pattern which looks more organic
const ITEMS_RENDERED_PER_BATCH = 17;
// when render outputs cached we can render many more items per batch to
// speed it up
const CACHED_ITEMS_RENDERED_PER_BATCH = 64;

export default function LibraryMenuItems({
  isLoading,
  libraryItems,
  onAddToLibrary,
  onInsertLibraryItems,
  pendingElements,
  theme,
  id,
  libraryReturnUrl,
  onSelectItems,
  selectedItems,
}: {
  isLoading: boolean;
  libraryItems: LibraryItems;
  pendingElements: LibraryItem["elements"];
  onInsertLibraryItems: (libraryItems: LibraryItems) => void;
  onAddToLibrary: (elements: LibraryItem["elements"]) => void;
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  theme: UIAppState["theme"];
  id: string;
  selectedItems: LibraryItem["id"][];
  onSelectItems: (id: LibraryItem["id"][]) => void;
}) {
  // 默认组件库导入libraryItems，用于演示
  libraryItems = [
    ...baseLibraryItems,
    ...formLibraryItems,
    ...dataLibraryItems,
    ...messageLibraryItems,
    ...guideLibraryItems,
    ...otherLibraryItems,
  ] as any[];

  const libraryContainerRef = useRef<HTMLDivElement>(null);
  const scrollPosition = useScrollPosition<HTMLDivElement>(libraryContainerRef);

  // This effect has to be called only on first render, therefore  `scrollPosition` isn't in the dependency array
  useEffect(() => {
    if (scrollPosition > 0) {
      libraryContainerRef.current?.scrollTo(0, scrollPosition);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { svgCache } = useLibraryCache();
  const unpublishedItems = useMemo(
    () => libraryItems.filter((item) => item.status !== "published"),
    [libraryItems],
  );

  const publishedItems = useMemo(
    () => libraryItems.filter((item) => item.status === "published"),
    [libraryItems],
  );

  // const showBtn = !libraryItems.length && !pendingElements.length;

  // const isLibraryEmpty =
  //   !pendingElements.length &&
  //   !unpublishedItems.length &&
  //   !publishedItems.length;

  const [lastSelectedItem, setLastSelectedItem] = useState<
    LibraryItem["id"] | null
  >(null);

  const onItemSelectToggle = useCallback(
    (id: LibraryItem["id"], event: React.MouseEvent) => {
      const shouldSelect = !selectedItems.includes(id);

      const orderedItems = [...unpublishedItems, ...publishedItems];

      if (shouldSelect) {
        if (event.shiftKey && lastSelectedItem) {
          const rangeStart = orderedItems.findIndex(
            (item) => item.id === lastSelectedItem,
          );
          const rangeEnd = orderedItems.findIndex((item) => item.id === id);

          if (rangeStart === -1 || rangeEnd === -1) {
            onSelectItems([...selectedItems, id]);
            return;
          }

          const selectedItemsMap = arrayToMap(selectedItems);
          const nextSelectedIds = orderedItems.reduce(
            (acc: LibraryItem["id"][], item, idx) => {
              if (
                (idx >= rangeStart && idx <= rangeEnd) ||
                selectedItemsMap.has(item.id)
              ) {
                acc.push(item.id);
              }
              return acc;
            },
            [],
          );

          onSelectItems(nextSelectedIds);
        } else {
          onSelectItems([...selectedItems, id]);
        }
        setLastSelectedItem(id);
      } else {
        setLastSelectedItem(null);
        onSelectItems(selectedItems.filter((_id) => _id !== id));
      }
    },
    [
      lastSelectedItem,
      onSelectItems,
      publishedItems,
      selectedItems,
      unpublishedItems,
    ],
  );

  const getInsertedElements = useCallback(
    (id: string) => {
      let targetElements;
      if (selectedItems.includes(id)) {
        targetElements = libraryItems.filter((item) =>
          selectedItems.includes(item.id),
        );
      } else {
        targetElements = libraryItems.filter((item) => item.id === id);
      }
      return targetElements.map((item) => {
        return {
          ...item,
          // duplicate each library item before inserting on canvas to confine
          // ids and bindings to each library item. See #6465
          elements: duplicateElements({
            type: "everything",
            elements: item.elements,
            randomizeSeed: true,
          }).duplicatedElements,
        };
      });
    },
    [libraryItems, selectedItems],
  );

  const onItemDrag = useCallback(
    (id: LibraryItem["id"], event: React.DragEvent) => {
      event.dataTransfer.setData(
        MIME_TYPES.excalidrawlib,
        serializeLibraryAsJSON(getInsertedElements(id)),
      );
    },
    [getInsertedElements],
  );

  const isItemSelected = useCallback(
    (id: LibraryItem["id"] | null) => {
      if (!id) {
        return false;
      }

      return selectedItems.includes(id);
    },
    [selectedItems],
  );

  // const onAddToLibraryClick = useCallback(() => {
  //   onAddToLibrary(pendingElements);
  // }, [pendingElements, onAddToLibrary]);

  const onItemClick = useCallback(
    (id: LibraryItem["id"] | null) => {
      if (id) {
        onInsertLibraryItems(getInsertedElements(id));
      }
    },
    [getInsertedElements, onInsertLibraryItems],
  );

  const itemsRenderedPerBatch =
    svgCache.size >= libraryItems.length
      ? CACHED_ITEMS_RENDERED_PER_BATCH
      : ITEMS_RENDERED_PER_BATCH;

  return (
    <div
      className="library-menu-items-container"
      style={{
        display: "block",
        overflowY: "auto",
      }}
    >
      {/* 基础组件部分 */}
      <Stack.Col
        className="library-menu-items-container__items"
        align="start"
        gap={1}
        style={{
          position: "relative",
          height: "300px",
          marginBottom: 0,
        }}
      >
        <div className="library-menu-items-container__header">基础组件</div>
        <LibraryMenuSectionGrid>
          <LibraryMenuSection
            itemsRenderedPerBatch={itemsRenderedPerBatch}
            items={baseLibraryItems as any[]}
            onItemSelectToggle={onItemSelectToggle}
            onItemDrag={onItemDrag}
            onClick={onItemClick}
            isItemSelected={isItemSelected}
            svgCache={svgCache}
          />
        </LibraryMenuSectionGrid>
      </Stack.Col>

      {/* 表单组件部分 */}
      <Stack.Col
        className="library-menu-items-container__items"
        align="start"
        gap={1}
        style={{
          position: "relative",
          height: "300px",
          marginBottom: 0,
        }}
      >
        <div className="library-menu-items-container__header">表单组件</div>
        <LibraryMenuSectionGrid>
          <LibraryMenuSection
            itemsRenderedPerBatch={itemsRenderedPerBatch}
            items={formLibraryItems as any[]}
            onItemSelectToggle={onItemSelectToggle}
            onItemDrag={onItemDrag}
            onClick={onItemClick}
            isItemSelected={isItemSelected}
            svgCache={svgCache}
          />
        </LibraryMenuSectionGrid>
      </Stack.Col>

      {/* 数据组件部分 */}
      <Stack.Col
        className="library-menu-items-container__items"
        align="start"
        gap={1}
        style={{
          position: "relative",
          height: "300px",
          marginBottom: 0,
        }}
      >
        <div className="library-menu-items-container__header">数据组件</div>
        <LibraryMenuSectionGrid>
          <LibraryMenuSection
            itemsRenderedPerBatch={itemsRenderedPerBatch}
            items={dataLibraryItems as any[]}
            onItemSelectToggle={onItemSelectToggle}
            onItemDrag={onItemDrag}
            onClick={onItemClick}
            isItemSelected={isItemSelected}
            svgCache={svgCache}
          />
        </LibraryMenuSectionGrid>
      </Stack.Col>

      {/* 消息组件部分 */}
      <Stack.Col
        className="library-menu-items-container__items"
        align="start"
        gap={1}
        style={{
          position: "relative",
          height: "300px",
          marginBottom: 0,
        }}
      >
        <div className="library-menu-items-container__header">消息组件</div>
        <LibraryMenuSectionGrid>
          <LibraryMenuSection
            itemsRenderedPerBatch={itemsRenderedPerBatch}
            items={messageLibraryItems as any[]}
            onItemSelectToggle={onItemSelectToggle}
            onItemDrag={onItemDrag}
            onClick={onItemClick}
            isItemSelected={isItemSelected}
            svgCache={svgCache}
          />
        </LibraryMenuSectionGrid>
      </Stack.Col>

      {/* 向导组件部分 */}
      <Stack.Col
        className="library-menu-items-container__items"
        align="start"
        gap={1}
        style={{
          position: "relative",
          height: "300px",
          marginBottom: 0,
        }}
      >
        <div className="library-menu-items-container__header">向导组件</div>
        <LibraryMenuSectionGrid>
          <LibraryMenuSection
            itemsRenderedPerBatch={itemsRenderedPerBatch}
            items={guideLibraryItems as any[]}
            onItemSelectToggle={onItemSelectToggle}
            onItemDrag={onItemDrag}
            onClick={onItemClick}
            isItemSelected={isItemSelected}
            svgCache={svgCache}
          />
        </LibraryMenuSectionGrid>
      </Stack.Col>

      {/* 其他组件部分 */}
      <Stack.Col
        className="library-menu-items-container__items"
        align="start"
        gap={1}
        style={{
          position: "relative",
          height: "300px",
          marginBottom: 0,
        }}
      >
        <div className="library-menu-items-container__header">其他组件</div>
        <LibraryMenuSectionGrid>
          <LibraryMenuSection
            itemsRenderedPerBatch={itemsRenderedPerBatch}
            items={otherLibraryItems as any[]}
            onItemSelectToggle={onItemSelectToggle}
            onItemDrag={onItemDrag}
            onClick={onItemClick}
            isItemSelected={isItemSelected}
            svgCache={svgCache}
          />
        </LibraryMenuSectionGrid>
      </Stack.Col>
    </div>
  );
}
