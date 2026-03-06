import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export function createDb(filePath: string) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS generation_batches (
      id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      aspect_ratio TEXT NOT NULL,
      requested_count INTEGER NOT NULL,
      scene_assist_used INTEGER NOT NULL DEFAULT 0,
      model TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generation_items (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      status TEXT NOT NULL,
      image_path TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES generation_batches(id)
    );

    CREATE TABLE IF NOT EXISTS generation_batch_feedback (
      batch_id TEXT PRIMARY KEY,
      vote TEXT,
      downvote_reasons TEXT NOT NULL DEFAULT '[]',
      comment TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES generation_batches(id)
    );
  `);

  const batchColumns = db.prepare("PRAGMA table_info(generation_batches)").all() as Array<{ name: string }>;
  if (!batchColumns.some((column) => column.name === 'scene_assist_used')) {
    db.exec('ALTER TABLE generation_batches ADD COLUMN scene_assist_used INTEGER NOT NULL DEFAULT 0');
  }

  return db;
}
