require('dotenv').config();
const { Kafka } = require('kafkajs');
const Minio = require('minio');
const crypto = require('crypto');

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'minio';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const BUCKET = 'files';

const kafka = new Kafka({ brokers: [KAFKA_BROKER] });
const consumer = kafka.consumer({ groupId: 'file-workers-group' });
const producer = kafka.producer();

const minioClient = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: false,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY
});

async function ensureBucket() {
  try {
    const exists = await minioClient.bucketExists(BUCKET);
    if (!exists) {
      await minioClient.makeBucket(BUCKET);
      console.log('Created bucket', BUCKET);
    }
  } catch (err) {
    console.error('minio ensureBucket error', err);
    throw err;
  }
}

async function start() {
  await ensureBucket();
  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topic: 'file-chunks', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const headers = {};
        for (const k in message.headers || {}) {
          headers[k] = message.headers[k].toString();
        }
        const fileId = headers.fileId;
        const chunkIndex = parseInt(headers.chunkIndex || '0', 10);

        const objectName = `files/${fileId}/chunk_${String(chunkIndex).padStart(6, '0')}`;

        const data = message.value; // Buffer
        // checksum
        const actual = crypto.createHash('sha256').update(data).digest('hex');

        // upload idempotent (putObject overwrites)
        await minioClient.putObject(BUCKET, objectName, data);

        // produce event
        const event = {
          type: 'chunk-stored',
          fileId,
          chunkIndex,
          objectName,
          checksum: actual,
          timestamp: new Date().toISOString()
        };

        await producer.send({
          topic: 'file-events',
          messages: [{ key: fileId, value: JSON.stringify(event) }]
        });

        console.log(`Stored ${objectName}`);
      } catch (err) {
        console.error('worker error', err);
        // Optionally produce chunk-failed event
      }
    }
  });
}

start().catch(err => { console.error(err); process.exit(1); });
