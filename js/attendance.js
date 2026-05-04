function renderTable() {
    const tbody = document.getElementById('tbody-attendance');
    const fDate = document.getElementById('filterDate').value;
    const fKelas = document.getElementById('filterKelas').value;
    const fJurusan = document.getElementById('filterJurusan').value;

    let data = dbData.attendance;
    
    // LOGIKA FILTER SISWA
    if (currentUser.role === 'siswa') {
        // Siswa HANYA melihat absensi sesuai Kelas & Jurusan dirinya sendiri
        if (currentUser.kelas && currentUser.jurusan) {
            data = data.filter(r => r.kelas === currentUser.kelas && r.jurusan === currentUser.jurusan);
        } else {
            // Jika siswa belum set kelas/jurusan di profil, tampilkan array kosong
            data = []; 
        }
        
        // Siswa bisa filter tanggal (Hari ini / Semua)
        if (fDate === 'today') {
            const todayStr = new Date().toISOString().split('T')[0];
            data = data.filter(r => r.date === todayStr);
        }
    } 
    // LOGIKA FILTER GURU & ADMIN
    else {
        if (fDate === 'today') {
            const todayStr = new Date().toISOString().split('T')[0];
            data = data.filter(r => r.date === todayStr);
        }
        if (fKelas !== 'all') data = data.filter(r => r.kelas === fKelas);
        if (fJurusan !== 'all') data = data.filter(r => r.jurusan === fJurusan);
    }

    tbody.innerHTML = '';
    if (data.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Data tidak ada.</td></tr>'; 
        return; 
    }
    
    data.forEach(row => {
        tbody.innerHTML += `
            <tr>
                <td>${row.timeIn}<br><span class="text-small">${row.date}</span></td>
                <td>${row.studentId}</td>
                <td>${row.nama}</td>
                <td>${row.kelas}</td>
                <td>${row.jurusan}</td>
                <td><span style="color:${row.status === 'Pulang' ? 'var(--danger)' : 'var(--success)'}">● ${row.status}</span></td>
                <td class="role-guru role-admin">
                    <button class="btn-icon delete" onclick="deleteAttendance('${row.id}')">🗑</button>
                </td>
            </tr>`;
    });
}

function deleteAttendance(id) {
    if(!confirm("Hapus?")) return;
    const [date, fpId] = id.split('-');
    db.ref(`absensi/${date}/${fpId}`).remove().then(() => showToast("Dihapus"));
}

function simulateAttendance() {
    const students = dbData.users;
    if(students.length === 0) return showToast("Belum ada siswa!", "error");
    const s = students[Math.floor(Math.random() * students.length)];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
    const dateStr = now.toISOString().split('T')[0];
    
    db.ref(`absensi/${dateStr}/${s.id}`).set({
        nama: s.nama, kelas: s.kelas, jurusan: s.jurusan, in: timeStr
    }).then(() => showToast(`Scan: ${s.nama}`));
}

function exportToExcel() {
    let csv = "data:text/csv;charset=utf-8,Waktu,Nama,Kelas,Jurusan,Status\n";
    dbData.attendance.forEach(r => {
        csv += `${r.date} ${r.timeIn},${r.nama},${r.kelas},${r.jurusan},${r.status}\n`;
    });
    const link = document.createElement("a"); link.href = encodeURI(csv); link.download = "absensi.csv";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}
