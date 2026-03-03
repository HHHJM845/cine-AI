# 双 Provider 可切换 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让后端支持 `gemini/openai` 双 Provider，并通过环境变量切换，保持前端接口不变。

**Architecture:** 在 `server/services/ai-provider.ts` 统一组装 `analyzeImage` 与 `generateFromModel`。`server/index.ts` 只负责读取配置并注入应用。OpenAI 兼容能力通过新增服务实现，Gemini 逻辑保持原样。

**Tech Stack:** TypeScript, Express, Vitest, @google/genai, Fetch API

---

### Task 1: OpenAI 服务测试（先红灯）

**Files:**
- Create: `server/__tests__/openai-image-to-prompt.test.ts`
- Create: `server/__tests__/openai-image-generator.test.ts`

1. 写图生文失败测试（解析 fenced 文本、请求体字段）
2. 写文生图失败测试（解析 `b64_json` 与 `url`）
3. 运行：
`npm run test -- server/__tests__/openai-image-to-prompt.test.ts server/__tests__/openai-image-generator.test.ts`
4. 预期：FAIL（服务文件不存在）

### Task 2: Provider 工厂测试（先红灯）

**Files:**
- Create: `server/__tests__/ai-provider.test.ts`

1. 写 `gemini/openai` 选择测试
2. 写缺失关键环境变量时报错测试
3. 运行：
`npm run test -- server/__tests__/ai-provider.test.ts`
4. 预期：FAIL（工厂文件不存在）

### Task 3: OpenAI 服务最小实现（转绿灯）

**Files:**
- Create: `server/services/openai-image-to-prompt.ts`
- Create: `server/services/openai-image-generator.ts`

1. 实现最小可用请求与响应解析
2. 运行 Task 1 测试至通过

### Task 4: Provider 工厂与入口接线（转绿灯）

**Files:**
- Create: `server/services/ai-provider.ts`
- Modify: `server/index.ts`

1. 工厂按 `AI_PROVIDER` 返回服务函数
2. 保持 Gemini 兼容
3. 运行 Task 2 测试至通过

### Task 5: 配置文档与全量验证

**Files:**
- Modify: `.env.example`
- Modify: `docs/plans/2026-03-03-dual-ai-provider-design.md`（如需补充）

1. 补充 OpenAI 兼容配置示例（中文）
2. 运行：
- `npm run lint`
- `npm run test`
- `npm run build`
3. 预期全部通过
