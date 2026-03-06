import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';

describe('generation batch feedback routes', () => {
  it('POST /api/generation-batch-feedback upserts feedback', async () => {
    const upsertGenerationBatchFeedback = vi.fn().mockResolvedValue({
      batchId: 'batch_1',
      vote: 'down',
      downvoteReasons: ['风格不符'],
      comment: '画风太写实',
      createdAt: 1,
      updatedAt: 2,
    });
    const app = createApp({
      analyzeImage: async () => 'unused',
      upsertGenerationBatchFeedback,
    } as any);

    const res = await request(app).post('/api/generation-batch-feedback').send({
      batchId: 'batch_1',
      vote: 'down',
      downvoteReasons: ['风格不符'],
      comment: '画风太写实',
    });

    expect(res.status).toBe(200);
    expect(res.body.feedback.batchId).toBe('batch_1');
    expect(upsertGenerationBatchFeedback).toHaveBeenCalledWith({
      batchId: 'batch_1',
      vote: 'down',
      downvoteReasons: ['风格不符'],
      comment: '画风太写实',
    });
  });

  it('POST /api/generation-batch-feedback returns 400 when downvote has no reasons', async () => {
    const app = createApp({
      analyzeImage: async () => 'unused',
      upsertGenerationBatchFeedback: async () => null,
    } as any);

    const res = await request(app).post('/api/generation-batch-feedback').send({
      batchId: 'batch_1',
      vote: 'down',
      downvoteReasons: [],
      comment: '',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('downvoteReasons must contain at least one reason when vote is down');
  });

  it('POST /api/generation-batch-feedback returns 404 when batch is not found', async () => {
    const app = createApp({
      analyzeImage: async () => 'unused',
      upsertGenerationBatchFeedback: async () => null,
    } as any);

    const res = await request(app).post('/api/generation-batch-feedback').send({
      batchId: 'missing_batch',
      vote: 'up',
      downvoteReasons: [],
      comment: '',
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('batch not found');
  });

  it('GET /api/generation-batch-feedback returns feedback list', async () => {
    const listGenerationBatchFeedbacks = vi.fn().mockResolvedValue([
      {
        batchId: 'batch_1',
        vote: 'up',
        downvoteReasons: [],
        comment: '很满意',
        createdAt: 1,
        updatedAt: 3,
      },
    ]);
    const app = createApp({
      analyzeImage: async () => 'unused',
      listGenerationBatchFeedbacks,
    } as any);

    const res = await request(app).get('/api/generation-batch-feedback?batchIds=batch_1,batch_2');

    expect(res.status).toBe(200);
    expect(res.body.feedbacks).toHaveLength(1);
    expect(listGenerationBatchFeedbacks).toHaveBeenCalledWith({ batchIds: ['batch_1', 'batch_2'] });
  });
});
