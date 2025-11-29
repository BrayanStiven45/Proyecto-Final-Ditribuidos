// index.js (consumer)
import "dotenv/config";
import { initKafkaConsumer, assignPartition, consumer } from "./kafkaConsumer.js";
import { startChunkConsumer } from "./chunkConsumer.js";
import { ensureBucketBoth } from "./minioFailoverClient.js";

async function main() {
  // 1) Asegurar buckets (si alguno está arriba, lo creará)
  await ensureBucketBoth();

  // 2) Conectar consumer
  await initKafkaConsumer();

  // 3) Asignar partición que viene del env KAFKA_PARTITION
  const partition = process.env.KAFKA_PARTITION;
  if (!partition && partition !== "0") {
    console.warn("⚠️ No se definió KAFKA_PARTITION. Usando 0 por defecto.");
  }

  await assignPartition(partition || "0");

  // 4) Iniciar loop de consumo
  await startChunkConsumer();
}

main().catch((err) => {
  console.error("❌ Error en el consumer:", err);
  process.exit(1);
});
