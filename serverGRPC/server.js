// server.js
require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const { ensureBuckets } = require('./minio/clients');
const { init, startHealthLoop } = require('./services/healthService');

const { uploadFile } = require('./controllers/uploadController');
const { downloadFile } = require('./controllers/downloadController');
const { getMetadata } = require('./controllers/metadataController');

const PROTO_PATH = path.resolve(__dirname, './protos/storage.proto');
const PROTO_OPTIONS = { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true };
const packageDefinition = protoLoader.loadSync(PROTO_PATH, PROTO_OPTIONS);
const storageProto = grpc.loadPackageDefinition(packageDefinition).filestorage;

async function main() {
  await ensureBuckets();
  init();
  startHealthLoop();

  const server = new grpc.Server();
  server.addService(storageProto.FileStorage.service, { uploadFile, downloadFile, GetMetadata: getMetadata });
  const addr = process.env.GRPC_BIND || '0.0.0.0:5000';
  server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) { console.error('gRPC bind error:', err); process.exit(1); }
    console.log(`gRPC server running on ${addr}`);
  });
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
