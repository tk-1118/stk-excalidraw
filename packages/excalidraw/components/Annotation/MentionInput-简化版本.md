# MentionInput 简化版本说明

## 核心改进

根据您的建议，MentionInput 组件现在采用更简洁的设计：

### 🎯 **设计原则**
- **接受 HTML 用于回显**: `value` 属性接受包含 HTML 标签的内容
- **抛出 HTML 用于保存**: `onChange` 回调直接传递 HTML 内容
- **直接操作 formData.interaction**: 不需要额外的状态管理

## 修改内容

### 1. **AnnotationSidebar.tsx 简化**

#### 移除了额外状态
```typescript
// ❌ 移除了不必要的状态
// const [interactionHtml, setInteractionHtml] = useState("");
```

#### 简化了 MentionInput 使用
```typescript
<MentionInput
  value={formData.interaction}  // 直接使用 formData.interaction
  onChange={(html: string) => {
    // MentionInput 直接传递HTML内容
    handleInputChange("interaction", html);
  }}
  applicationServiceTree={applicationServiceTree}
  // ... 其他属性
/>
```

#### 简化了提交逻辑
```typescript
const handleConfirm = () => {
  const jsonData = {
    // ... 其他字段
    interaction: formData.interaction || "无描述",  // 直接使用，无需额外处理
  };
  onConfirm(JSON.stringify(jsonData));
};
```

### 2. **MentionInput.tsx 优化**

#### onChange 回调传递 HTML
```typescript
const handleInput = useCallback((event: React.FormEvent<HTMLDivElement>) => {
  // ...
  const text = editableDivRef.current.textContent || "";
  const html = editableDivRef.current.innerHTML || "";
  setLocalValue(text);
  // 传递HTML内容给onChange回调，用于保存
  onChange?.(html);
  // ...
}, []);
```

#### 接口文档更新
```typescript
interface MentionInputProps {
  /** 输入值，支持HTML内容用于回显 */
  value?: string;
  /** 值变化回调，传递HTML内容用于保存 */
  onChange?: (html: string) => void;
  // ... 其他属性
}
```

## 数据流简化

### 原来的复杂流程
```
用户输入 → onChange(纯文本) → formData.interaction
        → onMentionHtml(HTML) → interactionHtml

保存时 → 优先使用 interactionHtml || formData.interaction
回显时 → 检查HTML → 设置到不同状态
```

### 现在的简化流程
```
用户输入 → onChange(HTML) → formData.interaction

保存时 → 直接使用 formData.interaction
回显时 → 直接传递 formData.interaction 给 MentionInput
```

## 优势

### 1. **代码更简洁**
- 移除了额外的状态管理
- 减少了条件判断逻辑
- 统一了数据处理方式

### 2. **逻辑更清晰**
- 单一数据源：`formData.interaction`
- 单一数据格式：HTML 内容
- 单一处理流程：HTML in, HTML out

### 3. **维护更容易**
- 减少了状态同步问题
- 降低了出错概率
- 提高了代码可读性

## 使用示例

### 基础使用
```typescript
const [formData, setFormData] = useState({
  interaction: "", // 直接存储HTML内容
});

const handleInputChange = (field: string, value: string) => {
  setFormData(prev => ({
    ...prev,
    [field]: value, // value 已经是HTML格式
  }));
};

<MentionInput
  value={formData.interaction}  // 可能包含HTML标签
  onChange={(html) => handleInputChange("interaction", html)}
  applicationServiceTree={applicationServiceTree}
/>
```

### 数据保存
```typescript
const handleConfirm = () => {
  const jsonData = {
    interaction: formData.interaction, // 已经是HTML格式，直接使用
  };
  // 保存到后端或本地存储
  onConfirm(JSON.stringify(jsonData));
};
```

### 数据回显
```typescript
// 从后端或本地存储读取数据
const parsedData = JSON.parse(savedData);
setFormData({
  interaction: parsedData.interaction, // 可能包含HTML标签，直接设置
});

// MentionInput 会自动处理HTML内容的显示
```

## 测试验证

### 测试场景
1. **纯文本输入**: 输入普通文本，确保正常保存和回显
2. **HTML内容输入**: 输入包含@提及的内容，确保HTML标签正确处理
3. **混合内容**: 输入包含文本和多个提及标签的复杂内容
4. **编辑操作**: 删除、修改提及标签，确保数据同步

### 预期结果
- ✅ 所有操作都通过 `formData.interaction` 统一管理
- ✅ HTML 内容能正确保存和回显
- ✅ 提及标签保持交互性
- ✅ 数据结构保持一致性

## 总结

通过这次简化，MentionInput 组件现在：
- **更符合 React 的单向数据流原则**
- **减少了不必要的状态管理复杂性**
- **提供了更直观的 API 接口**
- **降低了集成和维护成本**

这个设计更加简洁、可靠，符合"接受HTML用于回显，抛出HTML用于保存，直接操作formData.interaction"的要求。
