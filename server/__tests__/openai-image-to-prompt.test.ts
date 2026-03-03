import { describe, expect, it, vi } from 'vitest';
import { createOpenAIImageToPrompt } from '../services/openai-image-to-prompt';

describe('createOpenAIImageToPrompt', () => {
  it('calls chat completions and sanitizes fenced output', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '```\ncinematic prompt\n```' } }],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const analyzeImage = createOpenAIImageToPrompt({
      apiKey: 'token',
      baseUrl: 'https://example.com/v1',
      model: 'vision-model',
      fetchImpl: fetchImpl as any,
    });

    const result = await analyzeImage({
      mimeType: 'image/png',
      dataBase64: 'AQID',
    });

    expect(result).toBe('cinematic prompt');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('vision-model');
    expect(body.messages[1].content[1].image_url.url).toBe('data:image/png;base64,AQID');
  });

  it('throws backend reason on non-2xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const analyzeImage = createOpenAIImageToPrompt({
      apiKey: 'token',
      baseUrl: 'https://example.com/v1',
      model: 'vision-model',
      fetchImpl: fetchImpl as any,
    });

    await expect(
      analyzeImage({
        mimeType: 'image/png',
        dataBase64: 'AQID',
      }),
    ).rejects.toThrow('openai image-to-prompt failed: quota exceeded');
  });
});
