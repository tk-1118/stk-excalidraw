# MentionInput 集成指南

## 概述

MentionInput 组件现已完全集成到 Excalidraw 的 annotation 功能中，支持在注释中使用 @ 符号提及应用服务。本指南说明如何配置和使用这个功能。

## 配置方法

### 1. UIOptions 配置

在初始化 Excalidraw 时，通过 `UIOptions.businessServiceInfo.applicationServiceTree` 传递应用服务数据：

```typescript
const UIOptions = {
  businessServiceInfo: {
    designTitle: "业务服务原型设计",
    serviceName: "用户管理服务",
    businessServiceSN: "user-management-v1",
    // 新增：应用服务树数据
    applicationServiceTree: [
      {
        id: "1",
        name: "用户管理上下文",
        boundedContextName: "用户管理上下文",
        boundedContextEnglishName: "UserManagement",
        businessServiceInfoList: [
          {
            businessServiceName: "用户服务",
            businessServiceEnglishName: "UserService",
            applicationServiceInfoList: [
              {
                applicationServiceName: "用户注册",
                applicationServiceEnglishName: "UserRegistration"
              },
              {
                applicationServiceName: "用户登录",
                applicationServiceEnglishName: "UserLogin"
              },
              {
                applicationServiceName: "用户信息查询",
                applicationServiceEnglishName: "UserQuery"
              }
            ]
          },
          {
            businessServiceName: "权限服务",
            businessServiceEnglishName: "PermissionService",
            applicationServiceInfoList: [
              {
                applicationServiceName: "角色管理",
                applicationServiceEnglishName: "RoleManagement"
              },
              {
                applicationServiceName: "权限验证",
                applicationServiceEnglishName: "PermissionValidation"
              }
            ]
          }
        ]
      },
      {
        id: "2",
        name: "订单管理上下文",
        boundedContextName: "订单管理上下文",
        boundedContextEnglishName: "OrderManagement",
        businessServiceInfoList: [
          {
            businessServiceName: "订单服务",
            businessServiceEnglishName: "OrderService",
            applicationServiceInfoList: [
              {
                applicationServiceName: "创建订单",
                applicationServiceEnglishName: "CreateOrder"
              },
              {
                applicationServiceName: "查询订单",
                applicationServiceEnglishName: "QueryOrder"
              },
              {
                applicationServiceName: "取消订单",
                applicationServiceEnglishName: "CancelOrder"
              }
            ]
          }
        ]
      }
    ]
  }
};

// 初始化 Excalidraw
<Excalidraw
  UIOptions={UIOptions}
  // ... 其他配置
/>
```

### 2. 数据结构说明

#### ApplicationService 接口
```typescript
interface ApplicationService {
  id: string;                           // 唯一标识
  name: string;                         // 显示名称
  description?: string;                 // 描述信息
  category?: string;                    // 分类
  boundedContextName?: string;          // 限界上下文名称
  boundedContextEnglishName?: string;   // 限界上下文英文名称
  businessServiceInfoList?: BusinessServiceInfo[];  // 业务服务列表
}
```

#### BusinessServiceInfo 接口
```typescript
interface BusinessServiceInfo {
  businessServiceName: string;         // 业务服务名称
  businessServiceEnglishName: string;  // 业务服务英文名称
  applicationServiceInfoList?: ApplicationServiceInfo[];  // 应用服务列表
}
```

#### ApplicationServiceInfo 接口
```typescript
interface ApplicationServiceInfo {
  applicationServiceName: string;      // 应用服务名称
  applicationServiceEnglishName: string;  // 应用服务英文名称
  [key: string]: any;                  // 扩展字段
}
```

## 使用方法

### 1. 创建注释

1. 在画布上双击空白区域
2. 选择"注释"工具
3. 在画布上拖拽创建注释框

### 2. 编辑注释内容

1. 双击已创建的注释元素
2. 在弹出的注释编辑侧边栏中找到"服务端接口交互"部分
3. 点击展开该部分

### 3. 使用 @ 提及功能

1. 在"服务端接口交互"输入框中输入 `@` 符号
2. 系统会自动显示可用的应用服务列表
3. 可以输入关键词进行搜索过滤
4. 点击选择需要的应用服务
5. 选中的服务会以蓝色标签形式插入到文本中

### 4. 编辑提及内容

- **删除提及标签**: 将光标放在提及标签上，按 `Backspace` 或 `Delete` 键
- **移动光标**: 使用方向键在文本和提及标签之间移动
- **关闭下拉框**: 按 `ESC` 键关闭提及下拉框

## 数据保存和回显

### 1. 数据保存格式

当用户提交注释时，系统会保存两种格式的数据：

#### JSON 格式（存储在 customData.rawData）
```json
{
  "purpose": "页面顶部的用户登录表单",
  "operation": "提供用户登录功能",
  "result": "用户输入用户名密码后点击登录按钮",
  "interaction": "调用 <span class=\"mention-tag\" data-type=\"application\" data-bounded-context=\"用户管理上下文\" data-business-service=\"用户服务\" data-application-service=\"用户登录\">@用户服务/用户登录</span> 进行身份验证",
  "requirements": "需要验证输入格式",
  "mapping": "使用 el-form 组件"
}
```

#### 显示格式（存储在 element.text）
```
组件：

作用对象: 页面顶部的用户登录表单

需求说明: 提供用户登录功能

用户操作与交互: 用户输入用户名密码后点击登录按钮

服务端接口交互: 调用 @用户服务/用户登录 进行身份验证

特殊要求: 需要验证输入格式
```

### 2. 数据回显

当用户重新编辑注释时：
1. 系统会从 `customData.rawData` 中读取原始 JSON 数据
2. 如果 `interaction` 字段包含 HTML 标签，会正确回显为可交互的提及标签
3. 用户可以继续编辑文本和提及标签

## 技术实现

### 1. 数据流

```
用户配置 UIOptions → LayerUI 传递给 AnnotationSidebar → MentionInput 接收数据
用户输入 @ → 触发下拉框 → 选择服务 → 插入提及标签
保存时 → 提取 HTML 内容 → 存储到 JSON → 保存到元素
回显时 → 读取 JSON → 检测 HTML → 设置到 MentionInput
```

### 2. 事件处理

- **事件隔离**: MentionInput 组件通过 `stopPropagation()` 阻止事件冒泡到画布
- **键盘支持**: 支持所有常用键盘操作，不会触发画布快捷键
- **鼠标交互**: 支持点击、拖拽等操作，不会影响画布状态

## 最佳实践

### 1. 数据配置

- **完整性**: 确保 `applicationServiceTree` 数据结构完整
- **命名规范**: 使用清晰的中英文名称
- **层级关系**: 正确设置限界上下文、业务服务、应用服务的层级关系

### 2. 用户体验

- **搜索优化**: 提供有意义的服务名称，便于搜索
- **分类清晰**: 合理组织服务分类，避免过于复杂的层级
- **文档说明**: 为用户提供使用说明和示例

### 3. 性能考虑

- **数据量控制**: 避免过大的服务树数据
- **懒加载**: 如果数据量很大，考虑实现懒加载机制
- **缓存策略**: 合理缓存服务数据，避免重复请求

## 故障排除

### 常见问题

**Q: @ 符号无法触发下拉框？**
A: 检查 `UIOptions.businessServiceInfo.applicationServiceTree` 是否正确配置。

**Q: 提及标签无法回显？**
A: 确保保存的数据中包含完整的 HTML 标签信息。

**Q: 键盘输入被画布拦截？**
A: 这是正常的，MentionInput 组件已经处理了事件隔离。

**Q: 服务列表为空？**
A: 检查数据结构是否符合接口定义，特别是嵌套的数组结构。

## 更新日志

### v1.0.0 (2024-12-XX)
- ✨ 完整的 @ 提及功能
- ✨ 与 Excalidraw annotation 系统集成
- ✨ 支持数据回显和编辑
- ✨ 完整的事件处理和键盘支持
- ✨ 类型安全的 TypeScript 实现

---

如有问题或建议，请查看相关文档或提交 Issue。
