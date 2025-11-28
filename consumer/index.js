// consumer/index.js
import "dotenv/config";
import { initKafkaConsumer } from "./kafkaConsumer.js";
import { startChunkConsumer } from "./chunkConsumer.js";

async function main() {
  await initKafkaConsumer();
  await startChunkConsumer();
}

main().catch((err) => {
  console.error("❌ Error en el consumer:", err);
});
