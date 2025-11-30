// controllers/uploadController.js
const { v4: uuidv4 } = require('uuid');
const { insertFileStmt, updateFileStmt } = require('../db/queries');
const { CHUNK_SIZE } = require('../config');
const { uploadChunkAndRecord } = require('../services/chunkService');

async function uploadFile(call, callback) {
  const fileId = uuidv4();
  let filename = null;
  let totalSize = 0;
  let bufferAcc = Buffer.alloc(0);
  let chunkIndex = 0;
  let fileInserted = false;

  call.on('data', (req) => {
    if (!filename && req.fileName) filename = req.fileName;
    if (filename && !fileInserted) {
      const now = new Date().toISOString();
      insertFileStmt.run(fileId, filename, now, 1, 0);
      fileInserted = true;
    }

    const incoming = Buffer.isBuffer(req.fileData) ? req.fileData : Buffer.from(req.fileData || []);
    bufferAcc = Buffer.concat([bufferAcc, incoming]);
    totalSize += incoming.length;

    while (bufferAcc.length >= CHUNK_SIZE) {
      const chunkBuf = bufferAcc.slice(0, CHUNK_SIZE);
      bufferAcc = bufferAcc.slice(CHUNK_SIZE);
      uploadChunkAndRecord(fileId, filename, chunkIndex, chunkBuf)
        .catch(err => console.error('Error uploading chunk', err && err.message ? err.message : err));
      chunkIndex++;
    }
  });

  call.on('end', async () => {
    try {
      if (!filename) filename = `unnamed_${fileId}`;
      if (!fileInserted) {
        const now = new Date().toISOString();
        insertFileStmt.run(fileId, filename, now, 1, 0);
        fileInserted = true;
      }
      if (bufferAcc.length > 0) {
        await uploadChunkAndRecord(fileId, filename, chunkIndex, bufferAcc);
        chunkIndex++;
      }
      const nowFinal = new Date().toISOString();
      updateFileStmt.run(nowFinal, totalSize, fileId);
      callback(null, { message: `Uploaded ${filename} as id=${fileId}`, fileId });
    } catch (err) {
      console.error('Error finalizing upload:', err && err.message ? err.message : err);
      callback(err);
    }
  });

  call.on('error', (err) => {
    console.error('Upload stream error:', err);
    callback(err);
  });
}

module.exports = { uploadFile };
