# 生成请求并行提交与排队预览 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让用户在当前批次生成中仍可继续提交新需求，前端并行上限 2、自动排队，并在预览区实时显示“排队中/生成中/逐张完成”。

**Architecture:** 在前端新增轻量队列调度层（仅内存态），将提交请求转为 `queued/running/completed/failed` 任务模型。调度器按 FIFO 拉起任务并限制最多 2 个并发；每个任务先渲染占位图，再按后端返回逐张替换。后端接口保持 `POST /api/generate-images` 不变。

**Tech Stack:** React 19, TypeScript, Vite, Vitest

---

参考技能：@test-driven-development @verification-before-completion

### Task 1: 建立任务调度核心（队列 + 并发上限）

**Files:**
- Create: `src/features/generation/job-queue.ts`
- Create: `src/features/generation/job-queue.test.ts`

**Step 1: 写失败测试（并发=2 + FIFO）**

```ts
import { describe, expect, it } from 'vitest';
import { dequeueStartableJobs } from './job-queue';

it('starts at most 2 queued jobs in FIFO order', () => {
  const jobs = [
    { id: 'j1', status: 'queued', createdAt: 1 },
    { id: 'j2', status: 'queued', createdAt: 2 },
    { id: 'j3', status: 'queued', createdAt: 3 },
  ] as const;

  const out = dequeueStartableJobs(jobs as any, 0, 2);
  expect(out.startIds).toEqual(['j1', 'j2']);
  expect(out.nextRunningCount).toBe(2);
});
```

**Step 2: 运行测试并确认失败**

Run: `npm run test -- src/features/generation/job-queue.test.ts`  
Expected: FAIL（`Cannot find module './job-queue'`）

**Step 3: 写最小实现**

```ts
export function dequeueStartableJobs(jobs, runningCount, maxConcurrent) {
  const capacity = Math.max(0, maxConcurrent - runningCount);
  const startIds = jobs
    .filter((j) => j.status === 'queued')
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, capacity)
    .map((j) => j.id);
  return {
    startIds,
    nextRunningCount: runningCount + startIds.length,
  };
}
```

**Step 4: 再跑测试确认通过**

Run: `npm run test -- src/features/generation/job-queue.test.ts`  
Expected: PASS

**Step 5: 提交**

```bash
git add src/features/generation/job-queue.ts src/features/generation/job-queue.test.ts
git commit -m "feat: add client-side job queue scheduler core"
```

### Task 2: 建立任务状态机（排队/运行/完成/失败 + 逐张占位）

**Files:**
- Create: `src/features/generation/job-state.ts`
- Create: `src/features/generation/job-state.test.ts`

**Step 1: 写失败测试（创建任务时生成占位项）**

```ts
import { describe, expect, it } from 'vitest';
import { createQueuedJob } from './job-state';

it('creates placeholder preview items by count', () => {
  const job = createQueuedJob({
    prompt: 'x',
    aspectRatio: '16:9',
    count: 3,
    createdAt: 100,
  });
  expect(job.status).toBe('queued');
  expect(job.previewItems.map((i) => i.status)).toEqual(['loading', 'loading', 'loading']);
});
```

**Step 2: 运行测试并确认失败**

Run: `npm run test -- src/features/generation/job-state.test.ts`  
Expected: FAIL（模块不存在）

**Step 3: 写最小实现（创建任务 + 应用后端批次）**

```ts
export function createQueuedJob(input) {
  return {
    id: `job_${crypto.randomUUID()}`,
    prompt: input.prompt,
    aspectRatio: input.aspectRatio,
    count: input.count,
    status: 'queued',
    createdAt: input.createdAt,
    previewItems: Array.from({ length: input.count }, (_, idx) => ({
      position: idx + 1,
      status: 'loading',
    })),
  };
}

export function applyBatchToJob(job, batch) {
  // 逐位置覆盖：success -> url, failed -> errorMessage
}
```

**Step 4: 补充并通过测试（含 partial_failed 场景）**

Run: `npm run test -- src/features/generation/job-state.test.ts`  
Expected: PASS

**Step 5: 提交**

```bash
git add src/features/generation/job-state.ts src/features/generation/job-state.test.ts
git commit -m "feat: add generation job state model with placeholder mapping"
```

### Task 3: 接入 App 调度流程（移除全局阻塞）

**Files:**
- Modify: `src/App.tsx`

**Step 1: 先加一个失败测试（调度函数行为）**

```ts
import { describe, expect, it } from 'vitest';
import { pickStartableJobIds } from '../features/generation/job-queue';

it('does not start new jobs when running count already hits max', () => {
  const startIds = pickStartableJobIds([
    { id: 'a', status: 'queued', createdAt: 1 },
  ] as any, 2, 2);
  expect(startIds).toEqual([]);
});
```

**Step 2: 运行测试并确认失败**

Run: `npm run test -- src/features/generation/job-queue.test.ts`  
Expected: FAIL（函数未导出或行为不符）

**Step 3: 在 `App.tsx` 接入调度**

```ts
const MAX_CONCURRENT = 2;
const [jobs, setJobs] = useState<UiJob[]>([]);
const [runningCount, setRunningCount] = useState(0);

const enqueueJob = (...) => { /* 创建 queued job + 占位项 */ };
const dispatchNext = () => { /* FIFO 拉起，最多2个 running */ };

// handleGenerate 不再被 isGenerating 短路
// 每个 job 独立调用 generateImages，完成后回填 previewItems
```

**Step 4: 运行现有前端与服务层测试**

Run: `npm run test -- src/services/generate-images.test.ts src/services/generation-batches.test.ts`  
Expected: PASS

**Step 5: 提交**

```bash
git add src/App.tsx
git commit -m "feat: allow queued submissions with max 2 concurrent generation jobs"
```

### Task 4: 预览区渲染“排队中/生成中/逐张完成”

**Files:**
- Modify: `src/App.tsx`

**Step 1: 写失败测试（任务到 UI 文案映射）**

```ts
import { describe, expect, it } from 'vitest';
import { toJobBadgeLabel } from '../features/generation/job-state';

it('maps queued status to 排队中 label', () => {
  expect(toJobBadgeLabel('queued')).toBe('排队中');
});
```

**Step 2: 运行测试并确认失败**

Run: `npm run test -- src/features/generation/job-state.test.ts`  
Expected: FAIL（映射函数不存在）

**Step 3: 最小实现 UI 状态映射与占位卡样式**

```ts
{job.previewItems.map((item) => {
  if (item.status === 'loading') return <LoadingCard ... />;
  if (item.status === 'failed') return <FailedCard ... />;
  return <img src={item.url} ... />;
})}
```

**Step 4: 本地手工验证（必做）**

Run: `npm run dev`  
Expected:
- 连续提交 3 次，看到“运行中 2 + 排队中 1”
- 任一任务结束后自动拉起队列头
- 预览区先占位，随后逐张替换

**Step 5: 提交**

```bash
git add src/App.tsx src/features/generation/job-state.ts src/features/generation/job-state.test.ts
git commit -m "feat: show queued/running progress and per-image progressive preview"
```

### Task 5: 全量验证与文档同步

**Files:**
- Modify: `README.md`（补充并发提交与排队说明）

**Step 1: 运行静态检查**

Run: `npm run lint`  
Expected: PASS

**Step 2: 运行全量测试**

Run: `npm run test`  
Expected: PASS

**Step 3: 运行构建**

Run: `npm run build`  
Expected: PASS

**Step 4: 更新文档说明并提交**

```bash
git add README.md
git commit -m "docs: document concurrent submissions and queue behavior"
```

**Step 5: 最终提交汇总**

```bash
git log --oneline -n 8
```

Expected: 包含上述功能与文档提交记录。
