// services/rebalanceService.js
const { getCandidateChunksRebalance, loadNodesByReplicaCount, getAllChunksGrouped, insertChunkStmt, deleteChunkRow, countAllReplicaRows } = require('../db/queries');
const { objectExistsOnNode, copyObjectBetweenNodes } = require('./minioHelpers');
const { minioClients, BUCKET } = require('../minio/clients');
const { v4: uuidv4 } = require('uuid');
const { nodeStatus } = require('./nodePicker');
const { REPLICATION_FACTOR } = require('../config');

async function handleNodeUp(nodeIdx) {
  console.log(`Node ${nodeIdx} marked UP -> running dynamic rebalance (Option B)`);

  try {
    const client = minioClients[nodeIdx];
    const exists = await client.bucketExists(BUCKET);
    if (!exists) await client.makeBucket(BUCKET);
  } catch (e) {
    console.warn('Could not ensure bucket on recovered node:', e && e.message ? e.message : e);
  }

  const countsRows = require('../db/queries').countChunksGroup.all();
  const countsMap = new Map();
  for (const cr of countsRows) countsMap.set(cr.node_index, cr.cnt);
  const totalReplicaRows = require('../db/queries').countAllReplicaRows.get().total || 0;
  const N = minioClients.length;
  const desiredPerNode = Math.ceil(totalReplicaRows / N);

  let currentCount = countsMap.get(nodeIdx) || 0;

  const candidateChunks = getCandidateChunksRebalance.all(nodeIdx);

  for (const ch of candidateChunks) {
    if (currentCount >= desiredPerNode) break;
    const { file_id: fileId, chunk_index: chunkIndex, object_name: objectName, size } = ch;

    const reps = require('../db/queries').getReplicaNodes.all(fileId, chunkIndex);
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
      insertChunkStmt.run(uuidv4(), fileId, chunkIndex, size, objectName, nodeIdx);
      currentCount++;
    } catch (err) {
      console.warn(`Rebalance failed copying ${objectName} -> node ${nodeIdx}:`, err && err.message ? err.message : err);
    }
  }

  const chunksAll = getAllChunksGrouped.all();
  for (const ch of chunksAll) {
    const reps = require('../db/queries').getReplicaNodes.all(ch.file_id, ch.chunk_index);
    if (reps.length <= Math.min(REPLICATION_FACTOR, minioClients.length)) continue;
    const nodesLoad = loadNodesByReplicaCount.all();
    for (const nl of nodesLoad) {
      if (reps.length <= Math.min(REPLICATION_FACTOR, minioClients.length)) break;
      const nodeToRemove = nl.node_index;
      try {
        if (await objectExistsOnNode(nodeToRemove, ch.object_name)) {
          const remaining = reps.filter(x => x.node_index !== nodeToRemove && nodeStatus[x.node_index]);
          if (remaining.length >= Math.min(REPLICATION_FACTOR, minioClients.length)) {
            deleteChunkRow.run(ch.file_id, ch.chunk_index, nodeToRemove);
            reps.pop();
          }
        } else {
          deleteChunkRow.run(ch.file_id, ch.chunk_index, nodeToRemove);
          reps.pop();
        }
      } catch (e) {
        console.warn('Cleanup remove error:', e && e.message ? e.message : e);
      }
    }
  }

  console.log(`Rebalance for node ${nodeIdx} finished.`);
}

module.exports = { handleNodeUp };
