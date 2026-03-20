# 场景标签 Prompt 对齐优化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让每个二级场景标签输出的最终 prompt 更贴合其影视用途与视觉语言，同时保持用户主体、动作和叙事核心不被覆盖。

**Architecture:** 保持现有 `scene-assisted-prompt -> prompt-merge -> generate-images` 链路不变，重点改造两层：一是重写 `server/prompts/*/*.md` 里的 15 个二级场景预设，建立统一结构与标签边界；二是重写 prompt merge 指令与 provider 输入文本，修复乱码并明确“用户主体优先、场景语境增强”的合并优先级。

**Tech Stack:** TypeScript、Node.js、Vitest、Vite、Express

---

### Task 1: 固化 merge 文本质量的失败用例

**Files:**
- Modify: `server/__tests__/prompt-merge.test.ts`
- Modify: `server/__tests__/scene-assisted-prompt.test.ts`

**Step 1: Write the failing test**

```ts
it('preserves readable chinese scene merge content without garbled text', async () => {
  const mergeByModel = vi.fn(async () => 'merged prompt');
  const mergePrompt = createPromptMergeService({ mergeByModel });

  await mergePrompt({
    presetPrompt: '核心用途：院线电影主海报',
    userPrompt: '一个女人站在雨夜街头',
    primarySceneId: 'poster',
    subSceneId: 'movie_poster',
  });

  expect(mergeByModel).toHaveBeenCalledWith(
    expect.objectContaining({
      presetPrompt: expect.stringContaining('核心用途'),
      userPrompt: '一个女人站在雨夜街头',
    }),
  );
});
```

```ts
it('passes scene prompt text and user prompt as readable chinese content to merge layer', async () => {
  const loadScenePrompt = vi.fn(async () => ({
    presetPrompt: '核心用途：宣发短视频封面图',
    sourcePath: 'server/prompts/short_video/cover.md',
  }));
  const mergePrompt = vi.fn(async () => 'merged prompt');
  const service = createSceneAssistedPromptService({ loadScenePrompt, mergePrompt });

  await service({
    prompt: '一个人冲出火场',
    enableSceneAssist: true,
    primarySceneId: 'short_video',
    subSceneId: 'cover',
  });

  expect(mergePrompt).toHaveBeenCalledWith(
    expect.objectContaining({
      presetPrompt: expect.stringContaining('宣发短视频封面图'),
      userPrompt: '一个人冲出火场',
    }),
  );
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/prompt-merge.test.ts server/__tests__/scene-assisted-prompt.test.ts`

Expected: 至少一条断言无法覆盖当前乱码或当前 merge 输入结构不够明确，需要修改实现或测试基线。

**Step 3: Write minimal implementation**

- 在测试中把“可读中文场景内容”和“用户输入保留”固定为行为契约。
- 如果现有测试不足以直接暴露问题，补充对 provider 输入内容的断言。

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/prompt-merge.test.ts server/__tests__/scene-assisted-prompt.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add server/__tests__/prompt-merge.test.ts server/__tests__/scene-assisted-prompt.test.ts
git commit -m "test: lock scene prompt merge text expectations"
```

### Task 2: 重写 merge instruction 并修复 provider 输入乱码

**Files:**
- Modify: `server/services/prompt-merge-instruction.ts`
- Modify: `server/services/openai-prompt-merge.ts`
- Modify: `server/services/gemini-prompt-merge.ts`
- Test: `server/__tests__/prompt-merge.test.ts`

**Step 1: Write the failing test**

```ts
it('builds readable structured merge content for provider', async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
    choices: [{ message: { content: 'final merged prompt' } }],
  }), { status: 200 }));
  const merge = createOpenAIPromptMerge({
    apiKey: 'k',
    baseUrl: 'https://example.com',
    model: 'gpt-test',
    fetchImpl,
  });

  await merge({
    presetPrompt: '核心用途：院线电影主海报',
    userPrompt: '雨夜中的女主角',
    primarySceneId: 'poster',
    subSceneId: 'movie_poster',
  });

  const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
  expect(body.messages[0].content).toContain('用户主体');
  expect(body.messages[1].content).toContain('场景: poster/movie_poster');
  expect(body.messages[1].content).toContain('场景预设');
  expect(body.messages[1].content).toContain('用户输入');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/prompt-merge.test.ts`

Expected: FAIL，当前 instruction 或 buildUserContent 中的乱码/结构不符合断言。

**Step 3: Write minimal implementation**

```ts
export const PROMPT_MERGE_INSTRUCTION = [
  '你是资深影视图像提示词工程师。',
  '任务：把“场景预设”和“用户输入”合并成一个最终提示词。',
  '优先级：先保留用户明确写出的主体、动作、关系、时代、地点和叙事意图。',
  '场景标签负责补充影视用途语义、构图、镜头、光影、色彩和传播约束。',
  '如果两者冲突，保留用户事实内容，但按场景标签重写表现方式。',
  '输出一段最终提示词，不要解释，不要 markdown，不要分点。',
].join(' ');
```

```ts
function buildUserContent(input: PromptMergeInput): string {
  const sceneLabel = input.primarySceneId && input.subSceneId
    ? `场景: ${input.primarySceneId}/${input.subSceneId}\n`
    : '';

  return [
    sceneLabel,
    '场景预设:',
    input.presetPrompt,
    '',
    '用户输入:',
    input.userPrompt,
  ].join('\n');
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/prompt-merge.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add server/services/prompt-merge-instruction.ts server/services/openai-prompt-merge.ts server/services/gemini-prompt-merge.ts server/__tests__/prompt-merge.test.ts
git commit -m "fix: clarify scene prompt merge rules"
```

### Task 3: 为场景预设建立结构约束测试

**Files:**
- Create: `server/__tests__/scene-prompts-structure.test.ts`
- Test: `server/prompts/**/*.md`

**Step 1: Write the failing test**

```ts
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_KEYS = [
  '核心用途：',
  '主体优先级：',
  '画面组织：',
  '镜头与光影：',
  '传播/版式约束：',
  '禁止偏移：',
];

it('ensures all scene prompt files follow the unified structure', async () => {
  const root = path.resolve('server/prompts');
  const groups = await readdir(root, { withFileTypes: true });

  for (const group of groups.filter((entry) => entry.isDirectory())) {
    const groupDir = path.join(root, group.name);
    const files = await readdir(groupDir);
    for (const file of files.filter((name) => name.endsWith('.md'))) {
      const content = await readFile(path.join(groupDir, file), 'utf8');
      for (const key of REQUIRED_KEYS) {
        expect(content).toContain(key);
      }
    }
  }
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/scene-prompts-structure.test.ts`

Expected: FAIL，现有 prompt 文件尚未使用统一结构。

**Step 3: Write minimal implementation**

- 新增结构校验测试文件。
- 先不要放宽断言，保持结构字段完整，促使后续 15 个文件统一重写。

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/scene-prompts-structure.test.ts`

Expected: 目前仍 FAIL，直到后续任务完成所有 prompt 文件重写。

**Step 5: Commit**

```bash
git add server/__tests__/scene-prompts-structure.test.ts
git commit -m "test: require unified scene prompt structure"
```

### Task 4: 重写影视海报创作场景预设

**Files:**
- Modify: `server/prompts/poster/movie_poster.md`
- Modify: `server/prompts/poster/web_drama.md`
- Modify: `server/prompts/poster/variety_show.md`
- Test: `server/__tests__/scene-prompts-structure.test.ts`

**Step 1: Write the failing test**

Run the existing structure test from Task 3 and treat these three文件为当前待修复范围。

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/scene-prompts-structure.test.ts`

Expected: FAIL，至少 `poster` 目录下文件缺少新结构字段。

**Step 3: Write minimal implementation**

按下列模板重写每个文件：

```md
核心用途：院线电影主海报，强调单张主视觉、电影级叙事张力与版式留白。
主体优先级：保留用户指定的主角、群像关系、关键动作和冲突对象，不改写叙事焦点。
画面组织：主体突出，适合中心构图或黄金分割，保留标题区与视觉留白，层次清晰。
镜头与光影：强调电影灯光、戏剧化对比、统一色调和高完成度质感。
传播/版式约束：适合院线海报排版，避免缩略图式堆信息，强调主视觉识别。
禁止偏移：不要写成短视频封面、角色关系图或普通人物写真。
```

为 `web_drama` 和 `variety_show` 分别写出不同的传播目的和视觉边界，避免三者同质化。

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/scene-prompts-structure.test.ts`

Expected: `poster` 相关字段满足结构要求，但全量测试可能仍因其他目录未重写而 FAIL。

**Step 5: Commit**

```bash
git add server/prompts/poster/*.md
git commit -m "docs: refine poster scene prompts"
```

### Task 5: 重写 IP 角色可视化场景预设

**Files:**
- Modify: `server/prompts/ip/fan_art.md`
- Modify: `server/prompts/ip/novel_ip.md`
- Modify: `server/prompts/ip/anime_to_real.md`
- Test: `server/__tests__/scene-prompts-structure.test.ts`

**Step 1: Write the failing test**

继续运行结构测试，确认 `ip` 目录尚未满足统一结构。

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/scene-prompts-structure.test.ts`

Expected: FAIL，`ip` 目录字段不完整。

**Step 3: Write minimal implementation**

为每个文件补足以下差异：

- `fan_art`
  - 强调角色辨识特征、二创构图与非官方复刻。
- `novel_ip`
  - 强调文本设定落地、世界观线索与设定自洽。
- `anime_to_real`
  - 强调保留二次元标识并转为真实人像质感。

所有文件均需包含 6 个统一字段。

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/scene-prompts-structure.test.ts`

Expected: `ip` 文件结构满足要求，但全量测试可能仍因其他目录未完成而 FAIL。

**Step 5: Commit**

```bash
git add server/prompts/ip/*.md
git commit -m "docs: refine ip scene prompts"
```

### Task 6: 重写影视场景概念设计场景预设

**Files:**
- Modify: `server/prompts/scene/scifi.md`
- Modify: `server/prompts/scene/historical.md`
- Modify: `server/prompts/scene/modern.md`
- Test: `server/__tests__/scene-prompts-structure.test.ts`

**Step 1: Write the failing test**

继续运行结构测试，确认 `scene` 目录尚未满足统一结构。

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/scene-prompts-structure.test.ts`

Expected: FAIL，`scene` 目录字段不完整。

**Step 3: Write minimal implementation**

为每个文件补足以下差异：

- `scifi`
  - 强调世界观规模、异世界逻辑、空间纵深。
- `historical`
  - 强调考据、建筑形制、材质与生活痕迹。
- `modern`
  - 强调真实生活感、自然光影和日常情绪。

所有文件均需包含 6 个统一字段。

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/scene-prompts-structure.test.ts`

Expected: `scene` 文件结构满足要求，但全量测试可能仍因其他目录未完成而 FAIL。

**Step 5: Commit**

```bash
git add server/prompts/scene/*.md
git commit -m "docs: refine scene concept prompts"
```

### Task 7: 重写影视宣发短视频配图场景预设

**Files:**
- Modify: `server/prompts/short_video/storyboard.md`
- Modify: `server/prompts/short_video/relationship.md`
- Modify: `server/prompts/short_video/cover.md`
- Test: `server/__tests__/scene-prompts-structure.test.ts`

**Step 1: Write the failing test**

继续运行结构测试，确认 `short_video` 目录尚未满足统一结构。

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/scene-prompts-structure.test.ts`

Expected: FAIL，`short_video` 目录字段不完整。

**Step 3: Write minimal implementation**

为每个文件补足以下差异：

- `storyboard`
  - 强调剧情爆点、镜头帧感、动作瞬间。
- `relationship`
  - 强调关系表达、角色布局、信息分区。
- `cover`
  - 强调缩略图抓眼、信息聚焦、点击感。

所有文件均需包含 6 个统一字段。

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/scene-prompts-structure.test.ts`

Expected: `short_video` 文件结构满足要求，但全量测试可能仍因其他目录未完成而 FAIL。

**Step 5: Commit**

```bash
git add server/prompts/short_video/*.md
git commit -m "docs: refine short video scene prompts"
```

### Task 8: 重写影视衍生品素材场景预设

**Files:**
- Modify: `server/prompts/merch/emoji.md`
- Modify: `server/prompts/merch/product.md`
- Modify: `server/prompts/merch/offline.md`
- Test: `server/__tests__/scene-prompts-structure.test.ts`

**Step 1: Write the failing test**

继续运行结构测试，确认 `merch` 目录尚未满足统一结构。

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/scene-prompts-structure.test.ts`

Expected: FAIL，`merch` 目录字段不完整。

**Step 3: Write minimal implementation**

为每个文件补足以下差异：

- `emoji`
  - 强调 Q 版比例、夸张表情、情绪传播性。
- `product`
  - 强调图案化、可印刷、轮廓和重复使用稳定性。
- `offline`
  - 强调沉浸式打卡、空间装置感、拍照传播属性。

所有文件均需包含 6 个统一字段。

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/scene-prompts-structure.test.ts`

Expected: PASS，所有 prompt 文件满足统一结构。

**Step 5: Commit**

```bash
git add server/prompts/merch/*.md
git commit -m "docs: refine merch scene prompts"
```

### Task 9: 为相邻标签差异补充行为测试

**Files:**
- Modify: `server/__tests__/prompt-merge.test.ts`
- Possibly Modify: `server/services/prompt-merge.ts`

**Step 1: Write the failing test**

```ts
it('keeps user subject while letting scene label change visual intent', async () => {
  const mergeByModel = vi.fn(async (input) => {
    return `${input.userPrompt} | ${input.presetPrompt}`;
  });
  const mergePrompt = createPromptMergeService({ mergeByModel });

  const poster = await mergePrompt({
    presetPrompt: '核心用途：院线电影主海报\n传播/版式约束：海报标题区留白',
    userPrompt: '一个女人站在雨夜街头',
    primarySceneId: 'poster',
    subSceneId: 'movie_poster',
  });

  const cover = await mergePrompt({
    presetPrompt: '核心用途：宣发短视频封面图\n传播/版式约束：缩略图抓眼',
    userPrompt: '一个女人站在雨夜街头',
    primarySceneId: 'short_video',
    subSceneId: 'cover',
  });

  expect(poster).not.toBe(cover);
  expect(poster).toContain('一个女人站在雨夜街头');
  expect(cover).toContain('一个女人站在雨夜街头');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/prompt-merge.test.ts`

Expected: FAIL 或断言价值不足，需要补足 merge 服务契约。

**Step 3: Write minimal implementation**

- 如果 `createPromptMergeService` 只是透传 provider，可在测试中明确 provider 接收的上下文责任。
- 确保测试表达的是“保留主体 + 区分场景用途”，而非强绑具体模型输出。

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/prompt-merge.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add server/__tests__/prompt-merge.test.ts server/services/prompt-merge.ts
git commit -m "test: cover scene label differentiation rules"
```

### Task 10: 全量验证与手动抽样

**Files:**
- Review: `server/prompts/**/*.md`
- Review: `server/services/prompt-merge-instruction.ts`
- Review: `server/services/openai-prompt-merge.ts`
- Review: `server/services/gemini-prompt-merge.ts`

**Step 1: Write the failing test**

不新增代码，整理验证清单。

**Step 2: Run test to verify current status**

Run: `npm run test -- server/__tests__/prompt-merge.test.ts server/__tests__/scene-assisted-prompt.test.ts server/__tests__/scene-prompts-structure.test.ts`

Expected: PASS

Run: `npm run lint`

Expected: PASS

Run: `npm run build`

Expected: PASS

**Step 3: Write minimal implementation**

不需要新实现；如果验证失败，回到对应任务修复。

**Step 4: Run manual verification**

手动用同一条用户 prompt 抽样对比以下标签的最终 `batch.prompt`：

- `poster/movie_poster` vs `short_video/cover`
- `short_video/storyboard` vs `short_video/relationship`
- `scene/historical` vs `scene/scifi`

Expected:

- 用户主体一致保留
- 用途语义明显不同
- 构图、镜头、传播语境明显不同

**Step 5: Commit**

```bash
git add server/prompts server/services server/__tests__
git commit -m "feat: align scene prompts with scene labels"
```
