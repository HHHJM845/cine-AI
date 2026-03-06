import { describe, expect, it, vi } from 'vitest';
import {
  fetchGenerationBatchFeedbacks,
  upsertGenerationBatchFeedback,
  type GenerationBatchFeedback,
} from './generation-batch-feedback';

function buildFeedback(overrides: Partial<GenerationBatchFeedback> = {}): GenerationBatchFeedback {
  return {
    batchId: 'batch_1',
    vote: 'up',
    downvoteReasons: [],
    comment: '',
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

describe('generation batch feedback services', () => {
  it('fetchGenerationBatchFeedbacks returns feedback array', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ feedbacks: [buildFeedback()] }),
    }) as any;

    const output = await fetchGenerationBatchFeedbacks(['batch_1']);
    expect(output).toHaveLength(1);
    expect(output[0].batchId).toBe('batch_1');
  });

  it('upsertGenerationBatchFeedback returns feedback object', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ feedback: buildFeedback({ vote: 'down', downvoteReasons: ['风格不符'] }) }),
    }) as any;

    const output = await upsertGenerationBatchFeedback({
      batchId: 'batch_1',
      vote: 'down',
      downvoteReasons: ['风格不符'],
      comment: '风格偏差',
    });
    expect(output.vote).toBe('down');
    expect(output.downvoteReasons).toEqual(['风格不符']);
  });

  it('throws backend error when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'failed to save batch feedback: db unavailable' }),
    }) as any;

    await expect(
      upsertGenerationBatchFeedback({
        batchId: 'batch_1',
        vote: 'up',
        downvoteReasons: [],
        comment: '',
      }),
    ).rejects.toThrow('failed to save batch feedback: db unavailable');
  });
});
