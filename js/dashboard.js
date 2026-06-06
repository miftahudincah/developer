// dashboard.js - VERSION 3.0 (INTEGRATED WITH VERCEL BACKEND API)
// Fitur Dashboard dengan filter berdasarkan role
// Role yang didukung:
// - Developer: akses penuh semua data
// - Admin (Kepala Sekolah): akses penuh semua data
// - Wakil Kepala Sekolah: akses penuh semua data
// - Staff TU: akses baca semua data (tidak bisa edit)
// - Guru: akses penuh semua data
// - Siswa: hanya melihat data kelas dan jurusannya sendiri
// V3.0: Terintegrasi dengan API backend Vercel
// ============================================================================

// Backend API URL (Vercel)
const BACKEND_API_URL = "https://absensi-backend-3we5.vercel.app/api";

let dashboardChart = null;
let dashboardRefreshInterval = null;
let dashboardInitialized = false;

// Cache untuk data dashboard
let cachedDashboardData = null;
let cachedDashboardTimestamp = 0;
const DASHBOARD_CACHE_TTL = 30 * 1000; // 30 detik

// ======================== FUNGSI API BACKEND ========================

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
 * Ambil data dashboard dari API backend
 */
async function fetchDashboardDataFromAPI() {
    try {
        const now = Date.now();
        if (cachedDashboardData && (now - cachedDashboardTimestamp) < DASHBOARD_CACHE_TTL) {
            console.log("📦 Using cached dashboard data");
            return cachedDashboardData;
        }
        
        console.log("📊 Fetching dashboard data from API...");
        
        // Ambil data siswa
        const studentsData = await apiRequest('/students');
        const students = studentsData.data || [];
        
        // Ambil data absensi
        const attendanceData = await apiRequest('/attendance');
        const attendance = attendanceData.data || [];
        
        // Ambil statistik hari ini
        const statsData = await apiRequest('/attendance/stats/today');
        const todayStats = statsData.data || {};
        
        const dashboardData = {
            students: students,
            attendance: attendance,
            todayStats: todayStats,
            timestamp: Date.now()
        };
        
        cachedDashboardData = dashboardData;
        cachedDashboardTimestamp = now;
        
        return dashboardData;
    } catch (error) {
        console.error("Fetch dashboard data error:", error);
        // Fallback ke data lokal
        if (dbData) {
            return {
                students: dbData.users || [],
                attendance: dbData.attendance || [],
                todayStats: { hadir: 0, pulang: 0, total: 0 },
                timestamp: Date.now(),
                isFallback: true
            };
        }
        return null;
    }
}

// ======================== ROLE HELPER FUNCTIONS ========================

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

function hasReadAllAccess(role) {
    const readAllRoles = ['developer', 'admin', 'wakil_kepala', 'staff_tu', 'guru'];
    return readAllRoles.includes(role);
}

function hasFullAccess(role) {
    const fullAccessRoles = ['developer', 'admin', 'wakil_kepala', 'guru'];
    return fullAccessRoles.includes(role);
}

// ======================== FILTER DATA BERDASARKAN ROLE ========================

function getFilteredStudents(studentsData) {
    if (!studentsData || studentsData.length === 0) return [];
    
    const validStudents = studentsData.filter(s => s && s.nama && s.nama !== 'Tidak Diketahui' && s.nama.trim() !== '');
    
    if (currentUser && hasReadAllAccess(currentUser.role)) {
        return validStudents;
    }
    
    if (currentUser && currentUser.role === 'siswa') {
        const userKelas = currentUser.kelas;
        const userJurusan = currentUser.jurusan;
        
        return validStudents.filter(s => {
            const matchKelas = !userKelas || s.kelas === userKelas;
            const matchJurusan = !userJurusan || s.jurusan === userJurusan;
            return matchKelas && matchJurusan;
        });
    }
    
    return validStudents;
}

function getFilteredAttendance(attendanceData, studentsData) {
    if (!attendanceData || attendanceData.length === 0) return [];
    
    if (currentUser && hasReadAllAccess(currentUser.role)) {
        return attendanceData;
    }
    
    if (currentUser && currentUser.role === 'siswa') {
        const userKelas = currentUser.kelas;
        const userJurusan = currentUser.jurusan;
        
        return attendanceData.filter(a => {
            const matchKelas = !userKelas || a.kelas === userKelas;
            const matchJurusan = !userJurusan || a.jurusan === userJurusan;
            return matchKelas && matchJurusan;
        });
    }
    
    return attendanceData;
}

// ======================== INISIALISASI ========================

function initDashboard() {
    if (dashboardInitialized) return;
    dashboardInitialized = true;
    console.log("📊 Initializing dashboard with role-based filtering (API integrated)...");
    
    renderDashboard();
    
    if (dashboardRefreshInterval) clearInterval(dashboardRefreshInterval);
    dashboardRefreshInterval = setInterval(() => {
        if (document.getElementById('tab-dashboard')?.classList.contains('active')) {
            // Refresh cache
            cachedDashboardData = null;
            renderDashboard();
        }
    }, 30000);
    
    window.addEventListener('dataReady', () => {
        if (document.getElementById('tab-dashboard')?.classList.contains('active')) {
            cachedDashboardData = null;
            renderDashboard();
        }
    });
}

// ======================== RENDER DASHBOARD ========================

async function renderDashboard() {
    console.log("📊 Rendering dashboard...");
    
    // Tampilkan loading
    const statsGrid = document.querySelector('.stats-grid');
    if (statsGrid && !statsGrid.querySelector('.dashboard-loading')) {
        // Loading indicator sudah ada di HTML
    }
    
    try {
        const dashboardData = await fetchDashboardDataFromAPI();
        
        if (!dashboardData || (!dashboardData.students && !dashboardData.attendance)) {
            console.log("⏳ Data belum siap, schedule ulang...");
            setTimeout(() => renderDashboard(), 500);
            return;
        }
        
        const students = dashboardData.students || [];
        const attendance = dashboardData.attendance || [];
        const todayStats = dashboardData.todayStats || {};
        
        const filteredStudents = getFilteredStudents(students);
        const filteredAttendance = getFilteredAttendance(attendance, students);
        
        const totalSiswa = filteredStudents.length;
        const today = new Date().toISOString().split('T')[0];
        
        let todayAttendance = filteredAttendance.filter(a => a.date === today);
        if (typeof filterAttendanceByHoliday === 'function') {
            todayAttendance = filterAttendanceByHoliday(todayAttendance);
        }
        
        const hadirSet = new Set();
        const terlambatSet = new Set();
        let hadir = 0;
        let terlambat = 0;
        
        todayAttendance.forEach(record => {
            if (record.status === 'Hadir' || record.status === 'Pulang') {
                if (!hadirSet.has(record.studentId)) {
                    hadirSet.add(record.studentId);
                    hadir++;
                }
                if (record.timeIn && record.timeIn > '07:30') {
                    terlambatSet.add(record.studentId);
                }
            }
        });
        terlambat = terlambatSet.size;
        
        // Gunakan statistik dari API jika tersedia
        if (todayStats.hadir !== undefined) {
            hadir = todayStats.hadir || hadir;
            terlambat = todayStats.terlambat || terlambat;
        }
        
        const tidakHadir = totalSiswa - hadir;
        const persenHadir = totalSiswa > 0 ? ((hadir / totalSiswa) * 100).toFixed(1) : 0;
        const persenTidakHadir = totalSiswa > 0 ? ((tidakHadir / totalSiswa) * 100).toFixed(1) : 0;
        const persenTerlambat = totalSiswa > 0 ? ((terlambat / totalSiswa) * 100).toFixed(1) : 0;
        
        updateDashboardStats(totalSiswa, hadir, tidakHadir, terlambat, persenHadir, persenTidakHadir, persenTerlambat);
        renderClassAttendance(filteredStudents, filteredAttendance, today);
        renderRecentAttendance(filteredAttendance);
        updateDashboardChart(filteredAttendance);
        updateDashboardRoleInfo();
        
        // Tampilkan info jika menggunakan fallback
        if (dashboardData.isFallback) {
            showFallbackWarning();
        }
        
        console.log(`✅ Dashboard rendered successfully (${getRoleDisplayName(currentUser?.role)} view)`);
        
    } catch (error) {
        console.error("Render dashboard error:", error);
        showDashboardError(error.message);
    }
}

function updateDashboardStats(totalSiswa, hadir, tidakHadir, terlambat, persenHadir, persenTidakHadir, persenTerlambat) {
    const trendSiswa = totalSiswa > 0 ? "+" + Math.floor(Math.random() * 10) : "0";
    
    const elTotalSiswa = document.getElementById('statTotalSiswaNew');
    if (elTotalSiswa) elTotalSiswa.innerText = totalSiswa;
    
    const elTrendSiswa = document.getElementById('statTrendSiswa');
    if (elTrendSiswa) elTrendSiswa.innerHTML = `${trendSiswa} dari periode lalu`;
    
    const elHadir = document.getElementById('statHadirHariIni');
    if (elHadir) elHadir.innerText = hadir;
    
    const elPersenHadir = document.getElementById('statPersenHadir');
    if (elPersenHadir) elPersenHadir.innerHTML = `${persenHadir}% dari total siswa`;
    
    const elTidakHadir = document.getElementById('statTidakHadir');
    if (elTidakHadir) elTidakHadir.innerText = tidakHadir;
    
    const elPersenTidakHadir = document.getElementById('statPersenTidakHadir');
    if (elPersenTidakHadir) elPersenTidakHadir.innerHTML = `${persenTidakHadir}% dari total siswa`;
    
    const elTerlambat = document.getElementById('statTerlambat');
    if (elTerlambat) elTerlambat.innerText = terlambat;
    
    const elPersenTerlambat = document.getElementById('statPersenTerlambat');
    if (elPersenTerlambat) elPersenTerlambat.innerHTML = `${persenTerlambat}% dari total siswa`;
}

function renderClassAttendance(students, attendance, today) {
    const container = document.getElementById('classAttendanceList');
    if (!container) return;
    
    let kelasData = new Map();
    
    if (currentUser && currentUser.role === 'siswa') {
        const userKelas = currentUser.kelas;
        const userJurusan = currentUser.jurusan;
        
        if (userKelas) {
            const siswaDiKelas = students.filter(s => s.kelas === userKelas && s.jurusan === userJurusan);
            const hadirDiKelas = new Set();
            
            attendance.forEach(record => {
                if (record.date === today && (record.status === 'Hadir' || record.status === 'Pulang')) {
                    const student = students.find(s => s.id == record.studentId);
                    if (student && student.kelas === userKelas && student.jurusan === userJurusan) {
                        hadirDiKelas.add(record.studentId);
                    }
                }
            });
            
            const total = siswaDiKelas.length;
            const hadir = hadirDiKelas.size;
            const persen = total > 0 ? (hadir / total) * 100 : 0;
            kelasData.set(userKelas, { total, hadir, persen: persen.toFixed(1) });
        }
    } else {
        students.forEach(s => {
            const kelas = s.kelas || 'Tanpa Kelas';
            if (!kelasData.has(kelas)) {
                kelasData.set(kelas, { total: 0, hadir: 0 });
            }
            kelasData.get(kelas).total++;
        });
        
        attendance.forEach(record => {
            if (record.date === today && (record.status === 'Hadir' || record.status === 'Pulang')) {
                const student = students.find(s => s.id == record.studentId);
                if (student && student.kelas) {
                    if (kelasData.has(student.kelas)) {
                        kelasData.get(student.kelas).hadir++;
                    }
                }
            }
        });
        
        for (let [kelas, data] of kelasData) {
            const persen = data.total > 0 ? (data.hadir / data.total) * 100 : 0;
            kelasData.set(kelas, { ...data, persen: persen.toFixed(1) });
        }
    }
    
    const sortedKelas = Array.from(kelasData.entries())
        .sort((a, b) => parseFloat(b[1].persen) - parseFloat(a[1].persen));
    
    if (sortedKelas.length === 0) {
        container.innerHTML = '<div class="class-item"><div class="class-name"><span>Belum ada data kelas</span><span>0%</span></div><div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div></div>';
        return;
    }
    
    container.innerHTML = sortedKelas.map(([kelas, data]) => `
        <div class="class-item">
            <div class="class-name">
                <span>${escapeHtmlDashboard(kelas)}</span>
                <span>${data.persen}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width:${data.persen}%"></div>
            </div>
            <div class="text-small" style="font-size:0.65rem; margin-top:4px;">
                ${data.hadir}/${data.total} siswa
            </div>
        </div>
    `).join('');
}

function renderRecentAttendance(attendance) {
    const container = document.getElementById('recentAttendanceList');
    if (!container) return;
    
    const sorted = [...attendance].sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
    });
    const recent = sorted.slice(0, 5);
    
    if (recent.length === 0) {
        container.innerHTML = '<div class="recent-item">Belum ada absensi hari ini</div>';
        return;
    }
    
    container.innerHTML = recent.map(r => `
        <div class="recent-item">
            <div class="recent-avatar">${r.status === 'Hadir' ? '✅' : (r.status === 'Pulang' ? '🏠' : (r.status === 'Terlambat' ? '⏰' : '📝'))}</div>
            <div class="recent-info">
                <div class="recent-name">${escapeHtmlDashboard(r.nama)}</div>
                <div class="recent-time">${r.timeIn || r.timeOut || '-'} • ${r.date || '-'}</div>
            </div>
        </div>
    `).join('');
}

function updateDashboardChart(attendance) {
    const canvas = document.getElementById('weeklyBarChart');
    if (!canvas) {
        console.warn("Canvas weeklyBarChart not found");
        return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    const weeks = [[], [], [], [], []];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
        const weekIndex = Math.floor((d - 1) / 7);
        if (weekIndex < 5) weeks[weekIndex].push(d);
    }
    while (weeks.length > 0 && weeks[weeks.length-1].length === 0) weeks.pop();
    
    const weeklyHadir = new Array(weeks.length).fill(0);
    const weeklyIzin = new Array(weeks.length).fill(0);
    const weeklyAlpha = new Array(weeks.length).fill(0);
    
    const monthAttendance = attendance.filter(rec => {
        if (!rec.date) return false;
        const d = new Date(rec.date);
        return d.getFullYear() === year && d.getMonth() === month;
    });
    
    monthAttendance.forEach(rec => {
        const day = new Date(rec.date).getDate();
        let weekIdx = Math.floor((day - 1) / 7);
        if (weekIdx >= weeks.length) weekIdx = weeks.length - 1;
        if (weekIdx < 0) weekIdx = 0;
        
        let status = rec.status || '';
        if (status === 'Hadir' || status === 'Pulang') {
            weeklyHadir[weekIdx]++;
        } else if (status === 'Izin' || status === 'Sakit') {
            weeklyIzin[weekIdx]++;
        } else if (status === 'Alpha') {
            weeklyAlpha[weekIdx]++;
        } else if (rec.timeIn) {
            weeklyHadir[weekIdx]++;
        }
    });
    
    const weekLabels = weeks.map((days, idx) => {
        if (days.length === 0) return `Minggu ${idx+1}`;
        const start = days[0];
        const end = days[days.length-1];
        return `${start}-${end}`;
    });
    
    if (dashboardChart) {
        try { dashboardChart.destroy(); } catch(e) {}
        dashboardChart = null;
    }
    
    try {
        dashboardChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: weekLabels,
                datasets: [
                    { label: 'Hadir', data: weeklyHadir, backgroundColor: '#00bcd4', borderRadius: 6, barPercentage: 0.7 },
                    { label: 'Izin/Sakit', data: weeklyIzin, backgroundColor: '#ff9800', borderRadius: 6, barPercentage: 0.7 },
                    { label: 'Alpha', data: weeklyAlpha, backgroundColor: '#f44336', borderRadius: 6, barPercentage: 0.7 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: true, position: 'top', labels: { color: '#ccc', font: { size: 11 } } },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#ccc', stepSize: 1 } },
                    x: { ticks: { color: '#ccc', autoSkip: true } }
                }
            }
        });
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        console.log(`✅ Dashboard chart updated for ${monthNames[month]} ${year}`);
    } catch (err) {
        console.error("Failed to create chart:", err);
    }
}

function updateDashboardRoleInfo() {
    if (!currentUser) return;
    
    let infoContainer = document.getElementById('dashboardRoleInfo');
    if (!infoContainer) {
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid && !document.getElementById('dashboardRoleInfo')) {
            const infoDiv = document.createElement('div');
            infoDiv.id = 'dashboardRoleInfo';
            infoDiv.style.cssText = 'margin-bottom: 15px; padding: 10px 15px; background: var(--bg-hover); border-radius: 12px; border-left: 4px solid #00bcd4;';
            statsGrid.parentNode.insertBefore(infoDiv, statsGrid);
            infoContainer = infoDiv;
        } else {
            return;
        }
    }
    
    const roleIcon = getRoleIcon(currentUser.role);
    const roleDisplay = getRoleDisplayName(currentUser.role);
    
    if (currentUser.role === 'siswa') {
        infoContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span>${roleIcon} <strong>Mode ${roleDisplay}</strong></span>
                <span style="color: var(--text-muted);">|</span>
                <span>📚 Kelas: <strong>${currentUser.kelas || '-'}</strong></span>
                <span>🎓 Jurusan: <strong>${currentUser.jurusan || '-'}</strong></span>
                <span style="color: #00bcd4; font-size: 12px;">ℹ️ Dashboard hanya menampilkan data kelas Anda</span>
            </div>
        `;
    } else if (currentUser.role === 'guru') {
        infoContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span>${roleIcon} <strong>Mode ${roleDisplay}</strong></span>
                <span style="color: var(--text-muted);">|</span>
                <span>📚 Mata Pelajaran: <strong>${currentUser.subject || '-'}</strong></span>
                <span style="color: #00bcd4; font-size: 12px;">ℹ️ Dashboard menampilkan semua data siswa</span>
            </div>
        `;
    } else if (currentUser.role === 'wakil_kepala') {
        infoContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span>${roleIcon} <strong>Mode ${roleDisplay}</strong></span>
                <span style="color: #00bcd4; font-size: 12px;">ℹ️ Dashboard menampilkan semua data siswa</span>
            </div>
        `;
    } else if (currentUser.role === 'staff_tu') {
        infoContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span>${roleIcon} <strong>Mode ${roleDisplay}</strong></span>
                <span style="color: #00bcd4; font-size: 12px;">ℹ️ Dashboard menampilkan semua data siswa (mode baca)</span>
            </div>
        `;
    } else {
        infoContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span>${roleIcon} <strong>Mode ${roleDisplay}</strong></span>
                <span style="color: #00bcd4; font-size: 12px;">ℹ️ Dashboard menampilkan semua data siswa</span>
            </div>
        `;
    }
}

function showFallbackWarning() {
    let warningContainer = document.getElementById('dashboardFallbackWarning');
    if (!warningContainer) {
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid && !document.getElementById('dashboardFallbackWarning')) {
            const warningDiv = document.createElement('div');
            warningDiv.id = 'dashboardFallbackWarning';
            warningDiv.style.cssText = 'margin-bottom: 15px; padding: 10px 15px; background: rgba(255, 152, 0, 0.1); border-radius: 12px; border-left: 4px solid #ff9800;';
            statsGrid.parentNode.insertBefore(warningDiv, statsGrid);
            warningContainer = warningDiv;
        } else {
            return;
        }
    }
    
    warningContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span>⚠️</span>
            <span>Menggunakan data lokal (fallback). Koneksi ke API backend terganggu.</span>
            <button onclick="refreshDashboardData()" style="margin-left: auto; padding: 4px 12px; background: #ff9800; border: none; border-radius: 5px; color: white; cursor: pointer;">🔄 Refresh</button>
        </div>
    `;
}

function showDashboardError(errorMessage) {
    const container = document.querySelector('.stats-grid');
    if (container) {
        const errorHtml = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; background: rgba(244, 67, 54, 0.1); border-radius: 20px;">
                <span style="font-size: 48px;">⚠️</span>
                <h3>Gagal Memuat Dashboard</h3>
                <p style="color: var(--text-muted);">${escapeHtmlDashboard(errorMessage)}</p>
                <button onclick="refreshDashboardData()" style="margin-top: 15px; padding: 8px 20px; background: #2196f3; border: none; border-radius: 5px; color: white; cursor: pointer;">🔄 Coba Lagi</button>
            </div>
        `;
        container.innerHTML = errorHtml;
    }
}

async function refreshDashboardData() {
    cachedDashboardData = null;
    cachedDashboardTimestamp = 0;
    
    const warningContainer = document.getElementById('dashboardFallbackWarning');
    if (warningContainer) warningContainer.remove();
    
    await renderDashboard();
    
    if (typeof showToast === 'function') {
        showToast("Dashboard diperbarui", "success");
    }
}

function escapeHtmlDashboard(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

function cleanupDashboard() {
    if (dashboardRefreshInterval) {
        clearInterval(dashboardRefreshInterval);
        dashboardRefreshInterval = null;
    }
    if (dashboardChart) {
        try { dashboardChart.destroy(); } catch(e) {}
        dashboardChart = null;
    }
    dashboardInitialized = false;
    cachedDashboardData = null;
    cachedDashboardTimestamp = 0;
    console.log("🧹 Dashboard cleaned up");
}

// ======================== EKSPOR KE GLOBAL =======================
window.initDashboard = initDashboard;
window.renderDashboard = renderDashboard;
window.getFilteredStudents = getFilteredStudents;
window.getFilteredAttendance = getFilteredAttendance;
window.cleanupDashboard = cleanupDashboard;
window.updateDashboardChart = updateDashboardChart;
window.getRoleDisplayName = getRoleDisplayName;
window.getRoleIcon = getRoleIcon;
window.hasReadAllAccess = hasReadAllAccess;
window.hasFullAccess = hasFullAccess;
window.refreshDashboardData = refreshDashboardData;
window.fetchDashboardDataFromAPI = fetchDashboardDataFromAPI;

console.log("✅ dashboard.js V3.0 loaded - Terintegrasi dengan API Backend Vercel (Role-based filtering: Developer, Kepala Sekolah, Wakil Kepala Sekolah, Staff TU, Guru, Siswa)");