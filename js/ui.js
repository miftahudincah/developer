function initApp() {
    if (!currentUser) {
        document.getElementById('auth-section').style.display = 'flex';
        document.getElementById('dashboard-section').style.display = 'none';
        return;
    }
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';

    document.getElementById('userProfileDisplay').textContent = currentUser.nama;
    // HAPUS BARIS INI KARENA ID 'profileName' TIDAK ADA DI HTML BARU
    // document.getElementById('profileName').textContent = currentUser.nama; 
    
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('userRoleDisplay').textContent = currentUser.role.toUpperCase();
    document.getElementById('userRoleDisplay').className = `role-badge role-${currentUser.role}`;

    const photo = currentUser.photoUrl || "https://ui-avatars.com/api/?name=User";
    document.getElementById('headerAvatar').src = photo;
    document.getElementById('profileImg').src = photo;

    applyRolePermissions();
    populateFilters();
    setInterval(updateClock, 1000); updateClock();
    
    // Render semua table
    renderTable(); renderStudentsTable(); renderCodesTable(); renderUsersTable();
    switchTab('attendance');
}

function applyRolePermissions() {
    const role = currentUser.role;
    document.querySelectorAll('.role-admin').forEach(el => el.style.display = role === 'admin' ? '' : 'none');
    document.querySelectorAll('.role-guru').forEach(el => el.style.display = (role === 'guru' || role === 'admin') ? '' : 'none');
}

function updateClock() {
    document.getElementById('clock').textContent = new Date().toLocaleTimeString('id-ID');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId)).classList.add('active');
}

function showToast(msg, type='success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.borderLeftColor = type === 'error' ? 'var(--danger)' : 'var(--primary)';
    t.className = "toast show";
    setTimeout(() => { t.className = t.className.replace("show", ""); }, 3000);
}

function populateFilters() {
    // Filter dropdown untuk Tab Absensi
    const classes = [...new Set(dbData.users.map(s => s.kelas))].sort();
    const majors = [...new Set(dbData.users.map(s => s.jurusan))].sort();
    document.getElementById('filterKelas').innerHTML = '<option value="all">Semua</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('filterJurusan').innerHTML = '<option value="all">Semua</option>' + majors.map(j => `<option value="${j}">${j}</option>`).join('');
}

// --- PROFILE & MODALS ---
function openProfileModal() {
    document.getElementById('modal-profile').classList.add('open');
    if(currentUser) {
        document.getElementById('profileImg').src = currentUser.photoUrl;
        
        // Isi Input Nama dan Subject
        document.getElementById('profileNameInput').value = currentUser.nama || "";
        document.getElementById('profileEmail').textContent = currentUser.email;
        document.getElementById('profileKelas').value = currentUser.kelas || "";
        document.getElementById('profileJurusan').value = currentUser.jurusan || "";
        document.getElementById('profileSubject').value = currentUser.subject || "";

        // --- LOGIKA TAMPILAN BERDASARKAN ROLE ---
        const nameInput = document.getElementById('profileNameInput');
        const kelasInput = document.getElementById('profileKelas');
        const jurusanInput = document.getElementById('profileJurusan');
        const subjectGroup = document.getElementById('group-subject');
        const saveBtn = document.querySelector('#modal-profile .btn-save');

        if (currentUser.role === 'siswa') {
            // SISWA: Hanya readonly, tidak bisa edit
            nameInput.readOnly = true;
            nameInput.style.border = "none";
            nameInput.style.background = "transparent";
            
            kelasInput.readOnly = true;
            kelasInput.style.border = "none";
            kelasInput.style.background = "transparent";

            jurusanInput.readOnly = true;
            jurusanInput.style.border = "none";
            jurusanInput.style.background = "transparent";

            subjectGroup.style.display = 'none'; // Siswa gak butuh field ini
            
            // Sembunyikan tombol simpan (Siswa gak boleh edit profil teks)
            saveBtn.style.display = 'none';

        } else {
            // GURU / ADMIN: Bisa edit
            nameInput.readOnly = false;
            nameInput.style.border = "1px solid var(--border)";
            nameInput.style.background = "#2c2c2c";

            kelasInput.readOnly = false;
            kelasInput.style.border = "1px solid var(--border)";
            kelasInput.style.background = "#2c2c2c";

            jurusanInput.readOnly = false;
            jurusanInput.style.border = "1px solid var(--border)";
            jurusanInput.style.background = "#2c2c2c";

            subjectGroup.style.display = 'block'; // Tampilkan mata pelajaran
            saveBtn.style.display = 'block';
        }
    }
}

function openForgotPasswordModal() {
    document.getElementById('modal-forgot').classList.add('open');
    document.getElementById('forgotEmail').value = ""; // Reset input
}

function openChangePasswordModal() {
    document.getElementById('cpOld').value = ""; document.getElementById('cpNew').value = ""; document.getElementById('cpConfirm').value = "";
    document.getElementById('modal-change-pass').classList.add('open');
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function handleUpdateProfileInfo() {
    if(!currentUser) return;

    // Security: Siswa tidak diizinkan update profil teks (Nama/Kelas/Jurusan)
    if(currentUser.role === 'siswa') {
        showToast("Siswa tidak dapat mengubah data profil. Hubungi Admin/Guru.", "error");
        return;
    }

    // --- LOGIKA SAVE UNTUK GURU / ADMIN ---
    const newNama = document.getElementById('profileNameInput').value;
    const newKelas = document.getElementById('profileKelas').value.toUpperCase();
    const newJurusan = document.getElementById('profileJurusan').value;
    const newSubject = document.getElementById('profileSubject').value;

    if(!newNama) return showToast("Nama wajib diisi!", "error");

    // Tampilkan loading pada tombol
    const btn = document.querySelector('#modal-profile .btn-save'); 
    if(btn) {
        const originalText = btn.innerText;
        btn.innerText = "Menyimpan..."; btn.disabled = true;

        // Update ke Firebase
        db.ref(`users_auth/${currentUser.uid}`).update({
            nama: newNama,
            kelas: newKelas,
            jurusan: newJurusan,
            subject: newSubject
        }).then(() => {
            // Update data lokal
            currentUser.nama = newNama;
            currentUser.kelas = newKelas;
            currentUser.jurusan = newJurusan;
            currentUser.subject = newSubject;

            showToast("Profil berhasil diperbarui");
            
            // Update tampilan header nama
            document.getElementById('userProfileDisplay').textContent = newNama;
            
            closeModal('modal-profile');
            
            // Render ulang filter dropdown
            if(typeof populateFilters === 'function') populateFilters();
        }).catch((err) => {
            showToast("Gagal update: " + err.message, "error");
        }).finally(() => {
            if(btn) {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
}

function handleChangePassword(e) {
    e.preventDefault();
    const oldPass = document.getElementById('cpOld').value;
    const newPass = document.getElementById('cpNew').value;
    
    // Update password di Firebase Auth
    auth.currentUser.updatePassword(newPass).then(() => {
        showToast("Password berhasil diubah");
        closeModal('modal-change-pass');
    }).catch((err) => {
        if(err.code === 'auth/requires-recent-login') {
            showToast("Silakan logout dan login kembali untuk ubah password.", "error");
        } else {
            showToast(err.message, "error");
        }
    });
}

async function uploadProfilePhoto(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if(!file.type.match('image.*')) return showToast("Hanya gambar!", "error");
        
        const formData = new FormData(); formData.append("image", file);
        const imgEl = document.getElementById('profileImg'); const originalSrc = imgEl.src;
        imgEl.style.opacity = "0.5"; showToast("Mengunggah ke ImgBB...", "neutral");

        try {
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: formData });
            const data = await res.json();

            if (data.success) {
                const urlProxy = `https://wsrv.nl/?url=${encodeURIComponent(data.data.image.url)}`;
                // Update Firebase
                db.ref(`users_auth/${currentUser.uid}`).update({ photoUrl: urlProxy });
                // Update Local
                currentUser.photoUrl = urlProxy;
                document.getElementById('headerAvatar').src = urlProxy; imgEl.src = urlProxy;
                showToast("Foto diperbarui!");
            } else { showToast("Gagal upload", "error"); imgEl.src = originalSrc; }
        } catch (e) { showToast("Koneksi Error", "error"); imgEl.src = originalSrc; } 
        finally { imgEl.style.opacity = "1"; input.value = ""; }
    }
}

function processForgot() {
    const email = document.getElementById('forgotEmail').value;

    // Validasi: Jangan kirim jika kosong
    if (!email) {
        showToast("Masukkan email terlebih dahulu!", "error");
        return;
    }

    // Ambil elemen tombol untuk efek loading
    const btn = document.querySelector('#modal-forgot .btn-save'); 
    if(btn) {
        btn.innerText = "Mengirim...";
        btn.disabled = true;
    }

    auth.sendPasswordResetEmail(email)
        .then(() => {
            showToast("Link reset password telah dikirim ke " + email);
            closeModal('modal-forgot');
        })
        .catch((error) => {
            console.error("Error Forgot Password:", error);
            
            // Tampilkan pesan error spesifik
            if (error.code === 'auth/invalid-email') {
                showToast("Format email salah!", "error");
            } else if (error.code === 'auth/user-not-found') {
                showToast("Email tersebut belum terdaftar!", "error");
            } else if (error.code === 'auth/missing-android-pkg-name' || error.code === 'auth/missing-continue-uri') {
                // Error ini biasanya karena konfigurasi di Firebase Console belum diatur
                showToast("Error: Konfigurasi Email di Firebase belum lengkap.", "error");
            } else {
                showToast("Gagal mengirim: " + error.message, "error");
            }
        })
        .finally(() => {
            // Kembalikan tombol ke kondisi semula
            if(btn) {
                btn.innerText = "Kirim Link";
                btn.disabled = false;
            }
        });
}

// --- FUNGSI BARU UNTUK INTERAKSI UI TAMBAHAN ---

// 1. Tampilan Register (Sembunyikan Input Siswa jika pilih Guru)
function toggleRegisterInput() {
    const type = document.querySelector('input[name="regRoleType"]:checked').value;
    const idGroup = document.getElementById('group-reg-id');
    const detailsGroup = document.getElementById('group-siswa-details');
    const codeInput = document.getElementById('regCode');

    if (type === 'siswa') {
        idGroup.style.display = 'block'; // Tampilkan Input ID Generate
        detailsGroup.style.display = 'block'; // Tampilkan Kelas/Jurusan
        
        // Pastikan input wajib kembali aktif
        document.getElementById('regKelas').required = true;
        document.getElementById('regJurusan').required = true;
        codeInput.placeholder = "Kode Unik (Siswa)";
    } else {
        idGroup.style.display = 'none'; // Sembunyikan Input ID Generate
        detailsGroup.style.display = 'none'; // Sembunyikan Kelas/Jurusan
        
        // Matikan required agar bisa submit
        document.getElementById('regKelas').required = false;
        document.getElementById('regJurusan').required = false;
        codeInput.placeholder = "Kode Unik (Guru)";
    }
}

// 2. Tampilan Generate Code (Sembunyikan Dropdown Siswa jika pilih Guru)
function toggleGenerateInput() {
    const type = document.querySelector('input[name="genTarget"]:checked').value;
    const selectGroup = document.getElementById('group-select-siswa');
    const desc = document.getElementById('gen-desc');

    if (type === 'siswa') {
        selectGroup.style.display = 'block';
        desc.innerText = "Kode akan dikunci ke ID Siswa terpilih.";
    } else {
        selectGroup.style.display = 'none';
        desc.innerText = "Kode bebas digunakan oleh Guru mana saja.";
    }
}