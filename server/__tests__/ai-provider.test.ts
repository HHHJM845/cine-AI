import { describe, expect, it, vi } from 'vitest';
import { createAiServicesFromEnv } from '../services/ai-provider';

describe('createAiServicesFromEnv', () => {
  it('throws clear error when SUXI_API_KEY is missing', () => {
    expect(() =>
      createAiServicesFromEnv({
        GEMINI_API_KEY: 'g-key',
      }),
    ).toThrow('SUXI_API_KEY is required for text capabilities');
  });

  it('uses suxi for image-to-prompt and prompt-merge by default', () => {
    const analyzeImage = vi.fn(async () => 'ok');
    const mergePrompt = vi.fn(async () => 'merged');
    const generateFromModel = vi.fn(async () => []);
    const makeGeminiClient = vi.fn(() => ({ id: 'gemini-client' }));
    const createOpenAIImageToPrompt = vi.fn(() => analyzeImage);
    const createOpenAIPromptMerge = vi.fn(() => mergePrompt);
    const createGeminiImageGenerator = vi.fn(() => generateFromModel);

    const output = createAiServicesFromEnv(
      {
        SUXI_API_KEY: 's-key',
        GEMINI_API_KEY: 'g-key',
      },
      {
        makeGeminiClient: makeGeminiClient as any,
        createOpenAIImageToPrompt: createOpenAIImageToPrompt as any,
        createOpenAIPromptMerge: createOpenAIPromptMerge as any,
        createGeminiImageGenerator: createGeminiImageGenerator as any,
      },
    );

    expect(output.analyzeProvider).toBe('suxi');
    expect(output.mergeProvider).toBe('suxi');
    expect(output.generateProvider).toBe('gemini');
    expect(createOpenAIImageToPrompt).toHaveBeenCalledWith({
      apiKey: 's-key',
      baseUrl: 'https://new.suxi.ai/v1',
      model: 'gpt-4o-mini',
    });
    expect(createOpenAIPromptMerge).toHaveBeenCalledWith({
      apiKey: 's-key',
      baseUrl: 'https://new.suxi.ai/v1',
      model: 'deepseek-v3',
    });
    expect(createGeminiImageGenerator).toHaveBeenCalledTimes(1);
  });

  it('allows overriding suxi base url and models', () => {
    const analyzeImage = vi.fn(async () => 'ok');
    const mergePrompt = vi.fn(async () => 'merged');
    const generateFromModel = vi.fn(async () => []);
    const createOpenAIImageToPrompt = vi.fn(() => analyzeImage);
    const createOpenAIPromptMerge = vi.fn(() => mergePrompt);
    const createOpenAIImageGenerator = vi.fn(() => generateFromModel);

    createAiServicesFromEnv(
      {
        SUXI_API_KEY: 's-key',
        SUXI_BASE_URL: 'https://new.suxi.ai/v1',
        SUXI_VISION_MODEL: 'gpt-4o-mini',
        SUXI_TEXT_MODEL: 'deepseek-v3',
        IMAGE_GENERATION_PROVIDER: 'openai',
        OPENAI_API_KEY: 'o-key',
      },
      {
        createOpenAIImageToPrompt: createOpenAIImageToPrompt as any,
        createOpenAIPromptMerge: createOpenAIPromptMerge as any,
        createOpenAIImageGenerator: createOpenAIImageGenerator as any,
      },
    );

    expect(createOpenAIImageToPrompt).toHaveBeenCalledWith({
      apiKey: 's-key',
      baseUrl: 'https://new.suxi.ai/v1',
      model: 'gpt-4o-mini',
    });
    expect(createOpenAIPromptMerge).toHaveBeenCalledWith({
      apiKey: 's-key',
      baseUrl: 'https://new.suxi.ai/v1',
      model: 'deepseek-v3',
    });
  });

  it('supports gemini generation provider while text stays on suxi', () => {
    const makeGeminiClient = vi.fn(() => ({ id: 'gemini-client' }));
    const createGeminiImageGenerator = vi.fn(() => vi.fn(async () => []));
    const createOpenAIImageToPrompt = vi.fn(() => vi.fn(async () => 'ok'));
    const createOpenAIPromptMerge = vi.fn(() => vi.fn(async () => 'merged'));

    const output = createAiServicesFromEnv(
      {
        SUXI_API_KEY: 's-key',
        GEMINI_API_KEY: 'g-key',
        IMAGE_GENERATION_PROVIDER: 'gemini',
      },
      {
        makeGeminiClient: makeGeminiClient as any,
        createGeminiImageGenerator: createGeminiImageGenerator as any,
        createOpenAIImageToPrompt: createOpenAIImageToPrompt as any,
        createOpenAIPromptMerge: createOpenAIPromptMerge as any,
      } as any,
    );

    expect(output.analyzeProvider).toBe('suxi');
    expect(output.mergeProvider).toBe('suxi');
    expect(output.generateProvider).toBe('gemini');
    expect(makeGeminiClient).toHaveBeenCalledWith('g-key');
  });

  it('supports openai generation provider while text stays on suxi', () => {
    const createOpenAIImageToPrompt = vi.fn(() => vi.fn(async () => 'ok'));
    const createOpenAIPromptMerge = vi.fn(() => vi.fn(async () => 'merged'));
    const createOpenAIImageGenerator = vi.fn(() => vi.fn(async () => []));

    const output = createAiServicesFromEnv(
      {
        SUXI_API_KEY: 's-key',
        IMAGE_GENERATION_PROVIDER: 'openai',
        OPENAI_BASE_URL: 'https://openai-proxy.example.com/v1',
        OPENAI_API_KEY: 'o-key',
        OPENAI_IMAGE_MODEL: 'image-model',
      },
      {
        createOpenAIImageToPrompt: createOpenAIImageToPrompt as any,
        createOpenAIPromptMerge: createOpenAIPromptMerge as any,
        createOpenAIImageGenerator: createOpenAIImageGenerator as any,
      },
    );

    expect(output.generateProvider).toBe('openai');
    expect(createOpenAIImageGenerator).toHaveBeenCalledWith({
      apiKey: 'o-key',
      baseUrl: 'https://openai-proxy.example.com/v1',
      model: 'image-model',
    });
  });

  it('throws clear error when openai generation key is missing', () => {
    expect(() =>
      createAiServicesFromEnv({
        SUXI_API_KEY: 's-key',
        IMAGE_GENERATION_PROVIDER: 'openai',
      }),
    ).toThrow('OPENAI_API_KEY is required when image generation provider is openai');
  });

  it('supports gemini_http provider for image generation', () => {
    const createOpenAIImageToPrompt = vi.fn(() => vi.fn(async () => 'ok'));
    const createOpenAIPromptMerge = vi.fn(() => vi.fn(async () => 'merged'));
    const createGeminiHttpImageGenerator = vi.fn(() => vi.fn(async () => []));

    const output = createAiServicesFromEnv(
      {
        SUXI_API_KEY: 's-key',
        IMAGE_GENERATION_PROVIDER: 'gemini_http',
        GEMINI_API_KEY: 'g-key',
        GEMINI_HTTP_BASE_URL: 'https://relay.example.com/v1beta',
        GEMINI_HTTP_API_KEY: 'relay-key',
        GEMINI_HTTP_IMAGE_MODEL: 'gemini-3-pro-image-preview',
      },
      {
        createOpenAIImageToPrompt: createOpenAIImageToPrompt as any,
        createOpenAIPromptMerge: createOpenAIPromptMerge as any,
        createGeminiHttpImageGenerator: createGeminiHttpImageGenerator as any,
      } as any,
    );

    expect(output.generateProvider).toBe('gemini_http');
    expect(createGeminiHttpImageGenerator).toHaveBeenCalledWith({
      apiKey: 'relay-key',
      baseUrl: 'https://relay.example.com/v1beta',
      model: 'gemini-3-pro-image-preview',
      authMode: 'bearer',
    });
  });

  it('throws clear error when gemini key is missing for gemini generation', () => {
    expect(() =>
      createAiServicesFromEnv({
        SUXI_API_KEY: 's-key',
        IMAGE_GENERATION_PROVIDER: 'gemini',
      }),
    ).toThrow('GEMINI_API_KEY is required when image generation provider is gemini');
  });
});
