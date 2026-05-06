// Fungsi untuk mengisi Dropdown Siswa pada Tab Users (Generate Code)
// Pastikan fungsi ini dipanggil di db.js saat data users berubah
function populateStudentSelectForCode() {
    const select = document.getElementById('selectStudentForCode');
    if(!select) return;
    
    // Simpan nilai yang sedang dipilih agar tidak reset saat update data
    const currentVal = select.value; 

    select.innerHTML = '<option value="">-- Pilih Siswa --</option>';
    
    // Ambil data siswa dari dbData.users
    dbData.users.forEach(s => {
        select.innerHTML += `<option value="${s.id}">${s.nama} (ID: ${s.id})</option>`;
    });

    select.value = currentVal; // Kembalikan pilihan sebelumnya jika ada
}

// UPDATE FUNGSI GENERATE KODE (DITAMBAH CEK DUPLIKASI AKUN)
function generateRegistrationCode() {
    const targetType = document.querySelector('input[name="genTarget"]:checked').value;
    const code = 'REG-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    
    const codeData = {
        used: false, 
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        type: targetType // 'siswa' atau 'guru'
    };

    // 1. CEK JIKA TARGET ADALAH SISWA
    if (targetType === 'siswa') {
        const selectedId = document.getElementById('selectStudentForCode').value;
        if (!selectedId) {
            showToast("Harap pilih Siswa terlebih dahulu!", "error");
            return;
        }

        // 2. CEK DUPLIKASI 1: SUDAH TERDAFTAR SEBAGAI USER?
        // Kita cari di dbData.users_auth apakah ada user yang memiliki fpId sama
        const existingUser = dbData.users_auth.find(u => u.fpId == selectedId);
        
        if (existingUser) {
            showToast(`GAGAL: ID Siswa (${selectedId}) sudah terdaftar pada akun (${existingUser.email}). Tidak bisa generate ulang.`, "error");
            return;
        }

        // 3. CEK DUPLIKASI 2: MASIH PUNYA KODE AKTIF?
        const existingCode = dbData.codes.find(c => 
            c.linkedId == selectedId &&   // ID Siswa sama
            !c.used &&                   // Kode belum dipakai
            c.type === 'siswa'           // Tipe siswa
        );

        if (existingCode) {
            showToast(`GAGAL: Siswa ini masih memiliki kode aktif (${existingCode.code}). Tunggu sampai expired!`, "error");
            return;
        }

        // 4. SIMPAN KODE BARU (JIKA LULUS SEMUA CEK)
        codeData.linkedId = selectedId;

        db.ref('codes/' + code).set(codeData).then(() => {
            const display = document.getElementById('generatedKeyDisplay');
            display.style.display = 'block';
            display.innerHTML = `
                Kode: <strong style="color:var(--primary)">${code}</strong><br>
                Tipe: ${targetType.toUpperCase()}<br>
                Locked ID: ${selectedId}
            `;
        });

    } else {
        // 5. JIKA GURU (Generate Bebas)
        const codeData = {
            used: false, 
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            type: targetType // 'guru'
        };

        db.ref('codes/' + code).set(codeData).then(() => {
            const display = document.getElementById('generatedKeyDisplay');
            display.style.display = 'block';
            display.innerHTML = `
                Kode: <strong style="color:var(--primary)">${code}</strong><br>
                Tipe: ${targetType.toUpperCase()}
            `;
        });
    }
}

function deleteCode(code) {
    if(!confirm("Hapus kode ini?")) return;
    db.ref('codes/' + code).remove();
}

function renderCodesTable() {
    const tbody = document.getElementById('tbody-codes');
    tbody.innerHTML = '';
    const sorted = [...dbData.codes].reverse();
    
    sorted.forEach(c => {
        const typeLabel = c.type ? c.type.toUpperCase() : 'UMUM';
        const linkedLabel = c.linkedId ? `<br><small style="color:#888">ID: ${c.linkedId}</small>` : '';
        
        tbody.innerHTML += `
            <tr>
                <td style="font-family:monospace; font-weight:bold; color:var(--secondary);">
                    ${c.code} <br>
                    <small style="font-weight:normal; color:#888">${typeLabel}${linkedLabel}</small>
                </td>
                <td>${c.used ? '<span style="color:var(--success)">Terpakai</span>' : '<span style="color:#888">Aktif</span>'}</td>
                <td>${new Date(c.createdAt).toLocaleDateString()}</td>
                <td>${c.userId || '-'}</td>
                <td>${!c.used ? `<button class="btn-icon delete" onclick="deleteCode('${c.code}')">❌</button>` : ''}</td>
            </tr>`;
    });
}

// --- FUNGSI BARU: UBAH ROLE USER ---
function updateUserRole(uid, newRole) {
    if(!confirm(`Yakin ingin mengubah role user ini menjadi ${newRole.toUpperCase()}?`)) return;
    
    db.ref('users_auth/' + uid).update({
        role: newRole
    }).then(() => {
        showToast(`Role user berhasil diubah menjadi ${newRole}`);
        // Data akan otomatis terupdate di tabel jika menggunakan listener .on('value')
    }).catch((err) => {
        showToast("Gagal mengubah role: " + err.message, "error");
    });
}

function renderUsersTable() {
    const tbody = document.getElementById('tbody-users');
    const search = document.getElementById('searchUser').value.toLowerCase();
    tbody.innerHTML = '';

    // Filter data
    let data = dbData.users_auth.filter(u => 
        u.nama && u.nama.toLowerCase().includes(search)
    );

    data.forEach(u => {
        const isMe = (currentUser && currentUser.uid === u.uid);
        const avatar = u.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nama)}`;
        
        // --- LOGIKA TAMBAHAN: TAMPILKAN DROPDOWN ROLE ---
        let roleHtml = '';

        // Jika yang login adalah ADMIN DAN bukan dirinya sendiri
        if (currentUser && currentUser.role === 'admin' && !isMe) {
            roleHtml = `
                <select class="form-control" onchange="updateUserRole('${u.uid}', this.value)" 
                        style="background:#2c2c2c; color:white; border:1px solid #444; padding:5px; border-radius:4px; font-size:0.9rem;">
                    <option value="siswa" ${u.role === 'siswa' ? 'selected' : ''}>Siswa</option>
                    <option value="guru" ${u.role === 'guru' ? 'selected' : ''}>Guru</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            `;
        } else {
            // Jika Bukan Admin, atau Edit Diri Sendiri -> Tampilkan Badge Biasa
            roleHtml = `<span class="role-badge role-${u.role}">${u.role.toUpperCase()}</span>`;
            if (isMe) roleHtml += ` <small style="color:#aaa;">(Anda)</small>`;
        }
        // -----------------------------------------------

        // LOGIKA TOMBOL HAPUS
        let actions = isMe ? '-' : '-';
        
        if (currentUser && currentUser.role === 'admin' && !isMe) {
            actions = `
                <button class="btn-icon delete" onclick="deleteUser('${u.uid}', '${u.nama}')" title="Hapus User">🗑️</button>
            `;
        }

        tbody.innerHTML += `
            <tr>
                <td><img src="${avatar}" class="user-avatar-sm"></td>
                <td><strong>${u.nama}</strong></td>
                <td>${u.email}</td>
                <!-- Kolom Role: Bisa Dropdown atau Badge -->
                <td>${roleHtml}</td>
                <td>${u.kelas || '-'}</td>
                <td>${actions}</td>
            </tr>`;
    });
}

function deleteUser(uid, nama) {
    if(!confirm(`Yakin ingin menghapus user: ${nama}?\n\nUser ini akan kehilangan akses login.`)) return;
    
    // Hapus data dari Database Firebase (users_auth)
    db.ref('users_auth/' + uid).remove()
        .then(() => {
            showToast("User berhasil dihapus dari Database.");
            
            // Catatan:
            // 1. Akun Auth (Email/Password) tidak bisa dihapus dari Client JS.
            //    Namun, karena data DB dihapus, user ini tidak akan bisa login kembali
            //    (Logic ada di main.js).
            // 2. Jika user sedang login di browser lain, mereka akan otomatis logout
            //    karena listener main.js akan mendeteksi data DB sudah hilang.
        })
        .catch((err) => {
            showToast("Gagal menghapus: " + err.message, "error");
        });
}

function resetSystemData() {
    if(confirm("PERINGATAN: Semua data akan dihapus!")) {
        db.ref('users').remove();
        db.ref('absensi').remove();
        db.ref('codes').remove();
        db.ref('users_auth').remove();
        showToast("Data direset");
    }
}