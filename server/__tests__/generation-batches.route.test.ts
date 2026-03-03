import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';

describe('GET /api/generation-batches', () => {
  it('returns persisted batches', async () => {
    const app = createApp({
      analyzeImage: async () => 'unused',
      generateImages: async () => {
        throw new Error('unused');
      },
      listGenerationBatches: async () => [
        {
          id: 'batch_1',
          prompt: 'x',
          aspectRatio: '16:9',
          requestedCount: 1,
          model: 'gemini-3-pro-image-preview',
          status: 'completed',
          createdAt: 1,
          items: [{ id: 'item_1', position: 1, status: 'success', imageUrl: '/generated/a.png' }],
        },
      ],
    });

    const res = await request(app).get('/api/generation-batches?limit=20');

    expect(res.status).toBe(200);
    expect(res.body.batches).toHaveLength(1);
  });
});
