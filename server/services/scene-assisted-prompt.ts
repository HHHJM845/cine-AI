type ResolveScenePromptInput = {
  prompt: string;
  enableSceneAssist: boolean;
  primarySceneId?: string;
  subSceneId?: string;
};

type ScenePromptLoaderLike = (input: {
  primarySceneId: string;
  subSceneId: string;
}) => Promise<{
  presetPrompt: string | null;
  sourcePath: string;
}>;

type PromptMergeLike = (input: {
  presetPrompt: string;
  userPrompt: string;
  primarySceneId?: string;
  subSceneId?: string;
}) => Promise<string>;

type SceneAssistDeps = {
  loadScenePrompt: ScenePromptLoaderLike;
  mergePrompt: PromptMergeLike;
  logger?: {
    warn: (...args: unknown[]) => void;
  };
};

export function createSceneAssistedPromptService(deps: SceneAssistDeps) {
  return async (input: ResolveScenePromptInput): Promise<string> => {
    const userPrompt = input.prompt.trim();
    if (!input.enableSceneAssist) {
      return userPrompt;
    }

    const primarySceneId = String(input.primarySceneId || '').trim();
    const subSceneId = String(input.subSceneId || '').trim();
    const loaded = await deps.loadScenePrompt({
      primarySceneId,
      subSceneId,
    });

    if (!loaded.presetPrompt) {
      deps.logger?.warn(
        `[scene-assist] scene prompt missing, fallback to user prompt: ${loaded.sourcePath}`,
      );
      return userPrompt;
    }

    try {
      return await deps.mergePrompt({
        presetPrompt: loaded.presetPrompt,
        userPrompt,
        primarySceneId,
        subSceneId,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      throw new Error(`prompt merge failed: ${reason}`);
    }
  };
}
