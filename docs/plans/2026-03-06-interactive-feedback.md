# 批次级即时交互反馈 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在生成页每个批次“再次生成”右侧新增点赞/点踩，并在点踩时弹出二级追问浮窗；反馈持久化保存并支持刷新回显。

**Architecture:** 采用批次反馈单表 `generation_batch_feedback`，以 `batch_id` 唯一键执行覆盖式 upsert。后端新增反馈校验、仓储与 API，前端新增 feedback service 与批次卡片交互状态，页面初始化时批量拉取反馈并按 `batchId` 合并展示。

**Tech Stack:** React 19 + TypeScript、Express、better-sqlite3、Vitest

---

> 执行约束：遵循 @superpowers/test-driven-development 与 @superpowers/verification-before-completion，按任务小步提交（frequent commits）。

### Task 1: 反馈请求参数校验（后端）

**Files:**
- Create: `server/validation/generation-batch-feedback-request.ts`
- Create: `server/__tests__/generation-batch-feedback-request.validation.test.ts`

**Step 1: Write the failing test**

在 `server/__tests__/generation-batch-feedback-request.validation.test.ts` 新增用例：
- 合法点赞 payload 返回 `null`
- 合法点踩 payload（有原因）返回 `null`
- `vote='down'` 且 `downvoteReasons=[]` 返回错误
- `vote` 非法值返回错误
- `comment.length > 500` 返回错误

```ts
expect(
  validateGenerationBatchFeedbackRequest({
    batchId: 'batch_x',
    vote: 'down',
    downvoteReasons: ['风格不符'],
    comment: '主体不一致',
  }),
).toBeNull();
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/generation-batch-feedback-request.validation.test.ts`  
Expected: FAIL（模块或函数不存在）

**Step 3: Write minimal implementation**

在 `server/validation/generation-batch-feedback-request.ts` 实现：

```ts
const MAX_COMMENT_LENGTH = 500;
const ALLOWED_VOTES = new Set(['up', 'down', null] as const);

export function validateGenerationBatchFeedbackRequest(input: unknown): string | null {
  // 校验 batchId 非空字符串
  // 校验 vote 属于 up/down/null
  // 校验 downvoteReasons 为 string[]
  // vote=down 时 reasons 至少 1 项
  // 校验 comment 为字符串且长度 <= 500
  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/generation-batch-feedback-request.validation.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/validation/generation-batch-feedback-request.ts server/__tests__/generation-batch-feedback-request.validation.test.ts
git commit -m "test: add feedback request validation and tests"
```

### Task 2: 反馈表与仓储能力（upsert + 批量查询）

**Files:**
- Modify: `server/db/client.ts`
- Modify: `server/repositories/generation-repository.ts`
- Modify: `server/__tests__/generation-repository.test.ts`

**Step 1: Write the failing test**

在 `server/__tests__/generation-repository.test.ts` 新增用例：
- 可 upsert 一条 batch feedback 并查询出来
- 同一 `batchId` 二次提交后覆盖旧值
- `vote !== 'down'` 时落库 `downvoteReasons=[]`

```ts
repo.upsertBatchFeedback({
  batchId: batch.id,
  vote: 'down',
  downvoteReasons: ['构图问题'],
  comment: '主体偏移',
  now: 200,
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/generation-repository.test.ts`  
Expected: FAIL（方法不存在）

**Step 3: Write minimal implementation**

1) `server/db/client.ts` 新增建表：

```sql
CREATE TABLE IF NOT EXISTS generation_batch_feedback (
  batch_id TEXT PRIMARY KEY,
  vote TEXT,
  downvote_reasons TEXT NOT NULL DEFAULT '[]',
  comment TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES generation_batches(id)
);
```

2) `server/repositories/generation-repository.ts` 新增：
- `upsertBatchFeedback(input)`
- `listBatchFeedbacks({ batchIds })`
- JSON 解析与序列化
- 非 `down` 强制 reasons `[]`

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/generation-repository.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/db/client.ts server/repositories/generation-repository.ts server/__tests__/generation-repository.test.ts
git commit -m "feat: add batch feedback repository persistence"
```

### Task 3: 新增反馈 API 路由并注入应用依赖

**Files:**
- Modify: `server/types.ts`
- Modify: `server/app.ts`
- Modify: `server/index.ts`
- Create: `server/__tests__/generation-batch-feedback.route.test.ts`

**Step 1: Write the failing test**

新增路由测试覆盖：
- `POST /api/generation-batch-feedback` 成功保存
- 点踩无原因返回 `400`
- 批次不存在返回 `404`
- `GET /api/generation-batch-feedback?batchIds=...` 返回批量反馈

```ts
const res = await request(app).post('/api/generation-batch-feedback').send({
  batchId: 'batch_1',
  vote: 'down',
  downvoteReasons: ['风格不符'],
  comment: '风格偏写实',
});
expect(res.status).toBe(200);
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/generation-batch-feedback.route.test.ts`  
Expected: FAIL（路由不存在）

**Step 3: Write minimal implementation**

- `server/types.ts` 增加：
  - `BatchFeedbackVote`
  - `GenerationBatchFeedback`
  - `UpsertGenerationBatchFeedbackFn`
  - `ListGenerationBatchFeedbacksFn`
- `server/app.ts` 新增 POST/GET 路由并复用 validation
- `server/index.ts` 将仓储方法注入 `createApp`

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/generation-batch-feedback.route.test.ts server/__tests__/generation-batches.route.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/types.ts server/app.ts server/index.ts server/__tests__/generation-batch-feedback.route.test.ts
git commit -m "feat: add generation batch feedback api routes"
```

### Task 4: 前端反馈 service 与单测

**Files:**
- Create: `src/services/generation-batch-feedback.ts`
- Create: `src/services/generation-batch-feedback.test.ts`

**Step 1: Write the failing test**

在 service 测试中覆盖：
- `fetchGenerationBatchFeedbacks(batchIds)` 成功返回 `feedbacks`
- `upsertGenerationBatchFeedback(input)` 成功返回 `feedback`
- 非 2xx 时抛出后端错误消息

```ts
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ feedbacks: [] }),
}) as unknown as typeof fetch;
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/services/generation-batch-feedback.test.ts`  
Expected: FAIL（文件不存在）

**Step 3: Write minimal implementation**

实现：
- `fetchGenerationBatchFeedbacks(batchIds: string[])`
- `upsertGenerationBatchFeedback(input)`
- 统一错误解析：`body.error ?? defaultMessage`

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/services/generation-batch-feedback.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/generation-batch-feedback.ts src/services/generation-batch-feedback.test.ts
git commit -m "feat: add frontend services for batch feedback"
```

### Task 5: 批次卡片接入点赞/点踩与二级浮窗

**Files:**
- Modify: `src/App.tsx`

**Step 1: Write the failing check**

先确认基线不含目标能力：

Run: `rg -n "点赞|点踩|DOWNVOTE_REASON_OPTIONS|generation-batch-feedback" src/App.tsx`  
Expected: 无命中或仅历史无效片段

**Step 2: Run baseline verification**

Run: `npm run lint`  
Expected: PASS（基线通过）

**Step 3: Write minimal implementation**

在 `src/App.tsx` 增加：
- 类型：`UiBatch.feedback`、`BatchFeedbackDraft`
- 状态：
  - `batchFeedbackDrafts`
  - `openDownvotePopoverBatchId`
  - `savingFeedbackBatchId`
- 常量：

```ts
const DOWNVOTE_REASON_OPTIONS = [
  '风格不符',
  '主体错误',
  '构图问题',
  '细节瑕疵',
  '清晰度不足',
  '与提示词不一致',
] as const;
```

- 初始化流程：拉取批次后再拉反馈并合并
- Footer 操作区：在“再次生成”右侧新增“点赞/点踩”
- 点踩二级浮窗：多选原因 + 至少 1 项校验 + 补充文本
- 保存行为：调用 `upsertGenerationBatchFeedback` 持久化

**Step 4: Run verification**

Run: `npm run lint`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add batch-level interactive feedback ui"
```

### Task 6: 全链路回归与手工验收

**Files:**
- Optional Modify: `README.md`（若补充 API 说明）

**Step 1: Run targeted automated tests**

Run:  
`npm run test -- server/__tests__/generation-batch-feedback-request.validation.test.ts server/__tests__/generation-repository.test.ts server/__tests__/generation-batch-feedback.route.test.ts src/services/generation-batch-feedback.test.ts`  
Expected: PASS

**Step 2: Run project-level verification**

Run: `npm run lint`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

**Step 3: Manual verification**

Run: `npm run dev`

手测清单：
- 某批次点击点赞并保存，刷新后仍为点赞态
- 点踩不选原因时被拦截并提示
- 点踩选择 1~N 个原因后可保存，刷新后回显
- 修改同批次反馈并再次保存，结果被覆盖为最新内容
- 按钮位于“再次生成”右侧，处理中批次操作禁用

**Step 4: Commit (if docs changed)**

```bash
git add README.md
git commit -m "docs: document generation batch feedback api"
```

## 风险与回滚点
- 风险：`App.tsx` 单文件体积大，状态耦合风险高。
- 控制：反馈状态按 `batchId` 局部更新，避免全量重算。
- 回滚：若 UI 风险超预期，可保留后端/API 与 service，短期关闭反馈 UI 入口。
