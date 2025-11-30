const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.resolve(__dirname, "../protos/storage.proto");

const PROTO_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
}

const packageDefinition = protoLoader.loadSync(PROTO_PATH, PROTO_OPTIONS);
const storageProto = grpc.loadPackageDefinition(packageDefinition).filestorage;

const client = new storageProto.FileStorage(
  'localhost:5000',
  grpc.credentials.createInsecure()
);

module.exports = client;
