// logs.js - VERSION 3.0 (INTEGRATED WITH VERCEL BACKEND API)
// Manajemen Log Aktivitas dengan filter berdasarkan role
// Role yang didukung:
// - Developer: lihat semua log
// - Admin (Kepala Sekolah): lihat semua log
// - Wakil Kepala Sekolah: lihat semua log (read-only)
// - Staff TU: lihat log terbatas (hanya log yang relevan dengan tugasnya)
// - Guru: lihat semua log
// - Siswa: hanya log milik sendiri
// V3.0: Terintegrasi dengan API backend Vercel
// ============================================================================

// Backend API URL (Vercel)
const BACKEND_API_URL = "https://absensi-backend-3we5.vercel.app/api";

let logsListener = null;
let currentLogsData = [];
let logsPerPage = 20;
let currentLogsPage = 1;
let logsInitialized = false;

// Cache untuk logs
let cachedLogsData = null;
let cachedLogsTimestamp = 0;
const LOGS_CACHE_TTL = 60 * 1000; // 1 menit

// ======================= FUNGSI API BACKEND =======================

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

/**
 * Ambil data log dari API backend
 */
async function fetchLogsFromAPI() {
    try {
        const now = Date.now();
        if (cachedLogsData && (now - cachedLogsTimestamp) < LOGS_CACHE_TTL) {
            console.log("📦 Using cached logs data");
            return cachedLogsData;
        }
        
        console.log("📋 Fetching logs from API...");
        const data = await apiRequest('/logs');
        const logs = data.data || [];
        
        cachedLogsData = logs;
        cachedLogsTimestamp = now;
        return logs;
    } catch (error) {
        console.error("Fetch logs from API error:", error);
        return null;
    }
}

/**
 * Simpan log ke API backend
 */
async function saveLogToAPI(logData) {
    try {
        // API backend mungkin belum memiliki endpoint POST untuk logs
        // Untuk sementara, tetap gunakan Firebase
        if (typeof db !== 'undefined' && db) {
            await db.ref('logs').push(logData);
        }
        return true;
    } catch (error) {
        console.error("Save log to API error:", error);
        return false;
    }
}

/**
 * Fungsi logActivity yang terintegrasi dengan API
 */
async function logActivity(action, details) {
    if (!currentUser) return;
    
    const logData = {
        action: action,
        userId: currentUser.uid,
        userName: currentUser.nama || currentUser.email,
        userRole: currentUser.role,
        details: details,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        userAgent: navigator.userAgent.substring(0, 200),
        ipAddress: 'client-side'
    };
    
    // Simpan ke API (yang akan menggunakan Firebase fallback)
    await saveLogToAPI(logData);
    
    // Invalidate cache
    cachedLogsData = null;
    cachedLogsTimestamp = 0;
}

// ======================= ROLE HELPER FUNCTIONS ========================

function getRoleDisplayName(role) {
    const names = {
        developer: 'Developer',
        admin: 'Kepala Sekolah',
        wakil_kepala: 'Wakil Kepala Sekolah',
        staff_tu: 'Staff TU',
        guru: 'Guru',
        siswa: 'Siswa'
    };
    return names[role] || role.toUpperCase();
}

function getRoleIcon(role) {
    const icons = {
        developer: '👨‍💻',
        admin: '👑',
        wakil_kepala: '👔',
        staff_tu: '📋',
        guru: '👨‍🏫',
        siswa: '👨‍🎓'
    };
    return icons[role] || '👤';
}

function canViewAllLogs(role) {
    const allAccessRoles = ['admin', 'developer', 'wakil_kepala', 'guru'];
    return allAccessRoles.includes(role);
}

function canViewSensitiveLogs(role) {
    const sensitiveRoles = ['admin', 'developer', 'wakil_kepala'];
    return sensitiveRoles.includes(role);
}

function filterSensitiveActionsForStaffTU(logs) {
    const sensitiveActions = [
        'delete_user', 'reset_system', 'update_user_role', 
        'delete_announcement', 'reset_user_password'
    ];
    return logs.filter(log => !sensitiveActions.includes(log.action));
}

function getAllowedActionsForFilter(role) {
    const allActions = [
        'login', 'logout', 'register',
        'create_announcement', 'update_announcement', 'delete_announcement',
        'delete_attendance', 'simulate_attendance_in', 'simulate_attendance_out', 'save_manual_attendance',
        'add_student', 'edit_student', 'delete_student', 'import_students', 'export_students',
        'update_user_role', 'delete_user', 'reset_system', 'reset_user_password',
        'create_status', 'delete_status',
        'send_friend_request', 'accept_friend_request', 'reject_friend_request', 'remove_friend',
        'delete_chat_message', 'clear_chat',
        'upload_profile_photo', 'save_school_name', 'upload_school_logo', 'remove_school_logo',
        'update_global_delay', 'save_classes', 'save_majors', 'update_school_type',
        'export_attendance_excel', 'export_rekap_excel', 'export_rekap_pdf', 'forgot_password',
        'add_staff', 'edit_staff', 'delete_staff', 'create_staff_account',
        'simulate_staff_attendance_in', 'simulate_staff_attendance_out', 'delete_staff_attendance',
        'create_izin', 'update_izin', 'delete_izin', 'approve_izin', 'reject_izin',
        'generate_code', 'delete_code'
    ];
    
    if (role === 'staff_tu') {
        const sensitiveActions = ['delete_user', 'reset_system', 'update_user_role', 'delete_announcement'];
        return allActions.filter(a => !sensitiveActions.includes(a));
    }
    
    return allActions;
}

// ======================= INISIALISASI ========================

async function initLogsSystem() {
    if (logsInitialized) return;
    logsInitialized = true;
    
    console.log("📋 Initializing logs system with API integration...");
    if (!currentUser) return;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const startInput = document.getElementById('logStartDate');
    const endInput = document.getElementById('logEndDate');
    if (startInput && !startInput.value) startInput.value = startDate.toISOString().split('T')[0];
    if (endInput && !endInput.value) endInput.value = endDate.toISOString().split('T')[0];
    
    populateActionFilter();
    
    // Load initial data
    await loadLogsData();
    
    // Set up refresh interval (every 30 seconds)
    if (window.logsRefreshInterval) clearInterval(window.logsRefreshInterval);
    window.logsRefreshInterval = setInterval(async () => {
        if (document.getElementById('tab-logs')?.classList.contains('active')) {
            await loadLogsData();
            renderLogsTable();
        }
    }, 30000);
}

async function loadLogsData() {
    try {
        // Coba ambil dari API dulu
        let logs = await fetchLogsFromAPI();
        
        // Fallback ke Firebase jika API gagal
        if (!logs && typeof db !== 'undefined' && db) {
            console.log("📋 Fetching logs from Firebase fallback...");
            const snapshot = await db.ref('logs').once('value');
            const data = snapshot.val();
            logs = [];
            if (data) {
                Object.entries(data).forEach(([id, log]) => {
                    logs.push({ id, ...log });
                });
            }
        }
        
        currentLogsData = logs || [];
        currentLogsData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        renderLogsTable();
        
    } catch (error) {
        console.error("Load logs data error:", error);
        currentLogsData = [];
        renderLogsTable();
    }
}

function populateActionFilter() {
    const actionFilter = document.getElementById('logActionFilter');
    if (!actionFilter) return;
    
    const allowedActions = getAllowedActionsForFilter(currentUser?.role);
    const currentValue = actionFilter.value;
    
    actionFilter.innerHTML = '<option value="all">📌 Semua Aksi</option>';
    
    const actionCategories = {
        '🔐 Autentikasi': ['login', 'logout', 'register', 'forgot_password'],
        '📢 Pengumuman': ['create_announcement', 'update_announcement', 'delete_announcement'],
        '📋 Absensi': ['delete_attendance', 'simulate_attendance_in', 'simulate_attendance_out', 'save_manual_attendance', 'export_attendance_excel'],
        '👨‍🎓 Manajemen Siswa': ['add_student', 'edit_student', 'delete_student', 'import_students', 'export_students'],
        '👥 Manajemen User': ['update_user_role', 'delete_user', 'reset_user_password', 'reset_system'],
        '📸 Status': ['create_status', 'delete_status'],
        '👥 Pertemanan': ['send_friend_request', 'accept_friend_request', 'reject_friend_request', 'remove_friend'],
        '💬 Chat': ['delete_chat_message', 'clear_chat'],
        '⚙️ Pengaturan': ['upload_profile_photo', 'save_school_name', 'upload_school_logo', 'remove_school_logo', 'update_global_delay', 'save_classes', 'save_majors', 'update_school_type'],
        '📊 Ekspor': ['export_rekap_excel', 'export_rekap_pdf'],
        '👥 Staff': ['add_staff', 'edit_staff', 'delete_staff', 'create_staff_account', 'simulate_staff_attendance_in', 'simulate_staff_attendance_out', 'delete_staff_attendance', 'export_staff_attendance_excel'],
        '📝 Izin Online': ['create_izin', 'update_izin', 'delete_izin', 'approve_izin', 'reject_izin'],
        '🔑 Kode Registrasi': ['generate_code', 'delete_code']
    };
    
    for (const [category, actions] of Object.entries(actionCategories)) {
        const categoryActions = actions.filter(a => allowedActions.includes(a));
        if (categoryActions.length > 0) {
            actionFilter.innerHTML += `<optgroup label="${category}">`;
            categoryActions.forEach(action => {
                actionFilter.innerHTML += `<option value="${action}">${getActionIcon(action)} ${formatActionName(action)}</option>`;
            });
            actionFilter.innerHTML += `</optgroup>`;
        }
    }
    
    if (currentValue && currentValue !== 'all') {
        const exists = Array.from(actionFilter.options).some(opt => opt.value === currentValue);
        if (exists) actionFilter.value = currentValue;
    }
}

// ======================= RENDER LOGS TABLE ========================

async function renderLogsTable() {
    const tbody = document.getElementById('logsTbody');
    if (!tbody) return;
    
    if (!currentUser) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">🔒 Silakan login terlebih dahulu</td></tr>';
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">⏳ Memuat data...</td></tr>';
    
    try {
        let filteredLogs = [...currentLogsData];
        
        // FILTER BERDASARKAN ROLE
        if (currentUser.role === 'siswa') {
            filteredLogs = filteredLogs.filter(log => log.userId === currentUser.uid);
        } else if (currentUser.role === 'staff_tu') {
            filteredLogs = filterSensitiveActionsForStaffTU(filteredLogs);
        }
        
        // Filter berdasarkan aksi
        const actionFilter = document.getElementById('logActionFilter')?.value;
        if (actionFilter && actionFilter !== 'all') {
            filteredLogs = filteredLogs.filter(log => log.action === actionFilter);
        }
        
        // Filter berdasarkan user (jika ada)
        const userFilter = document.getElementById('logUserFilter')?.value;
        if (userFilter && userFilter !== 'all') {
            filteredLogs = filteredLogs.filter(log => 
                log.userName?.toLowerCase().includes(userFilter.toLowerCase()) ||
                log.userId?.toLowerCase().includes(userFilter.toLowerCase())
            );
        }
        
        // Filter tanggal
        const startDateStr = document.getElementById('logStartDate')?.value;
        const endDateStr = document.getElementById('logEndDate')?.value;
        if (startDateStr && endDateStr) {
            const start = new Date(startDateStr);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDateStr);
            end.setHours(23, 59, 59, 999);
            filteredLogs = filteredLogs.filter(log => {
                const ts = log.timestamp;
                if (!ts) return false;
                const logDate = new Date(ts);
                return logDate >= start && logDate <= end;
            });
        }
        
        // Pagination
        const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
        const startIdx = (currentLogsPage - 1) * logsPerPage;
        const paginatedLogs = filteredLogs.slice(startIdx, startIdx + logsPerPage);
        
        if (paginatedLogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">📭 Tidak ada log aktivitas.</td></tr>';
            renderPagination(totalPages);
            updateLogsCount(filteredLogs.length);
            return;
        }
        
        let html = '';
        for (const log of paginatedLogs) {
            const time = log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : '-';
            const actionIcon = getActionIcon(log.action);
            const roleDisplay = getRoleDisplayName(log.userRole || 'siswa');
            const roleIcon = getRoleIcon(log.userRole || 'siswa');
            let roleClass = `role-${log.userRole || 'siswa'}`;
            if (log.userRole === 'wakil_kepala') roleClass = 'role-wakil-kepala';
            if (log.userRole === 'staff_tu') roleClass = 'role-staff-tu';
            
            let rowClass = '';
            if (log.action === 'delete_user' || log.action === 'reset_system') {
                rowClass = 'log-critical';
            } else if (log.action === 'login' || log.action === 'logout') {
                rowClass = 'log-auth';
            } else if (log.action.includes('delete')) {
                rowClass = 'log-delete';
            }
            
            html += `
                <tr class="${rowClass}" style="border-bottom: 1px solid var(--border);">
                    <td style="white-space: nowrap; padding: 12px 8px;">${time}</td>
                    <td style="padding: 12px 8px;"><strong>${escapeHtmlLog(log.userName || log.userId)}</strong></td>
                    <td style="padding: 12px 8px;"><span class="role-badge ${roleClass}">${roleIcon} ${roleDisplay}</span></td>
                    <td style="padding: 12px 8px;">${actionIcon} ${formatActionName(log.action)}</td>
                    <td style="padding: 12px 8px; max-width: 400px; word-break: break-word;">${escapeHtmlLog(log.details || '-')}</td>
                    <td style="padding: 12px 8px;"><small>${log.ipAddress || '-'}</small></td>
                </tr>
            `;
        }
        tbody.innerHTML = html;
        renderPagination(totalPages);
        updateLogsCount(filteredLogs.length);
        
    } catch (err) {
        console.error("Render logs error:", err);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">❌ Gagal memuat log: ${escapeHtmlLog(err.message)}</td></tr>`;
    }
}

function updateLogsCount(count) {
    const logsHeader = document.querySelector('#tab-logs .controls-bar h4, #tab-logs .section-header h4');
    if (logsHeader) {
        logsHeader.innerHTML = `📋 Log Aktivitas <span style="font-size: 12px; color: #888;">(${count} record)</span>`;
    }
}

function renderPagination(totalPages) {
    const container = document.getElementById('logsPagination');
    if (!container) return;
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">';
    
    if (currentLogsPage > 1) {
        html += `<button class="btn-action btn-secondary" onclick="changeLogsPage(1)" title="Halaman pertama">⏮️</button>`;
        html += `<button class="btn-action btn-secondary" onclick="changeLogsPage(${currentLogsPage - 1})">◀ Prev</button>`;
    }
    
    let startPage = Math.max(1, currentLogsPage - 2);
    let endPage = Math.min(totalPages, currentLogsPage + 2);
    
    if (startPage > 1) {
        html += `<span class="page-number">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentLogsPage) {
            html += `<span class="page-number active" style="background: var(--primary); color: white; padding: 5px 10px; border-radius: 5px;">${i}</span>`;
        } else {
            html += `<button class="page-number" onclick="changeLogsPage(${i})" style="background: transparent; border: 1px solid var(--border); padding: 5px 10px; border-radius: 5px; cursor: pointer;">${i}</button>`;
        }
    }
    
    if (endPage < totalPages) {
        html += `<span class="page-number">...</span>`;
    }
    
    if (currentLogsPage < totalPages) {
        html += `<button class="btn-action btn-secondary" onclick="changeLogsPage(${currentLogsPage + 1})">Next ▶</button>`;
        html += `<button class="btn-action btn-secondary" onclick="changeLogsPage(${totalPages})" title="Halaman terakhir">⏭️</button>`;
    }
    
    html += `<span style="margin-left: 15px; font-size: 12px; color: var(--text-muted);">Halaman ${currentLogsPage} dari ${totalPages}</span>`;
    html += `</div>`;
    
    container.innerHTML = html;
}

function changeLogsPage(page) {
    currentLogsPage = page;
    renderLogsTable();
}

// ======================= ACTION ICONS & NAMES ========================

function getActionIcon(action) {
    const icons = {
        'login': '🔓', 'logout': '🚪', 'register': '📝', 'forgot_password': '🔐',
        'create_announcement': '📢', 'update_announcement': '✏️', 'delete_announcement': '🗑️',
        'delete_attendance': '🗑️', 'simulate_attendance_in': '✅', 'simulate_attendance_out': '🏠',
        'save_manual_attendance': '📝', 'export_attendance_excel': '📊',
        'add_student': '➕', 'edit_student': '✏️', 'delete_student': '🗑️',
        'import_students': '📥', 'export_students': '📤',
        'update_user_role': '🔄', 'delete_user': '🗑️', 'reset_system': '⚠️', 'reset_user_password': '🔑',
        'create_status': '📸', 'delete_status': '🗑️',
        'send_friend_request': '➕', 'accept_friend_request': '✅', 'reject_friend_request': '❌', 'remove_friend': '🗑️',
        'delete_chat_message': '💬🗑️', 'clear_chat': '🧹',
        'upload_profile_photo': '📸', 'save_school_name': '🏫', 'upload_school_logo': '🖼️', 'remove_school_logo': '🗑️',
        'update_global_delay': '⏰', 'save_classes': '📚', 'save_majors': '🎓', 'update_school_type': '🏫',
        'export_rekap_excel': '📊', 'export_rekap_pdf': '📄',
        'add_staff': '➕', 'edit_staff': '✏️', 'delete_staff': '🗑️', 'create_staff_account': '👤',
        'simulate_staff_attendance_in': '✅', 'simulate_staff_attendance_out': '🏠', 'delete_staff_attendance': '🗑️',
        'export_staff_attendance_excel': '📊',
        'create_izin': '📝', 'update_izin': '✏️', 'delete_izin': '🗑️', 'approve_izin': '✅', 'reject_izin': '❌',
        'generate_code': '🔑', 'delete_code': '🗑️'
    };
    return icons[action] || '📌';
}

function formatActionName(action) {
    const names = {
        'login': 'Login', 'logout': 'Logout', 'register': 'Registrasi Akun', 'forgot_password': 'Lupa Password',
        'create_announcement': 'Buat Pengumuman', 'update_announcement': 'Edit Pengumuman', 'delete_announcement': 'Hapus Pengumuman',
        'delete_attendance': 'Hapus Absensi', 'simulate_attendance_in': 'Simulasi Absen Masuk', 'simulate_attendance_out': 'Simulasi Absen Pulang',
        'save_manual_attendance': 'Atur Ketidakhadiran', 'export_attendance_excel': 'Ekspor Absensi Excel',
        'add_student': 'Tambah Siswa', 'edit_student': 'Edit Siswa', 'delete_student': 'Hapus Siswa',
        'import_students': 'Import Siswa', 'export_students': 'Export Siswa',
        'update_user_role': 'Ubah Role User', 'delete_user': 'Hapus User', 'reset_system': 'Reset Sistem', 'reset_user_password': 'Reset Password User',
        'create_status': 'Buat Status', 'delete_status': 'Hapus Status',
        'send_friend_request': 'Kirim Permintaan Teman', 'accept_friend_request': 'Terima Permintaan Teman',
        'reject_friend_request': 'Tolak Permintaan Teman', 'remove_friend': 'Hapus Teman',
        'delete_chat_message': 'Hapus Pesan Chat', 'clear_chat': 'Bersihkan Chat',
        'upload_profile_photo': 'Upload Foto Profil', 'save_school_name': 'Ubah Nama Sekolah',
        'upload_school_logo': 'Upload Logo Sekolah', 'remove_school_logo': 'Hapus Logo Sekolah',
        'update_global_delay': 'Ubah Delay Global', 'save_classes': 'Simpan Daftar Kelas',
        'save_majors': 'Simpan Daftar Jurusan', 'update_school_type': 'Ubah Tipe Sekolah',
        'export_rekap_excel': 'Ekspor Rekap Excel', 'export_rekap_pdf': 'Ekspor Rekap PDF',
        'add_staff': 'Tambah Staff', 'edit_staff': 'Edit Staff', 'delete_staff': 'Hapus Staff',
        'create_staff_account': 'Buat Akun Staff', 'simulate_staff_attendance_in': 'Absen Masuk Staff',
        'simulate_staff_attendance_out': 'Absen Pulang Staff', 'delete_staff_attendance': 'Hapus Absensi Staff',
        'export_staff_attendance_excel': 'Ekspor Absensi Staff Excel',
        'create_izin': 'Ajukan Izin', 'update_izin': 'Edit Izin', 'delete_izin': 'Hapus Izin',
        'approve_izin': 'Setujui Izin', 'reject_izin': 'Tolak Izin',
        'generate_code': 'Generate Kode Registrasi', 'delete_code': 'Hapus Kode Registrasi'
    };
    return names[action] || action.replace(/_/g, ' ').toUpperCase();
}

function escapeHtmlLog(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

// ======================= FILTER RESET ========================

function resetLogsFilters() {
    const startInput = document.getElementById('logStartDate');
    const endInput = document.getElementById('logEndDate');
    const actionFilter = document.getElementById('logActionFilter');
    const userFilter = document.getElementById('logUserFilter');
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    if (startInput) startInput.value = startDate.toISOString().split('T')[0];
    if (endInput) endInput.value = endDate.toISOString().split('T')[0];
    if (actionFilter) actionFilter.value = 'all';
    if (userFilter) userFilter.value = '';
    
    currentLogsPage = 1;
    renderLogsTable();
    
    if (typeof showToast === 'function') {
        showToast("🔄 Filter log direset", "info");
    }
}

// ======================= EXPORT LOGS ========================

function exportLogsToCSV() {
    if (!currentLogsData || currentLogsData.length === 0) {
        if (typeof showToast === 'function') {
            showToast("Tidak ada data log untuk diekspor", "error");
        }
        return;
    }
    
    let filteredLogs = [...currentLogsData];
    
    if (currentUser.role === 'siswa') {
        filteredLogs = filteredLogs.filter(log => log.userId === currentUser.uid);
    } else if (currentUser.role === 'staff_tu') {
        filteredLogs = filterSensitiveActionsForStaffTU(filteredLogs);
    }
    
    const startDateStr = document.getElementById('logStartDate')?.value;
    const endDateStr = document.getElementById('logEndDate')?.value;
    if (startDateStr && endDateStr) {
        const start = new Date(startDateStr);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);
        filteredLogs = filteredLogs.filter(log => {
            const ts = log.timestamp;
            if (!ts) return false;
            const logDate = new Date(ts);
            return logDate >= start && logDate <= end;
        });
    }
    
    const csvRows = [["Waktu", "User", "Role", "Aksi", "Detail", "IP Address"]];
    
    for (const log of filteredLogs) {
        const time = log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : '-';
        csvRows.push([
            time,
            log.userName || log.userId || '-',
            getRoleDisplayName(log.userRole) || '-',
            formatActionName(log.action),
            (log.details || '-').replace(/,/g, ';'),
            log.ipAddress || '-'
        ]);
    }
    
    const csv = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `logs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    if (typeof showToast === 'function') {
        showToast("📥 Log berhasil diekspor", "success");
    }
}

// ======================= CLEANUP ========================

function cleanupLogsSystem() {
    if (window.logsRefreshInterval) {
        clearInterval(window.logsRefreshInterval);
        window.logsRefreshInterval = null;
    }
    currentLogsData = [];
    currentLogsPage = 1;
    logsInitialized = false;
    cachedLogsData = null;
    cachedLogsTimestamp = 0;
    console.log("🧹 Logs system cleaned up");
}

// ======================= EKSPOR KE GLOBAL =======================
window.initLogsSystem = initLogsSystem;
window.renderLogsTable = renderLogsTable;
window.changeLogsPage = changeLogsPage;
window.cleanupLogsSystem = cleanupLogsSystem;
window.populateActionFilter = populateActionFilter;
window.resetLogsFilters = resetLogsFilters;
window.exportLogsToCSV = exportLogsToCSV;
window.logActivity = logActivity;
window.loadLogsData = loadLogsData;
window.getAllowedActionsForFilter = getAllowedActionsForFilter;
window.filterSensitiveActionsForStaffTU = filterSensitiveActionsForStaffTU;
window.getRoleDisplayName = getRoleDisplayName;
window.getRoleIcon = getRoleIcon;
window.canViewAllLogs = canViewAllLogs;
window.canViewSensitiveLogs = canViewSensitiveLogs;

console.log("✅ logs.js V3.0 loaded - Terintegrasi dengan API Backend Vercel!");