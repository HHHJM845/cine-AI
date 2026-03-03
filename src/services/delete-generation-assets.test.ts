import { describe, expect, it, vi } from 'vitest';
import { deleteGenerationAssets } from './delete-generation-assets';

describe('deleteGenerationAssets', () => {
  it('throws backend message on non-2xx', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'bad request' }),
    }) as any;

    await expect(deleteGenerationAssets(['item_1'])).rejects.toThrow('bad request');
  });

  it('returns deletion summary on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deletedItemIds: ['item_1'], failedItemIds: [] }),
    }) as any;

    const result = await deleteGenerationAssets(['item_1']);
    expect(result.deletedItemIds).toEqual(['item_1']);
    expect(result.failedItemIds).toEqual([]);
  });
});
