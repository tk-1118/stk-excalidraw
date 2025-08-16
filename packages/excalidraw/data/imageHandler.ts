/**
 * 图片处理器 - 统一处理本地图片上传和网络图片
 */

import { newImageElement } from "@excalidraw/element";
import type { ExcalidrawImageElement } from "@excalidraw/element/types";

import {
  isNetworkImageUrl,
  uploadImageFile,
  validateImageUrl,
  type ImageUploadConfig,
} from "./imageUpload";
import { isSupportedImageFile } from "./blob";

export interface ImageHandlerConfig {
  /** 图片上传配置 */
  uploadConfig?: ImageUploadConfig;
  /** 是否启用网络图片验证 */
  validateNetworkImages?: boolean;
  /** 默认图片尺寸 */
  defaultSize?: { width: number; height: number };
}

export interface ProcessedImageResult {
  /** 处理后的图片元素 */
  element: ExcalidrawImageElement;
  /** 是否为网络图片 */
  isNetworkImage: boolean;
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * 获取图片的实际尺寸
 */
const getImageDimensions = async (
  imageUrl: string,
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error("Failed to load image for size detection"));
    };
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
  });
};

/**
 * 计算合适的显示尺寸
 */
const calculateDisplaySize = (
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number = 800,
  maxHeight: number = 600,
): { width: number; height: number } => {
  // 如果图片尺寸小于最大限制，使用原始尺寸
  if (naturalWidth <= maxWidth && naturalHeight <= maxHeight) {
    return { width: naturalWidth, height: naturalHeight };
  }

  // 计算缩放比例，保持宽高比
  const widthRatio = maxWidth / naturalWidth;
  const heightRatio = maxHeight / naturalHeight;
  const ratio = Math.min(widthRatio, heightRatio);

  return {
    width: Math.round(naturalWidth * ratio),
    height: Math.round(naturalHeight * ratio),
  };
};

/**
 * 处理图片文件或URL，返回图片元素
 */
export const processImageInput = async (
  input: File | string,
  config: ImageHandlerConfig,
  elementProps: Partial<ExcalidrawImageElement> = {},
): Promise<ProcessedImageResult> => {
  const defaultSize = config.defaultSize || { width: 300, height: 200 };

  // 创建基础属性，确保所有必需属性都有默认值
  const createElementProps = (overrides: any = {}) => ({
    type: "image" as const,
    x: elementProps.x ?? 0,
    y: elementProps.y ?? 0,
    width: overrides.width ?? defaultSize.width,
    height: overrides.height ?? defaultSize.height,
    strokeColor: elementProps.strokeColor ?? "transparent",
    backgroundColor: elementProps.backgroundColor ?? "transparent",
    fillStyle: elementProps.fillStyle ?? "solid",
    strokeWidth: elementProps.strokeWidth ?? 1,
    strokeStyle: elementProps.strokeStyle ?? "solid",
    roughness: elementProps.roughness ?? 1,
    opacity: elementProps.opacity ?? 100,
    ...overrides,
  });

  try {
    // 如果是字符串，检查是否为网络链接
    if (typeof input === "string") {
      if (isNetworkImageUrl(input)) {
        // 验证网络图片（可选）
        if (config.validateNetworkImages) {
          const isValid = await validateImageUrl(input);
          if (!isValid) {
            return {
              element: newImageElement(createElementProps({ status: "error" })),
              isNetworkImage: true,
              error: "无法访问该图片链接",
            };
          }
        }

        // 尝试获取图片实际尺寸
        let displaySize = defaultSize;
        try {
          const dimensions = await getImageDimensions(input);
          displaySize = calculateDisplaySize(
            dimensions.width,
            dimensions.height,
          );
        } catch (error) {
          console.warn(
            "Failed to get image dimensions, using default size:",
            error,
          );
        }

        // 创建网络图片元素
        const element = newImageElement(
          createElementProps({
            imageUrl: input,
            status: "saved",
            width: displaySize.width,
            height: displaySize.height,
          }),
        );

        return {
          element,
          isNetworkImage: true,
        };
      } else {
        return {
          element: newImageElement(createElementProps({ status: "error" })),
          isNetworkImage: false,
          error: "无效的图片链接",
        };
      }
    }

    // 处理文件
    if (input instanceof File) {
      // 检查文件类型
      if (!isSupportedImageFile(input)) {
        return {
          element: newImageElement(createElementProps({ status: "error" })),
          isNetworkImage: false,
          error: "不支持的文件类型",
        };
      }

      // 如果有上传配置，上传文件获取网络链接
      if (config.uploadConfig) {
        try {
          const imageUrl = await uploadImageFile(input, config.uploadConfig);

          // 创建网络图片元素
          const element = newImageElement(
            createElementProps({
              imageUrl,
              status: "saved",
            }),
          );

          return {
            element,
            isNetworkImage: true,
          };
        } catch (error: any) {
          return {
            element: newImageElement(createElementProps({ status: "error" })),
            isNetworkImage: false,
            error: `上传失败：${error.message || "未知错误"}`,
          };
        }
      } else {
        // 没有上传配置，直接返回错误，不进行本地文件处理回退
        return {
          element: newImageElement(createElementProps({ status: "error" })),
          isNetworkImage: false,
          error: "未配置图片上传服务，无法处理本地图片",
        };
      }
    }

    // 未知输入类型
    return {
      element: newImageElement(createElementProps({ status: "error" })),
      isNetworkImage: false,
      error: "未知的输入类型",
    };
  } catch (error: any) {
    return {
      element: newImageElement(createElementProps({ status: "error" })),
      isNetworkImage: false,
      error: error.message || "处理图片时发生错误",
    };
  }
};

/**
 * 批量处理图片
 */
export const processBatchImages = async (
  inputs: (File | string)[],
  config: ImageHandlerConfig,
  baseElementProps: Partial<ExcalidrawImageElement> = {},
): Promise<ProcessedImageResult[]> => {
  const results: ProcessedImageResult[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const elementProps = {
      ...baseElementProps,
      // 垂直排列多个图片
      y:
        (baseElementProps.y || 0) +
        i * ((config.defaultSize?.height || 200) + 20),
    };

    const result = await processImageInput(input, config, elementProps);
    results.push(result);
  }

  return results;
};

/**
 * 从剪贴板数据中提取图片
 */
export const extractImagesFromClipboard = (
  clipboardData: DataTransfer,
): (File | string)[] => {
  const images: (File | string)[] = [];

  // 检查文件
  if (clipboardData.files) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const file = clipboardData.files[i];
      if (isSupportedImageFile(file)) {
        images.push(file);
      }
    }
  }

  // 检查HTML内容中的图片URL
  const html = clipboardData.getData("text/html");
  if (html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const imgElements = doc.querySelectorAll("img");

    imgElements.forEach((img) => {
      const src = img.getAttribute("src");
      if (src && isNetworkImageUrl(src)) {
        images.push(src);
      }
    });
  }

  return images;
};
