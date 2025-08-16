/**
 * ZZ-Infra 图片上传服务配置示例
 * 适配 http://49.232.13.110:83/zz-infra/zz-resource/oss/endpoint/put-file-attach 接口
 */

import React from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ImageUploadConfig } from "../data/imageUpload";

// ZZ-Infra 上传接口返回类型
interface ZZInfraUploadResponse {
  attachId: number;
  domain: string;
  link: string;
  name: string;
  originalName: string;
}

// 自定义上传函数，适配 ZZ-Infra 接口
const zzInfraImageUpload = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(
      "http://49.232.13.110:83/zz-infra/zz-resource/oss/endpoint/put-file-attach",
      {
        method: "POST",
        body: formData,
        // 如果需要认证，可以添加headers
        // headers: {
        //   'Authorization': 'Bearer your-token-here',
        // },
      },
    );

    if (!response.ok) {
      throw new Error(`上传失败: ${response.status} ${response.statusText}`);
    }

    const result: ZZInfraUploadResponse = await response.json();

    // 检查返回的数据
    if (!result.link) {
      throw new Error("服务器返回的数据中缺少图片链接");
    }

    console.log("图片上传成功:", {
      attachId: result.attachId,
      link: result.link,
      name: result.name,
      originalName: result.originalName,
    });

    return result.link; // 返回图片链接
  } catch (error) {
    console.error("ZZ-Infra 图片上传失败:", error);
    throw error;
  }
};

// 图片上传配置
const zzInfraUploadConfig: ImageUploadConfig = {
  uploadUrl: "", // 使用自定义函数时可以为空
  customUpload: zzInfraImageUpload,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],
};

// 或者使用默认上传配置（不使用自定义函数）
const zzInfraDefaultConfig: ImageUploadConfig = {
  uploadUrl:
    "http://49.232.13.110:83/zz-infra/zz-resource/oss/endpoint/put-file-attach",
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],
};

export const ZZInfraUploadExample: React.FC = () => {
  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw
        // 使用 ZZ-Infra 图片上传配置
        imageUploadConfig={zzInfraUploadConfig}
        // 处理变更事件
        onChange={(elements, appState, files) => {
          console.log("画布元素:", elements);
          console.log("文件数据:", files); // 网络图片不会出现在这里

          // 查看网络图片元素
          const networkImages = elements.filter(
            (el) => el.type === "image" && "imageUrl" in el && el.imageUrl,
          );

          if (networkImages.length > 0) {
            console.log(
              "网络图片元素:",
              networkImages.map((img) => ({
                id: img.id,
                imageUrl: img.imageUrl,
                width: img.width,
                height: img.height,
              })),
            );
          }
        }}
        // 其他配置...
        initialData={{
          elements: [],
          appState: {
            viewBackgroundColor: "#ffffff",
          },
        }}
      />
    </div>
  );
};

// 导出配置供其他地方使用
export { zzInfraUploadConfig, zzInfraDefaultConfig };

export default ZZInfraUploadExample;
