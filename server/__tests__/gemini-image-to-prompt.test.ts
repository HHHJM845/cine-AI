import { describe, expect, it, vi } from 'vitest';
import { createGeminiImageToPrompt } from '../services/gemini-image-to-prompt';

describe('createGeminiImageToPrompt', () => {
  it('returns plain text prompt without markdown fences', async () => {
    const fakeClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: '```\ncinematic detailed prompt\n```',
        }),
      },
    };

    const analyzeImage = createGeminiImageToPrompt(fakeClient as any);
    const result = await analyzeImage({
      mimeType: 'image/png',
      dataBase64: 'AQID',
    });

    expect(result).toBe('cinematic detailed prompt');
  });
});
