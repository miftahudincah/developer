// status.js - VERSION 2.0 (FIXED - TOMBOL STATUS SAYA SELALU MUNCUL)
// Fitur Status (Story) - Bertahan 24 jam lalu otomatis terhapus
// Seperti Facebook/WhatsApp Stories - Hanya untuk teman

let statusCheckInterval = null;
let statusViewListener = null;
let currentStatusIndex = 0;
let statusModalOpen = false;
let statusAutoTimer = null;

// ======================= INISIALISASI =======================

function initStatusSystem() {
    console.log("📸 Initializing status system...");
    
    if (!currentUser) {
        console.log("No user logged in, skipping status init");
        return;
    }
    
    setupStatusListener();
    startStatusExpiryChecker();
    renderStatusBar();
}

function setupStatusListener() {
    if (statusViewListener) {
        db.ref('status').off('value', statusViewListener);
    }
    
    statusViewListener = db.ref('status').on('value', (snapshot) => {
        const data = snapshot.val();
        const now = Date.now();
        const activeStatus = {};
        
        if (data) {
            for (const [uid, userStatuses] of Object.entries(data)) {
                const validStatuses = [];
                for (const [statusId, status] of Object.entries(userStatuses)) {
                    if (status.expiresAt && status.expiresAt > now) {
                        validStatuses.push({ id: statusId, ...status });
                    }
                }
                if (validStatuses.length > 0) {
                    activeStatus[uid] = validStatuses;
                }
            }
        }
        
        renderStatusBar(activeStatus);
        
        if (statusModalOpen) {
            loadStatusesForModal();
        }
    });
}

function startStatusExpiryChecker() {
    if (statusCheckInterval) clearInterval(statusCheckInterval);
    
    statusCheckInterval = setInterval(() => {
        checkAndCleanExpiredStatus();
    }, 5 * 60 * 1000);
    
    setTimeout(() => checkAndCleanExpiredStatus(), 1000);
}

async function checkAndCleanExpiredStatus() {
    const now = Date.now();
    const snapshot = await db.ref('status').once('value');
    const data = snapshot.val();
    
    if (!data) return;
    
    let hasDeleted = false;
    
    for (const [uid, userStatuses] of Object.entries(data)) {
        for (const [statusId, status] of Object.entries(userStatuses)) {
            if (status.expiresAt && status.expiresAt <= now) {
                await db.ref(`status/${uid}/${statusId}`).remove();
                hasDeleted = true;
                console.log(`🗑️ Status expired: ${statusId} from ${uid}`);
            }
        }
    }
    
    if (hasDeleted) {
        renderStatusBar();
    }
}

// ======================= RENDER STATUS BAR =======================

function renderStatusBar(activeStatus = null) {
    const container = document.getElementById('statusBar');
    if (!container) {
        console.warn("⚠️ Element #statusBar tidak ditemukan!");
        return;
    }
    
    // TAMPILKAN TOMBOL STATUS SAYA TERLEBIH DAHULU
    let html = `
        <div class="status-bar-scroll">
            <div class="status-item my-status" onclick="openCreateStatusModal()">
                <div class="status-avatar">
                    <img src="${currentUser?.photoUrl || getAvatarUrl(currentUser?.nama || 'User')}" alt="My Status">
                    <div class="status-add-icon">+</div>
                </div>
                <div class="status-name">Status Saya</div>
                <div class="status-time">Tambah</div>
            </div>
    `;
    
    const loadAndRender = async () => {
        try {
            let statuses = activeStatus;
            if (!statuses) {
                const snapshot = await db.ref('status').once('value');
                const data = snapshot.val();
                const now = Date.now();
                statuses = {};
                
                if (data) {
                    for (const [uid, userStatuses] of Object.entries(data)) {
                        const validStatuses = [];
                        for (const [statusId, status] of Object.entries(userStatuses)) {
                            if (status.expiresAt && status.expiresAt > now) {
                                validStatuses.push({ id: statusId, ...status });
                            }
                        }
                        if (validStatuses.length > 0) {
                            statuses[uid] = validStatuses;
                        }
                    }
                }
            }
            
            // Ambil data user untuk setiap status (kecuali diri sendiri)
            const statusList = [];
            for (const [uid, userStatuses] of Object.entries(statuses)) {
                // Skip current user (status sendiri sudah ada di atas)
                if (uid === currentUser?.uid) continue;
                
                // Cek apakah teman
                const isFriend = await checkIsFriend(uid);
                if (!isFriend) continue;
                
                const userSnapshot = await db.ref(`users_auth/${uid}`).once('value');
                const userData = userSnapshot.val();
                if (userData) {
                    const hasUnviewed = userStatuses.some(s => !s.viewedBy?.[currentUser?.uid]);
                    statusList.push({
                        uid: uid,
                        nama: userData.nama,
                        photoUrl: userData.photoUrl,
                        statuses: userStatuses,
                        hasUnviewed: hasUnviewed,
                        latestStatus: userStatuses[userStatuses.length - 1]
                    });
                }
            }
            
            // Urutkan: yang punya status baru (belum dilihat) di atas
            statusList.sort((a, b) => {
                if (a.hasUnviewed && !b.hasUnviewed) return -1;
                if (!a.hasUnviewed && b.hasUnviewed) return 1;
                return (b.latestStatus?.timestamp || 0) - (a.latestStatus?.timestamp || 0);
            });
            
            // Tambahkan status teman
            for (const status of statusList) {
                html += `
                    <div class="status-item ${status.hasUnviewed ? 'unviewed' : 'viewed'}" onclick="viewUserStatus('${status.uid}')">
                        <div class="status-avatar">
                            <img src="${status.photoUrl || getAvatarUrl(status.nama)}" alt="${escapeHtml(status.nama)}">
                            ${status.hasUnviewed ? '<span class="status-ring"></span>' : ''}
                        </div>
                        <div class="status-name">${escapeHtml(status.nama)}</div>
                    </div>
                `;
            }
            
            html += `</div>`;
            container.innerHTML = html;
            
        } catch (err) {
            console.error("Error loading statuses:", err);
            // Tetap tampilkan minimal tombol status saya
            html += `</div>`;
            container.innerHTML = html;
        }
    };
    
    loadAndRender();
}

function formatStatusTime(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / 3600000);
    
    if (hours < 1) return 'Baru saja';
    if (hours < 24) return `${hours} jam`;
    return `${Math.floor(hours / 24)} hari`;
}

// ======================= CHECK FRIEND =======================

async function checkIsFriend(friendUid) {
    if (!currentUser) return false;
    const snapshot = await db.ref(`friendships/list/${currentUser.uid}/${friendUid}`).once('value');
    return snapshot.exists();
}

// ======================= MENGELOLA STATUS =======================

function openCreateStatusModal() {
    const modal = document.getElementById('modal-create-status');
    if (!modal) return;
    
    document.getElementById('statusText').value = '';
    document.getElementById('statusImageInput').value = '';
    document.getElementById('statusImagePreview').style.display = 'none';
    document.getElementById('statusImagePreview').src = '';
    
    modal.classList.add('open');
}

async function createStatus() {
    const text = document.getElementById('statusText').value.trim();
    const imageFile = document.getElementById('statusImageInput').files[0];
    
    if (!text && !imageFile) {
        showToast("⚠️ Masukkan teks atau pilih gambar untuk status!", "error");
        return;
    }
    
    const btn = document.querySelector('#modal-create-status .btn-save');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Mengunggah...';
    }
    
    let mediaUrl = '';
    let mediaType = 'text';
    
    if (imageFile) {
        if (imageFile.size > 5 * 1024 * 1024) {
            showToast("❌ Ukuran gambar maksimal 5MB!", "error");
            if (btn) { btn.disabled = false; btn.innerHTML = 'Upload'; }
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('image', imageFile);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                mediaUrl = data.data.image.url;
                mediaType = 'image';
            } else {
                throw new Error("Upload failed");
            }
        } catch (err) {
            console.error("Upload error:", err);
            showToast("❌ Gagal upload gambar", "error");
            if (btn) { btn.disabled = false; btn.innerHTML = 'Upload'; }
            return;
        }
    }
    
    const statusId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = Date.now();
    const expiresAt = now + (24 * 60 * 60 * 1000);
    
    const statusData = {
        id: statusId,
        from: currentUser.uid,
        fromName: currentUser.nama,
        fromPhoto: currentUser.photoUrl,
        text: text || '',
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        timestamp: now,
        expiresAt: expiresAt,
        viewedBy: {
            [currentUser.uid]: true
        }
    };
    
    try {
        await db.ref(`status/${currentUser.uid}/${statusId}`).set(statusData);
        showToast("✅ Status berhasil diupload! (Akan hilang dalam 24 jam)", "success");
        closeModal('modal-create-status');
        renderStatusBar();
    } catch (err) {
        console.error("Create status error:", err);
        showToast("❌ Gagal membuat status", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Upload';
        }
    }
}

// ======================= MELIHAT STATUS =======================

let currentStatuses = [];
let currentStatusUser = null;

async function viewUserStatus(uid) {
    if (uid === currentUser.uid) {
        showToast("Anda tidak bisa melihat status sendiri di sini", "info");
        return;
    }
    
    // Cek apakah masih teman
    const isFriend = await checkIsFriend(uid);
    if (!isFriend) {
        showToast("Anda hanya bisa melihat status dari teman!", "error");
        return;
    }
    
    const snapshot = await db.ref(`status/${uid}`).once('value');
    const data = snapshot.val();
    
    if (!data) {
        showToast("Tidak ada status", "info");
        return;
    }
    
    const now = Date.now();
    currentStatuses = [];
    for (const [statusId, status] of Object.entries(data)) {
        if (status.expiresAt && status.expiresAt > now) {
            currentStatuses.push({ id: statusId, ...status });
        }
    }
    
    if (currentStatuses.length === 0) {
        showToast("Status sudah kedaluwarsa", "info");
        return;
    }
    
    currentStatuses.sort((a, b) => a.timestamp - b.timestamp);
    currentStatusUser = uid;
    currentStatusIndex = 0;
    
    await markStatusAsViewed(uid, currentStatuses[0].id);
    openStatusViewer();
}

async function markStatusAsViewed(uid, statusId) {
    await db.ref(`status/${uid}/${statusId}/viewedBy/${currentUser.uid}`).set(true);
    renderStatusBar();
}

function openStatusViewer() {
    const modal = document.getElementById('modal-status-viewer');
    if (!modal) return;
    
    statusModalOpen = true;
    modal.classList.add('open');
    renderCurrentStatus();
}

function renderCurrentStatus() {
    const container = document.getElementById('statusViewerContent');
    if (!container) return;
    
    if (currentStatusIndex < 0 || currentStatusIndex >= currentStatuses.length) {
        closeModal('modal-status-viewer');
        statusModalOpen = false;
        return;
    }
    
    const status = currentStatuses[currentStatusIndex];
    const total = currentStatuses.length;
    
    if (statusAutoTimer) clearTimeout(statusAutoTimer);
    
    container.innerHTML = `
        <div class="status-viewer-header">
            <div class="status-viewer-progress">
                ${Array(total).fill(0).map((_, i) => `
                    <div class="progress-bar ${i === currentStatusIndex ? 'active' : (i < currentStatusIndex ? 'completed' : '')}" 
                         style="width: calc((100% - ${total-1}*5px)/${total})"></div>
                `).join('')}
            </div>
            <div class="status-viewer-user">
                <img src="${status.fromPhoto || getAvatarUrl(status.fromName)}" alt="">
                <div>
                    <strong>${escapeHtml(status.fromName)}</strong>
                    <small>${formatStatusTime(status.timestamp)}</small>
                </div>
                <button class="btn-icon" onclick="closeModal('modal-status-viewer')" style="margin-left:auto;">✖</button>
            </div>
        </div>
        <div class="status-viewer-body" onclick="nextStatus()">
            ${status.mediaType === 'image' ? 
                `<img src="${status.mediaUrl}" alt="Status" style="max-width:100%; max-height:70vh; border-radius:12px;">` : 
                `<div class="status-text-only">${escapeHtml(status.text)}</div>`
            }
            ${status.text && status.mediaType !== 'text' ? `<div class="status-caption">${escapeHtml(status.text)}</div>` : ''}
        </div>
        <div class="status-viewer-footer">
            <button class="btn-icon" onclick="previousStatus()" ${currentStatusIndex === 0 ? 'disabled' : ''}>◀</button>
            <span>${currentStatusIndex + 1} dari ${total}</span>
            <button class="btn-icon" onclick="nextStatus()" ${currentStatusIndex === total - 1 ? 'disabled' : ''}>▶</button>
        </div>
    `;
    
    statusAutoTimer = setTimeout(() => {
        nextStatus();
    }, 5000);
}

function nextStatus() {
    if (currentStatusIndex + 1 < currentStatuses.length) {
        currentStatusIndex++;
        markStatusAsViewed(currentStatusUser, currentStatuses[currentStatusIndex].id);
        renderCurrentStatus();
    } else {
        closeModal('modal-status-viewer');
        statusModalOpen = false;
        renderStatusBar();
    }
}

function previousStatus() {
    if (currentStatusIndex - 1 >= 0) {
        currentStatusIndex--;
        renderCurrentStatus();
    }
}

function previewStatusImage(input) {
    const preview = document.getElementById('statusImagePreview');
    const container = document.getElementById('statusImagePreviewContainer');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            if (container) container.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// ======================= DELETE STATUS =======================

async function deleteStatus(statusId) {
    if (!confirm("Hapus status ini?")) return;
    
    try {
        await db.ref(`status/${currentUser.uid}/${statusId}`).remove();
        showToast("✅ Status dihapus", "success");
        renderStatusBar();
    } catch (err) {
        console.error("Delete status error:", err);
        showToast("❌ Gagal menghapus status", "error");
    }
}

// ======================= LOAD STATUSES FOR MODAL =======================

async function loadStatusesForModal() {
    if (currentStatusUser && currentStatuses.length > 0) {
        const snapshot = await db.ref(`status/${currentStatusUser}`).once('value');
        const data = snapshot.val();
        const now = Date.now();
        const newStatuses = [];
        
        if (data) {
            for (const [statusId, status] of Object.entries(data)) {
                if (status.expiresAt && status.expiresAt > now) {
                    newStatuses.push({ id: statusId, ...status });
                }
            }
        }
        
        newStatuses.sort((a, b) => a.timestamp - b.timestamp);
        
        if (newStatuses.length !== currentStatuses.length) {
            currentStatuses = newStatuses;
            if (currentStatusIndex >= currentStatuses.length) {
                currentStatusIndex = currentStatuses.length - 1;
            }
            renderCurrentStatus();
        }
    }
}

// ======================= CLEANUP =======================

function cleanupStatusSystem() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
    if (statusAutoTimer) {
        clearTimeout(statusAutoTimer);
        statusAutoTimer = null;
    }
    if (statusViewListener) {
        db.ref('status').off('value', statusViewListener);
        statusViewListener = null;
    }
    console.log("🧹 Status system cleaned up");
}

// ======================= UTILITY =======================

function getAvatarUrl(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=00bcd4&color=fff&size=100`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

// ======================= EXPORT KE GLOBAL =======================
window.initStatusSystem = initStatusSystem;
window.createStatus = createStatus;
window.openCreateStatusModal = openCreateStatusModal;
window.viewUserStatus = viewUserStatus;
window.nextStatus = nextStatus;
window.previousStatus = previousStatus;
window.deleteStatus = deleteStatus;
window.previewStatusImage = previewStatusImage;
window.cleanupStatusSystem = cleanupStatusSystem;