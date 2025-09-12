import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";

import "./MentionInput.scss";

/**
 * 应用服务信息接口
 */
interface ApplicationServiceInfo {
  applicationServiceName: string;
  applicationServiceEnglishName: string;
  [key: string]: any;
}

/**
 * 业务服务信息接口
 */
interface BusinessServiceInfo {
  businessServiceName: string;
  businessServiceEnglishName: string;
  applicationServiceInfoList?: ApplicationServiceInfo[];
  [key: string]: any;
}

/**
 * 应用服务接口
 */
interface ApplicationService {
  id: string;
  name: string;
  description?: string;
  category?: string;
  boundedContextSN?: string;
  businessServiceSN?: string;
  applicationServiceSN?: string;
  boundedContextName?: string;
  boundedContextEnglishName?: string;
  businessServiceInfoList?: BusinessServiceInfo[];
}

/**
 * 服务选项接口
 */
interface ServiceOption {
  name: string;
  type: string;
  boundedContextSN?: string;
  businessServiceSN?: string;
  applicationServiceSN?: string;
  boundedContextName?: string;
  boundedContextEnglishName?: string;
  businessServiceName?: string;
  businessServiceEnglishName?: string;
  applicationServiceName?: string;
  applicationServiceEnglishName?: string;
}

/**
 * 级联选择器选项接口
 */
interface CascaderOption {
  title: string;
  services: ServiceOption[];
}

/**
 * MentionInput 组件属性接口
 */
interface MentionInputProps {
  /** 输入值 */
  value?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 占位符文本 */
  placeholder?: string;
  /** 应用服务树数据 */
  applicationServiceTree?: ApplicationService[];
  /** 值变化回调，传递HTML内容用于保存 */
  onChange?: (html: string) => void;
  /** 失焦回调 */
  onBlur?: () => void;
  /** 提及HTML内容回调 */
  onMentionHtml?: (html: string) => void;
  /** 提及JSON数据回调 */
  onMentionJson?: (json: any[]) => void;
  /** 提及选中回调 */
  onMentionSelected?: (mentions: any[]) => void;
  /** 类名 */
  className?: string;
  /** 样式 */
  style?: React.CSSProperties;
}

/**
 * MentionInput 组件引用接口
 */
interface MentionInputRef {
  focus: () => void;
  blur: () => void;
  getValue: () => string;
  getHtml: () => string;
}

/**
 * MentionInput 组件 - 支持@提及功能的富文本输入框
 */
const MentionInput = forwardRef<MentionInputRef, MentionInputProps>(
  (
    {
      value = "",
      disabled = false,
      placeholder = "",
      applicationServiceTree = [],
      onChange,
      onBlur,
      onMentionHtml,
      onMentionJson,
      onMentionSelected,
      className = "",
      style = {},
    },
    ref,
  ) => {
    // 状态管理
    const [localValue, setLocalValue] = useState(value);
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionSearchText, setMentionSearchText] = useState("");
    const [mentionStartPosition, setMentionStartPosition] = useState(0);
    const [mentionEndPosition, setMentionEndPosition] = useState(0);
    const [cascaderOptions, setCascaderOptions] = useState<CascaderOption[]>(
      [],
    );
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({
      position: "fixed",
      bottom: "0px",
      left: "0px",
      zIndex: 9999,
      maxHeight: "300px",
      backgroundColor: "white",
      borderRadius: "4px",
      boxShadow: "0 2px 12px 0 rgba(0,0,0,.1)",
      overflow: "auto",
    });

    // DOM 引用
    const editableDivRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // 选区管理
    const selectionRef = useRef<Selection | null>(null);
    const rangeRef = useRef<Range | null>(null);

    /**
     * 准备级联选择器数据
     */
    const prepareCascaderOptions = useCallback(() => {
      const options: CascaderOption[] = [];

      applicationServiceTree?.forEach((boundedContext) => {
        const cascaderOptionItem: CascaderOption = {
          title: boundedContext.boundedContextName || boundedContext.name,
          services: [],
        };

        boundedContext.businessServiceInfoList?.forEach((businessService) => {
          businessService.applicationServiceInfoList?.forEach(
            (applicationService) => {
              cascaderOptionItem.services.push({
                name: `${businessService.businessServiceName}/${applicationService.applicationServiceName}`,
                type: "application",
                boundedContextName:
                  boundedContext.boundedContextName || boundedContext.name,
                boundedContextEnglishName:
                  boundedContext.boundedContextEnglishName,
                businessServiceName: businessService.businessServiceName,
                businessServiceEnglishName:
                  businessService.businessServiceEnglishName,
                applicationServiceName:
                  applicationService.applicationServiceName,
                applicationServiceEnglishName:
                  applicationService.applicationServiceEnglishName,
                boundedContextSN: boundedContext.boundedContextSN,
                businessServiceSN: businessService.businessServiceSN,
                applicationServiceSN: applicationService.applicationServiceSN,
              });
            },
          );
        });

        if (cascaderOptionItem.services.length > 0) {
          options.push(cascaderOptionItem);
        }
      });

      setCascaderOptions(options);
    }, [applicationServiceTree]);

    /**
     * 更新下拉框位置
     */
    const updateDropdownPosition = useCallback(() => {
      if (!rangeRef.current || !dropdownRef.current) {
        return;
      }

      const rect = rangeRef.current.getBoundingClientRect();
      const dropdownRect = dropdownRef.current.getBoundingClientRect();

      const newStyle: React.CSSProperties = { ...dropdownStyle };

      // 水平位置计算
      if (rect.left + dropdownRect.width > window.innerWidth) {
        newStyle.right = "10px";
        newStyle.left = "auto";
      } else {
        newStyle.left = `${rect.left + window.scrollX}px`;
        newStyle.right = "auto";
      }

      // 垂直位置计算
      if (rect.bottom + dropdownRect.height > window.innerHeight) {
        newStyle.bottom = `${
          window.innerHeight - rect.top + window.scrollY + 5
        }px`;
        newStyle.top = "auto";
      } else {
        newStyle.top = `${rect.bottom + window.scrollY + 5}px`;
        newStyle.bottom = "auto";
      }

      setDropdownStyle(newStyle);
    }, [dropdownStyle]);

    /**
     * 显示/隐藏提及下拉框
     */
    const toggleMentionDropdown = useCallback(
      (show: boolean) => {
        setShowMentionDropdown(show);

        if (show) {
          prepareCascaderOptions();
          setTimeout(updateDropdownPosition, 0);
        }
      },
      [prepareCascaderOptions, updateDropdownPosition],
    );

    /**
     * 将HTML内容转换为JSON结构
     */
    const convertHtmlToJson = useCallback(() => {
      if (!editableDivRef.current) {
        return;
      }

      const jsonArray: Array<{
        type: string;
        text?: string;
        attrs?: Record<string, string>;
      }> = [];

      const processNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          if (text) {
            jsonArray.push({ type: "text", text });
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          if (element.classList.contains("mention-tag")) {
            const mentionType = element.getAttribute("data-type");

            if (mentionType === "application") {
              const boundedContextName =
                element.getAttribute("data-bounded-context") || "";
              const businessServiceName =
                element.getAttribute("data-business-service") || "";
              const applicationServiceName =
                element.getAttribute("data-application-service") || "";
              const boundedContextSN =
                element.getAttribute("data-bounded-context-SN") || "";
              const businessServiceSN =
                element.getAttribute("data-business-service-SN") || "";
              const applicationServiceSN =
                element.getAttribute("data-application-service-SN") || "";

              jsonArray.push({
                type: "mention",
                attrs: {
                  boundedContextName,
                  businessServiceName,
                  applicationServiceName,
                  boundedContextSN,
                  businessServiceSN,
                  applicationServiceSN,
                },
              });
            }
          } else {
            element.childNodes.forEach(processNode);
          }
        }
      };

      editableDivRef.current.childNodes.forEach(processNode);

      onMentionJson?.(jsonArray);
      onMentionSelected?.(jsonArray.filter((item) => item.type === "mention"));
    }, [onMentionJson, onMentionSelected]);

    /**
     * 获取当前选区信息
     */
    const getSelectionInfo = useCallback(() => {
      const selection = window.getSelection();
      const range = selection?.getRangeAt(0);

      if (selection && range) {
        selectionRef.current = selection;
        rangeRef.current = range;
      }

      if (
        !selectionRef.current ||
        !rangeRef.current ||
        !editableDivRef.current
      ) {
        return { node: null, offset: 0, range: null };
      }

      return {
        node: rangeRef.current.startContainer,
        offset: rangeRef.current.startOffset,
        range: rangeRef.current,
      };
    }, []);

    /**
     * 处理输入事件
     */
    const handleInput = useCallback(
      (event: React.FormEvent<HTMLDivElement>) => {
        // 阻止事件冒泡到画布
        event.stopPropagation();

        if (!editableDivRef.current) {
          return;
        }

        const text = editableDivRef.current.textContent || "";
        const html = editableDivRef.current.innerHTML || "";
        setLocalValue(text);
        // 传递HTML内容给onChange回调，用于保存
        onChange?.(html);

        // 检查是否正在输入@符号
        const { node, offset } = getSelectionInfo();
        if (node && node.nodeType === Node.TEXT_NODE) {
          const textContent = node.textContent || "";

          // 检测 @符号（支持行首或空格后的@）
          const beforeChar = offset > 0 ? textContent.charAt(offset - 2) : "";
          const currentChar = offset > 0 ? textContent.charAt(offset - 1) : "";

          if (
            (offset === 1 && currentChar === "@") ||
            (offset > 1 && /\s/.test(beforeChar) && currentChar === "@")
          ) {
            // 记录@的位置
            setMentionStartPosition(offset - 1);
            setMentionEndPosition(offset);
            setMentionSearchText("");
            toggleMentionDropdown(true);
          } else if (showMentionDropdown) {
            // 如果已经显示下拉框，更新搜索文本
            if (offset > mentionStartPosition) {
              const searchText = textContent.substring(
                mentionStartPosition + 1,
                offset,
              );
              setMentionSearchText(searchText);
              setMentionEndPosition(offset);
            } else {
              // 如果光标移动到@之前，关闭下拉框
              toggleMentionDropdown(false);
            }
          }
        }

        // 更新HTML内容
        onMentionHtml?.(editableDivRef.current.innerHTML);

        // 转换为JSON格式
        convertHtmlToJson();
      },
      [
        getSelectionInfo,
        showMentionDropdown,
        mentionStartPosition,
        onChange,
        onMentionHtml,
        toggleMentionDropdown,
        convertHtmlToJson,
      ],
    );

    /**
     * 选择提及项
     */
    const selectMention = useCallback(
      (service: ServiceOption) => {
        if (
          !editableDivRef.current ||
          !selectionRef.current ||
          !rangeRef.current
        ) {
          return;
        }

        // 创建提及元素
        const mentionElement = document.createElement("span");
        mentionElement.style.color = "#1c57d9";
        mentionElement.style.padding = "0 3px";
        mentionElement.style.backgroundColor = "#ecf5ff";
        mentionElement.style.borderRadius = "3px";
        mentionElement.style.margin = "0 1px";
        mentionElement.style.fontWeight = "500";
        mentionElement.style.whiteSpace = "nowrap";

        mentionElement.classList.add("mention-tag");
        mentionElement.contentEditable = "false";
        mentionElement.textContent = `@${service.name}`;
        mentionElement.setAttribute("data-type", service.type);
        mentionElement.setAttribute(
          "data-bounded-context",
          service.boundedContextName || "",
        );
        mentionElement.setAttribute(
          "data-business-service",
          service.businessServiceName || "",
        );
        mentionElement.setAttribute(
          "data-application-service",
          service.applicationServiceName || "",
        );
        mentionElement.setAttribute(
          "data-bounded-context-SN",
          service.boundedContextSN || "",
        );
        mentionElement.setAttribute(
          "data-business-service-SN",
          service.businessServiceSN || "",
        );
        mentionElement.setAttribute(
          "data-application-service-SN",
          service.applicationServiceSN || "",
        );

        // 删除@和搜索文本
        rangeRef.current.setStart(
          rangeRef.current.startContainer,
          mentionStartPosition,
        );
        rangeRef.current.setEnd(
          rangeRef.current.startContainer,
          mentionEndPosition,
        );
        rangeRef.current.deleteContents();

        // 创建空格节点
        const spaceNode1 = document.createTextNode("\u00A0");
        const spaceNode2 = document.createTextNode("\u00A0");

        // 插入节点
        rangeRef.current.insertNode(spaceNode1);
        rangeRef.current.insertNode(mentionElement);
        rangeRef.current.insertNode(spaceNode2);

        // 将光标移动到提及元素后
        rangeRef.current.setStartAfter(mentionElement);
        rangeRef.current.collapse(true);
        selectionRef.current.removeAllRanges();
        selectionRef.current.addRange(rangeRef.current);

        // 关闭下拉框
        toggleMentionDropdown(false);

        // 更新值
        const text = editableDivRef.current.textContent || "";
        const html = editableDivRef.current.innerHTML || "";
        setLocalValue(text);
        // 传递HTML内容给onChange回调，用于保存
        onChange?.(html);
        onMentionHtml?.(html);
        convertHtmlToJson();
      },
      [
        mentionStartPosition,
        mentionEndPosition,
        onChange,
        onMentionHtml,
        convertHtmlToJson,
        toggleMentionDropdown,
      ],
    );

    /**
     * 查找指定位置的提及元素
     */
    const findMentionElementAtPosition = useCallback(
      (node: Node, offset: number): HTMLElement | null => {
        // 如果当前节点是文本节点，检查其父节点是否是提及元素
        if (
          node.nodeType === Node.TEXT_NODE &&
          node.parentElement?.classList.contains("mention-tag")
        ) {
          return node.parentElement;
        }

        // 如果当前节点是元素节点，检查是否是提及元素
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          (node as HTMLElement).classList.contains("mention-tag")
        ) {
          return node as HTMLElement;
        }

        // 检查相邻节点
        if (
          node.nodeType === Node.TEXT_NODE &&
          offset === 0 &&
          node.previousSibling
        ) {
          const prevSibling = node.previousSibling;
          if (
            prevSibling.nodeType === Node.ELEMENT_NODE &&
            (prevSibling as HTMLElement).classList.contains("mention-tag")
          ) {
            return prevSibling as HTMLElement;
          }
        }

        if (
          node.nodeType === Node.TEXT_NODE &&
          offset === node.textContent?.length &&
          node.nextSibling
        ) {
          const nextSibling = node.nextSibling;
          if (
            nextSibling.nodeType === Node.ELEMENT_NODE &&
            (nextSibling as HTMLElement).classList.contains("mention-tag")
          ) {
            return nextSibling as HTMLElement;
          }
        }

        return null;
      },
      [],
    );

    /**
     * 处理键盘事件
     */
    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent) => {
        // 阻止事件冒泡到画布，避免触发画布的快捷键
        event.stopPropagation();

        if (showMentionDropdown && event.key === "Escape") {
          toggleMentionDropdown(false);
          event.preventDefault();
          return;
        }

        // 处理删除键，如果在提及元素内，则删除整个提及
        if (
          (event.key === "Backspace" || event.key === "Delete") &&
          editableDivRef.current
        ) {
          const selection = window.getSelection();
          const range = selection?.getRangeAt(0);

          if (!selection || !range) {
            return;
          }

          const node = range.startContainer;
          const mentionElement = findMentionElementAtPosition(
            node,
            range.startOffset,
          );

          if (mentionElement) {
            event.preventDefault();
            mentionElement.remove();

            const text = editableDivRef.current.textContent || "";
            const html = editableDivRef.current.innerHTML || "";
            setLocalValue(text);
            // 传递HTML内容给onChange回调，用于保存
            onChange?.(html);
            onMentionHtml?.(html);
            convertHtmlToJson();
          }
        }
      },
      [
        showMentionDropdown,
        toggleMentionDropdown,
        findMentionElementAtPosition,
        onChange,
        onMentionHtml,
        convertHtmlToJson,
      ],
    );

    /**
     * 处理失焦事件
     */
    const handleBlur = useCallback(
      (event: React.FocusEvent) => {
        // 阻止事件冒泡
        event.stopPropagation();

        setTimeout(() => {
          setShowMentionDropdown(false);
        }, 200);
        onBlur?.();
      },
      [onBlur],
    );

    /**
     * 处理聚焦事件
     */
    const handleFocus = useCallback((event: React.FocusEvent) => {
      // 阻止事件冒泡到画布
      event.stopPropagation();
    }, []);

    /**
     * 处理鼠标事件
     */
    const handleMouseDown = useCallback((event: React.MouseEvent) => {
      // 阻止事件冒泡到画布
      event.stopPropagation();
    }, []);

    const handleMouseUp = useCallback((event: React.MouseEvent) => {
      // 阻止事件冒泡到画布
      event.stopPropagation();
    }, []);

    const handleClick = useCallback((event: React.MouseEvent) => {
      // 阻止事件冒泡到画布
      event.stopPropagation();
    }, []);

    /**
     * 处理键盘按下事件（keyup）
     */
    const handleKeyUp = useCallback((event: React.KeyboardEvent) => {
      // 阻止事件冒泡到画布
      event.stopPropagation();
    }, []);

    /**
     * 过滤服务选项
     */
    const filteredOptions = cascaderOptions
      .map((option) => ({
        ...option,
        services: option.services.filter((service) => {
          return service.name
            .toLowerCase()
            .includes(mentionSearchText.toLowerCase());
        }),
      }))
      .filter((option) => option.services.length > 0);

    // 暴露组件方法
    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          editableDivRef.current?.focus();
        },
        blur: () => {
          editableDivRef.current?.blur();
        },
        getValue: () => localValue,
        getHtml: () => editableDivRef.current?.innerHTML || "",
      }),
      [localValue],
    );

    /**
     * 保存光标位置
     */
    const saveCursorPosition = useCallback(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && editableDivRef.current) {
        const range = selection.getRangeAt(0);
        // 计算光标在文本中的偏移量
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(editableDivRef.current);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        return preCaretRange.toString().length;
      }
      return 0;
    }, []);

    /**
     * 恢复光标位置
     */
    const restoreCursorPosition = useCallback((offset: number) => {
      if (!editableDivRef.current) {
        return;
      }

      const selection = window.getSelection();
      if (!selection) {
        return;
      }

      let currentOffset = 0;
      const walker = document.createTreeWalker(
        editableDivRef.current,
        NodeFilter.SHOW_TEXT,
        null,
      );

      let node;
      while ((node = walker.nextNode())) {
        const textLength = node.textContent?.length || 0;
        if (currentOffset + textLength >= offset) {
          const range = document.createRange();
          range.setStart(node, offset - currentOffset);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }
        currentOffset += textLength;
      }

      // 如果偏移量超出了文本长度，将光标放在最后
      const range = document.createRange();
      range.selectNodeContents(editableDivRef.current);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }, []);

    // 监听value变化并设置内容
    useEffect(() => {
      console.log("value变化:", value, "localValue:", localValue);
      if (editableDivRef.current) {
        const currentContent = editableDivRef.current.innerHTML;

        // 只有当内容真正不同时才更新DOM
        if (currentContent !== value) {
          // 保存当前光标位置（只在内容变化时）
          const cursorPosition = saveCursorPosition();

          // 检查是否是HTML内容（包含HTML标签）
          if (value && value.includes("<") && value.includes(">")) {
            // 如果是HTML内容，直接设置innerHTML
            console.log("设置HTML内容:", value);
            editableDivRef.current.innerHTML = value;
          } else {
            // 如果是纯文本，设置textContent
            console.log("设置纯文本内容:", value);
            editableDivRef.current.textContent = value || "";
          }

          // 恢复光标位置（延迟执行，确保DOM更新完成）
          setTimeout(() => {
            restoreCursorPosition(cursorPosition);
          }, 0);
        }

        // 更新localValue为纯文本内容
        const newLocalValue = editableDivRef.current.textContent || "";
        if (newLocalValue !== localValue) {
          setLocalValue(newLocalValue);
        }
      }
    }, [value, localValue, saveCursorPosition, restoreCursorPosition]);

    // 监听应用服务树变化
    useEffect(() => {
      prepareCascaderOptions();
    }, [prepareCascaderOptions]);

    return (
      <div
        ref={wrapperRef}
        className={`mention-input-wrapper ${className}`}
        style={style}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
      >
        <div
          ref={editableDivRef}
          className={`mention-input-editable ${!localValue ? "is-empty" : ""}`}
          contentEditable={!disabled}
          data-placeholder={placeholder}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          style={{
            pointerEvents: disabled ? "none" : "auto",
            opacity: disabled ? 0.5 : 1,
          }}
        />

        {showMentionDropdown && (
          <div
            ref={dropdownRef}
            className="mention-dropdown"
            style={dropdownStyle}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="mention-dropdown-content">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => (
                  <div key={index} className="mention-option-group">
                    <div className="mention-option-group-title">
                      《{option.title}》业务服务下的应用服务
                    </div>
                    {option.services.map((service, serviceIndex) => (
                      <div
                        key={serviceIndex}
                        className="mention-option-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectMention(service);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >
                        <span className="mention-option-name">
                          {service.name}
                        </span>
                        {/* <span className="mention-option-type">
                          {service.type}
                        </span> */}
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="mention-no-options">暂无匹配的服务</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

MentionInput.displayName = "MentionInput";

export default MentionInput;
export type {
  MentionInputProps,
  MentionInputRef,
  ApplicationService,
  ServiceOption,
};
