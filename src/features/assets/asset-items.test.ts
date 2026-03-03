import { describe, expect, it } from 'vitest';
import { toAssetItemsFromBatches } from './asset-items';

describe('toAssetItemsFromBatches', () => {
  it('maps only successful generation items', () => {
    const output = toAssetItemsFromBatches([
      {
        id: 'batch_1',
        prompt: 'p',
        ratio: '16:9',
        model: 'm',
        createdAt: 100,
        images: [
          { id: 'item_success', status: 'success', url: '/generated/a.png' },
          { id: 'item_failed', status: 'failed' },
        ],
      },
    ]);

    expect(output).toHaveLength(1);
    expect(output[0].id).toBe('item_success');
    expect(output[0].url).toBe('/generated/a.png');
  });
});
