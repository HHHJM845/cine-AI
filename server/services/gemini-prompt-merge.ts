import { PROMPT_MERGE_INSTRUCTION } from './prompt-merge-instruction';

type PromptMergeInput = {
  presetPrompt: string;
  userPrompt: string;
  primarySceneId?: string;
  subSceneId?: string;
};

type GeminiLikeClient = {
  models: {
    generateContent: (input: unknown) => Promise<{ text?: string }>;
  };
};

function buildUserContent(input: PromptMergeInput): string {
  const lines = [
    input.primarySceneId && input.subSceneId ? `场景: ${input.primarySceneId}/${input.subSceneId}` : '',
    '场景预设:',
    input.presetPrompt,
    '',
    '用户输入:',
    input.userPrompt,
  ];

  return lines.filter((line, index) => line || index > 0).join('\n');
}

function sanitizePrompt(text: string): string {
  return text.replaceAll('```', '').trim();
}

export function createGeminiPromptMerge(client: GeminiLikeClient) {
  return async (input: PromptMergeInput): Promise<string> => {
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { text: PROMPT_MERGE_INSTRUCTION },
        { text: buildUserContent(input) },
      ],
    });
    return sanitizePrompt(String(response.text ?? ''));
  };
}
