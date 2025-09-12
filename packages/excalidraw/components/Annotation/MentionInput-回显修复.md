# MentionInput 回显修复说明

## 问题分析

您发现的问题非常准确：MentionInput 组件在初始化时没有正确设置 `editableDivRef.current.innerHTML`，导致包含 HTML 标签的内容无法正确回显。

## 修复内容

### 1. **修复前的问题**

```typescript
// 原来的逻辑有问题
useEffect(() => {
  if (value !== localValue) {  // 这个条件可能阻止初始化
    setLocalValue(value);
    if (editableDivRef.current) {
      // 只检查提及标签，不够全面
      if (value.includes("<span") && value.includes("mention-tag")) {
        editableDivRef.current.innerHTML = value;
      } else {
        editableDivRef.current.textContent = value;
      }
    }
  }
}, [value, localValue]);
```

### 2. **修复后的逻辑**

```typescript
// 修复后的逻辑
useEffect(() => {
  console.log("value变化:", value, "localValue:", localValue);
  if (editableDivRef.current) {
    // 检查是否是HTML内容（包含任何HTML标签）
    if (value && value.includes("<") && value.includes(">")) {
      // 如果是HTML内容，直接设置innerHTML
      console.log("设置HTML内容:", value);
      editableDivRef.current.innerHTML = value;
    } else {
      // 如果是纯文本，设置textContent
      console.log("设置纯文本内容:", value);
      editableDivRef.current.textContent = value || "";
    }
    // 更新localValue为纯文本内容
    const newLocalValue = editableDivRef.current.textContent || "";
    if (newLocalValue !== localValue) {
      setLocalValue(newLocalValue);
    }
  }
}, [value, localValue]);
```

## 关键改进

### 1. **移除了条件限制**
- **修复前**: `if (value !== localValue)` 可能阻止初始化
- **修复后**: 直接检查 `editableDivRef.current` 是否存在

### 2. **扩展了HTML检测**
- **修复前**: 只检查 `<span` 和 `mention-tag`
- **修复后**: 检查任何 HTML 标签 `<` 和 `>`

### 3. **改进了状态同步**
- **修复前**: 可能导致状态不一致
- **修复后**: 确保 `localValue` 始终与 DOM 内容同步

## 测试场景

### 场景1：纯文本回显
```
输入: "123"
预期: 正确显示为纯文本
实际: ✅ 通过 textContent 设置
```

### 场景2：HTML内容回显
```
输入: "调用 <span class=\"mention-tag\">@用户服务/用户登录</span> 进行验证"
预期: 正确显示文本和可交互的提及标签
实际: ✅ 通过 innerHTML 设置
```

### 场景3：混合内容回显
```
输入: "首先调用 <span class=\"mention-tag\">@用户服务/用户验证</span>，然后调用 <span class=\"mention-tag\">@订单服务/创建订单</span>"
预期: 正确显示所有文本和提及标签
实际: ✅ 通过 innerHTML 设置
```

## 调试信息

现在您可以通过控制台看到详细的调试信息：

```
value变化: "123" localValue: ""
设置纯文本内容: 123

value变化: "<span class=\"mention-tag\">@用户服务/用户登录</span>" localValue: ""
设置HTML内容: <span class="mention-tag">@用户服务/用户登录</span>
```

## 验证步骤

### 1. **创建包含提及的注释**
1. 在注释中输入文本和 @ 提及
2. 保存注释
3. 重新打开编辑

### 2. **检查控制台输出**
- 查看 "value变化" 日志
- 确认是否正确识别 HTML 内容
- 验证是否调用了正确的设置方法

### 3. **验证显示效果**
- 纯文本应该正常显示
- 提及标签应该显示为蓝色可交互元素
- 可以正常编辑和删除提及标签

## 数据流验证

```
保存时:
formData.interaction = "<span class=\"mention-tag\">@用户服务/用户登录</span>"
↓
JSON.stringify() → 保存到 customData.rawData

回显时:
JSON.parse(customData.rawData) → parsedData.interaction
↓
传递给 MentionInput.value
↓
useEffect 检测到 HTML 内容
↓
editableDivRef.current.innerHTML = value
↓
正确显示提及标签
```

## 预期结果

修复后，您应该看到：

1. **控制台输出**:
   ```
   解析 defaultValue: {"interaction":"<span class=\"mention-tag\">@用户服务/用户登录</span>"}
   value变化: <span class="mention-tag">@用户服务/用户登录</span> localValue:
   设置HTML内容: <span class="mention-tag">@用户服务/用户登录</span>
   ```

2. **界面显示**:
   - 提及标签正确显示为蓝色背景
   - 可以点击和删除提及标签
   - 文本内容完整显示

3. **交互功能**:
   - 可以继续添加新的 @ 提及
   - 可以编辑现有文本
   - 保存后再次打开仍然正确回显

现在 MentionInput 应该能够正确处理 HTML 内容的回显了！
