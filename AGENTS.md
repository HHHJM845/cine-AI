# 仓库指南

## 项目结构与模块组织
本仓库是一个基于 Vite + React + TypeScript 的前端应用。
- `src/main.tsx`：应用入口与 React 根节点挂载。
- `src/App.tsx`：主要界面与交互逻辑。
- `src/index.css`：Tailwind 引入与全局样式。
- `index.html`：Vite HTML 入口文件。
- `vite.config.ts`：插件配置（`react`、`tailwindcss`）、环境变量注入与别名设置。
- `.env.example`：环境变量模板。

新增 UI 模块建议放在 `src/` 下（如 `src/components/`、`src/features/`），资源文件尽量与所属功能就近放置。

## 构建、测试与开发命令
- `npm install`：安装依赖。
- `npm run dev`：启动本地开发服务（`vite --port=3000 --host=0.0.0.0`）。
- `npm run build`：构建生产包，输出到 `dist/`。
- `npm run preview`：本地预览构建产物。
- `npm run lint`：执行 TypeScript 类型检查（`tsc --noEmit`）。
- `npm run clean`：删除 `dist/` 目录，便于重新构建。

## 编码风格与命名规范
- 使用 TypeScript 与 React 函数组件。
- 缩进使用 2 空格；保持与现有文件一致的分号与单引号风格。
- 组件、类型名使用 `PascalCase`（如 `MenuButton`）。
- 变量、函数、Hook 使用 `camelCase`（如 `handleImageUpload`）。
- 常量数据使用 `UPPER_SNAKE_CASE`（如 `MOCK_IMAGES`）。
- 当 `App.tsx` 逻辑变大时，优先拆分为小而单一职责的组件。

## 测试指南
当前仓库未配置独立单元测试框架。每次改动至少完成以下验证：
1. 运行 `npm run lint`，确保无类型错误。
2. 运行 `npm run build`，确保构建通过。
3. 通过 `npm run dev` 手动验证关键 UI 流程。

若后续新增测试，建议放在 `src/` 下，命名使用 `*.test.ts` 或 `*.test.tsx`。

## 提交与合并请求规范
当前工作区未包含可读取的 Git 历史，建议采用 Conventional Commits：
- `feat: 添加资产筛选面板`
- `fix: 修复图片空选择导致的崩溃`
- `docs: 更新本地运行说明`

PR 应包含：
- 变更范围与目标的清晰描述。
- 关联的任务或 Issue 编号（如有）。
- 验证步骤与关键命令结果摘要。
- 涉及 UI 的前后截图或短录屏。

## 安全与配置建议
- 从 `.env.example` 创建 `.env.local`，并配置 `GEMINI_API_KEY`。
- 禁止提交任何密钥、令牌或真实凭据。
- 涉及环境变量的功能需同时验证 `dev` 与 `build` 场景。
