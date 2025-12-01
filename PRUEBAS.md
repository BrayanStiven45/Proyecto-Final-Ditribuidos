# 🧪 Guía de Pruebas del Sistema

## Pruebas Funcionales

### 1. Probar Subida de Archivos

#### Prueba 1: Subir archivo de texto
1. Abre http://localhost:3000
2. Arrastra o selecciona `pruebasHTTP/archivosdePrueba/test.txt`
3. Haz clic en "Subir Archivo"
4. Verifica que aparezca la notificación de éxito
5. Comprueba que el archivo aparece en la tabla

**Resultado esperado:** ✅ Archivo subido y visible en la tabla

#### Prueba 2: Subir archivo PDF
1. Selecciona uno de los PDFs de prueba
2. Sube el archivo
3. Verifica que aparezca en la tabla con el icono "PDF"

**Resultado esperado:** ✅ PDF visible con extensión correcta

#### Prueba 3: Drag & Drop
1. Arrastra un archivo directamente a la zona de subida
2. La zona debe cambiar de apariencia (efecto visual)
3. El archivo debe aparecer seleccionado
4. Sube el archivo

**Resultado esperado:** ✅ Drag & drop funcional con feedback visual

---

### 2. Probar Versionamiento

#### Prueba 1: Crear nueva versión
1. Sube `test.txt`
2. Edita `test.txt` en tu editor (cambia el contenido)
3. Vuelve a subir `test.txt` con el mismo nombre
4. Haz clic en el botón de versiones (🔄)
5. Verifica que aparezcan 2 versiones

**Resultado esperado:** ✅ Sistema muestra 2 versiones del archivo

#### Prueba 2: Crear múltiples versiones
1. Sube el mismo archivo 5 veces (editándolo entre cada subida)
2. Verifica que el badge muestre "5 versiones"
3. Abre el modal de versiones
4. Comprueba que las 5 versiones estén listadas

**Resultado esperado:** ✅ Todas las versiones visibles y ordenadas

---

### 3. Probar Descargas

#### Prueba 1: Descargar versión actual
1. Haz clic en el botón de descarga (⬇️) en cualquier archivo
2. Verifica que se inicie la descarga
3. Comprueba que el archivo descargado sea correcto

**Resultado esperado:** ✅ Archivo descargado correctamente

#### Prueba 2: Descargar versión específica
1. Abre el modal de versiones de un archivo con múltiples versiones
2. Haz clic en "Descargar esta versión" en una versión antigua
3. Verifica que se descargue la versión correcta

**Resultado esperado:** ✅ Versión específica descargada

#### Prueba 3: Descargas simultáneas
1. Descarga varios archivos rápidamente
2. Verifica que todas las descargas se inicien
3. Comprueba que no haya errores en la consola

**Resultado esperado:** ✅ Múltiples descargas sin conflictos

---

### 4. Probar Interfaz

#### Prueba 1: Responsive Design
1. Abre las DevTools (F12)
2. Cambia a vista móvil (Toggle Device Toolbar)
3. Prueba diferentes tamaños: iPhone, iPad, Desktop
4. Verifica que todo se vea bien en cada tamaño

**Resultado esperado:** ✅ Interfaz adaptada a todos los tamaños

#### Prueba 2: Animaciones
1. Hover sobre botones
2. Observa las transiciones
3. Abre y cierra el modal
4. Observa las notificaciones (toasts)

**Resultado esperado:** ✅ Animaciones suaves y sin lag

#### Prueba 3: Estados de UI
1. Selecciona un archivo → botón de subir se habilita
2. Sube un archivo → botón muestra loading
3. Lista vacía → muestra estado vacío
4. Refresca → botón rota

**Resultado esperado:** ✅ Estados visuales correctos

---

### 5. Probar Estadísticas

#### Prueba 1: Contador de archivos
1. Observa el número inicial en el header
2. Sube un nuevo archivo
3. Verifica que el contador aumente

**Resultado esperado:** ✅ Contador actualizado automáticamente

#### Prueba 2: Tamaño total
1. Observa el tamaño total inicial
2. Sube archivos de diferentes tamaños
3. Verifica que el tamaño total aumente correctamente

**Resultado esperado:** ✅ Tamaño calculado correctamente

---

### 6. Probar Modal de Versiones

#### Prueba 1: Abrir y cerrar
1. Haz clic en el botón de versiones
2. El modal debe aparecer con animación
3. Cierra con el botón X
4. Vuelve a abrir
5. Cierra haciendo clic fuera del modal

**Resultado esperado:** ✅ Modal abre y cierra correctamente

#### Prueba 2: Scroll en versiones
1. Crea un archivo con 10+ versiones
2. Abre el modal
3. Verifica que haya scroll
4. Desplázate por todas las versiones

**Resultado esperado:** ✅ Scroll funcional con muchas versiones

---

### 7. Probar Notificaciones

#### Prueba 1: Notificación de éxito
1. Sube un archivo
2. Observa la notificación verde en la esquina
3. Espera 3 segundos
4. Verifica que desaparezca

**Resultado esperado:** ✅ Toast de éxito aparece y desaparece

#### Prueba 2: Notificación de error
1. Detén el servidor gRPC
2. Intenta subir un archivo
3. Observa la notificación roja

**Resultado esperado:** ✅ Toast de error aparece

---

### 8. Probar Botón Actualizar

#### Prueba 1: Recargar lista
1. Sube un archivo desde otra ventana/dispositivo
2. Haz clic en "Actualizar"
3. Verifica que el nuevo archivo aparezca

**Resultado esperado:** ✅ Lista actualizada correctamente

#### Prueba 2: Animación de botón
1. Haz clic en "Actualizar"
2. Observa que el icono rota

**Resultado esperado:** ✅ Feedback visual al actualizar

---

## 🧪 Pruebas de Integración

### Flujo Completo 1: Subir, Versionar y Descargar
```
1. Sube test.txt
2. Edita test.txt localmente
3. Sube test.txt nuevamente
4. Abre versiones
5. Descarga versión 1
6. Descarga versión 2
7. Compara los contenidos
```

**Resultado esperado:** ✅ Versiones diferentes descargadas correctamente

### Flujo Completo 2: Múltiples Archivos
```
1. Sube 5 archivos diferentes
2. Verifica que todos aparezcan en la tabla
3. Verifica estadísticas (5 archivos, tamaño total)
4. Descarga uno de los archivos
5. Verifica su contenido
```

**Resultado esperado:** ✅ Gestión correcta de múltiples archivos

### Flujo Completo 3: Ciclo de Vida
```
1. Sistema vacío → muestra estado vacío
2. Sube primer archivo → estado vacío desaparece
3. Sube más archivos → contador aumenta
4. Versiona archivos → badge de versiones aumenta
5. Descarga versiones → archivos correctos
```

**Resultado esperado:** ✅ Ciclo completo sin errores

---

## 🐛 Pruebas de Manejo de Errores

### Prueba 1: Servidor caído
1. Detén el servidor gRPC
2. Intenta subir un archivo
3. Verifica notificación de error
4. Intenta actualizar lista
5. Verifica notificación de error

**Resultado esperado:** ✅ Errores manejados con notificaciones

### Prueba 2: Archivo muy grande
1. Intenta subir un archivo > 100MB
2. Verifica que funcione (puede tardar)
3. Observa el progreso

**Resultado esperado:** ✅ Archivos grandes manejados correctamente

### Prueba 3: Caracteres especiales en nombre
1. Sube un archivo con nombre: `test (1) - copia [2].txt`
2. Descárgalo
3. Verifica que el nombre sea correcto

**Resultado esperado:** ✅ Nombres especiales manejados correctamente

---

## 📊 Pruebas de Rendimiento

### Prueba 1: Muchos archivos
1. Sube 50+ archivos
2. Verifica que la tabla se renderice rápidamente
3. Scroll debe ser fluido

**Resultado esperado:** ✅ Rendimiento fluido con muchos archivos

### Prueba 2: Actualizaciones frecuentes
1. Haz clic en "Actualizar" 10 veces rápidamente
2. Verifica que no haya errores
3. La interfaz debe responder

**Resultado esperado:** ✅ Sin problemas con actualizaciones rápidas

---

## ✅ Checklist de Pruebas

Marca cada prueba realizada:

**Funcionalidades Básicas:**
- [ ] Subir archivo de texto
- [ ] Subir archivo PDF
- [ ] Drag & drop funciona
- [ ] Descargar archivo
- [ ] Ver lista de archivos
- [ ] Actualizar lista

**Versionamiento:**
- [ ] Crear nueva versión
- [ ] Ver lista de versiones
- [ ] Descargar versión específica
- [ ] Badge de versiones actualiza

**Interfaz:**
- [ ] Responsive en móvil
- [ ] Responsive en tablet
- [ ] Responsive en desktop
- [ ] Animaciones suaves
- [ ] Estados visuales correctos

**Estadísticas:**
- [ ] Contador de archivos actualiza
- [ ] Tamaño total actualiza

**Modal:**
- [ ] Abre correctamente
- [ ] Cierra con X
- [ ] Cierra con clic fuera
- [ ] Scroll funciona

**Notificaciones:**
- [ ] Toast de éxito aparece
- [ ] Toast de error aparece
- [ ] Toast desaparece automáticamente

**Manejo de Errores:**
- [ ] Error de servidor manejado
- [ ] Error de red manejado
- [ ] Nombres especiales funcionan

---

## 🎯 Resultado Final

Si todas las pruebas pasan: **✅ Sistema completamente funcional y listo para producción**

---

## 📝 Notas de Prueba

Usa este espacio para anotar problemas o mejoras:

```
Fecha: _____________
Probado por: _____________

Problemas encontrados:
1. 
2. 
3. 

Sugerencias de mejora:
1. 
2. 
3. 
```
