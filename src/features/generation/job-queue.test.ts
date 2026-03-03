import { describe, expect, it } from 'vitest';
import { dequeueStartableJobs, pickStartableJobIds } from './job-queue';

describe('job-queue', () => {
  it('starts at most 2 queued jobs in FIFO order', () => {
    const jobs = [
      { id: 'j1', status: 'queued' as const, createdAt: 1 },
      { id: 'j2', status: 'queued' as const, createdAt: 2 },
      { id: 'j3', status: 'queued' as const, createdAt: 3 },
    ];

    const out = dequeueStartableJobs(jobs, 0, 2);
    expect(out.startIds).toEqual(['j1', 'j2']);
    expect(out.nextRunningCount).toBe(2);
  });

  it('does not start when running count reaches max', () => {
    const jobs = [{ id: 'a', status: 'queued' as const, createdAt: 1 }];
    const startIds = pickStartableJobIds(jobs, 2, 2);
    expect(startIds).toEqual([]);
  });
});
