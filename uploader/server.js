require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Kafka } = require('kafkajs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const PROTO_PATH = path.resolve(__dirname, "../protos/storage.proto");
const PROTO_OPTIONS = { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true };
const packageDefinition = protoLoader.loadSync(PROTO_PATH, PROTO_OPTIONS);
const storageProto = grpc.loadPackageDefinition(packageDefinition).filestorage;

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
const FILE_CHUNK_SIZE = parseInt(process.env.FILE_CHUNK_SIZE || '1048576', 10);

const kafka = new Kafka({ brokers: [KAFKA_BROKER] });
const producer = kafka.producer();

async function startProducer() {
  await producer.connect();
}
startProducer().catch(err => { console.error(err); process.exit(1); });

// UploadFile: stream from client -> split into chunks -> produce to Kafka
async function uploadFile(call, callback) {
  const chunks = [];
  let fileName = null;
  let fileId = uuidv4();

  // We'll buffer streaming chunks into memory-chunks of FILE_CHUNK_SIZE and produce each
  let bufferParts = [];

  call.on('data', (req) => {
    if (!fileName && req.fileName) fileName = req.fileName;
    if (req.fileData) bufferParts.push(req.fileData);
  });

  call.on('end', async () => {
    try {
      if (!fileName) return callback(new Error('File name not provided'));

      // Concatenate all received buffers into one Buffer (safe for typical files; for very large files change to streaming chunking)
      const fullBuffer = Buffer.concat(bufferParts);
      const totalSize = fullBuffer.length;
      const totalChunks = Math.ceil(totalSize / FILE_CHUNK_SIZE);

      // Produce initial manifest (state=UPLOADING)
      const manifest = {
        fileId,
        filename: fileName,
        size: totalSize,
        totalChunks,
        chunkChecksums: Array(totalChunks).fill(null),
        state: 'UPLOADING',
        createdAt: new Date().toISOString()
      };

      await producer.send({
        topic: 'file-manifest',
        messages: [{ key: fileId, value: JSON.stringify(manifest) }]
      });

      // Produce each chunk
      for (let idx = 0; idx < totalChunks; idx++) {
        const start = idx * FILE_CHUNK_SIZE;
        const end = Math.min(start + FILE_CHUNK_SIZE, totalSize);
        const slice = fullBuffer.slice(start, end);

        // Headers as strings
        const headers = {
          fileId,
          chunkIndex: String(idx),
          totalChunks: String(totalChunks),
          filename
        };

        await producer.send({
          topic: 'file-chunks',
          messages: [{
            key: fileId,
            value: slice,
            headers
          }]
        });
      }

      callback(null, { message: `Accepted file ${fileName} with id ${fileId}` });
    } catch (err) {
      console.error('uploader error:', err);
      callback(err);
    }
  });
}

// DownloadFile is left as direct call to reassembler service; uploader won't serve downloads
function downloadFile(call) {
  call.emit('error', new Error('Download not supported on uploader. Use reassembler service.'));
}

const server = new grpc.Server();
server.addService(storageProto.FileStorage.service, { uploadFile, downloadFile });
server.bindAsync('0.0.0.0:5000', grpc.ServerCredentials.createInsecure(), () => {
  console.log('Uploader gRPC listening on 5000');
  server.start();
});
