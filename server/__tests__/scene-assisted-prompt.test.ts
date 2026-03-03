import { describe, expect, it, vi } from 'vitest';
import { createSceneAssistedPromptService } from '../services/scene-assisted-prompt';

describe('createSceneAssistedPromptService', () => {
  it('returns user prompt directly when scene assist is disabled', async () => {
    const loadScenePrompt = vi.fn();
    const mergePrompt = vi.fn();
    const resolvePrompt = createSceneAssistedPromptService({
      loadScenePrompt: loadScenePrompt as any,
      mergePrompt: mergePrompt as any,
    });

    const result = await resolvePrompt({
      prompt: '  user prompt  ',
      enableSceneAssist: false,
    });

    expect(result).toBe('user prompt');
    expect(loadScenePrompt).not.toHaveBeenCalled();
    expect(mergePrompt).not.toHaveBeenCalled();
  });

  it('falls back to user prompt when scene preset file is missing', async () => {
    const loadScenePrompt = vi.fn(async () => ({ presetPrompt: null, sourcePath: 'x' }));
    const mergePrompt = vi.fn();
    const warn = vi.fn();
    const resolvePrompt = createSceneAssistedPromptService({
      loadScenePrompt,
      mergePrompt: mergePrompt as any,
      logger: { warn },
    });

    const result = await resolvePrompt({
      prompt: 'user prompt',
      enableSceneAssist: true,
      primarySceneId: 'poster',
      subSceneId: 'movie_poster',
    });

    expect(result).toBe('user prompt');
    expect(mergePrompt).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('returns merged prompt when scene preset exists', async () => {
    const loadScenePrompt = vi.fn(async () => ({ presetPrompt: 'preset', sourcePath: 'x' }));
    const mergePrompt = vi.fn(async () => 'merged prompt');
    const resolvePrompt = createSceneAssistedPromptService({
      loadScenePrompt,
      mergePrompt,
    });

    const result = await resolvePrompt({
      prompt: 'user prompt',
      enableSceneAssist: true,
      primarySceneId: 'poster',
      subSceneId: 'movie_poster',
    });

    expect(result).toBe('merged prompt');
    expect(mergePrompt).toHaveBeenCalledWith({
      presetPrompt: 'preset',
      userPrompt: 'user prompt',
      primarySceneId: 'poster',
      subSceneId: 'movie_poster',
    });
  });

  it('throws when merge fails and scene assist is enabled', async () => {
    const loadScenePrompt = vi.fn(async () => ({ presetPrompt: 'preset', sourcePath: 'x' }));
    const mergePrompt = vi.fn(async () => {
      throw new Error('quota exceeded');
    });
    const resolvePrompt = createSceneAssistedPromptService({
      loadScenePrompt,
      mergePrompt,
    });

    await expect(
      resolvePrompt({
        prompt: 'user prompt',
        enableSceneAssist: true,
        primarySceneId: 'poster',
        subSceneId: 'movie_poster',
      }),
    ).rejects.toThrow('prompt merge failed: quota exceeded');
  });
});
