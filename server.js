require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const Minio = require('minio');
const fs = require('fs');
const path = require('path');
const fileURLToPath = require('node:url')

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

const PROTO_PATH = path.resolve(__dirname, "./protos/storage.proto");

const PROTO_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
}

const packageDefinition = protoLoader.loadSync(PROTO_PATH, PROTO_OPTIONS)

const storageProto = grpc.loadPackageDefinition(packageDefinition).filestorage;

// Set up MinIO clients for each node
const minioClients = [
  new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT_1.split(':')[0],
    port: parseInt(process.env.MINIO_ENDPOINT_1.split(':')[1]),
    accessKey: process.env.MINIO_ROOT_USER,
    secretKey: process.env.MINIO_ROOT_PASSWORD,
    useSSL: false,
  })
];

// Upload file to MinIO
async function uploadFile(call, callback) {
  const chunks = [];
  let fileName = null;

  call.on('data', (chunk) => {
    if (!fileName && chunk.fileName) {
      fileName = chunk.fileName;
    }
    chunks.push(chunk.fileData);
  });

  call.on('end', async () => {
    if (!fileName) {
      return callback(new Error('File name not provided'));
    }

    const buffer = Buffer.concat(chunks);

    try {
      const client = minioClients[0];
      await client.putObject('files', fileName, buffer);
      callback(null, { message: `File ${fileName} uploaded successfully` });
    } catch (err) {
      console.error(err);
      callback(err);
    }
  });
}


// Download file from MinIO
function downloadFile(call) {
  const { fileName } = call.request;
  const client = minioClients[0];

  client.getObject('files', fileName, (err, stream) => {
    if (err) return call.emit('error', err);
    stream.on('data', (chunk) => call.write({ fileData: chunk }));
    stream.on('end', () => call.end());
  });
}

async function ensureBucket() {
  const client = minioClients[0];
  const exists = await client.bucketExists('files');
  if (!exists) {
    await client.makeBucket('files');
    console.log('Bucket "files" created');
  }
}

async function main() {
  await ensureBucket();


  const server = new grpc.Server();
  server.addService(storageProto.FileStorage.service, { uploadFile, downloadFile });
  server.bindAsync('0.0.0.0:5000', grpc.ServerCredentials.createInsecure(), () => {
    console.log('gRPC server running on port 5000');
    server.start();
  });
}

main();
