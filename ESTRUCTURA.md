# 📁 Estructura del Proyecto - Sistema de Archivos Distribuido

## 🏗️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                         NAVEGADOR WEB                           │
│                     http://localhost:3000                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              INTERFAZ WEB (Frontend)                     │  │
│  │  • HTML5 + CSS3 + JavaScript Vanilla                     │  │
│  │  • Drag & Drop                                           │  │
│  │  • Tabla de archivos                                     │  │
│  │  • Modal de versiones                                    │  │
│  │  • Notificaciones (Toasts)                              │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP REST API
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER (Gateway)                     │
│                      localhost:3000                             │
│                                                                 │
│  Endpoints:                                                     │
│  • POST   /upload           → Subir archivo                    │
│  • GET    /files            → Listar archivos                  │
│  • GET    /download/:file   → Descargar archivo               │
│  • GET    /versions/:file   → Listar versiones                │
│  • GET    /metadata/:file   → Obtener metadatos               │
│                                                                 │
└────────────────────────┬───────────────────────────────────────┘
                         │ gRPC Client
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      gRPC SERVER                                │
│                     localhost:5000                              │
│                                                                 │
│  Servicios:                                                     │
│  • UploadFile()      → Recibe chunks de archivos              │
│  • DownloadFile()    → Envía chunks de archivos               │
│  • ListFiles()       → Lista archivos disponibles              │
│  • ListVersions()    → Lista versiones de un archivo          │
│  • GetMetadata()     → Obtiene metadatos                       │
│                                                                 │
└────────────────────────┬───────────────────────────────────────┘
                         │ MinIO SDK
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MINIO (Object Storage)                      │
│                    Almacenamiento Distribuido                   │
│                                                                 │
│  • Buckets por archivo                                         │
│  • Versionamiento automático                                   │
│  • Replicación                                                 │
│  • Chunks de 64KB                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📂 Estructura de Carpetas

```
Proyecto-Final-Distribuidos/
│
├── 📄 INICIO_RAPIDO.md         # Guía de inicio rápido
├── 📄 PRUEBAS.md               # Guía de pruebas
├── 📄 docker-compose.yml       # Configuración de Docker
│
├── 📁 clientGRPC/              # Cliente/Gateway Express
│   ├── 📄 client.js            # Punto de entrada (inicia Express)
│   ├── 📄 package.json         # Dependencias del cliente
│   │
│   ├── 📁 express/             # Servidor Express
│   │   └── 📄 server.js        # API REST + servidor de archivos estáticos
│   │
│   ├── 📁 grpc/                # Cliente gRPC
│   │   └── 📄 storageClient.js # Conexión con servidor gRPC
│   │
│   ├── 📁 protos/              # Definiciones Protocol Buffers
│   │   └── 📄 storage.proto    # Definición de servicios gRPC
│   │
│   └── 📁 services/            # Servicios de negocio
│       └── 📄 fileService.js   # Lógica de manejo de archivos
│
├── 📁 Front/                   # Frontend (INTERFAZ WEB)
│   ├── 📄 index.html           # Interfaz principal
│   ├── 📄 styles.css           # Estilos CSS
│   ├── 📄 app.js               # Lógica JavaScript
│   ├── 📄 README.md            # Documentación del frontend
│   └── 📄 INTERFAZ.md          # Guía de la interfaz
│
├── 📁 serverGRPC/              # Servidor gRPC
│   ├── 📄 server.js            # Servidor gRPC principal
│   ├── 📄 config.js            # Configuración
│   ├── 📄 package.json         # Dependencias del servidor
│   ├── 📄 .env                 # Variables de entorno
│   │
│   ├── 📁 controllers/         # Controladores gRPC
│   │   ├── 📄 uploadController.js      # Subir archivos
│   │   ├── 📄 downloadController.js    # Descargar archivos
│   │   ├── 📄 listFilesController.js   # Listar archivos
│   │   ├── 📄 versionsController.js    # Versiones
│   │   └── 📄 metadataController.js    # Metadatos
│   │
│   ├── 📁 db/                  # Base de datos
│   │   ├── 📄 index.js         # Conexión SQLite
│   │   └── 📄 queries.js       # Consultas SQL
│   │
│   ├── 📁 minio/               # Cliente MinIO
│   │   └── 📄 clients.js       # Configuración de clientes MinIO
│   │
│   ├── 📁 protos/              # Definiciones Protocol Buffers
│   │   └── 📄 storage.proto    # Mismo que cliente
│   │
│   └── 📁 services/            # Servicios auxiliares
│       ├── 📄 chunkService.js          # Manejo de chunks
│       ├── 📄 minioHelpers.js          # Helpers de MinIO
│       ├── 📄 nodePicker.js            # Selección de nodos
│       ├── 📄 rebalanceService.js      # Rebalanceo
│       ├── 📄 reReplicationService.js  # Re-replicación
│       └── 📄 healthService.js         # Health checks
│
└── 📁 pruebasHTTP/             # Archivos de prueba
    ├── 📄 uploadFile.http      # Tests HTTP
    └── 📁 archivosdePrueba/    # Archivos para testing
        ├── 📄 test.txt
        ├── 📄 file.pdf
        ├── 📄 file2.pdf
        └── 📄 otro libro de prueba.pdf
```

---

## 🔄 Flujo de Datos

### 1️⃣ Subir Archivo

```
Usuario (Frontend)
    │
    │ 1. Selecciona archivo
    ▼
Navegador (app.js)
    │
    │ 2. FormData con archivo
    │ POST /upload
    ▼
Express Server (server.js)
    │
    │ 3. Multer convierte a buffer
    ▼
File Service (fileService.js)
    │
    │ 4. Divide en chunks de 64KB
    │ gRPC stream
    ▼
gRPC Server (uploadController.js)
    │
    │ 5. Recibe chunks
    │ Ensambla archivo
    ▼
MinIO (minio/clients.js)
    │
    │ 6. Guarda en bucket
    │ Versiona automáticamente
    ▼
Base de Datos (db/)
    │
    │ 7. Guarda metadata
    ▼
Respuesta → Express → Frontend
    │
    │ 8. Notificación de éxito
    ▼
Usuario ve archivo en tabla
```

### 2️⃣ Descargar Archivo

```
Usuario hace clic en descargar
    │
    ▼
Frontend solicita:
GET /download/archivo.txt?version=1
    │
    ▼
Express Server
    │
    ▼
File Service (downloadFileStream)
    │
    │ gRPC stream
    ▼
gRPC Server (downloadController.js)
    │
    ▼
MinIO recupera archivo + versión
    │
    │ Envía chunks de 64KB
    ▼
Express hace pipe al response
    │
    ▼
Navegador descarga archivo
```

### 3️⃣ Ver Versiones

```
Usuario hace clic en icono versiones
    │
    ▼
Frontend solicita:
GET /versions/archivo.txt
    │
    ▼
Express Server
    │
    ▼
File Service (listVersions)
    │
    │ gRPC call
    ▼
gRPC Server (versionsController.js)
    │
    ▼
Base de Datos + MinIO
    │
    │ Lista de versiones con metadata
    ▼
Frontend muestra modal con versiones
```

---

## 🛠️ Tecnologías Utilizadas

### Frontend
- **HTML5** - Estructura semántica
- **CSS3** - Diseño moderno con:
  - CSS Grid & Flexbox
  - Animaciones y transiciones
  - Variables CSS
  - Media queries (responsive)
- **JavaScript (ES6+)** - Lógica de aplicación:
  - Fetch API
  - Promises/Async-Await
  - DOM Manipulation
  - Event Handlers

### Backend (Gateway)
- **Node.js** - Runtime
- **Express.js** - Servidor HTTP
- **Multer** - Manejo de archivos multipart
- **@grpc/grpc-js** - Cliente gRPC
- **@grpc/proto-loader** - Carga de .proto

### Backend (gRPC Server)
- **Node.js** - Runtime
- **@grpc/grpc-js** - Servidor gRPC
- **MinIO SDK** - Cliente de almacenamiento
- **better-sqlite3** - Base de datos
- **uuid** - Generación de IDs
- **dotenv** - Variables de entorno

### Infraestructura
- **gRPC** - Comunicación cliente-servidor
- **Protocol Buffers** - Serialización de datos
- **MinIO** - Almacenamiento de objetos
- **SQLite** - Metadatos

---

## 🔐 Puertos y Servicios

| Servicio | Puerto | Protocolo | Descripción |
|----------|--------|-----------|-------------|
| Frontend | 3000 | HTTP | Interfaz web |
| API REST | 3000 | HTTP | Endpoints REST |
| gRPC Server | 5000 | gRPC | Servicios de archivos |
| MinIO | 9000 | HTTP | API de MinIO |
| MinIO Console | 9001 | HTTP | Consola web de MinIO |

---

## 📦 Archivos Clave

### 🎨 Frontend
- `Front/index.html` - Estructura HTML completa
- `Front/styles.css` - 600+ líneas de CSS moderno
- `Front/app.js` - Lógica JavaScript de la aplicación

### 🔌 API Gateway
- `express/server.js` - Servidor Express con endpoints REST

### 🔧 Servicios
- `services/fileService.js` - Lógica de manejo de archivos (upload, download, versions)
- `grpc/storageClient.js` - Cliente gRPC

### ⚙️ Servidor gRPC
- `serverGRPC/server.js` - Servidor principal
- `controllers/*.js` - Controladores para cada operación
- `minio/clients.js` - Configuración de clientes MinIO

### 📋 Configuración
- `protos/storage.proto` - Definición de servicios gRPC
- `package.json` - Dependencias y scripts
- `.env` - Variables de entorno (MinIO)

---

## 🚀 Comandos Rápidos

### Iniciar todo el sistema

**Terminal 1 - Servidor gRPC:**
```bash
cd serverGRPC
npm start
```

**Terminal 2 - Gateway + Frontend:**
```bash
cd clientGRPC
npm start
```

**Navegador:**
```
http://localhost:3000
```

### Alternativa con npm scripts

```bash
# Servidor gRPC
cd serverGRPC && npm run dev

# Cliente
cd clientGRPC && npm run dev
```

---

## 📊 Estadísticas del Proyecto

```
Frontend:
- index.html:     ~180 líneas
- styles.css:     ~900 líneas
- app.js:         ~400 líneas

Backend Gateway:
- server.js:      ~170 líneas
- fileService.js: ~155 líneas

Total Frontend: ~1,680 líneas
```

---

## 🎯 Características Implementadas

✅ **Subida de archivos** (drag & drop + selector)
✅ **Versionamiento automático** (mismo nombre = nueva versión)
✅ **Descarga de archivos** (cualquier versión)
✅ **Lista de archivos** (con metadatos)
✅ **Modal de versiones** (con animaciones)
✅ **Notificaciones** (éxito/error)
✅ **Estadísticas** (archivos totales, tamaño)
✅ **Responsive design** (móvil, tablet, desktop)
✅ **Animaciones CSS** (suaves y modernas)
✅ **Barra de progreso** (upload)
✅ **Estado vacío** (cuando no hay archivos)
✅ **Refresh manual** (botón actualizar)
✅ **Formateo inteligente** (tamaños, fechas)

---

## 💡 Próximas Mejoras (Opcionales)

- [ ] Búsqueda de archivos
- [ ] Filtros (por tipo, fecha, tamaño)
- [ ] Ordenamiento de tabla (por columna)
- [ ] Eliminación de archivos
- [ ] Renombrado de archivos
- [ ] Vista de carpetas/jerarquía
- [ ] Upload múltiple simultáneo
- [ ] Barra de progreso real (no simulada)
- [ ] Preview de archivos (imágenes, PDFs)
- [ ] Compartir archivos (links públicos)

---

**🎉 ¡Proyecto completo y funcional!**
