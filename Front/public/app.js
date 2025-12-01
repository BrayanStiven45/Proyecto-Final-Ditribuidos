// API Base URL
const API_URL = 'http://localhost:3000';

// State
let currentFiles = [];

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadForm = document.getElementById('uploadForm');
const uploadButton = document.getElementById('uploadButton');
const selectedFileDiv = document.getElementById('selectedFile');
const filesTableBody = document.getElementById('filesTableBody');
const emptyState = document.getElementById('emptyState');
const refreshButton = document.getElementById('refreshButton');
const versionsModal = document.getElementById('versionsModal');
const closeModal = document.getElementById('closeModal');
const modalFileName = document.getElementById('modalFileName');
const versionsContainer = document.getElementById('versionsContainer');
const uploadCard = document.querySelector('.upload-card');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.querySelector('.progress-fill');
const progressText = document.querySelector('.progress-text');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFiles();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // File input
    fileInput.addEventListener('change', handleFileSelect);
    
    // Upload form
    uploadForm.addEventListener('submit', handleUpload);
    
    // Refresh button
    refreshButton.addEventListener('click', loadFiles);
    
    // Modal
    closeModal.addEventListener('click', closeVersionsModal);
    versionsModal.querySelector('.modal-overlay').addEventListener('click', closeVersionsModal);
    
    // Drag and drop
    uploadCard.addEventListener('dragover', handleDragOver);
    uploadCard.addEventListener('dragleave', handleDragLeave);
    uploadCard.addEventListener('drop', handleDrop);
}

// File Selection
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        selectedFileDiv.textContent = `📄 ${file.name} (${formatFileSize(file.size)})`;
        selectedFileDiv.classList.add('show');
        uploadButton.disabled = false;
    }
}

// Drag and Drop
function handleDragOver(e) {
    e.preventDefault();
    uploadCard.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadCard.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    uploadCard.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        handleFileSelect({ target: { files } });
    }
}

// Upload File
async function handleUpload(e) {
    e.preventDefault();
    
    const file = fileInput.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    uploadButton.classList.add('loading');
    uploadButton.disabled = true;
    showProgress(true);
    
    try {
        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Error al subir el archivo');
        }
        
        const result = await response.json();
        
        // Complete progress to 100%
        progressFill.style.width = '100%';
        progressText.textContent = 'Completado 100%';
        
        await new Promise(resolve => setTimeout(resolve, 500));
        showToast('Archivo subido exitosamente', 'success');
        
        // Reset form
        uploadForm.reset();
        selectedFileDiv.classList.remove('show');
        uploadButton.disabled = true;
        
        // Reload files
        await loadFiles();
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Error al subir el archivo', 'error');
    } finally {
        uploadButton.classList.remove('loading');
        showProgress(false);
    }
}

// Load Files
async function loadFiles() {
    refreshButton.classList.add('rotating');
    
    try {
        const response = await fetch(`${API_URL}/files`);
        
        if (!response.ok) {
            throw new Error('Error al cargar archivos');
        }
        
        const files = await response.json();
        currentFiles = files;
        
        renderFiles(files);
        updateStats(files);
        
    } catch (error) {
        console.error('Load files error:', error);
        showToast('Error al cargar archivos', 'error');
    } finally {
        setTimeout(() => {
            refreshButton.classList.remove('rotating');
        }, 500);
    }
}

// Render Files
function renderFiles(files) {
    filesTableBody.innerHTML = '';
    
    if (files.length === 0) {
        emptyState.classList.add('show');
        return;
    }
    
    emptyState.classList.remove('show');
    
    files.forEach(file => {
        const row = document.createElement('tr');
        const safeFileName = escapeHtml(file.fileName);
        const versionCount = Number(file.latestVersion) || 1;
        
        row.innerHTML = `
            <td>
                <div class="file-name">
                    <div class="file-icon">${escapeHtml(getFileExtension(file.fileName))}</div>
                    <span title="${safeFileName}">${safeFileName}</span>
                </div>
            </td>
            <td class="file-size">${formatFileSize(Number(file.size))}</td>
            <td class="file-date">${formatDate(file.uploadTime)}</td>
            <td>
                <span class="version-badge">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 4V8L11 11M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    ${versionCount} versión${versionCount > 1 ? 'es' : ''}
                </span>
            </td>
            <td>
                <div class="actions">
                    <button class="action-button download" data-filename="${safeFileName}" title="Descargar">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M10 3V13M10 13L6 9M10 13L14 9M3 17H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="action-button versions" data-filename="${safeFileName}" title="Ver versiones">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10C4 6.68629 6.68629 4 10 4C12.0609 4 13.8879 4.94866 15.0909 6.41462M15.0909 6.41462V4M15.0909 6.41462H13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </td>
        `;
        
        // Add event listeners using data attributes (safer than inline onclick)
        const downloadBtn = row.querySelector('.action-button.download');
        const versionsBtn = row.querySelector('.action-button.versions');
        
        downloadBtn.addEventListener('click', () => downloadFile(file.fileName));
        versionsBtn.addEventListener('click', () => showVersions(file.fileName));

        filesTableBody.appendChild(row);
        
        const fileNameDiv = row.querySelector('.file-name');

        if (fileNameDiv) {
            fileNameDiv.style.cursor = 'pointer';
            fileNameDiv.addEventListener('click', () => {
                showVersions(file.fileName);
            });
        }
    });
}

// Update Stats
function updateStats(files) {
    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    
    document.getElementById('totalFiles').textContent = totalFiles;
    document.getElementById('totalSize').textContent = formatFileSize(totalSize);
}

// Download File
async function downloadFile(fileName, version = 0) {
    try {
        const url = `${API_URL}/download/${encodeURIComponent(fileName)}${version > 0 ? `?version=${version}` : ''}`;
        
        // Create temporary link and trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        showToast(`Descargando ${fileName}...`, 'success');
        
    } catch (error) {
        console.error('Download error:', error);
        showToast('Error al descargar el archivo', 'error');
    }
}

// Show Versions
async function showVersions(fileName) {
    try {
        modalFileName.textContent = `Versiones de ${fileName}`;
        versionsContainer.innerHTML = '<div style="text-align: center; padding: 2rem;">Cargando...</div>';
        versionsModal.classList.remove('hidden');
        
        const response = await fetch(`${API_URL}/versions/${encodeURIComponent(fileName)}`);
        
        if (!response.ok) {
            throw new Error('Error al cargar versiones');
        }
        
        const versions = await response.json();
        renderVersions(fileName, versions);
        
    } catch (error) {
        console.error('Versions error:', error);
        versionsContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--danger);">Error al cargar versiones</div>';
    }
}

// Render Versions
function renderVersions(fileName, versions) {
    versionsContainer.innerHTML = '';
    
    if (versions.length === 0) {
        versionsContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-light);">No hay versiones disponibles</div>';
        return;
    }
    
    versions.forEach((version, index) => {
        const isLatest = index === 0;
        const versionDiv = document.createElement('div');
        versionDiv.className = 'version-item';
        versionDiv.innerHTML = `
            <div class="version-header">
                <span class="version-number">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10 4V10L13 13M18 10C18 14.4183 14.4183 18 10 18C5.58172 18 2 14.4183 2 10C2 5.58172 5.58172 2 10 2C14.4183 2 18 5.58172 18 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Versión ${escapeHtml(String(version.version))}
                </span>
                ${isLatest ? '<span class="version-current">Actual</span>' : ''}
            </div>
            <div class="version-info">
                <div class="version-detail">
                    <strong>Tamaño</strong>
                    ${formatFileSize(version.size)}
                </div>
                <div class="version-detail">
                    <strong>Fecha</strong>
                    ${formatDate(version.uploadTime)}
                </div>
            </div>
            <button class="version-download" data-version="${version.version}">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 3V13M10 13L6 9M10 13L14 9M3 17H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Descargar esta versión
            </button>
        `;
        
        // Add event listener
        const downloadBtn = versionDiv.querySelector('.version-download');
        downloadBtn.addEventListener('click', () => downloadFile(fileName, version.versionId));
        
        versionsContainer.appendChild(versionDiv);
    });
}

// Close Versions Modal
function closeVersionsModal() {
    versionsModal.classList.add('hidden');
}

// Show Progress
function showProgress(show) {
    if (show) {
        uploadProgress.classList.remove('hidden');
        animateProgress();
    } else {
        uploadProgress.classList.add('hidden');
        progressFill.style.width = '0%';
    }
}

// Animate Progress
function animateProgress() {
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 90) {
            progress = 90;
            clearInterval(interval);
        }
        progressFill.style.width = progress + '%';
        progressText.textContent = `Subiendo... ${Math.round(progress)}%`;
    }, 200);
}

// Show Toast
let toastTimeout;
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = toast.querySelector('.toast-message');
    
    // Clear existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    
    toast.className = `toast ${type}`;
    toastMessage.textContent = message;
    
    toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Justo ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getFileExtension(fileName) {
    const ext = fileName.split('.').pop().toUpperCase();
    return ext.length <= 4 ? ext : 'FILE';
}
