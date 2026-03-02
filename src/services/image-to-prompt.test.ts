import { describe, expect, it, vi } from 'vitest';
import { imageToPrompt } from './image-to-prompt';

describe('imageToPrompt', () => {
  it('throws with backend error message on non-2xx', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'analysis failed' }),
    }) as any;

    await expect(imageToPrompt(new File(['x'], 'x.png'))).rejects.toThrow('analysis failed');
  });
});
