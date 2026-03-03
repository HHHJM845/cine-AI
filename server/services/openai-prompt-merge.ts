import { PROMPT_MERGE_INSTRUCTION } from './prompt-merge-instruction';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type PromptMergeInput = {
  presetPrompt: string;
  userPrompt: string;
  primarySceneId?: string;
  subSceneId?: string;
};

export type OpenAIPromptMergeOptions = {
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
  const parts = content
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return '';
      }
      const maybeText = (item as { text?: unknown }).text;
      return typeof maybeText === 'string' ? maybeText : '';
    })
    .filter(Boolean);
  return parts.join('\n');
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as any;
    return String(body?.error?.message || body?.error || body?.message || `http ${response.status}`);
  } catch {
    return `http ${response.status}`;
  }
}

function buildUserContent(input: PromptMergeInput): string {
  const sceneLabel =
    input.primarySceneId && input.subSceneId
      ? `场景: ${input.primarySceneId}/${input.subSceneId}\n`
      : '';
  return `${sceneLabel}场景预制提示词:\n${input.presetPrompt}\n\n用户输入提示词:\n${input.userPrompt}`;
}

export function createOpenAIPromptMerge(options: OpenAIPromptMergeOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  return async (input: PromptMergeInput): Promise<string> => {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: 'system', content: PROMPT_MERGE_INSTRUCTION },
          { role: 'user', content: buildUserContent(input) },
        ],
      }),
    });

    if (!response.ok) {
      const reason = await extractErrorMessage(response);
      throw new Error(`openai prompt-merge failed: ${reason}`);
    }

    const body = (await response.json()) as any;
    const rawContent = body?.choices?.[0]?.message?.content;
    return sanitizePrompt(extractMessageText(rawContent));
  };
}
