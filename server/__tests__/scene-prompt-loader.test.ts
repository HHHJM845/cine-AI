import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createScenePromptLoader } from '../services/scene-prompt-loader';

describe('createScenePromptLoader', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((dir) =>
        rm(dir, {
          recursive: true,
          force: true,
        }),
      ),
    );
    tempDirs.length = 0;
  });

  it('returns trimmed prompt text for existing scene file', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'scene-loader-'));
    tempDirs.push(baseDir);
    const sceneDir = path.join(baseDir, 'poster');
    await mkdir(sceneDir, { recursive: true });
    await writeFile(path.join(sceneDir, 'movie_poster.md'), '  cinematic scene prompt  \n', 'utf8');

    const loadScenePrompt = createScenePromptLoader({ baseDir });
    const output = await loadScenePrompt({
      primarySceneId: 'poster',
      subSceneId: 'movie_poster',
    });

    expect(output.presetPrompt).toBe('cinematic scene prompt');
  });

  it('returns null when file is missing', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'scene-loader-'));
    tempDirs.push(baseDir);

    const loadScenePrompt = createScenePromptLoader({ baseDir });
    const output = await loadScenePrompt({
      primarySceneId: 'poster',
      subSceneId: 'not_exists',
    });

    expect(output.presetPrompt).toBeNull();
  });

  it('returns null when file content is empty after trim', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'scene-loader-'));
    tempDirs.push(baseDir);
    const sceneDir = path.join(baseDir, 'poster');
    await mkdir(sceneDir, { recursive: true });
    await writeFile(path.join(sceneDir, 'movie_poster.md'), '   \n\t  ', 'utf8');

    const loadScenePrompt = createScenePromptLoader({ baseDir });
    const output = await loadScenePrompt({
      primarySceneId: 'poster',
      subSceneId: 'movie_poster',
    });

    expect(output.presetPrompt).toBeNull();
  });
});
