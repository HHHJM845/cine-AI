import { describe, expect, it, vi } from 'vitest';
import { createGeminiPromptMerge } from '../services/gemini-prompt-merge';
import { createOpenAIPromptMerge } from '../services/openai-prompt-merge';
import { createPromptMergeService } from '../services/prompt-merge';

describe('createPromptMergeService', () => {
  it('calls provider with preset and user prompt', async () => {
    const mergeByModel = vi.fn(async () => 'merged prompt');
    const mergePrompt = createPromptMergeService({ mergeByModel });

    const result = await mergePrompt({
      presetPrompt: 'preset content',
      userPrompt: 'user content',
      primarySceneId: 'poster',
      subSceneId: 'movie_poster',
    });

    expect(result).toBe('merged prompt');
    expect(mergeByModel).toHaveBeenCalledWith({
      presetPrompt: 'preset content',
      userPrompt: 'user content',
      primarySceneId: 'poster',
      subSceneId: 'movie_poster',
    });
  });

  it('sanitizes markdown fences from provider output', async () => {
    const mergeByModel = vi.fn(async () => '``` \nfinal merged prompt\n```');
    const mergePrompt = createPromptMergeService({ mergeByModel });

    const result = await mergePrompt({
      presetPrompt: 'preset content',
      userPrompt: 'user content',
    });

    expect(result).toBe('final merged prompt');
  });

  it('builds readable structured merge content for openai provider', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'final merged prompt' } }],
        }),
        { status: 200 },
      ),
    );
    const mergePrompt = createOpenAIPromptMerge({
      apiKey: 'test-key',
      baseUrl: 'https://example.com',
      model: 'test-model',
      fetchImpl,
    });

    await mergePrompt({
      presetPrompt: '核心用途：院线电影主海报',
      userPrompt: '一个女人站在雨夜街头',
      primarySceneId: 'poster',
      subSceneId: 'movie_poster',
    });

    const request = fetchImpl.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body));
    expect(body.messages[0].content).toContain('用户主体');
    expect(body.messages[1].content).toContain('场景: poster/movie_poster');
    expect(body.messages[1].content).toContain('场景预设');
    expect(body.messages[1].content).toContain('核心用途：院线电影主海报');
    expect(body.messages[1].content).toContain('用户输入');
    expect(body.messages[1].content).toContain('一个女人站在雨夜街头');
  });

  it('builds readable structured merge content for gemini provider', async () => {
    const generateContent = vi.fn(async () => ({ text: 'final merged prompt' }));
    const mergePrompt = createGeminiPromptMerge({
      models: { generateContent },
    });

    await mergePrompt({
      presetPrompt: '核心用途：宣发短视频封面图',
      userPrompt: '一个人冲出火场',
      primarySceneId: 'short_video',
      subSceneId: 'cover',
    });

    const request = generateContent.mock.calls[0]?.[0] as {
      contents: Array<{ text: string }>;
    };
    expect(request.contents[0].text).toContain('用户主体');
    expect(request.contents[1].text).toContain('场景: short_video/cover');
    expect(request.contents[1].text).toContain('场景预设');
    expect(request.contents[1].text).toContain('核心用途：宣发短视频封面图');
    expect(request.contents[1].text).toContain('用户输入');
    expect(request.contents[1].text).toContain('一个人冲出火场');
  });
});
