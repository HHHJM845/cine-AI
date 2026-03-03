import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';

describe('POST /api/generate-images', () => {
  it('returns 400 for invalid payload', async () => {
    const app = createApp({
      analyzeImage: async () => 'unused',
      generateImages: async () => {
        throw new Error('unused');
      },
      listGenerationBatches: async () => [],
    });

    const res = await request(app).post('/api/generate-images').send({
      prompt: '',
      aspectRatio: '16:9',
      count: 2,
    });

    expect(res.status).toBe(400);
  });

  it('returns batch with fixed item count', async () => {
    const app = createApp({
      analyzeImage: async () => 'unused',
      generateImages: async () => ({
        id: 'batch_1',
        prompt: 'x',
        aspectRatio: '16:9',
        requestedCount: 3,
        model: 'gemini-3-pro-image-preview',
        status: 'partial_failed',
        createdAt: 1,
        items: [
          { id: 'i1', position: 1, status: 'success', imageUrl: '/generated/a.png' },
          { id: 'i2', position: 2, status: 'failed', errorMessage: 'model returned no image' },
          { id: 'i3', position: 3, status: 'failed', errorMessage: 'model returned no image' },
        ],
      }),
      listGenerationBatches: async () => [],
    });

    const res = await request(app).post('/api/generate-images').send({
      prompt: 'x',
      aspectRatio: '16:9',
      count: 3,
    });

    expect(res.status).toBe(200);
    expect(res.body.batch.items).toHaveLength(3);
  });
});
