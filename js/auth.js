// ==================== auth.js - VERSION 3.0 (SECURE) ====================
// Fitur: Login, Registrasi via Cloud Function, Logout, Reset Password
// Perubahan utama:
// 1. Registrasi dipindahkan ke Cloud Function (server-side)
// 2. Menambahkan rate limiting sederhana untuk registrasi
// 3. Sanitasi input email sebelum dikirim
// 4. Re-authentication untuk aksi sensitif (opsional)
// =========================================================================

// --- RATE LIMITING untuk Registrasi (client-side) ---
let lastRegisterAttempt = 0;
const REGISTER_COOLDOWN = 30000; // 30 detik

// --- Fungsi Login (tetap sama, namun dengan validasi tambahan) ---
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;

    if (!email || !pass) {
        showToast("Email dan password wajib diisi!", "error");
        return;
    }

    const btn = document.getElementById('btnLoginSubmit');
    btn.innerText = "Memproses...";
    btn.disabled = true;

    auth.signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            const user = userCredential.user;
            // Ambil data role dan detail user dari database
            return db.ref('users_auth/' + user.uid).once('value').then((snapshot) => {
                const userData = snapshot.val();
                if (userData) {
                    // Normalisasi Kelas
                    if (userData.kelas) userData.kelas = userData.kelas.toUpperCase();
                    currentUser = { uid: user.uid, email: user.email, ...userData };
                    initApp();
                    showToast(`Selamat datang, ${userData.nama}`);
                } else {
                    showToast("Data user tidak ditemukan di Database!", "error");
                    auth.signOut();
                }
            });
        })
        .catch((error) => {
            let msg = error.message;
            if (error.code === 'auth/user-not-found') msg = "Email tidak terdaftar!";
            else if (error.code === 'auth/wrong-password') msg = "Password salah!";
            else if (error.code === 'auth/invalid-email') msg = "Format email tidak valid!";
            showToast(msg, "error");
        })
        .finally(() => {
            btn.innerText = "MASUK";
            btn.disabled = false;
        });
}

// --- Fungsi Registrasi (Menggunakan Cloud Function) ---
async function handleRegister(e) {
    e.preventDefault();

    // Rate limiting
    const now = Date.now();
    if (now - lastRegisterAttempt < REGISTER_COOLDOWN) {
        const wait = Math.ceil((REGISTER_COOLDOWN - (now - lastRegisterAttempt)) / 1000);
        showToast(`Tunggu ${wait} detik sebelum mencoba lagi`, "error");
        return;
    }
    lastRegisterAttempt = now;

    // Ambil data form
    const regType = document.querySelector('input[name="regRoleType"]:checked')?.value;
    const codeInput = document.getElementById('regCode').value.trim().toUpperCase();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword')?.value; // (optional, tambahkan field confirm password di HTML)

    // Validasi dasar
    if (!regType || !codeInput || !email || !pass) {
        showToast("Semua bidang wajib diisi!", "error");
        return;
    }
    if (!isValidEmail(email)) {
        showToast("Format email tidak valid!", "error");
        return;
    }
    if (pass.length < 6) {
        showToast("Password minimal 6 karakter!", "error");
        return;
    }
    if (confirmPass !== undefined && pass !== confirmPass) {
        showToast("Password dan konfirmasi tidak cocok!", "error");
        return;
    }

    // Data tambahan tergantung tipe
    let extraData = {};
    if (regType === 'siswa') {
        const inputId = document.getElementById('regGeneratedId').value.trim();
        if (!inputId) {
            showToast("Masukkan ID Siswa!", "error");
            return;
        }
        extraData = { fpId: inputId };
    } else {
        const namaGuru = document.getElementById('regNama').value.trim();
        const subjectGuru = document.getElementById('regSubject').value.trim();
        if (!namaGuru) {
            showToast("Nama Guru wajib diisi!", "error");
            return;
        }
        extraData = { nama: namaGuru, subject: subjectGuru };
    }

    // Tampilkan loading
    const btn = document.getElementById('btnRegSubmit');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Mendaftar...";
    btn.disabled = true;

    try {
        // Panggil Cloud Function (harus sudah dideploy)
        const registerFunction = firebase.functions().httpsCallable('registerUser');
        const result = await registerFunction({
            type: regType,
            code: codeInput,
            email: email,
            password: pass,
            extraData: extraData
        });

        if (result.data.success) {
            showToast("Pendaftaran Berhasil! Silakan Login.", "success");
            toggleAuth('login');
            document.getElementById('registerForm').reset();
            if (typeof toggleRegisterInput === 'function') toggleRegisterInput();
        } else {
            showToast(result.data.message || "Pendaftaran gagal", "error");
        }
    } catch (error) {
        console.error("Register error:", error);
        let msg = error.message;
        if (error.code === 'functions/internal') msg = "Server error, coba lagi nanti.";
        else if (msg.includes('Kode tidak valid')) msg = "Kode pendaftaran tidak valid atau sudah kadaluarsa.";
        showToast(msg, "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// --- Helper validasi email ---
function isValidEmail(email) {
    return /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/.test(email);
}

// --- Fungsi Logout (dengan cleanup global) ---
function handleLogout() {
    // Panggil semua fungsi cleanup dari berbagai modul (pastikan sudah didefinisikan)
    if (typeof cleanupAttendanceListeners === 'function') cleanupAttendanceListeners();
    if (typeof cleanupStudentsSystem === 'function') cleanupStudentsSystem();
    if (typeof cleanupUsersSystem === 'function') cleanupUsersSystem();
    if (typeof cleanupChatSystem === 'function') cleanupChatSystem();
    if (typeof cleanupFriendsSystem === 'function') cleanupFriendsSystem();
    if (typeof cleanupStatusSystem === 'function') cleanupStatusSystem();
    if (typeof cleanupSettingsSystem === 'function') cleanupSettingsSystem();
    if (typeof cleanupRekap === 'function') cleanupRekap();
    if (typeof cleanupUI === 'function') cleanupUI();
    if (typeof cleanupAnnouncementSystem === 'function') cleanupAnnouncementSystem();

    auth.signOut().then(() => {
        // Hapus session local
        if (typeof clearUserSession === 'function') clearUserSession();
        location.reload();
    }).catch(err => {
        console.error("Logout error:", err);
        location.reload();
    });
}

// --- Fungsi Reset Password (tetap sama) ---
function processForgot() {
    const email = document.getElementById('forgotEmail').value.trim();
    if (!email) {
        showToast('Masukkan email terlebih dahulu!', 'error');
        return;
    }
    const btn = document.querySelector('#modal-forgot .btn-save');
    if (btn) {
        btn.innerText = '📧 Mengirim...';
        btn.disabled = true;
    }
    auth.sendPasswordResetEmail(email)
        .then(() => {
            showToast(`✅ Link reset password telah dikirim ke ${email}`, 'success');
            closeModal('modal-forgot');
        })
        .catch(error => {
            let msg = error.message;
            if (error.code === 'auth/user-not-found') msg = '❌ Email tersebut belum terdaftar!';
            else if (error.code === 'auth/invalid-email') msg = '❌ Format email tidak valid!';
            showToast(msg, 'error');
        })
        .finally(() => {
            if (btn) {
                btn.innerText = 'Kirim Link';
                btn.disabled = false;
            }
        });
}

// --- Fungsi Ganti Password (memerlukan re-authentication untuk keamanan) ---
async function handleChangePassword(e) {
    e.preventDefault();
    const oldPass = document.getElementById('cpOld').value;
    const newPass = document.getElementById('cpNew').value;
    const confirmPass = document.getElementById('cpConfirm').value;

    if (!oldPass || !newPass || !confirmPass) {
        showToast("Semua field harus diisi!", "error");
        return;
    }
    if (newPass !== confirmPass) {
        showToast("Password baru tidak cocok!", "error");
        return;
    }
    if (newPass.length < 6) {
        showToast("Password minimal 6 karakter!", "error");
        return;
    }

    const btn = document.querySelector('#modal-change-pass button[type="submit"]');
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Memproses...";
    }

    const user = auth.currentUser;
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, oldPass);
    try {
        await user.reauthenticateWithCredential(credential);
        await user.updatePassword(newPass);
        showToast("✅ Password berhasil diubah!", "success");
        closeModal('modal-change-pass');
        document.getElementById('cpNew').value = '';
        document.getElementById('cpConfirm').value = '';
    } catch (err) {
        console.error(err);
        if (err.code === 'auth/wrong-password') showToast("Password lama salah!", "error");
        else if (err.code === 'auth/requires-recent-login') showToast("Silakan logout dan login kembali untuk ubah password.", "error");
        else showToast("Gagal: " + err.message, "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Simpan";
        }
    }
}

// --- Fungsi toggle tampilan form login/register ---
function toggleAuth(mode) {
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');
    if (mode === 'register') {
        if (loginCard) loginCard.style.display = 'none';
        if (registerCard) registerCard.style.display = 'block';
    } else {
        if (loginCard) loginCard.style.display = 'block';
        if (registerCard) registerCard.style.display = 'none';
    }
}

// --- Toggle password visibility ---
function togglePassword(id, icon) {
    const input = document.getElementById(id);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    if (icon) icon.style.color = input.type === "text" ? "var(--primary)" : "#aaa";
}

// --- Ekspor ke global ---
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.toggleAuth = toggleAuth;
window.togglePassword = togglePassword;
window.processForgot = processForgot;
window.handleChangePassword = handleChangePassword;

console.log("✅ auth.js (secure) loaded");