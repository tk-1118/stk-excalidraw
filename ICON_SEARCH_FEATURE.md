# 图标搜索功能说明

## 功能概述

在Excalidraw的右侧边栏素材库中新增了图标搜索功能，用户可以通过关键词搜索iconsapi.com提供的图标，并将其作为素材库资源使用。

## 功能特性

1. **搜索框界面**: 在素材库顶部添加了一个可折叠的搜索区域
2. **实时搜索**: 支持输入关键词后自动搜索图标（500ms防抖）
3. **图标预览**: 搜索结果以网格形式显示，每个图标都有预览
4. **一键插入**: 点击图标即可将其插入到画布中
5. **错误处理**: 包含加载状态指示器和错误处理

## 使用方法

1. 打开Excalidraw应用
2. 在右侧边栏找到素材库
3. 点击"搜索图标"按钮展开搜索区域
4. 在搜索框中输入关键词（如"home", "user", "settings"等）
5. 等待搜索结果加载
6. 使用图标的两种方式：
   - **点击插入**: 直接点击图标将其添加到画布中心
   - **拖拽插入**: 拖拽图标到画布的指定位置

## 技术实现

### API集成
- 使用iconsapi.com的搜索API
- API地址: `https://iconsapi.com/api/search`
- 参数: appkey, query, page, size

### API响应格式
```json
{
  "q": "搜索关键词",
  "pages": {
    "curPage": 1,
    "elements": [
      {
        "_id": "图标ID",
        "iconName": "图标名称",
        "url": "图标SVG地址"
      }
    ],
    "elementsCount": 1,
    "pageCount": 1,
    "pageSize": 20
  }
}
```

### 图标处理
- 将SVG图标转换为Excalidraw元素
- 目前使用矩形元素作为占位符，存储SVG数据在customData中
- 支持后续扩展为完整的SVG解析

### UI组件
- 响应式网格布局显示搜索结果
- 悬停效果和交互反馈
- 加载状态和错误状态处理

## 代码修改

主要修改文件: `packages/excalidraw/components/LibraryMenuItems.tsx`

### 新增功能:
1. IconsAPI相关类型定义
2. API调用函数 `fetchIconsFromAPI`
3. SVG转换函数 `convertSvgToExcalidrawElement`
4. 搜索状态管理
5. 搜索UI组件
6. 图标点击处理

## 注意事项

1. 当前实现使用示例API密钥，生产环境需要替换为正式密钥
2. 图标转换目前使用矩形占位符，可以扩展为完整的SVG解析
3. 搜索结果限制为20个，可以根据需要调整
4. 需要网络连接才能使用图标搜索功能

## 问题修复记录

### 2024-01-XX: API响应格式解析错误修复
- **问题**: 初始实现中错误假设API返回格式为 `{ q: string, pages: string[] }`
- **实际格式**: API返回的是嵌套对象结构，包含分页信息和图标元素数组
- **修复**: 更新了TypeScript类型定义和数据解析逻辑
- **改进**: 添加了图标名称显示和工具提示

### 2024-01-XX: 图标拖拽功能修复
- **问题**: 图标只能点击插入，无法拖拽到画布上
- **原因**: 缺少拖拽事件处理和数据传输设置
- **修复**: 
  - 添加了 `onIconDrag` 拖拽处理函数
  - 为图标元素添加 `draggable={true}` 属性
  - 实现 `onDragStart` 和 `onDragEnd` 事件处理
  - 设置正确的拖拽数据格式 (`MIME_TYPES.excalidrawlib`)
- **改进**: 
  - 拖拽时鼠标样式变为 "grabbing"
  - 与现有素材库拖拽行为保持一致

### 2024-01-XX: 图标显示问题修复
- **问题**: 图标能拖拽但无法在画布上显示
- **原因**: 使用矩形元素作为占位符，没有利用Excalidraw的网络图片支持
- **修复**:
  - 改用 `newImageElement` 创建图像元素而不是矩形元素
  - 直接使用图标URL作为 `dataURL`
  - 在拖拽数据中包含文件信息 (`files` 对象)
  - 设置正确的MIME类型为 `image/svg+xml`
- **技术细节**:
  - 创建包含 `libraryItems` 和 `files` 的拖拽数据结构
  - 使用图标ID作为 `fileId` 进行文件关联
  - 支持SVG图标的直接显示

### 2024-01-XX: "Invalid library"错误修复
- **问题**: 拖拽图标到画布时出现"Invalid library"错误
- **原因**: 拖拽数据格式不符合Excalidraw库的标准格式
- **修复**:
  - 使用标准的 `serializeLibraryAsJSON` 函数序列化库数据
  - 移除自定义的拖拽数据格式，使用Excalidraw标准格式
  - 简化图像元素创建，直接使用 `imageUrl` 属性
- **最终方案**:
  - 创建网络图像元素：`newImageElement({ imageUrl: iconUrl })`
  - 使用 `isNetworkImageElement` 检查，支持网络图片直接显示
  - 无需复杂的文件处理，直接使用URL

## 未来改进

1. 完整的SVG解析和渲染
2. 图标缓存机制
3. 更多搜索选项（分类、颜色等）
4. 图标收藏功能
5. 本地图标库支持
6. 分页支持（当前只显示第一页结果）
