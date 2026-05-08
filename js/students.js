// FILE: students.js
// Fungsi untuk mengelola data siswa (Fingerprint)

// ==================== FILTER & DROPDOWN ====================
function populateStudentFilters() {
    const classes = [...new Set(dbData.users.map(s => s.kelas))].sort();
    const majors = [...new Set(dbData.users.map(s => s.jurusan))].sort();

    const kSelect = document.getElementById('filterStudentKelas');
    const jSelect = document.getElementById('filterStudentJurusan');

    if (kSelect) kSelect.innerHTML = '<option value="all">Semua</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
    if (jSelect) jSelect.innerHTML = '<option value="all">Semua</option>' + majors.map(j => `<option value="${j}">${j}</option>`).join('');
}

// ==================== RESET FILTER ====================
function resetStudentFilters() {
    const kelasSelect = document.getElementById('filterStudentKelas');
    const jurusanSelect = document.getElementById('filterStudentJurusan');
    const searchInput = document.getElementById('searchStudentName');
    
    if (kelasSelect) kelasSelect.value = 'all';
    if (jurusanSelect) jurusanSelect.value = 'all';
    if (searchInput) searchInput.value = '';
    
    renderStudentsTable();
    showToast("🔄 Filter telah direset", "success");
}

// ==================== RENDER TABEL SISWA ====================
function renderStudentsTable() {
    const tbody = document.getElementById('tbody-students');
    if (!tbody) return;
    
    const search = document.getElementById('searchStudentName')?.value.toLowerCase() || '';
    const fKelas = document.getElementById('filterStudentKelas')?.value || 'all';
    const fJurusan = document.getElementById('filterStudentJurusan')?.value || 'all';

    let data = dbData.users.filter(u => u.nama && u.nama.toLowerCase().includes(search));
    if (fKelas !== 'all') data = data.filter(u => u.kelas === fKelas);
    if (fJurusan !== 'all') data = data.filter(u => u.jurusan === fJurusan);

    tbody.innerHTML = '';
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">📭 Data siswa tidak ditemukan.</td></tr>';
        return;
    }

    data.forEach(s => {
        tbody.innerHTML += `
            <tr>
                <td>${s.id}</td>
                <td>${escapeHtml(s.nama)}</td>
                <td>${s.kelas || '-'}</td>
                <td>${s.jurusan || '-'}</td>
                <td>${s.delayOut || '60'}</td>
                <td>
                    <button class="btn-icon edit" onclick="editStudent('${s.id}')" title="Edit">✎</button>
                    <button class="btn-icon delete" onclick="deleteStudent('${s.id}')" title="Hapus">🗑</button>
                </td>
            </tr>
        `;
    });
}

// ==================== TAMBAH / UPDATE SISWA ====================
function saveStudent() {
    let idStr = document.getElementById('newId').value;
    const nama = document.getElementById('newNama').value;
    const kelas = document.getElementById('newKelas').value.toUpperCase();
    const jurusan = document.getElementById('newJurusan').value.toUpperCase();
    const delay = document.getElementById('newDelay').value;
    const mode = document.getElementById('editMode').value;

    if (!nama || !idStr) return showToast("⚠️ ID & Nama wajib diisi!", "error");
    
    const studentData = { nama, kelas, jurusan, delayOut: parseInt(delay) };
    const path = `users/${idStr}`;

    if (mode === 'add' && dbData.users.find(u => u.id == idStr)) {
        return showToast("❌ ID sudah ada! Gunakan ID yang berbeda.", "error");
    }

    const btn = document.getElementById('btnSaveStudent');
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ Menyimpan...";
    btn.disabled = true;

    db.ref(path).set(studentData)
        .then(() => {
            showToast("✅ Data Tersimpan di Firebase");
            resetStudentForm();
            renderStudentsTable();
            if (typeof populateFilters === 'function') populateFilters();
            if (typeof populateStudentFilters === 'function') populateStudentFilters();
            if (typeof renderClassmatesTable === 'function') renderClassmatesTable();
            if (typeof populateStudentSelectForCode === 'function') populateStudentSelectForCode();
        })
        .catch(err => {
            showToast("❌ Gagal menyimpan: " + err.message, "error");
        })
        .finally(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
}

// ==================== HAPUS SISWA (SATU PER SATU) ====================
function deleteStudent(id) {
    // Cek role: hanya Admin dan Guru yang bisa
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'guru')) {
        showToast("⛔ Akses Ditolak! Hanya Admin dan Guru yang dapat menghapus data.", "error");
        return;
    }
    
    const siswa = dbData.users.find(u => u.id == id);
    if (!siswa) return;
    
    if (confirm(`⚠️ Hapus data siswa "${siswa.nama}" (ID: ${id})?\n\nData absensi terkait juga akan terhapus.\n\nTindakan ini tidak dapat dibatalkan!`)) {
        db.ref(`users/${id}`).remove()
            .then(() => {
                showToast(`✅ Siswa "${siswa.nama}" berhasil dihapus`);
                renderStudentsTable();
                if (typeof renderClassmatesTable === 'function') renderClassmatesTable();
                if (typeof populateFilters === 'function') populateFilters();
                if (typeof populateStudentFilters === 'function') populateStudentFilters();
                if (typeof populateStudentSelectForCode === 'function') populateStudentSelectForCode();
            })
            .catch(err => {
                showToast("❌ Gagal menghapus: " + err.message, "error");
            });
    }
}

// ==================== HAPUS SEMUA SISWA ====================
function deleteAllStudents() {
    // Cek role: hanya Admin dan Guru yang bisa
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'guru')) {
        showToast("⛔ Akses Ditolak! Hanya Admin dan Guru yang dapat menghapus semua data.", "error");
        return;
    }
    
    const totalStudents = dbData.users.length;
    
    if (totalStudents === 0) {
        showToast("📭 Tidak ada data siswa untuk dihapus.", "error");
        return;
    }
    
    if (confirm(`⚠️ PERINGATAN!\n\nAnda akan menghapus SEMUA data siswa (${totalStudents} data).\n\nData yang akan dihapus:\n- Semua data fingerprint siswa\n- Data absensi yang terkait\n\n⚠️ TINDAKAN INI TIDAK DAPAT DIURUNGKAN!\n\nApakah Anda yakin?`)) {
        
        const confirmation = prompt("🔴 KONFIRMASI AKHIR!\n\nKetik HAPUS untuk melanjutkan:");
        if (confirmation === "HAPUS") {
            showToast("🔄 Menghapus semua data siswa...", "neutral");
            
            db.ref('users').remove()
                .then(() => {
                    showToast(`✅ Berhasil menghapus ${totalStudents} data siswa!`);
                    renderStudentsTable();
                    if (typeof renderClassmatesTable === 'function') renderClassmatesTable();
                    if (typeof populateFilters === 'function') populateFilters();
                    if (typeof populateStudentFilters === 'function') populateStudentFilters();
                    if (typeof populateStudentSelectForCode === 'function') populateStudentSelectForCode();
                })
                .catch((error) => {
                    showToast("❌ Gagal menghapus data: " + error.message, "error");
                });
        } else {
            showToast("❌ Penghapusan dibatalkan. Ketik 'HAPUS' untuk konfirmasi.", "error");
        }
    }
}

// ==================== HAPUS SISWA SESUAI FILTER ====================
function deleteFilteredStudents() {
    // Cek role: hanya Admin dan Guru yang bisa
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'guru')) {
        showToast("⛔ Akses Ditolak! Hanya Admin dan Guru yang dapat menghapus data.", "error");
        return;
    }
    
    // Ambil data yang sedang difilter
    const search = document.getElementById('searchStudentName')?.value.toLowerCase() || '';
    const fKelas = document.getElementById('filterStudentKelas')?.value || 'all';
    const fJurusan = document.getElementById('filterStudentJurusan')?.value || 'all';
    
    let filteredData = dbData.users.filter(u => u.nama && u.nama.toLowerCase().includes(search));
    if (fKelas !== 'all') filteredData = filteredData.filter(u => u.kelas === fKelas);
    if (fJurusan !== 'all') filteredData = filteredData.filter(u => u.jurusan === fJurusan);
    
    const totalFiltered = filteredData.length;
    
    if (totalFiltered === 0) {
        showToast("📭 Tidak ada data siswa sesuai filter untuk dihapus.", "error");
        return;
    }
    
    // Tampilkan info filter yang aktif
    let filterInfo = [];
    if (fKelas !== 'all') filterInfo.push(`Kelas: ${fKelas}`);
    if (fJurusan !== 'all') filterInfo.push(`Jurusan: ${fJurusan}`);
    if (search) filterInfo.push(`Carian: "${search}"`);
    const filterText = filterInfo.length > 0 ? ` (Filter: ${filterInfo.join(', ')})` : '';
    
    if (confirm(`⚠️ PERINGATAN!\n\nAnda akan menghapus ${totalFiltered} data siswa${filterText}.\n\nData absensi terkait juga akan terhapus.\n\n⚠️ TINDAKAN INI TIDAK DAPAT DIURUNGKAN!\n\nApakah Anda yakin?`)) {
        
        const confirmation = prompt("🔴 KONFIRMASI AKHIR!\n\nKetik HAPUS untuk melanjutkan:");
        if (confirmation === "HAPUS") {
            showToast(`🔄 Menghapus ${totalFiltered} data siswa...`, "neutral");
            
            let deletedCount = 0;
            let promises = [];
            
            filteredData.forEach(siswa => {
                promises.push(db.ref(`users/${siswa.id}`).remove());
            });
            
            Promise.all(promises)
                .then(() => {
                    showToast(`✅ Berhasil menghapus ${totalFiltered} data siswa!`);
                    renderStudentsTable();
                    if (typeof renderClassmatesTable === 'function') renderClassmatesTable();
                    if (typeof populateFilters === 'function') populateFilters();
                    if (typeof populateStudentFilters === 'function') populateStudentFilters();
                    if (typeof populateStudentSelectForCode === 'function') populateStudentSelectForCode();
                })
                .catch((error) => {
                    showToast("❌ Gagal menghapus sebagian data: " + error.message, "error");
                });
        } else {
            showToast("❌ Penghapusan dibatalkan. Ketik 'HAPUS' untuk konfirmasi.", "error");
        }
    }
}

// ==================== EDIT SISWA ====================
function editStudent(id) {
    const s = dbData.users.find(u => u.id == id);
    if (s) {
        document.getElementById('newId').value = s.id;
        document.getElementById('newId').disabled = true;
        document.getElementById('newNama').value = s.nama;
        document.getElementById('newKelas').value = s.kelas || '';
        document.getElementById('newJurusan').value = s.jurusan || '';
        document.getElementById('newDelay').value = s.delayOut || 60;
        document.getElementById('editMode').value = 'edit';
        document.getElementById('btnSaveStudent').innerHTML = '💾 Update Siswa';
        document.getElementById('btnCancelStudent').classList.remove('hidden');
        
        // Scroll ke form
        document.querySelector('#tab-students .controls-bar').scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast(`✏️ Edit data siswa: ${s.nama}`, "info");
    }
}

// ==================== RESET FORM ====================
function resetStudentForm() {
    document.getElementById('newId').value = '';
    document.getElementById('newId').disabled = false;
    document.getElementById('newNama').value = '';
    document.getElementById('newKelas').value = '';
    document.getElementById('newJurusan').value = '';
    document.getElementById('newDelay').value = '60';
    document.getElementById('editMode').value = 'add';
    document.getElementById('btnSaveStudent').innerHTML = '➕ Simpan Siswa';
    document.getElementById('btnCancelStudent').classList.add('hidden');
}

// ==================== FITUR TEMAN SEKELAS (SISWA) ====================
function renderClassmatesTable() {
    const tbody = document.getElementById('tbody-classmates');
    if (!tbody) return;

    // Hanya untuk role siswa
    if (!currentUser || currentUser.role !== 'siswa') {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">👥 Fitur ini hanya untuk siswa.</td></tr>';
        return;
    }

    // Validasi data kelas & jurusan
    if (!currentUser.kelas || !currentUser.jurusan) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:orange;">⚠️ Data kelas/jurusan Anda belum lengkap. Silakan isi di menu Profil Saya.</td></tr>';
        return;
    }

    // Filter teman sekelas (kelas & jurusan sama)
    let classmates = dbData.users.filter(s => 
        s.kelas === currentUser.kelas && 
        s.jurusan === currentUser.jurusan &&
        s.nama && s.nama.trim() !== ''
    );

    // Pencarian
    const searchInput = document.getElementById('searchClassmate');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    if (searchTerm) {
        classmates = classmates.filter(s => s.nama && s.nama.toLowerCase().includes(searchTerm));
    }

    // Urutkan berdasarkan nama
    classmates.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));

    // Ambil absensi hari ini
    const todayStr = new Date().toISOString().split('T')[0];
    const todayAttendance = dbData.attendance.filter(a => a.date === todayStr);

    tbody.innerHTML = '';
    
    if (classmates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">👥 Tidak ada teman sekelas yang ditemukan.</td></tr>';
        return;
    }

    let no = 1;
    classmates.forEach(siswa => {
        const hasAttended = todayAttendance.some(a => a.studentId == siswa.id);
        const statusBadge = hasAttended 
            ? '<span style="color:var(--success);">● Hadir</span>' 
            : '<span style="color:#888;">● Belum Absen</span>';
        
        const isMe = (currentUser.fpId && currentUser.fpId == siswa.id);
        const nameDisplay = isMe ? `<strong>${escapeHtml(siswa.nama)}</strong> <small style="color:var(--primary);">(Anda)</small>` : escapeHtml(siswa.nama);
        
        tbody.innerHTML += `
            <tr>
                <td>${no++}</td>
                <td>${nameDisplay}</td>
                <td>${siswa.kelas || '-'}</td>
                <td>${siswa.jurusan || '-'}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });
}

// ==================== FUNGSI SINKRONISASI (DARI USERS.JS) ====================
// Override fungsi saveStudent dari users.js agar sinkron
window.saveStudent = function() {
    let idStr = document.getElementById('newId').value;
    const nama = document.getElementById('newNama').value;
    const kelas = document.getElementById('newKelas').value.toUpperCase();
    const jurusan = document.getElementById('newJurusan').value.toUpperCase();
    const delay = document.getElementById('newDelay').value;
    const mode = document.getElementById('editMode').value;

    if (!nama || !idStr) return showToast("⚠️ ID & Nama wajib!", "error");
    
    const studentData = { nama, kelas, jurusan, delayOut: parseInt(delay) };
    const path = `users/${idStr}`;

    if (mode === 'add' && dbData.users.find(u => u.id == idStr)) return showToast("❌ ID sudah ada!", "error");

    const btn = document.getElementById('btnSaveStudent');
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ Menyimpan...";
    btn.disabled = true;

    db.ref(path).set(studentData).then(() => {
        showToast("✅ Data Tersimpan di Database (FP)");
        
        // Sinkronisasi ke users_auth jika siswa sudah punya akun
        const registeredUser = dbData.users_auth.find(u => u.fpId == idStr);
        if (registeredUser) {
            db.ref(`users_auth/${registeredUser.uid}`).update({
                nama: nama,
                kelas: kelas,
                jurusan: jurusan
            }).then(() => {
                showToast("✅ Data Profil Siswa Diperbarui (Sinkronisasi)");
            });
        }
        
        resetStudentForm();
        renderStudentsTable();
        if (typeof populateFilters === 'function') populateFilters();
        if (typeof populateStudentFilters === 'function') populateStudentFilters();
        if (typeof renderClassmatesTable === 'function') renderClassmatesTable();
        if (typeof populateStudentSelectForCode === 'function') populateStudentSelectForCode();
    }).catch(err => {
        showToast("❌ Gagal menyimpan: " + err.message, "error");
    }).finally(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
};

// ==================== ESCAPE HTML (XSS PROTECTION) ====================
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}