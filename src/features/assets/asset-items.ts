export type AssetImageItem = {
  id: string;
  url: string;
  prompt: string;
  ratio: string;
  model: string;
  timestamp: number;
  folder: 'all';
};

type BatchLike = {
  id: string;
  prompt: string;
  ratio: string;
  model: string;
  createdAt?: number;
  images: Array<{
    id: string;
    status: 'success' | 'failed';
    url?: string;
  }>;
};

export function toAssetItemsFromBatches(batches: BatchLike[]): AssetImageItem[] {
  return batches.flatMap((batch) =>
    batch.images
      .filter((img) => img.status === 'success' && Boolean(img.url))
      .map((img) => ({
        id: img.id,
        url: img.url!,
        prompt: batch.prompt,
        ratio: batch.ratio,
        model: batch.model,
        timestamp: batch.createdAt ?? Date.now(),
        folder: 'all' as const,
      })),
  );
}
