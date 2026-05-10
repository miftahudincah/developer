// FILE: ui.js
// Berisi fungsi-fungsi antarmuka pengguna, modal, profil, dan inisialisasi dashboard

// ======================== INISIALISASI DASHBOARD ========================

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

    // ========== INISIALISASI SISTEM PENGUMUMAN ==========
    if (typeof initAnnouncementSystem === 'function') {
        setTimeout(function() {
            initAnnouncementSystem();
        }, 500);
    }
    // ===================================================

    // Muat konfigurasi nama sekolah
    if (typeof initSystemConfig === 'function') initSystemConfig();

    // Muat konfigurasi tipe sekolah & jurusan
    if (typeof loadSchoolConfig === 'function') loadSchoolConfig();

    // Inisialisasi event listener untuk delay input
    if (typeof initDelayEventListeners === 'function') {
        initDelayEventListeners();
    } else {
        // Fallback inisialisasi manual
        initManualDelayListeners();
    }

    // Render semua tabel
    if (typeof renderTable === 'function') renderTable();
    if (typeof renderStudentsTable === 'function') renderStudentsTable();
    if (typeof renderCodesTable === 'function') renderCodesTable();
    if (typeof renderUsersTable === 'function') renderUsersTable();
    
    switchTab('attendance');
    
    // Tampilkan floating button untuk admin/guru
    setTimeout(function() {
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'guru')) {
            const floatingBtn = document.getElementById('floatingAnnouncementBtn');
            if (floatingBtn) floatingBtn.style.display = 'flex';
        }
    }, 1000);
}

// Fallback inisialisasi manual untuk delay listeners
function initManualDelayListeners() {
    const delayMinutesInput = document.getElementById('delayMinutesValue');
    const delayHoursSelect = document.getElementById('delayHoursValue');
    const delayUnitSelect = document.getElementById('delayUnit');
    
    if (delayMinutesInput) {
        delayMinutesInput.removeEventListener('input', updateDelayFromMinutes);
        delayMinutesInput.addEventListener('input', updateDelayFromMinutes);
    }
    if (delayHoursSelect) {
        delayHoursSelect.removeEventListener('change', updateDelayFromHours);
        delayHoursSelect.addEventListener('change', updateDelayFromHours);
    }
    if (delayUnitSelect) {
        delayUnitSelect.removeEventListener('change', toggleDelayInput);
        delayUnitSelect.addEventListener('change', toggleDelayInput);
    }
}

// ======================== FUNGSI FORMAT DELAY ========================

/**
 * Format delay dalam menit menjadi teks yang mudah dibaca
 * @param {number} delayMinutes - Delay dalam menit
 * @returns {string} Format teks (contoh: "2 jam 30 menit")
 */
function formatDelayText(delayMinutes) {
    if (!delayMinutes && delayMinutes !== 0) return '-';
    
    const hours = Math.floor(delayMinutes / 60);
    const minutes = delayMinutes % 60;
    
    if (hours > 0 && minutes > 0) {
        return `${hours} jam ${minutes} menit`;
    } else if (hours > 0) {
        return `${hours} jam`;
    } else {
        return `${minutes} menit`;
    }
}

// ======================== ROLE PERMISSIONS ========================

function applyRolePermissions() {
    const role = currentUser.role;
    console.log("Apply role permissions untuk role:", role);
    
    // Untuk elemen dengan class role-admin
    document.querySelectorAll('.role-admin').forEach(el => {
        if (role === 'admin') {
            el.style.display = '';
            el.style.visibility = 'visible';
        } else {
            el.style.display = 'none';
        }
    });
    
    // Untuk elemen dengan class role-guru (admin dan guru bisa lihat)
    document.querySelectorAll('.role-guru').forEach(el => {
        if (role === 'admin' || role === 'guru') {
            el.style.display = '';
            el.style.visibility = 'visible';
        } else {
            el.style.display = 'none';
        }
    });
    
    // Khusus untuk tombol announcement
    const btnAnnouncement = document.querySelector('.btn-announcement');
    if (btnAnnouncement) {
        if (role === 'admin' || role === 'guru') {
            btnAnnouncement.style.display = 'inline-flex';
            btnAnnouncement.style.visibility = 'visible';
        } else {
            btnAnnouncement.style.display = 'none';
        }
    }
    
    // Tampilkan floating button
    const floatingBtn = document.getElementById('floatingAnnouncementBtn');
    if (floatingBtn) {
        if (role === 'admin' || role === 'guru') {
            floatingBtn.style.display = 'flex';
        } else {
            floatingBtn.style.display = 'none';
        }
    }
}

function updateClock() {
    const clockEl = document.getElementById('clock');
    if (clockEl) clockEl.textContent = new Date().toLocaleTimeString('id-ID');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add('active');
    const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b =>
        b.getAttribute('onclick') && b.getAttribute('onclick').includes(tabId)
    );
    if (activeBtn) activeBtn.classList.add('active');
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.borderLeftColor = type === 'error' ? 'var(--danger)' : 'var(--primary)';
    toast.className = 'toast show';
    setTimeout(() => {
        toast.className = toast.className.replace('show', '');
    }, 3000);
}

// Filter dropdown untuk tab Absensi (berdasarkan data siswa yang sudah terdaftar)
function populateFilters() {
    const classes = [...new Set(dbData.users.map(s => s.kelas))].sort();
    const majors = [...new Set(dbData.users.map(s => s.jurusan))].sort();
    const filterKelas = document.getElementById('filterKelas');
    const filterJurusan = document.getElementById('filterJurusan');
    if (filterKelas) {
        filterKelas.innerHTML = '<option value="all">Semua</option>' +
            classes.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    if (filterJurusan) {
        filterJurusan.innerHTML = '<option value="all">Semua</option>' +
            majors.map(j => `<option value="${j}">${j}</option>`).join('');
    }
}

// ======================== PROFIL & MODALS ========================

function openProfileModal() {
    const modal = document.getElementById('modal-profile');
    if (!modal) return;
    modal.classList.add('open');
    
    if (currentUser) {
        document.getElementById('profileImg').src = currentUser.photoUrl || 'https://ui-avatars.com/api/?name=User';
        document.getElementById('profileNameInput').value = currentUser.nama || '';
        document.getElementById('profileEmail').textContent = currentUser.email;
        document.getElementById('profileKelas').value = currentUser.kelas || '';
        document.getElementById('profileJurusan').value = currentUser.jurusan || '';
        document.getElementById('profileSubject').value = currentUser.subject || '';

        const nameInput = document.getElementById('profileNameInput');
        const kelasInput = document.getElementById('profileKelas');
        const jurusanInput = document.getElementById('profileJurusan');
        const subjectGroup = document.getElementById('group-subject');
        const saveBtn = document.querySelector('#modal-profile .btn-save');
        
        // Elemen untuk menampilkan delay (khusus siswa)
        let delayGroup = document.getElementById('group-profile-delay');
        if (!delayGroup) {
            // Buat elemen delay jika belum ada
            const jurusanDiv = document.getElementById('profileJurusan')?.parentElement;
            if (jurusanDiv && currentUser.role === 'siswa') {
                const newDelayGroup = document.createElement('div');
                newDelayGroup.className = 'form-group';
                newDelayGroup.id = 'group-profile-delay';
                newDelayGroup.innerHTML = `
                    <label>Delay Pulang</label>
                    <input type="text" id="profileDelay" placeholder="60 menit" readonly style="background:#2c2c2c; color:#aaa;">
                    <small class="text-small">*Waktu minimal untuk absen pulang</small>
                `;
                jurusanDiv.insertAdjacentElement('afterend', newDelayGroup);
                delayGroup = newDelayGroup;
            }
        }

        if (currentUser.role === 'siswa') {
            // Mode Siswa: hanya baca
            nameInput.readOnly = true;
            nameInput.style.border = 'none';
            nameInput.style.background = 'transparent';
            nameInput.style.color = '#888';
            kelasInput.readOnly = true;
            kelasInput.style.border = 'none';
            kelasInput.style.background = 'transparent';
            jurusanInput.readOnly = true;
            jurusanInput.style.border = 'none';
            jurusanInput.style.background = 'transparent';
            if (subjectGroup) subjectGroup.style.display = 'none';
            if (saveBtn) saveBtn.style.display = 'none';
            
            // Tampilkan delay siswa jika ada
            if (delayGroup) delayGroup.style.display = 'block';
            const profileDelay = document.getElementById('profileDelay');
            if (profileDelay && currentUser.fpId) {
                // Cari data delay dari database users (FP)
                const studentData = dbData.users.find(u => u.id == currentUser.fpId);
                if (studentData && studentData.delayOut) {
                    profileDelay.value = formatDelayText(studentData.delayOut);
                } else {
                    profileDelay.value = formatDelayText(60); // default 60 menit
                }
            } else if (profileDelay) {
                profileDelay.value = formatDelayText(60);
            }
        } else {
            // Mode Guru/Admin: bisa edit
            nameInput.readOnly = false;
            nameInput.style.border = '1px solid var(--border)';
            nameInput.style.background = '#2c2c2c';
            nameInput.style.color = '#fff';
            kelasInput.readOnly = false;
            kelasInput.style.border = '1px solid var(--border)';
            kelasInput.style.background = '#2c2c2c';
            jurusanInput.readOnly = false;
            jurusanInput.style.border = '1px solid var(--border)';
            jurusanInput.style.background = '#2c2c2c';
            if (subjectGroup) subjectGroup.style.display = 'block';
            if (saveBtn) saveBtn.style.display = 'block';
            if (delayGroup) delayGroup.style.display = 'none';
        }
    }
}

function openForgotPasswordModal() {
    const modal = document.getElementById('modal-forgot');
    if (modal) {
        modal.classList.add('open');
        const emailInput = document.getElementById('forgotEmail');
        if (emailInput) emailInput.value = '';
    }
}

function openChangePasswordModal() {
    const modal = document.getElementById('modal-change-pass');
    if (modal) {
        modal.classList.add('open');
        const oldPass = document.getElementById('cpOld');
        const newPass = document.getElementById('cpNew');
        const confirmPass = document.getElementById('cpConfirm');
        if (oldPass) oldPass.value = '';
        if (newPass) newPass.value = '';
        if (confirmPass) confirmPass.value = '';
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
}

function handleUpdateProfileInfo() {
    if (!currentUser) return;
    if (currentUser.role === 'siswa') {
        showToast('Siswa tidak dapat mengubah data profil. Hubungi Admin/Guru.', 'error');
        return;
    }

    const newNama = document.getElementById('profileNameInput').value;
    const newKelas = document.getElementById('profileKelas').value.toUpperCase();
    const newJurusan = document.getElementById('profileJurusan').value;
    const newSubject = document.getElementById('profileSubject').value;

    if (!newNama) return showToast('Nama wajib diisi!', 'error');

    const btn = document.querySelector('#modal-profile .btn-save');
    if (!btn) return;
    const originalText = btn.innerText;
    btn.innerText = 'Menyimpan...';
    btn.disabled = true;

    const updateData = { nama: newNama, kelas: newKelas, jurusan: newJurusan, subject: newSubject };
    db.ref(`users_auth/${currentUser.uid}`).update(updateData)
        .then(() => {
            currentUser.nama = newNama;
            currentUser.kelas = newKelas;
            currentUser.jurusan = newJurusan;
            currentUser.subject = newSubject;
            showToast('Profil berhasil diperbarui');
            document.getElementById('userProfileDisplay').textContent = newNama;

            if (currentUser.role === 'siswa' && currentUser.fpId) {
                db.ref(`users/${currentUser.fpId}`).update({
                    nama: newNama,
                    kelas: newKelas,
                    jurusan: newJurusan
                }).then(() => console.log('Sinkronisasi FP berhasil'));
            }
            closeModal('modal-profile');
            if (typeof populateFilters === 'function') populateFilters();
            if (typeof renderStudentsTable === 'function') renderStudentsTable();
        })
        .catch(err => showToast('Gagal update: ' + err.message, 'error'))
        .finally(() => {
            btn.innerText = originalText;
            btn.disabled = false;
        });
}

function handleChangePassword(e) {
    e.preventDefault();
    const newPass = document.getElementById('cpNew').value;
    auth.currentUser.updatePassword(newPass)
        .then(() => {
            showToast('Password berhasil diubah');
            closeModal('modal-change-pass');
        })
        .catch(err => {
            if (err.code === 'auth/requires-recent-login') {
                showToast('Silakan logout dan login kembali untuk ubah password.', 'error');
            } else {
                showToast(err.message, 'error');
            }
        });
}

async function uploadProfilePhoto(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (!file.type.match('image.*')) return showToast('Hanya gambar!', 'error');

    const formData = new FormData();
    formData.append('image', file);
    const imgEl = document.getElementById('profileImg');
    const originalSrc = imgEl.src;
    imgEl.style.opacity = '0.5';
    showToast('Mengunggah ke ImgBB...', 'neutral');

    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            const urlProxy = `https://wsrv.nl/?url=${encodeURIComponent(data.data.image.url)}`;
            await db.ref(`users_auth/${currentUser.uid}`).update({ photoUrl: urlProxy });
            currentUser.photoUrl = urlProxy;
            document.getElementById('headerAvatar').src = urlProxy;
            imgEl.src = urlProxy;
            showToast('Foto diperbarui!');
        } else {
            showToast('Gagal upload', 'error');
            imgEl.src = originalSrc;
        }
    } catch (e) {
        showToast('Koneksi Error', 'error');
        imgEl.src = originalSrc;
    } finally {
        imgEl.style.opacity = '1';
        input.value = '';
    }
}

function processForgot() {
    const email = document.getElementById('forgotEmail').value;
    if (!email) return showToast('Masukkan email terlebih dahulu!', 'error');

    const btn = document.querySelector('#modal-forgot .btn-save');
    if (btn) {
        btn.innerText = 'Mengirim...';
        btn.disabled = true;
    }

    auth.sendPasswordResetEmail(email)
        .then(() => {
            showToast(`Link reset password telah dikirim ke ${email}`);
            closeModal('modal-forgot');
        })
        .catch(error => {
            console.error(error);
            if (error.code === 'auth/user-not-found') {
                showToast('Email tersebut belum terdaftar!', 'error');
            } else {
                showToast('Gagal mengirim: ' + error.message, 'error');
            }
        })
        .finally(() => {
            if (btn) {
                btn.innerText = 'Kirim Link';
                btn.disabled = false;
            }
        });
}

// ======================== REGISTER & GENERATE UI ========================

function toggleRegisterInput() {
    const type = document.querySelector('input[name="regRoleType"]:checked').value;
    const idGroup = document.getElementById('group-reg-id');
    const namaGroup = document.getElementById('group-reg-nama');
    const subjectGroup = document.getElementById('group-reg-subject');
    const detailsGroup = document.getElementById('group-siswa-details');
    const codeInput = document.getElementById('regCode');

    if (type === 'siswa') {
        if (idGroup) idGroup.style.display = 'block';
        if (detailsGroup) detailsGroup.style.display = 'block';
        if (namaGroup) namaGroup.style.display = 'none';
        if (subjectGroup) subjectGroup.style.display = 'none';
        if (document.getElementById('regKelas')) document.getElementById('regKelas').required = true;
        if (document.getElementById('regJurusan')) document.getElementById('regJurusan').required = true;
        if (codeInput) codeInput.placeholder = 'Kode Unik (Siswa)';
    } else {
        if (idGroup) idGroup.style.display = 'none';
        if (detailsGroup) detailsGroup.style.display = 'none';
        if (namaGroup) namaGroup.style.display = 'block';
        if (subjectGroup) subjectGroup.style.display = 'block';
        if (document.getElementById('regKelas')) document.getElementById('regKelas').required = false;
        if (document.getElementById('regJurusan')) document.getElementById('regJurusan').required = false;
        if (codeInput) codeInput.placeholder = 'Kode Unik (Guru)';
    }
}

function toggleGenerateInput() {
    const type = document.querySelector('input[name="genTarget"]:checked').value;
    const selectGroup = document.getElementById('group-select-siswa');
    const desc = document.getElementById('gen-desc');
    if (type === 'siswa') {
        if (selectGroup) selectGroup.style.display = 'block';
        if (desc) desc.innerText = 'Kode akan dikunci ke ID Siswa terpilih.';
    } else {
        if (selectGroup) selectGroup.style.display = 'none';
        if (desc) desc.innerText = 'Kode bebas digunakan oleh Guru mana saja.';
    }
}

// ======================== PENGATURAN NAMA SEKOLAH ========================

function saveSchoolName() {
    if (!currentUser) return;
    const newSchoolName = document.getElementById('inputSchoolName').value.trim();
    if (!newSchoolName) return showToast('Nama sekolah tidak boleh kosong!', 'error');
    if (currentUser.role !== 'admin') return showToast('Hanya Admin yang bisa mengubah nama sekolah.', 'error');
    db.ref('system_config/schoolName').set(newSchoolName)
        .then(() => showToast('Nama sekolah berhasil diperbarui'))
        .catch(err => showToast('Gagal update: ' + err.message, 'error'));
}

function initSystemConfig() {
    db.ref('system_config/schoolName').on('value', snapshot => {
        const name = snapshot.val();
        const display = name || 'Sistem Absensi';
        const headerTitle = document.getElementById('schoolNameDisplay');
        if (headerTitle) headerTitle.textContent = display;
        const inputField = document.getElementById('inputSchoolName');
        if (inputField) inputField.value = name || '';
    });
}

// ======================== RENDER TABEL USERS ========================

function renderUsersTable() {
    const tbody = document.getElementById('tbody-users');
    if (!tbody) return;
    
    const search = document.getElementById('searchUser') ? document.getElementById('searchUser').value.toLowerCase() : '';
    tbody.innerHTML = '';

    // Filter data
    let data = dbData.users_auth.filter(u => 
        u.nama && u.nama.toLowerCase().includes(search)
    );

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#888;">Tidak ada pengguna ditemukan.</td></tr>';
        return;
    }

    data.forEach(u => {
        const isMe = (currentUser && currentUser.uid === u.uid);
        const avatar = u.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nama)}&background=random&color=fff&size=32`;
        
        // LOGIKA TAMBAHAN: TAMPILKAN DROPDOWN ROLE
        let roleHtml = '';
        let actionsHtml = '-';

        // Jika yang login adalah ADMIN DAN bukan dirinya sendiri
        if (currentUser && currentUser.role === 'admin' && !isMe) {
            roleHtml = `
                <select class="form-control" onchange="updateUserRole('${u.uid}', this.value)" 
                        style="background:#2c2c2c; color:white; border:1px solid #444; padding:5px; border-radius:4px; font-size:0.8rem;">
                    <option value="siswa" ${u.role === 'siswa' ? 'selected' : ''}>Siswa</option>
                    <option value="guru" ${u.role === 'guru' ? 'selected' : ''}>Guru</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            `;
            actionsHtml = `
                <button class="btn-icon delete" onclick="deleteUser('${u.uid}', '${u.nama}')" title="Hapus User" style="background:transparent; border:none; cursor:pointer; color:#f44336; font-size:18px;">🗑️</button>
            `;
        } else {
            // Jika Bukan Admin, atau Edit Diri Sendiri -> Tampilkan Badge Biasa
            let roleClass = '';
            if (u.role === 'admin') roleClass = 'role-admin';
            else if (u.role === 'guru') roleClass = 'role-guru';
            else roleClass = 'role-siswa';
            
            roleHtml = `<span class="role-badge ${roleClass}">${u.role.toUpperCase()}</span>`;
            if (isMe) roleHtml += ` <small style="color:#aaa;">(Anda)</small>`;
        }

        // Detail (kelas/jurusan/mapel)
        let detailText = '';
        if (u.role === 'siswa') {
            detailText = `${u.kelas || '-'} / ${u.jurusan || '-'}`;
        } else if (u.role === 'guru') {
            detailText = u.subject || '-';
        } else {
            detailText = '-';
        }

        tbody.innerHTML += `
            <tr>
                <td style="text-align:center;"><img src="${avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;"></td>
                <td><strong>${escapeHtmlString(u.nama)}</strong></td>
                <td style="color:#aaa; font-size:0.9rem;">${u.email || '-'}</td>
                <td>${roleHtml}</td>
                <td style="color:#888; font-size:0.85rem;">${detailText}</td>
                <td>${actionsHtml}</td>
            </tr>
        `;
    });
}

// Fungsi escapeHtml untuk keamanan
function escapeHtmlString(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ======================== FUNGSI DELAY UNTUK PROFIL ========================

/**
 * Update tampilan delay di profil (dipanggil saat data users berubah)
 */
function updateProfileDelayDisplay() {
    if (currentUser && currentUser.role === 'siswa' && currentUser.fpId) {
        const studentData = dbData.users.find(u => u.id == currentUser.fpId);
        const profileDelay = document.getElementById('profileDelay');
        if (profileDelay && studentData) {
            profileDelay.value = formatDelayText(studentData.delayOut);
        }
    }
}

// Tambahkan listener untuk update delay di profil saat data users berubah
if (typeof db !== 'undefined' && db) {
    db.ref('users').on('value', () => {
        updateProfileDelayDisplay();
    });
}