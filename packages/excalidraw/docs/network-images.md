# 网络图片功能

Excalidraw 现在支持网络图片功能，允许用户粘贴本地图片时自动上传到服务器，并在画布上显示网络链接的图片。这样可以确保画布数据只保存网络链接，而不是完整的图片文件数据。

## 功能特性

- ✅ **本地图片自动上传**: 粘贴本地图片时自动上传到配置的服务器
- ✅ **网络图片直接显示**: 粘贴网络图片链接时直接在画布上显示
- ✅ **数据轻量化**: 保存的画布数据只包含图片链接，不包含文件数据
- ✅ **自定义上传服务**: 支持配置自定义的图片上传逻辑
- ✅ **错误处理**: 完善的错误处理和用户提示
- ✅ **缓存优化**: 网络图片缓存机制，提高渲染性能

## 基本配置

### 快速开始 - ZZ-Infra 服务

如果你使用的是 ZZ-Infra 图片上传服务，可以直接使用预配置：

```tsx
import { Excalidraw } from "@excalidraw/excalidraw";
import { zzInfraConfig } from "@excalidraw/excalidraw/data/zzInfraConfig";

export const App = () => {
  return (
    <Excalidraw 
      imageUploadConfig={zzInfraConfig}
      onChange={(elements, appState, files) => {
        // 网络图片元素会包含 imageUrl 字段
        const networkImages = elements.filter(el => 
          el.type === 'image' && 'imageUrl' in el && el.imageUrl
        );
        console.log('网络图片:', networkImages);
      }}
    />
  );
};
```

### 1. 使用默认上传配置

```tsx
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ImageUploadConfig } from "@excalidraw/excalidraw";

const uploadConfig: ImageUploadConfig = {
  uploadUrl: '/api/upload-image',
  headers: {
    'Authorization': 'Bearer your-token-here',
  },
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
};

export const App = () => {
  return (
    <Excalidraw imageUploadConfig={uploadConfig} />
  );
};
```

### 2. 使用自定义上传函数

```tsx
const customUpload = async (file: File): Promise<string> => {
  // 你的自定义上传逻辑
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/custom-upload', {
    method: 'POST',
    body: formData,
  });
  
  const result = await response.json();
  return result.url; // 返回图片网络链接
};

const uploadConfig: ImageUploadConfig = {
  uploadUrl: '', // 使用自定义函数时可以为空
  customUpload,
  maxFileSize: 5 * 1024 * 1024, // 5MB
};

export const App = () => {
  return (
    <Excalidraw imageUploadConfig={uploadConfig} />
  );
};
```

## 配置选项

### ImageUploadConfig

| 属性 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `uploadUrl` | `string` | 是* | - | 图片上传接口地址 |
| `headers` | `Record<string, string>` | 否 | `{}` | 请求头配置 |
| `maxFileSize` | `number` | 否 | `10MB` | 最大文件大小（字节） |
| `allowedTypes` | `string[]` | 否 | 常见图片格式 | 支持的文件类型 |
| `customUpload` | `(file: File) => Promise<string>` | 否 | - | 自定义上传函数 |

*注：使用 `customUpload` 时，`uploadUrl` 可以为空

## 服务端实现示例

### ZZ-Infra 服务配置

ZZ-Infra 服务接口信息：
- **接口地址**: `http://49.232.13.110:83/zz-infra/zz-resource/oss/endpoint/put-file-attach`
- **请求方法**: POST
- **请求格式**: FormData (包含 file 字段)
- **返回格式**: 
```json
{
  "attachId": 0,
  "domain": "",
  "link": "图片访问链接",
  "name": "",
  "originalName": ""
}
```

#### 基础配置

```tsx
import { zzInfraConfig } from "@excalidraw/excalidraw/data/zzInfraConfig";

<Excalidraw imageUploadConfig={zzInfraConfig} />
```

#### 带认证的配置

```tsx
import { createZZInfraConfigWithAuth } from "@excalidraw/excalidraw/data/zzInfraConfig";

const configWithAuth = createZZInfraConfigWithAuth("your-auth-token");
<Excalidraw imageUploadConfig={configWithAuth} />
```

#### 自定义处理配置

```tsx
import { zzInfraCustomConfig } from "@excalidraw/excalidraw/data/zzInfraConfig";

<Excalidraw imageUploadConfig={zzInfraCustomConfig} />
```

### Node.js + Express

```javascript
const express = require('express');
const multer = require('multer');
const OSS = require('ali-oss');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// 配置阿里云OSS
const ossClient = new OSS({
  region: 'your-region',
  accessKeyId: 'your-access-key-id',
  accessKeySecret: 'your-access-key-secret',
  bucket: 'your-bucket-name',
});

app.post('/api/upload-image', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // 生成唯一文件名
    const fileName = `excalidraw-images/${Date.now()}-${file.originalname}`;
    
    // 上传到OSS
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
```

### Python + FastAPI

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import boto3
from botocore.exceptions import ClientError
import uuid
from datetime import datetime

app = FastAPI()

# 配置AWS S3
s3_client = boto3.client(
    's3',
    aws_access_key_id='your-access-key',
    aws_secret_access_key='your-secret-key',
    region_name='your-region'
)

@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...)):
    try:
        # 验证文件类型
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # 生成唯一文件名
        file_extension = file.filename.split('.')[-1]
        unique_filename = f"excalidraw-images/{datetime.now().isoformat()}-{uuid.uuid4()}.{file_extension}"
        
        # 上传到S3
        s3_client.upload_fileobj(
            file.file,
            'your-bucket-name',
            unique_filename,
            ExtraArgs={'ContentType': file.content_type}
        )
        
        # 生成公开访问URL
        url = f"https://your-bucket-name.s3.your-region.amazonaws.com/{unique_filename}"
        
        return JSONResponse({
            "url": url,
            "name": file.filename,
            "size": file.size
        })
        
    except ClientError as e:
        raise HTTPException(status_code=500, detail="Upload failed")
```

## 使用场景

### 1. 粘贴本地图片

用户可以直接粘贴本地图片文件，系统会：
1. 自动上传图片到配置的服务器
2. 获取上传后的网络链接
3. 在画布上显示图片
4. 保存时只保存网络链接，不保存文件数据

### 2. 粘贴网络图片

#### 方式一：粘贴HTML内容
用户可以粘贴包含图片的网页内容或HTML，系统会：
1. 自动识别图片URL
2. 直接在画布上显示网络图片
3. 保存时保存图片链接

#### 方式二：直接粘贴图片URL文本
用户可以直接复制图片URL文本并粘贴到画布，系统会：
1. 智能识别文本是否为图片链接
2. 自动在画布上显示图片
3. 支持多种URL格式识别

**支持的URL格式：**
- 带图片扩展名的URL：`https://example.com/image.jpg`
- 知名图片服务：`https://images.unsplash.com/photo-xxx`
- 包含图片路径：`https://example.com/media/photo123`
- 带参数的图片API：`https://api.example.com/image?id=123&format=png`

**支持的图片服务域名：**
- Unsplash, Pixabay, Pexels
- Imgur, Flickr, Gravatar
- GitHub, AWS, 阿里云, 腾讯云
- 以及更多常见图片服务

### 3. 拖拽图片文件

用户拖拽本地图片文件到画布时，系统会按照粘贴本地图片的流程处理。

## 数据结构

### 网络图片元素

```typescript
{
  type: "image",
  id: "unique-id",
  imageUrl: "https://example.com/image.jpg", // 网络图片链接
  fileId: null, // 网络图片不需要 fileId
  status: "saved",
  // ... 其他属性
}
```

### 文件图片元素（传统方式）

```typescript
{
  type: "image",
  id: "unique-id",
  imageUrl: null, // 没有网络链接
  fileId: "file-hash-id", // 文件ID
  status: "saved",
  // ... 其他属性
}
```

## 注意事项

1. **CORS配置**: 确保图片服务器正确配置了CORS，允许跨域访问
2. **图片格式**: 支持常见的图片格式（JPEG、PNG、GIF、WebP、SVG）
3. **文件大小**: 建议设置合理的文件大小限制，避免上传过大的图片
4. **错误处理**: 实现完善的错误处理，给用户友好的提示
5. **安全性**: 在服务端验证文件类型和大小，防止恶意上传
6. **性能**: 大量网络图片可能影响加载性能，建议使用CDN

## 迁移指南

如果你已经在使用 Excalidraw，升级到支持网络图片的版本需要：

1. **更新依赖**: 升级到最新版本的 Excalidraw
2. **配置上传服务**: 添加 `imageUploadConfig` 配置
3. **服务端支持**: 实现图片上传接口
4. **测试**: 测试图片粘贴和保存功能

现有的画布数据完全兼容，不需要进行数据迁移。
