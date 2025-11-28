// kafka/kafkaProducer.js
import { Kafka } from "kafkajs";


const kafka = new Kafka({
  clientId: "file-uploader",
  brokers: [process.env.KAFKA_BROKER],
});

export const producer = kafka.producer();

export async function initKafkaProducer() {
  await producer.connect();
  console.log("Kafka Producer connected");
}
