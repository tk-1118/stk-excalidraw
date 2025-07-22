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
  
  import type {
    ExcalidrawProps,
    LibraryItem,
    LibraryItems,
    UIAppState,
  } from "../types";
  
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
  
    const onAddToLibraryClick = useCallback(() => {
      onAddToLibrary(pendingElements);
    }, [pendingElements, onAddToLibrary]);
  
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
        style={
          pendingElements.length ||
          unpublishedItems.length ||
          publishedItems.length
            ? { justifyContent: "flex-start" }
            : { borderBottom: 0 }
        }
      >
        {/* {!isLibraryEmpty && (
          <LibraryDropdownMenu
            selectedItems={selectedItems}
            onSelectItems={onSelectItems}
            className="library-menu-dropdown-container--in-heading"
          />
        )} */}
        <Stack.Col
          className="library-menu-items-container__items"
          align="start"
          gap={1}
          style={{
            flex: publishedItems.length > 0 ? 1 : "0 1 auto",
            marginBottom: 0,
          }}
          ref={libraryContainerRef}
        >
            <div className="library-menu-items-container__header">
                基础组件
            </div>
            <LibraryMenuSectionGrid>
                <LibraryMenuSection
                    itemsRenderedPerBatch={itemsRenderedPerBatch}
                    items={[
                        {
                            "status": "unpublished",
                            "elements": [
                              {
                                "id": "GNtgvtKQ31wP6lqeU9U21",
                                "type": "rectangle",
                                "x": 609.7339347908296,
                                "y": -630.8514905218216,
                                "width": 60.140625,
                                "height": 354.44140625,
                                "angle": 0,
                                "strokeColor": "#9c36b5",
                                "backgroundColor": "transparent",
                                "fillStyle": "solid",
                                "strokeWidth": 2,
                                "strokeStyle": "solid",
                                "roughness": 1,
                                "opacity": 100,
                                "groupIds": [],
                                "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                                "index": "a5V",
                                "roundness": {
                                  "type": 3
                                },
                                "seed": 1943275236,
                                "version": 364,
                                "versionNonce": 78477436,
                                "isDeleted": false,
                                "boundElements": [],
                                "updated": 1753156772252,
                                "link": null,
                                "locked": false
                              },
                              {
                                "id": "Yt2qkHxmG2EZ8erm9GXwQ",
                                "type": "rectangle",
                                "x": 693.7456535408296,
                                "y": -628.4530530218216,
                                "width": 434.94140625,
                                "height": 45.234375,
                                "angle": 0,
                                "strokeColor": "#9c36b5",
                                "backgroundColor": "transparent",
                                "fillStyle": "solid",
                                "strokeWidth": 2,
                                "strokeStyle": "solid",
                                "roughness": 1,
                                "opacity": 100,
                                "groupIds": [],
                                "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                                "index": "a5l",
                                "roundness": {
                                  "type": 3
                                },
                                "seed": 1881546084,
                                "version": 205,
                                "versionNonce": 1172375804,
                                "isDeleted": false,
                                "boundElements": [],
                                "updated": 1753156772252,
                                "link": null,
                                "locked": false
                              },
                              {
                                "id": "vUpnJR5R5hmliEBWFP9x3",
                                "type": "rectangle",
                                "x": 696.9175285408296,
                                "y": -555.3319592718216,
                                "width": 428.86328125,
                                "height": 271.484375,
                                "angle": 0,
                                "strokeColor": "#e03131",
                                "backgroundColor": "#ffc9c9",
                                "fillStyle": "solid",
                                "strokeWidth": 2,
                                "strokeStyle": "solid",
                                "roughness": 1,
                                "opacity": 100,
                                "groupIds": [],
                                "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                                "index": "a5t",
                                "roundness": {
                                  "type": 3
                                },
                                "seed": 938521828,
                                "version": 183,
                                "versionNonce": 726567292,
                                "isDeleted": false,
                                "boundElements": [],
                                "updated": 1753156772252,
                                "link": null,
                                "locked": false
                              },
                              {
                                "id": "QRrZlzo7bO8a7WjiQWvrm",
                                "type": "frame",
                                "x": 594.6636222908296,
                                "y": -644.3788342718216,
                                "width": 551.875,
                                "height": 383.81640625,
                                "angle": 0,
                                "strokeColor": "#bbb",
                                "backgroundColor": "transparent",
                                "fillStyle": "solid",
                                "strokeWidth": 2,
                                "strokeStyle": "solid",
                                "roughness": 0,
                                "opacity": 100,
                                "groupIds": [],
                                "frameId": null,
                                "index": "a6",
                                "roundness": null,
                                "seed": 1597544796,
                                "version": 184,
                                "versionNonce": 1680988156,
                                "isDeleted": false,
                                "boundElements": [],
                                "updated": 1753156772252,
                                "link": null,
                                "locked": false,
                                "name": null
                              }
                            ],
                            "id": "bm4avCzuVQH3FzEDKXmpQ1",
                            "created": 1753161395449
                          }
                    ] as any[]}
                    onItemSelectToggle={onItemSelectToggle}
                    onItemDrag={onItemDrag}
                    onClick={onItemClick}
                    isItemSelected={isItemSelected}
                    svgCache={svgCache}
                />
            </LibraryMenuSectionGrid>
        </Stack.Col>
        <Stack.Col
          className="library-menu-items-container__items"
          align="start"
          gap={1}
          style={{
            flex: publishedItems.length > 0 ? 1 : "0 1 auto",
            marginBottom: 0,
          }}
          ref={libraryContainerRef}
        >
            <div className="library-menu-items-container__header">
                表单组件
            </div>
            <LibraryMenuSection
                itemsRenderedPerBatch={itemsRenderedPerBatch}
                items={[
                    {
                        "status": "unpublished",
                        "elements": [
                            {
                            "id": "GNtgvtKQ31wP6lqeU9U21",
                            "type": "rectangle",
                            "x": 609.7339347908296,
                            "y": -630.8514905218216,
                            "width": 60.140625,
                            "height": 354.44140625,
                            "angle": 0,
                            "strokeColor": "#9c36b5",
                            "backgroundColor": "transparent",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 1,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                            "index": "a5V",
                            "roundness": {
                                "type": 3
                            },
                            "seed": 1943275236,
                            "version": 364,
                            "versionNonce": 78477436,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false
                            },
                            {
                            "id": "Yt2qkHxmG2EZ8erm9GXwQ",
                            "type": "rectangle",
                            "x": 693.7456535408296,
                            "y": -628.4530530218216,
                            "width": 434.94140625,
                            "height": 45.234375,
                            "angle": 0,
                            "strokeColor": "#9c36b5",
                            "backgroundColor": "transparent",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 1,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                            "index": "a5l",
                            "roundness": {
                                "type": 3
                            },
                            "seed": 1881546084,
                            "version": 205,
                            "versionNonce": 1172375804,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false
                            },
                            {
                            "id": "vUpnJR5R5hmliEBWFP9x3",
                            "type": "rectangle",
                            "x": 696.9175285408296,
                            "y": -555.3319592718216,
                            "width": 428.86328125,
                            "height": 271.484375,
                            "angle": 0,
                            "strokeColor": "#e03131",
                            "backgroundColor": "#ffc9c9",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 1,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                            "index": "a5t",
                            "roundness": {
                                "type": 3
                            },
                            "seed": 938521828,
                            "version": 183,
                            "versionNonce": 726567292,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false
                            },
                            {
                            "id": "QRrZlzo7bO8a7WjiQWvrm",
                            "type": "frame",
                            "x": 594.6636222908296,
                            "y": -644.3788342718216,
                            "width": 551.875,
                            "height": 383.81640625,
                            "angle": 0,
                            "strokeColor": "#bbb",
                            "backgroundColor": "transparent",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 0,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": null,
                            "index": "a6",
                            "roundness": null,
                            "seed": 1597544796,
                            "version": 184,
                            "versionNonce": 1680988156,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false,
                            "name": null
                            }
                        ],
                        "id": "bm4avCzuVQH3FzEDKXmpQ2",
                        "created": 1753161395449
                        }
                ] as any[]}
                onItemSelectToggle={onItemSelectToggle}
                onItemDrag={onItemDrag}
                onClick={onItemClick}
                isItemSelected={isItemSelected}
                svgCache={svgCache}
            />
        </Stack.Col>
        <Stack.Col
          className="library-menu-items-container__items"
          align="start"
          gap={1}
          style={{
            flex: publishedItems.length > 0 ? 1 : "0 1 auto",
            marginBottom: 0,
          }}
          ref={libraryContainerRef}
        >
            <div className="library-menu-items-container__header">
                数据组件
            </div>
            <LibraryMenuSection
                itemsRenderedPerBatch={itemsRenderedPerBatch}
                items={[
                    {
                        "status": "unpublished",
                        "elements": [
                            {
                            "id": "GNtgvtKQ31wP6lqeU9U21",
                            "type": "rectangle",
                            "x": 609.7339347908296,
                            "y": -630.8514905218216,
                            "width": 60.140625,
                            "height": 354.44140625,
                            "angle": 0,
                            "strokeColor": "#9c36b5",
                            "backgroundColor": "transparent",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 1,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                            "index": "a5V",
                            "roundness": {
                                "type": 3
                            },
                            "seed": 1943275236,
                            "version": 364,
                            "versionNonce": 78477436,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false
                            },
                            {
                            "id": "Yt2qkHxmG2EZ8erm9GXwQ",
                            "type": "rectangle",
                            "x": 693.7456535408296,
                            "y": -628.4530530218216,
                            "width": 434.94140625,
                            "height": 45.234375,
                            "angle": 0,
                            "strokeColor": "#9c36b5",
                            "backgroundColor": "transparent",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 1,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                            "index": "a5l",
                            "roundness": {
                                "type": 3
                            },
                            "seed": 1881546084,
                            "version": 205,
                            "versionNonce": 1172375804,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false
                            },
                            {
                            "id": "vUpnJR5R5hmliEBWFP9x3",
                            "type": "rectangle",
                            "x": 696.9175285408296,
                            "y": -555.3319592718216,
                            "width": 428.86328125,
                            "height": 271.484375,
                            "angle": 0,
                            "strokeColor": "#e03131",
                            "backgroundColor": "#ffc9c9",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 1,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                            "index": "a5t",
                            "roundness": {
                                "type": 3
                            },
                            "seed": 938521828,
                            "version": 183,
                            "versionNonce": 726567292,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false
                            },
                            {
                            "id": "QRrZlzo7bO8a7WjiQWvrm",
                            "type": "frame",
                            "x": 594.6636222908296,
                            "y": -644.3788342718216,
                            "width": 551.875,
                            "height": 383.81640625,
                            "angle": 0,
                            "strokeColor": "#bbb",
                            "backgroundColor": "transparent",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 0,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": null,
                            "index": "a6",
                            "roundness": null,
                            "seed": 1597544796,
                            "version": 184,
                            "versionNonce": 1680988156,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false,
                            "name": null
                            }
                        ],
                        "id": "bm4avCzuVQH3FzEDKXmpQ3",
                        "created": 1753161395449
                        }
                ] as any[]}
                onItemSelectToggle={onItemSelectToggle}
                onItemDrag={onItemDrag}
                onClick={onItemClick}
                isItemSelected={isItemSelected}
                svgCache={svgCache}
            />
        </Stack.Col>
        <Stack.Col
          className="library-menu-items-container__items"
          align="start"
          gap={1}
          style={{
            flex: publishedItems.length > 0 ? 1 : "0 1 auto",
            marginBottom: 0,
          }}
          ref={libraryContainerRef}
        >
            <div className="library-menu-items-container__header">
                消息组件
            </div>
            <LibraryMenuSection
                itemsRenderedPerBatch={itemsRenderedPerBatch}
                items={[
                    {
                        "status": "unpublished",
                        "elements": [
                            {
                            "id": "GNtgvtKQ31wP6lqeU9U21",
                            "type": "rectangle",
                            "x": 609.7339347908296,
                            "y": -630.8514905218216,
                            "width": 60.140625,
                            "height": 354.44140625,
                            "angle": 0,
                            "strokeColor": "#9c36b5",
                            "backgroundColor": "transparent",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 1,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                            "index": "a5V",
                            "roundness": {
                                "type": 3
                            },
                            "seed": 1943275236,
                            "version": 364,
                            "versionNonce": 78477436,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false
                            },
                            {
                            "id": "Yt2qkHxmG2EZ8erm9GXwQ",
                            "type": "rectangle",
                            "x": 693.7456535408296,
                            "y": -628.4530530218216,
                            "width": 434.94140625,
                            "height": 45.234375,
                            "angle": 0,
                            "strokeColor": "#9c36b5",
                            "backgroundColor": "transparent",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 1,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                            "index": "a5l",
                            "roundness": {
                                "type": 3
                            },
                            "seed": 1881546084,
                            "version": 205,
                            "versionNonce": 1172375804,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false
                            },
                            {
                            "id": "vUpnJR5R5hmliEBWFP9x3",
                            "type": "rectangle",
                            "x": 696.9175285408296,
                            "y": -555.3319592718216,
                            "width": 428.86328125,
                            "height": 271.484375,
                            "angle": 0,
                            "strokeColor": "#e03131",
                            "backgroundColor": "#ffc9c9",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 1,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                            "index": "a5t",
                            "roundness": {
                                "type": 3
                            },
                            "seed": 938521828,
                            "version": 183,
                            "versionNonce": 726567292,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false
                            },
                            {
                            "id": "QRrZlzo7bO8a7WjiQWvrm",
                            "type": "frame",
                            "x": 594.6636222908296,
                            "y": -644.3788342718216,
                            "width": 551.875,
                            "height": 383.81640625,
                            "angle": 0,
                            "strokeColor": "#bbb",
                            "backgroundColor": "transparent",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 0,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": null,
                            "index": "a6",
                            "roundness": null,
                            "seed": 1597544796,
                            "version": 184,
                            "versionNonce": 1680988156,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false,
                            "name": null
                            }
                        ],
                        "id": "bm4avCzuVQH3FzEDKXmpQ4",
                        "created": 1753161395449
                        }
                ] as any[]}
                onItemSelectToggle={onItemSelectToggle}
                onItemDrag={onItemDrag}
                onClick={onItemClick}
                isItemSelected={isItemSelected}
                svgCache={svgCache}
            />
        </Stack.Col>
        <Stack.Col
          className="library-menu-items-container__items"
          align="start"
          gap={1}
          style={{
            flex: publishedItems.length > 0 ? 1 : "0 1 auto",
            marginBottom: 0,
          }}
          ref={libraryContainerRef}
        >
            <div className="library-menu-items-container__header">
                向导组件
            </div>
            <LibraryMenuSection
                itemsRenderedPerBatch={itemsRenderedPerBatch}
                items={[
                    {
                        "status": "unpublished",
                        "elements": [
                            {
                            "id": "GNtgvtKQ31wP6lqeU9U21",
                            "type": "rectangle",
                            "x": 609.7339347908296,
                            "y": -630.8514905218216,
                            "width": 60.140625,
                            "height": 354.44140625,
                            "angle": 0,
                            "strokeColor": "#9c36b5",
                            "backgroundColor": "transparent",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 1,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                            "index": "a5V",
                            "roundness": {
                                "type": 3
                            },
                            "seed": 1943275236,
                            "version": 364,
                            "versionNonce": 78477436,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false
                            },
                            {
                            "id": "Yt2qkHxmG2EZ8erm9GXwQ",
                            "type": "rectangle",
                            "x": 693.7456535408296,
                            "y": -628.4530530218216,
                            "width": 434.94140625,
                            "height": 45.234375,
                            "angle": 0,
                            "strokeColor": "#9c36b5",
                            "backgroundColor": "transparent",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 1,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                            "index": "a5l",
                            "roundness": {
                                "type": 3
                            },
                            "seed": 1881546084,
                            "version": 205,
                            "versionNonce": 1172375804,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false
                            },
                            {
                            "id": "vUpnJR5R5hmliEBWFP9x3",
                            "type": "rectangle",
                            "x": 696.9175285408296,
                            "y": -555.3319592718216,
                            "width": 428.86328125,
                            "height": 271.484375,
                            "angle": 0,
                            "strokeColor": "#e03131",
                            "backgroundColor": "#ffc9c9",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 1,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                            "index": "a5t",
                            "roundness": {
                                "type": 3
                            },
                            "seed": 938521828,
                            "version": 183,
                            "versionNonce": 726567292,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false
                            },
                            {
                            "id": "QRrZlzo7bO8a7WjiQWvrm",
                            "type": "frame",
                            "x": 594.6636222908296,
                            "y": -644.3788342718216,
                            "width": 551.875,
                            "height": 383.81640625,
                            "angle": 0,
                            "strokeColor": "#bbb",
                            "backgroundColor": "transparent",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 0,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": null,
                            "index": "a6",
                            "roundness": null,
                            "seed": 1597544796,
                            "version": 184,
                            "versionNonce": 1680988156,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false,
                            "name": null
                            }
                        ],
                        "id": "bm4avCzuVQH3FzEDKXmpQ5",
                        "created": 1753161395449
                        }
                ] as any[]}
                onItemSelectToggle={onItemSelectToggle}
                onItemDrag={onItemDrag}
                onClick={onItemClick}
                isItemSelected={isItemSelected}
                svgCache={svgCache}
            />
        </Stack.Col>
        <Stack.Col
          className="library-menu-items-container__items"
          align="start"
          gap={1}
          style={{
            flex: publishedItems.length > 0 ? 1 : "0 1 auto",
            marginBottom: 0,
          }}
          ref={libraryContainerRef}
        >
            <div className="library-menu-items-container__header">
                其他组件
            </div>
            <LibraryMenuSection
                itemsRenderedPerBatch={itemsRenderedPerBatch}
                items={[
                    {
                        "status": "unpublished",
                        "elements": [
                            {
                            "id": "GNtgvtKQ31wP6lqeU9U21",
                            "type": "rectangle",
                            "x": 609.7339347908296,
                            "y": -630.8514905218216,
                            "width": 60.140625,
                            "height": 354.44140625,
                            "angle": 0,
                            "strokeColor": "#9c36b5",
                            "backgroundColor": "transparent",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 1,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                            "index": "a5V",
                            "roundness": {
                                "type": 3
                            },
                            "seed": 1943275236,
                            "version": 364,
                            "versionNonce": 78477436,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false
                            },
                            {
                            "id": "Yt2qkHxmG2EZ8erm9GXwQ",
                            "type": "rectangle",
                            "x": 693.7456535408296,
                            "y": -628.4530530218216,
                            "width": 434.94140625,
                            "height": 45.234375,
                            "angle": 0,
                            "strokeColor": "#9c36b5",
                            "backgroundColor": "transparent",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 1,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                            "index": "a5l",
                            "roundness": {
                                "type": 3
                            },
                            "seed": 1881546084,
                            "version": 205,
                            "versionNonce": 1172375804,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false
                            },
                            {
                            "id": "vUpnJR5R5hmliEBWFP9x3",
                            "type": "rectangle",
                            "x": 696.9175285408296,
                            "y": -555.3319592718216,
                            "width": 428.86328125,
                            "height": 271.484375,
                            "angle": 0,
                            "strokeColor": "#e03131",
                            "backgroundColor": "#ffc9c9",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 1,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": "QRrZlzo7bO8a7WjiQWvrm",
                            "index": "a5t",
                            "roundness": {
                                "type": 3
                            },
                            "seed": 938521828,
                            "version": 183,
                            "versionNonce": 726567292,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false
                            },
                            {
                            "id": "QRrZlzo7bO8a7WjiQWvrm",
                            "type": "frame",
                            "x": 594.6636222908296,
                            "y": -644.3788342718216,
                            "width": 551.875,
                            "height": 383.81640625,
                            "angle": 0,
                            "strokeColor": "#bbb",
                            "backgroundColor": "transparent",
                            "fillStyle": "solid",
                            "strokeWidth": 2,
                            "strokeStyle": "solid",
                            "roughness": 0,
                            "opacity": 100,
                            "groupIds": [],
                            "frameId": null,
                            "index": "a6",
                            "roundness": null,
                            "seed": 1597544796,
                            "version": 184,
                            "versionNonce": 1680988156,
                            "isDeleted": false,
                            "boundElements": [],
                            "updated": 1753156772252,
                            "link": null,
                            "locked": false,
                            "name": null
                            }
                        ],
                        "id": "bm4avCzuVQH3FzEDKXmpQ6",
                        "created": 1753161395449
                        }
                ] as any[]}
                onItemSelectToggle={onItemSelectToggle}
                onItemDrag={onItemDrag}
                onClick={onItemClick}
                isItemSelected={isItemSelected}
                svgCache={svgCache}
            />
        </Stack.Col>
        {/* <Stack.Col
          className="library-menu-items-container__items"
          align="start"
          gap={1}
          style={{
            flex: publishedItems.length > 0 ? 1 : "0 1 auto",
            marginBottom: 0,
          }}
          ref={libraryContainerRef}
        >
          <>
            {!isLibraryEmpty && (
              <div className="library-menu-items-container__header">
                {t("labels.personalLib")}
              </div>
            )}
            {isLoading && (
              <div
                style={{
                  position: "absolute",
                  top: "var(--container-padding-y)",
                  right: "var(--container-padding-x)",
                  transform: "translateY(50%)",
                }}
              >
                <Spinner />
              </div>
            )}
            {!pendingElements.length && !unpublishedItems.length ? (
              <div className="library-menu-items__no-items">
                <div className="library-menu-items__no-items__label">
                  {t("library.noItems")}
                </div>
                <div className="library-menu-items__no-items__hint">
                  {publishedItems.length > 0
                    ? t("library.hint_emptyPrivateLibrary")
                    : t("library.hint_emptyLibrary")}
                </div>
              </div>
            ) : (
              <LibraryMenuSectionGrid>
                {pendingElements.length > 0 && (
                  <LibraryMenuSection
                    itemsRenderedPerBatch={itemsRenderedPerBatch}
                    items={[{ id: null, elements: pendingElements }]}
                    onItemSelectToggle={onItemSelectToggle}
                    onItemDrag={onItemDrag}
                    onClick={onAddToLibraryClick}
                    isItemSelected={isItemSelected}
                    svgCache={svgCache}
                  />
                )}
                <LibraryMenuSection
                  itemsRenderedPerBatch={itemsRenderedPerBatch}
                  items={unpublishedItems}
                  onItemSelectToggle={onItemSelectToggle}
                  onItemDrag={onItemDrag}
                  onClick={onItemClick}
                  isItemSelected={isItemSelected}
                  svgCache={svgCache}
                />
              </LibraryMenuSectionGrid>
            )}
          </>
  
          <>
            {(publishedItems.length > 0 ||
              pendingElements.length > 0 ||
              unpublishedItems.length > 0) && (
              <div className="library-menu-items-container__header library-menu-items-container__header--excal">
                {t("labels.excalidrawLib")}
              </div>
            )}
            {publishedItems.length > 0 ? (
              <LibraryMenuSectionGrid>
                <LibraryMenuSection
                  itemsRenderedPerBatch={itemsRenderedPerBatch}
                  items={publishedItems}
                  onItemSelectToggle={onItemSelectToggle}
                  onItemDrag={onItemDrag}
                  onClick={onItemClick}
                  isItemSelected={isItemSelected}
                  svgCache={svgCache}
                />
              </LibraryMenuSectionGrid>
            ) : unpublishedItems.length > 0 ? (
              <div
                style={{
                  margin: "1rem 0",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  fontSize: ".9rem",
                }}
              >
                {t("library.noItems")}
              </div>
            ) : null}
          </>
  
          {showBtn && (
            <LibraryMenuControlButtons
              style={{ padding: "16px 0", width: "100%" }}
              id={id}
              libraryReturnUrl={libraryReturnUrl}
              theme={theme}
            >
              <LibraryDropdownMenu
                selectedItems={selectedItems}
                onSelectItems={onSelectItems}
              />
            </LibraryMenuControlButtons>
          )}
        </Stack.Col> */}
      </div>
    );
  }
  