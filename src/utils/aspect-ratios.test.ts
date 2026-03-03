import { describe, expect, it } from 'vitest';
import { SUPPORTED_ASPECT_RATIOS, toAspectRatio } from './aspect-ratios';

describe('aspect-ratios', () => {
  it('只保留 16:9 与 9:16', () => {
    expect(SUPPORTED_ASPECT_RATIOS).toEqual(['16:9', '9:16']);
  });

  it('接受合法比例并自动 trim', () => {
    expect(toAspectRatio('16:9')).toBe('16:9');
    expect(toAspectRatio(' 9:16 ')).toBe('9:16');
  });

  it('拒绝已下线的比例', () => {
    expect(toAspectRatio('2.39:1')).toBeNull();
    expect(toAspectRatio('3:4')).toBeNull();
    expect(toAspectRatio('4:3')).toBeNull();
  });
});
