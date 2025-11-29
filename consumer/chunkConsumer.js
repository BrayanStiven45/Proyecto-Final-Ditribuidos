// chunkConsumer.js
import { consumer } from "./kafkaConsumer.js";
import { uploadChunkToMinio } from "./minioUploader.js";
import { isStorageAvailable } from "./minioFailoverClient.js";

const TOPIC = process.env.KAFKA_TOPIC || "file-chunks";
let isPaused = false;

export async function startChunkConsumer() {
  // Asumimos que initKafkaConsumer y assignPartition ya fueron llamados por index.js
  await consumer.run({
    autoCommit: true,
    eachMessage: async ({ topic, partition, message }) => {
      // si ambos minios caen, pausamos y retornamos (no procesamos ni cometemos)
      if (!isStorageAvailable()) {
        if (!isPaused) {
          console.log("⏸ Consumer pausado — NO hay MinIO disponible");
          consumer.pause([{ topic: TOPIC, partitions: [] }]); // pausamos todo el topic/particion asignada
          isPaused = true;
        }
        return;
      }

      // si estaba pausado y ahora hay storage, reanudamos
      if (isPaused && isStorageAvailable()) {
        console.log("▶️ Consumer reanudado — al menos un MinIO disponible");
        consumer.resume([{ topic: TOPIC }]);
        isPaused = false;
      }

      try {
        const data = JSON.parse(message.value.toString());
        const { fileId, chunkIndex, data: chunkBase64 } = data;
        const buffer = Buffer.from(chunkBase64, "base64");

        await uploadChunkToMinio(fileId, chunkIndex, buffer);
      } catch (err) {
        console.error("⚠️ Error procesando mensaje:", err.message);
        // No re-lanzamos: evitar que el consumer crash por un solo mensaje.
      }
    },
  });
}
