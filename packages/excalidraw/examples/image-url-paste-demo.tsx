/**
 * 图片URL粘贴功能演示
 * 展示如何直接粘贴图片URL文本并在画布上显示图片
 */

import React, { useState, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  ExcalidrawElement,
  AppState,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";
import { zzInfraConfig } from "../data/zzInfraConfig";

export const ImageUrlPasteDemo: React.FC = () => {
  const [lastPastedUrl, setLastPastedUrl] = useState<string>("");
  const [imageCount, setImageCount] = useState(0);

  // 处理画布变更
  const handleChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      // 统计网络图片
      const networkImages = elements.filter(
        (el) => el.type === "image" && "imageUrl" in el && el.imageUrl,
      );

      setImageCount(networkImages.length);

      // 获取最新添加的图片URL
      const latestImage = networkImages[networkImages.length - 1];
      if (latestImage && "imageUrl" in latestImage && latestImage.imageUrl) {
        if (latestImage.imageUrl !== lastPastedUrl) {
          setLastPastedUrl(latestImage.imageUrl);
          console.log("检测到新的图片URL:", latestImage.imageUrl);
        }
      }
    },
    [lastPastedUrl],
  );

  // 测试URL列表
  const testUrls = [
    "https://picsum.photos/300/200",
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400",
    "https://via.placeholder.com/400x300.png",
    "https://i.imgur.com/example.jpg",
    "https://example.com/images/photo.jpeg",
    "https://cdn.example.com/media/image123.webp",
    "https://example.com/api/image?id=123&format=png&w=300",
  ];

  // 复制URL到剪贴板
  const copyToClipboard = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert(`已复制到剪贴板: ${url}\n现在可以在画布上按 Ctrl+V 粘贴`);
    } catch (error) {
      console.error("复制失败:", error);
      alert("复制失败，请手动复制URL");
    }
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* 工具栏 */}
      <div
        style={{
          padding: "15px",
          borderBottom: "1px solid #ddd",
          backgroundColor: "#f8f9fa",
        }}
      >
        <h2 style={{ margin: "0 0 10px 0", fontSize: "18px" }}>
          图片URL粘贴功能演示
        </h2>

        <div
          style={{
            display: "flex",
            gap: "15px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: "14px", color: "#666" }}>
            画布中的网络图片: <strong>{imageCount}</strong>
          </div>

          {lastPastedUrl && (
            <div
              style={{ fontSize: "12px", color: "#28a745", maxWidth: "300px" }}
            >
              最新粘贴:{" "}
              {lastPastedUrl.length > 50
                ? lastPastedUrl.substring(0, 50) + "..."
                : lastPastedUrl}
            </div>
          )}
        </div>
      </div>

      {/* 测试URL区域 */}
      <div
        style={{
          padding: "10px 15px",
          borderBottom: "1px solid #ddd",
          backgroundColor: "#fff",
        }}
      >
        <div
          style={{ fontSize: "14px", marginBottom: "10px", fontWeight: "bold" }}
        >
          测试图片URL（点击复制，然后在画布上按 Ctrl+V 粘贴）:
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            maxHeight: "100px",
            overflowY: "auto",
          }}
        >
          {testUrls.map((url, index) => (
            <button
              key={index}
              onClick={() => copyToClipboard(url)}
              style={{
                padding: "6px 12px",
                fontSize: "11px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                maxWidth: "200px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={url}
            >
              {url.replace(/^https?:\/\//, "").substring(0, 25)}...
            </button>
          ))}
        </div>
      </div>

      {/* 使用说明 */}
      <div
        style={{
          padding: "10px 15px",
          borderBottom: "1px solid #ddd",
          backgroundColor: "#e9ecef",
          fontSize: "12px",
          color: "#495057",
        }}
      >
        <strong>使用方法:</strong>
        <ol style={{ margin: "5px 0", paddingLeft: "20px" }}>
          <li>点击上方的测试URL按钮复制链接</li>
          <li>
            在画布上按 <kbd>Ctrl+V</kbd> (Mac: <kbd>Cmd+V</kbd>) 粘贴
          </li>
          <li>系统会自动识别图片URL并在画布上显示图片</li>
          <li>也可以直接复制任何图片URL文本进行粘贴</li>
        </ol>
        <strong>支持的URL格式:</strong>{" "}
        带图片扩展名的URL、知名图片服务域名、包含图片路径关键词的URL等
      </div>

      {/* Excalidraw 画布 */}
      <div style={{ flex: 1 }}>
        <Excalidraw
          // 使用 ZZ-Infra 图片上传配置（用于本地图片上传）
          imageUploadConfig={zzInfraConfig}
          // 处理变更
          onChange={handleChange}
          // 初始数据
          initialData={{
            elements: [],
            appState: {
              viewBackgroundColor: "#ffffff",
            },
          }}
          // 其他配置
          theme="light"
          name="图片URL粘贴演示"
        />
      </div>
    </div>
  );
};

export default ImageUrlPasteDemo;
