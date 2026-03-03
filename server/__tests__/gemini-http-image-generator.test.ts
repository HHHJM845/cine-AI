import { describe, expect, it, vi } from 'vitest';
import { createGeminiHttpImageGenerator } from '../services/gemini-http-image-generator';

describe('createGeminiHttpImageGenerator', () => {
  it('calls gemini generateContent endpoint and extracts inline images', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ inlineData: { mimeType: 'image/png', data: 'AAA' } }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const generateImages = createGeminiHttpImageGenerator({
      apiKey: 'relay-key',
      baseUrl: 'https://relay.example.com/v1beta',
      model: 'gemini-3-pro-image-preview',
      authMode: 'bearer',
      fetchImpl: fetchImpl as any,
    });

    const output = await generateImages({
      prompt: 'x',
      aspectRatio: '16:9',
      count: 1,
    });

    expect(output).toEqual([{ mimeType: 'image/png', dataBase64: 'AAA' }]);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://relay.example.com/v1beta/models/gemini-3-pro-image-preview:generateContent');
    expect(String((init.headers as Record<string, string>).authorization)).toBe('Bearer relay-key');
  });
});
