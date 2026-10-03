# 📁 Sistema de Explorador de Archivos - DEFENDER Panel

## 🎉 Características Implementadas

### ✨ Interfaz Mejorada

El explorador de archivos ahora cuenta con una interfaz profesional similar a los administradores de archivos modernos:

#### 🗂️ Barra de Navegación
- **Botón Atrás (◀)**: Retrocede al directorio anterior
- **Botón Home (🏠)**: Va directamente a `C:\Users\Maria`
- **Campo de Ruta**: Muestra y permite editar la ruta actual
- **Botón Ir**: Navega a la ruta especificada
- **Botón Refrescar (🔄)**: Actualiza el listado del directorio actual
- **Botón Subir Archivo (📤)**: Permite subir archivos al directorio actual

#### 🔖 Accesos Rápidos
Botones de acceso directo a carpetas comunes:
- **🖥️ Escritorio**: `C:\Users\Maria\Desktop`
- **📄 Documentos**: `C:\Users\Maria\Documents`
- **📥 Descargas**: `C:\Users\Maria\Downloads`
- **📦 Programas**: `C:\Program Files`
- **📦 Programas (x86)**: `C:\Program Files (x86)`
- **⚙️ AppData**: `C:\Users\Maria\AppData`

#### 📋 Lista de Archivos
Cada archivo/carpeta muestra:
- **Icono**: Icono visual según el tipo de archivo
- **Nombre**: Nombre completo del archivo/carpeta
- **Tamaño**: Tamaño del archivo (archivos) o `<DIR>` (carpetas)
- **Fecha**: Fecha y hora de la última modificación
- **Acciones**:
  - **📥 Descargar**: Descarga el archivo al navegador
  - **🗑️ Eliminar**: Elimina el archivo (con confirmación)

### 🎨 Iconos por Tipo de Archivo

El sistema reconoce automáticamente los siguientes tipos de archivos:

| Tipo | Iconos | Extensiones |
|------|--------|-------------|
| **Carpetas** | 📁 | - |
| **Documentos** | 📄📝📕📊📰 | txt, doc, docx, pdf, xls, xlsx, csv, ppt, pptx |
| **Imágenes** | 🖼️🎨 | jpg, jpeg, png, gif, bmp, svg, ico, webp |
| **Videos** | 🎬 | mp4, avi, mkv, mov, wmv, flv |
| **Audio** | 🎵 | mp3, wav, flac, aac, ogg, m4a |
| **Archivos comprimidos** | 📦 | zip, rar, 7z, tar, gz |
| **Código** | 📜🐍☕⚙️🌐🎨🐘💎🔵🦀 | js, ts, py, java, cpp, c, html, css, json, xml, php, rb, go, rs |
| **Ejecutables** | ⚙️🔧 | exe, msi, bat, sh, cmd, dll, sys |
| **Bases de datos** | 🗄️ | db, sql, sqlite |
| **Configuración** | ⚙️📋 | log, ini, cfg, conf, md |

### 🚀 Funcionalidades

#### 1. Navegación
- **Doble clic en carpeta**: Entra a la carpeta
- **Botón "⬆️ .."**: Sube un nivel (directorio padre)
- **Escribir ruta + Enter**: Navega a la ruta especificada
- **Accesos rápidos**: Botones para ir a carpetas comunes

#### 2. Descarga de Archivos
- Haz clic en "📥 Descargar" junto al archivo
- El archivo se descargará automáticamente al navegador
- Límite: 25 MB por archivo

#### 3. Subida de Archivos
1. Haz clic en "📤 Subir archivo"
2. Selecciona el archivo desde tu computadora
3. El archivo se subirá al directorio actual del dispositivo remoto
4. La lista se actualizará automáticamente

#### 4. Eliminación de Archivos
1. Haz clic en "🗑️ Eliminar" junto al archivo
2. Confirma la acción en el diálogo
3. El archivo se eliminará del dispositivo remoto
4. La lista se actualizará automáticamente

### 💻 Cambios Técnicos

#### Frontend (app.js)
- ✅ Función `navigateParent()`: Navega al directorio anterior
- ✅ Función `navigateHome()`: Va al directorio home del usuario
- ✅ Función `navigateToQuick(folder)`: Accesos rápidos a carpetas comunes
- ✅ Función `renderFileList(data)`: Renderizado mejorado con más información
- ✅ Función `confirmDeleteFile(filepath)`: Elimina archivos con confirmación
- ✅ Función `getFileIcon(filename)`: Asigna iconos según extensión
- ✅ Mejoras en `uploadFile()`: Mejor manejo de errores y feedback
- ✅ Estado de carga: Muestra spinner mientras carga archivos

#### Backend Agent (agent.js)
- ✅ Función `listDirectory()` mejorada:
  - Manejo de errores más robusto
  - Devuelve fecha de modificación de archivos
  - Mejor detección de carpetas vs archivos
  - Soporte para rutas absolutas y relativas
- ✅ Socket handler `delete-file`: Elimina archivos del sistema remoto
- ✅ Auto-actualización: Refresca listado después de subir/eliminar

#### UI/UX (style.css)
- ✅ Diseño responsive y moderno
- ✅ Animaciones suaves al hacer hover
- ✅ Estados visuales claros (hover, carga, errores)
- ✅ Barra de accesos rápidos con scroll horizontal
- ✅ Botones de navegación intuitivos
- ✅ Iconos visuales para mejor identificación
- ✅ Indicadores de tamaño y fecha
- ✅ Acciones contextuales que aparecen al hover

### 📸 Capturas de Pantalla

La interfaz se parece a esto:

```
╔═══════════════════════════════════════════════════════════════════╗
║  ◀ 🏠 📂 C:\Users\Maria                              [Ir] 🔄 📤   ║
╠═══════════════════════════════════════════════════════════════════╣
║ 🖥️ Escritorio | 📄 Documentos | 📥 Descargas | 📦 Programas ... ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  ⬆️ ..                                                            ║
║  📁 .aws                          <DIR>       2024-10-03 14:23   ║
║  📁 .cache                        <DIR>       2024-10-03 14:23   ║
║  📁 Desktop                       <DIR>       2024-10-03 12:15   ║
║  📁 Documents                     <DIR>       2024-10-02 18:45   ║
║  📁 Downloads                     <DIR>       2024-10-03 09:30   ║
║  📄 notas.txt          2.5 KB    2024-10-01 16:20  [📥][🗑️]    ║
║  🖼️ foto.jpg          156 KB    2024-09-28 11:45  [📥][🗑️]    ║
║  📦 proyecto.zip        8.2 MB   2024-10-02 20:10  [📥][🗑️]    ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### 🔐 Seguridad

- ✅ Confirmación obligatoria antes de eliminar archivos
- ✅ Validación de rutas en el servidor
- ✅ Límite de tamaño de archivos (25 MB para descarga)
- ✅ Manejo seguro de caracteres especiales en nombres de archivo
- ✅ Solo el usuario autenticado puede acceder al explorador

### 🎯 Próximas Mejoras Sugeridas

1. **Selección múltiple**: Checkbox para seleccionar varios archivos
2. **Operaciones batch**: Descargar/eliminar múltiples archivos
3. **Vista previa**: Previsualizar imágenes y archivos de texto
4. **Búsqueda**: Buscar archivos por nombre
5. **Ordenamiento**: Ordenar por nombre, tamaño, fecha
6. **Crear carpetas**: Botón para crear nuevas carpetas
7. **Renombrar**: Renombrar archivos y carpetas
8. **Copiar/Mover**: Copiar o mover archivos entre directorios
9. **Comprimir/Descomprimir**: Crear/extraer archivos ZIP
10. **Editor de texto**: Editar archivos de texto directamente

### 🚦 Cómo Usar

1. **Iniciar el servidor**:
   ```bash
   cd server
   npm install
   node server.js
   ```

2. **Iniciar el agente** en el dispositivo remoto:
   ```bash
   cd agent
   npm install
   node agent.js
   ```

3. **Acceder al panel**:
   - Abre el navegador en `http://localhost:3000`
   - Inicia sesión (usuario: `admin`, contraseña: `admin`)
   - Selecciona un dispositivo
   - Haz clic en "📁 Archivos" en la barra lateral

4. **Navegar**:
   - Usa los accesos rápidos o escribe una ruta
   - Doble clic en carpetas para entrar
   - Usa los botones de acción para descargar/eliminar

### 📝 Notas Importantes

- El agente debe estar ejecutándose en el dispositivo remoto
- El dispositivo debe estar marcado como "Online" (🟢)
- Las rutas son específicas de Windows (usa `\` como separador)
- Los archivos descargados se guardan en la carpeta de descargas del navegador
- Los archivos subidos van al directorio actual del explorador remoto

---

**¡Disfruta de tu nuevo explorador de archivos! 🎉**
