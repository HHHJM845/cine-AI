import { readFile } from 'node:fs/promises';
import path from 'node:path';

type ScenePromptLoaderInput = {
  baseDir: string;
};

type LoadScenePromptInput = {
  primarySceneId: string;
  subSceneId: string;
};

type LoadScenePromptOutput = {
  presetPrompt: string | null;
  sourcePath: string;
};

export function createScenePromptLoader(input: ScenePromptLoaderInput) {
  const baseDir = path.resolve(input.baseDir);

  return async (scene: LoadScenePromptInput): Promise<LoadScenePromptOutput> => {
    const sourcePath = path.resolve(baseDir, scene.primarySceneId, `${scene.subSceneId}.md`);
    try {
      const content = await readFile(sourcePath, 'utf8');
      const presetPrompt = content.trim();
      return {
        presetPrompt: presetPrompt ? presetPrompt : null,
        sourcePath,
      };
    } catch {
      return {
        presetPrompt: null,
        sourcePath,
      };
    }
  };
}
