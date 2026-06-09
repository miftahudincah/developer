// ========================================
// UTILITIES MODULE
// ========================================

const Utils = {
    showStatus(elementId, message, type) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn('Element not found:', elementId);
            return;
        }
        
        element.textContent = message;
        element.className = `status ${type}`;
        
        setTimeout(() => {
            element.className = 'status';
            element.style.display = 'none';
            setTimeout(() => {
                if (element) element.style.display = '';
            }, 300);
        }, 5000);
    },
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    formatDate(date) {
        if (!date) return '-';
        const d = new Date(date);
        return d.toLocaleDateString('id-ID');
    },
    
    formatDateTime(date) {
        if (!date) return '-';
        const d = new Date(date);
        return d.toLocaleString('id-ID');
    },
    
    getAvatarUrl(name, photoUrl = null) {
        if (photoUrl && photoUrl !== 'null' && photoUrl !== '') return photoUrl;
        return `https://ui-avatars.com/api/?background=667eea&color=fff&name=${encodeURIComponent(name || 'User')}`;
    },
    
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                let base64 = reader.result;
                if (base64.includes(',')) base64 = base64.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },
    
    validateFile(file) {
        if (!file) return { valid: false, message: 'Pilih file terlebih dahulu' };
        if (file.size > CONFIG.MAX_FILE_SIZE) {
            return { valid: false, message: `File terlalu besar (${(file.size / 1024 / 1024).toFixed(2)}MB). Maksimal 4.5MB` };
        }
        if (!CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
            return { valid: false, message: 'Hanya file JPG/PNG yang diperbolehkan' };
        }
        return { valid: true };
    },
    
    previewImage(input, previewElementId) {
        const preview = document.getElementById(previewElementId);
        if (!preview) return;
        
        preview.innerHTML = '';
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                preview.appendChild(img);
            };
            reader.readAsDataURL(input.files[0]);
        }
    },
    
    getRoleClass(role) {
        const classes = {
            admin: 'role-admin',
            developer: 'role-developer',
            guru: 'role-guru',
            siswa: 'role-siswa',
            kepala_sekolah: 'role-kepala_sekolah',
            staff_tu: 'role-staff_tu'
        };
        return classes[role] || 'role-siswa';
    },
    
    formatRole(role) {
        const names = {
            admin: 'Admin',
            developer: 'Developer',
            guru: 'Guru',
            siswa: 'Siswa',
            kepala_sekolah: 'Kepala Sekolah',
            staff_tu: 'Staff TU'
        };
        return names[role] || role;
    }
};

// Dark Mode management
const DarkMode = {
    init() {
        const savedMode = localStorage.getItem('darkMode');
        if (savedMode === 'true') {
            document.body.classList.add('dark-mode');
            this.updateIcon(true);
        }
        
        const toggleBtn = document.getElementById('darkModeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
        }
    },
    
    toggle() {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDark);
        this.updateIcon(isDark);
    },
    
    updateIcon(isDark) {
        const btn = document.getElementById('darkModeToggle');
        if (btn) {
            btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        }
    }
};

// API helper
const API = {
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        const response = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
            ...options,
            headers
        });
        
        const data = await response.json();
        
        if (response.status === 401) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            authToken = null;
            currentUser = null;
            window.location.reload();
            throw new Error('Sesi berakhir, silakan login kembali');
        }
        
        if (!response.ok) {
            throw new Error(data.message || 'Terjadi kesalahan');
        }
        
        return data;
    },
    
    async uploadImage(base64Image, title) {
        return this.request('/api/photos/upload', {
            method: 'POST',
            body: JSON.stringify({ image: base64Image, title: title || `Upload_${Date.now()}` })
        });
    }
};