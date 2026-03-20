import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REQUIRED_SECTIONS = [
  '核心用途：',
  '主体优先级：',
  '画面组织：',
  '镜头与光影：',
  '传播/版式约束：',
  '禁止偏移：',
];

async function listPromptFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return listPromptFiles(fullPath);
      }
      return entry.name.endsWith('.md') ? [fullPath] : [];
    }),
  );

  return files.flat();
}

describe('scene prompt preset files', () => {
  it('ensures all scene prompt files follow the unified structure', async () => {
    const promptFiles = await listPromptFiles(path.resolve('server/prompts'));

    expect(promptFiles.length).toBeGreaterThan(0);

    for (const filePath of promptFiles) {
      const content = await readFile(filePath, 'utf8');
      for (const section of REQUIRED_SECTIONS) {
        expect(content, `missing ${section} in ${filePath}`).toContain(section);
      }
    }
  });
});
