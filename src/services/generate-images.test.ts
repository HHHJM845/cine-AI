import { describe, expect, it, vi } from 'vitest';
import { generateImages } from './generate-images';

describe('generateImages', () => {
  it('sends scene assist payload to backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        batch: {
          id: 'batch_1',
          prompt: 'x',
          aspectRatio: '16:9',
          requestedCount: 1,
          model: 'm',
          status: 'completed',
          createdAt: 1,
          items: [],
        },
      }),
    });
    global.fetch = fetchMock as any;

    await generateImages({
      prompt: 'x',
      aspectRatio: '16:9',
      count: 1,
      enableSceneAssist: true,
      primarySceneId: 'poster',
      subSceneId: 'movie_poster',
    });

    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(String(requestInit?.body || '')).toContain('"enableSceneAssist":true');
    expect(String(requestInit?.body || '')).toContain('"primarySceneId":"poster"');
    expect(String(requestInit?.body || '')).toContain('"subSceneId":"movie_poster"');
  });

  it('throws backend message on non-2xx', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'image generation failed' }),
    }) as any;

    await expect(
      generateImages({
        prompt: 'x',
        aspectRatio: '16:9',
        count: 2,
        enableSceneAssist: false,
      }),
    ).rejects.toThrow('image generation failed');
  });
});
