require('dotenv').config();
const express = require('express');
const Minio = require('minio');
const { Kafka } = require('kafkajs');

const app = express();
const PORT = process.env.PORT || 3000;

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'minio';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const BUCKET = 'files';

const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER || 'kafka:9092'] });
const consumer = kafka.consumer({ groupId: 'manifest-reader' });

const minioClient = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: false,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY
});

const manifests = new Map(); // fileId -> manifest

async function init() {
  // consume file-manifest compacted topic to materialize manifests
  await consumer.connect();
  await consumer.subscribe({ topic: 'file-manifest', fromBeginning: true });
  consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const key = message.key ? message.key.toString() : null;
        const value = message.value ? JSON.parse(message.value.toString()) : null;
        if (key && value) {
          // merge partial updates
          const existing = manifests.get(key) || {};
          manifests.set(key, { ...existing, ...value });
        }
      } catch (err) {
        console.error('manifest consumer error', err);
      }
    }
  });
}

app.get('/download/:fileId', async (req, res) => {
  const fileId = req.params.fileId;
  const manifest = manifests.get(fileId);
  if (!manifest) return res.status(404).send('Manifest not found');
  if (manifest.state !== 'COMPLETED') return res.status(409).send(`File state ${manifest.state}`);

  const totalChunks = manifest.totalChunks;
  res.setHeader('Content-Disposition', `attachment; filename="${manifest.filename || fileId}"`);
  res.setHeader('Content-Type', 'application/octet-stream');

  // sequential streaming
  for (let i = 0; i < totalChunks; i++) {
    const objectName = `files/${fileId}/chunk_${String(i).padStart(6, '0')}`;
    try {
      const stream = await minioClient.getObject(BUCKET, objectName);
      // pipe chunk into response (awaiting end per chunk)
      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => res.write(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    } catch (err) {
      console.error('error fetching chunk', objectName, err);
      return res.status(500).send('Error reassembling file');
    }
  }
  res.end();
});

init().catch(err => {
  console.error('reassembler init error', err);
  process.exit(1);
});

app.listen(PORT, () => console.log(`Reassembler listening on ${PORT}`));
