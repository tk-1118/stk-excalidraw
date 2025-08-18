import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { MIME_TYPES, arrayToMap } from "@excalidraw/common";

import { duplicateElements, newImageElement } from "@excalidraw/element";

import { serializeLibraryAsJSON } from "../data/json";
import { useLibraryCache } from "../hooks/useLibraryItemSvg";
import { useScrollPosition } from "../hooks/useScrollPosition";
import { t } from "../i18n";

import { LibraryMenuControlButtons } from "./LibraryMenuControlButtons";
import { LibraryDropdownMenu } from "./LibraryMenuHeaderContent";
import {
  LibraryMenuSection,
  LibraryMenuSectionGrid,
} from "./LibraryMenuSection";

import Spinner from "./Spinner";
import Stack from "./Stack";

import "./LibraryMenuItems.scss";

import type {
  ExcalidrawProps,
  LibraryItem,
  LibraryItems,
  UIAppState,
} from "../types";

// IconsAPI相关类型定义
interface IconElement {
  _id: string;
  iconName: string;
  url: string;
}

interface IconsAPIResponse {
  q: string;
  pages: {
    curPage: number;
    elements: IconElement[];
    elementsCount: number;
    pageCount: number;
    pageSize: number;
  };
}

interface IconItem {
  id: string;
  name: string;
  url: string;
  elements: LibraryItem["elements"];
}

// using an odd number of items per batch so the rendering creates an irregular
// pattern which looks more organic
const ITEMS_RENDERED_PER_BATCH = 17;
// when render outputs cached we can render many more items per batch to
// speed it up
const CACHED_ITEMS_RENDERED_PER_BATCH = 64;

// IconsAPI配置
const ICONS_API_BASE_URL = "https://iconsapi.com";
const ICONS_API_KEY = "68a2cc9de4b04803016349a1"; // 示例中的appkey

// 从IconsAPI获取图标
const fetchIconsFromAPI = async (
  query: string,
  page = 1,
  size = 20,
): Promise<IconsAPIResponse> => {
  try {
    const response = await fetch(
      `${ICONS_API_BASE_URL}/api/search?appkey=${ICONS_API_KEY}&query=${encodeURIComponent(
        query,
      )}&page=${page}&size=${size}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch icons:", error);
    return {
      q: query,
      pages: {
        curPage: 1,
        elements: [],
        elementsCount: 0,
        pageCount: 0,
        pageSize: 20,
      },
    };
  }
};

// 将SVG URL转换为Excalidraw图像元素
const convertSvgToExcalidrawElement = async (
  iconId: string,
  iconUrl: string,
): Promise<{ element: LibraryItem["elements"]; fileData?: any }> => {
  try {
    // 创建网络图像元素，直接使用imageUrl
    const element = newImageElement({
      type: "image",
      x: 0,
      y: 0,
      width: 64,
      height: 64,
      imageUrl: iconUrl, // 直接使用网络图片URL
      status: "saved",
      scale: [1, 1],
    });

    // 网络图像不需要文件数据
    return {
      element: [element],
    };
  } catch (error) {
    console.error("Failed to convert SVG to element:", error);
    return { element: [] };
  }
};

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

  // 图标搜索相关状态
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<IconItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const showIconSearch = true; // 默认显示图标搜索

  // This effect has to be called only on first render, therefore  `scrollPosition` isn't in the dependency array
  useEffect(() => {
    if (scrollPosition > 0) {
      libraryContainerRef.current?.scrollTo(0, scrollPosition);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 处理图标搜索
  const handleIconSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetchIconsFromAPI(query);
      const iconItems: IconItem[] = await Promise.all(
        response.pages.elements.map(async (iconElement) => {
          const result = await convertSvgToExcalidrawElement(
            iconElement._id,
            iconElement.url,
          );
          return {
            id: iconElement._id,
            name: iconElement.iconName,
            url: iconElement.url,
            elements: result.element,
          };
        }),
      );
      setSearchResults(iconItems);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 防抖搜索
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery && showIconSearch) {
        handleIconSearch(searchQuery);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, showIconSearch, handleIconSearch]);

  // 处理搜索输入变化
  const handleSearchInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(event.target.value);
    },
    [],
  );

  // 切换图标搜索显示 (暂时未使用，保留以备后用)
  // const toggleIconSearch = useCallback(() => {
  //   setShowIconSearch(!showIconSearch);
  //   if (!showIconSearch) {
  //     setSearchQuery("");
  //     setSearchResults([]);
  //   }
  // }, [showIconSearch]);

  const { svgCache } = useLibraryCache();
  const unpublishedItems = useMemo(
    () => libraryItems.filter((item) => item.status !== "published"),
    [libraryItems],
  );

  const publishedItems = useMemo(
    () => libraryItems.filter((item) => item.status === "published"),
    [libraryItems],
  );

  const showBtn = !libraryItems.length && !pendingElements.length;

  const isLibraryEmpty =
    !pendingElements.length &&
    !unpublishedItems.length &&
    !publishedItems.length;

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

  // 处理图标点击
  const onIconClick = useCallback(
    (iconItem: IconItem) => {
      // 创建一个临时的LibraryItem来插入图标
      const libraryItem: LibraryItem = {
        id: iconItem.id,
        status: "unpublished",
        elements: iconItem.elements,
        created: Date.now(),
      };

      // TODO: 需要找到一种方式将文件数据传递给应用
      // 目前先使用标准的库项目插入方式
      onInsertLibraryItems([libraryItem]);
    },
    [onInsertLibraryItems],
  );

  // 处理图标拖拽
  const onIconDrag = useCallback(
    (iconItem: IconItem, event: React.DragEvent) => {
      // 创建一个临时的LibraryItem来进行拖拽
      const libraryItem: LibraryItem = {
        id: iconItem.id,
        status: "unpublished",
        elements: iconItem.elements,
        created: Date.now(),
      };

      // 使用标准的库序列化格式
      event.dataTransfer.setData(
        MIME_TYPES.excalidrawlib,
        serializeLibraryAsJSON([libraryItem]),
      );
    },
    [],
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
      {!isLibraryEmpty && (
        <LibraryDropdownMenu
          selectedItems={selectedItems}
          onSelectItems={onSelectItems}
          className="library-menu-dropdown-container--in-heading"
        />
      )}

      {/* 图标搜索区域 */}
      <div
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          {/* <button
            onClick={toggleIconSearch}
            style={{
              background: "none",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              padding: "4px 8px",
              cursor: "pointer",
              fontSize: "12px",
              color: "var(--color-text)",
            }}
          >
            {showIconSearch ? "隐藏图标搜索" : "搜索图标"}
          </button> */}
        </div>

        {showIconSearch && (
          <div>
            <div style={{ position: "relative", marginBottom: "8px" }}>
              <input
                type="text"
                placeholder="搜索图标..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                style={{
                  width: "80%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "4px",
                  fontSize: "14px",
                  backgroundColor: "var(--color-surface-low)",
                  color: "var(--color-text)",
                }}
              />
              {isSearching && (
                <div
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                >
                  <Spinner size="16px" />
                </div>
              )}
            </div>

            {searchResults.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-secondary)",
                    marginBottom: "8px",
                  }}
                >
                  找到 {searchResults.length} 个图标
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))",
                    gap: "4px",
                    maxHeight: "200px",
                    overflowY: "auto",
                    padding: "4px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "4px",
                    backgroundColor: "var(--color-surface-low)",
                  }}
                >
                  {searchResults.map((iconItem) => (
                    <div
                      key={iconItem.id}
                      draggable={true}
                      onClick={() => onIconClick(iconItem)}
                      style={{
                        width: "48px",
                        height: "48px",
                        border: "1px solid var(--color-border)",
                        borderRadius: "4px",
                        cursor: "grab",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "var(--color-surface)",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "var(--color-surface-high)";
                        e.currentTarget.style.transform = "scale(1.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "var(--color-surface)";
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                      onDragStart={(e) => {
                        e.currentTarget.style.cursor = "grabbing";
                        onIconDrag(iconItem, e);
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.style.cursor = "grab";
                      }}
                    >
                      <img
                        src={iconItem.url}
                        alt={iconItem.name || `Icon ${iconItem.id}`}
                        title={iconItem.name || iconItem.id}
                        style={{
                          width: "32px",
                          height: "32px",
                          objectFit: "contain",
                        }}
                        onError={(e) => {
                          // 如果图标加载失败，显示一个占位符
                          e.currentTarget.style.display = "none";
                          e.currentTarget.parentElement!.innerHTML = "?";
                          e.currentTarget.parentElement!.style.fontSize =
                            "20px";
                          e.currentTarget.parentElement!.style.color =
                            "var(--color-text-secondary)";
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchQuery && !isSearching && searchResults.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: "var(--color-text-secondary)",
                  fontSize: "14px",
                  padding: "16px",
                }}
              >
                未找到相关图标
              </div>
            )}
          </div>
        )}
      </div>
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
      </Stack.Col>
    </div>
  );
}
