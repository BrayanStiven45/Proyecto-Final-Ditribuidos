// kafka/chunkPublisher.js
import { producer } from './kafkaProducer.js';

export const NUM_PAIRS = 2;
const TOPIC = "file-chunks";

export async function publishChunk(fileId, chunkIndex, totalChunks, chunkBuffer) {
  const partition = chunkIndex % NUM_PAIRS;

  const payload = {
    fileId,
    chunkIndex,
    totalChunks,
    data: chunkBuffer.toString("base64"), // serialización
  };

  await producer.send({
    topic: TOPIC,
    messages: [
      {
        key: `${fileId}-${chunkIndex}`,
        value: JSON.stringify(payload),
        partition,
      },
    ],
  });

  console.log(`Chunk ${chunkIndex}/${totalChunks} enviado → partición ${partition}`);
}

