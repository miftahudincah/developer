// status.js - VERSION 2.0 (EVENT-BASED, NO AUTO-INIT)
// Fitur Status Update (seperti Story)
// Mendukung: upload teks/gambar, status akan hilang setelah 24 jam,
//            tampilan status bar horizontal, viewer dengan next/prev,
//            notifikasi status baru, real-time listener.
// PERUBAHAN: Inisialisasi via event 'uiReady', bukan auto-init
// ============================================================================

let statusesListener = null;
let currentStatusList = [];
let currentStatusIndex = 0;
let statusViewerInterval = null;
let statusExpiryInterval = null;
let statusUiReadyListenerAdded = false;
let lastStatusCount = 0;

// ======================= EVENT LISTENER ========================

function setupStatusUiReadyListener() {
    if (statusUiReadyListenerAdded) return;
    statusUiReadyListenerAdded = true;
    console.log("📡 Setting up uiReady event listener for status module");

    window.addEventListener('uiReady', (e) => {
        const user = e.detail.currentUser;
        if (user && user.uid) {
            console.log("📸 status.js: uiReady received, initializing status system");
            initStatusSystem();
        } else {
            console.log("📸 status.js: no user in uiReady, skipping");
        }
    });
}

// ======================= INISIALISASI =======================

function initStatusSystem() {
    if (!currentUser) {
        console.log("⏳ Menunggu currentUser untuk initStatusSystem");
        return;
    }
    
    // Cegah multiple initialization
    if (statusesListener) {
        console.log("Status system already initialized, skipping");
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

function setupStatusListener() {
    if (statusesListener) {
        db.ref('statuses').off('value', statusesListener);
    }
    
    statusesListener = db.ref('statuses').on('value', (snapshot) => {
        if (!currentUser) return;
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
                        if (status.createdAt && (now - status.createdAt) < twentyFourHours) {
                            allStatuses.push({
                                id: statusId,
                                userId: userId,
                                ...status
                            });
                        } else if (status.createdAt && (now - status.createdAt) >= twentyFourHours) {
                            db.ref(`statuses/${userId}/${statusId}`).remove();
                        }
                    });
                }
            });
        }
        
        allStatuses.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        const groupedByUser = {};
        allStatuses.forEach(status => {
            if (!groupedByUser[status.userId]) groupedByUser[status.userId] = [];
            groupedByUser[status.userId].push(status);
        });
        
        renderStatusBar(groupedByUser);
        currentStatusList = allStatuses;
        checkAndNotifyNewStatus(allStatuses);
    });
}

function checkAndNotifyNewStatus(statuses) {
    const currentCount = statuses.length;
    if (currentCount > lastStatusCount && lastStatusCount > 0 && currentUser) {
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

function startStatusExpiryChecker() {
    if (statusExpiryInterval) clearInterval(statusExpiryInterval);
    statusExpiryInterval = setInterval(() => {
        if (db) db.ref('statuses').once('value').catch(() => {});
    }, 60 * 60 * 1000);
}

// ======================= RENDER STATUS BAR =======================

function renderStatusBar(groupedByUser) {
    const container = document.getElementById('statusBar');
    if (!container) return;
    
    if (!groupedByUser || Object.keys(groupedByUser).length === 0) {
        container.innerHTML = '<div class="status-empty text-small" style="text-align:center; padding:10px;">📭 Belum ada status. Buat status pertama!</div>';
        return;
    }
    
    let html = '';
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

function openCreateStatusModal() {
    const modal = document.getElementById('modal-create-status');
    if (!modal) return;
    document.getElementById('statusText').value = '';
    document.getElementById('statusImageInput').value = '';
    document.getElementById('statusImagePreviewContainer').style.display = 'none';
    modal.classList.add('open');
}

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
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Mengupload...'; }
    
    let mediaUrl = null;
    let type = 'text';
    
    try {
        if (imageFile) {
            if (imageFile.size > 5 * 1024 * 1024) {
                showToast("Ukuran gambar maksimal 5MB!", "error");
                if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
                return;
            }
            const formData = new FormData();
            formData.append('image', imageFile);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                mediaUrl = data.data.image.url;
                type = 'image';
            } else throw new Error("Gagal upload gambar");
        }
        
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
        if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
    }
}

// ======================= STATUS VIEWER =======================

async function openStatusViewer(userId) {
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
    for (const status of userStatuses) {
        if (!status.viewedBy || !status.viewedBy[currentUser.uid]) {
            await db.ref(`statuses/${userId}/${status.id}/viewedBy/${currentUser.uid}`).set(true);
        }
    }
    currentStatusList = userStatuses;
    currentStatusIndex = 0;
    showStatusViewerModal(currentStatusList[currentStatusIndex]);
}

function showStatusViewerModal(status) {
    const modal = document.getElementById('modal-status-viewer');
    if (!modal) return;
    const content = document.getElementById('statusViewerContent');
    if (!content) return;
    if (statusViewerInterval) clearInterval(statusViewerInterval);
    
    const updateContent = () => {
        const s = currentStatusList[currentStatusIndex];
        if (!s) { closeModal('modal-status-viewer'); return; }
        let mediaHtml = s.type === 'image' && s.mediaUrl
            ? `<div class="status-image-wrapper" onclick="nextStatus()"><img src="${s.mediaUrl}" class="status-full-image" alt="Status"></div>`
            : `<div class="status-text-wrapper" onclick="nextStatus()"><div class="status-full-text">${escapeHtml(s.text)}</div></div>`;
        content.innerHTML = `
            <div class="status-viewer-content">
                <div class="status-viewer-header">
                    <div class="status-viewer-user">
                        <img src="${s.userPhoto || getAvatarUrl(s.userName)}" alt="${escapeHtml(s.userName)}">
                        <div class="status-user-info"><strong>${escapeHtml(s.userName)}</strong><span>${formatTimeAgo(s.createdAt)}</span></div>
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
    statusViewerInterval = setInterval(() => {
        if (currentStatusIndex < currentStatusList.length - 1) nextStatus();
        else { clearInterval(statusViewerInterval); closeModal('modal-status-viewer'); }
    }, 5000);
}

function nextStatus() {
    if (currentStatusIndex < currentStatusList.length - 1) {
        currentStatusIndex++;
        showStatusViewerModal(currentStatusList[currentStatusIndex]);
    } else closeModal('modal-status-viewer');
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
    if (statusExpiryInterval) {
        clearInterval(statusExpiryInterval);
        statusExpiryInterval = null;
    }
    if (statusViewerInterval) {
        clearInterval(statusViewerInterval);
        statusViewerInterval = null;
    }
    lastStatusCount = 0;
    statusUiReadyListenerAdded = false;
    console.log("🧹 Status system cleaned up");
}

// ======================= INISIALISASI EVENT LISTENER ========================
setupStatusUiReadyListener();

// Jika currentUser sudah ada sebelum event listener dipasang, langsung inisialisasi
if (typeof window !== 'undefined' && window.currentUser && window.currentUser.uid && !statusesListener) {
    console.log("📸 status.js: currentUser already exists, initializing immediately");
    setTimeout(() => initStatusSystem(), 100);
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

console.log("✅ status.js V2.0 loaded - Event-based initialization");