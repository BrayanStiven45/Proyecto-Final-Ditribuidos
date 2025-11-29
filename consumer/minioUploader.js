// minioUploader.js
import { putWithFailover } from "./minioFailoverClient.js";

/**
 * uploadChunkToMinio(fileId, chunkIndex, buffer)
 * Usa la lógica de failover centralizada en putWithFailover.
 */
export async function uploadChunkToMinio(fileId, chunkIndex, buffer) {
  const objectName = `${fileId}/chunk-${chunkIndex}`;

  // putWithFailover acepta Buffer o Stream
  const result = await putWithFailover(objectName, buffer);

  console.log(
    `☁️ Chunk ${chunkIndex} guardado como ${objectName} (storage usado: ${result.used})`
  );
}
