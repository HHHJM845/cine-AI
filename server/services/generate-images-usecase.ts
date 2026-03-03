import { randomUUID } from 'node:crypto';
import type { GenerateImagesFn, GenerateImagesInput, GeneratedImageBinary, GenerationBatch, GenerationBatchStatus, GenerationItem } from '../types';

type GenerationRepositoryLike = {
  insertBatch: (input: {
    id: string;
    prompt: string;
    aspectRatio: string;
    requestedCount: number;
    sceneAssistUsed: boolean;
    model: string;
    status: GenerationBatchStatus;
    createdAt: number;
  }) => void;
  insertItem: (input: {
    id: string;
    batchId: string;
    position: number;
    status: 'success' | 'failed';
    imagePath: string | null;
    errorMessage: string | null;
    createdAt: number;
  }) => void;
};

type GeneratedImageStorageLike = {
  save: (input: {
    batchId: string;
    position: number;
    mimeType: string;
    dataBase64: string;
  }) => { relativePath: string; publicUrl: string };
};

type CreateGenerateImagesUseCaseDeps = {
  repository: GenerationRepositoryLike;
  storage: GeneratedImageStorageLike;
  generateFromGemini: (input: GenerateImagesInput) => Promise<GeneratedImageBinary[]>;
  multiImageStrategy?: 'single_request' | 'fanout_single_image';
  fanoutConcurrency?: number;
};

const MODEL_ID = 'gemini-3-pro-image-preview';
const DEFAULT_FANOUT_CONCURRENCY = 2;

function buildStatus(items: GenerationItem[]): GenerationBatchStatus {
  const successCount = items.filter((item) => item.status === 'success').length;
  if (successCount === items.length) {
    return 'completed';
  }
  if (successCount === 0) {
    return 'failed';
  }
  return 'partial_failed';
}

type GeneratedSlot = {
  image: GeneratedImageBinary | null;
  errorMessage: string | null;
};

function normalizeConcurrency(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return DEFAULT_FANOUT_CONCURRENCY;
  }
  return Math.floor(value);
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const safeConcurrency = Math.max(1, Math.min(concurrency, tasks.length));
  const output = new Array<T>(tasks.length);
  let nextIndex = 0;

  const workers = Array.from({ length: safeConcurrency }, async () => {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      output[currentIndex] = await tasks[currentIndex]();
    }
  });
  await Promise.all(workers);
  return output;
}

async function generateSlots(
  input: GenerateImagesInput,
  deps: CreateGenerateImagesUseCaseDeps,
): Promise<GeneratedSlot[]> {
  const strategy = deps.multiImageStrategy ?? 'single_request';
  if (strategy === 'single_request' || input.count === 1) {
    let binaries: GeneratedImageBinary[] = [];
    let modelError: string | null = null;
    try {
      binaries = await deps.generateFromGemini(input);
    } catch (error) {
      modelError = error instanceof Error ? error.message : 'image generation failed';
    }

    return Array.from({ length: input.count }).map((_, index) => {
      const image = binaries[index];
      if (!image) {
        return {
          image: null,
          errorMessage: modelError ?? 'model returned no image',
        };
      }
      return {
        image,
        errorMessage: null,
      };
    });
  }

  const tasks = Array.from({ length: input.count }).map(() => async (): Promise<GeneratedSlot> => {
    try {
      const binaries = await deps.generateFromGemini({
        prompt: input.prompt,
        aspectRatio: input.aspectRatio,
        count: 1,
      });
      const image = binaries[0];
      if (!image) {
        return {
          image: null,
          errorMessage: 'model returned no image',
        };
      }
      return {
        image,
        errorMessage: null,
      };
    } catch (error) {
      return {
        image: null,
        errorMessage: error instanceof Error ? error.message : 'image generation failed',
      };
    }
  });

  return runWithConcurrency(tasks, normalizeConcurrency(deps.fanoutConcurrency));
}

export function createGenerateImagesUseCase(deps: CreateGenerateImagesUseCaseDeps): GenerateImagesFn {
  return async (input) => {
    const batchId = `batch_${randomUUID()}`;
    const createdAt = Date.now();
    const items: GenerationItem[] = [];
    const slots = await generateSlots(input, deps);

    for (let i = 1; i <= input.count; i += 1) {
      const slot = slots[i - 1] ?? { image: null, errorMessage: 'model returned no image' };
      const image = slot.image;
      const itemId = `item_${randomUUID()}`;

      if (!image) {
        items.push({
          id: itemId,
          position: i,
          status: 'failed',
          errorMessage: slot.errorMessage ?? 'model returned no image',
        });
        continue;
      }

      try {
        const stored = deps.storage.save({
          batchId,
          position: i,
          mimeType: image.mimeType,
          dataBase64: image.dataBase64,
        });
        items.push({
          id: itemId,
          position: i,
          status: 'success',
          imageUrl: stored.publicUrl,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'failed to store image';
        items.push({
          id: itemId,
          position: i,
          status: 'failed',
          errorMessage: reason,
        });
      }
    }

    const status = buildStatus(items);
    const batch: GenerationBatch = {
      id: batchId,
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      requestedCount: input.count,
      sceneAssistUsed: Boolean(input.enableSceneAssist),
      model: MODEL_ID,
      status,
      createdAt,
      items,
    };

    deps.repository.insertBatch({
      id: batch.id,
      prompt: batch.prompt,
      aspectRatio: batch.aspectRatio,
      requestedCount: batch.requestedCount,
      sceneAssistUsed: batch.sceneAssistUsed,
      model: batch.model,
      status: batch.status,
      createdAt: batch.createdAt,
    });

    for (const item of batch.items) {
      deps.repository.insertItem({
        id: item.id,
        batchId: batch.id,
        position: item.position,
        status: item.status,
        imagePath: item.imageUrl ? item.imageUrl.replace('/generated/', '') : null,
        errorMessage: item.errorMessage ?? null,
        createdAt: batch.createdAt,
      });
    }

    return batch;
  };
}
