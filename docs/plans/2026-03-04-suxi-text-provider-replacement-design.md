# suxi 文本链路替换设计（图生文 + Prompt 优化）

## 1. 背景与目标
当前后端文本链路（图生文、Prompt 优化）支持多 Provider 分流。现需求是将这两条链路直接替换为 suxi.ai，同时保持文生图链路不变。

本设计目标：
- 图生文固定走 suxi（模型 `gpt-4o-mini`）。
- Prompt 优化固定走 suxi（模型 `deepseek-v3`）。
- 文生图继续按现有 `IMAGE_GENERATION_PROVIDER` 逻辑执行，不改前端。
- 不保留文本链路的旧 Provider 切换（直接替换，无自动降级）。

## 2. 范围确认（已冻结）
- 仅替换后端两条文本能力：
  - `POST /api/image-to-prompt`
  - 场景辅助生成中的 Prompt merge
- 不改前端 UI，不新增前端模型切换。
- 低并发场景，稳定性优先于极致性能/最低成本。
- 允许图生文模型与优化模型分开。

## 3. 总体架构
采用“文本链路固定 suxi + 图像链路保持现状”的双轨结构：

1. 文本链路（固定）：
- `analyzeImage` 固定由 suxi OpenAI 兼容接口提供。
- `mergePrompt` 固定由 suxi OpenAI 兼容接口提供。

2. 图像链路（保持原样）：
- `generateFromModel` 继续走 `IMAGE_GENERATION_PROVIDER`（`gemini | openai | gemini_http`）。

3. 解耦原则：
- 文本链路与文生图链路独立配置、独立失败，不互相回退。

## 4. 配置设计
新增（或固定使用）后端环境变量：

- `SUXI_BASE_URL`（默认 `https://new.suxi.ai/v1`）
- `SUXI_API_KEY`（必填）
- `SUXI_VISION_MODEL`（默认 `gpt-4o-mini`，用于图生文）
- `SUXI_TEXT_MODEL`（默认 `deepseek-v3`，用于 Prompt 优化）

保留现有文生图相关变量：
- `IMAGE_GENERATION_PROVIDER`
- `GEMINI_*` / `OPENAI_*` / `GEMINI_HTTP_*`（仅用于文生图现有逻辑）

## 5. 模块改造方案
### 5.1 `server/services/ai-provider.ts`
- 移除文本链路的 provider 分流决策（不再使用 `IMAGE_TO_PROMPT_PROVIDER` / `PROMPT_MERGE_PROVIDER`）。
- 固定构建：
  - `createOpenAIImageToPrompt({ apiKey: SUXI_API_KEY, baseUrl: SUXI_BASE_URL, model: SUXI_VISION_MODEL })`
  - `createOpenAIPromptMerge({ apiKey: SUXI_API_KEY, baseUrl: SUXI_BASE_URL, model: SUXI_TEXT_MODEL })`
- `generateFromModel` 保持现有分支。

### 5.2 `server/index.ts`
- 仅继续注入 `aiServices.analyzeImage` / `aiServices.mergePrompt` / `aiServices.generateFromModel`，不改调用结构。

### 5.3 文档配置
- 更新 `.env.example`：补充 suxi 配置说明与默认值。
- 更新 `README.md`：说明文本链路固定 suxi、文生图保持可选 Provider。

## 6. 数据流
### 6.1 图生文
1. 前端上传图片到 `/api/image-to-prompt`（不变）。
2. 后端调用 suxi `/chat/completions`，模型 `gpt-4o-mini`，消息包含 `image_url(data:...)`。
3. 返回文本沿用现有清洗逻辑并响应前端。

### 6.2 Prompt 优化
1. 生成请求进入 `scene-assisted-prompt`（不变）。
2. `mergePrompt` 固定调用 suxi `/chat/completions`，模型 `deepseek-v3`。
3. 返回优化后 Prompt 再进入现有文生图流程。

### 6.3 文生图
- 完全保持现有流程与 Provider 选择。

## 7. 错误处理策略
- 启动期：
  - `SUXI_API_KEY` 缺失 -> 启动失败（fail-fast）。
  - `SUXI_BASE_URL` 缺失 -> 使用默认值。
  - 模型变量缺失 -> 使用默认值。
- 运行期：
  - 图生文/优化调用失败时，按现有错误封装向上抛出。
- 回退策略：
  - 不自动降级回 gemini/openai 文本链路（符合“直接替换”要求）。

## 8. 测试策略
### 8.1 单元测试
重点改造 `server/__tests__/ai-provider.test.ts`：
- 缺失 `SUXI_API_KEY` 抛错。
- `analyzeImage` 固定使用 suxi 视觉模型。
- `mergePrompt` 固定使用 suxi 文本模型。
- `generateFromModel` 仍支持既有 provider 路径。

### 8.2 回归验证
- `npm run lint`
- `npm run build`
- 手动验证：
  - 上传参考图 -> 自动生成 Prompt。
  - 启用场景辅助生成 -> Prompt 被优化合并。
  - 文生图继续可用。

## 9. 非目标
- 不新增前端模型选择。
- 不新增 suxi 专属后端路由。
- 不改变文生图模型选择交互。

## 10. 交付物
- 设计文档：`docs/plans/2026-03-04-suxi-text-provider-replacement-design.md`
- 实施计划文档：下一步由 writing-plans 产出。
