# MentionInput 光标位置修复

## 问题描述

当 MentionInput 组件通过 `innerHTML` 或 `textContent` 设置内容时，浏览器会重新构建 DOM 结构，导致光标位置丢失并自动跳转到内容开始位置。这会严重影响用户的编辑体验。

## 问题原因

### 1. **DOM 重建**
```typescript
// 当执行这些操作时，浏览器会重新构建DOM
editableDivRef.current.innerHTML = newValue;  // 重建整个DOM树
editableDivRef.current.textContent = newValue; // 清空并重新创建文本节点
```

### 2. **光标位置丢失**
- 原有的 Selection 和 Range 对象引用的 DOM 节点被销毁
- 浏览器默认将光标重置到内容开始位置
- 用户正在编辑的位置信息完全丢失

## 解决方案

### 1. **光标位置保存机制**

```typescript
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
```

**工作原理**:
- 获取当前选区的 Range 对象
- 创建一个从内容开始到光标位置的范围
- 计算这个范围内的文本长度，得到光标的文本偏移量

### 2. **光标位置恢复机制**

```typescript
const restoreCursorPosition = useCallback((offset: number) => {
  if (!editableDivRef.current) return;

  const selection = window.getSelection();
  if (!selection) return;

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
```

**工作原理**:
- 使用 TreeWalker 遍历所有文本节点
- 累计文本长度，找到目标偏移量对应的节点和位置
- 创建新的 Range 对象并设置到正确位置
- 更新浏览器的选区

### 3. **智能触发机制**

```typescript
useEffect(() => {
  if (editableDivRef.current) {
    const currentContent = editableDivRef.current.innerHTML;

    // 只有当内容真正不同时才更新DOM
    if (currentContent !== value) {
      // 保存当前光标位置
      const cursorPosition = saveCursorPosition();

      // 更新内容
      if (value && value.includes("<") && value.includes(">")) {
        editableDivRef.current.innerHTML = value;
      } else {
        editableDivRef.current.textContent = value || "";
      }

      // 恢复光标位置
      setTimeout(() => {
        restoreCursorPosition(cursorPosition);
      }, 0);
    }
  }
}, [value, localValue, saveCursorPosition, restoreCursorPosition]);
```

**优化特点**:
- 只在内容真正变化时才执行保存/恢复操作
- 使用 `setTimeout` 确保 DOM 更新完成后再恢复光标
- 避免不必要的性能开销

## 技术细节

### 1. **文本偏移量计算**
- 使用 `Range.toString()` 获取纯文本内容
- 忽略 HTML 标签，只计算实际文本字符
- 支持跨越多个文本节点的光标位置

### 2. **TreeWalker 遍历**
- `NodeFilter.SHOW_TEXT` 只遍历文本节点
- 跳过元素节点和其他类型节点
- 高效处理复杂的 DOM 结构

### 3. **边界情况处理**
- 光标在提及标签内部的处理
- 偏移量超出文本长度的处理
- 空内容或无选区的处理

## 使用场景

### 1. **初始化回显**
```
用户打开包含提及标签的注释
→ 设置 innerHTML 恢复内容
→ 保存/恢复光标位置
→ 光标保持在合理位置
```

### 2. **实时编辑**
```
用户正在编辑文本
→ 内容通过 props 更新
→ 检测到内容变化
→ 保存当前光标位置
→ 更新 DOM 内容
→ 恢复光标到原位置
```

### 3. **提及标签操作**
```
用户插入/删除提及标签
→ HTML 结构发生变化
→ 自动保存光标位置
→ 更新内容后恢复光标
→ 用户可以继续编辑
```

## 性能优化

### 1. **避免不必要的操作**
- 内容比较：`currentContent !== value`
- 只在真正需要时才执行保存/恢复

### 2. **异步恢复**
- 使用 `setTimeout(fn, 0)` 延迟恢复
- 确保 DOM 更新完成后再操作

### 3. **缓存机制**
- `useCallback` 缓存函数引用
- 避免不必要的重新创建

## 测试验证

### 测试场景
1. **初始化测试**: 打开包含提及的注释，光标应该在合理位置
2. **编辑测试**: 在文本中间编辑，光标不应该跳转
3. **提及测试**: 插入提及标签后，光标应该在标签后面
4. **删除测试**: 删除提及标签后，光标应该在删除位置

### 预期结果
- ✅ 光标位置在内容更新后保持稳定
- ✅ 用户编辑体验流畅自然
- ✅ 提及标签操作不影响光标位置
- ✅ 性能开销最小化

## 总结

通过实现光标位置的保存和恢复机制，MentionInput 组件现在可以：

1. **保持用户编辑状态**: 内容更新不会打断用户的编辑流程
2. **提供流畅体验**: 光标位置稳定，符合用户预期
3. **处理复杂场景**: 支持 HTML 内容和提及标签的复杂交互
4. **优化性能**: 智能触发，避免不必要的操作

这个修复确保了 MentionInput 组件在处理内容回显和实时更新时，能够提供与原生输入框一样流畅的用户体验。
