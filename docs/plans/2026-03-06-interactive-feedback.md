# 批次级即时交互反馈 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为生成页每个批次提供可持久化的点赞/点踩/文本反馈，并在点踩时要求“至少一个原因”以支撑 Badcase 归因。

**Architecture:** 后端新增批次反馈存储与读写 API，采用按 `batch_id` 唯一的覆盖式 upsert；前端在批次卡片下新增反馈区与点踩二级浮窗，并通过新 service 完成回填和提交。通过后端路由/仓储测试、前端 service 测试与手工流程验证构建闭环。

**Tech Stack:** React 19, TypeScript, Express, better-sqlite3, Vitest

---

> 执行约束：按 `@superpowers/test-driven-development` 先测后改；每个任务完成后按 `@superpowers/verification-before-completion` 做最小验证并提交。

### Task 1: 新增反馈请求校验模块

**Files:**
- Create: `server/validation/generation-batch-feedback-request.ts`
- Create: `server/__tests__/generation-batch-feedback-request.validation.test.ts`

**Step 1: Write the failing test**

在 `server/__tests__/generation-batch-feedback-request.validation.test.ts` 新增用例，覆盖：
- 合法 payload 返回 `null`
- `batchId` 缺失/空字符串报错
- `vote` 非 `up/down/null` 报错
- `vote='down'` 且无原因报错
- `comment` 超长报错

示例骨架：

```ts
import { describe, expect, it } from 'vitest';
import { validateGenerationBatchFeedbackRequest } from '../validation/generation-batch-feedback-request';

describe('validateGenerationBatchFeedbackRequest', () => {
  it('returns null for valid downvote payload', () => {
    expect(
      validateGenerationBatchFeedbackRequest({
        batchId: 'batch_1',
        vote: 'down',
        downvoteReasons: ['风格不符'],
        comment: '主体不一致',
      }),
    ).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/generation-batch-feedback-request.validation.test.ts`  
Expected: FAIL（模块不存在或函数未定义）

**Step 3: Write minimal implementation**

在 `server/validation/generation-batch-feedback-request.ts` 实现：

```ts
const ALLOWED_VOTES = new Set(['up', 'down', null] as const);
const MAX_COMMENT_LENGTH = 500;

export function validateGenerationBatchFeedbackRequest(input: any): string | null {
  // 1) 校验 batchId
  // 2) 校验 vote
  // 3) 校验 downvoteReasons 为 string[]
  // 4) vote='down' 时 reasons 至少 1 个
  // 5) 校验 comment 长度 <= 500
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

### Task 2: 扩展数据库与仓储以支持反馈 upsert/查询

**Files:**
- Modify: `server/db/client.ts`
- Modify: `server/repositories/generation-repository.ts`
- Modify: `server/__tests__/generation-repository.test.ts`

**Step 1: Write the failing test**

在 `server/__tests__/generation-repository.test.ts` 新增测试：
- `upserts and lists batch feedback`
- `overwrites existing feedback for same batch`
- `normalizes non-down vote reasons to []`

示例片段：

```ts
repo.upsertBatchFeedback({
  batchId: 'batch_1',
  vote: 'down',
  downvoteReasons: ['构图问题'],
  comment: '主体偏移',
  now: 2,
});
const output = repo.listBatchFeedbacks({ batchIds: ['batch_1'] });
expect(output[0].downvoteReasons).toEqual(['构图问题']);
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/generation-repository.test.ts`  
Expected: FAIL（`upsertBatchFeedback` / `listBatchFeedbacks` 不存在）

**Step 3: Write minimal implementation**

1) `server/db/client.ts` 增加建表：

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
- 解析/序列化 `downvote_reasons` JSON
- 非 `down` 时强制写入 `[]`

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/generation-repository.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/db/client.ts server/repositories/generation-repository.ts server/__tests__/generation-repository.test.ts
git commit -m "feat: add batch feedback repository persistence"
```

### Task 3: 新增反馈 API 路由并接入应用依赖

**Files:**
- Modify: `server/types.ts`
- Modify: `server/app.ts`
- Modify: `server/index.ts`
- Create: `server/__tests__/generation-batch-feedback.route.test.ts`

**Step 1: Write the failing test**

新增路由测试覆盖：
- `POST /api/generation-batch-feedback` 成功 upsert
- 点踩缺少原因返回 `400`
- 批次不存在返回 `404`
- `GET /api/generation-batch-feedback` 批量查询成功

示例片段：

```ts
const res = await request(app).post('/api/generation-batch-feedback').send({
  batchId: 'batch_1',
  vote: 'down',
  downvoteReasons: ['风格不符'],
  comment: '风格偏写实',
});
expect(res.status).toBe(200);
expect(res.body.feedback.batchId).toBe('batch_1');
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/generation-batch-feedback.route.test.ts`  
Expected: FAIL（路由不存在）

**Step 3: Write minimal implementation**

1) `server/types.ts` 增加反馈 DTO 与函数类型：

```ts
export type BatchFeedbackVote = 'up' | 'down' | null;
export type GenerationBatchFeedback = { ... };
export type UpsertGenerationBatchFeedbackFn = (...) => Promise<GenerationBatchFeedback>;
export type ListGenerationBatchFeedbacksFn = (...) => Promise<GenerationBatchFeedback[]>;
```

2) `server/app.ts` 新增：
- `POST /api/generation-batch-feedback`
- `GET /api/generation-batch-feedback`
- 复用新 validation，返回 `feedback` / `feedbacks`

3) `server/index.ts` 将仓储方法注入 `createApp` 依赖。

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/generation-batch-feedback.route.test.ts server/__tests__/generation-batches.route.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add server/types.ts server/app.ts server/index.ts server/__tests__/generation-batch-feedback.route.test.ts
git commit -m "feat: add generation batch feedback api routes"
```

### Task 4: 新增前端反馈 service 与单测

**Files:**
- Create: `src/services/generation-batch-feedback.ts`
- Create: `src/services/generation-batch-feedback.test.ts`

**Step 1: Write the failing test**

测试覆盖：
- `fetchGenerationBatchFeedbacks` 正常返回数组
- `upsertGenerationBatchFeedback` 正常返回对象
- 非 2xx 时抛出后端错误文案

示例片段：

```ts
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ feedbacks: [{ batchId: 'batch_1', vote: 'up', downvoteReasons: [], comment: '', createdAt: 1, updatedAt: 1 }] }),
}) as any;
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/services/generation-batch-feedback.test.ts`  
Expected: FAIL（文件不存在）

**Step 3: Write minimal implementation**

实现：
- `fetchGenerationBatchFeedbacks(batchIds: string[])`
- `upsertGenerationBatchFeedback(input)`
- 统一错误处理（`body.error || default`）

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/services/generation-batch-feedback.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/generation-batch-feedback.ts src/services/generation-batch-feedback.test.ts
git commit -m "feat: add frontend services for batch feedback"
```

### Task 5: 在生成页批次卡片集成反馈交互

**Files:**
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

仓库当前无组件测试框架，采用“静态断言 + 类型检查”最小策略：

Run: `rg -n "generation-batch-feedback|点踩原因|反馈已保存" src/App.tsx`  
Expected: 无命中（目标功能未接入）

**Step 2: Run test to verify it fails**

Run: `npm run lint`  
Expected: PASS（基线通过，便于对比改造后无类型回归）

**Step 3: Write minimal implementation**

在 `src/App.tsx` 完成以下改造：
- 扩展 `UiBatch` 增加 `feedback` 结构。
- 页面初始化拉取批次后，再按 batchIds 拉取反馈并合并。
- 每个批次 Footer 增加：
  - 点赞按钮
  - 点踩按钮（打开二级浮窗）
  - 文本意见输入
  - 保存按钮
- 点踩浮窗支持多选 6 类原因 + 补充文本。
- 校验：点踩提交必须至少 1 个原因；comment 长度 <= 500。
- 保存成功/失败通过现有消息机制提示。

可复用常量：

```ts
const DOWNVOTE_REASON_OPTIONS = [
  '风格不符',
  '主体错误',
  '构图问题',
  '细节瑕疵',
  '清晰度不足',
  '与提示词不一致',
];
```

**Step 4: Run test to verify it passes**

Run: `npm run lint`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add batch-level interactive feedback ui"
```

### Task 6: 全链路回归验证与文档补充

**Files:**
- Modify: `README.md`（若需要补充新接口说明）

**Step 1: Run targeted tests**

Run: `npm run test -- server/__tests__/generation-batch-feedback.route.test.ts server/__tests__/generation-repository.test.ts src/services/generation-batch-feedback.test.ts`  
Expected: PASS

**Step 2: Run full verification**

Run: `npm run lint`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

**Step 3: Manual verification**

Run: `npm run dev`  
Expected: 页面可访问，流程正常

手测清单：
- 给某批次点赞并保存，刷新后仍显示点赞。
- 给某批次点踩时不选原因，阻止提交并提示。
- 点踩选择多个原因并提交，刷新后回显。
- 仅填写文本意见提交，刷新后回显。
- 同批次重复修改反馈后，以最新内容覆盖旧内容。

**Step 4: Commit (if README changed)**

```bash
git add README.md
git commit -m "docs: document generation batch feedback api"
```

---

## 风险与回滚点
- 风险 1：`App.tsx` 单文件体量大，易引入状态耦合。  
  控制：反馈状态尽量按 `batchId` 局部更新，避免全量重算。
- 风险 2：历史数据无反馈记录。  
  控制：GET 返回缺省空数组，前端按空态渲染。
- 回滚点：若 UI 回归风险高，可先保留后端与 service，上线隐藏反馈 UI 开关。
