// kafka/chunkPublisher.js
const { producer } = require("./kafkaProducer");

const NUM_PARTITION = 4;
const TOPIC = "file-chunks";

async function publishChunk(fileId, chunkIndex, totalChunks, chunkBuffer) {
  const partition = chunkIndex % NUM_PARTITION;

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

module.exports = { publishChunk, NUM_PAIRS };
