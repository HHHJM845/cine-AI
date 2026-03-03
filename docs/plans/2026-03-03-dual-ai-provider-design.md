# 双 Provider（Gemini/OpenAI 兼容）设计说明

## 目标
后端同时支持 Gemini 与 OpenAI 兼容接口，通过环境变量切换，前端无需改动。

## 范围
- 保持现有 Gemini 行为不变。
- 新增 OpenAI 兼容的图生文与文生图服务。
- 在后端入口按 `AI_PROVIDER` 选择 Provider。
- 新增环境变量示例与中文说明。

## 非目标
- 不改前端调用协议。
- 不做运行时热切换（进程启动时确定 Provider）。

## 配置设计
- `AI_PROVIDER=gemini|openai`，默认 `gemini`
- Gemini:
  - `GEMINI_API_KEY`
- OpenAI 兼容:
  - `OPENAI_BASE_URL`（示例：`https://api.openai.com/v1`）
  - `OPENAI_API_KEY`
  - `OPENAI_TEXT_MODEL`（图生文）
  - `OPENAI_IMAGE_MODEL`（文生图）

## 代码结构设计
- 新增 `server/services/openai-image-to-prompt.ts`
- 新增 `server/services/openai-image-generator.ts`
- 新增 `server/services/ai-provider.ts`（Provider 组装与校验）
- 修改 `server/index.ts` 改为统一从 Provider 取 `analyzeImage/generateImages`

## 兼容性与错误处理
- OpenAI 兼容返回优先解析 `b64_json`，其次 `url`。
- 对配置缺失给出明确错误信息。
- 继续沿用现有批次失败项机制，确保前端能展示错误原因。

## 测试策略
- 先写失败测试：
  - OpenAI 图生文解析与请求格式
  - OpenAI 文生图解析（`b64_json` 与 `url`）
  - Provider 选择与配置校验
- 再写最小实现让测试通过。
