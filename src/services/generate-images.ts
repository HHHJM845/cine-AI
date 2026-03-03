export type GenerateImagesRequest = {
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  count: 1 | 2 | 3 | 4;
};

export type GenerationItem = {
  id: string;
  position: number;
  status: 'success' | 'failed';
  imageUrl?: string;
  errorMessage?: string;
};

export type GenerationBatch = {
  id: string;
  prompt: string;
  aspectRatio: GenerateImagesRequest['aspectRatio'];
  requestedCount: number;
  model: string;
  status: 'completed' | 'partial_failed' | 'failed';
  createdAt: number;
  items: GenerationItem[];
};

export async function generateImages(input: GenerateImagesRequest): Promise<GenerationBatch> {
  const response = await fetch('/api/generate-images', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'image generation failed');
  }

  return body.batch as GenerationBatch;
}
