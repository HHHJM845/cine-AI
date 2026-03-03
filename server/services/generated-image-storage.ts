import fs from 'node:fs';
import path from 'node:path';

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export type SaveGeneratedImageInput = {
  batchId: string;
  position: number;
  mimeType: string;
  dataBase64: string;
  now?: Date;
};

export type SaveGeneratedImageOutput = {
  relativePath: string;
  publicUrl: string;
};

export function createGeneratedImageStorage(rootDir: string) {
  return {
    save(input: SaveGeneratedImageInput): SaveGeneratedImageOutput {
      const now = input.now ?? new Date();
      const yyyy = String(now.getUTCFullYear());
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(now.getUTCDate()).padStart(2, '0');
      const ext = EXTENSION_BY_MIME_TYPE[input.mimeType] ?? 'png';
      const relativeDir = path.join(yyyy, mm, dd);
      const fileName = `${input.batchId}-${input.position}.${ext}`;
      const relativePath = path.join(relativeDir, fileName).replaceAll('\\', '/');
      const absolutePath = path.join(rootDir, relativePath);

      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, Buffer.from(input.dataBase64, 'base64'));

      return {
        relativePath,
        publicUrl: `/generated/${relativePath}`,
      };
    },
    remove(relativePath: string): boolean {
      const normalizedPath = relativePath.replaceAll('/', path.sep);
      const absolutePath = path.join(rootDir, normalizedPath);
      if (!fs.existsSync(absolutePath)) {
        return false;
      }
      fs.rmSync(absolutePath, { force: true });
      return true;
    },
  };
}
