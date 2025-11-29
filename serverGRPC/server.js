require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Import MinIO module
const { BUCKET, minioClients, ensureBuckets } = require('./minio/clients');

// Import DB
const {
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
} = require('./db/queries');


const PROTO_PATH = path.resolve(__dirname, './protos/storage.proto');
const PROTO_OPTIONS = { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true };
const packageDefinition = protoLoader.loadSync(PROTO_PATH, PROTO_OPTIONS);
const storageProto = grpc.loadPackageDefinition(packageDefinition).filestorage;

// Config
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE_BYTES || (4 * 1024 * 1024)); // 4 MiB
const REPLICATION_FACTOR = Math.max(1, parseInt(process.env.REPLICATION_FACTOR || 2));

// Active node state
const nodeStatus = new Array(minioClients.length).fill(true); // assume up until health check says otherwise

// Choose nodes for chunk using active nodes list (round-robin on active nodes)
function pickNodesForChunkAdaptive(chunkIndex) {
  const active = [];
  for (let i = 0; i < minioClients.length; i++) {
    if (nodeStatus[i]) active.push(i);
  }
  if (active.length === 0) {
    // fallback: all nodes (they might be flapping)
    return [...Array(minioClients.length).keys()].slice(0, Math.min(REPLICATION_FACTOR, minioClients.length));
  }
  const nodes = [];
  const start = chunkIndex % active.length;
  for (let r = 0; r < Math.min(REPLICATION_FACTOR, active.length); r++) {
    nodes.push(active[(start + r) % active.length]);
  }
  return nodes;
}

// Upload handler
async function uploadFile(call, callback) {
  const fileId = uuidv4();
  let filename = null;
  let totalSize = 0;
  let bufferAcc = Buffer.alloc(0);
  let chunkIndex = 0;
  let fileInserted = false;

  const insertFileStmt = db.prepare('INSERT INTO files (id, filename, upload_time, version, size) VALUES (?, ?, ?, ?, ?)');
  const updateFileStmt = db.prepare('UPDATE files SET upload_time = ?, size = ? WHERE id = ?');

  call.on('data', (req) => {
    if (!filename && req.fileName) filename = req.fileName;
    if (filename && !fileInserted) {
      const now = new Date().toISOString();
      insertFileStmt.run(fileId, filename, now, 1, 0);
      fileInserted = true;
    }

    const incoming = Buffer.isBuffer(req.fileData) ? req.fileData : Buffer.from(req.fileData || []);
    bufferAcc = Buffer.concat([bufferAcc, incoming]);
    totalSize += incoming.length;

    while (bufferAcc.length >= CHUNK_SIZE) {
      const chunkBuf = bufferAcc.slice(0, CHUNK_SIZE);
      bufferAcc = bufferAcc.slice(CHUNK_SIZE);
      // fire-and-forget but log errors
      uploadChunkAndRecord(fileId, filename, chunkIndex, chunkBuf)
        .catch(err => console.error('Error uploading chunk', err && err.message ? err.message : err));
      chunkIndex++;
    }
  });

  call.on('end', async () => {
    try {
      if (!filename) filename = `unnamed_${fileId}`;
      if (!fileInserted) {
        const now = new Date().toISOString();
        insertFileStmt.run(fileId, filename, now, 1, 0);
        fileInserted = true;
      }
      if (bufferAcc.length > 0) {
        await uploadChunkAndRecord(fileId, filename, chunkIndex, bufferAcc);
        chunkIndex++;
      }
      const nowFinal = new Date().toISOString();
      updateFileStmt.run(nowFinal, totalSize, fileId);
      callback(null, { message: `Uploaded ${filename} as id=${fileId}`, fileId });
    } catch (err) {
      console.error('Error finalizing upload:', err && err.message ? err.message : err);
      callback(err);
    }
  });

  call.on('error', (err) => {
    console.error('Upload stream error:', err);
    callback(err);
  });
}

// Upload chunk: adaptive selection, upload to available nodes, insert unique rows
async function uploadChunkAndRecord(fileId, filename, chunkIndex, buffer) {
  const objectName = `${fileId}/part_${chunkIndex}`;
  // choose nodes using adaptive method
  let nodes = pickNodesForChunkAdaptive(chunkIndex);

  // if some chosen nodes are down (race), filter them out and pick extras if needed
  nodes = nodes.filter(n => nodeStatus[n]);
  // if we have fewer than R, choose extra healthy nodes not already picked
  if (nodes.length < Math.min(REPLICATION_FACTOR, minioClients.length)) {
    for (let i = 0; i < minioClients.length && nodes.length < Math.min(REPLICATION_FACTOR, minioClients.length); i++) {
      if (!nodes.includes(i) && nodeStatus[i]) nodes.push(i);
    }
  }

  const putPromises = nodes.map(async (nodeIdx) => {
    const client = minioClients[nodeIdx];
    // Always create a fresh Buffer for each put to avoid Node stream reuse issues
    const bufCopy = Buffer.from(buffer);
    await client.putObject(BUCKET, objectName, bufCopy);
    return nodeIdx;
  });

  let nodeIndexes;
  try {
    nodeIndexes = await Promise.all(putPromises);
  } catch (err) {
    // If some nodes failed, try to salvage by attempting individual retries to other healthy nodes
    console.warn('One or more puts failed, trying salvage strategy:', err && err.message ? err.message : err);
    nodeIndexes = [];
    for (let nodeIdx of nodes) {
      try {
        const client = minioClients[nodeIdx];
        const bufCopy = Buffer.from(buffer);
        await client.putObject(BUCKET, objectName, bufCopy);
        nodeIndexes.push(nodeIdx);
      } catch (e) {
        console.warn(`putObject failed on node ${nodeIdx}:`, e && e.message ? e.message : e);
      }
    }
    // if still empty -> throw
    if (nodeIndexes.length === 0) throw new Error('All putObject attempts failed for chunk ' + objectName);
  }

  // insert rows using INSERT OR IGNORE to prevent duplicates
  const insert = db.prepare('INSERT OR IGNORE INTO chunks (id, file_id, chunk_index, size, object_name, node_index) VALUES (?, ?, ?, ?, ?, ?)');
  const size = buffer.length;
  const insertMany = db.transaction((nodeIdxs) => {
    for (const nodeIdx of nodeIdxs) {
      insert.run(uuidv4(), fileId, chunkIndex, size, objectName, nodeIdx);
    }
  });
  insertMany(nodeIndexes);
}

// Download handler unchanged (choose first available replica)
async function downloadFile(call) {
  const fileNameReq = call.request.fileName || null;
  const fileIdReq = call.request.fileId || null;

  const fileRow = fileIdReq
    ? db.prepare('SELECT * FROM files WHERE id = ?').get(fileIdReq)
    : db.prepare('SELECT * FROM files WHERE filename = ? ORDER BY upload_time DESC LIMIT 1').get(fileNameReq);

  if (!fileRow) {
    call.emit('error', { code: grpc.status.NOT_FOUND, message: 'File not found' });
    return;
  }
  const fileId = fileRow.id;

  const chunks = db.prepare('SELECT DISTINCT chunk_index, object_name FROM chunks WHERE file_id = ? ORDER BY chunk_index ASC').all(fileId);

  try {
    for (const chunkInfo of chunks) {
      // find healthy replica
      const reps = db.prepare('SELECT node_index FROM chunks WHERE file_id = ? AND chunk_index = ? ORDER BY node_index ASC').all(fileId, chunkInfo.chunk_index);
      let streamed = false;
      for (const r of reps) {
        const nodeIdx = r.node_index;
        if (!nodeStatus[nodeIdx]) continue;
        try {
          const client = minioClients[nodeIdx];
          const stream = await client.getObject(BUCKET, chunkInfo.object_name);
          await new Promise((resolve, reject) => {
            stream.on('data', (buf) => call.write({ fileData: buf }));
            stream.on('end', resolve);
            stream.on('error', reject);
          });
          streamed = true;
          break;
        } catch (err) {
          console.warn(`Replica read failed on node ${nodeIdx} for ${chunkInfo.object_name}:`, err && err.message ? err.message : err);
          continue;
        }
      }
      if (!streamed) throw new Error(`No available replica to stream chunk ${chunkInfo.object_name}`);
    }
    call.end();
  } catch (err) {
    console.error('Error during download:', err && err.message ? err.message : err);
    call.emit('error', err);
  }
}

// GetMetadata
function getMetadata(call, callback) {
  const fileName = call.request.fileName;
  const fileRow = db.prepare('SELECT * FROM files WHERE filename = ? ORDER BY upload_time DESC LIMIT 1').get(fileName);
  if (!fileRow) return callback(null, { fileName: '', uploadTime: '', version: '', size: '0' });
  const row = db.prepare('SELECT COUNT(DISTINCT chunk_index) AS cnt FROM chunks WHERE file_id = ?').get(fileRow.id);
  callback(null, {
    fileName: fileRow.filename,
    uploadTime: fileRow.upload_time,
    version: String(fileRow.version),
    size: String(fileRow.size),
  });
}

// ---------------- Self-healing (OPCIÓN B) ----------------

const HEALTH_CHECK_INTERVAL_MS = parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '8000');
const REPAIR_RETRIES = 3;
const REPAIR_RETRY_DELAY_MS = 800;

// health check (prefer light check): stat a marker object if exists, otherwise listBuckets
async function pingNode(i) {
  const client = minioClients[i];
  // prefer statObject on bucket root marker (if not present, fallback to listBuckets)
  try {
    // quick: listBuckets (safe)
    await client.listBuckets();
    return true;
  } catch (err) {
    return false;
  }
}

// check object exists
async function objectExistsOnNode(nodeIdx, objectName) {
  try {
    await minioClients[nodeIdx].statObject(BUCKET, objectName);
    return true;
  } catch {
    return false;
  }
}

// copy object node->node, creating a fresh stream each attempt
async function copyObjectBetweenNodes(sourceNodeIdx, targetNodeIdx, objectName) {
  // Try multiple times (fresh stream each time)
  for (let attempt = 1; attempt <= REPAIR_RETRIES; attempt++) {
    try {
      // getObject returns a readable stream; we must pipe a fresh stream into putObject
      const srcClient = minioClients[sourceNodeIdx];
      const tgtClient = minioClients[targetNodeIdx];
      const stream = await srcClient.getObject(BUCKET, objectName); // fresh stream
      await tgtClient.putObject(BUCKET, objectName, stream);
      return;
    } catch (err) {
      console.warn(`copy attempt ${attempt} failed for ${objectName} from ${sourceNodeIdx} to ${targetNodeIdx}:`, err && err.message ? err.message : err);
      await new Promise(r => setTimeout(r, REPAIR_RETRY_DELAY_MS * attempt));
    }
  }
  throw new Error(`copyObjectBetweenNodes failed after ${REPAIR_RETRIES} attempts for ${objectName}`);
}

// When node goes down: re-replicate chunks that listed this node - and remove their old rows for the down node (OPCIÓN B)
async function handleNodeDown(nodeIdx) {
  console.log(`Node ${nodeIdx} marked DOWN -> re-replicating and cleaning metadata (Option B strategy)`);
  // Get distinct (file_id, chunk_index, object_name, size) that had this node
  const rows = db.prepare('SELECT file_id, chunk_index, object_name, size FROM chunks WHERE node_index = ?').all(nodeIdx);

  for (const r of rows) {
    const { file_id: fileId, chunk_index: chunkIndex, object_name: objectName, size } = r;

    // count healthy replicas (excluding the down node)
    const reps = db.prepare('SELECT node_index FROM chunks WHERE file_id = ? AND chunk_index = ?').all(fileId, chunkIndex);
    const healthy = [];
    for (const rep of reps) {
      if (rep.node_index === nodeIdx) continue;
      if (!nodeStatus[rep.node_index]) continue;
      try {
        if (await objectExistsOnNode(rep.node_index, objectName)) healthy.push(rep.node_index);
      } catch { /* ignore */ }
    }

    // If healthy replicas < R, create new replicas on other healthy nodes
    const need = Math.max(0, Math.min(REPLICATION_FACTOR, minioClients.length) - healthy.length);
    if (need <= 0) {
      // Still maintain cleanliness: remove rows that referenced the down node for this chunk
      try {
        db.prepare('DELETE FROM chunks WHERE file_id = ? AND chunk_index = ? AND node_index = ?').run(fileId, chunkIndex, nodeIdx);
      } catch (e) { console.warn('Failed to delete old chunk row:', e); }
      continue;
    }

    // pick candidate nodes (healthy and not already a replica)
    const existingNodes = new Set(reps.map(x => x.node_index));
    const candidates = [];
    for (let i = 0; i < minioClients.length && candidates.length < need; i++) {
      if (!nodeStatus[i]) continue;
      if (existingNodes.has(i)) continue;
      candidates.push(i);
    }

    if (candidates.length === 0) {
      console.error(`No candidate targets to maintain replication for ${objectName}`);
      // Still remove old rows for down node to avoid bloat
      try { db.prepare('DELETE FROM chunks WHERE file_id = ? AND chunk_index = ? AND node_index = ?').run(fileId, chunkIndex, nodeIdx); } catch(e){}
      continue;
    }

    // pick a source (any healthy replica)
    let source = healthy.length > 0 ? healthy[0] : null;
    if (!source) {
      // fallback: choose any replica that has object (including nodes that might be reported down — try to stat)
      for (const rep of reps) {
        try {
          if (await objectExistsOnNode(rep.node_index, objectName)) { source = rep.node_index; break; }
        } catch {}
      }
    }
    if (!source) {
      console.error(`No source found to repair ${objectName}. Data may be lost.`);
      // remove old row to avoid metadata bloat
      try { db.prepare('DELETE FROM chunks WHERE file_id = ? AND chunk_index = ? AND node_index = ?').run(fileId, chunkIndex, nodeIdx); } catch(e){}
      continue;
    }

    // perform copies to candidates
    for (const tgt of candidates) {
      try {
        await copyObjectBetweenNodes(source, tgt, objectName);
        // insert new replica row
        db.prepare('INSERT OR IGNORE INTO chunks (id, file_id, chunk_index, size, object_name, node_index) VALUES (?, ?, ?, ?, ?, ?)')
          .run(uuidv4(), fileId, chunkIndex, size, objectName, tgt);
        // after successful recovery, delete the old row pointing to down node
        try {
          db.prepare('DELETE FROM chunks WHERE file_id = ? AND chunk_index = ? AND node_index = ?').run(fileId, chunkIndex, nodeIdx);
        } catch (e) {
          console.warn('Failed to delete old row after repair:', e && e.message ? e.message : e);
        }
      } catch (err) {
        console.error(`Failed to copy ${objectName} -> node ${tgt}:`, err && err.message ? err.message : err);
      }
    }
  }

  console.log(`Re-replication for node ${nodeIdx} done.`);
}

// When node comes up: rebalance load to include the new node, and ensure EXACT replication factor by removing extras
async function handleNodeUp(nodeIdx) {
  console.log(`Node ${nodeIdx} marked UP -> running dynamic rebalance (Option B)`);

  // ensure bucket exists on node
  try {
    const client = minioClients[nodeIdx];
    const exists = await client.bucketExists(BUCKET);
    if (!exists) await client.makeBucket(BUCKET);
  } catch (e) {
    console.warn('Could not ensure bucket on recovered node:', e && e.message ? e.message : e);
  }

  // compute per-node replica counts
  const countsRows = db.prepare('SELECT node_index, COUNT(*) as cnt FROM chunks GROUP BY node_index').all();
  const countsMap = new Map();
  for (const cr of countsRows) countsMap.set(cr.node_index, cr.cnt);
  const totalReplicaRows = db.prepare('SELECT COUNT(*) as total FROM chunks').get().total || 0;
  const N = minioClients.length;
  const desiredPerNode = Math.ceil(totalReplicaRows / N);

  let currentCount = countsMap.get(nodeIdx) || 0;

  // Get candidate chunks that this node doesn't already have, order deterministic
  const candidateChunks = db.prepare(`
    SELECT DISTINCT file_id, chunk_index, object_name, size
    FROM chunks
    WHERE (file_id, chunk_index) NOT IN (
      SELECT file_id, chunk_index FROM chunks WHERE node_index = ?
    )
    ORDER BY file_id, chunk_index
  `).all(nodeIdx);

  for (const ch of candidateChunks) {
    if (currentCount >= desiredPerNode) break;
    const { file_id: fileId, chunk_index: chunkIndex, object_name: objectName, size } = ch;

    // find a source replica (healthy)
    const reps = db.prepare('SELECT node_index FROM chunks WHERE file_id = ? AND chunk_index = ?').all(fileId, chunkIndex);
    let source = null;
    for (const r of reps) {
      if (!nodeStatus[r.node_index]) continue;
      try {
        if (await objectExistsOnNode(r.node_index, objectName)) { source = r.node_index; break; }
      } catch {}
    }
    if (source === null) continue;

    try {
      await copyObjectBetweenNodes(source, nodeIdx, objectName);
      db.prepare('INSERT OR IGNORE INTO chunks (id, file_id, chunk_index, size, object_name, node_index) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), fileId, chunkIndex, size, objectName, nodeIdx);
      currentCount++;
    } catch (err) {
      console.warn(`Rebalance failed copying ${objectName} -> node ${nodeIdx}:`, err && err.message ? err.message : err);
    }
  }

  // Optional cleanup: ensure each chunk has exactly REPLICATION_FACTOR replicas.
  // For chunks that have more than REPLICATION_FACTOR replicas, remove surplus from most-loaded nodes.
  const chunksAll = db.prepare('SELECT file_id, chunk_index, object_name FROM chunks GROUP BY file_id, chunk_index').all();
  for (const ch of chunksAll) {
    const reps = db.prepare('SELECT node_index FROM chunks WHERE file_id = ? AND chunk_index = ?').all(ch.file_id, ch.chunk_index);
    if (reps.length <= Math.min(REPLICATION_FACTOR, minioClients.length)) continue;
    // compute nodes sorted by their load (descending) and try to remove from most loaded
    const nodesLoad = db.prepare('SELECT node_index, COUNT(*) as cnt FROM chunks GROUP BY node_index ORDER BY cnt DESC').all();
    for (const nl of nodesLoad) {
      if (reps.length <= Math.min(REPLICATION_FACTOR, minioClients.length)) break;
      const nodeToRemove = nl.node_index;
      // Don't remove if nodeToRemove is the only place the object exists physically
      try {
        if (await objectExistsOnNode(nodeToRemove, ch.object_name)) {
          // check if removing would drop below REPLICATION_FACTOR in healthy nodes
          // find remaining healthy replicas excluding this node
          const remaining = reps.filter(x => x.node_index !== nodeToRemove && nodeStatus[x.node_index]);
          if (remaining.length >= Math.min(REPLICATION_FACTOR, minioClients.length)) {
            // safe to remove metadata row (optionally also delete object physically to free space)
            db.prepare('DELETE FROM chunks WHERE file_id = ? AND chunk_index = ? AND node_index = ?')
              .run(ch.file_id, ch.chunk_index, nodeToRemove);
            reps.pop();
          }
        } else {
          // if object not present, just clean metadata
          db.prepare('DELETE FROM chunks WHERE file_id = ? AND chunk_index = ? AND node_index = ?')
            .run(ch.file_id, ch.chunk_index, nodeToRemove);
          reps.pop();
        }
      } catch (e) {
        console.warn('Cleanup remove error:', e && e.message ? e.message : e);
      }
    }
  }

  console.log(`Rebalance for node ${nodeIdx} finished.`);
}

// Periodic health loop
async function periodicHealthCheck() {
  for (let i = 0; i < minioClients.length; i++) {
    try {
      const ok = await pingNode(i);
      if (ok && !nodeStatus[i]) {
        // transitioned to up
        nodeStatus[i] = true;
        console.log(`Health: node ${i} is UP`);
        handleNodeUp(i).catch(err => console.error('handleNodeUp error:', err && err.message ? err.message : err));
      } else if (!ok && nodeStatus[i]) {
        // transitioned to down
        nodeStatus[i] = false;
        console.log(`Health: node ${i} is DOWN`);
        handleNodeDown(i).catch(err => console.error('handleNodeDown error:', err && err.message ? err.message : err));
      }
      // else unchanged - do nothing
    } catch (err) {
      console.error('Health check internal error:', err && err.message ? err.message : err);
    }
  }
}

// start health loop
setInterval(() => {
  periodicHealthCheck().catch(e => console.error('Periodic health error:', e));
}, HEALTH_CHECK_INTERVAL_MS);
periodicHealthCheck().catch(e => console.error('Initial health check error:', e));

// ---------------- end self-healing ----------------

// start gRPC server
async function main() {
  await ensureBuckets();
  const server = new grpc.Server();
  server.addService(storageProto.FileStorage.service, { uploadFile, downloadFile, GetMetadata: getMetadata });
  const addr = process.env.GRPC_BIND || '0.0.0.0:5000';
  server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) { console.error('gRPC bind error:', err); process.exit(1); }
    console.log(`gRPC server running on ${addr}`);
  });
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
