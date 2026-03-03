# Reference Image To Prompt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在生成界面上传参考图后，自动通过后端代理调用 Gemini `gemini-3-flash-preview`，返回详细英文提示词并覆盖前端提示词输入框。

**Architecture:** 前端仅负责上传与状态展示，调用同域 API `/api/image-to-prompt`。后端新增 Express 接口接收 `multipart/form-data` 图片，做文件校验后调用 `@google/genai`，返回纯文本提示词。通过依赖注入让路由可测试，保证失败场景不污染前端已有提示词。

**Tech Stack:** React 19 + TypeScript + Vite 6, Express 4, @google/genai, multer, Vitest, Supertest, tsx

---

### Task 1: 搭建后端可测试路由骨架

**Files:**
- Create: `server/app.ts`
- Create: `server/types.ts`
- Create: `server/__tests__/image-to-prompt.route.test.ts`
- Modify: `package.json`

**Step 1: Write the failing test**

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';

describe('POST /api/image-to-prompt', () => {
  it('returns 400 when file is missing', async () => {
    const app = createApp(async () => 'unused');
    const res = await request(app).post('/api/image-to-prompt');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('file');
  });

  it('returns prompt on success', async () => {
    const app = createApp(async () => 'detailed english prompt');
    const res = await request(app)
      .post('/api/image-to-prompt')
      .attach('file', Buffer.from([1, 2, 3]), {
        filename: 'a.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      prompt: 'detailed english prompt',
      model: 'gemini-3-flash-preview',
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/image-to-prompt.route.test.ts`  
Expected: FAIL（`createApp` 或路由不存在）

**Step 3: Write minimal implementation**

```ts
// server/app.ts
import express from 'express';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
export function createApp(analyzeImage: (args: {
  mimeType: string;
  dataBase64: string;
}) => Promise<string>) {
  const app = express();
  app.post('/api/image-to-prompt', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const prompt = await analyzeImage({
      mimeType: req.file.mimetype,
      dataBase64: req.file.buffer.toString('base64'),
    });
    return res.status(200).json({ prompt, model: 'gemini-3-flash-preview' });
  });
  return app;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/image-to-prompt.route.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add package.json package-lock.json server/types.ts server/app.ts server/__tests__/image-to-prompt.route.test.ts
git commit -m "test: add backend route skeleton for image prompt api"
```

---

### Task 2: 增加文件格式与大小校验

**Files:**
- Create: `server/validation/image-file.ts`
- Modify: `server/app.ts`
- Modify: `server/__tests__/image-to-prompt.route.test.ts`

**Step 1: Write the failing test**

```ts
it('returns 415 for unsupported mime type', async () => {
  const app = createApp(async () => 'unused');
  const res = await request(app)
    .post('/api/image-to-prompt')
    .attach('file', Buffer.from('hello'), {
      filename: 'a.txt',
      contentType: 'text/plain',
    });
  expect(res.status).toBe(415);
});

it('returns 413 when file too large', async () => {
  const app = createApp(async () => 'unused');
  const big = Buffer.alloc(10 * 1024 * 1024 + 1, 1);
  const res = await request(app)
    .post('/api/image-to-prompt')
    .attach('file', big, { filename: 'big.png', contentType: 'image/png' });
  expect(res.status).toBe(413);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/image-to-prompt.route.test.ts`  
Expected: FAIL（返回码未按 415/413）

**Step 3: Write minimal implementation**

```ts
// server/validation/image-file.ts
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;

export function validateImageFile(file: Express.Multer.File): string | null {
  if (!ALLOWED.has(file.mimetype)) return 'unsupported file type';
  if (file.size > MAX_BYTES) return 'file too large';
  return null;
}
```

```ts
// server/app.ts (route fragment)
const validationError = validateImageFile(req.file);
if (validationError === 'unsupported file type') {
  return res.status(415).json({ error: validationError });
}
if (validationError === 'file too large') {
  return res.status(413).json({ error: validationError });
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/image-to-prompt.route.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/validation/image-file.ts server/app.ts server/__tests__/image-to-prompt.route.test.ts
git commit -m "feat: validate uploaded image type and size"
```

---

### Task 3: 实现 Gemini 调用服务（详细英文提示词）

**Files:**
- Create: `server/services/gemini-image-to-prompt.ts`
- Create: `server/services/prompt-instruction.ts`
- Create: `server/__tests__/gemini-image-to-prompt.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createGeminiImageToPrompt } from '../services/gemini-image-to-prompt';

describe('createGeminiImageToPrompt', () => {
  it('returns plain text prompt without markdown fences', async () => {
    const fakeClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: '```\\ncinematic detailed prompt\\n```',
        }),
      },
    };
    const analyze = createGeminiImageToPrompt(fakeClient as any);
    const out = await analyze({ mimeType: 'image/png', dataBase64: 'AQID' });
    expect(out).toBe('cinematic detailed prompt');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/gemini-image-to-prompt.test.ts`  
Expected: FAIL（函数未实现）

**Step 3: Write minimal implementation**

```ts
// server/services/gemini-image-to-prompt.ts
import { PROMPT_INSTRUCTION } from './prompt-instruction';

export function createGeminiImageToPrompt(client: any) {
  return async ({ mimeType, dataBase64 }: { mimeType: string; dataBase64: string }) => {
    const res = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { text: PROMPT_INSTRUCTION },
        { inlineData: { mimeType, data: dataBase64 } },
      ],
    });
    return String(res.text ?? '')
      .replace(/```/g, '')
      .trim();
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/gemini-image-to-prompt.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/prompt-instruction.ts server/services/gemini-image-to-prompt.ts server/__tests__/gemini-image-to-prompt.test.ts
git commit -m "feat: add gemini image analysis service for english detailed prompts"
```

---

### Task 4: 组装后端入口与开发代理

**Files:**
- Create: `server/index.ts`
- Modify: `server/app.ts`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `server/__tests__/image-to-prompt.error.test.ts`

**Step 1: Write the failing test**

```ts
it('returns 500 when analyzer throws', async () => {
  const app = createApp(async () => {
    throw new Error('boom');
  });
  const res = await request(app)
    .post('/api/image-to-prompt')
    .attach('file', Buffer.from([1, 2, 3]), {
      filename: 'a.png',
      contentType: 'image/png',
    });
  expect(res.status).toBe(500);
  expect(res.body.error).toContain('failed');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/image-to-prompt.error.test.ts`  
Expected: FAIL（错误处理缺失）

**Step 3: Write minimal implementation**

```ts
// server/index.ts
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { createApp } from './app';
import { createGeminiImageToPrompt } from './services/gemini-image-to-prompt';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const app = createApp(createGeminiImageToPrompt(ai));
app.listen(8787, () => console.log('API listening on :8787'));
```

```ts
// vite.config.ts (fragment)
server: {
  proxy: { '/api': 'http://127.0.0.1:8787' },
  hmr: process.env.DISABLE_HMR !== 'true',
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/image-to-prompt.error.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/index.ts server/app.ts server/__tests__/image-to-prompt.error.test.ts package.json package-lock.json vite.config.ts
git commit -m "feat: wire api server and vite proxy for image prompt endpoint"
```

---

### Task 5: 前端接入自动分析与覆盖提示词

**Files:**
- Create: `src/services/image-to-prompt.ts`
- Modify: `src/App.tsx`
- Create: `src/services/image-to-prompt.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { imageToPrompt } from './image-to-prompt';

describe('imageToPrompt', () => {
  it('throws with backend error message on non-2xx', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'analysis failed' }),
    }) as any;
    await expect(imageToPrompt(new File(['x'], 'x.png'))).rejects.toThrow('analysis failed');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/services/image-to-prompt.test.ts`  
Expected: FAIL（函数未实现）

**Step 3: Write minimal implementation**

```ts
// src/services/image-to-prompt.ts
export async function imageToPrompt(file: File, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/image-to-prompt', { method: 'POST', body: form, signal });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'analysis failed');
  return String(body.prompt || '').trim();
}
```

```ts
// src/App.tsx (handleImageUpload fragment)
// 1) 上传后立刻 setIsAnalyzing(true)
// 2) 调用 imageToPrompt(file, abortController.signal)
// 3) 成功后 setPrompt(newPrompt) 覆盖
// 4) 失败时仅提示错误，不改动现有 prompt
// 5) finally setIsAnalyzing(false)
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/services/image-to-prompt.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/image-to-prompt.ts src/services/image-to-prompt.test.ts src/App.tsx
git commit -m "feat: auto analyze uploaded reference image and overwrite prompt"
```

---

### Task 6: 验证、文档与收尾

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

**Step 1: Write the failing check**

```md
在 README 增加“需要同时启动前端与 API 服务”的说明前，当前文档无法指导完整流程。
```

**Step 2: Run verification commands (expected before fix)**

Run: `npm run lint`  
Expected: 可能失败或无法覆盖新流程说明缺失（记录现状）

**Step 3: Write minimal documentation updates**

```md
- 新增 API 启动命令：`npm run dev:api`
- 新增联调流程：终端 A 运行 `npm run dev:api`，终端 B 运行 `npm run dev`
- 说明 `GEMINI_API_KEY` 仅由后端读取
```

**Step 4: Run full verification**

Run: `npm run test`  
Expected: PASS  

Run: `npm run lint`  
Expected: PASS  

Run: `npm run build`  
Expected: PASS

**Step 5: Commit**

```bash
git add README.md .env.example
git commit -m "docs: document backend proxy workflow for image prompt analysis"
```

---

### 执行约束

- 严格 TDD：每个任务先写失败测试，再最小实现。
- 保持 YAGNI：仅实现单图上传 -> 英文详细提示词覆盖，不提前做多图/模型切换 UI。
- 频繁小提交：每个任务一个 commit，便于回滚。
- 技能引用：`@test-driven-development`、`@verification-before-completion`、`@requesting-code-review`。
