// services/minioHelpers.js
const { minioClients, BUCKET } = require('../minio/clients');
const { REPAIR_RETRIES, REPAIR_RETRY_DELAY_MS } = require('../config');

async function pingNode(i) {
  const client = minioClients[i];
  try {
    await client.listBuckets();
    return true;
  } catch (err) {
    return false;
  }
}

async function objectExistsOnNode(nodeIdx, objectName) {
  try {
    await minioClients[nodeIdx].statObject(BUCKET, objectName);
    return true;
  } catch {
    return false;
  }
}

async function copyObjectBetweenNodes(sourceNodeIdx, targetNodeIdx, objectName) {
  for (let attempt = 1; attempt <= REPAIR_RETRIES; attempt++) {
    try {
      const srcClient = minioClients[sourceNodeIdx];
      const tgtClient = minioClients[targetNodeIdx];
      const stream = await srcClient.getObject(BUCKET, objectName);
      await tgtClient.putObject(BUCKET, objectName, stream);
      return;
    } catch (err) {
      console.warn(`copy attempt ${attempt} failed for ${objectName} from ${sourceNodeIdx} to ${targetNodeIdx}:`, err && err.message ? err.message : err);
      await new Promise(r => setTimeout(r, REPAIR_RETRY_DELAY_MS * attempt));
    }
  }
  throw new Error(`copyObjectBetweenNodes failed after ${REPAIR_RETRIES} attempts for ${objectName}`);
}

module.exports = { pingNode, objectExistsOnNode, copyObjectBetweenNodes };
