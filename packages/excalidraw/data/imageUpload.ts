/**
 * 图片上传服务
 * 处理本地图片上传到服务器并返回网络链接
 */

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
    throw new Error(`文件大小超过限制 ${Math.round(maxSize / 1024 / 1024)}MB`);
  }

  if (!allowedTypes.includes(file.type)) {
    throw new Error(`不支持的文件类型: ${file.type}`);
  }
};

/**
 * 上传图片文件到服务器
 */
export const uploadImageFile = async (
  file: File,
  config: ImageUploadConfig,
): Promise<string> => {
  // 验证文件
  validateImageFile(file, config);

  // 如果有自定义上传函数，使用自定义函数
  if (config.customUpload) {
    return await config.customUpload(file);
  }

  // 默认使用 FormData 上传
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(config.uploadUrl, {
    method: "POST",
    headers: config.headers || {},
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`上传失败: ${response.status} ${response.statusText}`);
  }

  const result: any = await response.json();

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
    throw new Error("服务器返回的数据中缺少图片链接");
  }

  return imageUrl;
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
