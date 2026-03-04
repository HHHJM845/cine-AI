import type { GenerationBatch } from './generate-images';

export async function fetchGenerationBatches(limit = 100): Promise<GenerationBatch[]> {
  const response = await fetch(`/api/generation-batches?limit=${limit}`);
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error || 'failed to load batches');
  }

  return Array.isArray(body.batches) ? (body.batches as GenerationBatch[]) : [];
}
