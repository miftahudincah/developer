// attendance.js
// Mengelola data absensi, filter, dan validasi delay pulang

function renderTable() {
    const tbody = document.getElementById('tbody-attendance');
    const fDate = document.getElementById('filterDate') ? document.getElementById('filterDate').value : 'all';
    const fKelas = document.getElementById('filterKelas') ? document.getElementById('filterKelas').value : 'all';
    const fJurusan = document.getElementById('filterJurusan') ? document.getElementById('filterJurusan').value : 'all';

    let data = [...dbData.attendance];
    
    if (currentUser && currentUser.role === 'siswa') {
        if (currentUser.kelas && currentUser.jurusan) {
            data = data.filter(r => 
                r.kelas === currentUser.kelas && 
                r.jurusan === currentUser.jurusan
            );
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
        if (fKelas !== 'all') {
            data = data.filter(r => r.kelas === fKelas);
        }
        if (fJurusan !== 'all') {
            data = data.filter(r => r.jurusan === fJurusan);
        }
    }

    tbody.innerHTML = '';
    
    if (data.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#888;">Data absensi tidak ditemukan.</td></tr>'; 
        return; 
    }
    
    data.forEach(row => {
        let timeDisplay = row.timeIn || '-';
        let outDisplay = row.timeOut ? `<br><span class="text-small" style="color:var(--danger)">Pulang: ${row.timeOut}</span>` : '';
        
        tbody.innerHTML += `
            <tr>
                <td>
                    ${timeDisplay}<br>
                    <span class="text-small">${row.date}</span>
                    ${outDisplay}
                </td>
                <td>${row.studentId}</td>
                <td>${escapeHtml(row.nama)}</td>
                <td>${row.kelas}</td>
                <td>${row.jurusan}</td>
                <td>
                    <span style="color:${row.status === 'Pulang' ? 'var(--danger)' : 'var(--success)'}">
                        ● ${row.status}
                    </span>
                </td>
                <td class="role-guru role-admin">
                    <button class="btn-icon delete" onclick="deleteAttendance('${row.id}')" title="Hapus Data">🗑</button>
                </td>
            </tr>`;
    });
}

function deleteAttendance(id) {
    if (!currentUser) {
        showToast("Anda harus login!", "error");
        return;
    }
    
    if (currentUser.role === 'siswa') {
        showToast("Akses Ditolak: Siswa tidak diizinkan menghapus data!", "error");
        return;
    }

    if(!confirm("Apakah Anda yakin ingin menghapus data absensi ini?")) return;
    
    // Parse ID yang formatnya "date-id"
    // Contoh: "2024-01-15-12345" -> date = "2024-01-15", fpId = "12345"
    const lastDashIndex = id.lastIndexOf('-');
    const date = id.substring(0, lastDashIndex);
    const fpId = id.substring(lastDashIndex + 1);
    
    console.log("Menghapus absensi - Date:", date, "FP ID:", fpId);
    
    // Hapus dari Firebase dengan path yang benar
    const deleteRef = db.ref(`absensi/${date}/${fpId}`);
    
    deleteRef.remove()
        .then(() => {
            showToast("Data absensi berhasil dihapus");
            // Data akan otomatis refresh karena listener db.js akan memicu renderTable()
        })
        .catch((error) => {
            console.error("Error menghapus:", error);
            showToast("Gagal menghapus: " + error.message, "error");
        });
}

function simulateAttendance() {
    if (!currentUser) {
        showToast("Anda harus login!", "error");
        return;
    }
    
    const students = dbData.users;
    if(students.length === 0) return showToast("Belum ada siswa di Database!", "error");
    
    const s = students[Math.floor(Math.random() * students.length)];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
    const dateStr = now.toISOString().split('T')[0];
    
    const existingAttendance = dbData.attendance.find(a => 
        a.studentId == s.id && a.date === dateStr && a.status === 'Hadir'
    );
    
    if (existingAttendance) {
        showToast(`⚠️ ${s.nama} sudah absen masuk hari ini!`, "warning");
        return;
    }
    
    db.ref(`absensi/${dateStr}/${s.id}`).set({
        id: parseInt(s.id),
        nama: s.nama, 
        kelas: s.kelas, 
        jurusan: s.jurusan, 
        in: timeStr,
        out: null
    }).then(() => {
        showToast(`✅ Simulasi Absen Masuk Berhasil: ${s.nama} (${timeStr})`, "success");
    }).catch((err) => {
        showToast("❌ Gagal simulasi: " + err.message, "error");
    });
}

function exportToExcel() {
    let csv = "data:text/csv;charset=utf-8,Tanggal,Waktu Masuk,Waktu Pulang,ID,Nama,Kelas,Jurusan,Status\n";
    
    dbData.attendance.forEach(r => {
        const timeIn = r.timeIn || '-';
        const timeOut = r.timeOut || '-';
        csv += `${r.date},${timeIn},${timeOut},${r.studentId},${r.nama},${r.kelas},${r.jurusan},${r.status}\n`;
    });
    
    const link = document.createElement("a"); 
    link.href = encodeURI(csv); 
    link.download = `laporan_absensi_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
    
    showToast("📥 Laporan Excel berhasil diunduh", "success");
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}