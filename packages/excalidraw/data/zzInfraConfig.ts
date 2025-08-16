/**
 * ZZ-Infra 图片上传服务配置
 * 专门适配 http://49.232.13.110:83/zz-infra/zz-resource/oss/endpoint/put-file-attach 接口
 */

import type { ImageUploadConfig } from "./imageUpload";

// ZZ-Infra 上传接口返回类型
export interface ZZInfraUploadResponse {
  attachId: number;
  domain: string;
  link: string;
  name: string;
  originalName: string;
}

/**
 * ZZ-Infra 图片上传配置 - 使用默认上传方式
 * 适用于大多数情况，会自动识别返回的 link 字段
 */
export const zzInfraConfig: ImageUploadConfig = {
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

/**
 * ZZ-Infra 图片上传配置 - 使用自定义上传函数
 * 提供更多控制和错误处理
 */
export const zzInfraCustomConfig: ImageUploadConfig = {
  uploadUrl: "", // 使用自定义函数时可以为空
  customUpload: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const response = await fetch(
        "http://49.232.13.110:83/zz-infra/zz-resource/oss/endpoint/put-file-attach",
        {
          method: "POST",
          body: formData,
          // 如果需要认证，可以添加headers
          headers: {
            'Authorization': 'Bearer your-token-here',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`上传失败: ${response.status} ${response.statusText}`);
      }

      const result: ZZInfraUploadResponse = await response.json();

      if (!result.link) {
        throw new Error("服务器返回的数据中缺少图片链接");
      }

      // 可以在这里添加额外的处理逻辑
      console.log("ZZ-Infra 上传成功:", {
        attachId: result.attachId,
        link: result.link,
        name: result.name,
        originalName: result.originalName,
      });

      return result.link;
    } catch (error) {
      console.error("ZZ-Infra 图片上传失败:", error);
      throw error;
    }
  },
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],
};

/**
 * 带认证的 ZZ-Infra 配置
 * 如果接口需要认证token
 */
export const createZZInfraConfigWithAuth = (
  token: string,
): ImageUploadConfig => ({
  uploadUrl:
    "http://49.232.13.110:83/zz-infra/zz-resource/oss/endpoint/put-file-attach",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],
});

/**
 * 生产环境配置（HTTPS）
 * 如果有HTTPS版本的接口
 */
export const zzInfraProductionConfig: ImageUploadConfig = {
  uploadUrl:
    "https://your-production-domain.com/zz-infra/zz-resource/oss/endpoint/put-file-attach",
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],
};
