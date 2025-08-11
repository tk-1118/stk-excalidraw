# 📦 Excalidraw CDN 集成指南

通过 CDN 方式将 Excalidraw 集成到您的项目中，无需构建步骤，开箱即用。

## 🚀 快速开始

### 方案一：ESM 模块方式（推荐）

这是最现代和推荐的方式，适用于现代浏览器：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>Excalidraw CDN 示例</title>
    
    <!-- 引入 CSS -->
    <link rel="stylesheet" href="https://esm.sh/@excalidraw/excalidraw@0.18.0/dist/prod/index.css" />
    
    <!-- 设置资源路径 -->
    <script>
        window.EXCALIDRAW_ASSET_PATH = "https://esm.sh/@excalidraw/excalidraw@0.18.0/dist/prod/";
    </script>
    
    <!-- Import Map 设置 -->
    <script type="importmap">
    {
        "imports": {
            "react": "https://esm.sh/react@19.0.0",
            "react/jsx-runtime": "https://esm.sh/react@19.0.0/jsx-runtime",
            "react-dom": "https://esm.sh/react-dom@19.0.0"
        }
    }
    </script>
</head>
<body>
    <div id="app" style="height: 500px;"></div>
    
    <script type="module">
        import * as ExcalidrawLib from 'https://esm.sh/@excalidraw/excalidraw@0.18.0?external=react,react-dom';
        import React from "https://esm.sh/react@19.0.0";
        import ReactDOM from "https://esm.sh/react-dom@19.0.0";
        
        const { Excalidraw } = ExcalidrawLib;
        
        const App = () => React.createElement(
            'div', 
            { style: { height: '500px' } },
            React.createElement(Excalidraw)
        );
        
        const container = document.getElementById('app');
        const root = ReactDOM.createRoot(container);
        root.render(React.createElement(App));
    </script>
</body>
</html>
```

### 方案二：使用现有示例

我们提供了一个完整的示例文件 `examples/cdn-integration.html`，包含：

- ✅ 完整的 UI 界面
- ✅ 导出功能（PNG、SVG）
- ✅ 画布控制
- ✅ 错误处理
- ✅ 中文界面

**使用方法：**
```bash
# 在项目根目录启动本地服务器
python -m http.server 8000
# 或者使用 Node.js
npx http-server

# 然后访问
http://localhost:8000/examples/cdn-integration.html
```

## 🔧 自定义 UMD 构建

如果您需要创建自定义的 UMD 包，**我们的构建脚本会自动包含所有必需的子包**：

### 📦 包含的子包
- **@excalidraw/excalidraw** - 主包（React 组件）
- **@excalidraw/common** - 通用工具和常量
- **@excalidraw/element** - 元素处理和操作
- **@excalidraw/math** - 数学计算功能
- **@excalidraw/utils** - 导出和工具函数

### 🚀 运行 UMD 构建

```bash
# 确保先构建所有子包
yarn build:packages

# 然后构建 UMD 包
yarn build:umd
```

这将在 `dist/umd/` 目录下生成：
- `dev/excalidraw.umd.js` - 开发版本（带 sourcemap）
- `prod/excalidraw.umd.js` - 生产版本（压缩版）

### 📁 构建输出结构
```
dist/umd/
├── dev/
│   ├── excalidraw.umd.js      # 开发版本
│   ├── excalidraw.umd.js.map  # Source Map
│   └── *.css                  # 样式文件
└── prod/
    ├── excalidraw.umd.js      # 生产版本（压缩）
    └── *.css                  # 样式文件
```

### 🔧 使用完整 UMD 包

**超简单示例（无需引入 React）：**
```html
<!DOCTYPE html>
<html>
<head>
    <!-- 引入样式 -->
    <link rel="stylesheet" href="./dist/umd/prod/index.css" />
    
    <!-- 设置资源路径 -->
    <script>
        window.EXCALIDRAW_ASSET_PATH = "./dist/umd/prod/";
    </script>
</head>
<body>
    <div id="app" style="height: 500px;"></div>
    
    <!-- 只需引入一个 UMD 包（包含 React + Excalidraw）-->
    <script src="./dist/umd/prod/excalidraw.umd.js"></script>
    
    <script>
        // ExcalidrawLib 包含所有功能，包括 React
        const { Excalidraw, React, ReactDOM, exportToCanvas, convertToExcalidrawElements } = ExcalidrawLib;
        
        // 创建应用（使用内置的 React）
        const App = () => React.createElement(Excalidraw);
        
        // 渲染（使用内置的 ReactDOM）
        const container = document.getElementById('app');
        const root = ReactDOM.createRoot(container);
        root.render(React.createElement(App));
    </script>
</body>
</html>
```

**🚀 优势对比：**

| 方案 | CDN ESM | 外部 React + UMD | 完整 UMD |
|------|---------|------------------|----------|
| React 依赖 | 需要 CDN | 需要单独引入 | ✅ 内置 |
| 文件数量 | 多个 | 3个 | **1个** |
| 网络请求 | 多次 | 3次 | **1次** |
| 离线使用 | ❌ | 部分 | ✅ 完全 |
| 依赖冲突 | 可能 | 可能 | ❌ 无 |

### ⚙️ 构建配置详解

我们的完整 UMD 构建配置：

```javascript
// scripts/buildUMD.js 关键配置
{
  // 所有依赖都打包进来，包括 React
  external: [],
  
  // 路径别名确保正确解析所有子包
  alias: {
    "@excalidraw/common": "./packages/common/src",
    "@excalidraw/element": "./packages/element/src", 
    "@excalidraw/math": "./packages/math/src",
    "@excalidraw/utils": "./packages/utils/src",
  },
  
  // 全局变量名
  globalName: "ExcalidrawLib"
}
```

### 🔥 完全独立的特性
- ✅ **无需额外依赖**：React + ReactDOM 完全内置
- ✅ **一个文件搞定**：包含所有必需的库和组件
- ✅ **完整功能支持**：绘图、导出、API 等全部可用
- ✅ **体积优化**：生产版本经过压缩优化

### 🧪 测试 UMD 包

我们提供了测试页面 `examples/umd-integration.html`：

```bash
# 构建 UMD 包
yarn build:umd

# 启动本地服务器
python -m http.server 8000

# 访问测试页面
http://localhost:8000/examples/umd-integration.html
```

## 🌐 CDN 提供商

推荐的 CDN 提供商：

### 1. esm.sh（推荐）
```html
<link rel="stylesheet" href="https://esm.sh/@excalidraw/excalidraw@0.18.0/dist/prod/index.css" />
<script type="module">
    import * as ExcalidrawLib from 'https://esm.sh/@excalidraw/excalidraw@0.18.0?external=react,react-dom';
</script>
```

### 2. unpkg.com
```html
<link rel="stylesheet" href="https://unpkg.com/@excalidraw/excalidraw@0.18.0/dist/prod/index.css" />
<script type="module">
    import * as ExcalidrawLib from 'https://unpkg.com/@excalidraw/excalidraw@0.18.0/dist/prod/index.js';
</script>
```

### 3. jsDelivr
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@excalidraw/excalidraw@0.18.0/dist/prod/index.css" />
<script type="module">
    import * as ExcalidrawLib from 'https://cdn.jsdelivr.net/npm/@excalidraw/excalidraw@0.18.0/dist/prod/index.js';
</script>
```

## ⚙️ 配置选项

### 必需配置

```javascript
// 设置字体和资源路径
window.EXCALIDRAW_ASSET_PATH = "https://esm.sh/@excalidraw/excalidraw@0.18.0/dist/prod/";
```

### 可选配置

```javascript
// 自定义配置
const excalidrawConfig = {
    // 初始数据
    initialData: {
        elements: [],
        appState: {
            viewBackgroundColor: "#ffffff",
            currentItemFontFamily: 1,
        }
    },
    
    // UI 选项
    UIOptions: {
        canvasActions: {
            loadScene: false,
            saveAsImage: false,
        },
        tools: {
            image: true,
            text: true,
        }
    },
    
    // 事件回调
    onChange: (elements, appState) => {
        console.log("场景更新:", elements, appState);
    },
    
    // API 引用
    excalidrawAPI: (api) => {
        window.excalidrawAPI = api;
    }
};
```

## 🎯 常用功能

### 导出功能
```javascript
// 导出为 PNG
const canvas = await ExcalidrawLib.exportToCanvas({
    elements: excalidrawAPI.getSceneElements(),
    appState: excalidrawAPI.getAppState(),
    files: excalidrawAPI.getFiles(),
});

// 导出为 SVG
const svg = await ExcalidrawLib.exportToSvg({
    elements: excalidrawAPI.getSceneElements(),
    appState: excalidrawAPI.getAppState(),
    files: excalidrawAPI.getFiles(),
});
```

### 场景操作
```javascript
// 清空画布
excalidrawAPI.resetScene();

// 更新场景
excalidrawAPI.updateScene({
    elements: newElements,
    appState: newAppState
});

// 添加元素
const elements = ExcalidrawLib.convertToExcalidrawElements([
    {
        type: "rectangle",
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        backgroundColor: "#ffd43b",
    }
]);
excalidrawAPI.updateScene({ elements });
```

## 🔧 故障排除

### 1. 字体加载失败
确保正确设置了 `EXCALIDRAW_ASSET_PATH`：
```javascript
window.EXCALIDRAW_ASSET_PATH = "https://esm.sh/@excalidraw/excalidraw@0.18.0/dist/prod/";
```

### 2. React 版本冲突
使用 Import Map 确保 React 版本一致：
```html
<script type="importmap">
{
    "imports": {
        "react": "https://esm.sh/react@19.0.0",
        "react-dom": "https://esm.sh/react-dom@19.0.0"
    }
}
</script>
```

### 3. 跨域问题
使用相同来源的 CDN 或配置 CORS 头：
```javascript
// 使用相同的 CDN 前缀
const CDN_BASE = "https://esm.sh";
```

## 🌟 最佳实践

1. **使用版本锁定**：总是指定具体版本号，避免使用 `@latest`
2. **预加载资源**：在关键路径添加 `<link rel="preload">`
3. **错误处理**：添加适当的错误边界和回退机制
4. **性能优化**：考虑使用 Service Worker 缓存静态资源
5. **安全考虑**：验证 CDN 的 integrity 哈希值

## 📱 移动端支持

Excalidraw 完全支持移动端，确保添加适当的 viewport 设置：

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
```

## 🆕 版本更新

保持 Excalidraw 版本更新：

```bash
# 检查最新版本
npm view @excalidraw/excalidraw version

# 更新 CDN 链接中的版本号
# 从: @excalidraw/excalidraw@0.18.0
# 到:   @excalidraw/excalidraw@{最新版本}
```

## 🤝 社区和支持

- [官方文档](https://docs.excalidraw.com)
- [GitHub 仓库](https://github.com/excalidraw/excalidraw)
- [问题反馈](https://github.com/excalidraw/excalidraw/issues)

---

通过以上方式，您可以轻松地将 Excalidraw 通过 CDN 集成到任何项目中，无需复杂的构建配置！
