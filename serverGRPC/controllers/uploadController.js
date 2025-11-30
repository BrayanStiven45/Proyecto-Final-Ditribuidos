// controllers/uploadController.js (fragmento)
const { v4: uuidv4 } = require('uuid');
const { CHUNK_SIZE } = require('../config');
const {
  insertFileStmt,
  updateFileStmt,
  getLatestFileByName
} = require('../db/queries');
const { uploadChunkAndRecord } = require('../services/chunkService');

async function uploadFile(call, callback) {
  const newFileId = uuidv4(); // id para la nueva versión
  let filename = null;
  let totalSize = 0;
  let bufferAcc = Buffer.alloc(0);
  let chunkIndex = 0;
  let fileInserted = false;
  let newVersion = 1;

  call.on('data', (req) => {
    if (!filename && req.fileName) {
      filename = req.fileName;

      // Determine new version number (atomic-ish: read latest then insert)
      const latest = getLatestFileByName.get(filename);
      newVersion = latest ? (Number(latest.version) + 1) : 1;

      // Insert the new file row for this version (upload_time & size updated later)
      const now = new Date().toISOString();
      insertFileStmt.run(newFileId, filename, now, newVersion, 0);
      fileInserted = true;
    }

    // ... resto idéntico al original: acc usa bufferAcc, fragmentación, uploadChunkAndRecord ...
    const incoming = Buffer.isBuffer(req.fileData) ? req.fileData : Buffer.from(req.fileData || []);
    bufferAcc = Buffer.concat([bufferAcc, incoming]);
    totalSize += incoming.length;

    while (bufferAcc.length >= CHUNK_SIZE) {
      const chunkBuf = bufferAcc.slice(0, CHUNK_SIZE);
      bufferAcc = bufferAcc.slice(CHUNK_SIZE);
      uploadChunkAndRecord(newFileId, filename, chunkIndex, chunkBuf)
        .catch(err => console.error('Error uploading chunk', err && err.message ? err.message : err));
      chunkIndex++;
    }
  });

  call.on('end', async () => {
    try {
      if (!filename) filename = `unnamed_${newFileId}`;
      if (!fileInserted) {
        const now = new Date().toISOString();
        insertFileStmt.run(newFileId, filename, now, newVersion, 0);
        fileInserted = true;
      }
      if (bufferAcc.length > 0) {
        await uploadChunkAndRecord(newFileId, filename, chunkIndex, bufferAcc);
        chunkIndex++;
      }
      const nowFinal = new Date().toISOString();
      updateFileStmt.run(nowFinal, totalSize, newFileId);

      // devolver la version creada al cliente
      callback(null, { message: `Uploaded ${filename} as id=${newFileId}`, fileId: newFileId, version: newVersion });
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
