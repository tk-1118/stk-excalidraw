# Excalidraw 示例文件

这个目录包含了各种Excalidraw功能的示例和演示文件。

## 图片URL粘贴功能示例

### 🎯 核心功能演示

- **`complete-image-paste-demo.html`** - 完整的Excalidraw图片URL粘贴功能演示
- **`debug-image-paste.html`** - 详细的调试页面，显示URL检测和图片加载过程
- **`simple-image-paste-test.html`** - 简单的URL检测测试页面

### 🔧 开发示例

- **`image-url-paste-demo.tsx`** - React组件示例，展示如何集成图片URL粘贴功能
- **`network-image-example.tsx`** - 网络图片处理的基础示例

### 🌐 服务集成示例

- **`zz-infra-upload-example.tsx`** - ZZ-Infra图片上传服务集成示例
- **`complete-zz-infra-example.tsx`** - 完整的ZZ-Infra集成示例，包含认证
- **`zz-infra-test.html`** - ZZ-Infra服务的独立测试页面

## 使用方法

### 快速开始

1. 打开任意HTML示例文件
2. 复制图片URL到剪贴板
3. 在画布上按 `Ctrl+V` (Mac: `Cmd+V`) 粘贴
4. 观察图片自动显示在画布上

### 支持的图片URL格式

```
✅ 直接图片链接: https://example.com/image.jpg
✅ 图片服务: https://images.unsplash.com/photo-xxx
✅ 占位图片: https://picsum.photos/400/300
✅ API图片: https://api.example.com/image?format=png
```

### 测试URL

以下是一些可用于测试的图片URL：

```
https://picsum.photos/400/300
https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400
https://via.placeholder.com/300x200.png
```

## 技术特性

- 🔍 **智能识别**: 自动检测多种格式的图片URL
- ⚡ **异步加载**: 不阻塞界面操作的图片加载
- 💾 **智能缓存**: 避免重复加载相同图片
- 📦 **轻量存储**: 只保存URL链接，不保存二进制数据
- 🔧 **易于集成**: 简单的API配置

## 开发指南

查看 `docs/image-url-paste-guide.md` 获取完整的开发文档和API参考。

## 故障排除

### 图片不显示？

1. 检查图片URL是否可访问
2. 确认图片服务器支持CORS
3. 查看浏览器控制台错误信息
4. 尝试使用测试URL验证功能

### URL未被识别？

1. 确认URL包含图片文件扩展名或服务域名
2. 检查URL格式是否正确
3. 查看 `debug-image-paste.html` 的详细检测过程

## 贡献

欢迎提交Issue和Pull Request来改进示例和文档！
