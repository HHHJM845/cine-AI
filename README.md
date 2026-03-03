# Cine 本地开发指南

本项目是一个基于 Vite + React + TypeScript 的前端应用，并新增了一个 Express API 服务用于“参考图 -> 提示词”分析。

## 环境要求

- Node.js 18+
- 可用的 Gemini API Key

## 安装依赖

```bash
npm install
```

## 环境变量

复制 `.env.example` 为 `.env.local`，并至少配置：

```bash
GEMINI_API_KEY=你的密钥
```

说明：
- `GEMINI_API_KEY` 仅由后端 API 读取，前端不直接访问模型。
- 可选 `API_PORT`，默认 `8787`。

## 本地联调（推荐）

终端 A（启动 API）：

```bash
npm run dev:api
```

终端 B（启动前端）：

```bash
npm run dev
```

前端通过 Vite 代理把 `/api/*` 转发到 `http://127.0.0.1:8787`。

## 常用命令

- `npm run test`：运行 Vitest 测试
- `npm run lint`：TypeScript 类型检查
- `npm run build`：构建生产包
- `npm run preview`：预览构建产物

## 功能说明（参考图解析）

在“生成”界面上传参考图后：

1. 自动调用后端接口 `/api/image-to-prompt`
2. 后端使用 `gemini-3-flash-preview` 分析图像
3. 返回详细英文提示词并覆盖输入框
4. 若失败，保留原提示词并显示失败提示

## 图片生成功能（Nano Banana Pro）

- 模型固定：`gemini-3-pro-image-preview`
- 生成接口：`POST /api/generate-images`
- 历史接口：`GET /api/generation-batches?limit=20`
- 结果持久化：图片写入本地磁盘，批次与状态写入 SQLite

### 新增环境变量

```bash
SQLITE_PATH=storage/cine.db
GENERATED_STORAGE_DIR=storage/generated
```

### 生成请求示例

```json
{
  "prompt": "cinematic sci-fi city at night",
  "aspectRatio": "16:9",
  "count": 4
}
```
