import { GoogleGenAI } from '@google/genai';
import type { AnalyzeImageFn, GenerateImagesInput, GeneratedImageBinary } from '../types';
import { createGeminiImageGenerator as createGeminiImageGeneratorDefault } from './gemini-image-generator';
import { createGeminiImageToPrompt as createGeminiImageToPromptDefault } from './gemini-image-to-prompt';
import { createGeminiHttpImageGenerator as createGeminiHttpImageGeneratorDefault } from './gemini-http-image-generator';
import { createOpenAIImageGenerator as createOpenAIImageGeneratorDefault } from './openai-image-generator';
import { createOpenAIImageToPrompt as createOpenAIImageToPromptDefault } from './openai-image-to-prompt';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_TEXT_MODEL = 'gpt-4.1-mini';
const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-1';
const DEFAULT_GEMINI_HTTP_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_HTTP_IMAGE_MODEL = 'gemini-3-pro-image-preview';

type ProviderName = 'gemini' | 'openai' | 'gemini_http';
type EnvLike = Record<string, string | undefined>;
type GeminiHttpAuthMode = 'api_key' | 'bearer';

type GenerateFromModelFn = (input: GenerateImagesInput) => Promise<GeneratedImageBinary[]>;

type AiProviderDeps = {
  makeGeminiClient?: (apiKey: string) => unknown;
  createGeminiImageToPrompt?: (client: unknown) => AnalyzeImageFn;
  createGeminiImageGenerator?: (client: unknown) => GenerateFromModelFn;
  createGeminiHttpImageGenerator?: (input: {
    apiKey: string;
    baseUrl: string;
    model: string;
    authMode: GeminiHttpAuthMode;
  }) => GenerateFromModelFn;
  createOpenAIImageToPrompt?: (input: { apiKey: string; baseUrl: string; model: string }) => AnalyzeImageFn;
  createOpenAIImageGenerator?: (input: { apiKey: string; baseUrl: string; model: string }) => GenerateFromModelFn;
};

export type AiServices = {
  analyzeProvider: ProviderName;
  generateProvider: ProviderName;
  analyzeImage: AnalyzeImageFn;
  generateFromModel: GenerateFromModelFn;
};

function normalizeProvider(raw: string | undefined): ProviderName {
  const value = String(raw || 'gemini').trim().toLowerCase();
  if (value === 'gemini_http') {
    return 'gemini_http';
  }
  if (value === 'openai') {
    return 'openai';
  }
  if (value === 'gemini') {
    return 'gemini';
  }
  throw new Error(`Unsupported AI_PROVIDER: ${value}`);
}

export function createAiServicesFromEnv(env: EnvLike, deps: AiProviderDeps = {}): AiServices {
  const defaultProvider = normalizeProvider(env.AI_PROVIDER);
  const analyzeProvider = normalizeProvider(env.IMAGE_TO_PROMPT_PROVIDER || defaultProvider);
  const generateProvider = normalizeProvider(env.IMAGE_GENERATION_PROVIDER || defaultProvider);

  if (analyzeProvider === 'gemini_http') {
    throw new Error('IMAGE_TO_PROMPT_PROVIDER does not support gemini_http');
  }

  const geminiApiKey = String(env.GEMINI_API_KEY || '').trim();
  const needGemini = analyzeProvider === 'gemini' || generateProvider === 'gemini';
  if (needGemini && !geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required when any provider is gemini');
  }

  const openaiApiKey = String(env.OPENAI_API_KEY || '').trim();
  const needOpenai = analyzeProvider === 'openai' || generateProvider === 'openai';
  if (needOpenai && !openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required when any provider is openai');
  }

  const needGeminiHttp = generateProvider === 'gemini_http';
  const geminiHttpApiKey = String(env.GEMINI_HTTP_API_KEY || geminiApiKey).trim();
  if (needGeminiHttp && !geminiHttpApiKey) {
    throw new Error('GEMINI_HTTP_API_KEY or GEMINI_API_KEY is required when provider is gemini_http');
  }

  const baseUrl = String(env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).trim();
  const textModel = String(env.OPENAI_TEXT_MODEL || DEFAULT_OPENAI_TEXT_MODEL).trim();
  const imageModel = String(env.OPENAI_IMAGE_MODEL || DEFAULT_OPENAI_IMAGE_MODEL).trim();
  const geminiHttpBaseUrl = String(env.GEMINI_HTTP_BASE_URL || DEFAULT_GEMINI_HTTP_BASE_URL).trim();
  const geminiHttpImageModel = String(env.GEMINI_HTTP_IMAGE_MODEL || DEFAULT_GEMINI_HTTP_IMAGE_MODEL).trim();
  const geminiHttpAuthMode = (String(env.GEMINI_HTTP_AUTH_MODE || '').trim().toLowerCase() ||
    (geminiHttpBaseUrl.includes('generativelanguage.googleapis.com') ? 'api_key' : 'bearer')) as GeminiHttpAuthMode;
  if (geminiHttpAuthMode !== 'api_key' && geminiHttpAuthMode !== 'bearer') {
    throw new Error('GEMINI_HTTP_AUTH_MODE must be api_key or bearer');
  }

  let geminiClient: unknown | null = null;
  const getGeminiClient = () => {
    if (!geminiClient) {
      const makeGeminiClient = deps.makeGeminiClient ?? ((apiKey: string) => new GoogleGenAI({ apiKey }));
      geminiClient = makeGeminiClient(geminiApiKey);
    }
    return geminiClient;
  };

  const createGeminiImageToPrompt = deps.createGeminiImageToPrompt ?? createGeminiImageToPromptDefault;
  const createGeminiImageGenerator = deps.createGeminiImageGenerator ?? createGeminiImageGeneratorDefault;
  const createGeminiHttpImageGenerator = deps.createGeminiHttpImageGenerator ?? createGeminiHttpImageGeneratorDefault;
  const createOpenAIImageToPrompt = deps.createOpenAIImageToPrompt ?? createOpenAIImageToPromptDefault;
  const createOpenAIImageGenerator = deps.createOpenAIImageGenerator ?? createOpenAIImageGeneratorDefault;

  const analyzeImage =
    analyzeProvider === 'gemini'
      ? createGeminiImageToPrompt(getGeminiClient())
      : createOpenAIImageToPrompt({
          apiKey: openaiApiKey,
          baseUrl,
          model: textModel,
        });

  const generateFromModel =
    generateProvider === 'gemini'
      ? createGeminiImageGenerator(getGeminiClient())
      : generateProvider === 'openai'
        ? createOpenAIImageGenerator({
            apiKey: openaiApiKey,
            baseUrl,
            model: imageModel,
          })
        : createGeminiHttpImageGenerator({
            apiKey: geminiHttpApiKey,
            baseUrl: geminiHttpBaseUrl,
            model: geminiHttpImageModel,
            authMode: geminiHttpAuthMode,
          });

  return {
    analyzeProvider,
    generateProvider,
    analyzeImage,
    generateFromModel,
  };
}
