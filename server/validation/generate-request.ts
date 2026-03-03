import type { AspectRatio } from '../types';

const ALLOWED_ASPECT_RATIOS = new Set<AspectRatio>(['16:9', '9:16']);

type GenerateRequestLike = {
  prompt?: unknown;
  aspectRatio?: unknown;
  count?: unknown;
};

export function validateGenerateRequest(input: GenerateRequestLike): string | null {
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  if (!prompt) {
    return 'prompt is required';
  }

  if (typeof input.count !== 'number' || !Number.isInteger(input.count) || input.count < 1 || input.count > 4) {
    return 'count must be between 1 and 4';
  }

  if (typeof input.aspectRatio !== 'string' || !ALLOWED_ASPECT_RATIOS.has(input.aspectRatio as AspectRatio)) {
    return 'invalid aspect ratio';
  }

  return null;
}
