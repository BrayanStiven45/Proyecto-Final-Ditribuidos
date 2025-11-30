// config.js
require('dotenv').config();

module.exports = {
  CHUNK_SIZE: parseInt(process.env.CHUNK_SIZE_BYTES || (4 * 1024 * 1024)), // 4 MiB
  REPLICATION_FACTOR: Math.max(1, parseInt(process.env.REPLICATION_FACTOR || 2)),
  HEALTH_CHECK_INTERVAL_MS: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '8000'),
  REPAIR_RETRIES: 3,
  REPAIR_RETRY_DELAY_MS: 800,
};
