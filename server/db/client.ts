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
  `);

  return db;
}
