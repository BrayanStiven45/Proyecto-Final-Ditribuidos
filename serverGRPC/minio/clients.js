// minio/clients.js
require('dotenv').config();
const Minio = require('minio');

const BUCKET = process.env.BUCKET_NAME || 'files';

// Load MinIO endpoints MINIO_ENDPOINT_1 ... MINIO_ENDPOINT_4
const minioEndpoints = [];
for (let i = 1; i <= 4; i++) {
  const env = process.env[`MINIO_ENDPOINT_${i}`];
  if (env) minioEndpoints.push(env);
}

if (minioEndpoints.length === 0) {
  console.error('No MinIO endpoints configured. Set MINIO_ENDPOINT_1 ... MINIO_ENDPOINT_4 in .env');
  process.exit(1);
}

// Create MinIO clients
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

// Ensure the bucket exists on all nodes
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
      console.error(`Error ensuring bucket on node ${i}:`, err?.message || err);
    }
  }
}

module.exports = {
  BUCKET,
  minioClients,
  minioEndpoints,
  ensureBuckets
};
