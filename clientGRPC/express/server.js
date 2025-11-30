// express/server.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const fileService = require('../services/fileService');

const app = express();
const PORT = 3000;

app.use(express.json());

// Multer en memoria (NO disco)
const upload = multer({ storage: multer.memoryStorage() });


/* ============================
   UPLOAD → HTTP → fileService.uploadFile(buffer, fileName)
   (fileService se encarga de hablar con gRPC)
============================ */
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file received' });
  }

  const { originalname, buffer } = req.file;

  try {
    const grpcResponse = await fileService.uploadFile(buffer, originalname);
    return res.json({
      message: 'Archivo recibido por HTTP y enviado al servidor gRPC',
      grpc: grpcResponse
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message || err });
  }
});


/* ============================
   DOWNLOAD → fileService.downloadFileStream → HTTP response
============================ */
app.get('/download/:fileName', (req, res) => {
  const { fileName } = req.params;
  const version = req.query.version ? Number(req.query.version) : 0;

  try {
    const stream = fileService.downloadFileStream(fileName, version);

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    stream.on('error', (err) => {
      console.error('Download stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || err });
      } else {
        res.end();
      }
    });

    // Pipe stream directly to response
    stream.pipe(res);

  } catch (err) {
    console.error('Download error:', err);
    return res.status(500).json({ error: err.message || err });
  }
});

// endpoint solo para testing
app.get('/download-save/:fileName', async (req, res) => {
  const { fileName } = req.params;
  const version = req.query.version ? Number(req.query.version) : 0;

  try {
    const stream = fileService.downloadFileStream(fileName, version);
    
    // Crear carpeta de descargas si no existe
    const downloadDir = path.join(__dirname, '../../pruebasHTTP/descargas');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    
    const filePath = path.join(downloadDir, fileName);
    const writeStream = fs.createWriteStream(filePath);

    stream.pipe(writeStream);

    writeStream.on('finish', () => {
      res.json({ 
        message: 'Archivo descargado y guardado localmente',
        savedTo: filePath 
      });
    });

    stream.on('error', (err) => {
      console.error('Download stream error:', err);
      res.status(500).json({ error: err.message || err });
    });

  } catch (err) {
    console.error('Download error:', err);
    return res.status(500).json({ error: err.message || err });
  }
});



/* ============================
   METADATA → fileService.getMetadata(fileName, version)
============================ */
app.get('/metadata/:fileName', async (req, res) => {
  const { fileName } = req.params;
  const version = req.query.version ? Number(req.query.version) : 0;

  try {
    const metadata = await fileService.getMetadata(fileName, version);
    return res.json(metadata);
  } catch (err) {
    console.error('Metadata error:', err);
    return res.status(500).json({ error: err.message || err });
  }
});


/* ============================
   VERSIONS → fileService.listVersions(fileName)
============================ */
app.get('/versions/:fileName', async (req, res) => {
  const { fileName } = req.params;

  try {
    const versions = await fileService.listVersions(fileName);
    return res.json(versions);
  } catch (err) {
    console.error('List versions error:', err);
    return res.status(500).json({ error: err.message || err });
  }
});


/* ============================
   FILES → fileService.listFiles()
============================ */
app.get('/files', async (req, res) => {
  try {
    const files = await fileService.listFiles();
    return res.json(files);
  } catch (err) {
    console.error('List files error:', err);
    return res.status(500).json({ error: err.message || err });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Express Gateway running on http://localhost:${PORT}`);
});
