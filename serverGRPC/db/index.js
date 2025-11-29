// db/index.js
require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

// DB
const dbPath = process.env.METADATA_DB || 'metadata.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Schema
db.exec(`
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  upload_time TEXT,
  version INTEGER DEFAULT 1,
  size INTEGER
);
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  file_id TEXT,
  chunk_index INTEGER,
  size INTEGER,
  object_name TEXT,
  node_index INTEGER,
  UNIQUE(file_id, chunk_index, node_index),
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);
`);

module.exports = { db };
