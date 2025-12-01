# Sistema de Archivos Distribuido - Frontend

## 🎨 Características

- **Interfaz Moderna y Elegante**: Diseño con gradientes, animaciones y efectos visuales
- **Tabla de Archivos**: Visualiza todos tus archivos con información detallada
- **Subir Archivos**: Interfaz drag-and-drop para subir archivos fácilmente
- **Sistema de Versiones**: Ver y descargar versiones anteriores de archivos
- **Descargar Archivos**: Descarga cualquier archivo o versión específica
- **Responsive**: Funciona en dispositivos móviles y escritorio

## 🚀 Cómo Usar

### 1. Iniciar el Servidor gRPC
Primero, asegúrate de que el servidor gRPC esté corriendo:

```bash
cd serverGRPC
node server.js
```

### 2. Iniciar el Cliente/Gateway
Luego, inicia el servidor Express que servirá el frontend:

```bash
cd clientGRPC
node client.js
```

### 3. Acceder a la Interfaz
Abre tu navegador y visita:
```
http://localhost:3000
```

## 📋 Funcionalidades

### Subir Archivos
1. Haz clic en "Seleccionar Archivo" o arrastra un archivo a la zona de carga
2. Haz clic en "Subir Archivo"
3. El archivo se subirá al sistema distribuido MinIO

**Nota**: Si subes un archivo con el mismo nombre que uno existente, el sistema automáticamente creará una nueva versión.

### Ver Archivos
- La tabla muestra todos los archivos disponibles
- Puedes ver: nombre, tamaño, fecha de última modificación y número de versiones

### Descargar Archivos
- Haz clic en el botón de descarga (⬇️) en la fila del archivo
- El archivo se descargará automáticamente

### Ver Versiones
1. Haz clic en el botón de versiones (🔄) en la fila del archivo
2. Se abrirá un modal mostrando todas las versiones disponibles
3. Cada versión muestra: número de versión, tamaño, fecha
4. Puedes descargar cualquier versión específica

### Actualizar Lista
- Haz clic en el botón "Actualizar" para recargar la lista de archivos

## 🎯 Endpoints API Disponibles

El frontend se conecta a estos endpoints:

- `POST /upload` - Subir archivo
- `GET /files` - Listar todos los archivos
- `GET /download/:fileName` - Descargar archivo (versión actual)
- `GET /download/:fileName?version=N` - Descargar versión específica
- `GET /versions/:fileName` - Listar versiones de un archivo
- `GET /metadata/:fileName` - Obtener metadatos de un archivo

## 🎨 Diseño

El frontend cuenta con:
- Gradientes en colores morado/azul (#667eea, #764ba2)
- Animaciones suaves y transiciones
- Iconos SVG personalizados
- Sistema de notificaciones (toasts)
- Modal para versiones
- Drag and drop para subir archivos
- Efectos hover en botones y elementos interactivos

## 🛠️ Tecnologías

- **HTML5**: Estructura semántica
- **CSS3**: Diseño moderno con animaciones y gradientes
- **JavaScript Vanilla**: Sin frameworks, solo JS puro
- **Express.js**: Servidor backend
- **gRPC**: Comunicación con el servidor de archivos
- **MinIO**: Almacenamiento distribuido

## 📱 Responsive

La interfaz es completamente responsive y se adapta a:
- Desktop (1400px+)
- Tablets (768px - 1399px)
- Mobile (< 768px)

## 🔧 Personalización

Puedes personalizar los colores editando las variables CSS en `styles.css`:

```css
:root {
    --primary: #667eea;
    --primary-dark: #5568d3;
    --secondary: #764ba2;
    --success: #10b981;
    --danger: #ef4444;
    --warning: #f59e0b;
}
```

## 💡 Notas

- Los archivos se suben en chunks de 64KB para mejor rendimiento
- El sistema automáticamente versiona archivos con el mismo nombre
- Las estadísticas en el header se actualizan automáticamente
- Las notificaciones desaparecen después de 3 segundos
