function generateRegistrationCode() {
    const code = 'REG-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    db.ref('codes/' + code).set({
        used: false, createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        document.getElementById('generatedKeyDisplay').style.display = 'block';
        document.getElementById('generatedKeyDisplay').textContent = `Kode: ${code}`;
    });
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
        tbody.innerHTML += `
            <tr>
                <td style="font-family:monospace; font-weight:bold; color:var(--secondary);">${c.code}</td>
                <td>${c.used ? '<span style="color:var(--success)">Terpakai</span>' : '<span style="color:#888">Aktif</span>'}</td>
                <td>${new Date(c.createdAt).toLocaleDateString()}</td>
                <td>${c.userId || '-'}</td>
                <td>${!c.used ? `<button class="btn-icon delete" onclick="deleteCode('${c.code}')">❌</button>` : ''}</td>
            </tr>`;
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
        
        // LOGIKA: Hanya Admin yang bisa melihat tombol hapus, dan tidak bisa hapus diri sendiri
        let actions = isMe ? '<span class="text-small">(Anda)</span>' : '-';
        
        if (currentUser && currentUser.role === 'admin' && !isMe) {
            actions = `
                <button class="btn-icon delete" onclick="deleteUser('${u.uid}', '${u.nama}')" title="Hapus User">🗑</button>
            `;
        }

        tbody.innerHTML += `
            <tr>
                <td><img src="${avatar}" class="user-avatar-sm"></td>
                <td><strong>${u.nama}</strong></td>
                <td>${u.email}</td>
                <td><span class="role-badge role-${u.role}">${u.role.toUpperCase()}</span></td>
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