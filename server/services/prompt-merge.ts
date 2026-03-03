type PromptMergeInput = {
  presetPrompt: string;
  userPrompt: string;
  primarySceneId?: string;
  subSceneId?: string;
};

type PromptMergeDeps = {
  mergeByModel: (input: PromptMergeInput) => Promise<string>;
};

function sanitizePrompt(text: string): string {
  return text.replaceAll('```', '').trim();
}

export function createPromptMergeService(deps: PromptMergeDeps) {
  return async (input: PromptMergeInput): Promise<string> => {
    const merged = await deps.mergeByModel(input);
    return sanitizePrompt(merged);
  };
}
