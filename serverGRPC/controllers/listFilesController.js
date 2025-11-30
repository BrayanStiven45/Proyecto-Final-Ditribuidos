const { listLatestFiles } = require('../db/queries');

async function listFiles(call, callback) {
  try {
    const rows = listLatestFiles.all();

    const files = rows.map(row => ({
      fileName: row.filename,
      latestVersion: row.version,
      uploadTime: row.upload_time,
      size: row.size
    }));

    callback(null, { files });

  } catch (error) {
    console.error("Error listing files:", error);
    callback(error);
  }
}

module.exports = { listFiles };
