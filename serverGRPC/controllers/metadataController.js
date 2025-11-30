// controllers/metadataController.js
const { getLatestFileByName, getFileByNameAndVersion, countChunks } = require('../db/queries');

function getMetadata(call, callback) {
  const fileName = call.request.fileName;
  const requestedVersion = call.request.version || null;

  const fileRow = requestedVersion
    ? getFileByNameAndVersion.get(fileName, requestedVersion)
    : getLatestFileByName.get(fileName);

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
