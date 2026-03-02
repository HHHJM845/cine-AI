import { PROMPT_INSTRUCTION } from './prompt-instruction';
import type { AnalyzeImageFn } from '../types';

type GeminiLikeClient = {
  models: {
    generateContent: (input: unknown) => Promise<{ text?: string }>;
  };
};

function sanitizePrompt(text: string): string {
  return text.replaceAll('```', '').trim();
}

export function createGeminiImageToPrompt(client: GeminiLikeClient): AnalyzeImageFn {
  return async ({ mimeType, dataBase64 }) => {
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { text: PROMPT_INSTRUCTION },
        { inlineData: { mimeType, data: dataBase64 } },
      ],
    });

    return sanitizePrompt(String(response.text ?? ''));
  };
}
