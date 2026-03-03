import { describe, expect, it, vi } from 'vitest';
import { createOpenAIImageGenerator } from '../services/openai-image-generator';

describe('createOpenAIImageGenerator', () => {
  it('extracts base64 images from image generation response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ b64_json: 'AAA' }, { b64_json: 'BBB' }],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const generateImages = createOpenAIImageGenerator({
      apiKey: 'token',
      baseUrl: 'https://example.com/v1',
      model: 'image-model',
      fetchImpl: fetchImpl as any,
    });

    const output = await generateImages({
      prompt: 'x',
      aspectRatio: '16:9',
      count: 2,
    });

    expect(output).toEqual([
      { mimeType: 'image/png', dataBase64: 'AAA' },
      { mimeType: 'image/png', dataBase64: 'BBB' },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/v1/images/generations');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('image-model');
    expect(body.n).toBe(2);
  });

  it('downloads image when provider returns url instead of b64', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/images/generations')) {
        return new Response(JSON.stringify({ data: [{ url: 'https://cdn.example.com/img.png' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url === 'https://cdn.example.com/img.png') {
        return new Response(Uint8Array.from([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        });
      }
      throw new Error(`unexpected url ${url}`);
    });

    const generateImages = createOpenAIImageGenerator({
      apiKey: 'token',
      baseUrl: 'https://example.com/v1',
      model: 'image-model',
      fetchImpl: fetchImpl as any,
    });

    const output = await generateImages({
      prompt: 'x',
      aspectRatio: '16:9',
      count: 1,
    });

    expect(output).toEqual([{ mimeType: 'image/png', dataBase64: 'AQID' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
