import { describe, expect, it, vi } from 'vitest';
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
});
