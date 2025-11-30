// controllers/metadataController.js
const { getFileByName, countChunks } = require('../db/queries');

function getMetadata(call, callback) {
  const fileName = call.request.fileName;
  const fileRow = getFileByName.get(fileName);
  if (!fileRow) return callback(null, { fileName: '', uploadTime: '', version: '', size: '0' });
  const row = countChunks.get(fileRow.id);
  callback(null, {
    fileName: fileRow.filename,
    uploadTime: fileRow.upload_time,
    version: String(fileRow.version),
    size: String(fileRow.size),
  });
}

module.exports = { getMetadata };
