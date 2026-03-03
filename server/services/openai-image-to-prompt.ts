import { PROMPT_INSTRUCTION } from './prompt-instruction';
import type { AnalyzeImageFn } from '../types';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type OpenAIImageToPromptOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetchImpl?: FetchLike;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function sanitizePrompt(text: string): string {
  return text.replaceAll('```', '').trim();
}

function extractMessageText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  const textParts = content
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return '';
      }
      const maybeText = (item as { text?: unknown }).text;
      return typeof maybeText === 'string' ? maybeText : '';
    })
    .filter(Boolean);

  return textParts.join('\n');
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as any;
    return String(body?.error?.message || body?.error || body?.message || `http ${response.status}`);
  } catch {
    return `http ${response.status}`;
  }
}

export function createOpenAIImageToPrompt(options: OpenAIImageToPromptOptions): AnalyzeImageFn {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  return async ({ mimeType, dataBase64 }) => {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: 'system', content: PROMPT_INSTRUCTION },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Generate a concise image-generation prompt based on this image.' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${dataBase64}` } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const reason = await extractErrorMessage(response);
      throw new Error(`openai image-to-prompt failed: ${reason}`);
    }

    const body = (await response.json()) as any;
    const rawContent = body?.choices?.[0]?.message?.content;
    const prompt = sanitizePrompt(extractMessageText(rawContent));

    return prompt;
  };
}
