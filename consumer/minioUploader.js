import { minioClient, BUCKET } from "./minioClient.js";

export async function uploadChunkToMinio(fileId, chunkIndex, buffer) {
  const objectName = `${fileId}/chunk-${chunkIndex}`;

  await minioClient.putObject(BUCKET, objectName, buffer);

  console.log(`☁️ Chunk ${chunkIndex} guardado en MinIO como ${objectName}`);
}
