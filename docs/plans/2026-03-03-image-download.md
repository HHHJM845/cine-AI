# 图片下载能力修复（预览/详情/批量） Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复现有“下载按钮点击无反应”问题，支持预览卡片、详情页、批量模式三条下载路径，并在失败时给出可见提示且不中断批量流程。

**Architecture:** 将下载逻辑集中到独立服务模块，`App.tsx` 仅负责事件绑定与状态展示。单图与批量共享同一底层下载函数，批量层负责失败统计与汇总提示，避免重复逻辑和分散异常处理。

**Tech Stack:** React 19 + TypeScript + Vite + Vitest

---

## 执行约束
- 按 `@superpowers:test-driven-development` 先写失败测试，再写最小实现。
- 完成前使用 `@superpowers:verification-before-completion` 执行 lint/build/测试与手动验收。
- 每个任务结束后小步提交（frequent commits）。

### Task 1: 提取并验证下载核心服务（单图）

**Files:**
- Create: `src/services/image-download.ts`
- Create: `src/services/image-download.test.ts`
- Modify: `src/App.tsx`

**Step 1: 写失败测试（单图下载成功路径）**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { downloadImage } from './image-download';

describe('downloadImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads blob and revokes object url', async () => {
    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.spyOn(document.body, 'appendChild');
    const removeChild = vi.spyOn(document.body, 'removeChild');

    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click,
      remove,
    } as unknown as HTMLAnchorElement);

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:ok');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['x'], { type: 'image/png' }),
    }) as any;

    await downloadImage({
      url: '/generated/2026/03/03/a.png',
      fileName: 'cine-20260303-120000-1.png',
    });

    expect(click).toHaveBeenCalledTimes(1);
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(removeChild).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:ok');
  });
});
```

**Step 2: 运行测试并确认失败**

Run: `npm run test -- src/services/image-download.test.ts`

Expected: FAIL（提示无法找到 `downloadImage` 导出或模块不存在）。

**Step 3: 写最小实现（单图下载）**

```ts
export type DownloadImageInput = {
  url: string;
  fileName: string;
};

export async function downloadImage(input: DownloadImageInput): Promise<void> {
  const response = await fetch(input.url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = input.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
```

**Step 4: 运行测试确认通过**

Run: `npm run test -- src/services/image-download.test.ts`

Expected: PASS（`downloadImage` 用例通过）。

**Step 5: Commit**

```bash
git add src/services/image-download.ts src/services/image-download.test.ts
git commit -m "feat: add single image download service"
```

### Task 2: 扩展批量下载与文件名策略（失败不中断）

**Files:**
- Modify: `src/services/image-download.ts`
- Modify: `src/services/image-download.test.ts`

**Step 1: 写失败测试（批量统计 + 文件名回退）**

```ts
import { buildDownloadFileName, downloadImages } from './image-download';

it('buildDownloadFileName falls back to png extension', () => {
  const file = buildDownloadFileName({
    prefix: 'cine',
    timestamp: new Date('2026-03-03T12:00:00Z'),
    index: 2,
    sourceUrl: 'https://example.com/no-ext',
  });
  expect(file.endsWith('.png')).toBe(true);
});

it('downloadImages continues when one item fails', async () => {
  const okBlob = new Blob(['ok'], { type: 'image/png' });
  global.fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, blob: async () => okBlob })
    .mockResolvedValueOnce({ ok: false, status: 403 });

  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:ok');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(document, 'createElement').mockReturnValue({
    href: '',
    download: '',
    click: vi.fn(),
  } as unknown as HTMLAnchorElement);

  const result = await downloadImages([
    { url: '/generated/a.png', fileName: 'cine-a.png' },
    { url: '/generated/b.png', fileName: 'cine-b.png' },
  ]);

  expect(result.successCount).toBe(1);
  expect(result.failedCount).toBe(1);
});
```

**Step 2: 运行测试并确认失败**

Run: `npm run test -- src/services/image-download.test.ts`

Expected: FAIL（`downloadImages` 或 `buildDownloadFileName` 未实现）。

**Step 3: 写最小实现（批量 + 命名）**

```ts
export type DownloadTarget = { url: string; fileName: string };

export function buildDownloadFileName(input: {
  prefix: string;
  timestamp: Date;
  index: number;
  sourceUrl: string;
}): string {
  const yyyy = String(input.timestamp.getUTCFullYear());
  const mm = String(input.timestamp.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(input.timestamp.getUTCDate()).padStart(2, '0');
  const hh = String(input.timestamp.getUTCHours()).padStart(2, '0');
  const mi = String(input.timestamp.getUTCMinutes()).padStart(2, '0');
  const ss = String(input.timestamp.getUTCSeconds()).padStart(2, '0');

  const extMatch = input.sourceUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = extMatch?.[1]?.toLowerCase() || 'png';
  return `${input.prefix}-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${input.index}.${ext}`;
}

export async function downloadImages(items: DownloadTarget[]): Promise<{
  successCount: number;
  failedCount: number;
  failures: string[];
}> {
  let successCount = 0;
  let failedCount = 0;
  const failures: string[] = [];

  for (const item of items) {
    try {
      await downloadImage(item);
      successCount += 1;
    } catch (error) {
      failedCount += 1;
      failures.push(error instanceof Error ? error.message : 'unknown error');
    }
  }

  return { successCount, failedCount, failures };
}
```

**Step 4: 运行测试确认通过**

Run: `npm run test -- src/services/image-download.test.ts`

Expected: PASS（新增批量/命名相关用例通过）。

**Step 5: Commit**

```bash
git add src/services/image-download.ts src/services/image-download.test.ts
git commit -m "feat: add batch image download with summary"
```

### Task 3: 接入 App 三个下载入口并展示结果

**Files:**
- Modify: `src/App.tsx`

**Step 1: 写接入前检查清单（手动失败基线）**

Run: `npm run dev`

Expected baseline:
- 预览卡片下载：点击无反应。
- 详情页下载：点击无反应。
- 批量下载：点击无反应。

**Step 2: 在 App 中接入下载服务**

实现要点（最小改动）：
```ts
import { buildDownloadFileName, downloadImage, downloadImages } from './services/image-download';

const [downloadMessage, setDownloadMessage] = useState('');

const handleDownloadOne = async (url: string, index = 1) => {
  const fileName = buildDownloadFileName({
    prefix: 'cine',
    timestamp: new Date(),
    index,
    sourceUrl: url,
  });

  try {
    await downloadImage({ url, fileName });
    setDownloadMessage(`下载成功：${fileName}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    setDownloadMessage(`下载失败：${reason}`);
  }
};

const handleDownloadSelectedAssets = async () => {
  const selected = sortedAssets.filter((img) => selectedAssets.has(img.id));
  if (selected.length === 0) {
    setDownloadMessage('请先选择素材');
    return;
  }

  const now = new Date();
  const result = await downloadImages(
    selected.map((img, idx) => ({
      url: img.url,
      fileName: buildDownloadFileName({
        prefix: 'cine',
        timestamp: now,
        index: idx + 1,
        sourceUrl: img.url,
      }),
    })),
  );

  setDownloadMessage(`已下载 ${result.successCount} 张，失败 ${result.failedCount} 张`);
};
```

按钮绑定要求：
- 探索/预览卡片下载按钮：`onClick={(e) => { e.stopPropagation(); void handleDownloadOne(img.url); }}`
- 生成结果卡片下载按钮：绑定对应 `img.url`
- 详情页“下载素材”：绑定 `selectedImage.url`
- 批量操作栏“下载”：绑定 `handleDownloadSelectedAssets`

**Step 3: 运行静态检查**

Run: `npm run lint`

Expected: PASS（无 TS 报错）。

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire image download actions in app"
```

### Task 4: 端到端验证与收尾

**Files:**
- Modify: `README.md`（仅当需要补充下载行为说明时）

**Step 1: 运行构建与测试**

Run:
- `npm run test -- src/services/image-download.test.ts`
- `npm run build`

Expected:
- 相关单测 PASS
- 构建 PASS，产物输出到 `dist/`

**Step 2: 手动验收三条路径**

Run: `npm run dev`

Checklist:
- 预览卡片下载会落地文件。
- 详情页下载会落地文件。
- 批量下载会连续触发下载。
- 人为制造一个不可访问 URL 时，批量结果显示“失败 N 张”，且其他项仍下载。

**Step 3: 文档与最终提交**

如有用户可见行为变化，在 README 增补“下载失败可能由跨域导致”的简短说明。

```bash
git add README.md
git commit -m "docs: note image download failure behavior"
```

## 风险与注意事项
- 浏览器下载行为受用户设置影响（可能询问保存位置），属于预期。
- 对未开放 CORS 的远程图，`fetch` 可能失败；当前策略为可见失败提示 + 批量不中断。
- 本计划不引入后端代理，若线上跨域失败率高，再开独立迭代评估代理下载。
