import { consumer } from "./kafkaConsumer.js";
import { uploadChunkToMinio } from "./minioUploader.js";
import { isStorageAvailable, ensureFailover } from "./minioFailoverClient.js";

const TOPIC = "file-chunks";
let isPaused = false;

export async function startChunkConsumer() {
  await consumer.subscribe({
    topic: TOPIC,
    fromBeginning: true,
  });

  await consumer.run({
    autoCommit: true,
    eachMessage: async ({ message }) => {

      await ensureFailover();

      if (!isStorageAvailable()) {
        if (!isPaused) {
          console.log("⏸ Consumer pausado — NO hay MinIO disponible");
          consumer.pause([{ topic: TOPIC }]);
          isPaused = true;
        }
        return;
      }

      if (isPaused) {
        console.log("▶️ Consumer reanudado — hay MinIO disponible");
        consumer.resume([{ topic: TOPIC }]);
        isPaused = false;
      }

      const data = JSON.parse(message.value.toString());
      const { fileId, chunkIndex, data: chunkBase64 } = data;
      const buffer = Buffer.from(chunkBase64, "base64");

      await uploadChunkToMinio(fileId, chunkIndex, buffer);
    },
  });
}
