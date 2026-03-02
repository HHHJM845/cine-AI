# Nano Banana Pro 图片生成设计文档

## 1. 背景与目标

当前项目的“生成”按钮尚未接入真实图片生成能力，已有的 Google SDK 能力仅用于“参考图 -> 提示词”分析。

本次目标是在“生成”界面接入 Google GEN SDK 的图片生成能力，模型固定为 `gemini-3-pro-image-preview`（Nano Banana Pro），并满足以下业务要求：

- 用户可选择生成数量 `1-4` 张。
- 采用“成本优先”策略：单次调用尽量返回 N 张。
- 若不足 N 张，界面必须展示失败位。
- 仅支持“整批重试”，重试结果作为新批次追加。
- 结果持久化：图片落本地磁盘，元数据落 SQLite。
- 刷新页面后历史批次可恢复。

## 2. 方案对比与结论

### 2.1 方案 A：同步直出 + 单表/双表记录（采用）

- 新增 `POST /api/generate-images` 同步生成。
- 新增 `GET /api/generation-batches` 拉取历史。
- 单次模型调用获取多图，按请求数量补齐失败占位。

优点：
- 实现成本低，交付快。
- 与当前前端“批次列表”结构匹配度高。

缺点：
- 同步请求耗时受模型响应影响，长请求体验一般。

### 2.2 方案 B：异步任务队列 + 轮询状态（不采用）

优点：
- 支持更细粒度状态流转和高并发扩展。

缺点：
- 引入任务系统和状态机，超出当前最小可交付范围。

### 2.3 方案 C：前端直连模型（不采用）

优点：
- 接口链路短。

缺点：
- API Key 暴露风险高，不符合现有后端代理架构。

## 3. 架构设计

### 3.1 总体流程

1. 前端提交 `prompt + aspectRatio + count` 到 `POST /api/generate-images`。
2. 后端调用 `gemini-3-pro-image-preview` 尝试返回多张图。
3. 后端将成功图写入磁盘，将批次与条目写入 SQLite。
4. 对不足张数或解析失败条目写入 `failed` 占位条目。
5. 前端收到批次后追加显示；页面初始化时通过 `GET /api/generation-batches` 恢复历史。

### 3.2 模块边界

- 前端：
  - 生成参数收集与请求发起。
  - 批次追加展示与失败位可视化。
  - 整批重试行为触发。
- 后端：
  - 请求校验与模型调用。
  - 图片落盘与 URL 暴露。
  - SQLite 持久化与历史查询。

## 4. 数据模型

### 4.1 `generation_batches`

- `id` TEXT PRIMARY KEY
- `prompt` TEXT NOT NULL
- `aspect_ratio` TEXT NOT NULL
- `requested_count` INTEGER NOT NULL
- `model` TEXT NOT NULL (`gemini-3-pro-image-preview`)
- `status` TEXT NOT NULL (`completed` | `partial_failed` | `failed`)
- `created_at` INTEGER NOT NULL

### 4.2 `generation_items`

- `id` TEXT PRIMARY KEY
- `batch_id` TEXT NOT NULL
- `position` INTEGER NOT NULL
- `status` TEXT NOT NULL (`success` | `failed`)
- `image_path` TEXT NULL
- `error_message` TEXT NULL
- `width` INTEGER NULL
- `height` INTEGER NULL
- `created_at` INTEGER NOT NULL

约束：
- 每批 `position` 必须连续覆盖 `1..requested_count`。
- 失败条目必须有 `error_message`。
- 成功条目必须有 `image_path`。

## 5. API 设计

### 5.1 `POST /api/generate-images`

请求体：

```json
{
  "prompt": "string",
  "aspectRatio": "2.39:1|16:9|3:4|9:16|4:3",
  "count": 1
}
```

返回体（示例）：

```json
{
  "batch": {
    "id": "batch_xxx",
    "prompt": "...",
    "aspectRatio": "16:9",
    "requestedCount": 3,
    "model": "gemini-3-pro-image-preview",
    "status": "partial_failed",
    "createdAt": 1760000000000,
    "items": [
      {
        "id": "item_1",
        "position": 1,
        "status": "success",
        "imageUrl": "/generated/2026/03/02/batch_xxx-1.png"
      },
      {
        "id": "item_2",
        "position": 2,
        "status": "failed",
        "errorMessage": "model returned no image"
      },
      {
        "id": "item_3",
        "position": 3,
        "status": "success",
        "imageUrl": "/generated/2026/03/02/batch_xxx-3.png"
      }
    ]
  }
}
```

校验规则：
- `prompt` 不能为空。
- `count` 必须在 `1-4`。
- `aspectRatio` 必须属于允许集合。

### 5.2 `GET /api/generation-batches`

用途：
- 页面初始化加载历史批次。

参数：
- `limit`（可选，默认 20）
- `cursor`（可选，用于分页）

结果：
- 按 `created_at` 倒序返回批次及其 `items`。

## 6. 存储与静态资源

- 落盘路径：`storage/generated/YYYY/MM/DD/<batchId>-<position>.png`
- 数据库仅存相对路径，例如 `2026/03/02/batch_xxx-1.png`
- 通过 Express 静态目录暴露为 `/generated/*`

## 7. 前端交互规则

- 新增数量选择器：`1/2/3/4`。
- 点击“生成”后按钮进入 loading 并防重复提交。
- 成功后批次追加到顶部。
- 批次格子数固定等于请求数：
  - 成功格展示图片。
  - 失败格展示失败占位与错误摘要。
- “再次生成”执行整批重试，结果以新批次追加，不覆盖旧批次。

## 8. 错误处理策略

- 模型调用异常：批次写入失败状态，并保留统一错误信息。
- 模型返回数量不足：补齐失败条目，批次标记 `partial_failed`。
- 文件写盘失败：对应条目标记失败，不影响同批其他条目。
- 前端展示简短错误文案，不清空用户输入提示词。

## 9. 测试与验收

### 9.1 自动化测试

- 后端接口测试：
  - 成功生成并落库。
  - 少图返回时失败占位补齐。
  - 参数校验失败返回 400。
- 存储测试：
  - 成功图写盘 + 路径入库。
  - 失败条目不写盘但可查询。
- 前端服务测试（可最小化）：
  - 批次追加渲染。
  - 失败位可见。
  - 整批重试新增批次。

### 9.2 手工验收

1. 可选择 `1-4` 张并生成。
2. 返回不足张数时可见失败位。
3. 刷新后批次仍在（含失败位）。
4. 点击“再次生成”会新增批次并保留历史。

## 10. 非目标

- 本次不做单张重试。
- 本次不做前端直连模型。
- 本次不引入异步任务队列。
