import type { GenerateImagesInput, GeneratedImageBinary } from '../types';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type GeminiHttpAuthMode = 'api_key' | 'bearer';

export type GeminiHttpImageGeneratorOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  authMode?: GeminiHttpAuthMode;
  fetchImpl?: FetchLike;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function buildEndpoint(baseUrl: string, model: string): string {
  return `${normalizeBaseUrl(baseUrl)}/models/${model}:generateContent`;
}

function extractInlineImages(response: any): GeneratedImageBinary[] {
  const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
  const images: GeneratedImageBinary[] = [];

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      const mimeType = String(part?.inlineData?.mimeType ?? '');
      const data = String(part?.inlineData?.data ?? '');
      if (mimeType.startsWith('image/') && data) {
        images.push({ mimeType, dataBase64: data });
      }
    }
  }

  return images;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as any;
    return String(body?.error?.message || body?.error || body?.message || `http ${response.status}`);
  } catch {
    return `http ${response.status}`;
  }
}

function buildRequest(input: GenerateImagesInput) {
  return {
    contents: [
      {
        parts: [
          {
            text: `Generate ${input.count} images with aspect ratio ${input.aspectRatio}. ${input.prompt}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE'],
    },
  };
}

export function createGeminiHttpImageGenerator(options: GeminiHttpImageGeneratorOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const authMode = options.authMode ?? 'bearer';

  return async (input: GenerateImagesInput): Promise<GeneratedImageBinary[]> => {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    let endpoint = buildEndpoint(options.baseUrl, options.model);
    if (authMode === 'bearer') {
      headers.authorization = `Bearer ${options.apiKey}`;
    } else {
      const separator = endpoint.includes('?') ? '&' : '?';
      endpoint = `${endpoint}${separator}key=${encodeURIComponent(options.apiKey)}`;
    }

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildRequest(input)),
    });

    if (!response.ok) {
      const reason = await extractErrorMessage(response);
      throw new Error(`gemini_http image-generation failed: ${reason}`);
    }

    const body = await response.json();
    return extractInlineImages(body);
  };
}
