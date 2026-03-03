import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';

describe('POST /api/generation-assets/delete', () => {
  it('deletes item ids and returns summary', async () => {
    const deleteGenerationItems = vi.fn().mockResolvedValue({
      deletedItemIds: ['item_1'],
      failedItemIds: [],
    });
    const app = createApp({
      analyzeImage: async () => 'unused',
      deleteGenerationItems,
    });

    const res = await request(app).post('/api/generation-assets/delete').send({ itemIds: ['item_1'] });

    expect(res.status).toBe(200);
    expect(res.body.deletedItemIds).toEqual(['item_1']);
    expect(res.body.failedItemIds).toEqual([]);
    expect(deleteGenerationItems).toHaveBeenCalledWith({ itemIds: ['item_1'] });
  });

  it('returns 400 when itemIds is invalid', async () => {
    const app = createApp({
      analyzeImage: async () => 'unused',
      deleteGenerationItems: async () => ({
        deletedItemIds: [],
        failedItemIds: [],
      }),
    });

    const res = await request(app).post('/api/generation-assets/delete').send({ itemIds: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('itemIds must be a non-empty string array');
  });
});
