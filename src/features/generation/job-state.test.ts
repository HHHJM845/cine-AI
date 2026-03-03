import { describe, expect, it } from 'vitest';
import { applyBatchToJob, createQueuedJob, markJobRequestFailed, markJobRunning, toJobBadgeLabel } from './job-state';

describe('job-state', () => {
  it('creates placeholder preview items by count', () => {
    const job = createQueuedJob(
      {
        prompt: 'x',
        aspectRatio: '16:9',
        count: 3,
        createdAt: 100,
      },
      { idFactory: () => 'job_1' },
    );

    expect(job.status).toBe('queued');
    expect(job.previewItems.map((item) => item.status)).toEqual(['loading', 'loading', 'loading']);
  });

  it('maps partial_failed batch into mixed success and failure preview items', () => {
    const queued = createQueuedJob(
      {
        prompt: 'x',
        aspectRatio: '16:9',
        count: 3,
        createdAt: 100,
      },
      { idFactory: () => 'job_2' },
    );
    const running = markJobRunning(queued, 101);
    const job = applyBatchToJob(
      running,
      {
        id: 'batch_1',
        prompt: 'x',
        aspectRatio: '16:9',
        requestedCount: 3,
        sceneAssistUsed: false,
        model: 'gemini-3-pro-image-preview',
        status: 'partial_failed',
        createdAt: 200,
        items: [
          { id: 'i1', position: 1, status: 'success', imageUrl: '/generated/1.png' },
          { id: 'i2', position: 2, status: 'failed', errorMessage: 'rate limited' },
          { id: 'i3', position: 3, status: 'success', imageUrl: '/generated/3.png' },
        ],
      },
      220,
    );

    expect(job.status).toBe('completed');
    expect(job.batchStatus).toBe('partial_failed');
    expect(job.previewItems[0]).toMatchObject({ status: 'success', url: '/generated/1.png' });
    expect(job.previewItems[1]).toMatchObject({ status: 'failed', errorMessage: 'rate limited' });
    expect(job.previewItems[2]).toMatchObject({ status: 'success', url: '/generated/3.png' });
    expect(toJobBadgeLabel(job)).toBe('部分完成');
  });

  it('marks request-level failure for all loading placeholders', () => {
    const queued = createQueuedJob(
      {
        prompt: 'x',
        aspectRatio: '16:9',
        count: 2,
        createdAt: 100,
      },
      { idFactory: () => 'job_3' },
    );
    const failed = markJobRequestFailed(queued, 'network error', 110);
    expect(failed.status).toBe('failed');
    expect(failed.previewItems).toEqual([
      { id: 'job_3_slot_1', position: 1, status: 'failed', errorMessage: 'network error' },
      { id: 'job_3_slot_2', position: 2, status: 'failed', errorMessage: 'network error' },
    ]);
    expect(toJobBadgeLabel(failed)).toBe('失败');
  });
});
