// attendance.js - VERSION 2.2 (Dengan Chart Ringkasan Hari Ini)
// Mengelola data absensi, filter, validasi delay pulang, real-time updates,
// serta manual status (sakit, izin, alpha) untuk siswa yang tidak hadir.

// ======================== GLOBAL VARIABLES ========================
let lastAttendanceCount = 0;
let attendanceRefreshInterval = null;
let notificationSound = null;
let attendanceDonutChart = null; // Chart instance

// ======================== INITIALIZATION ========================

/**
 * Inisialisasi fitur real-time absensi
 */
function initRealtimeAttendance() {
    console.log("🔄 Initializing real-time attendance system...");
    
    if (typeof Audio !== 'undefined') {
        notificationSound = new Audio();
    }
    
    setupRealtimeAttendanceListener();
    startAttendancePeriodicRefresh();
    // Inisialisasi chart (donut) setelah DOM siap
    setTimeout(() => updateAttendanceDonutChart(), 500);
}

/**
 * Setup real-time listener untuk perubahan data absensi
 */
function setupRealtimeAttendanceListener() {
    if (typeof db === 'undefined' || !db) {
        console.warn("Firebase not available for attendance listener");
        return;
    }
    
    db.ref('absensi').on('value', (snapshot) => {
        const data = snapshot.val();
        const newCount = data ? Object.keys(data).reduce((count, date) => {
            return count + (data[date] ? Object.keys(data[date]).length : 0);
        }, 0) : 0;
        
        if (lastAttendanceCount > 0 && newCount > lastAttendanceCount) {
            const newRecords = newCount - lastAttendanceCount;
            showRealtimeAttendanceAlert(`📢 ${newRecords} absensi baru masuk!`);
            updateAttendanceTabBadge(true);
        } else if (lastAttendanceCount > 0 && newCount !== lastAttendanceCount) {
            updateAttendanceTabBadge(false);
        }
        
        lastAttendanceCount = newCount;
        
        if (typeof renderTable === 'function') {
            requestAnimationFrame(() => renderTable());
        }
        // Update chart setiap ada perubahan data
        updateAttendanceDonutChart();
    });
    
    db.ref('absensi').on('child_added', (snapshot) => {
        const date = snapshot.key;
        console.log(`📋 New attendance record added for date: ${date}`);
        showToast("📢 Ada absensi baru masuk!", "info");
        flashAttendanceTable();
        updateAttendanceDonutChart();
    });
    
    db.ref('absensi').on('child_changed', (snapshot) => {
        const date = snapshot.key;
        console.log(`📝 Attendance record updated for date: ${date}`);
        showToast("📝 Data absensi diperbarui (pulang)", "info");
        updateAttendanceDonutChart();
    });
}

/**
 * Mulai periodic refresh sebagai fallback (setiap 10 detik)
 */
function startAttendancePeriodicRefresh() {
    if (attendanceRefreshInterval) clearInterval(attendanceRefreshInterval);
    attendanceRefreshInterval = setInterval(() => {
        if (currentUser && typeof db !== 'undefined') {
            db.ref('absensi').once('value').catch(err => console.warn("Periodic refresh error:", err));
        }
    }, 10000);
}

/**
 * Hentikan periodic refresh
 */
function stopAttendancePeriodicRefresh() {
    if (attendanceRefreshInterval) {
        clearInterval(attendanceRefreshInterval);
        attendanceRefreshInterval = null;
    }
}

// ======================== UI NOTIFICATIONS ========================

function showRealtimeAttendanceAlert(message) {
    showToast(message, "success");
    const originalTitle = document.title;
    let dotCount = 0;
    const interval = setInterval(() => {
        if (dotCount >= 3) {
            document.title = originalTitle;
            clearInterval(interval);
        } else {
            document.title = `🔔 ${message.substring(0, 20)}...`;
            dotCount++;
        }
    }, 500);
    setTimeout(() => {
        document.title = originalTitle;
        clearInterval(interval);
    }, 3000);
}

function updateAttendanceTabBadge(hasNew = true) {
    const attendanceTabBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => 
        b.textContent.includes('Absensi') || b.getAttribute('onclick')?.includes('attendance')
    );
    if (attendanceTabBtn) {
        if (hasNew) {
            if (!attendanceTabBtn.querySelector('.badge-new')) {
                const badge = document.createElement('span');
                badge.className = 'badge-new';
                badge.textContent = '●';
                badge.style.cssText = 'color: #f44336; margin-left: 5px; font-size: 10px; animation: pulse 1s infinite;';
                attendanceTabBtn.appendChild(badge);
            }
        } else {
            const badge = attendanceTabBtn.querySelector('.badge-new');
            if (badge) badge.remove();
        }
    }
}

function flashAttendanceTable() {
    const table = document.querySelector('#tab-attendance .table-container');
    if (table) {
        table.style.transition = 'background-color 0.3s';
        table.style.backgroundColor = 'rgba(74, 144, 226, 0.2)';
        setTimeout(() => {
            table.style.backgroundColor = '';
        }, 500);
    }
}

// ======================== CHART RINGKASAN HARI INI ========================

/**
 * Update donut chart untuk ringkasan absensi hari ini
 */
function updateAttendanceDonutChart() {
    const ctx = document.getElementById('attendanceDonutChart')?.getContext('2d');
    if (!ctx) {
        // console.warn("Canvas attendanceDonutChart not found yet");
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const todayData = dbData.attendance.filter(r => r.date === today);
    const hadir = todayData.filter(r => r.status === 'Hadir').length;
    const pulang = todayData.filter(r => r.status === 'Pulang').length;
    
    // Hancurkan chart lama jika ada
    if (attendanceDonutChart) {
        attendanceDonutChart.destroy();
    }
    
    attendanceDonutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['✅ Masuk (Belum Pulang)', '🏠 Pulang'],
            datasets: [{
                data: [hadir, pulang],
                backgroundColor: ['#ff9800', '#4caf50'],
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#fff', font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${ctx.raw} siswa`
                    }
                }
            }
        }
    });
    
    const statsText = document.getElementById('todayStatsText');
    if (statsText) {
        statsText.innerHTML = `✅ Masuk: ${hadir} orang &nbsp;|&nbsp; 🏠 Pulang: ${pulang} orang`;
    }
}

// ======================== RENDER TABLE (DENGAN STATUS MANUAL) ========================

async function renderTable() {
    console.log("📊 renderTable dipanggil - Total attendance:", dbData.attendance?.length || 0);
    
    const tbody = document.getElementById('tbody-attendance');
    if (!tbody) {
        console.warn("tbody-attendance not found");
        return;
    }
    
    const fDate = document.getElementById('filterDate') ? document.getElementById('filterDate').value : 'all';
    const fKelas = document.getElementById('filterKelas') ? document.getElementById('filterKelas').value : 'all';
    const fJurusan = document.getElementById('filterJurusan') ? document.getElementById('filterJurusan').value : 'all';

    let data = dbData.attendance ? [...dbData.attendance] : [];
    
    // Filter berdasarkan role user
    if (currentUser && currentUser.role === 'siswa') {
        if (currentUser.kelas && currentUser.jurusan) {
            data = data.filter(r => r.kelas === currentUser.kelas && r.jurusan === currentUser.jurusan);
        } else {
            data = [];
        }
        if (fDate === 'today') {
            const todayStr = new Date().toISOString().split('T')[0];
            data = data.filter(r => r.date === todayStr);
        }
    } else {
        // Admin atau Guru
        if (fDate === 'today') {
            const todayStr = new Date().toISOString().split('T')[0];
            data = data.filter(r => r.date === todayStr);
        } else if (fDate !== 'all') {
            data = data.filter(r => r.date === fDate);
        }
        if (fKelas !== 'all') data = data.filter(r => r.kelas === fKelas);
        if (fJurusan !== 'all') data = data.filter(r => r.jurusan === fJurusan);
    }

    data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    tbody.innerHTML = '';
    
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#888;">
            📭 Data absensi tidak ditemukan.
            ${currentUser?.role === 'siswa' ? '<br><small>Hubungi guru untuk informasi lebih lanjut.</small>' : ''}
        </td></tr>`;
        updateAttendanceStatistics(data);
        updateAttendanceDonutChart(); // refresh chart meski data kosong
        return;
    }
    
    // Ambil data status manual untuk hari ini (jika filter date = today atau all)
    let manualStatusMap = {};
    if (fDate === 'today' || fDate === 'all') {
        const todayStr = new Date().toISOString().split('T')[0];
        const statusSnapshot = await db.ref(`attendance_status/${todayStr}`).once('value');
        manualStatusMap = statusSnapshot.val() || {};
    } else if (fDate !== 'all') {
        const statusSnapshot = await db.ref(`attendance_status/${fDate}`).once('value');
        manualStatusMap = statusSnapshot.val() || {};
    }
    
    data.forEach((row, index) => {
        const timeDisplay = row.timeIn || '-';
        const outDisplay = row.timeOut ? `<br><span class="text-small" style="color:var(--danger)">🏠 Pulang: ${row.timeOut}</span>` : '';
        const isNew = index < 3 && (Date.now() - new Date(row.timestamp).getTime() < 60000);
        
        // Cek status manual
        let statusHtml = '';
        const manual = manualStatusMap[row.studentId];
        if (manual && manual.status && manual.status !== 'hadir') {
            let icon = '', label = '', color = '';
            if (manual.status === 'sakit') { icon = '🤒'; label = 'Sakit'; color = '#ff9800'; }
            else if (manual.status === 'izin') { icon = '📝'; label = 'Izin'; color = '#2196f3'; }
            else if (manual.status === 'alpha') { icon = '❌'; label = 'Alpha (Bolos)'; color = '#f44336'; }
            statusHtml = `<span style="color:${color}; font-weight:500;">${icon} ${label}</span><br><small class="text-small">(Manual)</small>`;
        } else {
            const statusColor = row.status === 'Pulang' ? 'var(--danger)' : 'var(--success)';
            const statusIcon = row.status === 'Pulang' ? '🏠' : '✅';
            statusHtml = `<span style="color:${statusColor}; font-weight:500;">${statusIcon} ${row.status}</span>`;
        }
        
        tbody.innerHTML += `
            <tr class="${isNew ? 'attendance-new-row' : ''}">
                <td>⏰ ${timeDisplay}<br><span class="text-small">📅 ${row.date}</span>${outDisplay}</td>
                <td><strong>#${row.studentId}</strong></td>
                <td>${escapeHtml(row.nama)}</td>
                <td>${row.kelas || '-'}</td>
                <td>${row.jurusan || '-'}</td>
                <td>${statusHtml}</td>
                <td class="role-guru role-admin">
                    <button class="btn-icon delete" onclick="deleteAttendance('${row.id}')" title="Hapus Data">🗑️</button>
                </td>
            </tr>
        `;
    });
    
    updateAttendanceStatistics(data);
    updateAttendanceDonutChart(); // perbarui chart setelah render
}

/**
 * Update statistik absensi di UI
 */
function updateAttendanceStatistics(data) {
    let statsContainer = document.getElementById('attendanceStats');
    if (!statsContainer) {
        const controlsBar = document.querySelector('#tab-attendance .controls-bar');
        if (controlsBar && !document.getElementById('attendanceStats')) {
            statsContainer = document.createElement('div');
            statsContainer.id = 'attendanceStats';
            statsContainer.style.marginBottom = '10px';
            controlsBar.insertAdjacentElement('afterend', statsContainer);
        } else return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const todayData = data.filter(r => r.date === today);
    const hadirToday = todayData.filter(r => r.status === 'Hadir').length;
    const pulangToday = todayData.filter(r => r.status === 'Pulang').length;
    const totalUnique = [...new Set(data.map(r => r.studentId))].length;
    
    statsContainer.innerHTML = `
        <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 15px; padding: 10px; background: #1e1e1e; border-radius: 8px;">
            <div><span style="color: #4a90e2;">📅 Hari Ini:</span> <strong>${hadirToday}</strong> Hadir, <strong>${pulangToday}</strong> Pulang</div>
            <div><span style="color: #4a90e2;">👥 Total Hari Ini:</span> <strong>${todayData.length}</strong> Transaksi</div>
            <div><span style="color: #4a90e2;">📊 Total Unik:</span> <strong>${totalUnique}</strong> Siswa</div>
        </div>
    `;
}

// ======================== DELETE ATTENDANCE ========================

function deleteAttendance(id) {
    if (!currentUser) {
        showToast("Anda harus login!", "error");
        return;
    }
    if (currentUser.role === 'siswa') {
        showToast("⛔ Akses Ditolak: Siswa tidak diizinkan menghapus data!", "error");
        return;
    }
    if (!confirm("⚠️ Apakah Anda yakin ingin menghapus data absensi ini?\n\nTindakan ini tidak dapat dibatalkan!")) return;
    
    const lastDashIndex = id.lastIndexOf('-');
    const date = id.substring(0, lastDashIndex);
    const fpId = id.substring(lastDashIndex + 1);
    
    console.log("🗑️ Menghapus absensi - Date:", date, "FP ID:", fpId);
    
    const btns = document.querySelectorAll(`button[onclick="deleteAttendance('${id}')"]`);
    btns.forEach(btn => { btn.disabled = true; btn.textContent = '⏳'; });
    
    db.ref(`absensi/${date}/${fpId}`).remove()
        .then(() => showToast("✅ Data absensi berhasil dihapus", "success"))
        .catch((error) => showToast("❌ Gagal menghapus: " + error.message, "error"))
        .finally(() => {
            btns.forEach(btn => { btn.disabled = false; btn.textContent = '🗑️'; });
        });
}

// ======================== SIMULATE ATTENDANCE ========================

function simulateAttendance() {
    if (!currentUser) {
        showToast("Anda harus login!", "error");
        return;
    }
    if (currentUser.role === 'siswa') {
        showToast("⛔ Simulasi hanya untuk Admin/Guru!", "error");
        return;
    }
    
    const students = dbData.users;
    if (!students || students.length === 0) {
        showToast("❌ Belum ada siswa di Database!", "error");
        return;
    }
    
    const validStudents = students.filter(s => s.nama && s.id);
    if (validStudents.length === 0) {
        showToast("❌ Tidak ada data siswa yang valid!", "error");
        return;
    }
    
    const s = validStudents[Math.floor(Math.random() * validStudents.length)];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
    const dateStr = now.toISOString().split('T')[0];
    
    const existingAttendance = dbData.attendance.find(a => a.studentId == s.id && a.date === dateStr && a.status === 'Hadir');
    if (existingAttendance) {
        showToast(`⚠️ ${s.nama} sudah absen masuk hari ini!`, "warning");
        return;
    }
    
    const btn = document.querySelector('button[onclick="simulateAttendance()"]');
    const originalText = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Memproses...'; }
    
    const attendanceData = {
        id: parseInt(s.id),
        nama: s.nama,
        kelas: s.kelas,
        jurusan: s.jurusan,
        in: timeStr,
        out: null,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    db.ref(`absensi/${dateStr}/${s.id}`).set(attendanceData)
        .then(() => showToast(`✅ Simulasi Absen Masuk Berhasil: ${s.nama} (${timeStr})`, "success"))
        .catch((err) => showToast("❌ Gagal simulasi: " + err.message, "error"))
        .finally(() => {
            if (btn) { btn.disabled = false; btn.innerHTML = originalText || '📷 Simulasi Scan FP'; }
        });
}

// ======================== EXPORT FUNCTIONS ========================

function exportToExcel() {
    if (!dbData.attendance || dbData.attendance.length === 0) {
        showToast("❌ Tidak ada data absensi untuk diekspor!", "error");
        return;
    }
    
    showToast("📊 Memproses ekspor data...", "info");
    let csv = "\uFEFFTanggal,Waktu Masuk,Waktu Pulang,ID,Nama,Kelas,Jurusan,Status\n";
    dbData.attendance.forEach(r => {
        csv += `"${r.date || '-'}","${r.timeIn || '-'}","${r.timeOut || '-'}","${r.studentId}","${escapeCsv(r.nama)}","${r.kelas || '-'}","${r.jurusan || '-'}","${r.status}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `laporan_absensi_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("📥 Laporan Excel berhasil diunduh", "success");
}

function escapeCsv(str) {
    if (!str) return '';
    if (str.includes(',') || str.includes('"') || str.includes('\n')) return '"' + str.replace(/"/g, '""') + '"';
    return str;
}

// ======================== FILTER FUNCTIONS ========================

function resetAttendanceFilters() {
    const filterDate = document.getElementById('filterDate');
    const filterKelas = document.getElementById('filterKelas');
    const filterJurusan = document.getElementById('filterJurusan');
    if (filterDate) filterDate.value = 'all';
    if (filterKelas) filterKelas.value = 'all';
    if (filterJurusan) filterJurusan.value = 'all';
    renderTable();
    showToast("🔄 Filter telah direset", "info");
}

function filterByDateRange(startDate, endDate) {
    if (!startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);
    const filtered = dbData.attendance.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate >= start && recordDate <= end;
    });
    renderFilteredTable(filtered);
}

function renderFilteredTable(filteredData) {
    const tbody = document.getElementById('tbody-attendance');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#888;">📭 Tidak ada data dalam rentang tanggal tersebut.</td></tr>`;
        return;
    }
    filteredData.forEach(row => {
        const outDisplay = row.timeOut ? `<br><span class="text-small" style="color:var(--danger)">🏠 Pulang: ${row.timeOut}</span>` : '';
        tbody.innerHTML += `
            <tr>
                <td>⏰ ${row.timeIn || '-'}<br><span class="text-small">📅 ${row.date}</span>${outDisplay}</td>
                <td><strong>#${row.studentId}</strong></td>
                <td>${escapeHtml(row.nama)}</td>
                <td>${row.kelas || '-'}</td>
                <td>${row.jurusan || '-'}</td>
                <td><span style="color:${row.status === 'Pulang' ? 'var(--danger)' : 'var(--success)'}">${row.status === 'Pulang' ? '🏠' : '✅'} ${row.status}</span></td>
                <td class="role-guru role-admin"><button class="btn-icon delete" onclick="deleteAttendance('${row.id}')" title="Hapus Data">🗑️</button></td>
            </tr>
        `;
    });
}

// ======================== MANUAL ATTENDANCE STATUS (IZIN, SAKIT, ALPHA) ========================

/**
 * Buka modal untuk mengatur ketidakhadiran siswa
 */
function openAbsenceModal() {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'guru')) {
        showToast("⛔ Hanya Admin/Guru yang dapat mengatur ketidakhadiran!", "error");
        return;
    }
    const modal = document.getElementById('modal-absence');
    if (!modal) {
        console.warn("Modal absence tidak ditemukan, pastikan index.html sudah memiliki modal-absence");
        showToast("Fitur sedang dimuat, coba lagi nanti", "error");
        return;
    }
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('absenceDate').value = today;
    populateAbsenceFilters();
    modal.classList.add('open');
}

function populateAbsenceFilters() {
    const kelasSelect = document.getElementById('absenceKelas');
    const jurusanSelect = document.getElementById('absenceJurusan');
    if (!kelasSelect || !jurusanSelect) return;
    
    let kelasOptions = [];
    if (window.currentSchoolConfig?.classes?.length) {
        kelasOptions = window.currentSchoolConfig.classes;
    } else {
        const type = window.currentSchoolConfig?.type || 'smp';
        if (type === 'smp') kelasOptions = ['VII','VIII','IX'];
        else if (type === 'smk') kelasOptions = ['X','XI','XII'];
        else kelasOptions = ['VII','VIII','IX','X','XI','XII'];
    }
    kelasSelect.innerHTML = '<option value="all">📚 Semua Kelas</option>' + kelasOptions.map(k => `<option value="${k}">${k}</option>`).join('');
    
    let jurusanOptions = ['UMUM'];
    if (window.currentSchoolConfig?.majors?.length) jurusanOptions = window.currentSchoolConfig.majors;
    jurusanSelect.innerHTML = '<option value="all">🎓 Semua Jurusan</option>' + jurusanOptions.map(j => `<option value="${j}">${j}</option>`).join('');
}

async function loadAbsenceList() {
    const date = document.getElementById('absenceDate').value;
    if (!date) {
        showToast("Pilih tanggal terlebih dahulu!", "error");
        return;
    }
    const kelas = document.getElementById('absenceKelas').value;
    const jurusan = document.getElementById('absenceJurusan').value;
    
    showToast("⏳ Memuat data siswa...", "info");
    
    let students = [...dbData.users];
    if (kelas !== 'all') students = students.filter(s => s.kelas === kelas);
    if (jurusan !== 'all') students = students.filter(s => s.jurusan === jurusan);
    students.sort((a,b) => a.id - b.id);
    
    const attendanceSnapshot = await db.ref(`absensi/${date}`).once('value');
    const attendanceData = attendanceSnapshot.val() || {};
    
    const statusSnapshot = await db.ref(`attendance_status/${date}`).once('value');
    const manualStatus = statusSnapshot.val() || {};
    
    const container = document.getElementById('absenceListContainer');
    if (students.length === 0) {
        container.innerHTML = '<p class="text-small" style="text-align:center;">📭 Tidak ada siswa dengan filter ini.</p>';
        return;
    }
    
    let html = `<div style="margin-bottom: 10px;"><small>⚠️ Siswa yang sudah absen (scan fingerprint) tidak dapat diubah statusnya.</small></div>`;
    for (const student of students) {
        const attendance = attendanceData[student.id];
        const hasIn = attendance && attendance.in;
        const isPresent = hasIn;
        
        let statusValue = 'alpha'; // default bolos
        let disabled = false;
        let note = '';
        
        if (isPresent) {
            statusValue = 'hadir';
            disabled = true;
            note = '✅ (sudah absen)';
        } else {
            const saved = manualStatus[student.id];
            if (saved && saved.status) statusValue = saved.status;
            else statusValue = 'alpha';
            disabled = false;
        }
        
        const statusOptions = `
            <option value="hadir" ${statusValue === 'hadir' ? 'selected' : ''}>✅ Hadir</option>
            <option value="sakit" ${statusValue === 'sakit' ? 'selected' : ''}>🤒 Sakit</option>
            <option value="izin" ${statusValue === 'izin' ? 'selected' : ''}>📝 Izin</option>
            <option value="alpha" ${statusValue === 'alpha' ? 'selected' : ''}>❌ Alpha (Bolos)</option>
        `;
        
        html += `
            <div class="absence-student-row" data-id="${student.id}">
                <div class="absence-student-info">
                    <div class="absence-student-name">${escapeHtml(student.nama)}</div>
                    <div class="absence-student-detail">ID: ${student.id} | Kelas: ${student.kelas} | Jurusan: ${student.jurusan}</div>
                    ${note ? `<div class="text-small" style="color:var(--text-muted)">${note}</div>` : ''}
                </div>
                <div>
                    <select class="status-select ${statusValue}" data-id="${student.id}" ${disabled ? 'disabled' : ''}>
                        ${statusOptions}
                    </select>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
    
    document.querySelectorAll('.status-select:not([disabled])').forEach(select => {
        select.addEventListener('change', function() {
            this.className = `status-select ${this.value}`;
        });
    });
}

async function saveAllAbsenceStatus() {
    const date = document.getElementById('absenceDate').value;
    if (!date) {
        showToast("Tanggal tidak valid!", "error");
        return;
    }
    
    const selects = document.querySelectorAll('#absenceListContainer .status-select:not([disabled])');
    if (selects.length === 0) {
        showToast("Tidak ada perubahan yang dapat disimpan (semua siswa sudah absen atau tidak ada data).", "info");
        return;
    }
    
    const updates = {};
    for (const select of selects) {
        const studentId = select.dataset.id;
        const status = select.value;
        if (status && status !== 'hadir') {
            updates[studentId] = {
                status: status,
                updatedBy: currentUser.nama || currentUser.email,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };
        } else if (status === 'hadir') {
            // Jika status hadir secara manual, kita hapus dari database manual agar tidak bentrok
            updates[studentId] = null;
        }
    }
    
    const btn = document.querySelector('#modal-absence .btn-save');
    const originalText = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '💾 Menyimpan...'; }
    
    try {
        const refPath = `attendance_status/${date}`;
        const currentData = (await db.ref(refPath).once('value')).val() || {};
        const finalUpdates = {};
        for (const [id, value] of Object.entries(updates)) {
            if (value === null) {
                if (currentData[id]) finalUpdates[id] = null;
            } else {
                finalUpdates[id] = value;
            }
        }
        if (Object.keys(finalUpdates).length > 0) {
            await db.ref(refPath).update(finalUpdates);
        }
        showToast(`✅ Berhasil menyimpan data ketidakhadiran.`, "success");
        if (typeof renderTable === 'function') renderTable();
        closeModal('modal-absence');
    } catch (err) {
        console.error(err);
        showToast("❌ Gagal menyimpan: " + err.message, "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
    }
}

// ======================== UTILITY ========================

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

function getTodayAttendanceStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayData = dbData.attendance.filter(r => r.date === today);
    return {
        hadir: todayData.filter(r => r.status === 'Hadir').length,
        pulang: todayData.filter(r => r.status === 'Pulang').length,
        total: todayData.length,
        uniqueStudents: [...new Set(todayData.map(r => r.studentId))].length
    };
}

function cleanupAttendanceListeners() {
    stopAttendancePeriodicRefresh();
    if (typeof db !== 'undefined' && db) db.ref('absensi').off();
    if (attendanceDonutChart) {
        attendanceDonutChart.destroy();
        attendanceDonutChart = null;
    }
    console.log("🧹 Attendance listeners cleaned up");
}

// ======================== AUTO INIT ========================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => { if (currentUser) initRealtimeAttendance(); }, 1000);
    });
} else {
    setTimeout(() => { if (currentUser) initRealtimeAttendance(); }, 1000);
}

// Export ke global scope
window.renderTable = renderTable;
window.deleteAttendance = deleteAttendance;
window.simulateAttendance = simulateAttendance;
window.exportToExcel = exportToExcel;
window.resetAttendanceFilters = resetAttendanceFilters;
window.filterByDateRange = filterByDateRange;
window.getTodayAttendanceStats = getTodayAttendanceStats;
window.cleanupAttendanceListeners = cleanupAttendanceListeners;
window.initRealtimeAttendance = initRealtimeAttendance;
window.openAbsenceModal = openAbsenceModal;
window.loadAbsenceList = loadAbsenceList;
window.saveAllAbsenceStatus = saveAllAbsenceStatus;
window.updateAttendanceDonutChart = updateAttendanceDonutChart;