import { consumer } from "./kafkaConsumer.js";

const TOPIC = "file-chunks";

// Estructura temporal para rearmar archivos
const fileBuffers = new Map();

export async function startChunkConsumer() {
  await consumer.subscribe({
    topic: TOPIC,
    fromBeginning: true,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const data = JSON.parse(message.value.toString());

      const {
        fileId,
        chunkIndex,
        totalChunks,
        data: chunkBase64,
      } = data;

      const buffer = Buffer.from(chunkBase64, "base64");

      if (!fileBuffers.has(fileId)) {
        fileBuffers.set(fileId, {
          chunks: new Array(totalChunks),
          received: 0,
        });
      }

      const fileEntry = fileBuffers.get(fileId);

      fileEntry.chunks[chunkIndex] = buffer;
      fileEntry.received++;

      console.log(
        `📦 Chunk recibido: ${chunkIndex + 1}/${totalChunks} (Partición ${partition})`
      );

      // Cuando llega el archivo completo
      if (fileEntry.received === totalChunks) {
        const finalBuffer = Buffer.concat(fileEntry.chunks);

        console.log(`✅ Archivo completo reconstruido. Tamaño: ${finalBuffer.length} bytes`);

        // Aquí puedes: guardarlo en disco, S3, DB, etc.
        fileBuffers.delete(fileId);
      }
    },
  });
}
