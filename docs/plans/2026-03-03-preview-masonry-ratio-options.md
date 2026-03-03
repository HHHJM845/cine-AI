# 生成预览瀑布流与比例选项精简 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让生成界面右侧预览区按原图比例完整预览并改为瀑布流，同时将画面比例选项精简为 `16:9` 和 `9:16`。

**Architecture:** 将比例选项与解析逻辑抽离为独立模块并通过 Vitest 覆盖，确保行为可回归验证。预览区沿用现有批次渲染数据流，只替换容器布局与图片呈现策略，从固定裁切网格调整为 CSS 列布局瀑布流 + `object-contain`。整体改动聚焦在 `src/App.tsx` 与一个新建比例工具模块，避免影响其他业务流程。

**Tech Stack:** React 19 + TypeScript + Tailwind CSS + Vitest

---

### Task 1: 比例工具模块与测试（TDD）

**Files:**
- Create: `src/utils/aspect-ratios.ts`
- Test: `src/utils/aspect-ratios.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { SUPPORTED_ASPECT_RATIOS, toAspectRatio } from './aspect-ratios';

describe('aspect-ratios', () => {
  it('只暴露 16:9 和 9:16', () => {
    expect(SUPPORTED_ASPECT_RATIOS).toEqual(['16:9', '9:16']);
  });

  it('接受合法比例并去除空白', () => {
    expect(toAspectRatio('16:9')).toBe('16:9');
    expect(toAspectRatio(' 9:16 ')).toBe('9:16');
  });

  it('拒绝已下线比例', () => {
    expect(toAspectRatio('2.39:1')).toBeNull();
    expect(toAspectRatio('3:4')).toBeNull();
    expect(toAspectRatio('4:3')).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/utils/aspect-ratios.test.ts`
Expected: FAIL（提示模块不存在）

**Step 3: Write minimal implementation**

```ts
import type { GenerateImagesRequest } from '../services/generate-images';

export const SUPPORTED_ASPECT_RATIOS: GenerateImagesRequest['aspectRatio'][] = ['16:9', '9:16'];

export function toAspectRatio(value: string): GenerateImagesRequest['aspectRatio'] | null {
  const normalized = value.trim() as GenerateImagesRequest['aspectRatio'];
  return SUPPORTED_ASPECT_RATIOS.includes(normalized) ? normalized : null;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/utils/aspect-ratios.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/aspect-ratios.ts src/utils/aspect-ratios.test.ts
git commit -m "test: add aspect ratio utility coverage"
```

### Task 2: 生成页比例选项接入与默认值调整

**Files:**
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

```ts
// 复用 Task 1 的拒绝旧比例用例，确保 UI 接入后解析行为仍被测试锁定
expect(toAspectRatio('2.39:1')).toBeNull();
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/utils/aspect-ratios.test.ts`
Expected: FAIL（若实现被错误修改）

**Step 3: Write minimal implementation**

```tsx
// 1) 移除 App.tsx 内重复的 SUPPORTED_ASPECT_RATIOS/toAspectRatio
// 2) 从 src/utils/aspect-ratios.ts 导入
// 3) useState 默认比例改为 '16:9'
// 4) 比例按钮列表改为 SUPPORTED_ASPECT_RATIOS，并把 grid 列数改为 2
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/utils/aspect-ratios.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: limit aspect ratio options to 16:9 and 9:16"
```

### Task 3: 右侧预览区瀑布流与等比缩小展示

**Files:**
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

```ts
// 无稳定 DOM 测试基建；以手动验收标准作为本任务的可执行失败条件
// 失败定义：右侧预览图出现裁切，或布局仍是固定 aspect-video 网格
```

**Step 2: Run test to verify it fails**

Run: `npm run dev`
Expected: 在改动前可观察到预览图被裁切、非瀑布流

**Step 3: Write minimal implementation**

```tsx
// 1) 批次图片容器从 grid 改为 columns-*（瀑布流）
// 2) 每个 item 使用 break-inside-avoid + mb 间距
// 3) 成功图片从 aspect-video/object-cover 改为 w-full + object-contain/h-auto
// 4) 失败卡片纳入统一瀑布流 item 结构
```

**Step 4: Run test to verify it passes**

Run: `npm run dev`
Expected: 右侧预览图完整显示原图比例且瀑布流排布正常

**Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: use masonry preview with original image proportions"
```

### Task 4: 完整验证

**Files:**
- Modify: none

**Step 1: Run type check**

Run: `npm run lint`
Expected: PASS

**Step 2: Run build**

Run: `npm run build`
Expected: PASS

**Step 3: Run targeted tests**

Run: `npm run test -- src/utils/aspect-ratios.test.ts`
Expected: PASS

**Step 4: 手动验收清单**

Run: `npm run dev`
Expected:
- 右侧预览区显示为瀑布流（不同高度图片自然排列）
- 图片按原图比例缩小完整展示，不裁切
- 比例选项仅有 `16:9`、`9:16`，默认高亮 `16:9`
