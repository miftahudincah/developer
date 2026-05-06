// Attendance.js

function renderTable() {
    const tbody = document.getElementById('tbody-attendance');
    const fDate = document.getElementById('filterDate').value;
    const fKelas = document.getElementById('filterKelas').value;
    const fJurusan = document.getElementById('filterJurusan').value;

    let data = dbData.attendance;
    
    // --- LOGIKA FILTER BERDASARKAN ROLE ---
    
    // 1. Jika User adalah SISWA
    if (currentUser.role === 'siswa') {
        // Siswa HANYA boleh melihat data jika Kelas DAN Jurusannya cocok dengan profilnya
        if (currentUser.kelas && currentUser.jurusan) {
            data = data.filter(r => 
                r.kelas === currentUser.kelas && 
                r.jurusan === currentUser.jurusan
            );
        } else {
            // Jika profil siswa belum lengkap, sembunyikan semua data
            data = []; 
        }
        
        // Siswa tetap bisa filter tanggal (Hari Ini / Semua)
        if (fDate === 'today') {
            const todayStr = new Date().toISOString().split('T')[0];
            data = data.filter(r => r.date === todayStr);
        }
    } 
    // 2. Jika User adalah GURU atau ADMIN
    else {
        // Filter Tanggal
        if (fDate === 'today') {
            const todayStr = new Date().toISOString().split('T')[0];
            data = data.filter(r => r.date === todayStr);
        }
        // Filter Kelas Manual
        if (fKelas !== 'all') {
            data = data.filter(r => r.kelas === fKelas);
        }
        // Filter Jurusan Manual
        if (fJurusan !== 'all') {
            data = data.filter(r => r.jurusan === fJurusan);
        }
    }

    // --- RENDER TABEL ---
    tbody.innerHTML = '';
    
    if (data.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#888;">Data absensi tidak ditemukan.</td></tr>'; 
        return; 
    }
    
    // Loop setiap data dan buat baris tabel
    data.forEach(row => {
        tbody.innerHTML += `
            <tr>
                <td>
                    ${row.timeIn}<br>
                    <span class="text-small">${row.date}</span>
                </td>
                <td>${row.studentId}</td>
                <td>${row.nama}</td>
                <td>${row.kelas}</td>
                <td>${row.jurusan}</td>
                <td>
                    <span style="color:${row.status === 'Pulang' ? 'var(--danger)' : 'var(--success)'}">
                        ● ${row.status}
                    </span>
                </td>
                <!-- Kolom Aksi: Class 'role-guru role-admin' akan menyembunyikan kolom ini di CSS jika login sebagai siswa -->
                <td class="role-guru role-admin">
                    <button class="btn-icon delete" onclick="deleteAttendance('${row.id}')" title="Hapus Data">🗑</button>
                </td>
            </tr>`;
    });
}

function deleteAttendance(id) {
    // --- KEAMANAN: CEK ROLE SEBELUM MENGHAPUS ---
    // Mencegah siswa menghapus data lewat Console Browser
    if (currentUser.role === 'siswa') {
        showToast("Akses Ditolak: Siswa tidak diizinkan menghapus data!", "error");
        return;
    }
    // ----------------------------------------------

    if(!confirm("Apakah Anda yakin ingin menghapus data absensi ini?")) return;
    
    const [date, fpId] = id.split('-');
    
    db.ref(`absensi/${date}/${fpId}`).remove()
        .then(() => {
            showToast("Data absensi berhasil dihapus");
        })
        .catch((error) => {
            showToast("Gagal menghapus: " + error.message, "error");
        });
}

function simulateAttendance() {
    const students = dbData.users;
    if(students.length === 0) return showToast("Belum ada siswa di Database!", "error");
    
    // Ambil siswa acak untuk simulasi
    const s = students[Math.floor(Math.random() * students.length)];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
    const dateStr = now.toISOString().split('T')[0];
    
    // Kirim data ke Firebase seolah-olah dari sensor ESP32
    db.ref(`absensi/${dateStr}/${s.id}`).set({
        nama: s.nama, 
        kelas: s.kelas, 
        jurusan: s.jurusan, 
        in: timeStr
    }).then(() => {
        showToast(`Simulasi Scan Berhasil: ${s.nama}`);
    }).catch((err) => {
        showToast("Gagal simulasi: " + err.message, "error");
    });
}

function exportToExcel() {
    // Header CSV
    let csv = "data:text/csv;charset=utf-8,Waktu,Nama,Kelas,Jurusan,Status\n";
    
    // Isi data
    dbData.attendance.forEach(r => {
        csv += `${r.date} ${r.timeIn},${r.nama},${r.kelas},${r.jurusan},${r.status}\n`;
    });
    
    // Trigger download file
    const link = document.createElement("a"); 
    link.href = encodeURI(csv); 
    link.download = "laporan_absensi.csv";
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
}
