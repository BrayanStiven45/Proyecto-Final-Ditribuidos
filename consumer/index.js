// consumer/index.js
import "dotenv/config";
import { initKafkaConsumer } from "./kafkaConsumer.js";
import { startChunkConsumer } from "./chunkConsumer.js";
import { ensureBucket } from "./minioClient.js";

async function main() {
  await ensureBucket();
  await initKafkaConsumer();
  await startChunkConsumer();
}

main().catch((err) => {
  console.error("❌ Error en el consumer:", err);
});
