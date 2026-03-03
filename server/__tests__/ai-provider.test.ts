import { describe, expect, it, vi } from 'vitest';
import { createAiServicesFromEnv } from '../services/ai-provider';

describe('createAiServicesFromEnv', () => {
  it('uses gemini provider by default', () => {
    const analyzeImage = vi.fn(async () => 'ok');
    const generateFromModel = vi.fn(async () => []);
    const makeGeminiClient = vi.fn(() => ({ id: 'gemini-client' }));
    const createGeminiImageToPrompt = vi.fn(() => analyzeImage);
    const createGeminiImageGenerator = vi.fn(() => generateFromModel);

    const output = createAiServicesFromEnv(
      {
        GEMINI_API_KEY: 'g-key',
      },
      {
        makeGeminiClient: makeGeminiClient as any,
        createGeminiImageToPrompt: createGeminiImageToPrompt as any,
        createGeminiImageGenerator: createGeminiImageGenerator as any,
      },
    );

    expect(output.analyzeProvider).toBe('gemini');
    expect(output.generateProvider).toBe('gemini');
    expect(makeGeminiClient).toHaveBeenCalledWith('g-key');
    expect(createGeminiImageToPrompt).toHaveBeenCalledTimes(1);
    expect(createGeminiImageGenerator).toHaveBeenCalledTimes(1);
  });

  it('uses openai provider when AI_PROVIDER=openai', () => {
    const analyzeImage = vi.fn(async () => 'ok');
    const generateFromModel = vi.fn(async () => []);
    const createOpenAIImageToPrompt = vi.fn(() => analyzeImage);
    const createOpenAIImageGenerator = vi.fn(() => generateFromModel);

    const output = createAiServicesFromEnv(
      {
        AI_PROVIDER: 'openai',
        OPENAI_BASE_URL: 'https://openai-proxy.example.com/v1',
        OPENAI_API_KEY: 'o-key',
        OPENAI_TEXT_MODEL: 'text-model',
        OPENAI_IMAGE_MODEL: 'image-model',
      },
      {
        createOpenAIImageToPrompt: createOpenAIImageToPrompt as any,
        createOpenAIImageGenerator: createOpenAIImageGenerator as any,
      },
    );

    expect(output.analyzeProvider).toBe('openai');
    expect(output.generateProvider).toBe('openai');
    expect(createOpenAIImageToPrompt).toHaveBeenCalledWith({
      apiKey: 'o-key',
      baseUrl: 'https://openai-proxy.example.com/v1',
      model: 'text-model',
    });
    expect(createOpenAIImageGenerator).toHaveBeenCalledWith({
      apiKey: 'o-key',
      baseUrl: 'https://openai-proxy.example.com/v1',
      model: 'image-model',
    });
  });

  it('throws clear error when openai key is missing', () => {
    expect(() =>
      createAiServicesFromEnv({
        AI_PROVIDER: 'openai',
        OPENAI_BASE_URL: 'https://openai-proxy.example.com/v1',
      }),
    ).toThrow('OPENAI_API_KEY is required when any provider is openai');
  });

  it('supports mixed providers: gemini for image-to-prompt and openai for generation', () => {
    const analyzeImage = vi.fn(async () => 'prompt');
    const generateFromModel = vi.fn(async () => []);
    const makeGeminiClient = vi.fn(() => ({ id: 'gemini-client' }));
    const createGeminiImageToPrompt = vi.fn(() => analyzeImage);
    const createOpenAIImageGenerator = vi.fn(() => generateFromModel);

    const output = createAiServicesFromEnv(
      {
        AI_PROVIDER: 'openai',
        IMAGE_TO_PROMPT_PROVIDER: 'gemini',
        IMAGE_GENERATION_PROVIDER: 'openai',
        GEMINI_API_KEY: 'g-key',
        OPENAI_API_KEY: 'o-key',
        OPENAI_BASE_URL: 'https://openai-proxy.example.com/v1',
        OPENAI_IMAGE_MODEL: 'gemini-3-pro-image-preview',
      },
      {
        makeGeminiClient: makeGeminiClient as any,
        createGeminiImageToPrompt: createGeminiImageToPrompt as any,
        createOpenAIImageGenerator: createOpenAIImageGenerator as any,
      },
    );

    expect(output.analyzeProvider).toBe('gemini');
    expect(output.generateProvider).toBe('openai');
    expect(makeGeminiClient).toHaveBeenCalledWith('g-key');
    expect(createGeminiImageToPrompt).toHaveBeenCalledTimes(1);
    expect(createOpenAIImageGenerator).toHaveBeenCalledWith({
      apiKey: 'o-key',
      baseUrl: 'https://openai-proxy.example.com/v1',
      model: 'gemini-3-pro-image-preview',
    });
  });

  it('supports gemini_http provider for image generation', () => {
    const analyzeImage = vi.fn(async () => 'prompt');
    const generateFromModel = vi.fn(async () => []);
    const makeGeminiClient = vi.fn(() => ({ id: 'gemini-client' }));
    const createGeminiImageToPrompt = vi.fn(() => analyzeImage);
    const createGeminiHttpImageGenerator = vi.fn(() => generateFromModel);

    const output = createAiServicesFromEnv(
      {
        IMAGE_TO_PROMPT_PROVIDER: 'gemini',
        IMAGE_GENERATION_PROVIDER: 'gemini_http',
        GEMINI_API_KEY: 'g-key',
        GEMINI_HTTP_BASE_URL: 'https://relay.example.com/v1beta',
        GEMINI_HTTP_API_KEY: 'relay-key',
        GEMINI_HTTP_IMAGE_MODEL: 'gemini-3-pro-image-preview',
      },
      {
        makeGeminiClient: makeGeminiClient as any,
        createGeminiImageToPrompt: createGeminiImageToPrompt as any,
        createGeminiHttpImageGenerator: createGeminiHttpImageGenerator as any,
      } as any,
    );

    expect(output.analyzeProvider).toBe('gemini');
    expect(output.generateProvider).toBe('gemini_http');
    expect(createGeminiHttpImageGenerator).toHaveBeenCalledWith({
      apiKey: 'relay-key',
      baseUrl: 'https://relay.example.com/v1beta',
      model: 'gemini-3-pro-image-preview',
      authMode: 'bearer',
    });
  });

  it('supports PROMPT_MERGE_PROVIDER=openai while keeping generation provider unchanged', () => {
    const analyzeImage = vi.fn(async () => 'prompt');
    const generateFromModel = vi.fn(async () => []);
    const mergePrompt = vi.fn(async () => 'merged prompt');
    const makeGeminiClient = vi.fn(() => ({ id: 'gemini-client' }));
    const createGeminiImageToPrompt = vi.fn(() => analyzeImage);
    const createGeminiImageGenerator = vi.fn(() => generateFromModel);
    const createOpenAIPromptMerge = vi.fn(() => mergePrompt);

    const output = createAiServicesFromEnv(
      {
        AI_PROVIDER: 'gemini',
        IMAGE_TO_PROMPT_PROVIDER: 'gemini',
        IMAGE_GENERATION_PROVIDER: 'gemini',
        PROMPT_MERGE_PROVIDER: 'openai',
        GEMINI_API_KEY: 'g-key',
        OPENAI_API_KEY: 'o-key',
      },
      {
        makeGeminiClient: makeGeminiClient as any,
        createGeminiImageToPrompt: createGeminiImageToPrompt as any,
        createGeminiImageGenerator: createGeminiImageGenerator as any,
        createOpenAIPromptMerge: createOpenAIPromptMerge as any,
      } as any,
    );

    expect(output.mergeProvider).toBe('openai');
    expect(createOpenAIPromptMerge).toHaveBeenCalledTimes(1);
  });

  it('defaults merge provider to analyze provider when PROMPT_MERGE_PROVIDER is not set', () => {
    const analyzeImage = vi.fn(async () => 'prompt');
    const generateFromModel = vi.fn(async () => []);
    const mergePrompt = vi.fn(async () => 'merged prompt');
    const makeGeminiClient = vi.fn(() => ({ id: 'gemini-client' }));
    const createGeminiImageToPrompt = vi.fn(() => analyzeImage);
    const createGeminiImageGenerator = vi.fn(() => generateFromModel);
    const createGeminiPromptMerge = vi.fn(() => mergePrompt);

    const output = createAiServicesFromEnv(
      {
        IMAGE_TO_PROMPT_PROVIDER: 'gemini',
        IMAGE_GENERATION_PROVIDER: 'openai',
        GEMINI_API_KEY: 'g-key',
        OPENAI_API_KEY: 'o-key',
      },
      {
        makeGeminiClient: makeGeminiClient as any,
        createGeminiImageToPrompt: createGeminiImageToPrompt as any,
        createGeminiImageGenerator: createGeminiImageGenerator as any,
        createGeminiPromptMerge: createGeminiPromptMerge as any,
      } as any,
    );

    expect(output.mergeProvider).toBe('gemini');
    expect(createGeminiPromptMerge).toHaveBeenCalledTimes(1);
  });
});
