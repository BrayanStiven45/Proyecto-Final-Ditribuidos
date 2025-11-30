// controllers/versionsController.js
const { listFileVersions } = require('../db/queries');

function listVersions(call, callback) {
  const fileName = call.request.fileName;
  const versions = listFileVersions.all(fileName).map(v => ({
    fileId: v.fileId,
    version: v.version,
    uploadTime: v.uploadTime,
    size: String(v.size)
  }));
  callback(null, { versions });
}

module.exports = { listVersions };
