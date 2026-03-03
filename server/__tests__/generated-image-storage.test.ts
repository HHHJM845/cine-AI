import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createGeneratedImageStorage } from '../services/generated-image-storage';

let root = '';

afterEach(() => {
  if (root) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('generated image storage', () => {
  it('writes base64 image to dated path and returns relative/public urls', () => {
    root = path.join(os.tmpdir(), `cine-storage-${Date.now()}`);
    const storage = createGeneratedImageStorage(root);

    const output = storage.save({
      batchId: 'batch_1',
      position: 2,
      mimeType: 'image/png',
      dataBase64: Buffer.from([1, 2, 3]).toString('base64'),
      now: new Date('2026-03-02T10:00:00Z'),
    });

    expect(output.relativePath).toContain('2026/03/02');
    expect(output.publicUrl.startsWith('/generated/')).toBe(true);
    expect(fs.existsSync(path.join(root, output.relativePath))).toBe(true);
  });

  it('deletes file by relative path and is idempotent', () => {
    root = path.join(os.tmpdir(), `cine-storage-${Date.now()}-remove`);
    const storage = createGeneratedImageStorage(root);
    const output = storage.save({
      batchId: 'batch_2',
      position: 1,
      mimeType: 'image/png',
      dataBase64: Buffer.from([9, 8, 7]).toString('base64'),
      now: new Date('2026-03-03T00:00:00Z'),
    });

    expect(storage.remove(output.relativePath)).toBe(true);
    expect(storage.remove(output.relativePath)).toBe(false);
  });
});
