/**
 * 网络图片功能使用示例
 * 展示如何配置和使用新的图片上传功能
 */

import React from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ImageUploadConfig } from "../data/imageUpload";

// 示例：自定义图片上传函数
const customImageUpload = async (file: File): Promise<string> => {
  // 这里是你的图片上传逻辑
  // 可以上传到任何云存储服务（如阿里云OSS、腾讯云COS、AWS S3等）

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/upload-image", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.url; // 返回图片的网络链接
  } catch (error) {
    console.error("Image upload failed:", error);
    throw error;
  }
};

// 示例：使用默认上传配置
const defaultUploadConfig: ImageUploadConfig = {
  uploadUrl: "/api/upload-image",
  headers: {
    Authorization: "Bearer your-token-here",
  },
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
};

// 示例：使用自定义上传函数的配置
const customUploadConfig: ImageUploadConfig = {
  uploadUrl: "", // 使用自定义函数时可以为空
  customUpload: customImageUpload,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ["image/jpeg", "image/png"],
};

export const NetworkImageExample: React.FC = () => {
  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw
        // 配置图片上传
        imageUploadConfig={customUploadConfig}
        // 其他配置...
        initialData={{
          elements: [
            // 可以直接创建网络图片元素
            {
              type: "image",
              id: "example-network-image",
              x: 100,
              y: 100,
              width: 300,
              height: 200,
              imageUrl: "https://example.com/image.jpg", // 直接使用网络链接
              fileId: null, // 网络图片不需要 fileId
              status: "saved",
              scale: [1, 1],
              crop: null,
              // ... 其他必需属性
              strokeColor: "transparent",
              backgroundColor: "transparent",
              fillStyle: "solid",
              strokeWidth: 1,
              strokeStyle: "solid",
              roughness: 1,
              opacity: 100,
              angle: 0,
              seed: 1234,
              version: 1,
              versionNonce: 5678,
              index: "a0",
              isDeleted: false,
              groupIds: [],
              frameId: null,
              boundElements: null,
              updated: Date.now(),
              link: null,
              locked: false,
              roundness: null,
            },
          ],
        }}
        // 处理变更事件
        onChange={(elements, appState, files) => {
          console.log("Elements:", elements);
          console.log("Files:", files); // 网络图片不会出现在这里

          // 网络图片元素会包含 imageUrl 字段
          const networkImages = elements.filter(
            (el) => el.type === "image" && "imageUrl" in el && el.imageUrl,
          );
          console.log("Network images:", networkImages);
        }}
      />
    </div>
  );
};

// 服务端 API 示例（Node.js + Express）
/*
app.post('/api/upload-image', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // 上传到云存储（示例使用阿里云OSS）
    const ossClient = new OSS({
      region: 'your-region',
      accessKeyId: 'your-access-key-id',
      accessKeySecret: 'your-access-key-secret',
      bucket: 'your-bucket-name',
    });
    
    const fileName = `images/${Date.now()}-${file.originalname}`;
    const result = await ossClient.put(fileName, file.buffer);
    
    res.json({
      url: result.url,
      name: file.originalname,
      size: file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});
*/

export default NetworkImageExample;
