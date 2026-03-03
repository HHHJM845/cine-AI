export type DeleteGenerationAssetsResult = {
  deletedItemIds: string[];
  failedItemIds: string[];
};

export async function deleteGenerationAssets(itemIds: string[]): Promise<DeleteGenerationAssetsResult> {
  const response = await fetch('/api/generation-assets/delete', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ itemIds }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'failed to delete generation assets');
  }

  return {
    deletedItemIds: Array.isArray(body.deletedItemIds) ? body.deletedItemIds : [],
    failedItemIds: Array.isArray(body.failedItemIds) ? body.failedItemIds : [],
  };
}
