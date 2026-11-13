import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('echat_offline.db');

export const initOfflineDb = async () => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS offline_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      file_url TEXT,
      file_name TEXT,
      created_at TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_local_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offline_conversations (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT DEFAULT 'direct',
      last_message TEXT,
      last_message_at TEXT,
      updated_local_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0
    );
  `);
};

export default db;
