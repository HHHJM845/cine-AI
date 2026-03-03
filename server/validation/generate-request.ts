import type { AspectRatio } from '../types';

const ALLOWED_ASPECT_RATIOS = new Set<AspectRatio>(['16:9', '9:16']);

type GenerateRequestLike = {
  prompt?: unknown;
  aspectRatio?: unknown;
  count?: unknown;
  enableSceneAssist?: unknown;
  primarySceneId?: unknown;
  subSceneId?: unknown;
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

  if (typeof input.enableSceneAssist !== 'boolean') {
    return 'enableSceneAssist must be boolean';
  }

  if (input.enableSceneAssist) {
    const primarySceneId = typeof input.primarySceneId === 'string' ? input.primarySceneId.trim() : '';
    const subSceneId = typeof input.subSceneId === 'string' ? input.subSceneId.trim() : '';
    if (!primarySceneId || !subSceneId) {
      return 'primarySceneId and subSceneId are required when scene assist is enabled';
    }
  }

  return null;
}
