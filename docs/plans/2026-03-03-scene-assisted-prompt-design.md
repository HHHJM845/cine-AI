# 场景辅助提示词优化设计（Scene Assisted Prompt）

## 1. 背景与目标

当前前端已提供一级/二级场景选择，但生成链路只使用用户输入 `prompt`，场景信息未参与实际生成。  
本设计目标是在“点击生成”时引入场景预制提示词，并通过大模型做冲突消解与合并优化，最终得到更稳定的生成提示词。

核心目标：
- 每个二级场景使用独立 `.md` 文件维护预制提示词，便于后续直接修改。
- 生成时可通过用户开关控制是否启用场景辅助优化。
- 启用后若“冲突消解与合并优化”失败，直接报错并终止生成。
- 预制文件缺失时降级为仅用户输入继续生成，并记录告警日志。

## 2. 需求确认（已冻结）

- 生成时默认流程：走后端编排（单接口），非前端二次请求。
- 预制文件目录：`server/prompts/<primarySceneId>/<subSceneId>.md`。
- 优化结果仅用于本次后端生成，不回填前端输入框。
- 新增独立 provider：`PROMPT_MERGE_PROVIDER`。
- 前端请求携带：`primarySceneId + subSceneId`（开关开启时必填）。
- 预制提示词文件为纯文本，不支持模板变量。
- 优化后提示词语言跟随用户输入语言。
- 开关逻辑：
  - `enableSceneAssist = true`：启用场景辅助优化。
  - `enableSceneAssist = false`：跳过场景辅助，沿用原逻辑。
- 失败策略：
  - 场景文件缺失/空：降级继续生成 + `warn` 日志。
  - 合并优化调用失败（开关开启）：直接报错，不发起生成。

## 3. 总体架构

采用“生成接口内编排”：

1. 前端调用 `POST /api/generate-images` 时新增场景辅助字段。
2. 后端在进入现有生成用例前，先计算 `effectivePrompt`。
3. 将 `effectivePrompt` 作为最终提示词传给图像生成模型。

不新增独立优化接口，减少前端状态管理和链路复杂度。

## 4. 模块设计

### 4.1 `server/services/scene-prompt-loader.ts`

职责：
- 根据 `primarySceneId` 与 `subSceneId` 读取预制 prompt 文件。

输入：
- `primarySceneId: string`
- `subSceneId: string`

输出：
- `presetPrompt: string | null`
- `sourcePath: string`

规则：
- 文件不存在、不可读或内容为空时返回 `presetPrompt = null`。
- 不在该层抛业务错误，由上层编排决定降级策略。

### 4.2 `server/services/prompt-merge.ts`

职责：
- 调用 `PROMPT_MERGE_PROVIDER` 对“预制 prompt + 用户 prompt”做冲突消解与合并优化。

输入：
- `presetPrompt: string`
- `userPrompt: string`
- `primarySceneId?: string`
- `subSceneId?: string`

输出：
- `optimizedPrompt: string`

规则：
- 保持用户输入语言。
- 返回纯文本 prompt。
- 调用失败时抛错，由上层决定终止生成。

### 4.3 `server/services/scene-assisted-prompt.ts`

职责：
- 作为编排层生成最终 `effectivePrompt`。

流程：
1. `enableSceneAssist=false`：直接返回 `userPrompt.trim()`。
2. `enableSceneAssist=true`：
   - 调用 loader 读取预设。
   - 若预设为空：`warn` + 返回 `userPrompt.trim()`（降级）。
   - 若预设存在：调用 merge，成功返回 `optimizedPrompt`。
   - merge 失败：抛错，阻止后续生成。

## 5. 接口与类型变更

### 5.1 前端请求类型扩展

`src/services/generate-images.ts`：
- 新增 `enableSceneAssist: boolean`
- 新增 `primarySceneId?: string`
- 新增 `subSceneId?: string`

### 5.2 后端输入类型扩展

`server/types.ts` 的 `GenerateImagesInput` 对齐新增字段：
- `enableSceneAssist: boolean`
- `primarySceneId?: string`
- `subSceneId?: string`

### 5.3 请求校验扩展

`server/validation/generate-request.ts`：
- 校验 `enableSceneAssist` 为布尔值。
- 当 `enableSceneAssist=true` 时，`primarySceneId`、`subSceneId` 必填且非空字符串。
- 当 `enableSceneAssist=false` 时不强制场景字段。

## 6. 数据流

1. 用户点击“生成”。
2. 前端提交生成请求（含场景开关与场景 ID）。
3. 后端校验通过后计算 `effectivePrompt`：
   - 开关关：`effectivePrompt = userPrompt`。
   - 开关开：`effectivePrompt = merge(presetPrompt, userPrompt)` 或降级值。
4. 以 `effectivePrompt` 调用图像生成模型。
5. 返回批次结果；`batch.prompt` 存最终实际使用的提示词。

## 7. 错误处理策略

- 参数校验失败：HTTP `400`。
- 场景预设缺失/空：降级继续（`warn` 日志，不中断）。
- merge 调用失败（开关开启）：HTTP `500`，明确返回原因，中断生成。
- 生成模型失败：维持现有 `500` 行为。

## 8. 配置设计

新增环境变量：
- `PROMPT_MERGE_PROVIDER`：`gemini | openai`（默认可回退到 `IMAGE_TO_PROMPT_PROVIDER` 或 `AI_PROVIDER`，实现阶段定稿）。
- 复用已有对应 provider 的 API Key 与 Base URL 配置。

说明：
- `PROMPT_MERGE_PROVIDER` 仅负责文本合并优化，不影响图像生成 provider。

## 9. 测试策略

### 9.1 单元测试

- `validateGenerateRequest`：
  - 开关开启且缺少场景 ID -> 报错。
  - 开关关闭且无场景 ID -> 通过。
- `scene-prompt-loader`：
  - 正常读取。
  - 文件缺失返回 `null`。
  - 空内容返回 `null`。
- `scene-assisted-prompt`：
  - 开关关闭直通。
  - 开关开启 + 有预设 -> 调 merge。
  - 开关开启 + 无预设 -> 降级 + warn。
  - merge 异常 -> 抛错。

### 9.2 路由集成测试

- 开关开启 + merge 失败 -> `500`，且 `generateImages` 不被调用。
- 开关开启 + 有效路径 -> `200`，`batch.prompt` 为优化后文本。

## 10. 非目标与约束

非目标：
- 不做前端优化结果回填展示。
- 不做模板变量系统。
- 不新增独立 `/api/optimize-prompt` 接口。

约束：
- 需兼容当前并发队列与批次记录流程，不改变其行为语义。

## 11. 交付物

- 设计文档：`docs/plans/2026-03-03-scene-assisted-prompt-design.md`
- 预制 prompt 文件目录骨架：`server/prompts/<primary>/<sub>.md`（实现阶段落地）
- 实现计划文档（下一步由 writing-plans 产出）
