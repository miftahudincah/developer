// ======================= ANNOUNCEMENT.JS =======================
// Fitur Pengumuman dengan Timer Otomatis

let announcementCheckInterval = null;
let announcementListenerAttached = false;

// ======================= RENDER PENGUMUMAN =======================

/**
 * Render pengumuman aktif di dashboard
 */
function renderAnnouncement() {
    console.log("renderAnnouncement dipanggil");
    
    const container = document.getElementById('announcementContainer');
    const listContainer = document.getElementById('announcementList');
    
    if (!container || !listContainer) {
        console.log("Element tidak ditemukan");
        return;
    }
    
    db.ref('announcements/active').once('value', (snapshot) => {
        const data = snapshot.val();
        listContainer.innerHTML = '';
        
        if (!data) {
            container.style.display = 'none';
            return;
        }
        
        const now = new Date();
        const currentTime = formatTimeToString(now);
        const currentDate = formatDateToString(now);
        
        const announcements = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        
        const activeAnnouncements = announcements.filter(ann => {
            if (!ann.isActive) return false;
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
        
        if (activeAnnouncements.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        activeAnnouncements.sort((a, b) => (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1));
        
        activeAnnouncements.forEach(ann => {
            const priorityClass = ann.priority === 'high' ? 'announcement-high' : 
                                 ann.priority === 'low' ? 'announcement-low' : 'announcement-normal';
            const timeLeft = getTimeLeft(ann);
            const createdInfo = ann.createdBy ? `Dibuat oleh: ${ann.createdBy}` : '';
            
            let actionButtons = '';
            if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'guru')) {
                actionButtons = `
                    <span class="announcement-edit" onclick="editAnnouncement('${ann.id}')" style="cursor:pointer; margin-left:8px;">✏️</span>
                    <span class="announcement-delete" onclick="deleteAnnouncement('${ann.id}')" style="cursor:pointer;">🗑</span>
                `;
            }
            
            listContainer.innerHTML += `
                <div class="announcement-item ${priorityClass}">
                    <div class="announcement-header">
                        <span class="announcement-title">📢 ${escapeHtmlAnn(ann.title)}</span>
                        <div class="announcement-badges">
                            ${ann.priority === 'high' ? '<span class="badge badge-high">Penting</span>' : ''}
                            ${timeLeft ? `<span class="badge badge-time">⏰ ${timeLeft}</span>` : ''}
                            ${actionButtons}
                        </div>
                    </div>
                    <div class="announcement-message">${escapeHtmlAnn(ann.message)}</div>
                    <div class="announcement-footer">
                        <small>${createdInfo}</small>
                        <small>Berakhir: ${formatExpiryDisplay(ann)}</small>
                    </div>
                </div>
            `;
        });
    });
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
    
    return diffHours > 0 ? `${diffHours} jam ${diffMinutes} menit` : `${diffMinutes} menit`;
}

function formatExpiryDisplay(announcement) {
    if (announcement.expiryDate && announcement.expiryTime) return `${announcement.expiryDate} ${announcement.expiryTime}`;
    if (announcement.expiryDate) return `${announcement.expiryDate} (akhir hari)`;
    if (announcement.expiryTime) return `Hari ini pukul ${announcement.expiryTime}`;
    return 'Tidak terbatas';
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
    
    toggleExpiryInput();
    modal.classList.add('open');
}

function editAnnouncement(announcementId) {
    const modal = document.getElementById('modal-announcement');
    if (!modal) return;
    
    db.ref(`announcements/active/${announcementId}`).once('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            document.getElementById('announcementId').value = announcementId;
            document.getElementById('annTitle').value = data.title || '';
            document.getElementById('annMessage').value = data.message || '';
            document.getElementById('annPriority').value = data.priority || 'normal';
            
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
        }
    });
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

function saveAnnouncement() {
    if (!currentUser) {
        showToast("Anda harus login!", "error");
        return;
    }
    
    if (currentUser.role !== 'admin' && currentUser.role !== 'guru') {
        showToast("Hanya Admin dan Guru yang dapat membuat pengumuman!", "error");
        return;
    }
    
    const announcementId = document.getElementById('announcementId').value;
    const title = document.getElementById('annTitle').value.trim();
    const message = document.getElementById('annMessage').value.trim();
    const priority = document.getElementById('annPriority').value;
    const expiryType = document.getElementById('annExpiryType').value;
    
    if (!title || !message) {
        showToast("Judul dan isi pengumuman wajib diisi!", "error");
        return;
    }
    
    let expiryDate = null, expiryTime = null;
    
    if (expiryType === 'date') {
        expiryDate = document.getElementById('annExpiryDate').value;
        if (!expiryDate) { showToast("Pilih tanggal berakhir!", "error"); return; }
    } else if (expiryType === 'time') {
        expiryTime = document.getElementById('annExpiryTime').value;
        if (!expiryTime) { showToast("Pilih waktu berakhir!", "error"); return; }
    } else if (expiryType === 'both') {
        expiryDate = document.getElementById('annExpiryDate').value;
        expiryTime = document.getElementById('annExpiryTime').value;
        if (!expiryDate || !expiryTime) { showToast("Pilih tanggal dan waktu berakhir!", "error"); return; }
    }
    
    const announcementData = {
        title, message, priority,
        createdBy: currentUser.nama || currentUser.email,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        isActive: true
    };
    if (expiryDate) announcementData.expiryDate = expiryDate;
    if (expiryTime) announcementData.expiryTime = expiryTime;
    
    const btn = document.getElementById('btnSaveAnnouncement');
    if (btn) { btn.disabled = true; btn.innerText = 'Menyimpan...'; }
    
    let promise = announcementId ? 
        db.ref(`announcements/active/${announcementId}`).update(announcementData) :
        db.ref('announcements/active').push(announcementData);
    
    promise.then(() => {
        showToast(announcementId ? "Pengumuman berhasil diupdate!" : "Pengumuman berhasil dibuat!");
        closeModal('modal-announcement');
        setTimeout(() => renderAnnouncement(), 500);
    }).catch(err => showToast("Gagal menyimpan: " + err.message, "error"))
    .finally(() => { if (btn) { btn.disabled = false; btn.innerText = 'Simpan Pengumuman'; } });
}

function deleteAnnouncement(announcementId) {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'guru')) {
        showToast("Anda tidak memiliki akses!", "error");
        return;
    }
    if (!confirm("Yakin ingin menghapus pengumuman ini?")) return;
    
    db.ref(`announcements/active/${announcementId}`).remove()
        .then(() => { showToast("Pengumuman berhasil dihapus"); setTimeout(() => renderAnnouncement(), 500); })
        .catch(err => showToast("Gagal menghapus: " + err.message, "error"));
}

function checkExpiredAnnouncements() {
    db.ref('announcements/active').once('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        
        const now = new Date();
        const currentTime = formatTimeToString(now);
        const currentDate = formatDateToString(now);
        let hasExpired = false;
        
        Object.keys(data).forEach(key => {
            const ann = data[key];
            let isExpired = false;
            
            if (!ann.isActive) isExpired = true;
            else if (ann.expiryDate && ann.expiryTime) {
                if (ann.expiryDate < currentDate) isExpired = true;
                else if (ann.expiryDate === currentDate && ann.expiryTime <= currentTime) isExpired = true;
            } else if (ann.expiryDate) {
                if (ann.expiryDate < currentDate) isExpired = true;
            } else if (ann.expiryTime) {
                if (currentTime >= ann.expiryTime) isExpired = true;
            }
            
            if (isExpired) {
                db.ref(`announcements/active/${key}`).remove();
                hasExpired = true;
            }
        });
        
        if (hasExpired) setTimeout(() => renderAnnouncement(), 500);
    });
}

function startAnnouncementChecker() {
    if (announcementCheckInterval) clearInterval(announcementCheckInterval);
    announcementCheckInterval = setInterval(() => checkExpiredAnnouncements(), 60000);
    setTimeout(() => checkExpiredAnnouncements(), 2000);
}

function initAnnouncementListener() {
    if (announcementListenerAttached) return;
    announcementListenerAttached = true;
    db.ref('announcements/active').on('value', () => renderAnnouncement());
}

// ======================= FUNGSI TEST =======================

function createTestAnnouncement() {
    if (!currentUser) {
        showToast("Anda harus login terlebih dahulu!", "error");
        return;
    }
    
    if (currentUser.role !== 'admin' && currentUser.role !== 'guru') {
        showToast("Hanya admin/guru yang bisa membuat test!", "error");
        return;
    }
    
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 1);
    const expiryTimeStr = `${expiryDate.getHours().toString().padStart(2,'0')}:${expiryDate.getMinutes().toString().padStart(2,'0')}`;
    
    const testData = {
        title: "TEST PENGUMUMAN",
        message: "Ini adalah pengumuman test. Jika Anda melihat ini, sistem pengumuman berfungsi!",
        priority: "high",
        createdBy: currentUser.nama || currentUser.email,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        isActive: true,
        expiryTime: expiryTimeStr
    };
    
    console.log("Membuat test announcement:", testData);
    
    db.ref('announcements/active').push(testData)
        .then((result) => {
            console.log("Test announcement berhasil dibuat, key:", result.key);
            showToast("Test pengumuman berhasil dibuat!");
            setTimeout(() => renderAnnouncement(), 500);
        })
        .catch(err => {
            console.error("Gagal membuat test:", err);
            showToast("Gagal: " + err.message, "error");
        });
}

function debugCheckAnnouncements() {
    console.log("=== DEBUG PENGUMUMAN ===");
    console.log("Current user:", currentUser ? currentUser.nama : "Tidak ada user");
    
    db.ref('announcements/active').once('value', (snapshot) => {
        const data = snapshot.val();
        console.log("Data dari Firebase (announcements/active):", data);
        
        if (!data) {
            console.log("TIDAK ADA DATA! Node 'announcements/active' kosong.");
        } else {
            console.log(`Ada ${Object.keys(data).length} pengumuman di database.`);
            Object.keys(data).forEach(key => {
                const ann = data[key];
                console.log(`- ${key}:`, { title: ann.title, isActive: ann.isActive });
            });
        }
    });
}

// ======================= INISIALISASI =======================

function initAnnouncementSystem() {
    console.log("=== initAnnouncementSystem DIPANGGIL ===");
    
    if (!currentUser) {
        console.log("CurrentUser belum ada, tunggu...");
        setTimeout(initAnnouncementSystem, 500);
        return;
    }
    
    console.log("Current user:", currentUser.nama, "Role:", currentUser.role);
    
    initAnnouncementListener();
    startAnnouncementChecker();
    renderAnnouncement();
    
    setTimeout(() => debugCheckAnnouncements(), 1000);
}

// Auto init ketika DOM siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initAnnouncementSystem, 1000));
} else {
    setTimeout(initAnnouncementSystem, 1000);
}