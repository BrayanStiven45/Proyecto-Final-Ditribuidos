// services/fileService.js

const { Readable, PassThrough } = require('stream');
const client = require('../grpc/storageClient');


/* ============================
   ✅ UPLOAD (desde BUFFER)
============================ */

function uploadFile(buffer, fileName) {
  return new Promise((resolve, reject) => {

    const CHUNK_SIZE = 64 * 1024; // 64 KB - puedes subirlo a 256KB o 512KB
    let offset = 0;

    const call = client.uploadFile((err, response) => {
      if (err) {
        console.error('Upload failed:', err);
        reject(err);
        return;
      }
      resolve(response);
    });

    let firstChunk = true;

    while (offset < buffer.length) {
      const chunk = buffer.slice(offset, offset + CHUNK_SIZE);

      if (firstChunk) {
        call.write({
          fileName: fileName,
          fileData: chunk
        });
        firstChunk = false;
      } else {
        call.write({ fileData: chunk });
      }

      offset += CHUNK_SIZE;
    }

    call.end();
  });
}


/* ============================
   ✅ DOWNLOAD (como stream)
============================ */

function downloadFileStream(fileName, version = 0) {

  const call = client.downloadFile({ fileName, version });
  const stream = new PassThrough();

  call.on('data', (chunk) => {
    stream.write(chunk.fileData);
  });

  call.on('end', () => {
    stream.end();
  });

  call.on('error', (err) => {
    console.error("Download error:", err);
    stream.emit('error', err);
  });

  return stream;
}


/* ============================
   ✅ METADATA
============================ */

function getMetadata(fileName, version = 0) {

  return new Promise((resolve, reject) => {

    client.getMetadata({ fileName, version }, (err, response) => {

      if (err) {
        console.error("Metadata error:", err);
        reject(err);
        return;
      }

      resolve(response);
    });

  });

}


/* ============================
   ✅ VERSIONES
============================ */

function listVersions(fileName) {

  return new Promise((resolve, reject) => {

    client.listVersions({ fileName }, (err, response) => {

      if (err) {
        console.error("List versions error:", err);
        reject(err);
        return;
      }

      resolve(response.versions);
    });

  });

}


/* ============================
   ✅ ARCHIVOS
============================ */

function listFiles() {

  return new Promise((resolve, reject) => {

    client.listFiles({}, (err, response) => {

      if (err) {
        console.error("List files error:", err);
        reject(err);
        return;
      }

      resolve(response.files);
    });

  });

}



module.exports = {
  uploadFile,           // (buffer, fileName)
  downloadFileStream,   // (fileName, version)
  getMetadata,          // (fileName, version)
  listVersions,         // (fileName)
  listFiles             // ()
};
