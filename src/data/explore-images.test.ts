import { describe, expect, it } from 'vitest';
import { EXPLORE_IMAGES } from './explore-images';

describe('EXPLORE_IMAGES', () => {
  it('contains 24 local images and all are 9:16', () => {
    expect(EXPLORE_IMAGES).toHaveLength(24);

    for (const img of EXPLORE_IMAGES) {
      expect(img.ratio).toBe('9:16');
      expect(img.url.startsWith('/explore/')).toBe(true);
    }
  });
});
