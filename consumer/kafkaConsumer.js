import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "file-processor",
  brokers: ["localhost:9092"],
});
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              
export const consumer = kafka.consumer({
  groupId: "file-chunks-group", // IMPORTANTE
});

export async function initKafkaConsumer() {
  await consumer.connect();
  console.log("✅ Kafka Consumer conectado");
}
