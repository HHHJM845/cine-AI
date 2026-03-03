import { describe, expect, it } from 'vitest';
import { validateGenerateRequest } from '../validation/generate-request';

describe('validateGenerateRequest', () => {
  it('returns null for valid payload', () => {
    const err = validateGenerateRequest({
      prompt: 'cinematic scene',
      aspectRatio: '16:9',
      count: 3,
      enableSceneAssist: false,
    });
    expect(err).toBeNull();
  });

  it('rejects empty prompt', () => {
    expect(validateGenerateRequest({ prompt: '  ', aspectRatio: '16:9', count: 1, enableSceneAssist: false })).toBe('prompt is required');
  });

  it('rejects invalid count', () => {
    expect(validateGenerateRequest({ prompt: 'x', aspectRatio: '16:9', count: 5, enableSceneAssist: false })).toBe('count must be between 1 and 4');
  });

  it('rejects invalid aspect ratio', () => {
    expect(validateGenerateRequest({ prompt: 'x', aspectRatio: '1:1', count: 2, enableSceneAssist: false })).toBe('invalid aspect ratio');
    expect(validateGenerateRequest({ prompt: 'x', aspectRatio: '2.39:1', count: 2, enableSceneAssist: false })).toBe('invalid aspect ratio');
  });

  it('rejects non-boolean scene assist flag', () => {
    expect(validateGenerateRequest({ prompt: 'x', aspectRatio: '16:9', count: 1 })).toBe('enableSceneAssist must be boolean');
  });

  it('requires primary/sub scene ids when scene assist is enabled', () => {
    expect(
      validateGenerateRequest({
        prompt: 'x',
        aspectRatio: '16:9',
        count: 1,
        enableSceneAssist: true,
      }),
    ).toBe('primarySceneId and subSceneId are required when scene assist is enabled');
  });

  it('allows missing scene ids when scene assist is disabled', () => {
    expect(
      validateGenerateRequest({
        prompt: 'x',
        aspectRatio: '16:9',
        count: 1,
        enableSceneAssist: false,
      }),
    ).toBeNull();
  });
});
