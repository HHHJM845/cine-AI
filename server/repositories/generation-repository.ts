import type { GenerationBatch, GenerationBatchStatus, GenerationItemStatus } from '../types';

type BatchFeedbackVote = 'up' | 'down' | null;

type GenerationBatchFeedback = {
  batchId: string;
  vote: BatchFeedbackVote;
  downvoteReasons: string[];
  comment: string;
  createdAt: number;
  updatedAt: number;
};

type BatchRow = {
  id: string;
  prompt: string;
  aspect_ratio: string;
  requested_count: number;
  scene_assist_used: number;
  model: string;
  status: GenerationBatchStatus;
  created_at: number;
};

type ItemRow = {
  id: string;
  batch_id: string;
  position: number;
  status: GenerationItemStatus;
  image_path: string | null;
  error_message: string | null;
  created_at: number;
};

type RemovableItemRow = {
  id: string;
  batch_id: string;
  image_path: string | null;
};

type BatchFeedbackRow = {
  batch_id: string;
  vote: BatchFeedbackVote;
  downvote_reasons: string;
  comment: string;
  created_at: number;
  updated_at: number;
};

function buildInPlaceholders(size: number): string {
  return Array.from({ length: size }).map(() => '?').join(', ');
}

type InsertBatchInput = {
  id: string;
  prompt: string;
  aspectRatio: string;
  requestedCount: number;
  sceneAssistUsed: boolean;
  model: string;
  status: GenerationBatchStatus;
  createdAt: number;
};

type InsertItemInput = {
  id: string;
  batchId: string;
  position: number;
  status: GenerationItemStatus;
  imagePath: string | null;
  errorMessage: string | null;
  createdAt: number;
};

type UpsertBatchFeedbackInput = {
  batchId: string;
  vote: BatchFeedbackVote;
  downvoteReasons: string[];
  comment: string;
  now?: number;
};

function normalizeReasons(vote: BatchFeedbackVote, reasons: string[]): string[] {
  if (vote !== 'down') {
    return [];
  }
  return reasons.map((reason) => reason.trim()).filter((reason) => reason.length > 0);
}

function parseReasons(rawReasons: string): string[] {
  try {
    const parsed = JSON.parse(rawReasons);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function toBatchDto(row: BatchRow, items: ItemRow[]): GenerationBatch {
  return {
    id: row.id,
    prompt: row.prompt,
    aspectRatio: row.aspect_ratio as GenerationBatch['aspectRatio'],
    requestedCount: row.requested_count,
    sceneAssistUsed: Boolean(row.scene_assist_used),
    model: row.model,
    status: row.status,
    createdAt: row.created_at,
    items: items.map((item) => ({
      id: item.id,
      position: item.position,
      status: item.status,
      imageUrl: item.image_path ? `/generated/${item.image_path}` : undefined,
      errorMessage: item.error_message ?? undefined,
    })),
  };
}

function toBatchFeedbackDto(row: BatchFeedbackRow): GenerationBatchFeedback {
  return {
    batchId: row.batch_id,
    vote: row.vote,
    downvoteReasons: parseReasons(row.downvote_reasons),
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createGenerationRepository(db: any) {
  const insertBatchStmt = db.prepare(
    'INSERT INTO generation_batches (id, prompt, aspect_ratio, requested_count, scene_assist_used, model, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const insertItemStmt = db.prepare(
    'INSERT INTO generation_items (id, batch_id, position, status, image_path, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const listBatchStmt = db.prepare('SELECT * FROM generation_batches ORDER BY created_at DESC LIMIT ?');
  const listItemsStmt = db.prepare('SELECT * FROM generation_items WHERE batch_id = ? ORDER BY position ASC');
  const countItemsByBatchStmt = db.prepare('SELECT COUNT(1) as count FROM generation_items WHERE batch_id = ?');
  const deleteBatchStmt = db.prepare('DELETE FROM generation_batches WHERE id = ?');
  const deleteItemsStmt = db.prepare('DELETE FROM generation_items WHERE batch_id = ?');
  const findBatchIdStmt = db.prepare('SELECT id FROM generation_batches WHERE id = ?');
  const upsertBatchFeedbackStmt = db.prepare(
    `
      INSERT INTO generation_batch_feedback (batch_id, vote, downvote_reasons, comment, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(batch_id) DO UPDATE SET
        vote = excluded.vote,
        downvote_reasons = excluded.downvote_reasons,
        comment = excluded.comment,
        updated_at = excluded.updated_at
    `,
  );
  const findBatchFeedbackStmt = db.prepare('SELECT * FROM generation_batch_feedback WHERE batch_id = ?');

  return {
    insertBatch(input: InsertBatchInput) {
      insertBatchStmt.run(
        input.id,
        input.prompt,
        input.aspectRatio,
        input.requestedCount,
        input.sceneAssistUsed ? 1 : 0,
        input.model,
        input.status,
        input.createdAt,
      );
    },
    insertItem(input: InsertItemInput) {
      insertItemStmt.run(input.id, input.batchId, input.position, input.status, input.imagePath, input.errorMessage, input.createdAt);
    },
    removeBatch(batchId: string) {
      deleteItemsStmt.run(batchId);
      deleteBatchStmt.run(batchId);
    },
    removeItems(itemIds: string[]) {
      const normalizedIds = Array.from(new Set(itemIds.map((id) => id.trim()).filter((id) => id.length > 0)));
      if (normalizedIds.length === 0) {
        return {
          deletedItemIds: [],
          failedItemIds: [],
          imagePaths: [],
          deletedBatchIds: [],
        };
      }

      const selectStmt = db.prepare(
        `SELECT id, batch_id, image_path FROM generation_items WHERE id IN (${buildInPlaceholders(normalizedIds.length)})`,
      );
      const rows = selectStmt.all(...normalizedIds) as RemovableItemRow[];
      const foundIdSet = new Set(rows.map((row) => row.id));
      const deletedItemIds = rows.map((row) => row.id);
      const failedItemIds = normalizedIds.filter((id) => !foundIdSet.has(id));
      const imagePaths = rows.map((row) => row.image_path).filter((path): path is string => Boolean(path));
      const impactedBatchIds = Array.from(new Set(rows.map((row) => row.batch_id)));
      const deletedBatchIds: string[] = [];

      if (deletedItemIds.length === 0) {
        return {
          deletedItemIds,
          failedItemIds,
          imagePaths,
          deletedBatchIds,
        };
      }

      const deleteByIdsStmt = db.prepare(
        `DELETE FROM generation_items WHERE id IN (${buildInPlaceholders(deletedItemIds.length)})`,
      );
      const runDeleteTransaction = db.transaction(() => {
        deleteByIdsStmt.run(...deletedItemIds);

        for (const batchId of impactedBatchIds) {
          const countRow = countItemsByBatchStmt.get(batchId) as { count: number };
          if (countRow.count === 0) {
            deleteBatchStmt.run(batchId);
            deletedBatchIds.push(batchId);
          }
        }
      });
      runDeleteTransaction();

      return {
        deletedItemIds,
        failedItemIds,
        imagePaths,
        deletedBatchIds,
      };
    },
    listBatches(input: { limit: number }): GenerationBatch[] {
      const rows = listBatchStmt.all(input.limit) as BatchRow[];
      return rows.map((row) => {
        const items = listItemsStmt.all(row.id) as ItemRow[];
        return toBatchDto(row, items);
      });
    },
    upsertBatchFeedback(input: UpsertBatchFeedbackInput): GenerationBatchFeedback | null {
      const batchExists = Boolean(findBatchIdStmt.get(input.batchId));
      if (!batchExists) {
        return null;
      }

      const now = Number.isFinite(input.now) ? Number(input.now) : Date.now();
      const normalizedVote = input.vote === 'up' || input.vote === 'down' ? input.vote : null;
      const reasons = normalizeReasons(normalizedVote, input.downvoteReasons);
      const reasonJson = JSON.stringify(reasons);
      upsertBatchFeedbackStmt.run(input.batchId, normalizedVote, reasonJson, input.comment, now, now);
      const row = findBatchFeedbackStmt.get(input.batchId) as BatchFeedbackRow | undefined;
      if (!row) {
        return null;
      }
      return toBatchFeedbackDto(row);
    },
    listBatchFeedbacks(input: { batchIds: string[] }): GenerationBatchFeedback[] {
      const batchIds = Array.from(new Set(input.batchIds.map((id) => id.trim()).filter((id) => id.length > 0)));
      if (batchIds.length === 0) {
        return [];
      }

      const listBatchFeedbacksStmt = db.prepare(
        `SELECT * FROM generation_batch_feedback WHERE batch_id IN (${buildInPlaceholders(batchIds.length)}) ORDER BY updated_at DESC`,
      );
      const rows = listBatchFeedbacksStmt.all(...batchIds) as BatchFeedbackRow[];
      return rows.map((row) => toBatchFeedbackDto(row));
    },
  };
}
