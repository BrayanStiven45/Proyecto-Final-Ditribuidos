// services/nodePicker.js
const { minioClients } = require('../minio/clients');
const { REPLICATION_FACTOR } = require('../config');

// nodeStatus is declared in healthService and shared through require cycle avoidance
// we'll export a mutable array here that other modules can read/write
const nodeStatus = [];

function initNodeStatus() {
  // initialize as up (true)
  nodeStatus.length = 0;
  for (let i = 0; i < minioClients.length; i++) nodeStatus.push(true);
}

function pickNodesForChunkAdaptive(chunkIndex) {
  const active = [];
  for (let i = 0; i < minioClients.length; i++) {
    if (nodeStatus[i]) active.push(i);
  }
  if (active.length === 0) {
    return [...Array(minioClients.length).keys()].slice(0, Math.min(REPLICATION_FACTOR, minioClients.length));
  }
  const nodes = [];
  const start = chunkIndex % active.length;
  for (let r = 0; r < Math.min(REPLICATION_FACTOR, active.length); r++) {
    nodes.push(active[(start + r) % active.length]);
  }
  return nodes;
}

module.exports = { nodeStatus, initNodeStatus, pickNodesForChunkAdaptive };
