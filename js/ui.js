// FILE: ui.js - VERSION 2.7 (DENGAN DASHBOARD MODERN)
// Berisi fungsi-fungsi antarmuka pengguna, modal, profil, dan inisialisasi dashboard
// Dengan dukungan real-time data refresh & session persistence
// Mendukung filter kelas dari pengaturan sekolah (kelas kustom)
// Mendukung upload logo sekolah (hanya admin)
// Mendukung tab Rekap Absensi, Friends, Chat, Status, dan Dashboard Modern

// ======================== GLOBAL UI STATE ========================
let clockInterval = null;
let uiInitialized = false;
let dashboardChart = null; // Chart instance untuk dashboard bar chart

// ======================== INISIALISASI DASHBOARD ========================

function initApp() {
    console.log("🚀 initApp dipanggil - Current user:", currentUser?.nama);
    
    if (!currentUser) {
        console.log("❌ No currentUser, showing auth section");
        const authSection = document.getElementById('auth-section');
        const dashboardSection = document.getElementById('dashboard-section');
        if (authSection) authSection.style.display = 'flex';
        if (dashboardSection) dashboardSection.style.display = 'none';
        return;
    }
    
    // Tampilkan dashboard
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    if (authSection) authSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'block';
    
    // Update user info di UI
    updateUserInterface();
    
    // Apply role permissions
    applyRolePermissions();
    
    // ========== LOAD LOGO SEKOLAH ==========
    loadSchoolLogo();
    updateSchoolLogoUI();
    
    // Populate filters dengan guard
    try {
        if (typeof populateFilters === 'function') {
            populateFilters();
        } else {
            console.warn("populateFilters not available yet, will retry");
            setTimeout(() => {
                if (typeof populateFilters === 'function') populateFilters();
            }, 500);
        }
    } catch (err) {
        console.error("Error in populateFilters:", err);
    }
    
    // Start clock (hanya sekali)
    try {
        if (clockInterval) clearInterval(clockInterval);
        clockInterval = setInterval(updateClock, 1000);
        updateClock();
        console.log("✅ Clock started");
    } catch (err) {
        console.error("Clock initialization error:", err);
    }
    
    // ========== INISIALISASI SISTEM PENGUMUMAN ==========
    if (typeof initAnnouncementSystem === 'function') {
        setTimeout(function() {
            initAnnouncementSystem();
        }, 500);
    }
    
    // ========== INISIALISASI REAL-TIME WATCHERS ==========
    if (typeof initRealtimeWatchers === 'function' && !uiInitialized) {
        initRealtimeWatchers();
        uiInitialized = true;
    }
    
    // Muat konfigurasi nama sekolah
    if (typeof initSystemConfig === 'function') {
        initSystemConfig();
    } else {
        initSystemConfigManual();
    }
    
    // Muat konfigurasi tipe sekolah & jurusan
    if (typeof loadSchoolConfig === 'function') {
        loadSchoolConfig();
    }
    
    // Inisialisasi event listener untuk delay input
    if (typeof initDelayEventListeners === 'function') {
        initDelayEventListeners();
    } else {
        initManualDelayListeners();
    }
    
    // Inisialisasi event listener untuk global delay
    if (typeof initGlobalDelayListeners === 'function') {
        initGlobalDelayListeners();
    }
    
    // Render semua tabel
    setTimeout(() => {
        if (typeof renderTable === 'function') renderTable();
        if (typeof renderStudentsTable === 'function') renderStudentsTable();
        if (typeof renderCodesTable === 'function') renderCodesTable();
        if (typeof renderUsersTable === 'function') renderUsersTable();
    }, 100);
    
    // Switch ke tab default (Dashboard)
    switchTab('dashboard');
    
    // Tampilkan floating button
    setTimeout(function() {
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'guru')) {
            const floatingBtn = document.getElementById('floatingAnnouncementBtn');
            if (floatingBtn) floatingBtn.style.display = 'flex';
        }
        const floatingFriendsBtn = document.getElementById('floatingFriendsBtn');
        if (floatingFriendsBtn) floatingFriendsBtn.style.display = 'flex';
        const floatingChatBtn = document.getElementById('floatingChatBtn');
        if (floatingChatBtn) floatingChatBtn.style.display = 'flex';
    }, 1000);
    
    // Inisialisasi rekap system
    setTimeout(function() {
        if (typeof initRekap === 'function') {
            initRekap();
            console.log("📊 Rekap system initialized from initApp");
        }
    }, 800);
    
    // Inisialisasi Friends System
    setTimeout(function() {
        if (typeof initFriendsSystem === 'function') {
            initFriendsSystem();
            console.log("👥 Friends system initialized from initApp");
        }
    }, 1200);
    
    // Inisialisasi Chat System
    setTimeout(function() {
        if (typeof initChatSystem === 'function') {
            initChatSystem();
            console.log("💬 Chat system initialized from initApp");
        }
    }, 1500);
    
    // Inisialisasi Status System
    setTimeout(function() {
        if (typeof initStatusSystem === 'function') {
            initStatusSystem();
            console.log("📸 Status system initialized from initApp");
        }
    }, 1800);
    
    console.log("✅ initApp completed successfully");
}

/**
 * Update semua elemen UI yang menampilkan data user
 */
function updateUserInterface() {
    if (!currentUser) return;
    
    const userProfileDisplay = document.getElementById('userProfileDisplay');
    if (userProfileDisplay) userProfileDisplay.textContent = currentUser.nama;
    
    const profileEmail = document.getElementById('profileEmail');
    if (profileEmail) profileEmail.textContent = currentUser.email;
    
    const userRoleDisplay = document.getElementById('userRoleDisplay');
    if (userRoleDisplay) {
        userRoleDisplay.textContent = currentUser.role.toUpperCase();
        userRoleDisplay.className = `role-badge role-${currentUser.role}`;
    }
    
    const photo = currentUser.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.nama || 'User')}&background=random`;
    const headerAvatar = document.getElementById('headerAvatar');
    if (headerAvatar) headerAvatar.src = photo;
    
    const profileImg = document.getElementById('profileImg');
    if (profileImg) profileImg.src = photo;
}

// Fallback inisialisasi manual untuk delay listeners
function initManualDelayListeners() {
    console.log("🔧 initManualDelayListeners dipanggil");
    const delayMinutesInput = document.getElementById('delayMinutesValue');
    const delayHoursSelect = document.getElementById('delayHoursValue');
    const delayUnitSelect = document.getElementById('delayUnit');
    
    if (delayMinutesInput) {
        delayMinutesInput.removeEventListener('input', updateDelayFromMinutes);
        delayMinutesInput.addEventListener('input', updateDelayFromMinutes);
    }
    if (delayHoursSelect) {
        delayHoursSelect.removeEventListener('change', updateDelayFromHours);
        delayHoursSelect.addEventListener('change', updateDelayFromHours);
    }
    if (delayUnitSelect) {
        delayUnitSelect.removeEventListener('change', toggleDelayInput);
        delayUnitSelect.addEventListener('change', toggleDelayInput);
    }
    setTimeout(() => {
        if (typeof toggleDelayInput === 'function') toggleDelayInput();
    }, 100);
}

// Fallback inisialisasi system config manual
function initSystemConfigManual() {
    console.log("🔧 initSystemConfigManual dipanggil");
    if (typeof db !== 'undefined' && db) {
        db.ref('system_config/schoolName').on('value', snapshot => {
            const name = snapshot.val();
            const display = name || 'Sistem Absensi';
            const headerTitle = document.getElementById('schoolNameDisplay');
            if (headerTitle) headerTitle.textContent = display;
            const inputField = document.getElementById('inputSchoolName');
            if (inputField) inputField.value = name || '';
        });
    } else {
        console.warn("Firebase db not available for system config");
        const headerTitle = document.getElementById('schoolNameDisplay');
        if (headerTitle) headerTitle.textContent = 'Sistem Absensi';
    }
}

// ======================== FUNGSI FORMAT DELAY ========================
function formatDelayText(delayMinutes) {
    if (!delayMinutes && delayMinutes !== 0) return '-';
    const hours = Math.floor(delayMinutes / 60);
    const minutes = delayMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours} jam ${minutes} menit`;
    if (hours > 0) return `${hours} jam`;
    return `${minutes} menit`;
}

// ======================== LOGO SEKOLAH ========================
function loadSchoolLogo() {
    if (typeof db === 'undefined' || !db) {
        console.warn("Firebase db not available for loading logo");
        return;
    }
    const headerLogo = document.getElementById('headerSchoolLogo');
    const previewLogo = document.getElementById('schoolLogoPreview');
    const btnRemove = document.getElementById('btnRemoveLogo');
    
    db.ref('system_config/schoolLogo').on('value', (snapshot) => {
        const logoUrl = snapshot.val();
        if (logoUrl && logoUrl !== '') {
            if (headerLogo) {
                headerLogo.src = logoUrl;
                headerLogo.style.display = 'block';
                headerLogo.classList.remove('skeleton');
            }
            if (previewLogo) {
                previewLogo.src = logoUrl;
                previewLogo.classList.remove('skeleton');
            }
            if (btnRemove && currentUser && currentUser.role === 'admin') {
                btnRemove.style.display = 'inline-block';
            }
            console.log("🏫 Logo sekolah loaded:", logoUrl);
        } else {
            const defaultIcon = 'https://ui-avatars.com/api/?name=S&background=00bcd4&color=fff&size=80';
            if (headerLogo) {
                headerLogo.src = defaultIcon;
                headerLogo.style.display = 'block';
            }
            if (previewLogo) previewLogo.src = defaultIcon;
            if (btnRemove) btnRemove.style.display = 'none';
        }
    });
}

async function uploadSchoolLogo(input) {
    if (!currentUser) {
        showToast('Anda harus login!', 'error');
        return;
    }
    if (currentUser.role !== 'admin') {
        showToast('⛔ Hanya Admin yang dapat mengubah logo sekolah!', 'error');
        return;
    }
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (!file.type.match('image.*')) {
        showToast('❌ Hanya file gambar yang diperbolehkan!', 'error');
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        showToast('❌ Ukuran gambar maksimal 2MB!', 'error');
        return;
    }
    const formData = new FormData();
    formData.append('image', file);
    const previewImg = document.getElementById('schoolLogoPreview');
    const headerImg = document.getElementById('headerSchoolLogo');
    if (previewImg) {
        previewImg.classList.add('skeleton');
        previewImg.style.opacity = '0.5';
    }
    if (headerImg) headerImg.classList.add('skeleton');
    showToast('📤 Mengunggah logo sekolah ke ImgBB...', 'neutral');
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            const urlProxy = `https://wsrv.nl/?url=${encodeURIComponent(data.data.image.url)}&w=200&h=200&fit=cover`;
            await db.ref('system_config/schoolLogo').set(urlProxy);
            if (previewImg) {
                previewImg.src = urlProxy;
                previewImg.classList.remove('skeleton');
                previewImg.style.opacity = '1';
            }
            if (headerImg) {
                headerImg.src = urlProxy;
                headerImg.classList.remove('skeleton');
            }
            const btnRemove = document.getElementById('btnRemoveLogo');
            if (btnRemove) btnRemove.style.display = 'inline-block';
            showToast('✅ Logo sekolah berhasil diperbarui!', 'success');
        } else {
            console.error('ImgBB upload failed:', data);
            showToast('❌ Gagal upload ke ImgBB', 'error');
            if (previewImg) {
                previewImg.classList.remove('skeleton');
                previewImg.style.opacity = '1';
            }
            if (headerImg) headerImg.classList.remove('skeleton');
        }
    } catch (e) {
        console.error('Upload error:', e);
        showToast('❌ Koneksi Error: ' + e.message, 'error');
        if (previewImg) {
            previewImg.classList.remove('skeleton');
            previewImg.style.opacity = '1';
        }
        if (headerImg) headerImg.classList.remove('skeleton');
    } finally {
        input.value = '';
    }
}

function removeSchoolLogo() {
    if (!currentUser) {
        showToast('Anda harus login!', 'error');
        return;
    }
    if (currentUser.role !== 'admin') {
        showToast('⛔ Hanya Admin yang dapat menghapus logo sekolah!', 'error');
        return;
    }
    if (!confirm('⚠️ Yakin ingin menghapus logo sekolah?\n\nLogo akan kembali ke default.')) return;
    const btn = document.getElementById('btnRemoveLogo');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Menghapus...';
    }
    db.ref('system_config/schoolLogo').remove()
        .then(() => {
            showToast('✅ Logo sekolah berhasil dihapus', 'success');
            const defaultIcon = 'https://ui-avatars.com/api/?name=S&background=00bcd4&color=fff&size=80';
            const previewImg = document.getElementById('schoolLogoPreview');
            const headerImg = document.getElementById('headerSchoolLogo');
            if (previewImg) previewImg.src = defaultIcon;
            if (headerImg) headerImg.src = defaultIcon;
            if (btn) btn.style.display = 'none';
        })
        .catch(err => {
            console.error('Remove logo error:', err);
            showToast('❌ Gagal menghapus logo: ' + err.message, 'error');
        })
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '🗑️ Hapus Logo';
            }
        });
}

function updateSchoolLogoUI() {
    const logoSettingGroup = document.getElementById('logoSettingGroup');
    if (logoSettingGroup && currentUser) {
        const uploadHint = logoSettingGroup.querySelector('.logo-upload-hint');
        const removeBtn = document.getElementById('btnRemoveLogo');
        const previewWrapper = logoSettingGroup.querySelector('.logo-preview-wrapper');
        if (currentUser.role !== 'admin') {
            if (uploadHint) uploadHint.style.display = 'none';
            if (removeBtn) removeBtn.style.display = 'none';
            if (previewWrapper) {
                previewWrapper.style.cursor = 'default';
                previewWrapper.removeAttribute('onclick');
            }
        } else {
            if (uploadHint) uploadHint.style.display = 'block';
            if (previewWrapper) {
                previewWrapper.style.cursor = 'pointer';
                previewWrapper.setAttribute('onclick', "document.getElementById('logoFileInput').click()");
            }
            db.ref('system_config/schoolLogo').once('value', (snapshot) => {
                if (removeBtn) {
                    if (snapshot.val()) removeBtn.style.display = 'inline-block';
                    else removeBtn.style.display = 'none';
                }
            });
        }
    }
}

// ======================== FRIENDS & CHAT UI ========================
function toggleFriendsModal() {
    const modal = document.getElementById('modal-friends');
    if (modal) {
        modal.classList.add('open');
        if (typeof renderFriendsPanel === 'function') renderFriendsPanel();
        else console.warn("renderFriendsPanel not found");
    }
}

function openChatModal() {
    const modal = document.getElementById('modal-chat');
    if (modal) {
        modal.classList.add('open');
        if (typeof renderChatInterface === 'function') renderChatInterface();
        else console.warn("renderChatInterface not found");
    }
}

// ======================== ROLE PERMISSIONS ========================
function applyRolePermissions() {
    if (!currentUser) return;
    const role = currentUser.role;
    console.log("🎭 Apply role permissions untuk role:", role);
    
    document.querySelectorAll('.role-admin').forEach(el => {
        if (role === 'admin') { el.style.display = ''; el.style.visibility = 'visible'; el.style.opacity = '1'; }
        else el.style.display = 'none';
    });
    document.querySelectorAll('.role-guru').forEach(el => {
        if (role === 'admin' || role === 'guru') { el.style.display = ''; el.style.visibility = 'visible'; el.style.opacity = '1'; }
        else el.style.display = 'none';
    });
    
    const btnAnnouncement = document.querySelector('.btn-announcement');
    if (btnAnnouncement) btnAnnouncement.style.display = (role === 'admin' || role === 'guru') ? 'inline-flex' : 'none';
    const floatingBtn = document.getElementById('floatingAnnouncementBtn');
    if (floatingBtn) floatingBtn.style.display = (role === 'admin' || role === 'guru') ? 'flex' : 'none';
    const floatingFriendsBtn = document.getElementById('floatingFriendsBtn');
    if (floatingFriendsBtn) floatingFriendsBtn.style.display = 'flex';
    const floatingChatBtn = document.getElementById('floatingChatBtn');
    if (floatingChatBtn) floatingChatBtn.style.display = 'flex';
    
    const navTabs = document.getElementById('nav-tabs-container');
    if (navTabs && role === 'siswa') {
        const configBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.includes('Pengaturan') || b.textContent.includes('Config'));
        if (configBtn) configBtn.style.display = 'none';
        const usersBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.includes('Manajemen Pengguna'));
        if (usersBtn) usersBtn.style.display = 'none';
    } else if (navTabs) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.style.display = '');
    }
    updateSchoolLogoUI();
}

function updateClock() {
    const clockEl = document.getElementById('clock');
    if (clockEl) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID');
        const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        clockEl.innerHTML = `${timeStr}<br><small>${dateStr}</small>`;
    }
}

function switchTab(tabId) {
    console.log("📑 Switching to tab:", tabId);
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add('active');
    else console.warn(`Tab content #tab-${tabId} not found`);
    const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick')?.includes(tabId));
    if (activeBtn) activeBtn.classList.add('active');
    
    setTimeout(() => {
        if (tabId === 'dashboard') renderDashboard();
        else if (tabId === 'attendance' && typeof renderTable === 'function') renderTable();
        else if (tabId === 'students' && typeof renderStudentsTable === 'function') renderStudentsTable();
        else if (tabId === 'users' && typeof renderUsersTable === 'function') renderUsersTable();
        else if (tabId === 'rekap' && typeof loadRekap === 'function') loadRekap();
        else if (tabId === 'friends' && typeof loadFriendRequests === 'function') { loadFriendRequests(); loadFriendsList(); }
        else if (tabId === 'chat' && typeof loadChatList === 'function') loadChatList();
    }, 50);
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) { console.warn("Toast element not found, message:", msg); return; }
    toast.textContent = msg;
    toast.style.borderLeftColor = type === 'error' ? 'var(--danger)' : type === 'warning' ? 'var(--warning)' : 'var(--primary)';
    toast.style.backgroundColor = type === 'error' ? 'rgba(244, 67, 54, 0.1)' : type === 'warning' ? 'rgba(255, 152, 0, 0.1)' : 'rgba(76, 175, 80, 0.1)';
    toast.className = 'toast show';
    setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3000);
}

// ======================== DASHBOARD MODERN FUNCTIONS ========================
function renderDashboard() {
    console.log("📊 Rendering modern dashboard...");
    if (!dbData) return;
    
    // 1. Kehadiran bulan ini (total kehadiran = status 'Hadir' atau 'Pulang')
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthAttendance = dbData.attendance ? dbData.attendance.filter(a => {
        const d = new Date(a.date);
        return d >= startMonth && d <= endMonth;
    }) : [];
    const totalHadirBulan = monthAttendance.filter(a => a.status === 'Hadir' || a.status === 'Pulang').length;
    document.getElementById('statKehadiranBulan').innerText = totalHadirBulan;
    // Trend sederhana (bandingkan dengan bulan lalu)
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthAttendance = dbData.attendance ? dbData.attendance.filter(a => {
        const d = new Date(a.date);
        return d >= startLastMonth && d <= endLastMonth;
    }) : [];
    const lastHadir = lastMonthAttendance.filter(a => a.status === 'Hadir' || a.status === 'Pulang').length;
    let trend = totalHadirBulan - lastHadir;
    let trendText = trend >= 0 ? `+${trend}` : `${trend}`;
    let trendClass = trend >= 0 ? 'positive' : 'negative';
    document.getElementById('statTrendKehadiran').innerHTML = `${trendText}%`;
    document.getElementById('statTrendKehadiran').className = `stat-change ${trendClass}`;
    
    // 2. Total transaksi bulan ini
    document.getElementById('statTotalTransaksi').innerText = monthAttendance.length;
    
    // 3. Total siswa
    const totalSiswa = dbData.users ? dbData.users.length : 0;
    document.getElementById('statTotalSiswa').innerText = totalSiswa;
    
    // 4. Total pengguna terdaftar
    const totalUsers = dbData.users_auth ? dbData.users_auth.length : 0;
    document.getElementById('statTotalUsers').innerText = totalUsers;
    
    // 5. Update grafik
    updateDashboardChart();
    
    // 6. Update aktivitas terbaru
    renderRecentActivities();
    
    // 7. Update daftar pengumuman
    renderDashboardTasks();
}

function updateDashboardChart() {
    const yearSelect = document.getElementById('chartYearSelect');
    const year = yearSelect ? parseInt(yearSelect.value) : 2025;
    const monthlyHadir = new Array(12).fill(0);
    const monthlyIzin = new Array(12).fill(0);
    const monthlyAlpha = new Array(12).fill(0);
    
    if (dbData.attendance) {
        dbData.attendance.forEach(rec => {
            const d = new Date(rec.date);
            if (d.getFullYear() === year) {
                const month = d.getMonth();
                let status = rec.status;
                if (status === 'Hadir' || status === 'Pulang') monthlyHadir[month]++;
                else if (status === 'Izin') monthlyIzin[month]++;
                else if (status === 'Alpha') monthlyAlpha[month]++;
                else if (status === 'Sakit') monthlyIzin[month]++; // sederhanakan
            }
        });
    }
    
    const ctx = document.getElementById('dashboardBarChart')?.getContext('2d');
    if (!ctx) return;
    if (dashboardChart) dashboardChart.destroy();
    dashboardChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [
                { label: 'Hadir', data: monthlyHadir, backgroundColor: '#00bcd4', borderRadius: 6 },
                { label: 'Izin', data: monthlyIzin, backgroundColor: '#ff9800', borderRadius: 6 },
                { label: 'Alpha', data: monthlyAlpha, backgroundColor: '#f44336', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
            scales: { y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#ccc' } }, x: { ticks: { color: '#ccc' } } }
        }
    });
}

function renderRecentActivities() {
    const container = document.getElementById('recentActivitiesList');
    if (!container) return;
    const recent = dbData.attendance ? dbData.attendance.slice(0, 5) : [];
    if (recent.length === 0) {
        container.innerHTML = '<div class="activity-item"><div class="activity-detail">Belum ada aktivitas</div></div>';
        return;
    }
    let html = '';
    recent.forEach(act => {
        const avatar = act.status === 'Hadir' ? '✅' : (act.status === 'Pulang' ? '🏠' : '📝');
        const name = act.nama || 'Siswa';
        const desc = act.status === 'Hadir' ? `Masuk ${act.timeIn || ''}` : (act.status === 'Pulang' ? `Pulang ${act.timeOut || ''}` : act.status);
        const time = act.date;
        html += `
            <div class="activity-item">
                <div class="activity-avatar">${avatar}</div>
                <div class="activity-detail">
                    <div class="activity-name">${escapeHtmlString(name)}</div>
                    <div class="activity-desc">${desc}</div>
                    <div class="activity-time">${time}</div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderDashboardTasks() {
    const container = document.getElementById('dashboardTasksList');
    if (!container) return;
    db.ref('announcements/active').once('value', (snapshot) => {
        const data = snapshot.val();
        let tasksHtml = '';
        if (data) {
            const announcements = Object.values(data).slice(0, 3);
            announcements.forEach(ann => {
                tasksHtml += `
                    <div class="task-item">
                        <div class="task-check"></div>
                        <div class="task-info">
                            <div class="task-title">${escapeHtmlString(ann.title)}</div>
                            <div class="task-meta">${ann.priority === 'high' ? '⚠️ Penting' : '📢 Pengumuman'}</div>
                        </div>
                    </div>
                `;
            });
        }
        if (!tasksHtml) tasksHtml = '<div class="task-item">Tidak ada pengumuman aktif</div>';
        container.innerHTML = tasksHtml;
    }).catch(() => {
        container.innerHTML = '<div class="task-item">Gagal memuat pengumuman</div>';
    });
}

// ======================== PROFIL & MODALS ========================
function openProfileModal() {
    const modal = document.getElementById('modal-profile');
    if (!modal) return;
    modal.classList.add('open');
    if (!currentUser) return;
    document.getElementById('profileImg').src = currentUser.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.nama || 'User')}&background=random`;
    document.getElementById('profileNameInput').value = currentUser.nama || '';
    document.getElementById('profileEmail').textContent = currentUser.email || '';
    document.getElementById('profileKelas').value = currentUser.kelas || '';
    document.getElementById('profileJurusan').value = currentUser.jurusan || '';
    document.getElementById('profileSubject').value = currentUser.subject || '';

    const nameInput = document.getElementById('profileNameInput');
    const kelasInput = document.getElementById('profileKelas');
    const jurusanInput = document.getElementById('profileJurusan');
    const subjectGroup = document.getElementById('group-subject');
    const saveBtn = document.querySelector('#modal-profile .btn-save');
    let delayGroup = document.getElementById('group-profile-delay');
    if (!delayGroup) {
        const jurusanDiv = document.getElementById('profileJurusan')?.parentElement;
        if (jurusanDiv && currentUser.role === 'siswa') {
            const newDelayGroup = document.createElement('div');
            newDelayGroup.className = 'form-group';
            newDelayGroup.id = 'group-profile-delay';
            newDelayGroup.innerHTML = `<label>⏰ Delay Pulang</label><input type="text" id="profileDelay" placeholder="60 menit" readonly style="background:#2c2c2c; color:#4a90e2; font-weight:bold;"><small class="text-small">*Waktu minimal untuk absen pulang</small>`;
            jurusanDiv.insertAdjacentElement('afterend', newDelayGroup);
            delayGroup = newDelayGroup;
        }
    }
    if (currentUser.role === 'siswa') {
        nameInput.readOnly = true; nameInput.style.cssText = 'border:none;background:transparent;color:#888';
        kelasInput.readOnly = true; kelasInput.style.cssText = 'border:none;background:transparent';
        jurusanInput.readOnly = true; jurusanInput.style.cssText = 'border:none;background:transparent';
        if (subjectGroup) subjectGroup.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'none';
        if (delayGroup) delayGroup.style.display = 'block';
        updateProfileDelayDisplay();
    } else {
        nameInput.readOnly = false; nameInput.style.cssText = 'border:1px solid var(--border);background:#2c2c2c;color:#fff';
        kelasInput.readOnly = false; kelasInput.style.cssText = 'border:1px solid var(--border);background:#2c2c2c';
        jurusanInput.readOnly = false; jurusanInput.style.cssText = 'border:1px solid var(--border);background:#2c2c2c';
        if (subjectGroup) subjectGroup.style.display = 'block';
        if (saveBtn) saveBtn.style.display = 'block';
        if (delayGroup) delayGroup.style.display = 'none';
    }
}

function openForgotPasswordModal() {
    const modal = document.getElementById('modal-forgot');
    if (modal) {
        modal.classList.add('open');
        const emailInput = document.getElementById('forgotEmail');
        if (emailInput) emailInput.value = '';
        emailInput?.focus();
    }
}

function openChangePasswordModal() {
    const modal = document.getElementById('modal-change-pass');
    if (modal) {
        modal.classList.add('open');
        const oldPass = document.getElementById('cpOld');
        const newPass = document.getElementById('cpNew');
        const confirmPass = document.getElementById('cpConfirm');
        if (oldPass) oldPass.value = '';
        if (newPass) newPass.value = '';
        if (confirmPass) confirmPass.value = '';
        oldPass?.focus();
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
}

function handleUpdateProfileInfo() {
    if (!currentUser) { showToast('Anda harus login terlebih dahulu!', 'error'); return; }
    if (currentUser.role === 'siswa') { showToast('Siswa tidak dapat mengubah data profil. Hubungi Admin/Guru.', 'error'); return; }
    const newNama = document.getElementById('profileNameInput').value.trim();
    const newKelas = document.getElementById('profileKelas').value.toUpperCase();
    const newJurusan = document.getElementById('profileJurusan').value;
    const newSubject = document.getElementById('profileSubject').value;
    if (!newNama) { showToast('Nama wajib diisi!', 'error'); return; }
    const btn = document.querySelector('#modal-profile .btn-save');
    if (!btn) return;
    const originalText = btn.innerText;
    btn.innerText = '💾 Menyimpan...';
    btn.disabled = true;
    const updateData = { nama: newNama, kelas: newKelas, jurusan: newJurusan, subject: newSubject };
    db.ref(`users_auth/${currentUser.uid}`).update(updateData)
        .then(() => {
            currentUser.nama = newNama;
            currentUser.kelas = newKelas;
            currentUser.jurusan = newJurusan;
            currentUser.subject = newSubject;
            if (typeof saveUserToLocalStorage === 'function') saveUserToLocalStorage(currentUser);
            showToast('✅ Profil berhasil diperbarui');
            document.getElementById('userProfileDisplay').textContent = newNama;
            if (currentUser.role === 'siswa' && currentUser.fpId) {
                db.ref(`users/${currentUser.fpId}`).update({ nama: newNama, kelas: newKelas, jurusan: newJurusan });
            }
            closeModal('modal-profile');
            if (typeof populateFilters === 'function') populateFilters();
            if (typeof renderStudentsTable === 'function') renderStudentsTable();
            if (typeof renderUsersTable === 'function') renderUsersTable();
        })
        .catch(err => { console.error('Update profile error:', err); showToast('❌ Gagal update: ' + err.message, 'error'); })
        .finally(() => { btn.innerText = originalText; btn.disabled = false; });
}

function handleChangePassword(e) {
    e.preventDefault();
    const newPass = document.getElementById('cpNew').value;
    const confirmPass = document.getElementById('cpConfirm').value;
    if (newPass !== confirmPass) { showToast('Password baru tidak cocok!', 'error'); return; }
    if (newPass.length < 6) { showToast('Password minimal 6 karakter!', 'error'); return; }
    const btn = document.querySelector('#modal-change-pass button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    auth.currentUser.updatePassword(newPass)
        .then(() => { showToast('✅ Password berhasil diubah'); closeModal('modal-change-pass'); document.getElementById('cpNew').value = ''; document.getElementById('cpConfirm').value = ''; })
        .catch(err => {
            console.error('Change password error:', err);
            if (err.code === 'auth/requires-recent-login') showToast('⚠️ Silakan logout dan login kembali untuk ubah password.', 'error');
            else if (err.code === 'auth/weak-password') showToast('Password terlalu lemah. Gunakan minimal 6 karakter.', 'error');
            else showToast('❌ Gagal: ' + err.message, 'error');
        })
        .finally(() => { if (btn) { btn.disabled = false; btn.textContent = 'Simpan'; } });
}

async function uploadProfilePhoto(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (!file.type.match('image.*')) { showToast('Hanya file gambar yang diperbolehkan!', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { showToast('Ukuran gambar maksimal 2MB!', 'error'); return; }
    const formData = new FormData();
    formData.append('image', file);
    const imgEl = document.getElementById('profileImg');
    const originalSrc = imgEl.src;
    imgEl.style.opacity = '0.5';
    showToast('📤 Mengunggah ke ImgBB...', 'neutral');
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            const urlProxy = `https://wsrv.nl/?url=${encodeURIComponent(data.data.image.url)}`;
            await db.ref(`users_auth/${currentUser.uid}`).update({ photoUrl: urlProxy });
            currentUser.photoUrl = urlProxy;
            if (typeof saveUserToLocalStorage === 'function') saveUserToLocalStorage(currentUser);
            document.getElementById('headerAvatar').src = urlProxy;
            imgEl.src = urlProxy;
            showToast('✅ Foto profil berhasil diperbarui!');
        } else { console.error('ImgBB upload failed:', data); showToast('❌ Gagal upload ke ImgBB', 'error'); imgEl.src = originalSrc; }
    } catch (e) { console.error('Upload error:', e); showToast('❌ Koneksi Error: ' + e.message, 'error'); imgEl.src = originalSrc; }
    finally { imgEl.style.opacity = '1'; input.value = ''; }
}

function processForgot() {
    const email = document.getElementById('forgotEmail').value.trim();
    if (!email) { showToast('Masukkan email terlebih dahulu!', 'error'); return; }
    const btn = document.querySelector('#modal-forgot .btn-save');
    if (btn) { btn.innerText = '📧 Mengirim...'; btn.disabled = true; }
    auth.sendPasswordResetEmail(email)
        .then(() => { showToast(`✅ Link reset password telah dikirim ke ${email}`); closeModal('modal-forgot'); })
        .catch(error => {
            console.error('Forgot password error:', error);
            if (error.code === 'auth/user-not-found') showToast('❌ Email tersebut belum terdaftar!', 'error');
            else if (error.code === 'auth/invalid-email') showToast('❌ Format email tidak valid!', 'error');
            else showToast('❌ Gagal mengirim: ' + error.message, 'error');
        })
        .finally(() => { if (btn) { btn.innerText = 'Kirim Link'; btn.disabled = false; } });
}

// ======================== REGISTER & GENERATE UI ========================
function toggleRegisterInput() {
    const typeRadio = document.querySelector('input[name="regRoleType"]:checked');
    if (!typeRadio) return;
    const type = typeRadio.value;
    const idGroup = document.getElementById('group-reg-id');
    const namaGroup = document.getElementById('group-reg-nama');
    const subjectGroup = document.getElementById('group-reg-subject');
    const detailsGroup = document.getElementById('group-siswa-details');
    const codeInput = document.getElementById('regCode');
    if (type === 'siswa') {
        if (idGroup) idGroup.style.display = 'block';
        if (detailsGroup) detailsGroup.style.display = 'block';
        if (namaGroup) namaGroup.style.display = 'none';
        if (subjectGroup) subjectGroup.style.display = 'none';
        if (codeInput) codeInput.placeholder = '🔑 Kode Unik (Siswa)';
        if (document.getElementById('regKelas')) document.getElementById('regKelas').required = true;
        if (document.getElementById('regJurusan')) document.getElementById('regJurusan').required = true;
    } else {
        if (idGroup) idGroup.style.display = 'none';
        if (detailsGroup) detailsGroup.style.display = 'none';
        if (namaGroup) namaGroup.style.display = 'block';
        if (subjectGroup) subjectGroup.style.display = 'block';
        if (document.getElementById('regKelas')) document.getElementById('regKelas').required = false;
        if (document.getElementById('regJurusan')) document.getElementById('regJurusan').required = false;
        if (codeInput) codeInput.placeholder = '🔑 Kode Unik (Guru)';
    }
}

function toggleGenerateInput() {
    const typeRadio = document.querySelector('input[name="genTarget"]:checked');
    if (!typeRadio) return;
    const type = typeRadio.value;
    const selectGroup = document.getElementById('group-select-siswa');
    const desc = document.getElementById('gen-desc');
    if (type === 'siswa') {
        if (selectGroup) selectGroup.style.display = 'block';
        if (desc) desc.innerText = '🔒 Kode akan dikunci ke ID Siswa terpilih.';
    } else {
        if (selectGroup) selectGroup.style.display = 'none';
        if (desc) desc.innerText = '🔓 Kode bebas digunakan oleh Guru mana saja.';
    }
}

// ======================== PENGATURAN NAMA SEKOLAH ========================
function saveSchoolName() {
    if (!currentUser) { showToast('Anda harus login!', 'error'); return; }
    const newSchoolName = document.getElementById('inputSchoolName').value.trim();
    if (!newSchoolName) { showToast('Nama sekolah tidak boleh kosong!', 'error'); return; }
    if (currentUser.role !== 'admin') { showToast('Hanya Admin yang bisa mengubah nama sekolah.', 'error'); return; }
    const btn = event?.target;
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    db.ref('system_config/schoolName').set(newSchoolName)
        .then(() => { showToast('✅ Nama sekolah berhasil diperbarui'); const headerTitle = document.getElementById('schoolNameDisplay'); if (headerTitle) headerTitle.textContent = newSchoolName; })
        .catch(err => { console.error('Save school name error:', err); showToast('❌ Gagal update: ' + err.message, 'error'); })
        .finally(() => { if (btn) { btn.disabled = false; btn.textContent = 'Simpan'; } });
}

function initSystemConfig() {
    if (typeof db === 'undefined' || !db) { console.warn("Firebase db not available for system config"); initSystemConfigManual(); return; }
    db.ref('system_config/schoolName').on('value', snapshot => {
        const name = snapshot.val();
        const display = name || 'Sistem Absensi';
        const headerTitle = document.getElementById('schoolNameDisplay');
        if (headerTitle) headerTitle.textContent = display;
        const inputField = document.getElementById('inputSchoolName');
        if (inputField && inputField.value !== name) inputField.value = name || '';
    });
}

// ======================== RENDER TABEL USERS ========================
function renderUsersTable() {
    const tbody = document.getElementById('tbody-users');
    if (!tbody) return;
    const searchInput = document.getElementById('searchUser');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    tbody.innerHTML = '';
    if (!dbData.users_auth || dbData.users_auth.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#888;">📭 Tidak ada pengguna ditemukan.</td></tr>';
        return;
    }
    let data = dbData.users_auth.filter(u => u.nama && u.nama.toLowerCase().includes(search));
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#888;">🔍 Tidak ada pengguna yang cocok dengan pencarian.</td></tr>';
        return;
    }
    data.forEach(u => {
        const isMe = (currentUser && currentUser.uid === u.uid);
        const avatar = u.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nama || 'User')}&background=random&color=fff&size=32`;
        let roleHtml = '', actionsHtml = '-';
        if (currentUser && currentUser.role === 'admin' && !isMe) {
            roleHtml = `<select class="form-control" onchange="updateUserRole('${u.uid}', this.value)" style="background:#2c2c2c; color:white; border:1px solid #444; padding:5px; border-radius:4px; font-size:0.8rem;">
                <option value="siswa" ${u.role === 'siswa' ? 'selected' : ''}>📚 Siswa</option>
                <option value="guru" ${u.role === 'guru' ? 'selected' : ''}>👨‍🏫 Guru</option>
                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>👑 Admin</option>
            </select>`;
            actionsHtml = `<button class="btn-icon delete" onclick="deleteUser('${u.uid}', '${escapeHtmlString(u.nama)}')" title="Hapus User" style="background:transparent; border:none; cursor:pointer; color:#f44336; font-size:18px;">🗑️</button>`;
        } else {
            let roleClass = 'role-siswa', roleIcon = '📚';
            if (u.role === 'admin') { roleClass = 'role-admin'; roleIcon = '👑'; }
            else if (u.role === 'guru') { roleClass = 'role-guru'; roleIcon = '👨‍🏫'; }
            roleHtml = `<span class="role-badge ${roleClass}">${roleIcon} ${u.role.toUpperCase()}</span>`;
            if (isMe) roleHtml += ` <small style="color:#4a90e2;">(Anda)</small>`;
        }
        let detailText = '';
        if (u.role === 'siswa') detailText = `${u.kelas || '-'} / ${u.jurusan || '-'}`;
        else if (u.role === 'guru') detailText = u.subject || '-';
        else detailText = '-';
        tbody.innerHTML += `<tr><td style="text-align:center;"><img src="${avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;"></td>
            <td><strong>${escapeHtmlString(u.nama)}</strong></td>
            <td style="color:#aaa; font-size:0.9rem;">${u.email || '-'}</td>
            <td>${roleHtml}</td>
            <td style="color:#888; font-size:0.85rem;">${escapeHtmlString(detailText)}</td>
            <td style="text-align:center;">${actionsHtml}</td></tr>`;
    });
    console.log(`📊 renderUsersTable: ${data.length} users displayed`);
}

function escapeHtmlString(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

// ======================== FUNGSI DELAY UNTUK PROFIL ========================
function updateProfileDelayDisplay() {
    if (!currentUser || currentUser.role !== 'siswa' || !currentUser.fpId) return;
    const studentData = dbData.users?.find(u => u.id == currentUser.fpId);
    const profileDelay = document.getElementById('profileDelay');
    if (profileDelay) {
        if (studentData && studentData.delayOut) {
            profileDelay.value = formatDelayText(studentData.delayOut);
            profileDelay.style.color = '#4a90e2';
        } else {
            profileDelay.value = formatDelayText(60);
            profileDelay.style.color = '#888';
        }
    }
}

// ======================== CLEANUP ========================
function cleanupUI() {
    if (clockInterval) clearInterval(clockInterval);
    uiInitialized = false;
    if (dashboardChart) { dashboardChart.destroy(); dashboardChart = null; }
    console.log("🧹 UI cleanup completed");
}

// ======================== EXPORT KE GLOBAL ========================
window.initApp = initApp;
window.switchTab = switchTab;
window.showToast = showToast;
window.closeModal = closeModal;
window.openProfileModal = openProfileModal;
window.openForgotPasswordModal = openForgotPasswordModal;
window.openChangePasswordModal = openChangePasswordModal;
window.handleUpdateProfileInfo = handleUpdateProfileInfo;
window.handleChangePassword = handleChangePassword;
window.uploadProfilePhoto = uploadProfilePhoto;
window.processForgot = processForgot;
window.toggleRegisterInput = toggleRegisterInput;
window.toggleGenerateInput = toggleGenerateInput;
window.saveSchoolName = saveSchoolName;
window.renderUsersTable = renderUsersTable;
window.updateProfileDelayDisplay = updateProfileDelayDisplay;
window.cleanupUI = cleanupUI;
window.loadSchoolLogo = loadSchoolLogo;
window.uploadSchoolLogo = uploadSchoolLogo;
window.removeSchoolLogo = removeSchoolLogo;
window.updateSchoolLogoUI = updateSchoolLogoUI;
window.toggleFriendsModal = toggleFriendsModal;
window.openChatModal = openChatModal;
// Dashboard functions
window.renderDashboard = renderDashboard;
window.updateDashboardChart = updateDashboardChart;