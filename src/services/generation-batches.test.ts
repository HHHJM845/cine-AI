import { describe, expect, it, vi } from 'vitest';
import { fetchGenerationBatches } from './generation-batches';

describe('fetchGenerationBatches', () => {
  it('returns batches array', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ batches: [{ id: 'batch_1', items: [] }] }),
    }) as any;

    const output = await fetchGenerationBatches();
    expect(output).toHaveLength(1);
  });
});
