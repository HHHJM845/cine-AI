import { describe, expect, it, vi } from 'vitest';
import { generateImages } from './generate-images';

describe('generateImages', () => {
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
      }),
    ).rejects.toThrow('image generation failed');
  });
});
