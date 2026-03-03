import type { GenerateImagesRequest, GenerationBatch } from '../../services/generate-images';

type JobLifecycleStatus = 'queued' | 'running' | 'completed' | 'failed';
type JobPreviewStatus = 'loading' | 'success' | 'failed';

export type GenerationJobPreviewItem = {
  id: string;
  position: number;
  status: JobPreviewStatus;
  url?: string;
  errorMessage?: string;
};

export type GenerationUiJob = {
  id: string;
  prompt: string;
  aspectRatio: GenerateImagesRequest['aspectRatio'];
  count: GenerateImagesRequest['count'];
  model: string;
  status: JobLifecycleStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  batchStatus?: GenerationBatch['status'];
  previewItems: GenerationJobPreviewItem[];
  errorMessage?: string;
};

type QueuedJobInput = {
  prompt: string;
  aspectRatio: GenerateImagesRequest['aspectRatio'];
  count: GenerateImagesRequest['count'];
  createdAt: number;
  model?: string;
};

type CreateQueuedJobOptions = {
  idFactory?: () => string;
};

const DEFAULT_MODEL = 'gemini-3-pro-image-preview';

export function createQueuedJob(input: QueuedJobInput, options: CreateQueuedJobOptions = {}): GenerationUiJob {
  const idFactory = options.idFactory ?? (() => `job_${Math.random().toString(36).slice(2, 10)}`);
  const jobId = idFactory();
  return {
    id: jobId,
    prompt: input.prompt,
    aspectRatio: input.aspectRatio,
    count: input.count,
    model: input.model ?? DEFAULT_MODEL,
    status: 'queued',
    createdAt: input.createdAt,
    previewItems: Array.from({ length: input.count }, (_, index) => ({
      id: `${jobId}_slot_${index + 1}`,
      position: index + 1,
      status: 'loading',
    })),
  };
}

export function markJobRunning(job: GenerationUiJob, startedAt = Date.now()): GenerationUiJob {
  return {
    ...job,
    status: 'running',
    startedAt,
  };
}

export function applyBatchToJob(job: GenerationUiJob, batch: GenerationBatch, finishedAt = Date.now()): GenerationUiJob {
  const itemByPosition = new Map(batch.items.map((item) => [item.position, item]));
  const previewItems = Array.from({ length: job.count }, (_, index) => {
    const position = index + 1;
    const item = itemByPosition.get(position);
    if (!item) {
      return {
        id: `${job.id}_slot_${position}`,
        position,
        status: 'failed' as const,
        errorMessage: 'model returned no image',
      };
    }

    if (item.status === 'success' && item.imageUrl) {
      return {
        id: item.id,
        position,
        status: 'success' as const,
        url: item.imageUrl,
      };
    }

    return {
      id: item.id,
      position,
      status: 'failed' as const,
      errorMessage: item.errorMessage || 'model returned no image',
    };
  });

  return {
    ...job,
    model: batch.model,
    status: 'completed',
    batchStatus: batch.status,
    finishedAt,
    previewItems,
    errorMessage: undefined,
  };
}

export function markJobRequestFailed(job: GenerationUiJob, reason: string, finishedAt = Date.now()): GenerationUiJob {
  return {
    ...job,
    status: 'failed',
    finishedAt,
    errorMessage: reason,
    batchStatus: undefined,
    previewItems: job.previewItems.map((item) =>
      item.status === 'loading'
        ? {
            ...item,
            status: 'failed' as const,
            errorMessage: reason,
          }
        : item,
    ),
  };
}

export function toJobBadgeLabel(job: GenerationUiJob): string {
  if (job.status === 'queued') {
    return '排队中';
  }
  if (job.status === 'running') {
    return '生成中';
  }
  if (job.status === 'failed') {
    return '失败';
  }
  if (job.batchStatus === 'partial_failed') {
    return '部分完成';
  }
  if (job.batchStatus === 'failed') {
    return '失败';
  }
  return '已完成';
}
