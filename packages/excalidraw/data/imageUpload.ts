/**
 * 图片上传服务
 * 处理本地图片上传到服务器并返回网络链接
 */

import { analyzeUploadError, ImageUploadErrorType } from "./imageUploadErrors";

export interface ImageUploadConfig {
  /** 上传接口地址 */
  uploadUrl: string;
  /** 请求头配置 */
  headers?: Record<string, string>;
  /** 最大文件大小 (bytes) */
  maxFileSize?: number;
  /** 支持的文件类型 */
  allowedTypes?: string[];
  /** 自定义上传处理函数 */
  customUpload?: (file: File) => Promise<string>;
}

export interface ImageUploadResponse {
  /** 上传成功后的图片网络链接 */
  url: string;
  /** 可选的其他信息 */
  [key: string]: any;
}

/**
 * 默认的图片上传配置
 */
export const DEFAULT_UPLOAD_CONFIG: Partial<ImageUploadConfig> = {
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
 * 检查文件是否符合上传要求
 */
export const validateImageFile = (
  file: File,
  config: ImageUploadConfig,
): void => {
  const maxSize = config.maxFileSize || DEFAULT_UPLOAD_CONFIG.maxFileSize!;
  const allowedTypes =
    config.allowedTypes || DEFAULT_UPLOAD_CONFIG.allowedTypes!;

  if (file.size > maxSize) {
    const error = analyzeUploadError({
      message: `文件大小超过限制 ${Math.round(
        maxSize / 1024 / 1024,
      )}MB，当前文件大小: ${Math.round(file.size / 1024 / 1024)}MB`,
    });
    error.type = ImageUploadErrorType.FILE_TOO_LARGE;
    throw error;
  }

  if (!allowedTypes.includes(file.type)) {
    const error = analyzeUploadError({
      message: `不支持的文件类型: ${file.type}，支持的类型: ${allowedTypes.join(
        ", ",
      )}`,
    });
    error.type = ImageUploadErrorType.FILE_TYPE_NOT_SUPPORTED;
    throw error;
  }
};

/**
 * 上传图片文件到服务器
 */
export const uploadImageFile = async (
  file: File,
  config: ImageUploadConfig,
): Promise<string> => {
  try {
    // 验证配置
    if (!config.uploadUrl) {
      const error = analyzeUploadError({
        message: "上传服务地址未配置",
      });
      error.type = ImageUploadErrorType.INVALID_UPLOAD_URL;
      throw error;
    }

    // 验证文件
    validateImageFile(file, config);

    // 如果有自定义上传函数，使用自定义函数
    if (config.customUpload) {
      try {
        return await config.customUpload(file);
      } catch (error: any) {
        throw analyzeUploadError(error);
      }
    }

    // 默认使用 FormData 上传
    const formData = new FormData();
    formData.append("file", file);

    let response: Response;

    try {
      response = await fetch(config.uploadUrl, {
        method: "POST",
        headers: config.headers || {},
        body: formData,
      });
    } catch (error: any) {
      // 网络请求失败
      throw analyzeUploadError(error);
    }

    // 检查HTTP状态码
    if (!response.ok) {
      let errorMessage = `上传失败: ${response.status} ${response.statusText}`;
      let errorDetails = "";

      // 尝试获取服务器返回的错误信息
      try {
        const errorText = await response.text();
        if (errorText) {
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.message) {
              errorDetails = errorJson.message;
            } else if (errorJson.error) {
              errorDetails = errorJson.error;
            }
          } catch {
            // 如果不是JSON，直接使用文本
            errorDetails = errorText.substring(0, 200); // 限制长度
          }
        }
      } catch {
        // 忽略获取错误信息的失败
      }

      if (errorDetails) {
        errorMessage += `\n服务器错误信息: ${errorDetails}`;
      }

      const error = analyzeUploadError({
        message: errorMessage,
      });
      error.statusCode = response.status;
      throw error;
    }

    let result: any;

    try {
      result = await response.json();
    } catch (error: any) {
      const parseError = analyzeUploadError({
        message: "无法解析服务器返回的数据，可能不是有效的JSON格式",
      });
      parseError.type = ImageUploadErrorType.INVALID_RESPONSE;
      throw parseError;
    }

    // 智能识别不同的返回格式
    let imageUrl: string | undefined;

    // 标准格式: { url: "..." }
    if (result.url) {
      imageUrl = result.url;
    }
    // ZZ-Infra 格式: { link: "..." }
    else if (result.link) {
      imageUrl = result.link;
    }
    // 其他可能的格式
    else if (result.data?.url) {
      imageUrl = result.data.url;
    } else if (result.data?.link) {
      imageUrl = result.data.link;
    }
    // 直接返回字符串
    else if (typeof result === "string") {
      imageUrl = result;
    }

    if (!imageUrl) {
      console.error("服务器返回格式:", result);
      const error = analyzeUploadError({
        message: "服务器返回的数据中缺少图片链接",
      });
      error.type = ImageUploadErrorType.MISSING_IMAGE_URL;
      error.details = `服务器返回: ${JSON.stringify(result, null, 2)}`;
      throw error;
    }

    // 验证返回的URL格式
    try {
      new URL(imageUrl);
    } catch {
      const error = analyzeUploadError({
        message: `服务器返回的图片链接格式无效: ${imageUrl}`,
      });
      error.type = ImageUploadErrorType.INVALID_RESPONSE;
      throw error;
    }

    return imageUrl;
  } catch (error: any) {
    // 如果已经是我们的错误格式，直接抛出
    if (
      error.type &&
      Object.values(ImageUploadErrorType).includes(error.type)
    ) {
      throw error;
    }

    // 否则分析并包装错误
    throw analyzeUploadError(error);
  }
};

/**
 * 检查是否为网络图片链接
 */
export const isNetworkImageUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * 从 URL 获取文件名
 */
export const getFileNameFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split("/").pop() || "image";
    return filename;
  } catch {
    return "image";
  }
};

/**
 * 检查图片链接是否可访问
 * 注意：由于CORS限制，这个函数可能无法准确验证所有图片链接
 * 建议在实际使用中禁用验证，直接尝试加载图片
 */
export const validateImageUrl = async (url: string): Promise<boolean> => {
  try {
    // 先尝试HEAD请求
    const headResponse = await fetch(url, {
      method: "HEAD",
      mode: "no-cors", // 避免CORS问题
    });

    // no-cors模式下，response.ok可能不准确，所以我们假设成功
    return true;
  } catch {
    try {
      // 如果HEAD失败，尝试创建Image对象来验证
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;

        // 设置超时，避免长时间等待
        setTimeout(() => resolve(false), 5000);
      });
    } catch {
      return false;
    }
  }
};
