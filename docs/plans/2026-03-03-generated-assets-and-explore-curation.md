# 生成资产整合与探索素材扩充 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让资产页仅使用真实生成成功图片并支持彻底删除，同时将探索页切换为 24 张本地静态素材（仅 16:9 / 9:16）。

**Architecture:** 后端新增“按图片项删除”的能力并打通 API，删除时同步清理数据库和磁盘文件；前端资产页从 `generationBatches` 派生数据，不再依赖静态 mock。探索页改为读取 `public/explore/` 的本地素材元数据，保持与资产页数据解耦。

**Tech Stack:** React 19 + TypeScript + Express + better-sqlite3 + Vitest + Tailwind CSS

---

### Task 1: 后端仓储层支持按 item 删除与空批次清理

**Files:**
- Modify: `server/repositories/generation-repository.ts`
- Test: `server/__tests__/generation-repository.test.ts`

**Step 1: Write the failing test**

```ts
it('removes item and prunes empty batch', () => {
  repo.insertBatch(...);
  repo.insertItem({ id: 'item_1', batchId: 'batch_1', ... });

  const result = repo.removeItems(['item_1']);

  expect(result.deletedItemIds).toEqual(['item_1']);
  expect(repo.listBatches({ limit: 20 })).toHaveLength(0);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/generation-repository.test.ts`
Expected: FAIL，提示 `removeItems` 不存在

**Step 3: Write minimal implementation**

```ts
removeItems(itemIds: string[]) {
  // 1) 查出 item 对应 batch_id + image_path
  // 2) 删除 generation_items
  // 3) 查每个受影响 batch 剩余数量，0 则删除 generation_batches
  // 4) 返回 deletedItemIds + deletedBatchIds + imagePaths
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/generation-repository.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/repositories/generation-repository.ts server/__tests__/generation-repository.test.ts
git commit -m "feat: support deleting generation items in repository"
```

### Task 2: 存储层新增文件删除能力（幂等）

**Files:**
- Modify: `server/services/generated-image-storage.ts`
- Test: `server/__tests__/generated-image-storage.test.ts`

**Step 1: Write the failing test**

```ts
it('deletes file by relative path and remains idempotent', () => {
  const output = storage.save(...);
  expect(storage.remove(output.relativePath)).toBe(true);
  expect(storage.remove(output.relativePath)).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/generated-image-storage.test.ts`
Expected: FAIL，提示 `remove` 不存在

**Step 3: Write minimal implementation**

```ts
remove(relativePath: string): boolean {
  const absolute = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolute)) return false;
  fs.rmSync(absolute, { force: true });
  return true;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/generated-image-storage.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/generated-image-storage.ts server/__tests__/generated-image-storage.test.ts
git commit -m "feat: add generated file removal in storage"
```

### Task 3: 新增删除 API（单删/批删）

**Files:**
- Modify: `server/types.ts`
- Modify: `server/app.ts`
- Modify: `server/index.ts`
- Create: `server/__tests__/generation-assets.delete.route.test.ts`

**Step 1: Write the failing test**

```ts
it('POST /api/generation-assets/delete removes items and returns summary', async () => {
  const app = createApp({ ..., deleteGenerationItems: async () => ({ deletedItemIds: ['item_1'], failedItemIds: [] }) });
  const res = await request(app).post('/api/generation-assets/delete').send({ itemIds: ['item_1'] });
  expect(res.status).toBe(200);
  expect(res.body.deletedItemIds).toEqual(['item_1']);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- server/__tests__/generation-assets.delete.route.test.ts`
Expected: FAIL（路由不存在）

**Step 3: Write minimal implementation**

```ts
app.post('/api/generation-assets/delete', async (req, res) => {
  // validate itemIds:string[]
  // call deps.deleteGenerationItems
  // return deletedItemIds/failedItemIds
});
```

并在 `server/index.ts` 注入：
```ts
deleteGenerationItems: async ({ itemIds }) => {
  const result = repository.removeItems(itemIds);
  for (const imagePath of result.imagePaths) storage.remove(imagePath);
  return { deletedItemIds: result.deletedItemIds, failedItemIds: result.failedItemIds };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- server/__tests__/generation-assets.delete.route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/types.ts server/app.ts server/index.ts server/__tests__/generation-assets.delete.route.test.ts
git commit -m "feat: add generation asset delete api"
```

### Task 4: 前端删除服务与测试

**Files:**
- Create: `src/services/delete-generation-assets.ts`
- Create: `src/services/delete-generation-assets.test.ts`

**Step 1: Write the failing test**

```ts
it('throws backend error on non-2xx', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'bad request' }) }) as any;
  await expect(deleteGenerationAssets(['item_1'])).rejects.toThrow('bad request');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/services/delete-generation-assets.test.ts`
Expected: FAIL（模块不存在）

**Step 3: Write minimal implementation**

```ts
export async function deleteGenerationAssets(itemIds: string[]) {
  const response = await fetch('/api/generation-assets/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ itemIds }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'failed to delete assets');
  return body as { deletedItemIds: string[]; failedItemIds: string[] };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/services/delete-generation-assets.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/delete-generation-assets.ts src/services/delete-generation-assets.test.ts
git commit -m "feat: add frontend service for deleting generated assets"
```

### Task 5: 资产页改造为仅生成成功图 + 删除交互打通

**Files:**
- Modify: `src/App.tsx`
- (Optional helper) Create: `src/features/assets/asset-items.ts`
- (Optional helper test) Create: `src/features/assets/asset-items.test.ts`

**Step 1: Write the failing test**

```ts
it('maps only successful generation items to asset list', () => {
  const output = toAssetItems([batchWithSuccessAndFailed]);
  expect(output).toHaveLength(1);
  expect(output[0].id).toBe('item_success');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/assets/asset-items.test.ts`
Expected: FAIL（模块不存在）

**Step 3: Write minimal implementation**

```ts
// App.tsx
// 1) 删除 ASSET_IMAGES / MOCK_IMAGES 在资产页的数据入口
// 2) 使用 generationBatches 派生 sortedAssets
// 3) 资产搜索框接入状态并参与过滤
// 4) 单图删除与批量删除调用 deleteGenerationAssets
// 5) 成功后按 deletedItemIds 更新 generationBatches 与 selectedAssets
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/features/assets/asset-items.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/App.tsx src/features/assets/asset-items.ts src/features/assets/asset-items.test.ts
git commit -m "feat: drive assets view from generated images only"
```

### Task 6: 探索页改为 24 张本地素材（仅 16:9/9:16）

**Files:**
- Create: `src/data/explore-images.ts`
- Modify: `src/App.tsx`
- Create: `src/data/explore-images.test.ts`
- Add files: `public/explore/*`（24 张）

**Step 1: Write the failing test**

```ts
it('contains 24 explore images and only 16:9/9:16 ratios', () => {
  expect(EXPLORE_IMAGES).toHaveLength(24);
  for (const img of EXPLORE_IMAGES) {
    expect(['16:9', '9:16']).toContain(img.ratio);
    expect(img.url.startsWith('/explore/')).toBe(true);
  }
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/data/explore-images.test.ts`
Expected: FAIL（模块不存在）

**Step 3: Write minimal implementation**

```ts
// src/data/explore-images.ts
export const EXPLORE_IMAGES = [/* 24 items, local URLs */];
```

并在 `App.tsx` 中改为从该模块导入，不再使用旧的 `EXPLORE_IMAGES` 常量。

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/data/explore-images.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/explore-images.ts src/data/explore-images.test.ts src/App.tsx public/explore
git commit -m "feat: expand explore gallery to 24 local images"
```

### Task 7: 全量验证与回归

**Files:**
- Modify: none

**Step 1: Run backend tests related to changes**

Run: `npm run test -- server/__tests__/generation-repository.test.ts server/__tests__/generated-image-storage.test.ts server/__tests__/generation-assets.delete.route.test.ts`
Expected: PASS

**Step 2: Run frontend tests related to changes**

Run: `npm run test -- src/services/delete-generation-assets.test.ts src/data/explore-images.test.ts src/features/assets/asset-items.test.ts`
Expected: PASS

**Step 3: Run lint + full build**

Run: `npm run lint && npm run build`
Expected: PASS

**Step 4: Manual acceptance**

Run: `npm run dev`
Expected:
1. 探索页可见 24 张本地图片且比例仅 `16:9` / `9:16`。
2. 资产页仅显示生成成功图。
3. 资产页收藏、批量选择、下载、详情可用。
4. 单删/批删后刷新仍不出现，磁盘文件被清理。
