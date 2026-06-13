// Dashboard JavaScript
let database = null;
let currentUser = null;
let currentPage = 'dashboard';

// Data cache
let siswaData = [];
let staffData = [];
let attendanceData = [];
let alphaStudents = [];
let commandHistory = [];

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
    currentUser = getUser();
    
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    // Set user info
    const userNameEl = document.getElementById('userName');
    const userRoleEl = document.getElementById('userRole');
    if (userNameEl) userNameEl.textContent = currentUser.name;
    if (userRoleEl) userRoleEl.textContent = currentUser.role;
    
    // Set current datetime
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Initialize Firebase
    await initFirebase();
    
    // Load initial data
    if (database) {
        await loadDashboard();
    } else {
        document.getElementById('pageContent').innerHTML = '<p style="color: red; text-align: center;">Gagal terhubung ke database. Silakan refresh halaman.</p>';
    }
    
    // Setup event listeners
    setupEventListeners();
});

// Update datetime
function updateDateTime() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    const datetimeEl = document.getElementById('currentDateTime');
    if (datetimeEl) {
        datetimeEl.textContent = now.toLocaleDateString('id-ID', options);
    }
}

// Initialize Firebase from backend
async function initFirebase() {
    try {
        const response = await fetch(`${API_BASE_URL}/firebase-config`);
        const data = await response.json();
        
        if (data.success && typeof firebase !== 'undefined' && !firebase.apps.length) {
            firebase.initializeApp(data.config);
            database = firebase.database();
            console.log('✅ Firebase connected');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Firebase init error:', error);
        showToast('Gagal terhubung ke database', 'error');
        return false;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            if (sidebar) sidebar.classList.toggle('collapsed');
            if (mainContent) mainContent.classList.toggle('expanded');
        });
    }
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            if (page) navigateTo(page);
        });
    });
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshCurrentPage();
        });
    }
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            clearAuthData();
            window.location.href = 'index.html';
        });
    }
}

// Navigate to page
function navigateTo(page) {
    currentPage = page;
    
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
    
    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        siswa: 'Data Siswa',
        staff: 'Data Staff',
        attendance: 'Rekap Absensi',
        alpha: 'Manual Alpha',
        commands: 'ESP32 Command'
    };
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = titles[page] || 'Dashboard';
    
    // Load page content
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'siswa':
            loadSiswaPage();
            break;
        case 'staff':
            loadStaffPage();
            break;
        case 'attendance':
            loadAttendancePage();
            break;
        case 'alpha':
            loadAlphaPage();
            break;
        case 'commands':
            loadCommandsPage();
            break;
        default:
            loadDashboard();
    }
}

// Refresh current page
function refreshCurrentPage() {
    switch(currentPage) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'siswa':
            loadSiswa();
            break;
        case 'staff':
            loadStaff();
            break;
        case 'attendance':
            loadAttendance();
            break;
        case 'alpha':
            loadAlphaStudents();
            break;
    }
}

// Load Dashboard
async function loadDashboard() {
    if (!database) {
        document.getElementById('pageContent').innerHTML = '<p style="color: red; text-align: center;">Database tidak terhubung</p>';
        return;
    }
    
    showLoading(true);
    
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const [usersSnap, staffSnap, todaySnap, esp32Snap] = await Promise.all([
            database.ref('users').once('value').catch(() => ({ numChildren: () => 0, val: () => null })),
            database.ref('staff').once('value').catch(() => ({ numChildren: () => 0, val: () => null })),
            database.ref(`absensi/${today}`).once('value').catch(() => ({ numChildren: () => 0, val: () => null })),
            database.ref('status/esp32').once('value').catch(() => ({ val: () => null }))
        ]);
        
        const totalSiswa = usersSnap.numChildren ? usersSnap.numChildren() : 0;
        const totalStaff = staffSnap.numChildren ? staffSnap.numChildren() : 0;
        const todayAttendance = todaySnap.numChildren ? todaySnap.numChildren() : 0;
        
        const esp32Data = esp32Snap.val();
        const lastPing = esp32Data?.last_ping;
        let isOnline = false;
        if (lastPing) {
            const now = new Date();
            const pingTime = new Date();
            const timeParts = lastPing.split(':');
            pingTime.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), parseInt(timeParts[2]));
            isOnline = (now - pingTime) < 120000;
        }
        
        const dashboardHtml = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h3><i class="fas fa-users"></i> Total Siswa</h3>
                    <div class="value">${totalSiswa}</div>
                    <div class="sub">Terdaftar di sistem</div>
                </div>
                <div class="stat-card">
                    <h3><i class="fas fa-chalkboard-user"></i> Total Staff</h3>
                    <div class="value">${totalStaff}</div>
                    <div class="sub">Guru & Karyawan</div>
                </div>
                <div class="stat-card">
                    <h3><i class="fas fa-calendar-check"></i> Absen Hari Ini</h3>
                    <div class="value">${todayAttendance}</div>
                    <div class="sub">Sudah melakukan absensi</div>
                </div>
                <div class="stat-card">
                    <h3><i class="fas fa-microchip"></i> ESP32 Status</h3>
                    <div class="value">${isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}</div>
                    <div class="sub">${isOnline ? `Last ping: ${lastPing}` : 'Tidak terdeteksi'}</div>
                </div>
            </div>
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-fingerprint" style="font-size: 80px; color: var(--primary); opacity: 0.5;"></i>
                <h3 style="margin-top: 20px; color: var(--gray-600);">Sistem Absensi Fingerprint</h3>
                <p style="color: var(--gray-500);">Gunakan menu di samping untuk mengelola data</p>
            </div>
        `;
        
        const pageContent = document.getElementById('pageContent');
        if (pageContent) pageContent.innerHTML = dashboardHtml;
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        const pageContent = document.getElementById('pageContent');
        if (pageContent) pageContent.innerHTML = '<p style="color: red; text-align: center;">Error loading dashboard</p>';
    }
    
    showLoading(false);
}

// Load Siswa Page
async function loadSiswaPage() {
    const pageContent = document.getElementById('pageContent');
    if (!pageContent) return;
    
    pageContent.innerHTML = `
        <div class="filter-bar">
            <input type="text" id="searchSiswa" placeholder="Cari nama / ID / kelas...">
            <button class="btn btn-primary" id="refreshSiswaBtn">
                <i class="fas fa-sync-alt"></i> Refresh
            </button>
            <button class="btn btn-secondary" id="syncSiswaBtn">
                <i class="fas fa-cloud-sync-alt"></i> Sync dari Firebase
            </button>
        </div>
        <div class="table-container" id="siswaTable"></div>
    `;
    
    // Add event listeners
    const searchInput = document.getElementById('searchSiswa');
    if (searchInput) searchInput.addEventListener('keyup', () => filterSiswa());
    
    const refreshBtn = document.getElementById('refreshSiswaBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => loadSiswa());
    
    const syncBtn = document.getElementById('syncSiswaBtn');
    if (syncBtn) syncBtn.addEventListener('click', () => syncSiswa());
    
    await loadSiswa();
}

async function loadSiswa() {
    if (!database) return;
    showLoading(true);
    
    try {
        const snapshot = await database.ref('users').once('value');
        const data = snapshot.val();
        siswaData = [];
        
        if (data) {
            for (let id in data) {
                siswaData.push({
                    id: id,
                    nama: data[id].nama || 'Unknown',
                    kelas: data[id].kelas || '-',
                    jurusan: data[id].jurusan || '-',
                    delayOut: data[id].delayOut || 60
                });
            }
            siswaData.sort((a, b) => a.nama.localeCompare(b.nama));
        }
        
        renderSiswaTable();
        
    } catch (error) {
        console.error('Error loading siswa:', error);
        const siswaTable = document.getElementById('siswaTable');
        if (siswaTable) siswaTable.innerHTML = '<p style="color: red;">Error loading data</p>';
    }
    
    showLoading(false);
}

function renderSiswaTable() {
    const searchInput = document.getElementById('searchSiswa');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const filtered = siswaData.filter(s => 
        s.nama.toLowerCase().includes(search) ||
        s.id.toString().includes(search) ||
        s.kelas.toLowerCase().includes(search)
    );
    
    let html = `<table><thead><tr>
        <th>ID</th><th>Nama</th><th>Kelas</th><th>Jurusan</th><th>Delay Out</th>`;
    if (currentUser?.role === 'admin') {
        html += `<th>Aksi</th>`;
    }
    html += ` </thead><tbody>`;
    
    filtered.forEach(s => {
        html += `<tr>
            <td>${s.id}</td>
            <td>${escapeHtml(s.nama)}</td>
            <td>${escapeHtml(s.kelas)}</td>
            <td>${escapeHtml(s.jurusan)}</td>
            <td>${s.delayOut} menit</td>`;
        if (currentUser?.role === 'admin') {
            html += `<td><button class="btn btn-danger btn-sm" onclick="deleteFingerprint(${s.id}, '${escapeHtml(s.nama)}')">🗑️ Hapus</button></td>`;
        }
        html += `</tr>`;
    });
    
    html += '</tbody></table>';
    const siswaTable = document.getElementById('siswaTable');
    if (siswaTable) siswaTable.innerHTML = html;
}

function filterSiswa() {
    renderSiswaTable();
}

// Load Staff Page
async function loadStaffPage() {
    const pageContent = document.getElementById('pageContent');
    if (!pageContent) return;
    
    pageContent.innerHTML = `
        <div class="filter-bar">
            <input type="text" id="searchStaff" placeholder="Cari nama / ID / jabatan...">
            <button class="btn btn-primary" id="refreshStaffBtn">
                <i class="fas fa-sync-alt"></i> Refresh
            </button>
            <button class="btn btn-secondary" id="syncStaffBtn">
                <i class="fas fa-cloud-sync-alt"></i> Sync dari Firebase
            </button>
        </div>
        <div class="table-container" id="staffTable"></div>
    `;
    
    const searchInput = document.getElementById('searchStaff');
    if (searchInput) searchInput.addEventListener('keyup', () => filterStaff());
    
    const refreshBtn = document.getElementById('refreshStaffBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => loadStaff());
    
    const syncBtn = document.getElementById('syncStaffBtn');
    if (syncBtn) syncBtn.addEventListener('click', () => syncStaff());
    
    await loadStaff();
}

async function loadStaff() {
    if (!database) return;
    showLoading(true);
    
    try {
        const snapshot = await database.ref('staff').once('value');
        const data = snapshot.val();
        staffData = [];
        
        if (data) {
            for (let id in data) {
                staffData.push({
                    staffId: id,
                    nama: data[id].nama || 'Unknown',
                    jabatan: data[id].jabatan || 'guru',
                    departemen: data[id].departemen || '-',
                    email: data[id].email || '-',
                    noHp: data[id].noHp || '-',
                    fingerprintId: data[id].fingerprintId || '-'
                });
            }
            staffData.sort((a, b) => a.nama.localeCompare(b.nama));
        }
        
        renderStaffTable();
        
    } catch (error) {
        console.error('Error loading staff:', error);
        const staffTable = document.getElementById('staffTable');
        if (staffTable) staffTable.innerHTML = '<p style="color: red;">Error loading data</p>';
    }
    
    showLoading(false);
}

function renderStaffTable() {
    const searchInput = document.getElementById('searchStaff');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const filtered = staffData.filter(s => 
        s.nama.toLowerCase().includes(search) ||
        s.staffId.toLowerCase().includes(search) ||
        s.jabatan.toLowerCase().includes(search)
    );
    
    let html = `<table><thead><tr>
        <th>Staff ID</th><th>Nama</th><th>Jabatan</th><th>Departemen</th><th>Email</th><th>No HP</th><th>FP ID</th>
    </tr></thead><tbody>`;
    
    filtered.forEach(s => {
        html += `<tr>
            <td>${escapeHtml(s.staffId)}</td>
            <td>${escapeHtml(s.nama)}</td>
            <td>${escapeHtml(s.jabatan)}</td>
            <td>${escapeHtml(s.departemen)}</td>
            <td>${escapeHtml(s.email)}</td>
            <td>${escapeHtml(s.noHp)}</td>
            <td>${escapeHtml(s.fingerprintId)}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    const staffTable = document.getElementById('staffTable');
    if (staffTable) staffTable.innerHTML = html;
}

function filterStaff() {
    renderStaffTable();
}

// Load Attendance Page
async function loadAttendancePage() {
    const today = new Date().toISOString().split('T')[0];
    
    const pageContent = document.getElementById('pageContent');
    if (!pageContent) return;
    
    pageContent.innerHTML = `
        <div class="filter-bar">
            <input type="date" id="filterDate" value="${today}">
            <input type="text" id="searchAttendance" placeholder="Cari nama / ID...">
            <button class="btn btn-primary" id="searchAttendanceBtn">
                <i class="fas fa-search"></i> Cari
            </button>
        </div>
        <div class="table-container" id="attendanceTable"></div>
    `;
    
    const searchInput = document.getElementById('searchAttendance');
    if (searchInput) searchInput.addEventListener('keyup', () => filterAttendance());
    
    const searchBtn = document.getElementById('searchAttendanceBtn');
    if (searchBtn) searchBtn.addEventListener('click', () => loadAttendance());
    
    await loadAttendance();
}

async function loadAttendance() {
    if (!database) return;
    showLoading(true);
    
    const dateInput = document.getElementById('filterDate');
    const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    if (!date) return;
    
    try {
        const [absensiSnap, alphaSnap, usersSnap] = await Promise.all([
            database.ref(`absensi/${date}`).once('value'),
            database.ref(`attendance_status/${date}`).once('value'),
            database.ref('users').once('value')
        ]);
        
        const absensiData = absensiSnap.val() || {};
        const alphaData = alphaSnap.val() || {};
        const usersData = usersSnap.val() || {};
        
        attendanceData = [];
        
        // Process attendance data
        for (let id in absensiData) {
            attendanceData.push({
                id: id,
                nama: absensiData[id].nama || (usersData[id] ? usersData[id].nama : `Siswa ${id}`),
                kelas: absensiData[id].kelas || (usersData[id] ? usersData[id].kelas : '-'),
                jurusan: absensiData[id].jurusan || (usersData[id] ? usersData[id].jurusan : '-'),
                in: absensiData[id].in || '-',
                out: absensiData[id].out || '-'
            });
        }
        
        // Process alpha data
        for (let id in alphaData) {
            if (!attendanceData.find(a => a.id == id)) {
                attendanceData.push({
                    id: id,
                    nama: usersData[id] ? usersData[id].nama : `Siswa ${id}`,
                    kelas: usersData[id] ? usersData[id].kelas : '-',
                    jurusan: usersData[id] ? usersData[id].jurusan : '-',
                    in: '-',
                    out: '-',
                    status: alphaData[id].status || 'alpha'
                });
            }
        }
        
        renderAttendanceTable();
        
    } catch (error) {
        console.error('Error loading attendance:', error);
        const attendanceTable = document.getElementById('attendanceTable');
        if (attendanceTable) attendanceTable.innerHTML = '<p style="color: red;">Error loading data</p>';
    }
    
    showLoading(false);
}

function renderAttendanceTable() {
    const searchInput = document.getElementById('searchAttendance');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const filtered = attendanceData.filter(a => 
        a.nama.toLowerCase().includes(search) ||
        a.id.toString().includes(search)
    );
    
    let html = `<table><thead><tr>
        <th>ID</th><th>Nama</th><th>Kelas</th><th>Jurusan</th><th>Check-in</th><th>Check-out</th><th>Status</th>
    </tr></thead><tbody>`;
    
    filtered.forEach(a => {
        let statusBadge = '';
        if (a.status === 'alpha') statusBadge = '<span class="badge badge-alpha">Alpha</span>';
        else if (a.status === 'sakit') statusBadge = '<span class="badge badge-sakit">Sakit</span>';
        else if (a.status === 'izin') statusBadge = '<span class="badge badge-izin">Izin</span>';
        else if (a.in !== '-') {
            statusBadge = a.out !== '-' ? 
                '<span class="badge badge-present">Hadir (Pulang)</span>' : 
                '<span class="badge badge-present">Hadir</span>';
        } else {
            statusBadge = '<span class="badge badge-alpha">Tidak Hadir</span>';
        }
        
        html += `<tr>
            <td>${a.id}</td>
            <td>${escapeHtml(a.nama)}</td>
            <td>${escapeHtml(a.kelas)}</td>
            <td>${escapeHtml(a.jurusan)}</td>
            <td>${a.in}</td>
            <td>${a.out || '-'}</td>
            <td>${statusBadge}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    const attendanceTable = document.getElementById('attendanceTable');
    if (attendanceTable) attendanceTable.innerHTML = html;
}

function filterAttendance() {
    renderAttendanceTable();
}

// Load Alpha Page
async function loadAlphaPage() {
    const today = new Date().toISOString().split('T')[0];
    
    const pageContent = document.getElementById('pageContent');
    if (!pageContent) return;
    
    pageContent.innerHTML = `
        <div class="filter-bar">
            <input type="date" id="alphaDate" value="${today}">
            <input type="text" id="searchAlpha" placeholder="Cari nama / ID...">
            <button class="btn btn-primary" id="searchAlphaBtn">
                <i class="fas fa-search"></i> Cari Siswa
            </button>
        </div>
        <div class="table-container" id="alphaTable"></div>
    `;
    
    const searchInput = document.getElementById('searchAlpha');
    if (searchInput) searchInput.addEventListener('keyup', () => searchAlphaStudent());
    
    const searchBtn = document.getElementById('searchAlphaBtn');
    if (searchBtn) searchBtn.addEventListener('click', () => loadAlphaStudents());
    
    await loadAlphaStudents();
}

async function loadAlphaStudents() {
    if (!database) return;
    showLoading(true);
    
    const dateInput = document.getElementById('alphaDate');
    const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    if (!date) return;
    
    try {
        const [absensiSnap, alphaSnap, usersSnap] = await Promise.all([
            database.ref(`absensi/${date}`).once('value'),
            database.ref(`attendance_status/${date}`).once('value'),
            database.ref('users').once('value')
        ]);
        
        const absensiData = absensiSnap.val() || {};
        const alphaData = alphaSnap.val() || {};
        const usersData = usersSnap.val() || {};
        
        alphaStudents = [];
        
        for (let id in usersData) {
            const hasAttendance = absensiData[id];
            const hasAlpha = alphaData[id];
            
            if (!hasAttendance && !hasAlpha) {
                alphaStudents.push({
                    id: id,
                    nama: usersData[id].nama,
                    kelas: usersData[id].kelas || '-',
                    jurusan: usersData[id].jurusan || '-',
                    status: 'alpha'
                });
            } else if (hasAlpha && !hasAttendance) {
                alphaStudents.push({
                    id: id,
                    nama: usersData[id].nama,
                    kelas: usersData[id].kelas || '-',
                    jurusan: usersData[id].jurusan || '-',
                    status: alphaData[id].status || 'alpha'
                });
            }
        }
        
        renderAlphaTable();
        
    } catch (error) {
        console.error('Error loading alpha students:', error);
        const alphaTable = document.getElementById('alphaTable');
        if (alphaTable) alphaTable.innerHTML = '<p style="color: red;">Error loading data</p>';
    }
    
    showLoading(false);
}

function renderAlphaTable() {
    const searchInput = document.getElementById('searchAlpha');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const filtered = alphaStudents.filter(s => 
        s.nama.toLowerCase().includes(search) ||
        s.id.toString().includes(search)
    );
    
    let html = `能::-<thead><tr>
        <th>ID</th><th>Nama</th><th>Kelas</th><th>Jurusan</th><th>Status Saat Ini</th><th>Aksi</th>
    </tr></thead><tbody>`;
    
    filtered.forEach(s => {
        html += `<tr>
            <td>${s.id}</td>
            <td>${escapeHtml(s.nama)}</td>
            <td>${escapeHtml(s.kelas)}</td>
            <td>${escapeHtml(s.jurusan)}</td>
            <td><span class="badge badge-${s.status}">${s.status.toUpperCase()}</span></td>
            <td>
                <select id="status_${s.id}" class="status-select" style="padding: 5px; margin-right: 5px;">
                    <option value="alpha" ${s.status === 'alpha' ? 'selected' : ''}>Alpha</option>
                    <option value="sakit" ${s.status === 'sakit' ? 'selected' : ''}>Sakit</option>
                    <option value="izin" ${s.status === 'izin' ? 'selected' : ''}>Izin</option>
                </select>
                <button class="btn btn-primary btn-sm" onclick="updateAlphaStatus(${s.id}, '${escapeHtml(s.nama)}')">
                    <i class="fas fa-save"></i> Simpan
                </button>
            </td>
        </tr>`;
    });
    
    html += '</tbody>\\能:';
    const alphaTable = document.getElementById('alphaTable');
    if (alphaTable) alphaTable.innerHTML = html;
}

function searchAlphaStudent() {
    renderAlphaTable();
}

async function updateAlphaStatus(studentId, studentName) {
    const select = document.getElementById(`status_${studentId}`);
    if (!select) return;
    
    const newStatus = select.value;
    const dateInput = document.getElementById('alphaDate');
    const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    
    showLoading(true);
    
    try {
        await database.ref(`attendance_status/${date}/${studentId}`).set({
            status: newStatus,
            updatedBy: currentUser?.name || 'Web Monitoring',
            timestamp: new Date().toISOString()
        });
        
        showToast(`✅ Status ${studentName} diubah menjadi ${newStatus.toUpperCase()}`, 'success');
        await loadAlphaStudents();
        await loadAttendance();
        
    } catch (error) {
        console.error('Error updating status:', error);
        showToast(`❌ Gagal update status: ${error.message}`, 'error');
    }
    
    showLoading(false);
}

// Load Commands Page
function loadCommandsPage() {
    const pageContent = document.getElementById('pageContent');
    if (!pageContent) return;
    
    pageContent.innerHTML = `
        <div id="commandAlert" class="alert" style="display: none;"></div>
        
        <div class="form-group">
            <label><i class="fas fa-terminal"></i> Pilih Perintah</label>
            <select id="commandSelect" class="command-select">
                <option value="">-- Pilih Perintah --</option>
                <option value="SYNC_USERS">🔄 Sync Data Siswa</option>
                <option value="SYNC_STAFF">🔄 Sync Data Staff</option>
                <option value="GET_STATUS">📊 Cek Status ESP32</option>
                <option value="REBOOT">🔄 Reboot ESP32</option>
                <option value="DELETE_FP">🗑️ Hapus Fingerprint</option>
            </select>
        </div>
        
        <div id="commandExtra" style="display: none;">
            <div class="form-group">
                <label><i class="fas fa-fingerprint"></i> ID Fingerprint</label>
                <input type="number" id="deleteFpId" placeholder="Masukkan ID fingerprint">
            </div>
        </div>
        
        <button class="btn btn-primary" id="sendCommandBtn">
            <i class="fas fa-paper-plane"></i> Kirim Perintah
        </button>
        <button class="btn btn-secondary" id="clearHistoryBtn">
            <i class="fas fa-trash-alt"></i> Clear History
        </button>
        
        <h3 style="margin-top: 30px;">📜 History Perintah</h3>
        <div class="table-container" id="commandHistoryTable"></div>
    `;
    
    const commandSelect = document.getElementById('commandSelect');
    if (commandSelect) {
        commandSelect.addEventListener('change', () => {
            const extraDiv = document.getElementById('commandExtra');
            if (extraDiv) {
                extraDiv.style.display = commandSelect.value === 'DELETE_FP' ? 'block' : 'none';
            }
        });
    }
    
    const sendBtn = document.getElementById('sendCommandBtn');
    if (sendBtn) sendBtn.addEventListener('click', () => sendCommand());
    
    const clearBtn = document.getElementById('clearHistoryBtn');
    if (clearBtn) clearBtn.addEventListener('click', () => clearCommandHistory());
    
    renderCommandHistory();
}

async function sendCommand() {
    const commandSelect = document.getElementById('commandSelect');
    const cmd = commandSelect ? commandSelect.value : '';
    
    if (!cmd) {
        showAlert('commandAlert', 'Pilih perintah terlebih dahulu', 'error');
        return;
    }
    
    let command = cmd;
    if (cmd === 'DELETE_FP') {
        const fpIdInput = document.getElementById('deleteFpId');
        const fpId = fpIdInput ? fpIdInput.value : '';
        if (!fpId) {
            showAlert('commandAlert', 'Masukkan ID fingerprint', 'error');
            return;
        }
        command = `DELETE_FP:${fpId}`;
    }
    
    if (!database) {
        showAlert('commandAlert', 'Database tidak terhubung', 'error');
        return;
    }
    
    try {
        await database.ref('commands/esp32/send_command').set({
            command: command,
            timestamp: Date.now(),
            status: 'pending'
        });
        
        addToCommandHistory(command);
        showAlert('commandAlert', `✅ Perintah terkirim: ${command}`, 'success');
        
    } catch (error) {
        console.error('Error sending command:', error);
        showAlert('commandAlert', `❌ Gagal kirim: ${error.message}`, 'error');
    }
}

function addToCommandHistory(command) {
    commandHistory.unshift({
        command: command,
        time: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString()
    });
    if (commandHistory.length > 20) commandHistory.pop();
    renderCommandHistory();
}

function renderCommandHistory() {
    let html = `能::-<thead><tr><th>Waktu</th><th>Perintah</th></tr></thead><tbody>`;
    
    if (commandHistory.length === 0) {
        html += `<tr><td colspan="2" style="text-align: center;">Belum ada history</td></tr>`;
    } else {
        commandHistory.forEach(cmd => {
            html += `<tr>
                <td>${cmd.date} ${cmd.time}</td>
                <td><code>${escapeHtml(cmd.command)}</code></td>
            </tr>`;
        });
    }
    
    html += '</tbody>\\能:';
    const historyTable = document.getElementById('commandHistoryTable');
    if (historyTable) historyTable.innerHTML = html;
}

function clearCommandHistory() {
    commandHistory = [];
    renderCommandHistory();
    showToast('History perintah dibersihkan', 'info');
}

// Delete fingerprint
async function deleteFingerprint(id, name) {
    if (!confirm(`Yakin ingin menghapus fingerprint siswa ${name} (ID: ${id})?`)) return;
    
    if (!database) {
        showToast('Database tidak terhubung', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        await database.ref(`commands/esp32/delete_fingerprint`).set({
            studentId: id,
            studentName: name,
            status: 'pending',
            timestamp: Date.now()
        });
        
        showToast(`📡 Perintah hapus ID ${id} terkirim`, 'info');
        
        // Watch for response
        const responseRef = database.ref('commands/esp32/delete_fingerprint_response');
        const timeout = setTimeout(() => {
            showToast('⏰ Timeout menunggu respon ESP32', 'error');
            responseRef.off();
            showLoading(false);
        }, 30000);
        
        responseRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && data.studentId == id && data.status !== 'pending') {
                clearTimeout(timeout);
                responseRef.off();
                
                if (data.status === 'completed') {
                    showToast(`✅ Berhasil menghapus fingerprint ${name}`, 'success');
                    loadSiswa();
                } else {
                    showToast(`❌ Gagal menghapus: ${data.error || 'Unknown error'}`, 'error');
                }
                showLoading(false);
            }
        });
        
    } catch (error) {
        console.error('Error deleting fingerprint:', error);
        showToast(`❌ Gagal kirim perintah: ${error.message}`, 'error');
        showLoading(false);
    }
}

// Sync functions
async function syncSiswa() {
    showToast('📡 Mengirim perintah sync siswa ke ESP32...', 'info');
    await sendToESP32('SYNC_USERS');
    setTimeout(() => loadSiswa(), 3000);
}

async function syncStaff() {
    showToast('📡 Mengirim perintah sync staff ke ESP32...', 'info');
    await sendToESP32('SYNC_STAFF');
    setTimeout(() => loadStaff(), 3000);
}

async function sendToESP32(command, param = '') {
    if (!database) {
        showToast('Database tidak terhubung', 'error');
        return;
    }
    
    const fullCommand = param ? `${command}:${param}` : command;
    try {
        await database.ref('commands/esp32/send_command').set({
            command: fullCommand,
            timestamp: Date.now(),
            status: 'pending'
        });
        showToast(`✅ Perintah terkirim: ${fullCommand}`, 'success');
    } catch (error) {
        console.error('Error sending to ESP32:', error);
        showToast(`❌ Gagal kirim: ${error.message}`, 'error');
    }
}

// Toast notification
function showToast(message, type = 'info') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            max-width: 350px;
        `;
        document.body.appendChild(toast);
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };
    toast.style.backgroundColor = colors[type] || colors.info;
    toast.innerHTML = message;
    toast.style.display = 'block';
    toast.style.animation = 'slideIn 0.3s ease';
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}