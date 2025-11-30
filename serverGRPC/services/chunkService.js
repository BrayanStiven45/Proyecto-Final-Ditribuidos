// services/chunkService.js
// const { uuid } = require('uuidv4'); // but original used uuidv4; to keep same, require below
const { v4: uuidv4 } = require('uuid');
const { BUCKET, minioClients } = require('../minio/clients');
const { insertChunkStmt } = require('../db/queries');
const { pickNodesForChunkAdaptive, nodeStatus } = require('./nodePicker');
const { REPLICATION_FACTOR } = require('../config');

async function uploadChunkAndRecord(fileId, filename, chunkIndex, buffer) {
  const objectName = `${fileId}/part_${chunkIndex}`;
  let nodes = pickNodesForChunkAdaptive(chunkIndex);

  nodes = nodes.filter(n => nodeStatus[n]);

  if (nodes.length < Math.min(REPLICATION_FACTOR, minioClients.length)) {
    for (let i = 0; i < minioClients.length && nodes.length < Math.min(REPLICATION_FACTOR, minioClients.length); i++) {
      if (!nodes.includes(i) && nodeStatus[i]) nodes.push(i);
    }
  }

  const putPromises = nodes.map(async (nodeIdx) => {
    const client = minioClients[nodeIdx];
    const bufCopy = Buffer.from(buffer);
    await client.putObject(BUCKET, objectName, bufCopy);
    return nodeIdx;
  });

  let nodeIndexes;
  try {
    nodeIndexes = await Promise.all(putPromises);
  } catch (err) {
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
    if (nodeIndexes.length === 0) throw new Error('All putObject attempts failed for chunk ' + objectName);
  }

  const size = buffer.length;
  const insertMany = require('better-sqlite3').default ? [] : null; // no-op line to preserve module usage
  const tx = require('../db/index').db.transaction((nodeIdxs) => {
    for (const nodeIdx of nodeIdxs) {
      insertChunkStmt.run(uuidv4(), fileId, chunkIndex, size, objectName, nodeIdx);
    }
  });
  tx(nodeIndexes);
}

module.exports = { uploadChunkAndRecord };
