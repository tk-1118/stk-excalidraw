/**
 * 完整的 ZZ-Infra 图片上传集成示例
 * 展示如何在实际项目中使用 ZZ-Infra 图片上传服务
 */

import React, { useState, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  ExcalidrawElement,
  AppState,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";
import {
  zzInfraConfig,
  zzInfraCustomConfig,
  createZZInfraConfigWithAuth,
} from "../data/zzInfraConfig";

interface ExcalidrawData {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}

export const CompleteZZInfraExample: React.FC = () => {
  const [excalidrawData, setExcalidrawData] = useState<ExcalidrawData>({
    elements: [],
    appState: {},
    files: {},
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 处理画布变更
  const handleChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      setExcalidrawData({ elements, appState, files });

      // 统计网络图片
      const networkImages = elements.filter(
        (el) => el.type === "image" && "imageUrl" in el && el.imageUrl,
      );

      if (networkImages.length > 0) {
        console.log(
          `画布中有 ${networkImages.length} 个网络图片:`,
          networkImages.map((img) => ({
            id: img.id,
            imageUrl: img.imageUrl,
            size: `${img.width}x${img.height}`,
          })),
        );
      }
    },
    [],
  );

  // 保存画布数据
  const handleSave = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 这里可以将画布数据保存到你的后端
      const dataToSave = {
        elements: excalidrawData.elements,
        appState: excalidrawData.appState,
        // 注意：files 中不会包含网络图片的数据，只有网络链接
        files: excalidrawData.files,
        timestamp: new Date().toISOString(),
      };

      console.log("保存的数据:", dataToSave);

      // 模拟保存到服务器
      await new Promise((resolve) => setTimeout(resolve, 1000));

      alert("画布数据保存成功！");
    } catch (err: any) {
      setError(err.message || "保存失败");
    } finally {
      setIsLoading(false);
    }
  }, [excalidrawData]);

  // 导出为JSON
  const handleExportJSON = useCallback(() => {
    const dataStr = JSON.stringify(
      {
        type: "excalidraw",
        version: 2,
        source: "https://excalidraw.com",
        elements: excalidrawData.elements,
        appState: excalidrawData.appState,
        files: excalidrawData.files,
      },
      null,
      2,
    );

    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `excalidraw-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [excalidrawData]);

  // 清空画布
  const handleClear = useCallback(() => {
    if (confirm("确定要清空画布吗？")) {
      setExcalidrawData({
        elements: [],
        appState: {},
        files: {},
      });
    }
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* 工具栏 */}
      <div
        style={{
          padding: "10px",
          borderBottom: "1px solid #ddd",
          display: "flex",
          gap: "10px",
          alignItems: "center",
          backgroundColor: "#f5f5f5",
        }}
      >
        <button
          onClick={handleSave}
          disabled={isLoading}
          style={{
            padding: "8px 16px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "保存中..." : "保存画布"}
        </button>

        <button
          onClick={handleExportJSON}
          style={{
            padding: "8px 16px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          导出JSON
        </button>

        <button
          onClick={handleClear}
          style={{
            padding: "8px 16px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          清空画布
        </button>

        <div style={{ marginLeft: "auto", fontSize: "14px", color: "#666" }}>
          元素数量: {excalidrawData.elements.length} | 网络图片:{" "}
          {
            excalidrawData.elements.filter(
              (el) => el.type === "image" && "imageUrl" in el && el.imageUrl,
            ).length
          }
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          style={{
            padding: "10px",
            backgroundColor: "#f8d7da",
            color: "#721c24",
            borderBottom: "1px solid #f5c6cb",
          }}
        >
          错误: {error}
        </div>
      )}

      {/* Excalidraw 画布 */}
      <div style={{ flex: 1 }}>
        <Excalidraw
          // 使用 ZZ-Infra 图片上传配置
          imageUploadConfig={zzInfraConfig}
          // 处理变更
          onChange={handleChange}
          // 初始数据
          initialData={{
            elements: excalidrawData.elements,
            appState: {
              viewBackgroundColor: "#ffffff",
              ...excalidrawData.appState,
            },
            files: excalidrawData.files,
          }}
          // 其他配置
          theme="light"
          name="ZZ-Infra 图片上传示例"
        />
      </div>

      {/* 使用说明 */}
      <div
        style={{
          padding: "10px",
          backgroundColor: "#e9ecef",
          fontSize: "12px",
          color: "#495057",
          borderTop: "1px solid #ddd",
        }}
      >
        <strong>使用说明:</strong>
        <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
          <li>直接粘贴本地图片文件，会自动上传到 ZZ-Infra 服务</li>
          <li>粘贴网络图片链接，会直接在画布上显示</li>
          <li>保存的数据只包含图片链接，不包含文件数据</li>
          <li>支持的格式: JPEG, PNG, GIF, WebP, SVG</li>
          <li>最大文件大小: 10MB</li>
        </ul>
      </div>
    </div>
  );
};

// 高级配置示例 - 带认证token
export const ZZInfraWithAuthExample: React.FC = () => {
  // 假设从某处获取认证token
  const authToken = "your-auth-token-here";
  const configWithAuth = createZZInfraConfigWithAuth(authToken);

  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw
        imageUploadConfig={configWithAuth}
        onChange={(elements, appState, files) => {
          console.log("带认证的上传配置:", { elements, appState, files });
        }}
      />
    </div>
  );
};

// 自定义上传处理示例
export const ZZInfraCustomUploadExample: React.FC = () => {
  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw
        imageUploadConfig={zzInfraCustomConfig}
        onChange={(elements, appState, files) => {
          // 自定义上传会提供更详细的日志
          console.log("自定义上传配置:", { elements, appState, files });
        }}
      />
    </div>
  );
};

export default CompleteZZInfraExample;
