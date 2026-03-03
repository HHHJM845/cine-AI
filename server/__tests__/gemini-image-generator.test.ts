import { describe, expect, it, vi } from 'vitest';
import { createGeminiImageGenerator } from '../services/gemini-image-generator';

describe('createGeminiImageGenerator', () => {
  it('extracts inline image data from model response', async () => {
    const fakeClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [
                  { inlineData: { mimeType: 'image/png', data: 'AAA' } },
                  { inlineData: { mimeType: 'image/png', data: 'BBB' } },
                ],
              },
            },
          ],
        }),
      },
    };

    const generateImages = createGeminiImageGenerator(fakeClient as any);
    const output = await generateImages({ prompt: 'x', aspectRatio: '16:9', count: 3 });

    expect(output).toEqual([
      { mimeType: 'image/png', dataBase64: 'AAA' },
      { mimeType: 'image/png', dataBase64: 'BBB' },
    ]);
  });
});
