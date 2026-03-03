# 资产页网格缩略图 1:1 化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将资产页网格缩略图由 16:9 改为 1:1（裁切显示），并保持列表模式与其它交互不变。

**Architecture:** 在 `src/App.tsx` 资产页视图中仅修改网格卡片容器比例类名，从 `aspect-video` 调整为 `aspect-square`。不改数据流，不改 API，不改列表模式。通过类型检查、构建和手工路径验证确保无回归。

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS

---

### Task 1: 更新资产网格卡片比例类名

**Files:**
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

该仓库当前未配置 React 组件测试框架，采用“静态断言 + 构建验证”的最小测试策略。先用命令验证当前代码仍包含旧类名（预期失败于目标状态）：

Run: `rg -n "aspect-video" src/App.tsx`
Expected: 命中资产网格卡片位置（说明尚未变更）

**Step 2: Run test to verify it fails**

Run: `rg -n "aspect-square" src/App.tsx`
Expected: 资产网格卡片位置未命中（说明目标尚未实现）

**Step 3: Write minimal implementation**

在 `src/App.tsx` 资产页网格卡片容器的 class 三元表达式中替换：

```tsx
viewMode === 'grid' ? 'aspect-video' : 'flex h-16 items-center p-2 gap-4'
```

改为：

```tsx
viewMode === 'grid' ? 'aspect-square' : 'flex h-16 items-center p-2 gap-4'
```

**Step 4: Run test to verify it passes**

Run: `rg -n "aspect-square" src/App.tsx`
Expected: 命中资产网格卡片位置

Run: `rg -n "aspect-video" src/App.tsx`
Expected: 资产网格卡片位置不再命中

**Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: make assets grid thumbnails square"
```

### Task 2: 完成验证与回归检查

**Files:**
- Verify: `src/App.tsx`

**Step 1: Run type check**

Run: `npm run lint`
Expected: PASS

**Step 2: Run production build**

Run: `npm run build`
Expected: PASS

**Step 3: Manual verification**

Run: `npm run dev`
Expected: 本地可正常打开页面

手工检查：
- 进入资产页，网格模式缩略图为 1:1 正方形。
- 切换批量、收藏、日期筛选后仍保持 1:1。
- 切换列表模式后样式与此前一致。

**Step 4: Commit (if needed)**

如果仅有验证微调产生改动：

```bash
git add <adjusted-files>
git commit -m "chore: finalize assets square thumbnail update"
```
