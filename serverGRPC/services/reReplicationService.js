// services/reReplicationService.js
const { getChunksByNode, getReplicaNodes, deleteChunkRow, insertChunkStmt } = require('../db/queries');
const { objectExistsOnNode, copyObjectBetweenNodes } = require('./minioHelpers');
const { minioClients } = require('../minio/clients');
const { v4: uuidv4 } = require('uuid');
const { REPLICATION_FACTOR } = require('../config');
const { nodeStatus } = require('./nodePicker');

async function handleNodeDown(nodeIdx) {
  console.log(`Node ${nodeIdx} marked DOWN -> re-replicating and cleaning metadata (Option B strategy)`);
  const rows = getChunksByNode.all(nodeIdx);

  for (const r of rows) {
    const { file_id: fileId, chunk_index: chunkIndex, object_name: objectName, size } = r;

    const reps = getReplicaNodes.all(fileId, chunkIndex);
    const healthy = [];
    for (const rep of reps) {
      if (rep.node_index === nodeIdx) continue;
      if (!nodeStatus[rep.node_index]) continue;
      try {
        if (await objectExistsOnNode(rep.node_index, objectName)) healthy.push(rep.node_index);
      } catch { /* ignore */ }
    }

    const need = Math.max(0, Math.min(REPLICATION_FACTOR, minioClients.length) - healthy.length);
    if (need <= 0) {
      try {
        deleteChunkRow.run(fileId, chunkIndex, nodeIdx);
      } catch (e) { console.warn('Failed to delete old chunk row:', e); }
      continue;
    }

    const existingNodes = new Set(reps.map(x => x.node_index));
    const candidates = [];
    for (let i = 0; i < minioClients.length && candidates.length < need; i++) {
      if (!nodeStatus[i]) continue;
      if (existingNodes.has(i)) continue;
      candidates.push(i);
    }

    if (candidates.length === 0) {
      console.error(`No candidate targets to maintain replication for ${objectName}`);
      try { deleteChunkRow.run(fileId, chunkIndex, nodeIdx); } catch(e){}
      continue;
    }

    let source = healthy.length > 0 ? healthy[0] : null;
    if (!source) {
      for (const rep of reps) {
        try {
          if (await objectExistsOnNode(rep.node_index, objectName)) { source = rep.node_index; break; }
        } catch {}
      }
    }
    if (!source) {
      console.error(`No source found to repair ${objectName}. Data may be lost.`);
      try { deleteChunkRow.run(fileId, chunkIndex, nodeIdx); } catch(e){}
      continue;
    }

    for (const tgt of candidates) {
      try {
        await copyObjectBetweenNodes(source, tgt, objectName);
        insertChunkStmt.run(uuidv4(), fileId, chunkIndex, size, objectName, tgt);
        try {
          deleteChunkRow.run(fileId, chunkIndex, nodeIdx);
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

module.exports = { handleNodeDown };
