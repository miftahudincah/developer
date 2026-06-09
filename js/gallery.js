// ========================================
// GALLERY MODULE
// ========================================

window.gallery = {
    preview(input) {
        Utils.previewImage(input, 'galleryPreview');
    },
    
    async upload() {
        const file = document.getElementById('galleryFileInput').files[0];
        const title = document.getElementById('galleryTitle').value;
        const validation = Utils.validateFile(file);
        
        if (!validation.valid) {
            Utils.showStatus('galleryUploadStatus', validation.message, 'error');
            return;
        }
        
        const btn = document.getElementById('galleryUploadBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        
        try {
            const base64 = await Utils.fileToBase64(file);
            const result = await API.uploadImage(base64, title || 'Gallery Image');
            
            if (result.status === 'success') {
                Utils.showStatus('galleryUploadStatus', '✅ Upload berhasil!', 'success');
                
                const fileInput = document.getElementById('galleryFileInput');
                const titleInput = document.getElementById('galleryTitle');
                const preview = document.getElementById('galleryPreview');
                
                if (fileInput) fileInput.value = '';
                if (titleInput) titleInput.value = '';
                if (preview) preview.innerHTML = '';
                
                window.gallery.load();
            }
        } catch (error) {
            Utils.showStatus('galleryUploadStatus', `❌ ${error.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload ke Gallery';
        }
    },
    
    async load() {
        const container = document.getElementById('galleryContainer');
        if (!container) return;
        
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading gallery...</div>';
        
        try {
            const data = await API.request('/api/photos?limit=50');
            
            if (!data.data || data.data.length === 0) {
                container.innerHTML = '<div class="loading">📭 Belum ada foto. Upload gambar dulu yuk!</div>';
                return;
            }
            
            let html = '<div class="gallery">';
            data.data.forEach(photo => {
                html += `
                    <div class="gallery-item">
                        <img src="${photo.url}" onerror="this.src='https://placehold.co/300x200?text=Error'">
                        <div class="gallery-item-info">
                            <strong>${Utils.escapeHtml(photo.title || 'Tanpa judul')}</strong><br>
                            <small>${Utils.formatDate(photo.createdAt)}</small><br>
                            <button class="btn-danger btn-sm" onclick="window.gallery.delete('${photo.id}')" style="margin-top:8px; width:100%;">
                                <i class="fas fa-trash"></i> Hapus
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        } catch (error) {
            container.innerHTML = `<div class="loading">❌ ${error.message}</div>`;
        }
    },
    
    async delete(photoId) {
        if (!confirm('Yakin ingin menghapus gambar ini?')) return;
        
        try {
            await API.request(`/api/photos/${photoId}`, { method: 'DELETE' });
            window.gallery.load();
            Utils.showStatus('galleryUploadStatus', '✅ Gambar berhasil dihapus!', 'success');
        } catch (error) {
            Utils.showStatus('galleryUploadStatus', `❌ ${error.message}`, 'error');
        }
    }
};