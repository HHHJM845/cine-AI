# suxi 文本链路替换 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将图生文与 Prompt 优化后端能力固定切换到 suxi（`https://new.suxi.ai/v1`），并保持文生图 Provider 选择逻辑不变。

**Architecture:** 在 `server/services/ai-provider.ts` 内部把文本链路改为“固定 suxi”，统一复用现有 OpenAI 兼容实现（`createOpenAIImageToPrompt`、`createOpenAIPromptMerge`）；文生图继续走 `gemini/openai/gemini_http` 分流。通过更新 `ai-provider` 单测 + `.env.example` + `README.md` 保证行为可验证、可维护。

**Tech Stack:** TypeScript, Node.js, Express, Vitest, Vite

---

执行约束（全程遵循）：
- `@superpowers:test-driven-development`
- `@superpowers:verification-before-completion`

### Task 1: 先改测试，锁定“文本固定 suxi”行为

**Files:**
- Modify: `server/__tests__/ai-provider.test.ts`
- Test: `server/__tests__/ai-provider.test.ts`

**Step 1: Write the failing test**

在 `server/__tests__/ai-provider.test.ts` 中新增/替换为以下关键用例（保留文生图相关既有覆盖）：

```ts
it('throws clear error when SUXI_API_KEY is missing', () => {
  expect(() =>
    createAiServicesFromEnv({
      IMAGE_GENERATION_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'g-key',
    }),
  ).toThrow('SUXI_API_KEY is required for text capabilities');
});

it('uses suxi for image-to-prompt and prompt-merge by default', () => {
  const analyzeImage = vi.fn(async () => 'ok');
  const mergePrompt = vi.fn(async () => 'merged');
  const generateFromModel = vi.fn(async () => []);

  const createOpenAIImageToPrompt = vi.fn(() => analyzeImage);
  const createOpenAIPromptMerge = vi.fn(() => mergePrompt);
  const createGeminiImageGenerator = vi.fn(() => generateFromModel);

  const output = createAiServicesFromEnv(
    {
      SUXI_API_KEY: 's-key',
      GEMINI_API_KEY: 'g-key',
      IMAGE_GENERATION_PROVIDER: 'gemini',
    },
    {
      createOpenAIImageToPrompt: createOpenAIImageToPrompt as any,
      createOpenAIPromptMerge: createOpenAIPromptMerge as any,
      createGeminiImageGenerator: createGeminiImageGenerator as any,
    } as any,
  );

  expect(output.analyzeProvider).toBe('suxi');
  expect(output.mergeProvider).toBe('suxi');
  expect(createOpenAIImageToPrompt).toHaveBeenCalledWith({
    apiKey: 's-key',
    baseUrl: 'https://new.suxi.ai/v1',
    model: 'gpt-4o-mini',
  });
  expect(createOpenAIPromptMerge).toHaveBeenCalledWith({
    apiKey: 's-key',
    baseUrl: 'https://new.suxi.ai/v1',
    model: 'deepseek-v3',
  });
});

it('allows overriding suxi base url and models', () => {
  const createOpenAIImageToPrompt = vi.fn(() => vi.fn(async () => 'ok'));
  const createOpenAIPromptMerge = vi.fn(() => vi.fn(async () => 'merged'));
  const createOpenAIImageGenerator = vi.fn(() => vi.fn(async () => []));

  createAiServicesFromEnv(
    {
      SUXI_API_KEY: 's-key',
      SUXI_BASE_URL: 'https://new.suxi.ai/v1',
      SUXI_VISION_MODEL: 'gpt-4o-mini',
      SUXI_TEXT_MODEL: 'deepseek-v3',
      IMAGE_GENERATION_PROVIDER: 'openai',
      OPENAI_API_KEY: 'o-key',
    },
    {
      createOpenAIImageToPrompt: createOpenAIImageToPrompt as any,
      createOpenAIPromptMerge: createOpenAIPromptMerge as any,
      createOpenAIImageGenerator: createOpenAIImageGenerator as any,
    } as any,
  );

  expect(createOpenAIImageToPrompt).toHaveBeenCalledWith({
    apiKey: 's-key',
    baseUrl: 'https://new.suxi.ai/v1',
    model: 'gpt-4o-mini',
  });
  expect(createOpenAIPromptMerge).toHaveBeenCalledWith({
    apiKey: 's-key',
    baseUrl: 'https://new.suxi.ai/v1',
    model: 'deepseek-v3',
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/ai-provider.test.ts`
Expected: FAIL（例如 `SUXI_API_KEY is required for text capabilities` 未抛出，或 `analyzeProvider` 仍为 `gemini/openai`）

**Step 3: Commit test-only changes**

```bash
git add server/__tests__/ai-provider.test.ts
git commit -m "test: define suxi-only text provider behavior"
```

### Task 2: 最小实现 ai-provider 以通过新测试

**Files:**
- Modify: `server/services/ai-provider.ts`
- Test: `server/__tests__/ai-provider.test.ts`

**Step 1: Write minimal implementation**

在 `server/services/ai-provider.ts` 做以下关键实现（保持文生图逻辑不变）：

```ts
const DEFAULT_SUXI_BASE_URL = 'https://new.suxi.ai/v1';
const DEFAULT_SUXI_VISION_MODEL = 'gpt-4o-mini';
const DEFAULT_SUXI_TEXT_MODEL = 'deepseek-v3';

type GenerateProviderName = 'gemini' | 'openai' | 'gemini_http';
type TextProviderName = 'suxi';

export type AiServices = {
  analyzeProvider: TextProviderName;
  generateProvider: GenerateProviderName;
  mergeProvider: TextProviderName;
  analyzeImage: AnalyzeImageFn;
  generateFromModel: GenerateFromModelFn;
  mergePrompt: MergePromptFn;
};

const suxiApiKey = String(env.SUXI_API_KEY || '').trim();
if (!suxiApiKey) {
  throw new Error('SUXI_API_KEY is required for text capabilities');
}
const suxiBaseUrl = String(env.SUXI_BASE_URL || DEFAULT_SUXI_BASE_URL).trim();
const suxiVisionModel = String(env.SUXI_VISION_MODEL || DEFAULT_SUXI_VISION_MODEL).trim();
const suxiTextModel = String(env.SUXI_TEXT_MODEL || DEFAULT_SUXI_TEXT_MODEL).trim();

const analyzeImage = createOpenAIImageToPrompt({
  apiKey: suxiApiKey,
  baseUrl: suxiBaseUrl,
  model: suxiVisionModel,
});

const mergePrompt = createOpenAIPromptMerge({
  apiKey: suxiApiKey,
  baseUrl: suxiBaseUrl,
  model: suxiTextModel,
});

return {
  analyzeProvider: 'suxi',
  generateProvider,
  mergeProvider: 'suxi',
  analyzeImage,
  generateFromModel,
  mergePrompt,
};
```

实现要求：
- 删除文本链路对 `AI_PROVIDER` / `IMAGE_TO_PROMPT_PROVIDER` / `PROMPT_MERGE_PROVIDER` 的依赖。
- 保留文生图对 `AI_PROVIDER` / `IMAGE_GENERATION_PROVIDER` 的分流行为与校验。
- 仅在需要文生图 `openai` 时校验 `OPENAI_API_KEY`。
- 仅在需要文生图 `gemini` / `gemini_http` 时校验对应 `GEMINI_*`。

**Step 2: Run test to verify it passes**

Run: `npm run test -- server/__tests__/ai-provider.test.ts`
Expected: PASS

**Step 3: Run focused regression tests**

Run: `npm run test -- server/__tests__/openai-image-to-prompt.test.ts server/__tests__/prompt-merge.test.ts`
Expected: PASS

**Step 4: Commit implementation**

```bash
git add server/services/ai-provider.ts
git commit -m "feat: fix text capabilities to suxi models"
```

### Task 3: 更新环境变量模板与 README 文档

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

**Step 1: Write docs/config changes**

`.env.example` 增加：

```bash
# suxi 文本能力（图生文 + prompt 优化）
SUXI_BASE_URL="https://new.suxi.ai/v1"
SUXI_API_KEY=""
SUXI_VISION_MODEL="gpt-4o-mini"
SUXI_TEXT_MODEL="deepseek-v3"
```

并标注：
- `IMAGE_TO_PROMPT_PROVIDER`、`PROMPT_MERGE_PROVIDER` 不再使用（可删除）。
- `IMAGE_GENERATION_PROVIDER` 继续用于文生图。

`README.md` 新增“Provider 行为说明”段落：

```md
- 图生文（`/api/image-to-prompt`）固定使用 suxi：`gpt-4o-mini`
- Prompt 优化固定使用 suxi：`deepseek-v3`
- 文生图继续使用 `IMAGE_GENERATION_PROVIDER`（gemini/openai/gemini_http）
```

**Step 2: Validate docs are coherent**

Run: `rg -n "IMAGE_TO_PROMPT_PROVIDER|PROMPT_MERGE_PROVIDER|SUXI_" .env.example README.md`
Expected: 仅保留最新行为描述，无互相矛盾文案

**Step 3: Commit docs**

```bash
git add .env.example README.md
git commit -m "docs: document suxi text-chain configuration"
```

### Task 4: 全量验证与交付检查

**Files:**
- Verify: `server/services/ai-provider.ts`
- Verify: `server/__tests__/ai-provider.test.ts`
- Verify: `.env.example`
- Verify: `README.md`

**Step 1: Run project verification commands**

Run: `npm run lint`
Expected: PASS

Run: `npm run test -- server/__tests__/ai-provider.test.ts server/__tests__/openai-image-to-prompt.test.ts server/__tests__/prompt-merge.test.ts`
Expected: PASS

Run: `npm run build`
Expected: PASS

**Step 2: Manual smoke checklist**

- 启动 API：`npm run dev:api`
- 上传参考图到 `/api/image-to-prompt`，确认返回文本。
- 启用场景辅助生成，确认批次记录里的 `prompt` 为优化后文本。
- 文生图请求继续正常返回图片。

**Step 3: Final commit (if needed)**

若验证阶段仅有微调改动：

```bash
git add <adjusted-files>
git commit -m "chore: finalize suxi text-provider replacement"
```

**Step 4: Prepare merge summary**

输出应包含：
- 实际生效的 suxi 地址与模型名。
- 受影响文件列表。
- 测试命令与结果摘要。
- 未覆盖风险（如真实 suxi 凭据仅能在部署环境验证）。
