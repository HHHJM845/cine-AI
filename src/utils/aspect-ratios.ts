import type { GenerateImagesRequest } from '../services/generate-images';

export const SUPPORTED_ASPECT_RATIOS: GenerateImagesRequest['aspectRatio'][] = ['16:9', '9:16'];

export function toAspectRatio(value: string): GenerateImagesRequest['aspectRatio'] | null {
  const normalized = value.trim() as GenerateImagesRequest['aspectRatio'];
  return SUPPORTED_ASPECT_RATIOS.includes(normalized) ? normalized : null;
}
