# Nano Banana Pro Image Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在“生成”界面接入 `gemini-3-pro-image-preview`，支持 1-4 张图片生成、失败位展示、整批重试，并将结果持久化到本地磁盘与 SQLite。

**Architecture:** 前端通过 `/api/generate-images` 发起生成请求，通过 `/api/generation-batches` 加载历史。后端封装 Gemini 图片生成服务、文件落盘服务、SQLite 仓储，并在生成数量不足时补齐失败占位。前端按批次追加显示，失败条目与成功条目统一渲染，重试会创建新批次而非覆盖旧批次。

**Tech Stack:** React 19 + TypeScript + Vite 6, Express 4, @google/genai, better-sqlite3, Vitest, Supertest, tsx

---

### Task 1: 生成请求校验与类型契约

**Files:**
- Create: `server/validation/generate-request.ts`
- Create: `server/__tests__/generate-request.validation.test.ts`
- Modify: `server/types.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { validateGenerateRequest } from '../validation/generate-request';

describe('validateGenerateRequest', () => {
  it('returns null for valid payload', () => {
    const err = validateGenerateRequest({
      prompt: 'cinematic scene',
      aspectRatio: '16:9',
      count: 3,
    });
    expect(err).toBeNull();
  });

  it('rejects empty prompt', () => {
    expect(
      validateGenerateRequest({ prompt: '  ', aspectRatio: '16:9', count: 1 }),
    ).toBe('prompt is required');
  });

  it('rejects invalid count', () => {
    expect(
      validateGenerateRequest({ prompt: 'x', aspectRatio: '16:9', count: 5 }),
    ).toBe('count must be between 1 and 4');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/generate-request.validation.test.ts`  
Expected: FAIL (`validateGenerateRequest` 文件或导出不存在)

**Step 3: Write minimal implementation**

```ts
// server/validation/generate-request.ts
const ALLOWED_ASPECT_RATIOS = new Set(['2.39:1', '16:9', '3:4', '9:16', '4:3']);

type GenerateRequestLike = {
  prompt?: unknown;
  aspectRatio?: unknown;
  count?: unknown;
};

export function validateGenerateRequest(input: GenerateRequestLike): string | null {
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  if (!prompt) return 'prompt is required';

  if (typeof input.count !== 'number' || !Number.isInteger(input.count) || input.count < 1 || input.count > 4) {
    return 'count must be between 1 and 4';
  }

  if (typeof input.aspectRatio !== 'string' || !ALLOWED_ASPECT_RATIOS.has(input.aspectRatio)) {
    return 'invalid aspect ratio';
  }

  return null;
}
```

```ts
// server/types.ts (append)
export type AspectRatio = '2.39:1' | '16:9' | '3:4' | '9:16' | '4:3';

export type GenerateImagesInput = {
  prompt: string;
  aspectRatio: AspectRatio;
  count: 1 | 2 | 3 | 4;
};
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/generate-request.validation.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/validation/generate-request.ts server/__tests__/generate-request.validation.test.ts server/types.ts
git commit -m "test: add generate request validation contract"
```

---

### Task 2: Gemini Nano Banana Pro 图片生成服务

**Files:**
- Create: `server/services/gemini-image-generator.ts`
- Create: `server/__tests__/gemini-image-generator.test.ts`
- Modify: `server/types.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createGeminiImageGenerator } from '../services/gemini-image-generator';

describe('createGeminiImageGenerator', () => {
  it('extracts inline image data from model response', async () => {
    const fakeClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [
                  { inlineData: { mimeType: 'image/png', data: 'AAA' } },
                  { inlineData: { mimeType: 'image/png', data: 'BBB' } },
                ],
              },
            },
          ],
        }),
      },
    };

    const generate = createGeminiImageGenerator(fakeClient as any);
    const out = await generate({ prompt: 'x', aspectRatio: '16:9', count: 3 });

    expect(out).toEqual([
      { mimeType: 'image/png', dataBase64: 'AAA' },
      { mimeType: 'image/png', dataBase64: 'BBB' },
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/gemini-image-generator.test.ts`  
Expected: FAIL（服务未实现）

**Step 3: Write minimal implementation**

```ts
// server/services/gemini-image-generator.ts
import type { GenerateImagesInput } from '../types';

type GeminiImage = { mimeType: string; dataBase64: string };
type GeminiClient = {
  models: { generateContent: (input: unknown) => Promise<unknown> };
};

const MODEL_ID = 'gemini-3-pro-image-preview';

function extractImages(response: any): GeminiImage[] {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p: any) => p?.inlineData?.data && String(p.inlineData.mimeType || '').startsWith('image/'))
    .map((p: any) => ({
      mimeType: String(p.inlineData.mimeType),
      dataBase64: String(p.inlineData.data),
    }));
}

export function createGeminiImageGenerator(client: GeminiClient) {
  return async (input: GenerateImagesInput): Promise<GeminiImage[]> => {
    const response = await client.models.generateContent({
      model: MODEL_ID,
      contents: [
        { text: `Generate ${input.count} cinematic images.` },
        { text: input.prompt },
      ],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: input.aspectRatio },
      },
    });

    return extractImages(response);
  };
}
```

```ts
// server/types.ts (append)
export type GeneratedImageBinary = {
  mimeType: string;
  dataBase64: string;
};
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/gemini-image-generator.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/gemini-image-generator.ts server/__tests__/gemini-image-generator.test.ts server/types.ts
git commit -m "feat: add nano banana pro image generator service"
```

---

### Task 3: SQLite 初始化与批次仓储

**Files:**
- Create: `server/db/client.ts`
- Create: `server/repositories/generation-repository.ts`
- Create: `server/__tests__/generation-repository.test.ts`
- Modify: `package.json`

**Step 1: Write the failing test**

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDb } from '../db/client';
import { createGenerationRepository } from '../repositories/generation-repository';

describe('generation repository', () => {
  it('persists and queries batch with items', () => {
    const dbPath = path.join(os.tmpdir(), `cine-${Date.now()}.db`);
    const db = createDb(dbPath);
    const repo = createGenerationRepository(db);

    repo.insertBatch({
      id: 'batch_1',
      prompt: 'x',
      aspectRatio: '16:9',
      requestedCount: 2,
      model: 'gemini-3-pro-image-preview',
      status: 'partial_failed',
      createdAt: 1,
    });
    repo.insertItem({
      id: 'item_1',
      batchId: 'batch_1',
      position: 1,
      status: 'success',
      imagePath: '2026/03/02/a.png',
      errorMessage: null,
      createdAt: 1,
    });
    repo.insertItem({
      id: 'item_2',
      batchId: 'batch_1',
      position: 2,
      status: 'failed',
      imagePath: null,
      errorMessage: 'model returned no image',
      createdAt: 1,
    });

    const out = repo.listBatches({ limit: 20 });
    expect(out).toHaveLength(1);
    expect(out[0].items).toHaveLength(2);
    fs.rmSync(dbPath, { force: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/generation-repository.test.ts`  
Expected: FAIL（数据库模块不存在）

**Step 3: Write minimal implementation**

```ts
// server/db/client.ts
import Database from 'better-sqlite3';

export function createDb(filePath: string) {
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS generation_batches (
      id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      aspect_ratio TEXT NOT NULL,
      requested_count INTEGER NOT NULL,
      model TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS generation_items (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      status TEXT NOT NULL,
      image_path TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}
```

```ts
// server/repositories/generation-repository.ts
export function createGenerationRepository(db: any) {
  const insertBatchStmt = db.prepare(
    'INSERT INTO generation_batches (id, prompt, aspect_ratio, requested_count, model, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const insertItemStmt = db.prepare(
    'INSERT INTO generation_items (id, batch_id, position, status, image_path, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );

  return {
    insertBatch(batch: any) {
      insertBatchStmt.run(batch.id, batch.prompt, batch.aspectRatio, batch.requestedCount, batch.model, batch.status, batch.createdAt);
    },
    insertItem(item: any) {
      insertItemStmt.run(item.id, item.batchId, item.position, item.status, item.imagePath, item.errorMessage, item.createdAt);
    },
    listBatches({ limit }: { limit: number }) {
      const batches = db.prepare('SELECT * FROM generation_batches ORDER BY created_at DESC LIMIT ?').all(limit);
      return batches.map((b: any) => ({
        id: b.id,
        prompt: b.prompt,
        aspectRatio: b.aspect_ratio,
        requestedCount: b.requested_count,
        model: b.model,
        status: b.status,
        createdAt: b.created_at,
        items: db.prepare('SELECT * FROM generation_items WHERE batch_id = ? ORDER BY position ASC').all(b.id),
      }));
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/generation-repository.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/db/client.ts server/repositories/generation-repository.ts server/__tests__/generation-repository.test.ts package.json package-lock.json
git commit -m "feat: add sqlite repository for generation batches"
```

---

### Task 4: 图片落盘服务与公开 URL

**Files:**
- Create: `server/services/generated-image-storage.ts`
- Create: `server/__tests__/generated-image-storage.test.ts`

**Step 1: Write the failing test**

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGeneratedImageStorage } from '../services/generated-image-storage';

describe('generated image storage', () => {
  it('writes base64 image to dated path and returns relative/public urls', () => {
    const root = path.join(os.tmpdir(), `cine-storage-${Date.now()}`);
    const storage = createGeneratedImageStorage(root);

    const out = storage.save({
      batchId: 'batch_1',
      position: 2,
      mimeType: 'image/png',
      dataBase64: Buffer.from([1, 2, 3]).toString('base64'),
      now: new Date('2026-03-02T10:00:00Z'),
    });

    expect(out.relativePath).toContain('2026/03/02');
    expect(out.publicUrl.startsWith('/generated/')).toBe(true);
    expect(fs.existsSync(path.join(root, out.relativePath))).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/generated-image-storage.test.ts`  
Expected: FAIL（落盘服务未实现）

**Step 3: Write minimal implementation**

```ts
// server/services/generated-image-storage.ts
import fs from 'node:fs';
import path from 'node:path';

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export function createGeneratedImageStorage(rootDir: string) {
  return {
    save(input: { batchId: string; position: number; mimeType: string; dataBase64: string; now?: Date }) {
      const now = input.now ?? new Date();
      const yyyy = String(now.getUTCFullYear());
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(now.getUTCDate()).padStart(2, '0');
      const ext = EXT_BY_MIME[input.mimeType] || 'png';
      const relativeDir = path.join(yyyy, mm, dd);
      const fileName = `${input.batchId}-${input.position}.${ext}`;
      const relativePath = path.join(relativeDir, fileName);
      const absDir = path.join(rootDir, relativeDir);
      const absPath = path.join(rootDir, relativePath);

      fs.mkdirSync(absDir, { recursive: true });
      fs.writeFileSync(absPath, Buffer.from(input.dataBase64, 'base64'));

      return {
        relativePath: relativePath.replaceAll('\\', '/'),
        publicUrl: `/generated/${relativePath.replaceAll('\\', '/')}`,
      };
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/generated-image-storage.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/generated-image-storage.ts server/__tests__/generated-image-storage.test.ts
git commit -m "feat: add generated image disk storage service"
```

---

### Task 5: 生成路由与失败占位补齐

**Files:**
- Create: `server/__tests__/generate-images.route.test.ts`
- Create: `server/__tests__/generation-batches.route.test.ts`
- Modify: `server/app.ts`
- Modify: `server/types.ts`

**Step 1: Write the failing tests**

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';

describe('POST /api/generate-images', () => {
  it('fills missing positions as failed items', async () => {
    const app = createApp({
      analyzeImage: async () => 'unused',
      generateImages: async () => ({
        id: 'batch_1',
        prompt: 'x',
        aspectRatio: '16:9',
        requestedCount: 3,
        model: 'gemini-3-pro-image-preview',
        status: 'partial_failed',
        createdAt: 1,
        items: [
          { id: 'i1', position: 1, status: 'success', imageUrl: '/generated/a.png' },
          { id: 'i2', position: 2, status: 'failed', errorMessage: 'model returned no image' },
          { id: 'i3', position: 3, status: 'failed', errorMessage: 'model returned no image' },
        ],
      }),
      listGenerationBatches: async () => [],
    });

    const res = await request(app).post('/api/generate-images').send({
      prompt: 'x',
      aspectRatio: '16:9',
      count: 3,
    });

    expect(res.status).toBe(200);
    expect(res.body.batch.items).toHaveLength(3);
  });
});
```

```ts
describe('GET /api/generation-batches', () => {
  it('returns persisted batches', async () => {
    const app = createApp({
      analyzeImage: async () => 'unused',
      generateImages: async () => {
        throw new Error('unused');
      },
      listGenerationBatches: async () => [{ id: 'batch_1', items: [] }],
    });
    const res = await request(app).get('/api/generation-batches?limit=20');
    expect(res.status).toBe(200);
    expect(res.body.batches).toHaveLength(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- server/__tests__/generate-images.route.test.ts server/__tests__/generation-batches.route.test.ts`  
Expected: FAIL（路由和依赖注入结构不存在）

**Step 3: Write minimal implementation**

```ts
// server/app.ts (new dependency contract)
type CreateAppDeps = {
  analyzeImage: AnalyzeImageFn;
  generateImages: (input: { prompt: string; aspectRatio: string; count: number }) => Promise<any>;
  listGenerationBatches: (input: { limit: number }) => Promise<any[]>;
};

app.post('/api/generate-images', express.json(), async (req, res) => {
  const validationError = validateGenerateRequest(req.body || {});
  if (validationError) return res.status(400).json({ error: validationError });
  try {
    const batch = await deps.generateImages(req.body);
    return res.status(200).json({ batch });
  } catch (error) {
    return res.status(500).json({ error: 'image generation failed' });
  }
});

app.get('/api/generation-batches', async (req, res) => {
  const limit = Number(req.query.limit || 20);
  const batches = await deps.listGenerationBatches({ limit });
  return res.status(200).json({ batches });
});
```

**Step 4: Run tests to verify they pass**

Run: `npm run test -- server/__tests__/generate-images.route.test.ts server/__tests__/generation-batches.route.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/app.ts server/types.ts server/__tests__/generate-images.route.test.ts server/__tests__/generation-batches.route.test.ts
git commit -m "feat: add generation routes for create and list batches"
```

---

### Task 6: 后端装配（DB + 存储 + Gemini）与静态目录

**Files:**
- Modify: `server/index.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Step 1: Write failing verification checkpoint**

```txt
启动 `npm run dev:api` 时当前仅装配 image-to-prompt，未装配 generate-images 和 /generated 静态目录。
```

**Step 2: Run check to verify current behavior**

Run: `npm run test -- server/__tests__/generate-images.route.test.ts`  
Expected: 可能 PASS（路由级），但运行态仍未接入真实依赖，记录现状

**Step 3: Write minimal implementation**

```ts
// server/index.ts (assembly fragment)
import path from 'node:path';
import { createDb } from './db/client';
import { createGenerationRepository } from './repositories/generation-repository';
import { createGeneratedImageStorage } from './services/generated-image-storage';
import { createGeminiImageGenerator } from './services/gemini-image-generator';

const dbPath = process.env.SQLITE_PATH || path.resolve('storage/cine.db');
const storageRoot = process.env.GENERATED_STORAGE_DIR || path.resolve('storage/generated');
const db = createDb(dbPath);
const repo = createGenerationRepository(db);
const storage = createGeneratedImageStorage(storageRoot);
const generateFromGemini = createGeminiImageGenerator(ai as any);

const app = createApp({
  analyzeImage,
  generateImages: createGenerateImagesUseCase({ repo, storage, generateFromGemini }),
  listGenerationBatches: async ({ limit }) => repo.listBatches({ limit }),
});

app.use('/generated', express.static(storageRoot));
```

```env
# .env.example (append)
SQLITE_PATH=storage/cine.db
GENERATED_STORAGE_DIR=storage/generated
```

**Step 4: Run verification**

Run: `npm run lint`  
Expected: PASS  

Run: `npm run test`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/index.ts .env.example README.md
git commit -m "feat: wire persistence and static serving for generated images"
```

---

### Task 7: 前端接入生成接口、数量选择与失败位

**Files:**
- Create: `src/services/generate-images.ts`
- Create: `src/services/generate-images.test.ts`
- Create: `src/services/generation-batches.ts`
- Create: `src/services/generation-batches.test.ts`
- Modify: `src/App.tsx`

**Step 1: Write failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { generateImages } from './generate-images';

describe('generateImages', () => {
  it('throws backend message on non-2xx', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'image generation failed' }),
    }) as any;
    await expect(generateImages({ prompt: 'x', aspectRatio: '16:9', count: 2 })).rejects.toThrow('image generation failed');
  });
});
```

```ts
import { describe, expect, it, vi } from 'vitest';
import { fetchGenerationBatches } from './generation-batches';

describe('fetchGenerationBatches', () => {
  it('returns batches array', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ batches: [{ id: 'batch_1', items: [] }] }),
    }) as any;
    const out = await fetchGenerationBatches();
    expect(out).toHaveLength(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- src/services/generate-images.test.ts src/services/generation-batches.test.ts`  
Expected: FAIL（服务文件不存在）

**Step 3: Write minimal implementation**

```ts
// src/services/generate-images.ts
export async function generateImages(input: { prompt: string; aspectRatio: string; count: 1 | 2 | 3 | 4 }) {
  const res = await fetch('/api/generate-images', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'image generation failed');
  return body.batch;
}
```

```ts
// src/services/generation-batches.ts
export async function fetchGenerationBatches(limit = 20) {
  const res = await fetch(`/api/generation-batches?limit=${limit}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'failed to load batches');
  return Array.isArray(body.batches) ? body.batches : [];
}
```

```ts
// src/App.tsx (fragments)
// 1) 新增 count 状态: const [generateCount, setGenerateCount] = useState<1|2|3|4>(1);
// 2) 页面加载时调用 fetchGenerationBatches 初始化 generationBatches
// 3) 生成按钮 onClick -> await generateImages(...) -> prepend batch
// 4) handleRegenerate(batch) 使用该批次参数再次 generateImages 并 prepend
// 5) 批次 item.status === 'failed' 时渲染失败占位卡片
```

**Step 4: Run tests to verify they pass**

Run: `npm run test -- src/services/generate-images.test.ts src/services/generation-batches.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/generate-images.ts src/services/generate-images.test.ts src/services/generation-batches.ts src/services/generation-batches.test.ts src/App.tsx
git commit -m "feat: connect generate button to nano banana pro api"
```

---

### Task 8: 全量验证与收尾

**Files:**
- Modify: `README.md`

**Step 1: Write failing checklist**

```md
- 当前 README 未覆盖“1-4 张选择、失败位展示、整批重试、持久化目录”说明。
```

**Step 2: Run verification commands before final doc tweak**

Run: `npm run lint`  
Expected: PASS

**Step 3: Write minimal documentation updates**

```md
- 新增“图片生成 API”章节：
  - `POST /api/generate-images`
  - `GET /api/generation-batches`
- 新增持久化说明：
  - SQLite 文件路径
  - 生成图片落盘目录与静态访问路径
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
git add README.md
git commit -m "docs: add usage guide for persistent image generation"
```

---

### 执行约束

- 严格 TDD：每个任务都按“先失败测试 -> 最小实现 -> 通过 -> 提交”执行。
- DRY/YAGNI：本轮只做固定模型 `gemini-3-pro-image-preview`，不做模型切换 UI。
- 失败位为一等公民：后端补齐占位并持久化，前端按条目状态渲染，不在前端猜测数量。
- 小步提交：每个任务一个 commit，便于审查与回滚。
- 技能引用：`@test-driven-development`、`@verification-before-completion`、`@requesting-code-review`。
