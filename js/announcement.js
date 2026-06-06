// announcement.js - VERSION 5.0 (Compatible with Vercel Backend API)
// Fitur Pengumuman dengan Timer Otomatis, Real-time Updates, Notifikasi, dan Upload Gambar
// Sekarang role 'developer' memiliki akses penuh seperti admin & guru
// V5.0: Compatible with Vercel Backend API
// ============================================================================

// Backend API URL (Vercel)
const BACKEND_API_URL = "https://absensi-backend-3we5.vercel.app/api";

let announcementCheckInterval = null;
let announcementListenerAttached = false;
let announcementCountdownInterval = null;
let lastAnnouncementCount = 0;
let announcementDataReadyListenerAdded = false;
let announcementUiReadyListenerAdded = false;
let currentAnnouncementImageFile = null;
let cachedAnnouncements = [];
let cachedAnnouncementsTimestamp = 0;
const ANNOUNCEMENTS_CACHE_TTL = 30 * 1000; // 30 detik

// ======================= FUNGSI UTILITY =======================

function getAuthToken() {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        return firebase.auth().currentUser.getIdToken();
    }
    return Promise.resolve(null);
}

async function apiRequest(endpoint, options = {}) {
    try {
        const token = await getAuthToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        };
        
        const response = await fetch(`${BACKEND_API_URL}${endpoint}`, {
            ...options,
            headers
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        return data;
    } catch (error) {
        console.warn(`API request failed: ${endpoint}`, error);
        throw error;
    }
}

async function fetchAnnouncementsFromAPI() {
    try {
        const now = Date.now();
        if (cachedAnnouncements.length > 0 && (now - cachedAnnouncementsTimestamp) < ANNOUNCEMENTS_CACHE_TTL) {
            console.log("📦 Using cached announcements from API");
            return cachedAnnouncements;
        }
        
        console.log("📢 Fetching announcements from API...");
        const data = await apiRequest('/announcements');
        const announcements = data.data || [];
        
        cachedAnnouncements = announcements;
        cachedAnnouncementsTimestamp = now;
        
        return announcements;
    } catch (error) {
        console.error("Fetch announcements from API error:", error);
        // Fallback ke database lokal
        return fetchAnnouncementsFromLocalDB();
    }
}

function fetchAnnouncementsFromLocalDB() {
    return new Promise((resolve) => {
        if (typeof db === 'undefined' || !db) {
            resolve([]);
            return;
        }
        
        db.ref('announcements/active').once('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                resolve([]);
                return;
            }
            
            const announcements = Object.keys(data).map(key => ({ 
                id: key, 
                ...data[key] 
            }));
            resolve(announcements);
        }).catch(() => resolve([]));
    });
}

async function createAnnouncementViaAPI(announcementData) {
    const data = await apiRequest('/announcements', {
        method: 'POST',
        body: JSON.stringify({
            title: announcementData.title,
            content: announcementData.message,
            priority: announcementData.priority || 'normal'
        })
    });
    
    // Invalidate cache
    cachedAnnouncements = [];
    cachedAnnouncementsTimestamp = 0;
    
    return data;
}

async function updateAnnouncementViaAPI(announcementId, announcementData) {
    // API backend mungkin belum memiliki endpoint update
    // Fallback ke database lokal
    if (typeof db !== 'undefined' && db) {
        return new Promise((resolve, reject) => {
            db.ref(`announcements/active/${announcementId}`).update({
                title: announcementData.title,
                message: announcementData.message,
                priority: announcementData.priority,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            })
            .then(() => {
                cachedAnnouncements = [];
                resolve({ success: true });
            })
            .catch(reject);
        });
    }
    throw new Error('Update endpoint not available');
}

async function deleteAnnouncementViaAPI(announcementId) {
    // API backend mungkin belum memiliki endpoint delete
    // Fallback ke database lokal
    if (typeof db !== 'undefined' && db) {
        return new Promise((resolve, reject) => {
            db.ref(`announcements/active/${announcementId}`).remove()
                .then(() => {
                    cachedAnnouncements = [];
                    resolve({ success: true });
                })
                .catch(reject);
        });
    }
    throw new Error('Delete endpoint not available');
}

// ======================= EVENT LISTENER ========================

function setupAnnouncementDataReadyListener() {
    if (announcementDataReadyListenerAdded) return;
    announcementDataReadyListenerAdded = true;
    console.log("📡 Setting up dataReady event listener for announcement module");

    window.addEventListener('dataReady', (e) => {
        console.log("📢 announcement.js: dataReady received, initializing announcement system");
        if (!announcementListenerAttached) {
            initAnnouncementListener();
        }
        if (!announcementCheckInterval) {
            startAnnouncementChecker();
        }
        renderAnnouncement();
    });
}

function setupAnnouncementUiReadyListener() {
    if (announcementUiReadyListenerAdded) return;
    announcementUiReadyListenerAdded = true;
    console.log("📡 Setting up uiReady event listener for announcement module");

    window.addEventListener('uiReady', (e) => {
        const user = e.detail.currentUser;
        if (user && (user.role === 'admin' || user.role === 'guru' || user.role === 'developer')) {
            console.log("📢 announcement.js: uiReady received, checking permissions for floating button");
            const floatingBtn = document.getElementById('floatingAnnouncementBtn');
            if (floatingBtn) floatingBtn.classList.add('show');
        }
    });
}

// ======================= FUNGSI UPLOAD GAMBAR =======================

function previewAnnouncementImage(input) {
    const previewContainer = document.getElementById('annImagePreviewContainer');
    const previewImg = document.getElementById('annImagePreview');
    
    if (input.files && input.files[0]) {
        currentAnnouncementImageFile = input.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            if (previewImg) {
                previewImg.src = e.target.result;
                previewImg.style.display = 'block';
            }
            if (previewContainer) {
                previewContainer.style.display = 'block';
            }
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        currentAnnouncementImageFile = null;
        if (previewImg) {
            previewImg.src = '';
            previewImg.style.display = 'none';
        }
        if (previewContainer) {
            previewContainer.style.display = 'none';
        }
    }
}

function removeAnnouncementImage() {
    currentAnnouncementImageFile = null;
    const previewImg = document.getElementById('annImagePreview');
    const previewContainer = document.getElementById('annImagePreviewContainer');
    const fileInput = document.getElementById('annImageInput');
    
    if (previewImg) {
        previewImg.src = '';
        previewImg.style.display = 'none';
    }
    if (previewContainer) {
        previewContainer.style.display = 'none';
    }
    if (fileInput) {
        fileInput.value = '';
    }
    if (typeof showToast === 'function') {
        showToast("🗑️ Gambar dihapus", "info");
    }
}

async function uploadAnnouncementImage(file) {
    if (!file) return null;
    
    if (!file.type.match('image.*')) {
        if (typeof showToast === 'function') {
            showToast("❌ Hanya file gambar yang diperbolehkan!", "error");
        }
        return null;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        if (typeof showToast === 'function') {
            showToast("❌ Ukuran gambar maksimal 2MB!", "error");
        }
        return null;
    }
    
    if (typeof showToast === 'function') {
        showToast("📤 Mengunggah gambar pengumuman...", "info");
    }
    
    try {
        if (typeof uploadWithFallback !== 'undefined') {
            const result = await uploadWithFallback(file, 'announcements');
            return result.url;
        } else {
            console.warn("uploadWithFallback not available");
            return null;
        }
    } catch (error) {
        console.error("Upload image error:", error);
        if (typeof showToast === 'function') {
            showToast("❌ Gagal upload gambar: " + error.message, "error");
        }
        return null;
    }
}

function viewAnnouncementImage(imageUrl) {
    if (!imageUrl) return;
    
    let modalHtml = `
        <div id="modal-announcement-image" class="modal-overlay open">
            <div class="modal-box" style="max-width: 600px; text-align: center; background: #000;">
                <div class="modal-title">
                    <span>🖼️ Gambar Pengumuman</span>
                    <span onclick="closeModal('modal-announcement-image')">✖</span>
                </div>
                <div style="padding: 20px;">
                    <img src="${imageUrl}" 
                         style="max-width: 100%; max-height: 70vh; border-radius: 12px; object-fit: contain;"
                         onerror="this.src='https://placehold.co/400x300?text=Gambar+Gagal+Dimuat'">
                </div>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="closeModal('modal-announcement-image')">Tutup</button>
                    <a href="${imageUrl}" target="_blank" class="btn-primary" style="padding: 8px 16px; background: #00bcd4; color: white; text-decoration: none; border-radius: 8px;">🔗 Buka di Tab Baru</a>
                </div>
            </div>
        </div>
    `;
    const existingModal = document.getElementById('modal-announcement-image');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ======================= RENDER PENGUMUMAN =======================

async function renderAnnouncement() {
    console.log("📢 renderAnnouncement dipanggil");
    
    const container = document.getElementById('announcementContainer');
    const listContainer = document.getElementById('announcementList');
    
    if (!container || !listContainer) {
        console.log("Element tidak ditemukan");
        return;
    }
    
    let announcements = [];
    try {
        announcements = await fetchAnnouncementsFromAPI();
    } catch (error) {
        console.error("Render announcement error:", error);
        listContainer.innerHTML = '<div style="text-align:center; padding:20px;">❌ Gagal memuat pengumuman</div>';
        return;
    }
    
    if (!announcements || announcements.length === 0) {
        container.style.display = 'none';
        updateAnnouncementBadge(0);
        return;
    }
    
    const now = new Date();
    const currentTime = formatTimeToString(now);
    const currentDate = formatDateToString(now);
    
    const activeAnnouncements = announcements.filter(ann => {
        if (!ann.isActive && ann.isActive !== undefined) return false;
        if (ann.expiryDate && ann.expiryTime) {
            if (ann.expiryDate < currentDate) return false;
            if (ann.expiryDate === currentDate && ann.expiryTime <= currentTime) return false;
        } else if (ann.expiryDate) {
            if (ann.expiryDate < currentDate) return false;
        } else if (ann.expiryTime) {
            if (currentTime >= ann.expiryTime) return false;
        }
        return true;
    });
    
    updateAnnouncementBadge(activeAnnouncements.length);
    
    if (activeAnnouncements.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    container.style.animation = 'none';
    setTimeout(() => {
        container.style.animation = 'fadeIn 0.3s ease';
    }, 10);
    
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    activeAnnouncements.sort((a, b) => (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1));
    
    listContainer.innerHTML = '';
    
    activeAnnouncements.forEach(ann => {
        const priorityClass = ann.priority === 'high' ? 'announcement-high' : 
                             ann.priority === 'low' ? 'announcement-low' : 'announcement-normal';
        const timeLeft = getTimeLeft(ann);
        const createdInfo = ann.createdBy ? `👤 Dibuat oleh: ${escapeHtmlAnn(ann.createdBy)}` : '';
        const createdAtDate = ann.createdAt ? new Date(ann.createdAt).toLocaleString('id-ID') : '';
        
        let imageHtml = '';
        if (ann.imageUrl && ann.imageUrl !== 'null' && ann.imageUrl !== 'undefined') {
            imageHtml = `
                <div class="announcement-image" style="margin-top: 10px;">
                    <img src="${ann.imageUrl}" 
                         style="max-width: 100%; max-height: 200px; border-radius: 12px; cursor: pointer; object-fit: cover;"
                         onclick="viewAnnouncementImage('${ann.imageUrl}')"
                         onerror="this.style.display='none'">
                </div>
            `;
        }
        
        let actionButtons = '';
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'guru' || currentUser.role === 'developer')) {
            actionButtons = `
                <span class="announcement-edit" onclick="editAnnouncement('${ann.id}')" title="Edit Pengumuman" style="cursor:pointer; margin-left:8px;">✏️</span>
                <span class="announcement-delete" onclick="deleteAnnouncement('${ann.id}')" title="Hapus Pengumuman" style="cursor:pointer;">🗑️</span>
            `;
        }
        
        const isNew = ann.createdAt && (Date.now() - ann.createdAt < 5 * 60 * 1000);
        
        listContainer.innerHTML += `
            <div class="announcement-item ${priorityClass}" data-id="${ann.id}" data-expiry="${ann.expiryDate || ''} ${ann.expiryTime || ''}">
                <div class="announcement-header">
                    <span class="announcement-title">
                        ${isNew ? '🆕 ' : '📢'} ${escapeHtmlAnn(ann.title)}
                        ${isNew ? '<span class="badge-new">BARU</span>' : ''}
                    </span>
                    <div class="announcement-badges">
                        ${ann.priority === 'high' ? '<span class="badge badge-high">⚠️ Penting</span>' : ''}
                        ${ann.priority === 'low' ? '<span class="badge badge-low">ℹ️ Informasi</span>' : ''}
                        ${timeLeft ? `<span class="badge badge-time">⏰ ${timeLeft}</span>` : ''}
                        ${actionButtons}
                    </div>
                </div>
                <div class="announcement-message">${escapeHtmlAnn(ann.message || ann.content)}</div>
                ${imageHtml}
                <div class="announcement-footer">
                    <small>${createdInfo}</small>
                    <small>📅 ${createdAtDate || ''}</small>
                    <small>⏱️ Berakhir: ${formatExpiryDisplay(ann)}</small>
                </div>
            </div>
        `;
    });
    
    startAnnouncementCountdownUpdater();
}

function updateAnnouncementBadge(count) {
    const floatingBtn = document.getElementById('floatingAnnouncementBtn');
    if (floatingBtn) {
        const existingBadge = floatingBtn.querySelector('.announcement-badge-count');
        if (count > 0) {
            if (!existingBadge) {
                const badge = document.createElement('span');
                badge.className = 'announcement-badge-count';
                badge.textContent = count;
                badge.style.cssText = `
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #f44336;
                    color: white;
                    border-radius: 50%;
                    width: 18px;
                    height: 18px;
                    font-size: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                `;
                floatingBtn.style.position = 'relative';
                floatingBtn.appendChild(badge);
            } else {
                existingBadge.textContent = count;
            }
        } else if (existingBadge) {
            existingBadge.remove();
        }
    }
    
    if (count > 0 && lastAnnouncementCount !== count) {
        const originalTitle = document.title;
        if (!document.title.includes('📢')) {
            document.title = `📢 (${count}) ${originalTitle}`;
            setTimeout(() => {
                document.title = originalTitle;
            }, 5000);
        }
    }
    lastAnnouncementCount = count;
}

function startAnnouncementCountdownUpdater() {
    if (announcementCountdownInterval) clearInterval(announcementCountdownInterval);
    announcementCountdownInterval = setInterval(() => {
        const items = document.querySelectorAll('.announcement-item');
        items.forEach(item => {
            const timeBadge = item.querySelector('.badge-time');
            if (timeBadge && item.dataset.id) {
                fetchAnnouncementsFromAPI().then(announcements => {
                    const data = announcements.find(a => a.id === item.dataset.id);
                    if (data) {
                        const timeLeft = getTimeLeft(data);
                        if (timeLeft) {
                            timeBadge.innerHTML = `⏰ ${timeLeft}`;
                        } else if (timeBadge) {
                            timeBadge.remove();
                        }
                    }
                });
            }
        });
    }, 60000);
}

function formatTimeToString(date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function formatDateToString(date) {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

function getTimeLeft(announcement) {
    const now = new Date();
    let expiryDateTime = null;
    
    if (announcement.expiryDate && announcement.expiryTime) {
        expiryDateTime = new Date(`${announcement.expiryDate}T${announcement.expiryTime}:00`);
    } else if (announcement.expiryDate && !announcement.expiryTime) {
        expiryDateTime = new Date(`${announcement.expiryDate}T23:59:59`);
    } else if (announcement.expiryTime && !announcement.expiryDate) {
        const [hours, minutes] = announcement.expiryTime.split(':');
        expiryDateTime = new Date();
        expiryDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        if (expiryDateTime < now) return null;
    } else {
        return null;
    }
    
    if (!expiryDateTime) return null;
    const diffMs = expiryDateTime - now;
    if (diffMs <= 0) return null;
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (diffHours > 0) return `${diffHours} jam ${diffMinutes} menit`;
    else if (diffMinutes > 0) return `${diffMinutes} menit ${diffSeconds} detik`;
    else return `${diffSeconds} detik`;
}

function formatExpiryDisplay(announcement) {
    if (announcement.expiryDate && announcement.expiryTime) return `${formatIndonesianDate(announcement.expiryDate)} pukul ${announcement.expiryTime}`;
    if (announcement.expiryDate) return `${formatIndonesianDate(announcement.expiryDate)} (akhir hari)`;
    if (announcement.expiryTime) return `Hari ini pukul ${announcement.expiryTime}`;
    return 'Tidak terbatas';
}

function formatIndonesianDate(dateStr) {
    if (!dateStr) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${parts[2]} ${bulan[parseInt(parts[1]) - 1]} ${parts[0]}`;
}

function escapeHtmlAnn(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

// ======================= CRUD =======================

function openAnnouncementModal() {
    const modal = document.getElementById('modal-announcement');
    if (!modal) return;
    
    document.getElementById('announcementId').value = '';
    document.getElementById('annTitle').value = '';
    document.getElementById('annMessage').value = '';
    document.getElementById('annPriority').value = 'normal';
    document.getElementById('annExpiryType').value = 'none';
    document.getElementById('annExpiryDate').value = '';
    document.getElementById('annExpiryTime').value = '';
    
    currentAnnouncementImageFile = null;
    const previewImg = document.getElementById('annImagePreview');
    const previewContainer = document.getElementById('annImagePreviewContainer');
    const fileInput = document.getElementById('annImageInput');
    if (previewImg) previewImg.src = '';
    if (previewContainer) previewContainer.style.display = 'none';
    if (fileInput) fileInput.value = '';
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('annExpiryDate').value = formatDateToString(tomorrow);
    
    toggleExpiryInput();
    modal.classList.add('open');
    setTimeout(() => document.getElementById('annTitle')?.focus(), 100);
}

async function editAnnouncement(announcementId) {
    const modal = document.getElementById('modal-announcement');
    if (!modal) return;
    
    if (typeof showToast === 'function') {
        showToast("📝 Memuat data pengumuman...", "info");
    }
    
    let announcements = await fetchAnnouncementsFromAPI();
    const data = announcements.find(a => a.id === announcementId);
    
    if (data) {
        document.getElementById('announcementId').value = announcementId;
        document.getElementById('annTitle').value = data.title || '';
        document.getElementById('annMessage').value = data.message || data.content || '';
        document.getElementById('annPriority').value = data.priority || 'normal';
        
        if (data.imageUrl && data.imageUrl !== 'null' && data.imageUrl !== 'undefined') {
            const previewImg = document.getElementById('annImagePreview');
            const previewContainer = document.getElementById('annImagePreviewContainer');
            if (previewImg) {
                previewImg.src = data.imageUrl;
                previewImg.style.display = 'block';
            }
            if (previewContainer) {
                previewContainer.style.display = 'block';
            }
            currentAnnouncementImageFile = null;
        } else {
            const previewContainer = document.getElementById('annImagePreviewContainer');
            if (previewContainer) previewContainer.style.display = 'none';
            currentAnnouncementImageFile = null;
        }
        
        if (data.expiryDate && data.expiryTime) {
            document.getElementById('annExpiryType').value = 'both';
            document.getElementById('annExpiryDate').value = data.expiryDate;
            document.getElementById('annExpiryTime').value = data.expiryTime;
        } else if (data.expiryDate) {
            document.getElementById('annExpiryType').value = 'date';
            document.getElementById('annExpiryDate').value = data.expiryDate;
        } else if (data.expiryTime) {
            document.getElementById('annExpiryType').value = 'time';
            document.getElementById('annExpiryTime').value = data.expiryTime;
        } else {
            document.getElementById('annExpiryType').value = 'none';
        }
        toggleExpiryInput();
        modal.classList.add('open');
    } else {
        if (typeof showToast === 'function') {
            showToast("❌ Pengumuman tidak ditemukan!", "error");
        }
    }
}

function toggleExpiryInput() {
    const type = document.getElementById('annExpiryType').value;
    const dateGroup = document.getElementById('annExpiryDateGroup');
    const timeGroup = document.getElementById('annExpiryTimeGroup');
    
    if (type === 'date') {
        if (dateGroup) dateGroup.style.display = 'block';
        if (timeGroup) timeGroup.style.display = 'none';
    } else if (type === 'time') {
        if (dateGroup) dateGroup.style.display = 'none';
        if (timeGroup) timeGroup.style.display = 'block';
    } else if (type === 'both') {
        if (dateGroup) dateGroup.style.display = 'block';
        if (timeGroup) timeGroup.style.display = 'block';
    } else {
        if (dateGroup) dateGroup.style.display = 'none';
        if (timeGroup) timeGroup.style.display = 'none';
    }
}

// ======================= SAVE ANNOUNCEMENT =======================

async function saveAnnouncement() {
    if (!currentUser) {
        if (typeof showToast === 'function') showToast("Anda harus login!", "error");
        return;
    }
    if (currentUser.role !== 'admin' && currentUser.role !== 'guru' && currentUser.role !== 'developer') {
        if (typeof showToast === 'function') showToast("⛔ Hanya Admin, Guru, dan Developer yang dapat membuat pengumuman!", "error");
        return;
    }
    
    const announcementId = document.getElementById('announcementId').value;
    const title = document.getElementById('annTitle').value.trim();
    const message = document.getElementById('annMessage').value.trim();
    const priority = document.getElementById('annPriority').value;
    const expiryType = document.getElementById('annExpiryType').value;
    
    if (!title || !message) {
        if (typeof showToast === 'function') showToast("⚠️ Judul dan isi pengumuman wajib diisi!", "error");
        document.getElementById('annTitle').focus();
        return;
    }
    
    let expiryDate = null, expiryTime = null;
    if (expiryType === 'date') {
        expiryDate = document.getElementById('annExpiryDate').value;
        if (!expiryDate) { if (typeof showToast === 'function') showToast("📅 Pilih tanggal berakhir!", "error"); return; }
    } else if (expiryType === 'time') {
        expiryTime = document.getElementById('annExpiryTime').value;
        if (!expiryTime) { if (typeof showToast === 'function') showToast("⏰ Pilih waktu berakhir!", "error"); return; }
    } else if (expiryType === 'both') {
        expiryDate = document.getElementById('annExpiryDate').value;
        expiryTime = document.getElementById('annExpiryTime').value;
        if (!expiryDate || !expiryTime) { if (typeof showToast === 'function') showToast("📅⏰ Pilih tanggal dan waktu berakhir!", "error"); return; }
    }
    
    let imageUrl = null;
    if (currentAnnouncementImageFile) {
        imageUrl = await uploadAnnouncementImage(currentAnnouncementImageFile);
        if (!imageUrl && currentAnnouncementImageFile) {
            if (!confirm("⚠️ Gagal upload gambar. Lanjutkan tanpa gambar?")) {
                return;
            }
        }
    } else {
        const existingImageUrl = document.getElementById('annImagePreview')?.src;
        if (existingImageUrl && existingImageUrl !== '' && !existingImageUrl.includes('blob:') && !existingImageUrl.includes('null')) {
            imageUrl = existingImageUrl;
        }
    }
    
    const announcementData = {
        title,
        message,
        priority,
        createdBy: currentUser.nama || currentUser.email,
        isActive: true
    };
    if (expiryDate) announcementData.expiryDate = expiryDate;
    if (expiryTime) announcementData.expiryTime = expiryTime;
    if (imageUrl) announcementData.imageUrl = imageUrl;
    
    const btn = document.querySelector('#modal-announcement .btn-save');
    if (btn) { btn.disabled = true; btn.innerHTML = '💾 Menyimpan...'; }
    
    try {
        if (announcementId) {
            await updateAnnouncementViaAPI(announcementId, announcementData);
            if (typeof showToast === 'function') showToast("✅ Pengumuman berhasil diupdate!");
        } else {
            await createAnnouncementViaAPI(announcementData);
            if (typeof showToast === 'function') showToast("✅ Pengumuman berhasil dibuat!");
        }
        
        closeModal('modal-announcement');
        showAnnouncementNotification(title, message);
        
        currentAnnouncementImageFile = null;
        const fileInput = document.getElementById('annImageInput');
        if (fileInput) fileInput.value = '';
        const previewContainer = document.getElementById('annImagePreviewContainer');
        if (previewContainer) previewContainer.style.display = 'none';
        
        if (typeof logActivity === 'function') {
            const expiryInfo = expiryDate ? ` (Berakhir: ${expiryDate}${expiryTime ? ' ' + expiryTime : ''})` : '';
            const imageInfo = imageUrl ? ' dengan gambar' : '';
            logActivity(announcementId ? 'update_announcement' : 'create_announcement', 
                       `"${title}" - Prioritas: ${priority}${expiryInfo}${imageInfo}`);
        }
        
        setTimeout(() => {
            renderAnnouncement();
            if (typeof renderFullAnnouncementList === 'function') {
                renderFullAnnouncementList();
            }
        }, 100);
        
    } catch (err) {
        console.error("Save announcement error:", err);
        if (typeof showToast === 'function') showToast("❌ Gagal menyimpan: " + err.message, "error");
    } finally {
        if (btn) { 
            btn.disabled = false; 
            btn.innerHTML = announcementId ? '💾 Update Pengumuman' : '📢 Simpan Pengumuman'; 
        }
    }
}

function showAnnouncementNotification(title, message) {
    if (typeof showToast === 'function') {
        showToast(`📢 Pengumuman baru: ${title}`, "success");
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('📢 Pengumuman Baru', {
            body: title,
            icon: 'https://ui-avatars.com/api/?name=📢&background=4a90e2&color=fff'
        });
    } else if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}

// ======================= DELETE ANNOUNCEMENT =======================

async function deleteAnnouncement(announcementId) {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'guru' && currentUser.role !== 'developer')) {
        if (typeof showToast === 'function') showToast("⛔ Anda tidak memiliki akses!", "error");
        return;
    }
    
    let announcements = await fetchAnnouncementsFromAPI();
    const ann = announcements.find(a => a.id === announcementId);
    const title = ann?.title || 'pengumuman ini';
    
    if (!confirm(`⚠️ Yakin ingin menghapus "${title}"?\n\nTindakan ini tidak dapat dibatalkan!`)) return;
    
    const btn = document.querySelector(`.announcement-item[data-id="${announcementId}"] .announcement-delete`);
    if (btn) btn.style.opacity = '0.5';
    
    try {
        await deleteAnnouncementViaAPI(announcementId);
        
        if (typeof showToast === 'function') showToast(`✅ Pengumuman "${title}" berhasil dihapus`);
        
        if (typeof logActivity === 'function') {
            logActivity('delete_announcement', `Menghapus pengumuman: "${title}"`);
        }
        
        setTimeout(() => {
            renderAnnouncement();
            if (typeof renderFullAnnouncementList === 'function') {
                renderFullAnnouncementList();
            }
        }, 100);
        
    } catch (err) {
        console.error("Delete error:", err);
        if (typeof showToast === 'function') showToast("❌ Gagal menghapus: " + err.message, "error");
        if (btn) btn.style.opacity = '1';
    }
}

// ======================= FULL ANNOUNCEMENT LIST =======================

async function renderFullAnnouncementList() {
    const container = document.getElementById('fullAnnouncementList');
    if (!container) return;
    
    let announcements = [];
    try {
        announcements = await fetchAnnouncementsFromAPI();
    } catch (error) {
        container.innerHTML = '<div style="text-align:center; padding:40px;">❌ Gagal memuat pengumuman</div>';
        return;
    }
    
    if (!announcements || announcements.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px;">📭 Belum ada pengumuman</div>';
        return;
    }
    
    announcements.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    let html = '<div style="display:flex; flex-direction:column; gap:15px;">';
    announcements.forEach(ann => {
        const priorityClass = ann.priority === 'high' ? 'announcement-high' : (ann.priority === 'low' ? 'announcement-low' : 'announcement-normal');
        const createdDate = ann.createdAt ? new Date(ann.createdAt).toLocaleString('id-ID') : '-';
        let expiryInfo = '';
        if (ann.expiryDate) expiryInfo += `📅 Berakhir: ${formatIndonesianDate(ann.expiryDate)}`;
        if (ann.expiryTime) expiryInfo += ` ${ann.expiryTime}`;
        if (!expiryInfo) expiryInfo = '⏰ Tidak terbatas';
        
        let imageHtml = '';
        if (ann.imageUrl && ann.imageUrl !== 'null' && ann.imageUrl !== 'undefined') {
            imageHtml = `
                <div style="margin-top: 10px;">
                    <img src="${ann.imageUrl}" 
                         style="max-width: 100%; max-height: 150px; border-radius: 12px; cursor: pointer; object-fit: cover;"
                         onclick="viewAnnouncementImage('${ann.imageUrl}')"
                         onerror="this.style.display='none'">
                </div>
            `;
        }
        
        html += `
            <div class="announcement-item ${priorityClass}" style="padding:15px; border-radius:12px; background:var(--bg-hover);">
                <div class="announcement-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
                    <span class="announcement-title" style="font-weight:bold; font-size:1.1rem;">📢 ${escapeHtmlAnn(ann.title)}</span>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-icon" onclick="editAnnouncement('${ann.id}')" title="Edit">✏️</button>
                        <button class="btn-icon delete" onclick="deleteAnnouncement('${ann.id}')" title="Hapus">🗑️</button>
                    </div>
                </div>
                <div class="announcement-message" style="margin-bottom:10px;">${escapeHtmlAnn(ann.message || ann.content)}</div>
                ${imageHtml}
                <div class="announcement-footer" style="font-size:0.7rem; color:var(--text-muted); display:flex; gap:15px; flex-wrap:wrap; margin-top:10px;">
                    <span>👤 ${escapeHtmlAnn(ann.createdBy || 'Admin')}</span>
                    <span>📅 ${createdDate}</span>
                    <span>${expiryInfo}</span>
                    <span>${ann.priority === 'high' ? '🔴 Penting' : (ann.priority === 'low' ? '🔵 Rendah' : '🟢 Normal')}</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// ======================= EXPIRY CHECKER =======================

async function checkExpiredAnnouncements() {
    console.log("⏰ Checking for expired announcements...");
    
    let announcements = [];
    try {
        announcements = await fetchAnnouncementsFromAPI();
    } catch (error) {
        return;
    }
    
    const now = new Date();
    const currentTime = formatTimeToString(now);
    const currentDate = formatDateToString(now);
    let hasExpired = false;
    let expiredTitles = [];
    
    for (const ann of announcements) {
        let isExpired = false;
        if (ann.isActive === false) isExpired = true;
        else if (ann.expiryDate && ann.expiryTime) {
            if (ann.expiryDate < currentDate) isExpired = true;
            else if (ann.expiryDate === currentDate && ann.expiryTime <= currentTime) isExpired = true;
        } else if (ann.expiryDate) {
            if (ann.expiryDate < currentDate) isExpired = true;
        } else if (ann.expiryTime) {
            if (currentTime >= ann.expiryTime) isExpired = true;
        }
        
        if (isExpired) {
            expiredTitles.push(ann.title);
            if (ann.imageUrl && typeof deleteFromSupabase === 'function') {
                try {
                    await deleteFromSupabase(ann.imageUrl);
                } catch (err) {
                    console.warn("Gagal hapus gambar expired:", err);
                }
            }
            await deleteAnnouncementViaAPI(ann.id);
            hasExpired = true;
        }
    }
    
    if (hasExpired) {
        console.log(`🗑️ Removed expired announcements: ${expiredTitles.join(', ')}`);
        setTimeout(() => renderAnnouncement(), 100);
        if (expiredTitles.length > 0 && typeof showToast === 'function') {
            showToast(`⏰ ${expiredTitles.length} pengumuman telah kadaluarsa dan dihapus`, "info");
        }
    }
}

function startAnnouncementChecker() {
    if (announcementCheckInterval) clearInterval(announcementCheckInterval);
    announcementCheckInterval = setInterval(() => checkExpiredAnnouncements(), 30000);
    setTimeout(() => checkExpiredAnnouncements(), 1000);
}

// ======================= REAL-TIME LISTENER =======================

function initAnnouncementListener() {
    if (announcementListenerAttached) return;
    announcementListenerAttached = true;
    console.log("🔔 Setting up announcement refresh interval...");
    
    // Refresh setiap 10 detik untuk simulasi real-time
    setInterval(() => {
        renderAnnouncement();
    }, 10000);
}

// ======================= FUNGSI TEST & DEBUG =======================

function createTestAnnouncement() {
    if (!currentUser) {
        if (typeof showToast === 'function') showToast("Anda harus login terlebih dahulu!", "error");
        return;
    }
    if (currentUser.role !== 'admin' && currentUser.role !== 'guru' && currentUser.role !== 'developer') {
        if (typeof showToast === 'function') showToast("⛔ Hanya admin, guru, dan developer yang bisa membuat test!", "error");
        return;
    }
    
    const testData = {
        title: "🧪 TEST PENGUMUMAN",
        message: "✅ Ini adalah pengumuman test. Jika Anda melihat ini, sistem pengumuman berfungsi dengan baik!",
        priority: "high",
        createdBy: currentUser.nama || currentUser.email
    };
    
    console.log("Membuat test announcement:", testData);
    const btn = document.querySelector('[onclick="createTestAnnouncement()"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Membuat...'; }
    
    createAnnouncementViaAPI(testData)
        .then(() => {
            if (typeof showToast === 'function') showToast("✅ Test pengumuman berhasil dibuat!");
            
            if (typeof logActivity === 'function') {
                logActivity('create_test_announcement', `Membuat test pengumuman: "🧪 TEST PENGUMUMAN"`);
            }
            
            setTimeout(() => renderAnnouncement(), 100);
        })
        .catch(err => {
            console.error("Gagal membuat test:", err);
            if (typeof showToast === 'function') showToast("❌ Gagal: " + err.message, "error");
        })
        .finally(() => { if (btn) { btn.disabled = false; btn.textContent = '🧪 Test Pengumuman'; } });
}

async function debugCheckAnnouncements() {
    console.log("=== 🔍 DEBUG PENGUMUMAN ===");
    console.log("Current user:", currentUser ? currentUser.nama : "Tidak ada user");
    console.log("Current time:", new Date().toLocaleString());
    
    let announcements = await fetchAnnouncementsFromAPI();
    console.log("Data dari API:", JSON.stringify(announcements, null, 2));
    
    if (!announcements || announcements.length === 0) {
        console.log("❌ TIDAK ADA DATA!");
        if (typeof showToast === 'function') showToast("❌ Tidak ada pengumuman di database", "error");
    } else {
        console.log(`✅ Ada ${announcements.length} pengumuman di database.`);
        if (typeof showToast === 'function') showToast(`📊 ${announcements.length} pengumuman aktif ditemukan`, "success");
    }
}

// ======================= CLEANUP =======================

function cleanupAnnouncementSystem() {
    if (announcementCheckInterval) clearInterval(announcementCheckInterval);
    announcementCheckInterval = null;
    if (announcementCountdownInterval) clearInterval(announcementCountdownInterval);
    announcementCountdownInterval = null;
    announcementListenerAttached = false;
    announcementDataReadyListenerAdded = false;
    announcementUiReadyListenerAdded = false;
    currentAnnouncementImageFile = null;
    console.log("🧹 Announcement system cleaned up");
}

// ======================= INISIALISASI =======================

setupAnnouncementDataReadyListener();
setupAnnouncementUiReadyListener();

if (typeof window !== 'undefined' && !announcementListenerAttached) {
    console.log("📢 announcement.js: Initializing immediately");
    setTimeout(() => {
        if (!announcementListenerAttached) {
            initAnnouncementListener();
            startAnnouncementChecker();
            renderAnnouncement();
        }
    }, 100);
}

// ======================= EKSPOR KE GLOBAL =======================
window.renderAnnouncement = renderAnnouncement;
window.openAnnouncementModal = openAnnouncementModal;
window.editAnnouncement = editAnnouncement;
window.saveAnnouncement = saveAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.createTestAnnouncement = createTestAnnouncement;
window.debugCheckAnnouncements = debugCheckAnnouncements;
window.cleanupAnnouncementSystem = cleanupAnnouncementSystem;
window.initAnnouncementSystem = initAnnouncementListener;
window.renderFullAnnouncementList = renderFullAnnouncementList;
window.viewAnnouncementImage = viewAnnouncementImage;
window.previewAnnouncementImage = previewAnnouncementImage;
window.removeAnnouncementImage = removeAnnouncementImage;
window.fetchAnnouncementsFromAPI = fetchAnnouncementsFromAPI;

console.log("✅ announcement.js V5.0 loaded - Compatible with Vercel Backend API!");