export type GenerationJobQueueStatus = 'queued' | 'running' | 'completed' | 'failed';

export type GenerationJobQueueItem = {
  id: string;
  status: GenerationJobQueueStatus;
  createdAt: number;
};

export function pickStartableJobIds(
  jobs: GenerationJobQueueItem[],
  runningCount: number,
  maxConcurrent: number,
): string[] {
  const safeRunningCount = Math.max(0, runningCount);
  const safeMaxConcurrent = Math.max(0, maxConcurrent);
  const capacity = Math.max(0, safeMaxConcurrent - safeRunningCount);
  if (capacity === 0) {
    return [];
  }

  return jobs
    .filter((job) => job.status === 'queued')
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, capacity)
    .map((job) => job.id);
}

export function dequeueStartableJobs(
  jobs: GenerationJobQueueItem[],
  runningCount: number,
  maxConcurrent: number,
): { startIds: string[]; nextRunningCount: number } {
  const startIds = pickStartableJobIds(jobs, runningCount, maxConcurrent);
  return {
    startIds,
    nextRunningCount: Math.max(0, runningCount) + startIds.length,
  };
}
