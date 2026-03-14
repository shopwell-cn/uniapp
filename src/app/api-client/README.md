# @shopware/api-client/uni-request

本目录提供基于 `uni.request` 的 Shopware Frontends API Client，适用于 uni-app 运行时（微信/支付宝等小程序）。

## 能力概览

- Store API 与 Admin API 客户端，兼容 `uni.request`
- 基于 Shopware 类型生成的强类型请求/响应
- 与原 ofetch 版本一致的 hooks 与错误处理语义

## 安装

该客户端已经包含在此仓库中。业务项目只需安装包：

```bash
pnpm add @shopware/api-client
```

## uni-app 小程序快速开始

### 1) 创建客户端

```ts
import { createAPIClient } from "@shopware/api-client/uni-request";

const api = createAPIClient({
  baseURL: "https://your-shop.com/store-api",
  accessToken: "YOUR_ACCESS_KEY",
});
```

### 2) 调用 Store API

```ts
// 示例：读取购物车
const result = await api.invoke("readCart get /checkout/cart");
console.log(result.status, result.data);
```

### 3) 可选：注入自定义 uni.request 适配器

如需统一日志、埋点或请求扩展，可传入自定义适配器：

```ts
import type { UniRequestAdapter } from "@shopware/api-client/uni-request";

const requestAdapter: UniRequestAdapter = (options) => {
  return uni.request(options);
};

const api = createAPIClient({
  baseURL: "https://your-shop.com/store-api",
  accessToken: "YOUR_ACCESS_KEY",
  request: requestAdapter,
});
```

## 在微信小程序中使用

1. 将 Shopware Store API 域名加入小程序 request 合法域名。
2. 确保使用 HTTPS。
3. 在页面或 store 中直接调用客户端。

### 页面示例

```ts
import { createAPIClient } from "@shopware/api-client/uni-request";

const api = createAPIClient({
  baseURL: "https://your-shop.com/store-api",
  accessToken: "YOUR_ACCESS_KEY",
});

export async function loadCart() {
  const { data } = await api.invoke("readCart get /checkout/cart");
  return data;
}
```

## Context Token 与默认头

客户端会自动维护 `sw-context-token`：

```ts
api.hook("onContextChanged", (token) => {
  // 需要持久化时可在此处理
  console.log("Context changed", token);
});

// 也可以设置默认请求头
api.defaultHeaders.apply({
  "sw-language-id": "YOUR_LANGUAGE_ID",
});
```

## 文件上传（multipart/form-data）

在浏览器/小程序等环境中，`multipart/form-data` 的 `Content-Type` 需要由运行时自动补充 boundary。客户端会在检测到该类型时移除手动设置。

```ts
await api.invoke("fileUpload post /core/upload", {
  headers: {
    "Content-Type": "multipart/form-data",
  },
  body: formData,
});
```

## 错误处理

非 2xx 响应会抛出 `ApiClientError`：

```ts
import { ApiClientError } from "@shopware/api-client/uni-request";

try {
  await api.invoke("readCart get /checkout/cart");
} catch (error) {
  if (error instanceof ApiClientError) {
    console.error(error.status, error.details);
  }
}
```

## 超时、重试与中断

支持全局或单次请求配置：

```ts
const api = createAPIClient({
  baseURL: "https://your-shop.com/store-api",
  accessToken: "YOUR_ACCESS_KEY",
  fetchOptions: {
    timeout: 8000,
    retry: 1,
    retryDelay: 300,
  },
});

const controller = new AbortController();

const req = api.invoke("readCart get /checkout/cart", {
  fetchOptions: {
    signal: controller.signal,
  },
});

controller.abort();
await req;
```

## Admin API 客户端

```ts
import { createAdminAPIClient } from "@shopware/api-client/uni-request";

const admin = createAdminAPIClient({
  baseURL: "https://your-shop.com/admin-api",
  credentials: {
    grant_type: "client_credentials",
    client_id: "administration",
    client_secret: "SECRET",
  },
});

await admin.invoke("readUser get /user");
```

## 注意事项

- 新客户端通过 `@shopware/api-client/uni-request` 暴露。
- 该实现不会替换 ofetch 版本，只是新增入口。
- 小程序域名白名单必须包含你的 Shopware API 域名。
