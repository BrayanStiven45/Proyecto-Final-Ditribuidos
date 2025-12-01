# 🚀 Inicio Rápido - Sistema de Archivos Distribuido

## Pasos para iniciar el sistema completo

### 1️⃣ Iniciar el Servidor gRPC (Backend)

Abre una terminal y ejecuta:

```powershell
cd serverGRPC
node server.js
```

Deberías ver un mensaje como:
```
🚀 gRPC Server listening on port 5000
```

### 2️⃣ Iniciar el Cliente/Gateway (Frontend + API)

Abre **otra terminal** y ejecuta:

```powershell
cd clientGRPC
node client.js
```

Deberías ver mensajes como:
```
🚀 Express Gateway running on http://localhost:3000
📱 Frontend available at http://localhost:3000
```

### 3️⃣ Abrir la Interfaz Web

Abre tu navegador favorito y visita:
```
http://localhost:3000
```

## ✨ ¡Listo!

Ahora puedes:
- ✅ Subir archivos (drag & drop o seleccionar)
- ✅ Ver todos tus archivos en una tabla elegante
- ✅ Descargar archivos
- ✅ Ver versiones de cada archivo
- ✅ Descargar versiones específicas
- ✅ Subir archivos con el mismo nombre para crear versiones automáticamente

## 🎯 Características de la Interfaz

### Subir Archivos
1. Arrastra un archivo a la zona de subida o haz clic en "Seleccionar Archivo"
2. Verás el nombre y tamaño del archivo seleccionado
3. Haz clic en "Subir Archivo"
4. Recibirás una notificación cuando termine

### Ver Versiones
1. Busca el archivo en la tabla
2. Haz clic en el icono de reloj (🔄) en la columna "Acciones"
3. Se abrirá un modal con todas las versiones
4. Puedes descargar cualquier versión

### Descargar Archivos
- Haz clic en el icono de descarga (⬇️) para descargar la versión actual
- O selecciona una versión específica desde el modal de versiones

## 🔄 Crear Nueva Versión

Para crear una nueva versión de un archivo:
1. Sube un archivo con **exactamente el mismo nombre**
2. El sistema automáticamente creará una nueva versión
3. La versión anterior se mantendrá disponible

## 🛠️ Requisitos Previos

Asegúrate de tener:
- Node.js instalado
- MinIO configurado y corriendo
- Todas las dependencias instaladas (`npm install` en ambas carpetas)

## 🎨 Paleta de Colores

La interfaz usa una paleta moderna de colores:
- **Primario**: Morado (#667eea)
- **Secundario**: Morado oscuro (#764ba2)
- **Éxito**: Verde (#10b981)
- **Error**: Rojo (#ef4444)

## 📱 Responsive

La interfaz se adapta perfectamente a:
- 💻 Desktop
- 📱 Móvil
- 📱 Tablets

## ⚙️ Configuración

Si necesitas cambiar el puerto del servidor, edita:

**clientGRPC/express/server.js:**
```javascript
const PORT = 3000; // Cambia este valor
```

**clientGRPC/public/app.js:**
```javascript
const API_URL = 'http://localhost:3000'; // Cambia el puerto aquí también
```

## 🐛 Solución de Problemas

### El frontend no carga
- Verifica que el servidor Express esté corriendo en el puerto 3000
- Revisa la consola de la terminal para ver errores

### No se pueden subir archivos
- Verifica que el servidor gRPC esté corriendo en el puerto 5000
- Revisa que MinIO esté configurado correctamente

### No aparecen los archivos
- Refresca la página
- Haz clic en el botón "Actualizar"
- Verifica la consola del navegador (F12) para ver errores

## 📞 Soporte

Si tienes problemas:
1. Revisa la consola del navegador (F12)
2. Revisa las terminales del servidor gRPC y Express
3. Verifica que todos los servicios estén corriendo

---

**¡Disfruta tu sistema de archivos distribuido! 🎉**
