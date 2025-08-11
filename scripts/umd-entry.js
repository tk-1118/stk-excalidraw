// UMD 包的入口文件
// 显式导出 React、ReactDOM 和所有 Excalidraw 功能

// 导入 React 和 ReactDOM
import React from 'react';
import ReactDOM from 'react-dom';
// 导入 React 18+ 的 client API
import * as ReactDOMClient from 'react-dom/client';

// 导入所有 Excalidraw 功能
import * as ExcalidrawModule from '../packages/excalidraw/index.tsx';

// 创建合并的 ReactDOM 对象，包含新旧 API
const ReactDOMWithClient = {
  ...ReactDOM,
  createRoot: ReactDOMClient.createRoot,
  hydrateRoot: ReactDOMClient.hydrateRoot,
};

// 将 React 设置为全局变量（为了兼容性）
if (typeof globalThis !== 'undefined') {
  globalThis.React = React;
  globalThis.ReactDOM = ReactDOMWithClient;
} else if (typeof window !== 'undefined') {
  window.React = React;
  window.ReactDOM = ReactDOMWithClient;
}

// 导出所有内容，包括 React
export default {
  // React 相关
  React,
  ReactDOM: ReactDOMWithClient,
  
  // Excalidraw 所有功能
  ...ExcalidrawModule,
};

// 也单独导出，以防某些情况下需要
export { React, ReactDOMWithClient as ReactDOM };
export * from '../packages/excalidraw/index.tsx';
