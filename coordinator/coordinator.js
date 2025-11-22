require('dotenv').config();
const { Kafka } = require('kafkajs');

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
const MANIFEST_TOPIC = process.env.MANIFEST_TOPIC || 'file-manifest';

const kafka = new Kafka({ brokers: [KAFKA_BROKER] });
const consumer = kafka.consumer({ groupId: 'coordinator-group' });
const producer = kafka.producer();

const manifests = new Map(); // in-memory tracking: fileId -> { totalChunks, countStored }

async function start() {
  await consumer.connect();
  await producer.connect();

  await consumer.subscribe({ topic: 'file-events', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const ev = JSON.parse(message.value.toString());
        if (ev.type === 'chunk-stored') {
          const fileId = ev.fileId;
          let m = manifests.get(fileId);
          if (!m) {
            // try to get manifest via kafka (not implemented here) - assume uploader produced manifest earlier
            m = { totalChunks: null, stored: new Set() };
            manifests.set(fileId, m);
          }
          m.stored.add(ev.chunkIndex);

          // If we don't yet know totalChunks, try to fetch manifest by reading file-manifest topic is complex - instead we'll rely on uploader providing totalChunks in manifest and coordinator expecting file-manifest updates (simplification)
          // For robustness, better to maintain a materialized view from file-manifest topic; here we check cached totalChunks
          if (m.totalChunks && m.stored.size >= m.totalChunks) {
            // update manifest state to COMPLETED (produce to file-manifest)
            const manifestUpdate = {
              fileId,
              state: 'COMPLETED',
              completedAt: new Date().toISOString()
            };
            await producer.send({
              topic: MANIFEST_TOPIC,
              messages: [{ key: fileId, value: JSON.stringify(manifestUpdate) }]
            });
            console.log(`File ${fileId} marked COMPLETED`);
            // optional: cleanup map
            manifests.delete(fileId);
          }
        }
      } catch (err) {
        console.error('coordinator error', err);
      }
    }
  });
}

start().catch(err => { console.error(err); process.exit(1); });
