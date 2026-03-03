# Scene Assisted Prompt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在图片生成流程中新增“场景辅助优化提示词”能力：支持二级场景预制 prompt 文件、用户开关控制、冲突消解与合并优化、失败与降级策略。

**Architecture:** 采用单接口后端编排。前端在 `/api/generate-images` 传入开关与场景 ID；后端在进入现有生成用例前，先计算 `effectivePrompt`。当开关开启时读取 `server/prompts/<primary>/<sub>.md` 并调用独立 provider（`PROMPT_MERGE_PROVIDER`）执行合并优化；若优化失败则直接报错终止生成，若场景文件缺失则降级为用户 prompt 并记录告警。

**Tech Stack:** TypeScript, React 19, Express 4, Vitest 4, Supertest, Node fs/path, 现有 Gemini/OpenAI provider 抽象。

---

### Task 1: 扩展生成请求校验（场景开关与场景 ID）

**Files:**
- Modify: `server/__tests__/generate-request.validation.test.ts`
- Modify: `server/validation/generate-request.ts`
- Modify: `server/types.ts`

**Step 1: Write the failing test**

```ts
it('requires primary/sub scene ids when scene assist is enabled', () => {
  expect(
    validateGenerateRequest({
      prompt: 'x',
      aspectRatio: '16:9',
      count: 1,
      enableSceneAssist: true,
    }),
  ).toBe('primarySceneId and subSceneId are required when scene assist is enabled');
});

it('allows missing scene ids when scene assist is disabled', () => {
  expect(
    validateGenerateRequest({
      prompt: 'x',
      aspectRatio: '16:9',
      count: 1,
      enableSceneAssist: false,
    }),
  ).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/generate-request.validation.test.ts`  
Expected: FAIL（缺少 `enableSceneAssist` 与场景字段校验）

**Step 3: Write minimal implementation**

```ts
// server/types.ts
export type GenerateImagesInput = {
  prompt: string;
  aspectRatio: AspectRatio;
  count: 1 | 2 | 3 | 4;
  enableSceneAssist: boolean;
  primarySceneId?: string;
  subSceneId?: string;
};
```

```ts
// server/validation/generate-request.ts (核心逻辑)
const enableSceneAssist = input.enableSceneAssist;
if (typeof enableSceneAssist !== 'boolean') {
  return 'enableSceneAssist must be boolean';
}
if (enableSceneAssist) {
  const primarySceneId = typeof input.primarySceneId === 'string' ? input.primarySceneId.trim() : '';
  const subSceneId = typeof input.subSceneId === 'string' ? input.subSceneId.trim() : '';
  if (!primarySceneId || !subSceneId) {
    return 'primarySceneId and subSceneId are required when scene assist is enabled';
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/generate-request.validation.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/types.ts server/validation/generate-request.ts server/__tests__/generate-request.validation.test.ts
git commit -m "feat: add scene assist request validation"
```

### Task 2: 新增场景预设加载器（按文件读取）

**Files:**
- Create: `server/services/scene-prompt-loader.ts`
- Create: `server/__tests__/scene-prompt-loader.test.ts`

**Step 1: Write the failing test**

```ts
it('returns null when scene prompt file is missing', async () => {
  const load = createScenePromptLoader({ baseDir: 'server/prompts' });
  const output = await load({ primarySceneId: 'poster', subSceneId: 'not-exists' });
  expect(output.presetPrompt).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/scene-prompt-loader.test.ts`  
Expected: FAIL（模块不存在）

**Step 3: Write minimal implementation**

```ts
export function createScenePromptLoader(input: { baseDir: string }) {
  return async ({ primarySceneId, subSceneId }: { primarySceneId: string; subSceneId: string }) => {
    const sourcePath = path.resolve(input.baseDir, primarySceneId, `${subSceneId}.md`);
    try {
      const content = (await fs.readFile(sourcePath, 'utf8')).trim();
      return { presetPrompt: content || null, sourcePath };
    } catch {
      return { presetPrompt: null, sourcePath };
    }
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/scene-prompt-loader.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/scene-prompt-loader.ts server/__tests__/scene-prompt-loader.test.ts
git commit -m "feat: add scene prompt file loader"
```

### Task 3: 新增提示词冲突消解与合并服务

**Files:**
- Create: `server/services/prompt-merge.ts`
- Create: `server/services/prompt-merge-instruction.ts`
- Create: `server/__tests__/prompt-merge.test.ts`

**Step 1: Write the failing test**

```ts
it('merges preset and user prompt via provider and returns plain text', async () => {
  const mergeByModel = vi.fn(async () => '最终提示词');
  const merge = createPromptMergeService({ mergeByModel });
  const result = await merge({
    presetPrompt: '预设内容',
    userPrompt: '用户输入',
    primarySceneId: 'poster',
    subSceneId: 'movie_poster',
  });
  expect(result).toBe('最终提示词');
  expect(mergeByModel).toHaveBeenCalledTimes(1);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/prompt-merge.test.ts`  
Expected: FAIL（模块不存在）

**Step 3: Write minimal implementation**

```ts
export function createPromptMergeService(input: {
  mergeByModel: (x: { presetPrompt: string; userPrompt: string; primarySceneId?: string; subSceneId?: string }) => Promise<string>;
}) {
  return async (args: { presetPrompt: string; userPrompt: string; primarySceneId?: string; subSceneId?: string }) => {
    const merged = await input.mergeByModel(args);
    return merged.replaceAll('```', '').trim();
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/prompt-merge.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/prompt-merge.ts server/services/prompt-merge-instruction.ts server/__tests__/prompt-merge.test.ts
git commit -m "feat: add prompt merge service for scene assist"
```

### Task 4: 扩展 AI Provider（新增 `PROMPT_MERGE_PROVIDER`）

**Files:**
- Modify: `server/services/ai-provider.ts`
- Modify: `server/__tests__/ai-provider.test.ts`

**Step 1: Write the failing test**

```ts
it('supports PROMPT_MERGE_PROVIDER=openai while keeping generation provider unchanged', () => {
  const mergePrompt = vi.fn(async () => 'merged');
  const createOpenAITextMerge = vi.fn(() => mergePrompt);
  const output = createAiServicesFromEnv(
    {
      AI_PROVIDER: 'gemini',
      IMAGE_GENERATION_PROVIDER: 'gemini',
      PROMPT_MERGE_PROVIDER: 'openai',
      GEMINI_API_KEY: 'g-key',
      OPENAI_API_KEY: 'o-key',
    },
    {
      createOpenAIPromptMerge: createOpenAITextMerge as any,
    } as any,
  );
  expect(output.mergeProvider).toBe('openai');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/ai-provider.test.ts`  
Expected: FAIL（无 `mergeProvider` / `createOpenAIPromptMerge`）

**Step 3: Write minimal implementation**

```ts
export type AiServices = {
  analyzeProvider: ProviderName;
  generateProvider: ProviderName;
  mergeProvider: Exclude<ProviderName, 'gemini_http'>;
  analyzeImage: AnalyzeImageFn;
  generateFromModel: GenerateFromModelFn;
  mergePrompt: (input: { presetPrompt: string; userPrompt: string; primarySceneId?: string; subSceneId?: string }) => Promise<string>;
};
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/ai-provider.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/ai-provider.ts server/__tests__/ai-provider.test.ts
git commit -m "feat: add independent prompt merge provider"
```

### Task 5: 集成场景辅助编排到生成链路

**Files:**
- Create: `server/services/scene-assisted-prompt.ts`
- Create: `server/__tests__/scene-assisted-prompt.test.ts`
- Modify: `server/index.ts`
- Modify: `server/__tests__/generate-images.route.test.ts`

**Step 1: Write the failing test**

```ts
it('throws when merge fails and scene assist is enabled', async () => {
  const resolvePrompt = createSceneAssistedPromptService({
    loadScenePrompt: async () => ({ presetPrompt: 'preset', sourcePath: 'x' }),
    mergePrompt: async () => {
      throw new Error('quota exceeded');
    },
    logger: { warn: vi.fn() },
  });
  await expect(
    resolvePrompt({
      prompt: 'user prompt',
      enableSceneAssist: true,
      primarySceneId: 'poster',
      subSceneId: 'movie_poster',
    }),
  ).rejects.toThrow('prompt merge failed: quota exceeded');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/scene-assisted-prompt.test.ts`  
Expected: FAIL（模块不存在）

**Step 3: Write minimal implementation**

```ts
export function createSceneAssistedPromptService(deps: {
  loadScenePrompt: (x: { primarySceneId: string; subSceneId: string }) => Promise<{ presetPrompt: string | null; sourcePath: string }>;
  mergePrompt: (x: { presetPrompt: string; userPrompt: string; primarySceneId?: string; subSceneId?: string }) => Promise<string>;
  logger?: { warn: (...args: unknown[]) => void };
}) {
  return async (input: {
    prompt: string;
    enableSceneAssist: boolean;
    primarySceneId?: string;
    subSceneId?: string;
  }) => {
    const userPrompt = input.prompt.trim();
    if (!input.enableSceneAssist) return userPrompt;
    const loaded = await deps.loadScenePrompt({
      primarySceneId: input.primarySceneId!,
      subSceneId: input.subSceneId!,
    });
    if (!loaded.presetPrompt) {
      deps.logger?.warn?.(`scene prompt missing: ${loaded.sourcePath}`);
      return userPrompt;
    }
    try {
      return await deps.mergePrompt({
        presetPrompt: loaded.presetPrompt,
        userPrompt,
        primarySceneId: input.primarySceneId,
        subSceneId: input.subSceneId,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      throw new Error(`prompt merge failed: ${reason}`);
    }
  };
}
```

`server/index.ts` 将 `generateImages` 包装为：
- 先调用 `resolveEffectivePrompt`；
- 再把 `prompt` 替换为优化结果后调用 `createGenerateImagesUseCase` 返回的函数。

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/scene-assisted-prompt.test.ts server/__tests__/generate-images.route.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/scene-assisted-prompt.ts server/__tests__/scene-assisted-prompt.test.ts server/index.ts server/__tests__/generate-images.route.test.ts
git commit -m "feat: integrate scene-assisted prompt orchestration"
```

### Task 6: 前端开关与请求字段接入

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/services/generate-images.ts`
- Modify: `src/services/generate-images.test.ts`

**Step 1: Write the failing test**

```ts
it('sends scene assist payload to backend', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ batch: { id: 'b', prompt: 'x', aspectRatio: '16:9', requestedCount: 1, model: 'm', status: 'completed', createdAt: 1, items: [] } }),
  }) as any;

  await generateImages({
    prompt: 'x',
    aspectRatio: '16:9',
    count: 1,
    enableSceneAssist: true,
    primarySceneId: 'poster',
    subSceneId: 'movie_poster',
  });

  expect(global.fetch).toHaveBeenCalledWith(
    '/api/generate-images',
    expect.objectContaining({
      body: expect.stringContaining('"enableSceneAssist":true'),
    }),
  );
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/services/generate-images.test.ts`  
Expected: FAIL（类型与请求体未包含新字段）

**Step 3: Write minimal implementation**

```ts
// src/services/generate-images.ts
export type GenerateImagesRequest = {
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  count: 1 | 2 | 3 | 4;
  enableSceneAssist: boolean;
  primarySceneId?: string;
  subSceneId?: string;
};
```

`src/App.tsx`：
- 新增状态 `const [enableSceneAssist, setEnableSceneAssist] = useState(true);`
- 在左侧参数区新增开关 UI（“场景辅助优化提示词”）
- 在 `runGeneration()` 调用 `generateImages()` 时传入：
  - `enableSceneAssist`
  - `primarySceneId: scene`
  - `subSceneId: subScene`

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/services/generate-images.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/App.tsx src/services/generate-images.ts src/services/generate-images.test.ts
git commit -m "feat: add scene assist toggle and payload wiring"
```

### Task 7: 新增场景预设 prompt 文件并完成全量验证

**Files:**
- Create: `server/prompts/poster/movie_poster.md`
- Create: `server/prompts/poster/web_drama.md`
- Create: `server/prompts/poster/variety_show.md`
- Create: `server/prompts/ip/fan_art.md`
- Create: `server/prompts/ip/novel_ip.md`
- Create: `server/prompts/ip/anime_to_real.md`
- Create: `server/prompts/scene/scifi.md`
- Create: `server/prompts/scene/historical.md`
- Create: `server/prompts/scene/modern.md`
- Create: `server/prompts/short_video/storyboard.md`
- Create: `server/prompts/short_video/relationship.md`
- Create: `server/prompts/short_video/cover.md`
- Create: `server/prompts/merch/emoji.md`
- Create: `server/prompts/merch/product.md`
- Create: `server/prompts/merch/offline.md`

**Step 1: Write the failing test**

```ts
it('loads built-in movie poster prompt file', async () => {
  const load = createScenePromptLoader({ baseDir: 'server/prompts' });
  const output = await load({ primarySceneId: 'poster', subSceneId: 'movie_poster' });
  expect(output.presetPrompt).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/scene-prompt-loader.test.ts`  
Expected: FAIL（目标文件尚不存在）

**Step 3: Write minimal implementation**

为 15 个二级场景分别写入中文预制 prompt（纯文本、可直接人工维护），要求：
- 内容聚焦场景目标和视觉约束。
- 不写模板变量。
- 每个文件 6-12 行，避免过长。

**Step 4: Run tests/build/lint to verify**

Run: `npm run test`  
Expected: PASS  

Run: `npm run lint`  
Expected: PASS（无 TS 错误）  

Run: `npm run build`  
Expected: PASS（产物输出到 `dist/`）

**Step 5: Commit**

```bash
git add server/prompts
git commit -m "feat: add scene preset prompt files for all sub scenes"
```

## 执行顺序与质量约束

- 执行顺序必须按 Task 1 -> Task 7。
- 每个 Task 遵循 TDD 小循环（先失败测试，再最小实现，再回归）。
- 每个 Task 独立提交，避免大提交难回滚。
- 执行时必须使用：
  - `@superpowers:test-driven-development`
  - `@superpowers:verification-before-completion`

## 风险与回滚点

- 风险 1：provider 配置错误导致启动失败。  
  回滚点：Task 4 独立提交，可单独回退。
- 风险 2：App.tsx 体积较大导致冲突。  
  回滚点：Task 6 独立提交，必要时只回退前端变更。
- 风险 3：预设 prompt 文案质量不稳定。  
  回滚点：Task 7 纯文案文件，可快速热修。
