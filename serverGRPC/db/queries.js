// db/queries.js
const { db } = require('./index');

// Insertar archivo
const insertFileStmt = db.prepare(
  'INSERT INTO files (id, filename, upload_time, version, size) VALUES (?, ?, ?, ?, ?)'
);

// Actualizar archivo
const updateFileStmt = db.prepare(
  'UPDATE files SET upload_time = ?, size = ? WHERE id = ?'
);

// Insertar chunk (usado con INSERT OR IGNORE)
const insertChunkStmt = db.prepare(
  'INSERT OR IGNORE INTO chunks (id, file_id, chunk_index, size, object_name, node_index) VALUES (?, ?, ?, ?, ?, ?)'
);

// Consultas varias necesarias
const getFileById = db.prepare('SELECT * FROM files WHERE id = ?');
const getFileByName = db.prepare(
  'SELECT * FROM files WHERE filename = ? ORDER BY upload_time DESC LIMIT 1'
);

const getChunksOrdered = db.prepare(
  'SELECT DISTINCT chunk_index, object_name FROM chunks WHERE file_id = ? ORDER BY chunk_index ASC'
);

const getChunkReplicas = db.prepare(
  'SELECT node_index FROM chunks WHERE file_id = ? AND chunk_index = ? ORDER BY node_index ASC'
);

const countChunks = db.prepare(
  'SELECT COUNT(DISTINCT chunk_index) AS cnt FROM chunks WHERE file_id = ?'
);

// Health/repair queries
const getChunksByNode = db.prepare(
  'SELECT file_id, chunk_index, object_name, size FROM chunks WHERE node_index = ?'
);

const deleteChunkRow = db.prepare(
  'DELETE FROM chunks WHERE file_id = ? AND chunk_index = ? AND node_index = ?'
);

const getReplicaNodes = db.prepare(
  'SELECT node_index FROM chunks WHERE file_id = ? AND chunk_index = ?'
);

const countChunksGroup = db.prepare(
  'SELECT node_index, COUNT(*) as cnt FROM chunks GROUP BY node_index'
);

const countAllReplicaRows = db.prepare(
  'SELECT COUNT(*) as total FROM chunks'
);

const getCandidateChunksRebalance = db.prepare(`
    SELECT DISTINCT file_id, chunk_index, object_name, size
    FROM chunks
    WHERE (file_id, chunk_index) NOT IN (
      SELECT file_id, chunk_index FROM chunks WHERE node_index = ?
    )
    ORDER BY file_id, chunk_index
`);

const getAllChunksGrouped = db.prepare(
  'SELECT file_id, chunk_index, object_name FROM chunks GROUP BY file_id, chunk_index'
);

const loadNodesByReplicaCount = db.prepare(
  'SELECT node_index, COUNT(*) as cnt FROM chunks GROUP BY node_index ORDER BY cnt DESC'
);

module.exports = {
  db,
  insertFileStmt,
  updateFileStmt,
  insertChunkStmt,
  getFileById,
  getFileByName,
  getChunksOrdered,
  getChunkReplicas,
  countChunks,
  getChunksByNode,
  deleteChunkRow,
  getReplicaNodes,
  countChunksGroup,
  countAllReplicaRows,
  getCandidateChunksRebalance,
  getAllChunksGrouped,
  loadNodesByReplicaCount
};
