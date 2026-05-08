function initApp() {
    if (!currentUser) {
        document.getElementById('auth-section').style.display = 'flex';
        document.getElementById('dashboard-section').style.display = 'none';
        return;
    }
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';

    document.getElementById('userProfileDisplay').textContent = currentUser.nama;
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('userRoleDisplay').textContent = currentUser.role.toUpperCase();
    document.getElementById('userRoleDisplay').className = `role-badge role-${currentUser.role}`;

    const photo = currentUser.photoUrl || "https://ui-avatars.com/api/?name=User";
    document.getElementById('headerAvatar').src = photo;
    document.getElementById('profileImg').src = photo;

    applyRolePermissions();
    populateFilters();
    setInterval(updateClock, 1000);
    updateClock();
    
    if (typeof initSystemConfig === 'function') initSystemConfig();
    
    renderTable();
    renderStudentsTable();
    renderCodesTable();
    renderUsersTable();
    if (typeof renderClassmatesTable === 'function') renderClassmatesTable();
    
    switchTab('attendance');
}

function applyRolePermissions() {
    const role = currentUser.role;
    document.querySelectorAll('.role-admin').forEach(el => el.style.display = role === 'admin' ? '' : 'none');
    document.querySelectorAll('.role-guru').forEach(el => el.style.display = (role === 'guru' || role === 'admin') ? '' : 'none');
    document.querySelectorAll('.role-siswa').forEach(el => el.style.display = role === 'siswa' ? '' : 'none');
}

function updateClock() {
    const clock = document.getElementById('clock');
    if (clock) clock.textContent = new Date().toLocaleTimeString('id-ID');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    const tab = document.getElementById(`tab-${tabId}`);
    if (tab) tab.classList.add('active');
    
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => 
        b.getAttribute('onclick') && b.getAttribute('onclick').includes(tabId)
    );
    if (btn) btn.classList.add('active');
    
    if (tabId === 'classmates' && typeof renderClassmatesTable === 'function') {
        renderClassmatesTable();
    }
}

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.borderLeftColor = type === 'error' ? 'var(--danger)' : 'var(--primary)';
    t.className = "toast show";
    setTimeout(() => { t.className = t.className.replace("show", ""); }, 3000);
}

function populateFilters() {
    const classes = [...new Set(dbData.users.map(s => s.kelas))].sort();
    const majors = [...new Set(dbData.users.map(s => s.jurusan))].sort();
    const kelasSelect = document.getElementById('filterKelas');
    const jurusanSelect = document.getElementById('filterJurusan');
    if (kelasSelect) kelasSelect.innerHTML = '<option value="all">Semua</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
    if (jurusanSelect) jurusanSelect.innerHTML = '<option value="all">Semua</option>' + majors.map(j => `<option value="${j}">${j}</option>`).join('');
}

function openProfileModal() {
    const modal = document.getElementById('modal-profile');
    if (!modal) return;
    modal.classList.add('open');
    if (currentUser) {
        document.getElementById('profileImg').src = currentUser.photoUrl;
        document.getElementById('profileNameInput').value = currentUser.nama || "";
        document.getElementById('profileEmail').textContent = currentUser.email;
        document.getElementById('profileKelas').value = currentUser.kelas || "";
        document.getElementById('profileJurusan').value = currentUser.jurusan || "";
        document.getElementById('profileSubject').value = currentUser.subject || "";

        const nameInput = document.getElementById('profileNameInput');
        const kelasInput = document.getElementById('profileKelas');
        const jurusanInput = document.getElementById('profileJurusan');
        const subjectGroup = document.getElementById('group-subject');
        const saveBtn = document.querySelector('#modal-profile .btn-save');

        if (currentUser.role === 'siswa') {
            nameInput.readOnly = true; nameInput.style.border = "none"; nameInput.style.background = "transparent";
            kelasInput.readOnly = true; kelasInput.style.border = "none"; kelasInput.style.background = "transparent";
            jurusanInput.readOnly = true; jurusanInput.style.border = "none"; jurusanInput.style.background = "transparent";
            if (subjectGroup) subjectGroup.style.display = 'none';
            if (saveBtn) saveBtn.style.display = 'none';
        } else {
            nameInput.readOnly = false; nameInput.style.border = "1px solid var(--border)"; nameInput.style.background = "#2c2c2c";
            kelasInput.readOnly = false; kelasInput.style.border = "1px solid var(--border)"; kelasInput.style.background = "#2c2c2c";
            jurusanInput.readOnly = false; jurusanInput.style.border = "1px solid var(--border)"; jurusanInput.style.background = "#2c2c2c";
            if (subjectGroup) subjectGroup.style.display = 'block';
            if (saveBtn) saveBtn.style.display = 'block';
        }
    }
}

function openForgotPasswordModal() {
    const modal = document.getElementById('modal-forgot');
    if (modal) modal.classList.add('open');
    const emailInput = document.getElementById('forgotEmail');
    if (emailInput) emailInput.value = "";
}

function openChangePasswordModal() {
    const modal = document.getElementById('modal-change-pass');
    if (modal) modal.classList.add('open');
    const inputs = ['cpOld', 'cpNew', 'cpConfirm'];
    inputs.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
}

function handleUpdateProfileInfo() {
    if (!currentUser) return;
    if (currentUser.role === 'siswa') {
        showToast("Siswa tidak dapat mengubah data profil. Hubungi Admin/Guru.", "error");
        return;
    }

    const newNama = document.getElementById('profileNameInput').value;
    const newKelas = document.getElementById('profileKelas').value.toUpperCase();
    const newJurusan = document.getElementById('profileJurusan').value;
    const newSubject = document.getElementById('profileSubject').value;

    if (!newNama) return showToast("Nama wajib diisi!", "error");

    const btn = document.querySelector('#modal-profile .btn-save');
    if (btn) {
        const originalText = btn.innerText;
        btn.innerText = "Menyimpan...";
        btn.disabled = true;

        const updateData = { nama: newNama, kelas: newKelas, jurusan: newJurusan, subject: newSubject };

        db.ref(`users_auth/${currentUser.uid}`).update(updateData)
            .then(() => {
                currentUser.nama = newNama;
                currentUser.kelas = newKelas;
                currentUser.jurusan = newJurusan;
                currentUser.subject = newSubject;
                showToast("Profil berhasil diperbarui");
                document.getElementById('userProfileDisplay').textContent = newNama;
                
                if (currentUser.role === 'siswa' && currentUser.fpId) {
                    db.ref(`users/${currentUser.fpId}`).update({ nama: newNama, kelas: newKelas, jurusan: newJurusan });
                }
                closeModal('modal-profile');
                if (typeof populateFilters === 'function') populateFilters();
                if (typeof renderClassmatesTable === 'function') renderClassmatesTable();
            })
            .catch((err) => showToast("Gagal update: " + err.message, "error"))
            .finally(() => { btn.innerText = originalText; btn.disabled = false; });
    }
}

function handleChangePassword(e) {
    e.preventDefault();
    const newPass = document.getElementById('cpNew').value;
    const confirmPass = document.getElementById('cpConfirm').value;
    
    if (newPass !== confirmPass) {
        showToast("Password baru dan konfirmasi tidak cocok!", "error");
        return;
    }
    if (newPass.length < 6) {
        showToast("Password baru minimal 6 karakter!", "error");
        return;
    }
    
    auth.currentUser.updatePassword(newPass)
        .then(() => { showToast("Password berhasil diubah"); closeModal('modal-change-pass'); })
        .catch((err) => {
            if (err.code === 'auth/requires-recent-login') showToast("Logout dan login kembali untuk ubah password.", "error");
            else if (err.code === 'auth/wrong-password') showToast("Password lama salah!", "error");
            else showToast(err.message, "error");
        });
}

async function uploadProfilePhoto(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (!file.type.match('image.*')) return showToast("Hanya gambar!", "error");
        
        const formData = new FormData();
        formData.append("image", file);
        const imgEl = document.getElementById('profileImg');
        const originalSrc = imgEl.src;
        imgEl.style.opacity = "0.5";
        showToast("Mengunggah ke ImgBB...", "neutral");

        try {
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: formData });
            const data = await res.json();
            if (data.success) {
                const urlProxy = `https://wsrv.nl/?url=${encodeURIComponent(data.data.image.url)}`;
                await db.ref(`users_auth/${currentUser.uid}`).update({ photoUrl: urlProxy });
                currentUser.photoUrl = urlProxy;
                document.getElementById('headerAvatar').src = urlProxy;
                imgEl.src = urlProxy;
                showToast("Foto diperbarui!");
            } else {
                showToast("Gagal upload", "error");
                imgEl.src = originalSrc;
            }
        } catch (e) {
            showToast("Koneksi Error", "error");
            imgEl.src = originalSrc;
        } finally {
            imgEl.style.opacity = "1";
            input.value = "";
        }
    }
}

function processForgot() {
    const email = document.getElementById('forgotEmail').value;
    if (!email) {
        showToast("Masukkan email terlebih dahulu!", "error");
        return;
    }
    const btn = document.querySelector('#modal-forgot .btn-save');
    if (btn) { btn.innerText = "Mengirim..."; btn.disabled = true; }
    
    auth.sendPasswordResetEmail(email)
        .then(() => { showToast("Link reset password telah dikirim ke " + email); closeModal('modal-forgot'); })
        .catch((error) => { showToast("Gagal mengirim: " + error.message, "error"); })
        .finally(() => { if (btn) { btn.innerText = "Kirim Link"; btn.disabled = false; } });
}

function toggleRegisterInput() {
    const type = document.querySelector('input[name="regRoleType"]:checked').value;
    const idGroup = document.getElementById('group-reg-id');
    const namaGroup = document.getElementById('group-reg-nama');
    const subjectGroup = document.getElementById('group-reg-subject');
    const codeInput = document.getElementById('regCode');

    if (type === 'siswa') {
        if (idGroup) idGroup.style.display = 'block';
        if (namaGroup) namaGroup.style.display = 'none';
        if (subjectGroup) subjectGroup.style.display = 'none';
        if (codeInput) codeInput.placeholder = "Kode Unik (Siswa)";
    } else {
        if (idGroup) idGroup.style.display = 'none';
        if (namaGroup) namaGroup.style.display = 'block';
        if (subjectGroup) subjectGroup.style.display = 'block';
        if (codeInput) codeInput.placeholder = "Kode Unik (Guru)";
    }
}

function toggleGenerateInput() {
    const type = document.querySelector('input[name="genTarget"]:checked').value;
    const selectGroup = document.getElementById('group-select-siswa');
    const desc = document.getElementById('gen-desc');
    if (type === 'siswa') {
        if (selectGroup) selectGroup.style.display = 'block';
        if (desc) desc.innerText = "Kode akan dikunci ke ID Siswa terpilih.";
    } else {
        if (selectGroup) selectGroup.style.display = 'none';
        if (desc) desc.innerText = "Kode bebas digunakan oleh Guru mana saja.";
    }
}

function saveSchoolName() {
    if (!currentUser) return;
    const newSchoolName = document.getElementById('inputSchoolName').value.trim();
    if (!newSchoolName) return showToast("Nama sekolah tidak boleh kosong!", "error");
    if (currentUser.role !== 'admin') return showToast("Hanya Admin yang bisa mengubah nama sekolah.", "error");
    
    db.ref('system_config/schoolName').set(newSchoolName)
        .then(() => showToast("Nama sekolah berhasil diperbarui"))
        .catch((err) => showToast("Gagal update: " + err.message, "error"));
}

function initSystemConfig() {
    db.ref('system_config/schoolName').on('value', (snapshot) => {
        const name = snapshot.val();
        const display = name || "Sistem Absensi";
        const headerTitle = document.getElementById('schoolNameDisplay');
        if (headerTitle) headerTitle.textContent = display;
        const inputField = document.getElementById('inputSchoolName');
        if (inputField) inputField.value = name || "";
    });
}