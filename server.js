// server.js
require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const Minio = require('minio');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const PROTO_PATH = path.resolve(__dirname, './protos/storage.proto');
const PROTO_OPTIONS = {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
};
const packageDefinition = protoLoader.loadSync(PROTO_PATH, PROTO_OPTIONS);
const storageProto = grpc.loadPackageDefinition(packageDefinition).filestorage;

// Config
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE_BYTES || (4 * 1024 * 1024)); // 4 MiB por defecto
const REPLICATION_FACTOR = parseInt(process.env.REPLICATION_FACTOR || 2); // default replica count
const BUCKET = process.env.BUCKET_NAME || 'files';

// Setup MinIO clients from env variables: MINIO_ENDPOINT_1 ... MINIO_ENDPOINT_4 (host:port)
const minioEndpoints = [];
for (let i = 1; i <= 4; i++) {
  const env = process.env[`MINIO_ENDPOINT_${i}`];
  if (env) minioEndpoints.push(env);
}
if (minioEndpoints.length === 0) {
  console.error('No MinIO endpoints configured. Set MINIO_ENDPOINT_1 ... MINIO_ENDPOINT_4 in .env');
  process.exit(1);
}

const minioClients = minioEndpoints.map((ep) => {
  const [host, port] = ep.split(':');
  return new Minio.Client({
    endPoint: host,
    port: parseInt(port, 10),
    useSSL: false,
    accessKey: process.env.MINIO_ROOT_USER,
    secretKey: process.env.MINIO_ROOT_PASSWORD
  });
});

// SQLite DB (file: metadata.db)
const db = new Database(process.env.METADATA_DB || 'metadata.db');
db.pragma('journal_mode = WAL');

// Create tables if not exist
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
  FOREIGN KEY(file_id) REFERENCES files(id)
);
`);

// Helpers
async function ensureBuckets() {
  for (let i = 0; i < minioClients.length; i++) {
    const client = minioClients[i];
    try {
      const exists = await client.bucketExists(BUCKET);
      if (!exists) {
        await client.makeBucket(BUCKET);
        console.log(`Bucket "${BUCKET}" created on node ${i}`);
      }
    } catch (err) {
      console.error(`Error ensuring bucket on node ${i}:`, err.message || err);
      throw err;
    }
  }
}

function pickNodesForChunk(chunkIndex) {
  // primaryNode: round-robin; then next nodes for replication
  const primary = chunkIndex % minioClients.length;
  const nodes = [];
  for (let r = 0; r < Math.min(REPLICATION_FACTOR, minioClients.length); r++) {
    nodes.push((primary + r) % minioClients.length);
  }
  return nodes;
}

// Upload handler: stream from client -> server buffers -> split into chunk-size -> upload each chunk replicated
async function uploadFile(call, callback) {
  const fileId = uuidv4();           // id permanente para toda la subida
  let filename = null;
  let totalSize = 0;
  let bufferAcc = Buffer.alloc(0);
  let chunkIndex = 0;
  let fileInserted = false;

  // Prepared statements (reutilizables)
  const insertFileStmt = db.prepare('INSERT INTO files (id, filename, upload_time, version, size) VALUES (?, ?, ?, ?, ?)');
  const updateFileStmt = db.prepare('UPDATE files SET upload_time = ?, size = ? WHERE id = ?');

  call.on('data', (req) => {
    // Obtain filename from the first chunk that includes fileName
    if (!filename && req.fileName) filename = req.fileName;

    // If we know filename and haven't inserted the file row yet, insert it now.
    if (filename && !fileInserted) {
      const now = new Date().toISOString();
      // Insert with size 0 for now; lo actualizaremos al final
      insertFileStmt.run(fileId, filename, now, 1, 0);
      fileInserted = true;
      // (opcional) debug
      console.log(`Inserted file metadata early: id=${fileId} filename=${filename}`);
    }

    const incoming = Buffer.isBuffer(req.fileData) ? req.fileData : Buffer.from(req.fileData || []);
    bufferAcc = Buffer.concat([bufferAcc, incoming]);
    totalSize += incoming.length;

    // While we have at least CHUNK_SIZE, slice and upload one chunk
    while (bufferAcc.length >= CHUNK_SIZE) {
      const chunkBuf = bufferAcc.slice(0, CHUNK_SIZE);
      bufferAcc = bufferAcc.slice(CHUNK_SIZE);
      // ensure uploadChunkAndRecord runs with the fileId that already exists in files table
      uploadChunkAndRecord(fileId, filename, chunkIndex, chunkBuf)
        .catch(err => console.error('Error uploading chunk', err));
      chunkIndex++;
    }
  });

  call.on('end', async () => {
    try {
      // If filename was never provided by client, create a placeholder name
      if (!filename) {
        filename = `unnamed_${fileId}`;
      }

      // Ensure file row exists (corner case: client sent no metadata until end)
      if (!fileInserted) {
        const now = new Date().toISOString();
        insertFileStmt.run(fileId, filename, now, 1, 0);
        fileInserted = true;
        console.log(`Inserted file metadata at end: id=${fileId} filename=${filename}`);
      }

      // Remaining data < CHUNK_SIZE -> upload as last chunk (if any)
      if (bufferAcc.length > 0) {
        await uploadChunkAndRecord(fileId, filename, chunkIndex, bufferAcc);
        chunkIndex++;
      }

      // Update file metadata with real size and time
      const nowFinal = new Date().toISOString();
      updateFileStmt.run(nowFinal, totalSize, fileId);

      callback(null, { message: `Uploaded ${filename} as id=${fileId}`, fileId });
    } catch (err) {
      console.error('Error finalizing upload:', err);
      callback(err);
    }
  });

  call.on('error', (err) => {
    console.error('Upload stream error:', err);
    callback(err);
  });
}

async function uploadChunkAndRecord(fileId, filename, chunkIndex, buffer) {
  const objectName = `${fileId}/part_${chunkIndex}`;
  const nodes = pickNodesForChunk(chunkIndex);

  // Upload to all selected nodes (replication)
  const uploadPromises = nodes.map(async (nodeIdx) => {
    const client = minioClients[nodeIdx];
    // putObject can accept Buffer
    await client.putObject(BUCKET, objectName, buffer);
    return nodeIdx;
  });

  const nodeIndexes = await Promise.all(uploadPromises);

  // Record chunk rows for each replica (so you know where to read from)
  const insert = db.prepare('INSERT INTO chunks (id, file_id, chunk_index, size, object_name, node_index) VALUES (?, ?, ?, ?, ?, ?)');
  for (const nodeIdx of nodeIndexes) {
    insert.run(uuidv4(), fileId, chunkIndex, buffer.length, objectName, nodeIdx);
  }
}

// Download handler: given fileName or fileId, stream all chunks in order to client
async function downloadFile(call) {
  // Allow client to pass either fileName or fileId (if they passed fileName earlier)
  const fileNameReq = call.request.fileName || null;
  const fileIdReq = call.request.fileId || null;

  console.log(`Download request for fileName=${fileNameReq} fileId=${fileIdReq}`);

  // Resolve file id
  const fileRow = fileIdReq
    ? db.prepare('SELECT * FROM files WHERE id = ?').get(fileIdReq)
    : db.prepare('SELECT * FROM files WHERE filename = ? ORDER BY upload_time DESC LIMIT 1').get(fileNameReq);

  if (!fileRow) {
    call.emit('error', { code: grpc.status.NOT_FOUND, message: 'File not found' });
    return;
  }
  const fileId = fileRow.id;

  // Get distinct chunk indices sorted
  const chunks = db.prepare('SELECT DISTINCT chunk_index, object_name FROM chunks WHERE file_id = ? ORDER BY chunk_index ASC').all(fileId);

  try {
    for (const chunkInfo of chunks) {
      // For each chunk, find any replica entry to read from (prefer earlier node index)
      const replica = db.prepare('SELECT * FROM chunks WHERE file_id = ? AND chunk_index = ? ORDER BY node_index ASC LIMIT 1')
        .get(fileId, chunkInfo.chunk_index);

      if (!replica) throw new Error(`Missing chunk metadata for index ${chunkInfo.chunk_index}`);

      const nodeIdx = replica.node_index;
      const client = minioClients[nodeIdx];

      // getObject returns a stream
      const stream = await client.getObject(BUCKET, replica.object_name);
      await new Promise((resolve, reject) => {
        stream.on('data', (buf) => {
          call.write({ fileData: buf });
        });
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    }
    call.end();
  } catch (err) {
    console.error('Error during download:', err);
    call.emit('error', err);
  }
}

// GetMetadata RPC
function getMetadata(call, callback) {
  const fileName = call.request.fileName;
  const fileRow = db.prepare('SELECT * FROM files WHERE filename = ? ORDER BY upload_time DESC LIMIT 1').get(fileName);
  if (!fileRow) return callback(null, { fileName: '', uploadTime: '', version: '', size: '0' });

  // Get chunk count
  const row = db.prepare('SELECT COUNT(DISTINCT chunk_index) AS cnt FROM chunks WHERE file_id = ?').get(fileRow.id);
  const chunkCount = row ? row.cnt : 0;
  callback(null, {
    fileName: fileRow.filename,
    uploadTime: fileRow.upload_time,
    version: String(fileRow.version),
    size: String(fileRow.size),
    // You can extend proto to include chunkCount if desired
  });
}

async function main() {
  await ensureBuckets();
  const server = new grpc.Server();
  server.addService(storageProto.FileStorage.service, { uploadFile, downloadFile, GetMetadata: getMetadata });
  const addr = process.env.GRPC_BIND || '0.0.0.0:5000';
  server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error('gRPC bind error:', err);
      process.exit(1);
    }
    console.log(`gRPC server running on ${addr}`);
    server.start();
  });
}

main().catch(err => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
