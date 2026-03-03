import { describe, expect, it } from 'vitest';
import { validateGenerateRequest } from '../validation/generate-request';

describe('validateGenerateRequest', () => {
  it('returns null for valid payload', () => {
    const err = validateGenerateRequest({
      prompt: 'cinematic scene',
      aspectRatio: '16:9',
      count: 3,
    });
    expect(err).toBeNull();
  });

  it('rejects empty prompt', () => {
    expect(validateGenerateRequest({ prompt: '  ', aspectRatio: '16:9', count: 1 })).toBe('prompt is required');
  });

  it('rejects invalid count', () => {
    expect(validateGenerateRequest({ prompt: 'x', aspectRatio: '16:9', count: 5 })).toBe('count must be between 1 and 4');
  });

  it('rejects invalid aspect ratio', () => {
    expect(validateGenerateRequest({ prompt: 'x', aspectRatio: '1:1', count: 2 })).toBe('invalid aspect ratio');
    expect(validateGenerateRequest({ prompt: 'x', aspectRatio: '2.39:1', count: 2 })).toBe('invalid aspect ratio');
  });
});
