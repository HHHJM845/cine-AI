import type { GenerationBatch, GenerationBatchStatus, GenerationItemStatus } from '../types';

type BatchRow = {
  id: string;
  prompt: string;
  aspect_ratio: string;
  requested_count: number;
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

function buildInPlaceholders(size: number): string {
  return Array.from({ length: size }).map(() => '?').join(', ');
}

type InsertBatchInput = {
  id: string;
  prompt: string;
  aspectRatio: string;
  requestedCount: number;
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

function toBatchDto(row: BatchRow, items: ItemRow[]): GenerationBatch {
  return {
    id: row.id,
    prompt: row.prompt,
    aspectRatio: row.aspect_ratio as GenerationBatch['aspectRatio'],
    requestedCount: row.requested_count,
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

export function createGenerationRepository(db: any) {
  const insertBatchStmt = db.prepare(
    'INSERT INTO generation_batches (id, prompt, aspect_ratio, requested_count, model, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const insertItemStmt = db.prepare(
    'INSERT INTO generation_items (id, batch_id, position, status, image_path, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const listBatchStmt = db.prepare('SELECT * FROM generation_batches ORDER BY created_at DESC LIMIT ?');
  const listItemsStmt = db.prepare('SELECT * FROM generation_items WHERE batch_id = ? ORDER BY position ASC');
  const countItemsByBatchStmt = db.prepare('SELECT COUNT(1) as count FROM generation_items WHERE batch_id = ?');
  const deleteBatchStmt = db.prepare('DELETE FROM generation_batches WHERE id = ?');
  const deleteItemsStmt = db.prepare('DELETE FROM generation_items WHERE batch_id = ?');

  return {
    insertBatch(input: InsertBatchInput) {
      insertBatchStmt.run(input.id, input.prompt, input.aspectRatio, input.requestedCount, input.model, input.status, input.createdAt);
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
  };
}
