/**
 * 图片上传错误分类和处理
 * 提供详细的错误类型判断和用户友好的错误信息
 */

export enum ImageUploadErrorType {
  // 网络相关错误
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  CONNECTION_REFUSED = "CONNECTION_REFUSED",

  // 认证和授权错误
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_INVALID = "TOKEN_INVALID",

  // 服务器错误
  SERVER_ERROR = "SERVER_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

  // 文件相关错误
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  FILE_TYPE_NOT_SUPPORTED = "FILE_TYPE_NOT_SUPPORTED",
  FILE_CORRUPTED = "FILE_CORRUPTED",

  // 配置错误
  INVALID_CONFIG = "INVALID_CONFIG",
  MISSING_CONFIG = "MISSING_CONFIG",
  INVALID_UPLOAD_URL = "INVALID_UPLOAD_URL",

  // 响应格式错误
  INVALID_RESPONSE = "INVALID_RESPONSE",
  MISSING_IMAGE_URL = "MISSING_IMAGE_URL",

  // 未知错误
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface ImageUploadError {
  type: ImageUploadErrorType;
  message: string;
  details?: string;
  originalError?: Error;
  statusCode?: number;
  retryable?: boolean;
}

/**
 * 分析错误并返回详细的错误信息
 */
export const analyzeUploadError = (error: any): ImageUploadError => {
  // 如果已经是我们的错误格式，直接返回
  if (error.type && Object.values(ImageUploadErrorType).includes(error.type)) {
    return error;
  }

  const originalError =
    error instanceof Error ? error : new Error(String(error));
  const errorMessage = originalError.message.toLowerCase();

  // 网络相关错误
  if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
    if (errorMessage.includes("timeout")) {
      return {
        type: ImageUploadErrorType.TIMEOUT_ERROR,
        message: "上传超时，请检查网络连接后重试",
        details: "网络请求超时，可能是网络较慢或服务器响应缓慢",
        originalError,
        retryable: true,
      };
    }

    if (
      errorMessage.includes("refused") ||
      errorMessage.includes("connection")
    ) {
      return {
        type: ImageUploadErrorType.CONNECTION_REFUSED,
        message: "无法连接到上传服务器",
        details: "服务器拒绝连接，请检查服务器地址是否正确或服务器是否正常运行",
        originalError,
        retryable: true,
      };
    }

    return {
      type: ImageUploadErrorType.NETWORK_ERROR,
      message: "网络连接异常，请检查网络后重试",
      details: "网络请求失败，可能是网络不稳定或服务器不可达",
      originalError,
      retryable: true,
    };
  }

  // HTTP状态码错误
  if (errorMessage.includes("401") || errorMessage.includes("unauthorized")) {
    return {
      type: ImageUploadErrorType.UNAUTHORIZED,
      message: "身份验证失败，请检查访问令牌",
      details: "HTTP 401: 未授权访问，可能是token缺失或无效",
      originalError,
      statusCode: 401,
      retryable: false,
    };
  }

  if (errorMessage.includes("403") || errorMessage.includes("forbidden")) {
    return {
      type: ImageUploadErrorType.FORBIDDEN,
      message: "访问被拒绝，权限不足",
      details: "HTTP 403: 禁止访问，可能是权限不足或账户被限制",
      originalError,
      statusCode: 403,
      retryable: false,
    };
  }

  if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
    return {
      type: ImageUploadErrorType.RATE_LIMIT_EXCEEDED,
      message: "请求过于频繁，请稍后再试",
      details: "HTTP 429: 超出速率限制，请等待一段时间后重试",
      originalError,
      statusCode: 429,
      retryable: true,
    };
  }

  if (
    errorMessage.includes("500") ||
    errorMessage.includes("internal server")
  ) {
    return {
      type: ImageUploadErrorType.SERVER_ERROR,
      message: "服务器内部错误，请稍后重试",
      details: "HTTP 500: 服务器内部错误，可能是服务器临时故障",
      originalError,
      statusCode: 500,
      retryable: true,
    };
  }

  if (errorMessage.includes("502") || errorMessage.includes("bad gateway")) {
    return {
      type: ImageUploadErrorType.SERVICE_UNAVAILABLE,
      message: "服务暂时不可用，请稍后重试",
      details: "HTTP 502: 网关错误，上游服务器可能暂时不可用",
      originalError,
      statusCode: 502,
      retryable: true,
    };
  }

  if (
    errorMessage.includes("503") ||
    errorMessage.includes("service unavailable")
  ) {
    return {
      type: ImageUploadErrorType.SERVICE_UNAVAILABLE,
      message: "服务暂时不可用，请稍后重试",
      details: "HTTP 503: 服务不可用，服务器可能正在维护",
      originalError,
      statusCode: 503,
      retryable: true,
    };
  }

  if (
    errorMessage.includes("504") ||
    errorMessage.includes("gateway timeout")
  ) {
    return {
      type: ImageUploadErrorType.TIMEOUT_ERROR,
      message: "服务器响应超时，请稍后重试",
      details: "HTTP 504: 网关超时，上游服务器响应超时",
      originalError,
      statusCode: 504,
      retryable: true,
    };
  }

  // Token相关错误
  if (
    errorMessage.includes("token") &&
    (errorMessage.includes("expired") || errorMessage.includes("过期"))
  ) {
    return {
      type: ImageUploadErrorType.TOKEN_EXPIRED,
      message: "访问令牌已过期，请重新登录",
      details: "身份验证令牌已过期，需要重新获取有效的令牌",
      originalError,
      retryable: false,
    };
  }

  if (
    errorMessage.includes("token") &&
    (errorMessage.includes("invalid") || errorMessage.includes("无效"))
  ) {
    return {
      type: ImageUploadErrorType.TOKEN_INVALID,
      message: "访问令牌无效，请检查配置",
      details: "身份验证令牌格式错误或无效",
      originalError,
      retryable: false,
    };
  }

  // 文件相关错误
  if (
    errorMessage.includes("file size") ||
    errorMessage.includes("文件大小") ||
    errorMessage.includes("too large")
  ) {
    return {
      type: ImageUploadErrorType.FILE_TOO_LARGE,
      message: "文件大小超过限制",
      details: "上传的图片文件过大，请压缩后重试",
      originalError,
      retryable: false,
    };
  }

  if (
    errorMessage.includes("file type") ||
    errorMessage.includes("文件类型") ||
    errorMessage.includes("not supported")
  ) {
    return {
      type: ImageUploadErrorType.FILE_TYPE_NOT_SUPPORTED,
      message: "不支持的文件类型",
      details: "上传的文件类型不被支持，请使用JPG、PNG、GIF等常见图片格式",
      originalError,
      retryable: false,
    };
  }

  if (
    errorMessage.includes("corrupted") ||
    errorMessage.includes("损坏") ||
    errorMessage.includes("invalid file")
  ) {
    return {
      type: ImageUploadErrorType.FILE_CORRUPTED,
      message: "文件已损坏或格式错误",
      details: "上传的文件可能已损坏或格式不正确",
      originalError,
      retryable: false,
    };
  }

  // 配置相关错误
  if (
    errorMessage.includes("upload url") ||
    errorMessage.includes("上传地址")
  ) {
    return {
      type: ImageUploadErrorType.INVALID_UPLOAD_URL,
      message: "上传服务地址配置错误",
      details: "上传URL配置无效或格式错误",
      originalError,
      retryable: false,
    };
  }

  if (errorMessage.includes("config") || errorMessage.includes("配置")) {
    return {
      type: ImageUploadErrorType.INVALID_CONFIG,
      message: "上传服务配置错误",
      details: "上传服务的配置参数无效或缺失",
      originalError,
      retryable: false,
    };
  }

  // 响应格式错误
  if (
    errorMessage.includes("image url") ||
    errorMessage.includes("图片链接") ||
    errorMessage.includes("缺少")
  ) {
    return {
      type: ImageUploadErrorType.MISSING_IMAGE_URL,
      message: "服务器返回数据格式错误",
      details: "服务器成功处理请求但返回的数据中缺少图片链接",
      originalError,
      retryable: false,
    };
  }

  if (
    errorMessage.includes("response") ||
    errorMessage.includes("json") ||
    errorMessage.includes("parse")
  ) {
    return {
      type: ImageUploadErrorType.INVALID_RESPONSE,
      message: "服务器返回数据格式错误",
      details: "无法解析服务器返回的数据，可能是格式错误或内容损坏",
      originalError,
      retryable: false,
    };
  }

  // 默认未知错误
  return {
    type: ImageUploadErrorType.UNKNOWN_ERROR,
    message: "上传失败，未知错误",
    details: `原始错误信息: ${originalError.message}`,
    originalError,
    retryable: true,
  };
};

/**
 * 获取用户友好的错误信息
 */
export const getErrorMessage = (error: ImageUploadError): string => {
  let message = error.message;

  if (error.details) {
    message += `\n详细信息: ${error.details}`;
  }

  if (error.statusCode) {
    message += `\n状态码: ${error.statusCode}`;
  }

  if (error.retryable) {
    message += "\n\n💡 此错误可能是临时的，建议稍后重试";
  } else {
    message += "\n\n⚠️ 此错误需要检查配置或联系管理员";
  }

  return message;
};

/**
 * 获取简短的错误信息（用于状态栏显示）
 */
export const getShortErrorMessage = (error: ImageUploadError): string => {
  return error.message;
};

/**
 * 判断错误是否可以重试
 */
export const isRetryableError = (error: ImageUploadError): boolean => {
  return error.retryable === true;
};

/**
 * 获取错误的建议解决方案
 */
export const getErrorSolution = (error: ImageUploadError): string => {
  switch (error.type) {
    case ImageUploadErrorType.UNAUTHORIZED:
    case ImageUploadErrorType.TOKEN_EXPIRED:
    case ImageUploadErrorType.TOKEN_INVALID:
      return "请检查访问令牌是否正确配置，或联系管理员获取有效的访问权限";

    case ImageUploadErrorType.FORBIDDEN:
      return "请联系管理员检查账户权限，确保有上传图片的权限";

    case ImageUploadErrorType.FILE_TOO_LARGE:
      return "请压缩图片文件大小后重试，或使用在线图片压缩工具";

    case ImageUploadErrorType.FILE_TYPE_NOT_SUPPORTED:
      return "请使用JPG、PNG、GIF、WebP等常见图片格式";

    case ImageUploadErrorType.NETWORK_ERROR:
    case ImageUploadErrorType.TIMEOUT_ERROR:
      return "请检查网络连接是否正常，或稍后重试";

    case ImageUploadErrorType.SERVER_ERROR:
    case ImageUploadErrorType.SERVICE_UNAVAILABLE:
      return "服务器暂时不可用，请稍后重试或联系技术支持";

    case ImageUploadErrorType.RATE_LIMIT_EXCEEDED:
      return "请求过于频繁，请等待几分钟后再试";

    case ImageUploadErrorType.INVALID_CONFIG:
    case ImageUploadErrorType.INVALID_UPLOAD_URL:
      return "请检查上传服务配置是否正确，或联系管理员";

    default:
      return "请稍后重试，如问题持续存在请联系技术支持";
  }
};
