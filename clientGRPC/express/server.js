// express/server.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const fileService = require('../services/fileService');

const app = express();
const PORT = 3000;

app.use(express.json());

// Serve static files from Front directory
app.use(express.static(path.join(__dirname, '../../Front')));

// Multer en memoria (NO disco)
const upload = multer({ storage: multer.memoryStorage() });


/* ============================
   UPLOAD → HTTP → fileService.uploadFile(buffer, fileName)
   (fileService se encarga de hablar con gRPC)
============================ */
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }

  const { originalname, buffer } = req.file;

  // Validaciones básicas
  if (!originalname || originalname.trim() === '') {
    return res.status(400).json({ error: 'Nombre de archivo inválido' });
  }

  if (!buffer || buffer.length === 0) {
    return res.status(400).json({ error: 'El archivo está vacío' });
  }

  try {
    console.log(`┌── Subiendo archivo: ${originalname} (${(buffer.length / 1024).toFixed(2)} KB)`);
    const grpcResponse = await fileService.uploadFile(buffer, originalname);
    console.log(`└── ✓ Archivo subido exitosamente: ${originalname}`);
    
    return res.json({
      message: 'Archivo subido exitosamente',
      fileName: originalname,
      size: buffer.length,
      grpc: grpcResponse
    });
  } catch (err) {
    console.error('✗ Upload error:', err);
    return res.status(500).json({ error: err.message || 'Error al subir el archivo' });
  }
});


/* ============================
   DOWNLOAD → fileService.downloadFileStream → HTTP response
============================ */
app.get('/download/:fileName', (req, res) => {
  const { fileName } = req.params;
  const version = req.query.version ? Number(req.query.version) : 0;

  if (!fileName || fileName.trim() === '') {
    return res.status(400).json({ error: 'Nombre de archivo inválido' });
  }

  try {
    console.log(`┌── Descargando: ${fileName} (versión ${version})`);
    const stream = fileService.downloadFileStream(fileName, version);

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');

    stream.on('error', (err) => {
      console.error('✗ Download stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Error al descargar el archivo' });
      } else {
        res.end();
      }
    });

    stream.on('end', () => {
      console.log(`└── ✓ Descarga completada: ${fileName}`);
    });

    // Pipe stream directly to response
    stream.pipe(res);

  } catch (err) {
    console.error('✗ Download error:', err);
    return res.status(500).json({ error: err.message || 'Error al descargar el archivo' });
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

  if (!fileName || fileName.trim() === '') {
    return res.status(400).json({ error: 'Nombre de archivo inválido' });
  }

  try {
    const metadata = await fileService.getMetadata(fileName, version);
    return res.json(metadata);
  } catch (err) {
    console.error('✗ Metadata error:', err);
    return res.status(500).json({ error: err.message || 'Error al obtener metadatos' });
  }
});


/* ============================
   VERSIONS → fileService.listVersions(fileName)
============================ */
app.get('/versions/:fileName', async (req, res) => {
  const { fileName } = req.params;

  if (!fileName || fileName.trim() === '') {
    return res.status(400).json({ error: 'Nombre de archivo inválido' });
  }

  try {
    const versions = await fileService.listVersions(fileName);
    return res.json(versions);
  } catch (err) {
    console.error('✗ List versions error:', err);
    return res.status(500).json({ error: err.message || 'Error al listar versiones' });
  }
});


/* ============================
   FILES → fileService.listFiles()
============================ */
app.get('/files', async (req, res) => {
  try {
    const files = await fileService.listFiles();
    console.log(`ℹ Archivos listados: ${files.length} archivo(s)`);
    return res.json(files);
  } catch (err) {
    console.error('✗ List files error:', err);
    return res.status(500).json({ error: err.message || 'Error al listar archivos' });
  }
});


// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../Front/index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔${'═'.repeat(70)}╗`);
  console.log(`║  🚀 Express Gateway & Frontend Server                              ║`);
  console.log(`╠${'─'.repeat(70)}╣`);
  console.log(`║  🌐 Server:   http://localhost:${PORT}${' '.repeat(42)}║`);
  console.log(`║  📱 Frontend: http://localhost:${PORT}${' '.repeat(42)}║`);
  console.log(`║  📁 API:      http://localhost:${PORT}/files, /upload, /download  ║`);
  console.log(`╚${'═'.repeat(70)}╝
`);
});
