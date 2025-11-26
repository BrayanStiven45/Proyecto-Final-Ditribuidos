// ==================== Elementos del DOM ====================
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const uploadFileName = document.getElementById('uploadFileName');
const uploadPercentage = document.getElementById('uploadPercentage');
const filesGrid = document.getElementById('filesGrid');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const viewBtns = document.querySelectorAll('.view-btn');
const previewModal = document.getElementById('previewModal');
const closeModal = document.getElementById('closeModal');
const previewFileName = document.getElementById('previewFileName');
const previewContent = document.getElementById('previewContent');
const toastContainer = document.getElementById('toastContainer');

// ==================== Estado de la Aplicación ====================
let files = [
    {
        id: 1,
        name: 'documento.pdf',
        size: '2.5 MB',
        date: '25 Nov 2025',
        type: 'pdf',
        icon: 'fa-file-pdf'
    },
    {
        id: 2,
        name: 'imagen.png',
        size: '1.8 MB',
        date: '24 Nov 2025',
        type: 'image',
        icon: 'fa-file-image'
    },
    {
        id: 3,
        name: 'reporte.docx',
        size: '456 KB',
        date: '23 Nov 2025',
        type: 'document',
        icon: 'fa-file-word'
    },
    {
        id: 4,
        name: 'backup.zip',
        size: '15.2 MB',
        date: '22 Nov 2025',
        type: 'archive',
        icon: 'fa-file-archive'
    }
];

let currentView = 'grid';

// ==================== Funciones de Utilidad ====================

// Mostrar notificaciones toast
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Obtener icono según tipo de archivo
function getFileIcon(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'pdf': 'fa-file-pdf',
        'doc': 'fa-file-word',
        'docx': 'fa-file-word',
        'xls': 'fa-file-excel',
        'xlsx': 'fa-file-excel',
        'ppt': 'fa-file-powerpoint',
        'pptx': 'fa-file-powerpoint',
        'jpg': 'fa-file-image',
        'jpeg': 'fa-file-image',
        'png': 'fa-file-image',
        'gif': 'fa-file-image',
        'svg': 'fa-file-image',
        'zip': 'fa-file-archive',
        'rar': 'fa-file-archive',
        '7z': 'fa-file-archive',
        'mp3': 'fa-file-audio',
        'wav': 'fa-file-audio',
        'mp4': 'fa-file-video',
        'avi': 'fa-file-video',
        'txt': 'fa-file-alt',
        'js': 'fa-file-code',
        'html': 'fa-file-code',
        'css': 'fa-file-code',
        'py': 'fa-file-code',
        'java': 'fa-file-code',
    };
    
    return iconMap[extension] || 'fa-file';
}

// Formatear tamaño de archivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Formatear fecha
function formatDate(date) {
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(date).toLocaleDateString('es-ES', options);
}

// ==================== Renderizado de Archivos ====================

function renderFiles(filesToRender = files) {
    if (filesToRender.length === 0) {
        filesGrid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    filesGrid.style.display = 'grid';
    emptyState.style.display = 'none';
    
    filesGrid.innerHTML = filesToRender.map(file => `
        <div class="file-card" data-id="${file.id}">
            <div class="file-icon">
                <i class="fas ${file.icon}"></i>
            </div>
            <div class="file-info">
                <h3 class="file-name" title="${file.name}">${file.name}</h3>
                <p class="file-size">${file.size}</p>
                <p class="file-date">${file.date}</p>
            </div>
            <div class="file-actions">
                <button class="action-btn view-btn-action" title="Ver" data-id="${file.id}">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-btn download-btn" title="Descargar" data-id="${file.id}">
                    <i class="fas fa-download"></i>
                </button>
                <button class="action-btn delete delete-btn" title="Eliminar" data-id="${file.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    // Agregar event listeners a los botones de acción
    attachFileActionListeners();
}

function attachFileActionListeners() {
    // Botones de vista previa
    document.querySelectorAll('.view-btn-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const fileId = parseInt(btn.dataset.id);
            viewFile(fileId);
        });
    });
    
    // Botones de descarga
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const fileId = parseInt(btn.dataset.id);
            downloadFile(fileId);
        });
    });
    
    // Botones de eliminar
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const fileId = parseInt(btn.dataset.id);
            deleteFile(fileId);
        });
    });
}

// ==================== Funciones de Archivo ====================

function viewFile(fileId) {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    
    previewFileName.textContent = file.name;
    
    // Simular contenido de vista previa
    previewContent.innerHTML = `
        <div class="preview-placeholder">
            <i class="fas ${file.icon}" style="font-size: 5rem; color: var(--primary-color);"></i>
            <h3 style="margin-top: 20px;">${file.name}</h3>
            <p style="color: var(--text-secondary); margin-top: 10px;">Tamaño: ${file.size}</p>
            <p style="color: var(--text-secondary);">Fecha: ${file.date}</p>
            <p style="color: var(--text-secondary); margin-top: 20px; font-style: italic;">
                Vista previa no disponible. Conecta con el backend para ver el contenido real.
            </p>
        </div>
    `;
    
    previewModal.classList.add('active');
    showToast(`Viendo ${file.name}`, 'success');
}

function downloadFile(fileId) {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    
    // Simular descarga
    showToast(`Descargando ${file.name}...`, 'success');
    
    // Aquí se conectaría con el backend para descargar el archivo real
    console.log('Descargando archivo:', file);
}

function deleteFile(fileId) {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    
    if (confirm(`¿Estás seguro de eliminar "${file.name}"?`)) {
        files = files.filter(f => f.id !== fileId);
        renderFiles();
        showToast(`${file.name} eliminado correctamente`, 'success');
        updateStats();
    }
}

// ==================== Upload de Archivos ====================

function handleFileUpload(fileList) {
    if (fileList.length === 0) return;
    
    uploadProgress.style.display = 'block';
    
    Array.from(fileList).forEach((file, index) => {
        setTimeout(() => {
            uploadFileName.textContent = file.name;
            simulateUpload(file);
        }, index * 2000);
    });
}

function simulateUpload(file) {
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(() => {
                addFileToList(file);
                uploadProgress.style.display = 'none';
                showToast(`${file.name} subido correctamente`, 'success');
            }, 500);
        }
        progressFill.style.width = progress + '%';
        uploadPercentage.textContent = Math.round(progress) + '%';
    }, 200);
}

function addFileToList(file) {
    const newFile = {
        id: files.length + 1,
        name: file.name,
        size: formatFileSize(file.size),
        date: formatDate(new Date()),
        type: file.type.split('/')[0],
        icon: getFileIcon(file.name)
    };
    
    files.unshift(newFile);
    renderFiles();
    updateStats();
}

// ==================== Event Listeners ====================

// Click en botón de seleccionar archivo
selectFileBtn.addEventListener('click', () => {
    fileInput.click();
});

// Click en área de upload
uploadArea.addEventListener('click', (e) => {
    if (e.target !== selectFileBtn) {
        fileInput.click();
    }
});

// Cambio en input de archivo
fileInput.addEventListener('change', (e) => {
    handleFileUpload(e.target.files);
});

// Drag and Drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handleFileUpload(e.dataTransfer.files);
});

// Búsqueda de archivos
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredFiles = files.filter(file => 
        file.name.toLowerCase().includes(searchTerm)
    );
    renderFiles(filteredFiles);
});

// Cambiar vista (grid/list)
viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        viewBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const view = btn.dataset.view;
        if (view === 'list') {
            filesGrid.classList.add('list-view');
        } else {
            filesGrid.classList.remove('list-view');
        }
    });
});

// Cerrar modal
closeModal.addEventListener('click', () => {
    previewModal.classList.remove('active');
});

previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) {
        previewModal.classList.remove('active');
    }
});

// Cerrar modal con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && previewModal.classList.contains('active')) {
        previewModal.classList.remove('active');
    }
});

// ==================== Actualizar Estadísticas ====================

function updateStats() {
    // Aquí podrías actualizar las estadísticas dinámicamente
    // Por ahora son estáticas en el HTML
    console.log('Estadísticas actualizadas');
}

// ==================== Inicialización ====================

document.addEventListener('DOMContentLoaded', () => {
    renderFiles();
    showToast('Sistema de archivos distribuido listo', 'success');
});
