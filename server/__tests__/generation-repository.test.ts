import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDb } from '../db/client';
import { createGenerationRepository } from '../repositories/generation-repository';

let dbPath = '';

afterEach(() => {
  if (dbPath) {
    try {
      fs.rmSync(dbPath, { force: true });
      fs.rmSync(`${dbPath}-wal`, { force: true });
      fs.rmSync(`${dbPath}-shm`, { force: true });
    } catch {
      // ignore cleanup errors in tests
    }
  }
});

describe('generation repository', () => {
  it('persists and queries batch with items', () => {
    dbPath = path.join(os.tmpdir(), `cine-${Date.now()}.db`);
    const db = createDb(dbPath);
    const repo = createGenerationRepository(db);

    repo.insertBatch({
      id: 'batch_1',
      prompt: 'x',
      aspectRatio: '16:9',
      requestedCount: 2,
      sceneAssistUsed: true,
      model: 'gemini-3-pro-image-preview',
      status: 'partial_failed',
      createdAt: 1,
    });

    repo.insertItem({
      id: 'item_1',
      batchId: 'batch_1',
      position: 1,
      status: 'success',
      imagePath: '2026/03/02/a.png',
      errorMessage: null,
      createdAt: 1,
    });
    repo.insertItem({
      id: 'item_2',
      batchId: 'batch_1',
      position: 2,
      status: 'failed',
      imagePath: null,
      errorMessage: 'model returned no image',
      createdAt: 1,
    });

    const output = repo.listBatches({ limit: 20 });

    expect(output).toHaveLength(1);
    expect(output[0].sceneAssistUsed).toBe(true);
    expect(output[0].items).toHaveLength(2);
    expect(output[0].items[0].imageUrl).toBe('/generated/2026/03/02/a.png');
    db.close();
  });

  it('removes items and prunes empty batches', () => {
    dbPath = path.join(os.tmpdir(), `cine-${Date.now()}-remove.db`);
    const db = createDb(dbPath);
    const repo = createGenerationRepository(db);

    repo.insertBatch({
      id: 'batch_1',
      prompt: 'x',
      aspectRatio: '16:9',
      requestedCount: 1,
      sceneAssistUsed: false,
      model: 'gemini-3-pro-image-preview',
      status: 'completed',
      createdAt: 1,
    });
    repo.insertItem({
      id: 'item_1',
      batchId: 'batch_1',
      position: 1,
      status: 'success',
      imagePath: '2026/03/03/remove-me.png',
      errorMessage: null,
      createdAt: 1,
    });

    const result = repo.removeItems(['item_1']);

    expect(result.deletedItemIds).toEqual(['item_1']);
    expect(result.imagePaths).toEqual(['2026/03/03/remove-me.png']);
    expect(result.deletedBatchIds).toEqual(['batch_1']);
    expect(result.failedItemIds).toEqual([]);
    expect(repo.listBatches({ limit: 20 })).toHaveLength(0);
    db.close();
  });

  it('upserts and lists batch feedback', () => {
    dbPath = path.join(os.tmpdir(), `cine-${Date.now()}-feedback.db`);
    const db = createDb(dbPath);
    const repo = createGenerationRepository(db);

    repo.insertBatch({
      id: 'batch_1',
      prompt: 'x',
      aspectRatio: '16:9',
      requestedCount: 1,
      sceneAssistUsed: false,
      model: 'gemini-3-pro-image-preview',
      status: 'completed',
      createdAt: 1,
    });

    const created = repo.upsertBatchFeedback({
      batchId: 'batch_1',
      vote: 'down',
      downvoteReasons: ['构图问题', '风格不符'],
      comment: '主体偏移',
      now: 2,
    });

    expect(created).not.toBeNull();
    const output = repo.listBatchFeedbacks({ batchIds: ['batch_1'] });
    expect(output).toHaveLength(1);
    expect(output[0].batchId).toBe('batch_1');
    expect(output[0].vote).toBe('down');
    expect(output[0].downvoteReasons).toEqual(['构图问题', '风格不符']);
    expect(output[0].comment).toBe('主体偏移');
    expect(output[0].createdAt).toBe(2);
    expect(output[0].updatedAt).toBe(2);
    db.close();
  });

  it('overwrites existing feedback for same batch and normalizes non-down reasons', () => {
    dbPath = path.join(os.tmpdir(), `cine-${Date.now()}-feedback-overwrite.db`);
    const db = createDb(dbPath);
    const repo = createGenerationRepository(db);

    repo.insertBatch({
      id: 'batch_2',
      prompt: 'x',
      aspectRatio: '16:9',
      requestedCount: 1,
      sceneAssistUsed: false,
      model: 'gemini-3-pro-image-preview',
      status: 'completed',
      createdAt: 1,
    });

    repo.upsertBatchFeedback({
      batchId: 'batch_2',
      vote: 'down',
      downvoteReasons: ['主体错误'],
      comment: '第一次提交',
      now: 3,
    });

    const updated = repo.upsertBatchFeedback({
      batchId: 'batch_2',
      vote: 'up',
      downvoteReasons: ['这条应被清空'],
      comment: '第二次提交',
      now: 5,
    });

    expect(updated).not.toBeNull();
    expect(updated?.createdAt).toBe(3);
    expect(updated?.updatedAt).toBe(5);
    expect(updated?.vote).toBe('up');
    expect(updated?.downvoteReasons).toEqual([]);
    expect(updated?.comment).toBe('第二次提交');
    db.close();
  });
});
