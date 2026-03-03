import { describe, expect, it, vi } from 'vitest';
import { createGenerateImagesUseCase } from '../services/generate-images-usecase';

describe('createGenerateImagesUseCase', () => {
  it('fills missing items as failed placeholders', async () => {
    const insertBatch = vi.fn();
    const insertItem = vi.fn();
    const useCase = createGenerateImagesUseCase({
      repository: { insertBatch, insertItem },
      storage: {
        save: () => ({
          relativePath: '2026/03/02/a.png',
          publicUrl: '/generated/2026/03/02/a.png',
        }),
      },
      generateFromGemini: async () => [{ mimeType: 'image/png', dataBase64: 'AAA' }],
    });

    const result = await useCase({
      prompt: 'x',
      aspectRatio: '16:9',
      count: 3,
    });

    expect(result.items).toHaveLength(3);
    expect(result.items[0].status).toBe('success');
    expect(result.items[1].status).toBe('failed');
    expect(insertBatch).toHaveBeenCalledTimes(1);
    expect(insertItem).toHaveBeenCalledTimes(3);
  });

  it('fans out multi-image request into single-image calls and keeps positional failures', async () => {
    const insertBatch = vi.fn();
    const insertItem = vi.fn();
    const generateFromGemini = vi
      .fn()
      .mockResolvedValueOnce([{ mimeType: 'image/png', dataBase64: 'A' }])
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValueOnce([{ mimeType: 'image/png', dataBase64: 'C' }])
      .mockResolvedValueOnce([{ mimeType: 'image/png', dataBase64: 'D' }]);

    const useCase = createGenerateImagesUseCase({
      repository: { insertBatch, insertItem },
      storage: {
        save: ({ position }: { position: number }) => ({
          relativePath: `2026/03/03/${position}.png`,
          publicUrl: `/generated/2026/03/03/${position}.png`,
        }),
      },
      generateFromGemini,
      multiImageStrategy: 'fanout_single_image',
      fanoutConcurrency: 4,
    });

    const result = await useCase({
      prompt: 'x',
      aspectRatio: '16:9',
      count: 4,
    });

    expect(generateFromGemini).toHaveBeenCalledTimes(4);
    for (const [index, call] of generateFromGemini.mock.calls.entries()) {
      expect(call[0]).toEqual({
        prompt: 'x',
        aspectRatio: '16:9',
        count: 1,
      });
      expect(result.items[index].position).toBe(index + 1);
    }

    expect(result.status).toBe('partial_failed');
    expect(result.items).toHaveLength(4);
    expect(result.items[0].status).toBe('success');
    expect(result.items[1]).toMatchObject({
      status: 'failed',
      errorMessage: 'rate limited',
    });
    expect(result.items[2].status).toBe('success');
    expect(result.items[3].status).toBe('success');
    expect(insertBatch).toHaveBeenCalledTimes(1);
    expect(insertItem).toHaveBeenCalledTimes(4);
  });
});
