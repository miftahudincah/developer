function initApp() {
    if (!currentUser) {
        document.getElementById('auth-section').style.display = 'flex';
        document.getElementById('dashboard-section').style.display = 'none';
        return;
    }
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';

    document.getElementById('userProfileDisplay').textContent = currentUser.nama;
    document.getElementById('profileName').textContent = currentUser.nama;
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
    const classes = [...new Set(dbData.users.map(s => s.kelas))].sort();
    const majors = [...new Set(dbData.users.map(s => s.jurusan))].sort();
    document.getElementById('filterKelas').innerHTML = '<option value="all">Semua</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('filterJurusan').innerHTML = '<option value="all">Semua</option>' + majors.map(j => `<option value="${j}">${j}</option>`).join('');
}

// --- PROFILE & MODALS ---
function openProfileModal() {
    document.getElementById('modal-profile').classList.add('open');
    if(currentUser) document.getElementById('profileImg').src = currentUser.photoUrl;
}
function openChangePasswordModal() {
    document.getElementById('cpOld').value = ""; document.getElementById('cpNew').value = ""; document.getElementById('cpConfirm').value = "";
    document.getElementById('modal-change-pass').classList.add('open');
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

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
    auth.sendPasswordResetEmail(document.getElementById('forgotEmail').value).then(() => {
        showToast("Email reset terkirim");
        closeModal('modal-forgot');
    }).catch(err => showToast(err.message, "error"));
}