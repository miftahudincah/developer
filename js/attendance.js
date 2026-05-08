function renderTable() {
    const tbody = document.getElementById('tbody-attendance');
    if (!tbody) return;
    
    const fDate = document.getElementById('filterDate')?.value || 'all';
    const fKelas = document.getElementById('filterKelas')?.value || 'all';
    const fJurusan = document.getElementById('filterJurusan')?.value || 'all';

    let data = [...dbData.attendance];
    
    if (currentUser?.role === 'siswa') {
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
        if (fDate === 'today') {
            const todayStr = new Date().toISOString().split('T')[0];
            data = data.filter(r => r.date === todayStr);
        }
        if (fKelas !== 'all') data = data.filter(r => r.kelas === fKelas);
        if (fJurusan !== 'all') data = data.filter(r => r.jurusan === fJurusan);
    }

    tbody.innerHTML = '';
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#888;">Data absensi tidak ditemukan.</td></tr>';
        return;
    }
    
    data.forEach(row => {
        tbody.innerHTML += `
            <tr>
                <td>${row.timeIn}<br><span class="text-small">${row.date}</span></td>
                <td>${row.studentId}</td>
                <td>${escapeHtml(row.nama)}</td>
                <td>${row.kelas}</td>
                <td>${row.jurusan}</td>
                <td><span style="color:${row.status === 'Pulang' ? 'var(--danger)' : 'var(--success)'}">● ${row.status}</span></td>
                <td class="role-guru role-admin"><button class="btn-icon delete" onclick="deleteAttendance('${row.id}')" title="Hapus Data">🗑</button></td>
            </tr>
        `;
    });
}

function deleteAttendance(id) {
    if (currentUser?.role === 'siswa') {
        showToast("Akses Ditolak: Siswa tidak diizinkan menghapus data!", "error");
        return;
    }
    if (!confirm("Apakah Anda yakin ingin menghapus data absensi ini?")) return;
    
    const [date, fpId] = id.split('-');
    db.ref(`absensi/${date}/${fpId}`).remove()
        .then(() => showToast("Data absensi berhasil dihapus"))
        .catch((error) => showToast("Gagal menghapus: " + error.message, "error"));
}

function simulateAttendance() {
    const students = dbData.users;
    if (students.length === 0) return showToast("Belum ada siswa di Database!", "error");
    
    const s = students[Math.floor(Math.random() * students.length)];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toISOString().split('T')[0];
    
    db.ref(`absensi/${dateStr}/${s.id}`).set({
        nama: s.nama,
        kelas: s.kelas,
        jurusan: s.jurusan,
        in: timeStr
    }).then(() => showToast(`Simulasi Scan Berhasil: ${s.nama}`))
      .catch((err) => showToast("Gagal simulasi: " + err.message, "error"));
}

function exportToExcel() {
    let csv = "data:text/csv;charset=utf-8,Waktu,Nama,Kelas,Jurusan,Status\n";
    dbData.attendance.forEach(r => {
        csv += `${r.date} ${r.timeIn},${r.nama},${r.kelas},${r.jurusan},${r.status}\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = "laporan_absensi.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}