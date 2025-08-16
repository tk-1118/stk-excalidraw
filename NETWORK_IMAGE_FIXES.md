# 网络图片粘贴功能修复

本次修复解决了网络图片粘贴功能中的三个主要问题：

## 修复的问题

### 1. 加载特效缺失
**问题描述**：粘贴图片网络路径时，加载过程中没有任何视觉反馈，用户不知道图片正在加载。

**修复方案**：
- 在 `packages/element/src/renderElement.ts` 中添加了 `drawLoadingSpinner` 函数
- 修改了 `drawImagePlaceholder` 函数，支持显示加载动画
- 在图片渲染逻辑中检测网络图片的加载状态，显示相应的加载动画

**技术细节**：
- 加载动画使用旋转的圆点效果
- 动画基于时间戳实现平滑旋转
- 只在网络图片加载中状态时显示

### 2. 图片尺寸问题
**问题描述**：网络图片必须手动拉伸才能正确显示，默认尺寸不合适。

**修复方案**：
- 在 `packages/excalidraw/data/imageHandler.ts` 中添加了 `getImageDimensions` 函数
- 添加了 `calculateDisplaySize` 函数来计算合适的显示尺寸
- 修改了 `processImageInput` 函数，在创建网络图片元素前获取实际尺寸

**技术细节**：
- 异步获取图片的 `naturalWidth` 和 `naturalHeight`
- 根据最大尺寸限制（800x600）计算合适的显示尺寸
- 保持图片原始宽高比
- 如果获取尺寸失败，回退到默认尺寸

### 3. 缓存干扰问题
**问题描述**：粘贴非图片内容（如文本、Base64图片）时，仍然显示上一次的网络图片。

**修复方案**：
- 在 `packages/excalidraw/components/App.tsx` 中添加了 `clearStaleNetworkImageCache` 方法
- 在粘贴非图片内容时调用缓存清理
- 智能重新加载当前场景中仍需要的网络图片

**技术细节**：
- 分析当前场景中的网络图片元素
- 清理整个网络图片缓存
- 异步重新加载仍在使用的网络图片
- 避免阻塞用户操作

## 修改的文件

1. **packages/element/src/renderElement.ts**
   - 添加加载动画绘制函数
   - 修改图片占位符显示逻辑
   - 增强网络图片渲染状态检测

2. **packages/excalidraw/data/imageHandler.ts**
   - 添加图片尺寸获取功能
   - 实现智能尺寸计算
   - 优化网络图片处理流程

3. **packages/excalidraw/components/App.tsx**
   - 添加网络图片缓存管理
   - 修改粘贴处理逻辑
   - 实现智能缓存清理

## 测试方法

使用提供的测试页面 `packages/excalidraw/examples/network-image-paste-test.html`：

1. **加载特效测试**：
   - 粘贴网络图片URL
   - 观察是否显示旋转加载动画
   - 确认图片加载完成后动画消失

2. **尺寸自适应测试**：
   - 粘贴不同尺寸的网络图片
   - 确认图片以合适尺寸显示
   - 验证无需手动调整即可看到完整图片

3. **缓存清理测试**：
   - 先粘贴网络图片
   - 再粘贴文本或其他内容
   - 确认不会显示之前的网络图片

## 兼容性说明

- 所有修改都向后兼容
- 不影响现有的本地图片上传功能
- 不影响其他粘贴功能（文本、元素等）
- 网络图片验证功能保持可选

## 性能优化

- 图片尺寸获取使用异步加载，不阻塞UI
- 缓存清理采用智能策略，只清理不需要的缓存
- 加载动画使用高效的Canvas绘制
- 错误处理完善，避免功能异常

## 额外修复：本地图片缓存冲突

### 4. 本地图片显示网络图片问题
**问题描述**：粘贴网络图片后，再粘贴本地图片时，画布上仍显示之前的网络图片。

**修复方案**：
- 修改渲染优先级：优先使用本地文件缓存（fileId），只有在没有fileId时才使用网络图片链接
- 在所有本地图片处理路径中添加网络图片缓存清理
- 确保本地图片元素不保留imageUrl属性，避免缓存冲突

**技术细节**：
- 修改 `renderElement.ts` 中的渲染逻辑优先级
- 在粘贴、拖拽、文件选择等本地图片处理路径中调用缓存清理
- 在 `getLatestInitializedImageElement` 中显式清除imageUrl属性

**修改的额外文件**：
- `packages/element/src/renderElement.ts` - 调整渲染优先级
- `packages/excalidraw/components/App.tsx` - 多处添加缓存清理调用

## 最新修复：本地图片上传流程

### 5. 本地图片直接显示问题
**问题描述**：复制本地图片粘贴到画布时，没有先上传到服务器，而是直接使用本地文件显示。

**修复方案**：
- 修改粘贴处理逻辑，当配置了图片上传服务时，本地图片使用上传流程
- 修改`imageHandler.ts`，当没有上传配置时，回退到本地文件处理
- 在`handleImagesPaste`中添加回退机制，处理上传失败的情况

**技术细节**：
- 在`pasteFromClipboard`中检查是否配置了`imageUploadConfig`
- 如果有配置，调用`handleImagesPaste`进行上传处理
- 如果没有配置或上传失败，回退到`createImageElement`本地处理
- 更新测试页面，添加模拟上传配置用于验证

**修改的文件**：
- `packages/excalidraw/components/App.tsx` - 修改粘贴处理逻辑
- `packages/excalidraw/data/imageHandler.ts` - 添加回退机制
- `packages/excalidraw/examples/network-image-paste-test.html` - 添加上传测试

## 使用说明

### 配置图片上传服务

要启用本地图片上传功能，需要在Excalidraw组件中配置`imageUploadConfig`：

```tsx
<Excalidraw
  imageUploadConfig={{
    uploadUrl: 'https://your-upload-service.com/upload',
    headers: {
      'Authorization': 'Bearer your-token'
    },
    // 或者使用自定义上传函数
    customUpload: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      return result.url; // 返回上传后的图片URL
    }
  }}
/>
```

### 行为说明

1. **有上传配置时**：
   - 本地图片会先上传到服务器
   - 使用上传后的网络地址显示图片
   - 网络图片URL直接使用，不上传

2. **无上传配置时**：
   - 本地图片使用本地文件处理（fileId方式）
   - 网络图片URL直接使用

## 最终修复：ZZ-Infra配置集成

### 6. 本地图片上传未使用ZZ-Infra配置问题
**问题描述**：本地图片粘贴时没有使用项目中预定义的`zzInfraConfig`和`zzInfraCustomConfig`配置，而是依赖props传入的配置。

**修复方案**：
- 修改`handleImagesPaste`方法，优先使用ZZ-Infra配置
- 当没有通过props传入配置时，自动加载并使用`zzInfraCustomConfig`
- 修改粘贴处理逻辑，检测ZZ-Infra配置的可用性
- 清理`zzInfraConfig.ts`中的调试代码

**技术细节**：
- 在`handleImagesPaste`中动态导入ZZ-Infra配置
- 配置优先级：props配置 > ZZ-Infra配置 > 本地文件处理
- 添加配置检测和日志输出，便于调试
- 更新测试页面，支持真实ZZ-Infra配置测试

**修改的文件**：
- `packages/excalidraw/components/App.tsx` - 集成ZZ-Infra配置逻辑
- `packages/excalidraw/data/zzInfraConfig.ts` - 清理调试代码
- `packages/excalidraw/examples/network-image-paste-test.html` - 添加ZZ-Infra测试选项

### 最终行为说明

现在的完整行为流程：

1. **粘贴本地图片时**：
   - 首先检查是否通过props传入了`imageUploadConfig`
   - 如果没有，尝试加载`zzInfraCustomConfig`
   - 如果有任何上传配置，使用上传流程
   - 如果都没有，回退到本地文件处理

2. **上传配置优先级**：
   ```
   props.imageUploadConfig > zzInfraCustomConfig > 本地文件处理
   ```

3. **ZZ-Infra配置**：
   - 上传地址：`http://49.232.13.110:83/zz-infra/zz-resource/oss/endpoint/put-file-attach`
   - 支持认证token
   - 自动解析返回的`link`字段
   - 完整的错误处理和日志记录

## 严格模式修复：禁用本地文件回退

### 7. 上传失败时的本地文件回退问题
**问题描述**：当图片上传失败时，系统会回退到本地文件处理，这不符合预期行为。上传失败就应该失败，不应该有回退机制。

**修复方案**：
- 注释掉`handleImagesPaste`中的本地文件处理回退逻辑
- 修改`imageHandler.ts`，没有上传配置时直接返回错误
- 修改主粘贴处理逻辑，没有配置时显示错误而不是本地处理
- 保留文件选择器和拖拽导入的本地处理（用户主动操作）

**技术细节**：
- 粘贴本地图片时强制要求上传配置
- 上传失败时清除占位符，显示错误信息
- 区分用户主动操作（文件选择、拖拽）和被动操作（粘贴）
- 文件选择器和拖拽仍然支持本地文件处理

**修改的文件**：
- `packages/excalidraw/components/App.tsx` - 注释回退逻辑，严格错误处理
- `packages/excalidraw/data/imageHandler.ts` - 移除本地文件回退提示
- `packages/excalidraw/examples/network-image-paste-test.html` - 更新测试说明

### 最终严格行为

现在的行为更加严格和明确：

1. **粘贴本地图片**：
   - 必须有上传配置（props或ZZ-Infra）
   - 上传成功 → 显示网络图片
   - 上传失败 → 显示错误，清除占位符
   - 没有配置 → 显示错误信息

2. **文件选择器/拖拽**：
   - 仍然支持本地文件处理
   - 用户主动操作，允许本地显示

3. **网络图片URL**：
   - 直接使用，不需要上传

这样确保了粘贴操作的一致性：要么上传成功显示网络图片，要么失败显示错误，不会有混淆的中间状态。

## 完整修复：初始数据网络图片加载

### 8. 初始化画布时网络图片不加载问题
**问题描述**：当通过`initialData`或`updateScene`加载包含网络图片的JSON数据时，这些网络图片不会自动加载到缓存中，导致图片无法显示。

**修复方案**：
- 在画布初始化时添加网络图片预加载逻辑
- 在`syncActionResult`中添加网络图片预加载
- 创建专门的`preloadInitialNetworkImages`方法处理初始数据
- 添加详细的日志记录，便于调试

**技术细节**：
- 在`initializeScene`中调用`preloadInitialNetworkImages`
- 在`syncActionResult`中调用`preloadNetworkImages`
- 异步预加载，不阻塞初始化过程
- 预加载完成后自动触发重新渲染
- 添加控制台日志，显示预加载进度

**修改的文件**：
- `packages/excalidraw/components/App.tsx` - 添加初始数据预加载逻辑
- `packages/excalidraw/examples/network-image-paste-test.html` - 添加初始数据测试

### 完整的网络图片处理流程

现在网络图片在所有场景下都能正确处理：

1. **初始化场景**：
   ```
   加载initialData → 检测网络图片 → 预加载到缓存 → 自动渲染 ✅
   ```

2. **动态更新场景**：
   ```
   updateScene → 检测新的网络图片 → 预加载到缓存 → 自动渲染 ✅
   ```

3. **粘贴场景**：
   ```
   粘贴网络URL → 创建图片元素 → 预加载到缓存 → 自动渲染 ✅
   粘贴本地图片 → 上传到服务器 → 使用网络地址 → 预加载并渲染 ✅
   ```

4. **错误处理**：
   ```
   网络图片加载失败 → 显示占位符 → 记录错误日志 ✅
   上传失败 → 显示错误信息 → 清除占位符 ✅
   ```

## 测试验证

更新的测试页面现在包含：

1. **网络图片URL粘贴测试** - 验证直接粘贴网络地址
2. **本地图片上传测试** - 验证本地图片上传流程
3. **缓存清理测试** - 验证不同类型图片的缓存管理
4. **初始数据测试** - 验证JSON数据中的网络图片加载
5. **混合内容测试** - 验证复杂粘贴场景

## 后续改进建议

1. 可以考虑添加图片加载进度显示
2. 支持更多图片格式的智能识别
3. 优化大图片的加载和显示性能
4. 添加图片加载失败的重试机制
5. 进一步优化缓存策略，减少不必要的缓存清理
6. 添加上传进度显示和取消上传功能
7. 支持批量上传优化
8. 添加ZZ-Infra配置的动态切换功能
9. 支持多个上传服务的配置和切换
10. 添加上传重试机制和更详细的错误信息
11. 优化初始数据预加载的性能和用户体验
12. 添加网络图片缓存的持久化存储
