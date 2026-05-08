function populateStudentSelectForCode() {
    const select = document.getElementById('selectStudentForCode');
    if (!select) return;
    
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Pilih Siswa --</option>';
    dbData.users.forEach(s => {
        select.innerHTML += `<option value="${s.id}">${s.nama} (ID: ${s.id})</option>`;
    });
    select.value = currentVal;
}

function generateRegistrationCode() {
    const targetType = document.querySelector('input[name="genTarget"]:checked').value;
    const code = 'REG-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    
    const codeData = { used: false, createdAt: firebase.database.ServerValue.TIMESTAMP, type: targetType };

    if (targetType === 'siswa') {
        const selectedId = document.getElementById('selectStudentForCode').value;
        if (!selectedId) {
            showToast("Harap pilih Siswa terlebih dahulu!", "error");
            return;
        }

        const existingUser = dbData.users_auth.find(u => u.fpId == selectedId);
        if (existingUser) {
            showToast(`GAGAL: ID Siswa (${selectedId}) sudah terdaftar pada akun (${existingUser.email}).`, "error");
            return;
        }

        const existingCode = dbData.codes.find(c => c.linkedId == selectedId && !c.used && c.type === 'siswa');
        if (existingCode) {
            showToast(`GAGAL: Siswa ini masih memiliki kode aktif (${existingCode.code}).`, "error");
            return;
        }

        codeData.linkedId = selectedId;
        db.ref('codes/' + code).set(codeData).then(() => {
            const display = document.getElementById('generatedKeyDisplay');
            if (display) {
                display.style.display = 'block';
                display.innerHTML = `Kode: <strong style="color:var(--primary)">${code}</strong><br>Tipe: ${targetType.toUpperCase()}<br>Locked ID: ${selectedId}`;
            }
        });
    } else {
        db.ref('codes/' + code).set(codeData).then(() => {
            const display = document.getElementById('generatedKeyDisplay');
            if (display) {
                display.style.display = 'block';
                display.innerHTML = `Kode: <strong style="color:var(--primary)">${code}</strong><br>Tipe: ${targetType.toUpperCase()}`;
            }
        });
    }
}

function deleteCode(code) {
    if (!confirm("Hapus kode ini?")) return;
    db.ref('codes/' + code).remove();
}

function renderCodesTable() {
    const tbody = document.getElementById('tbody-codes');
    if (!tbody) return;
    tbody.innerHTML = '';
    const sorted = [...dbData.codes].reverse();
    
    sorted.forEach(c => {
        const typeLabel = c.type ? c.type.toUpperCase() : 'UMUM';
        const linkedLabel = c.linkedId ? `<br><small style="color:#888">ID: ${c.linkedId}</small>` : '';
        
        tbody.innerHTML += `
            <tr>
                <td style="font-family:monospace; font-weight:bold; color:var(--secondary);">
                    ${c.code}<br><small style="font-weight:normal; color:#888">${typeLabel}${linkedLabel}</small>
                 </td>
                <td>${c.used ? '<span style="color:var(--success)">Terpakai</span>' : '<span style="color:#888">Aktif</span>'}</td>
                <td>${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-'}</td>
                <td>${c.userId || '-'}</td>
                <td>${!c.used ? `<button class="btn-icon delete" onclick="deleteCode('${c.code}')">❌</button>` : ''}</td>
            </tr>
        `;
    });
}

function updateUserRole(uid, newRole) {
    if (!confirm(`Yakin ingin mengubah role user ini menjadi ${newRole.toUpperCase()}?`)) return;
    db.ref('users_auth/' + uid).update({ role: newRole })
        .then(() => showToast(`Role user berhasil diubah menjadi ${newRole}`))
        .catch((err) => showToast("Gagal mengubah role: " + err.message, "error"));
}

function renderUsersTable() {
    const tbody = document.getElementById('tbody-users');
    if (!tbody) return;
    const search = document.getElementById('searchUser')?.value.toLowerCase() || '';
    tbody.innerHTML = '';

    let data = dbData.users_auth.filter(u => u.nama && u.nama.toLowerCase().includes(search));

    data.forEach(u => {
        const isMe = (currentUser && currentUser.uid === u.uid);
        const avatar = u.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nama)}`;
        
        let roleHtml = '';
        if (currentUser && currentUser.role === 'admin' && !isMe) {
            roleHtml = `<select onchange="updateUserRole('${u.uid}', this.value)" style="background:#2c2c2c; color:white; border:1px solid #444; padding:5px; border-radius:4px;">
                <option value="siswa" ${u.role === 'siswa' ? 'selected' : ''}>Siswa</option>
                <option value="guru" ${u.role === 'guru' ? 'selected' : ''}>Guru</option>
                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>`;
        } else {
            roleHtml = `<span class="role-badge role-${u.role}">${u.role.toUpperCase()}</span>`;
            if (isMe) roleHtml += ` <small style="color:#aaa;">(Anda)</small>`;
        }

        let actions = '-';
        if (currentUser && currentUser.role === 'admin' && !isMe) {
            actions = `<button class="btn-icon delete" onclick="deleteUser('${u.uid}', '${u.nama}')">🗑️</button>`;
        }

        tbody.innerHTML += `
            <tr>
                <td><img src="${avatar}" class="user-avatar-sm"></td>
                <td><strong>${escapeHtml(u.nama)}</strong></td>
                <td>${u.email}</td>
                <td>${roleHtml}</td>
                <td>${u.kelas || '-'} ${u.jurusan ? '/' + u.jurusan : ''}${u.subject ? '<br><small>' + u.subject + '</small>' : ''}</td>
                <td>${actions}</td>
            </tr>
        `;
    });
}

function deleteUser(uid, nama) {
    if (!confirm(`Yakin ingin menghapus user: ${nama}?\n\nUser ini akan kehilangan akses login.`)) return;
    db.ref('users_auth/' + uid).remove()
        .then(() => showToast("User berhasil dihapus dari Database."))
        .catch((err) => showToast("Gagal menghapus: " + err.message, "error"));
}

function resetSystemData() {
    if (confirm("PERINGATAN: Semua data akan dihapus!")) {
        db.ref('users').remove();
        db.ref('absensi').remove();
        db.ref('codes').remove();
        db.ref('users_auth').remove();
        showToast("Data direset");
    }
}

// Override saveStudent yang sudah ada di students.js dengan yang lebih lengkap
window.saveStudent = function() {
    let idStr = document.getElementById('newId').value;
    const nama = document.getElementById('newNama').value;
    const kelas = document.getElementById('newKelas').value.toUpperCase();
    const jurusan = document.getElementById('newJurusan').value.toUpperCase();
    const delay = document.getElementById('newDelay').value;
    const mode = document.getElementById('editMode').value;

    if (!nama || !idStr) return showToast("ID & Nama wajib!", "error");
    
    const studentData = { nama, kelas, jurusan, delayOut: parseInt(delay) };
    const path = `users/${idStr}`;

    if (mode === 'add' && dbData.users.find(u => u.id == idStr)) return showToast("ID sudah ada!", "error");

    db.ref(path).set(studentData).then(() => {
        showToast("Data Tersimpan di Database (FP)");
        const registeredUser = dbData.users_auth.find(u => u.fpId == idStr);
        if (registeredUser) {
            db.ref(`users_auth/${registeredUser.uid}`).update({ nama: nama, kelas: kelas, jurusan: jurusan })
                .then(() => showToast("Data Profil Siswa Diperbarui (Sinkronisasi)"));
        }
        resetStudentForm();
        renderStudentsTable();
    });
};