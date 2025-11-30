// controllers/downloadController.js
const { getLatestFileByName, getFileByNameAndVersion, getChunksOrdered, getChunkReplicas } = require('../db/queries');
const { minioClients } = require('../minio/clients');
const { BUCKET } = require('../minio/clients');
const { nodeStatus } = require('../services/nodePicker');

async function downloadFile(call) {
  const fileNameReq = call.request.fileName || null;
  const fileIdReq = call.request.fileId || null;
  const requestedVersion = call.request.version || null;

  let fileRow;
  if (fileIdReq) {
    // si cliente envía fileId, usamos directamente (útil para versiones específicas)
    fileRow = getFileById.get(fileIdReq); // asegúrate de exportar getFileById en queries
  } else if (fileNameReq && requestedVersion) {
    fileRow = getFileByNameAndVersion.get(fileNameReq, requestedVersion);
  } else if (fileNameReq) {
    fileRow = getLatestFileByName.get(fileNameReq);
  }

  if (!fileRow) {
    call.emit('error', { code: require('@grpc/grpc-js').status.NOT_FOUND, message: 'File not found' });
    return;
  }

  const fileId = fileRow.id;
  const chunks = getChunksOrdered.all(fileId);

  try {
    for (const chunkInfo of chunks) {
      const reps = getChunkReplicas.all(fileId, chunkInfo.chunk_index);
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

module.exports = { downloadFile };
