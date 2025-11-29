const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs');
const path = require('path');

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
const client = new storageProto.FileStorage('localhost:5000', grpc.credentials.createInsecure());

function uploadFile(filePath) {
  const fileName = path.basename(filePath);
  const stream = fs.createReadStream(filePath);

  const call = client.uploadFile((err, response) => {
    if (err) {
      console.error('Upload failed:', err);
      return;
    }
    console.log('Server reply:', response.message);
  });

  let firstChunk = true;

  stream.on('data', (chunk) => {
    if (firstChunk) {
      call.write({ fileData: chunk, fileName });
      firstChunk = false;
    } else {
      call.write({ fileData: chunk });
    }
  });

  stream.on('end', () => {
    call.end();
  });
}


function downloadFile(fileName) {
  const call = client.downloadFile({ fileName });
  const writeStream = fs.createWriteStream(`downloaded_${fileName}`);

  call.on('data', (chunk) => writeStream.write(chunk.fileData));
  call.on('end', () => console.log(`Downloaded ${fileName}`));
}

// uploadFile('./pruebaPdf.pdf');  // Example usage

downloadFile('pruebaPdf.pdf')