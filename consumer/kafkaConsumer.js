// kafkaConsumer.js
import { Kafka } from "kafkajs";

const brokersEnv = process.env.KAFKA_BROKERS || "localhost:9092";
const brokers = brokersEnv.split(",");

const clientId = process.env.KAFKA_CLIENT_ID || "file-processor";
const topic = process.env.KAFKA_TOPIC || "file-chunks";
const partition = process.env.KAFKA_PARTITION || "0";

const kafka = new Kafka({
  clientId,
  brokers,
});

// Un consumer group POR PARTICIÓN garantiza que Kafka solo entregue esa partición.
export const consumer = kafka.consumer({
  groupId: `file-chunks-group-p${partition}`,
});

export async function initKafkaConsumer() {
  await consumer.connect();
  console.log("✅ Kafka Consumer conectado");

  await consumer.subscribe({
    topic,
    fromBeginning: true,
  });

  console.log(`📌 Consumer suscrito a ${topic} usando groupId único por partición: p${partition}`);
}
