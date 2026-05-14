// status.js - VERSION 1.0 (FULLY FEATURED)
// Fitur Status Update (seperti Story)
// Mendukung: upload teks/gambar, status akan hilang setelah 24 jam,
//            tampilan status bar horizontal, viewer dengan next/prev,
//            notifikasi status baru, real-time listener.

let statusesListener = null;
let currentStatusList = [];
let currentStatusIndex = 0;
let statusViewerInterval = null;

// ======================= INISIALISASI =======================

/**
 * Inisialisasi sistem status
 * Dipanggil dari initApp setelah login
 */
function initStatusSystem() {
    if (!currentUser) {
        console.log("⏳ Menunggu currentUser untuk initStatusSystem");
        setTimeout(initStatusSystem, 1000);
        return;
    }
    console.log("📸 Initializing status system...");
    
    // Setup listener real-time untuk status
    setupStatusListener();
    
    // Setup listener untuk command hapus expired
    startStatusExpiryChecker();
    
    // Request notifikasi
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

/**
 * Setup real-time listener untuk status
 * Hanya ambil status dari 24 jam terakhir, urut dari yang terbaru
 */
function setupStatusListener() {
    if (statusesListener) {
        db.ref('statuses').off('value', statusesListener);
    }
    
    statusesListener = db.ref('statuses').on('value', (snapshot) => {
        const data = snapshot.val();
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        let allStatuses = [];
        if (data) {
            Object.keys(data).forEach(userId => {
                const userStatuses = data[userId];
                if (userStatuses) {
                    Object.keys(userStatuses).forEach(statusId => {
                        const status = userStatuses[statusId];
                        // Hanya tampilkan status yang belum expired (kurang dari 24 jam)
                        if (status.createdAt && (now - status.createdAt) < twentyFourHours) {
                            allStatuses.push({
                                id: statusId,
                                userId: userId,
                                ...status
                            });
                        } else if (status.createdAt && (now - status.createdAt) >= twentyFourHours) {
                            // Hapus status yang expired
                            db.ref(`statuses/${userId}/${statusId}`).remove();
                        }
                    });
                }
            });
        }
        
        // Urutkan berdasarkan createdAt descending (terbaru di awal)
        allStatuses.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        // Kelompokkan per user untuk ditampilkan di status bar
        const groupedByUser = {};
        allStatuses.forEach(status => {
            if (!groupedByUser[status.userId]) {
                groupedByUser[status.userId] = [];
            }
            groupedByUser[status.userId].push(status);
        });
        
        // Render status bar
        renderStatusBar(groupedByUser);
        
        // Simpan untuk viewer
        currentStatusList = allStatuses;
        
        // Notifikasi status baru (hanya jika ada status baru dalam 5 detik terakhir)
        checkAndNotifyNewStatus(allStatuses);
    });
}

/**
 * Cek status baru dan tampilkan notifikasi
 */
let lastStatusCount = 0;
function checkAndNotifyNewStatus(statuses) {
    const currentCount = statuses.length;
    if (currentCount > lastStatusCount && lastStatusCount > 0) {
        const newStatuses = statuses.slice(0, currentCount - lastStatusCount);
        newStatuses.forEach(status => {
            if (status.userId !== currentUser.uid) {
                showToast(`📸 ${status.userName || 'Seseorang'} membagikan status baru`, "info");
                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    new Notification('Status Baru', {
                        body: status.userName ? `${status.userName} membagikan status` : 'Status baru dari teman',
                        icon: status.userPhoto || 'https://ui-avatars.com/api/?name=📸&background=00bcd4&color=fff'
                    });
                }
            }
        });
    }
    lastStatusCount = currentCount;
}

/**
 * Pengecekan otomatis status expired setiap jam
 */
let expiryInterval = null;
function startStatusExpiryChecker() {
    if (expiryInterval) clearInterval(expiryInterval);
    expiryInterval = setInterval(() => {
        // Trigger refresh listener (akan otomatis hapus expired)
        db.ref('statuses').once('value').catch(() => {});
    }, 60 * 60 * 1000); // setiap 1 jam
}

// ======================= RENDER STATUS BAR =======================

/**
 * Render status bar horizontal di dashboard
 */
function renderStatusBar(groupedByUser) {
    const container = document.getElementById('statusBar');
    if (!container) return;
    
    if (!groupedByUser || Object.keys(groupedByUser).length === 0) {
        container.innerHTML = '<div class="status-empty text-small" style="text-align:center; padding:10px;">📭 Belum ada status. Buat status pertama!</div>';
        return;
    }
    
    let html = '';
    // Tampilkan status user sendiri di paling depan (jika ada)
    if (groupedByUser[currentUser.uid]) {
        const myStatuses = groupedByUser[currentUser.uid];
        const latest = myStatuses[0];
        const isViewed = latest.viewedBy && latest.viewedBy[currentUser.uid];
        html += `
            <div class="status-item ${!isViewed ? 'unviewed' : ''}" onclick="openStatusViewer('${currentUser.uid}')">
                <div class="status-avatar">
                    <img src="${latest.userPhoto || getAvatarUrl(latest.userName)}" alt="${escapeHtml(latest.userName)}">
                    <div class="status-add-icon" onclick="event.stopPropagation(); openCreateStatusModal()">+</div>
                </div>
                <div class="status-name">Status Saya</div>
                <div class="status-time">${formatTimeAgo(latest.createdAt)}</div>
            </div>
        `;
    } else {
        // Tombol buat status untuk user sendiri jika belum punya status
        html += `
            <div class="status-item" onclick="openCreateStatusModal()">
                <div class="status-avatar">
                    <img src="${currentUser.photoUrl || getAvatarUrl(currentUser.nama)}" alt="${escapeHtml(currentUser.nama)}">
                    <div class="status-add-icon">+</div>
                </div>
                <div class="status-name">Status Saya</div>
                <div class="status-time">Tambah</div>
            </div>
        `;
    }
    
    // Tampilkan status dari user lain
    for (const [userId, statuses] of Object.entries(groupedByUser)) {
        if (userId === currentUser.uid) continue;
        const latest = statuses[0];
        const isViewed = latest.viewedBy && latest.viewedBy[currentUser.uid];
        html += `
            <div class="status-item ${!isViewed ? 'unviewed' : ''}" onclick="openStatusViewer('${userId}')">
                <div class="status-avatar">
                    <img src="${latest.userPhoto || getAvatarUrl(latest.userName)}" alt="${escapeHtml(latest.userName)}">
                    ${!isViewed ? '<div class="status-ring"></div>' : ''}
                </div>
                <div class="status-name">${escapeHtml(latest.userName)}</div>
                <div class="status-time">${formatTimeAgo(latest.createdAt)}</div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ======================= CREATE STATUS =======================

/**
 * Buka modal buat status
 */
function openCreateStatusModal() {
    const modal = document.getElementById('modal-create-status');
    if (!modal) {
        console.warn("Modal create status tidak ditemukan");
        return;
    }
    document.getElementById('statusText').value = '';
    document.getElementById('statusImageInput').value = '';
    document.getElementById('statusImagePreviewContainer').style.display = 'none';
    modal.classList.add('open');
}

/**
 * Preview gambar sebelum upload
 */
function previewStatusImage(input) {
    const previewContainer = document.getElementById('statusImagePreviewContainer');
    const previewImg = document.getElementById('statusImagePreview');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        previewContainer.style.display = 'none';
    }
}

/**
 * Upload status (teks dan/atau gambar)
 */
async function createStatus() {
    if (!currentUser) {
        showToast("Anda harus login!", "error");
        return;
    }
    
    const text = document.getElementById('statusText').value.trim();
    const imageFile = document.getElementById('statusImageInput').files[0];
    
    if (!text && !imageFile) {
        showToast("Masukkan teks atau pilih gambar!", "error");
        return;
    }
    
    const btn = document.querySelector('#modal-create-status .btn-save');
    const originalText = btn?.innerHTML;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Mengupload...';
    }
    
    let mediaUrl = null;
    let type = 'text';
    
    try {
        // Upload gambar jika ada
        if (imageFile) {
            if (imageFile.size > 5 * 1024 * 1024) {
                showToast("Ukuran gambar maksimal 5MB!", "error");
                if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
                return;
            }
            const formData = new FormData();
            formData.append('image', imageFile);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                mediaUrl = data.data.image.url;
                type = 'image';
            } else {
                throw new Error("Gagal upload gambar");
            }
        }
        
        // Data status
        const statusId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const statusData = {
            text: text || (type === 'image' ? '📸 ' : ''),
            mediaUrl: mediaUrl,
            type: type,
            userName: currentUser.nama,
            userPhoto: currentUser.photoUrl || null,
            userId: currentUser.uid,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            viewedBy: {}
        };
        
        await db.ref(`statuses/${currentUser.uid}/${statusId}`).set(statusData);
        showToast("✅ Status berhasil diposting!", "success");
        closeModal('modal-create-status');
        
    } catch (err) {
        console.error("Create status error:", err);
        showToast("❌ Gagal posting status: " + err.message, "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// ======================= STATUS VIEWER =======================

/**
 * Buka viewer status untuk user tertentu
 */
async function openStatusViewer(userId) {
    // Ambil semua status dari user tersebut (belum expired)
    const snapshot = await db.ref(`statuses/${userId}`).once('value');
    const statuses = snapshot.val();
    if (!statuses) {
        showToast("Tidak ada status dari user ini", "info");
        return;
    }
    
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const userStatuses = Object.keys(statuses)
        .filter(key => (now - (statuses[key].createdAt || 0)) < twentyFourHours)
        .map(key => ({ id: key, ...statuses[key] }))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    
    if (userStatuses.length === 0) {
        showToast("Status sudah kadaluarsa", "info");
        return;
    }
    
    // Tandai sebagai sudah dilihat oleh current user
    for (const status of userStatuses) {
        if (!status.viewedBy || !status.viewedBy[currentUser.uid]) {
            await db.ref(`statuses/${userId}/${status.id}/viewedBy/${currentUser.uid}`).set(true);
        }
    }
    
    currentStatusList = userStatuses;
    currentStatusIndex = 0;
    showStatusViewerModal(currentStatusList[currentStatusIndex]);
}

/**
 * Tampilkan modal viewer dengan status tertentu
 */
function showStatusViewerModal(status) {
    const modal = document.getElementById('modal-status-viewer');
    if (!modal) return;
    
    const content = document.getElementById('statusViewerContent');
    if (!content) return;
    
    // Hentikan interval sebelumnya
    if (statusViewerInterval) clearInterval(statusViewerInterval);
    
    const updateContent = () => {
        const s = currentStatusList[currentStatusIndex];
        if (!s) {
            closeModal('modal-status-viewer');
            return;
        }
        
        let mediaHtml = '';
        if (s.type === 'image' && s.mediaUrl) {
            mediaHtml = `
                <div class="status-image-wrapper" onclick="nextStatus()">
                    <img src="${s.mediaUrl}" class="status-full-image" alt="Status">
                </div>
            `;
        } else {
            mediaHtml = `
                <div class="status-text-wrapper" onclick="nextStatus()">
                    <div class="status-full-text">${escapeHtml(s.text)}</div>
                </div>
            `;
        }
        
        content.innerHTML = `
            <div class="status-viewer-content">
                <div class="status-viewer-header">
                    <div class="status-viewer-user">
                        <img src="${s.userPhoto || getAvatarUrl(s.userName)}" alt="${escapeHtml(s.userName)}">
                        <div class="status-user-info">
                            <strong>${escapeHtml(s.userName)}</strong>
                            <span>${formatTimeAgo(s.createdAt)}</span>
                        </div>
                    </div>
                </div>
                ${mediaHtml}
                ${s.text && s.type !== 'image' ? `<div class="status-image-caption">${escapeHtml(s.text)}</div>` : ''}
                <div class="status-nav-buttons">
                    <button class="status-nav-prev" ${currentStatusIndex === 0 ? 'disabled' : ''} onclick="prevStatus()">◀</button>
                    <span class="status-counter">${currentStatusIndex+1} / ${currentStatusList.length}</span>
                    <button class="status-nav-next" ${currentStatusIndex === currentStatusList.length-1 ? 'disabled' : ''} onclick="nextStatus()">▶</button>
                </div>
            </div>
        `;
    };
    
    updateContent();
    modal.classList.add('open');
    
    // Auto next setiap 5 detik
    statusViewerInterval = setInterval(() => {
        if (currentStatusIndex < currentStatusList.length - 1) {
            nextStatus();
        } else {
            // Tutup modal jika sudah di akhir
            clearInterval(statusViewerInterval);
            closeModal('modal-status-viewer');
        }
    }, 5000);
}

function nextStatus() {
    if (currentStatusIndex < currentStatusList.length - 1) {
        currentStatusIndex++;
        showStatusViewerModal(currentStatusList[currentStatusIndex]);
    } else {
        closeModal('modal-status-viewer');
    }
}

function prevStatus() {
    if (currentStatusIndex > 0) {
        currentStatusIndex--;
        showStatusViewerModal(currentStatusList[currentStatusIndex]);
    }
}

// ======================= UTILITY =======================

function getAvatarUrl(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=00bcd4&color=fff&size=100`;
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days} h`;
    if (hours > 0) return `${hours} jam`;
    if (minutes > 0) return `${minutes} m`;
    return 'Baru saja';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

// ======================= CLEANUP =======================

function cleanupStatusSystem() {
    if (statusesListener) {
        db.ref('statuses').off('value', statusesListener);
        statusesListener = null;
    }
    if (expiryInterval) {
        clearInterval(expiryInterval);
        expiryInterval = null;
    }
    if (statusViewerInterval) {
        clearInterval(statusViewerInterval);
        statusViewerInterval = null;
    }
    console.log("🧹 Status system cleaned up");
}

// ======================= EKSPOR KE GLOBAL =======================
window.initStatusSystem = initStatusSystem;
window.openCreateStatusModal = openCreateStatusModal;
window.previewStatusImage = previewStatusImage;
window.createStatus = createStatus;
window.openStatusViewer = openStatusViewer;
window.nextStatus = nextStatus;
window.prevStatus = prevStatus;
window.cleanupStatusSystem = cleanupStatusSystem;

// Auto init setelah currentUser siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (typeof currentUser !== 'undefined' && currentUser) {
                initStatusSystem();
            }
        }, 2000);
    });
} else {
    setTimeout(() => {
        if (typeof currentUser !== 'undefined' && currentUser) {
            initStatusSystem();
        }
    }, 2000);
}

console.log("✅ status.js loaded - Story feature ready");