// services/healthService.js
const { pingNode } = require('./minioHelpers');
const { handleNodeDown } = require('./reReplicationService');
const { handleNodeUp } = require('./rebalanceService');
const { nodeStatus, initNodeStatus } = require('./nodePicker');
const { HEALTH_CHECK_INTERVAL_MS } = require('../config');

function init() {
  initNodeStatus();
}

async function periodicHealthCheck() {
  const { minioClients } = require('../minio/clients');
  for (let i = 0; i < minioClients.length; i++) {
    try {
      const ok = await pingNode(i);
      if (ok && !nodeStatus[i]) {
        nodeStatus[i] = true;
        console.log(`Health: node ${i} is UP`);
        handleNodeUp(i).catch(err => console.error('handleNodeUp error:', err && err.message ? err.message : err));
      } else if (!ok && nodeStatus[i]) {
        nodeStatus[i] = false;
        console.log(`Health: node ${i} is DOWN`);
        handleNodeDown(i).catch(err => console.error('handleNodeDown error:', err && err.message ? err.message : err));
      }
    } catch (err) {
      console.error('Health check internal error:', err && err.message ? err.message : err);
    }
  }
}

function startHealthLoop() {
  setInterval(() => {
    periodicHealthCheck().catch(e => console.error('Periodic health error:', e));
  }, HEALTH_CHECK_INTERVAL_MS);
  periodicHealthCheck().catch(e => console.error('Initial health check error:', e));
}

module.exports = { init, periodicHealthCheck, startHealthLoop };
