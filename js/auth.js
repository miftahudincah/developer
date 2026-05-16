// auth.js - VERSI REGISTRASI LANGSUNG (TAMBAHAN: SCAN QR CODE)

let lastRegisterAttempt = 0;
const REGISTER_COOLDOWN = 30000;

// Variabel untuk QR Scanner
let html5QrCode = null;

// ======================= FUNGSI QR SCANNER =======================

function openQrScanner() {
    const modal = document.getElementById('modal-qr-scanner');
    if (!modal) {
        showToast("Modal scanner tidak ditemukan!", "error");
        return;
    }
    modal.classList.add('open');
    
    const qrReader = document.getElementById('qr-reader');
    const resultsDiv = document.getElementById('qr-reader-results');
    if (!qrReader) return;
    
    // Hentikan scanner sebelumnya jika ada
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
        }).catch(() => {});
    }
    
    html5QrCode = new Html5Qrcode("qr-reader");
    html5QrCode.start(
        { facingMode: "environment" }, // kamera belakang
        {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        },
        (decodedText, decodedResult) => {
            // Sukses scan
            handleQrScan(decodedText);
            // Hentikan scanner
            html5QrCode.stop().then(() => {
                html5QrCode.clear();
                closeModal('modal-qr-scanner');
                if (resultsDiv) resultsDiv.innerHTML = '';
            }).catch(() => {});
        },
        (errorMessage) => {
            // Abaikan error (biasanya karena tidak ada QR)
            if (resultsDiv && !resultsDiv.innerHTML) {
                resultsDiv.innerHTML = '<small style="color:#ff9800;">🔍 Arahkan kamera ke QR Code...</small>';
            }
        }
    ).catch(err => {
        console.error("Unable to start scanning", err);
        if (resultsDiv) {
            resultsDiv.innerHTML = '<span style="color:red;">❌ Gagal mengakses kamera. Pastikan izin diberikan.</span>';
        }
        showToast("Tidak dapat mengakses kamera", "error");
    });
}

function handleQrScan(data) {
    try {
        // Coba parse sebagai JSON
        const parsed = JSON.parse(data);
        if (parsed.code) {
            // Isi field kode
            document.getElementById('regCode').value = parsed.code;
            if (parsed.studentId) {
                // QR untuk siswa: isi ID dan pilih role siswa
                document.getElementById('regGeneratedId').value = parsed.studentId;
                document.querySelector('input[name="regRoleType"][value="siswa"]').checked = true;
                if (typeof toggleRegisterInput === 'function') toggleRegisterInput();
                showToast("✅ Data QR terisi! Silakan lengkapi email & password.", "success");
            } else {
                // QR untuk guru: pilih role guru
                document.querySelector('input[name="regRoleType"][value="guru"]').checked = true;
                if (typeof toggleRegisterInput === 'function') toggleRegisterInput();
                showToast("✅ Kode registrasi guru terisi. Silakan lengkapi nama & mapel.", "success");
            }
        } else {
            showToast("❌ QR tidak valid: tidak mengandung kode registrasi.", "error");
        }
    } catch (e) {
        // Mungkin QR hanya berisi teks kode biasa (bukan JSON)
        const maybeCode = data.trim();
        if (maybeCode.length > 5) {
            document.getElementById('regCode').value = maybeCode;
            showToast("✅ Kode registrasi terisi. Pilih role yang sesuai.", "success");
        } else {
            showToast("❌ Format QR tidak dikenali.", "error");
        }
    }
}

// ======================= FUNGSI LOGIN =======================

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
            return db.ref('users_auth/' + user.uid).once('value').then((snapshot) => {
                const userData = snapshot.val();
                if (userData) {
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

// ======================= FUNGSI REGISTRASI =======================

async function handleRegister(e) {
    e.preventDefault();
    const now = Date.now();
    if (now - lastRegisterAttempt < 30000) {
        const wait = Math.ceil((30000 - (now - lastRegisterAttempt)) / 1000);
        showToast(`Tunggu ${wait} detik sebelum mencoba lagi`, "error");
        return;
    }
    lastRegisterAttempt = now;

    const regType = document.querySelector('input[name="regRoleType"]:checked')?.value;
    const codeInput = document.getElementById('regCode').value.trim().toUpperCase();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPassword').value;

    if (!regType || !codeInput || !email || !pass) {
        showToast("Semua bidang wajib diisi!", "error");
        return;
    }
    if (!/^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/.test(email)) {
        showToast("Format email tidak valid!", "error");
        return;
    }
    if (pass.length < 6) {
        showToast("Password minimal 6 karakter!", "error");
        return;
    }

    let extraData = {};
    if (regType === 'siswa') {
        const inputId = document.getElementById('regGeneratedId').value.trim();
        if (!inputId) { showToast("Masukkan ID Siswa!", "error"); return; }
        extraData = { fpId: inputId };
    } else {
        const namaGuru = document.getElementById('regNama').value.trim();
        if (!namaGuru) { showToast("Nama Guru wajib diisi!", "error"); return; }
        extraData = { nama: namaGuru, subject: document.getElementById('regSubject').value.trim() };
    }

    const btn = document.getElementById('btnRegSubmit');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Mendaftar...";
    btn.disabled = true;

    try {
        // Verifikasi kode di database
        const codeSnapshot = await db.ref(`codes/${codeInput}`).once('value');
        const codeData = codeSnapshot.val();
        if (!codeData || codeData.used === true) throw new Error('Kode tidak valid atau sudah digunakan');
        if (codeData.type !== regType) throw new Error(`Kode ini untuk ${codeData.type}, bukan ${regType}`);

        // Cek email sudah terdaftar
        const methods = await auth.fetchSignInMethodsForEmail(email);
        if (methods.length > 0) throw new Error('Email sudah terdaftar');

        // Buat akun
        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        const user = userCredential.user;

        // Siapkan data user
        let userData = { uid: user.uid, email, role: regType, registeredAt: firebase.database.ServerValue.TIMESTAMP };
        if (regType === 'siswa') {
            const fpId = extraData.fpId;
            const studentSnap = await db.ref(`users/${fpId}`).once('value');
            if (!studentSnap.exists()) {
                await user.delete();
                throw new Error(`ID Fingerprint ${fpId} tidak ditemukan di data siswa`);
            }
            const student = studentSnap.val();
            userData.nama = student.nama;
            userData.kelas = student.kelas;
            userData.jurusan = student.jurusan;
            userData.fpId = fpId;
        } else {
            userData.nama = extraData.nama;
            userData.subject = extraData.subject || '';
        }

        await db.ref(`users_auth/${user.uid}`).set(userData);
        await db.ref(`codes/${codeInput}`).update({ used: true, userId: user.uid, usedAt: firebase.database.ServerValue.TIMESTAMP });

        showToast("Pendaftaran Berhasil! Silakan Login.", "success");
        toggleAuth('login');
        document.getElementById('registerForm').reset();
        if (typeof toggleRegisterInput === 'function') toggleRegisterInput();
    } catch (error) {
        console.error(error);
        let msg = error.message;
        if (msg.includes('Kode tidak valid')) msg = "Kode pendaftaran tidak valid atau sudah kadaluarsa.";
        else if (msg.includes('Email sudah terdaftar')) msg = "Email sudah digunakan.";
        else if (msg.includes('ID Fingerprint')) msg = error.message;
        else msg = "Registrasi gagal: " + msg;
        showToast(msg, "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function handleLogout() {
    const cleanups = [
        'cleanupAttendanceListeners', 'cleanupStudentsSystem', 'cleanupUsersSystem',
        'cleanupChatSystem', 'cleanupFriendsSystem', 'cleanupStatusSystem',
        'cleanupSettingsSystem', 'cleanupRekap', 'cleanupUI', 'cleanupAnnouncementSystem'
    ];
    cleanups.forEach(fn => { if (typeof window[fn] === 'function') window[fn](); });
    auth.signOut().then(() => {
        if (typeof clearUserSession === 'function') clearUserSession();
        location.reload();
    }).catch(() => location.reload());
}

function processForgot() {
    const email = document.getElementById('forgotEmail').value.trim();
    if (!email) { showToast('Masukkan email terlebih dahulu!', 'error'); return; }
    const btn = document.querySelector('#modal-forgot .btn-save');
    if (btn) { btn.innerText = '📧 Mengirim...'; btn.disabled = true; }
    auth.sendPasswordResetEmail(email)
        .then(() => { showToast(`✅ Link reset password telah dikirim ke ${email}`, 'success'); closeModal('modal-forgot'); })
        .catch(error => { let msg = error.code === 'auth/user-not-found' ? '❌ Email belum terdaftar!' : error.message; showToast(msg, 'error'); })
        .finally(() => { if (btn) { btn.innerText = 'Kirim Link'; btn.disabled = false; } });
}

async function handleChangePassword(e) {
    e.preventDefault();
    const oldPass = document.getElementById('cpOld').value;
    const newPass = document.getElementById('cpNew').value;
    const confirmPass = document.getElementById('cpConfirm').value;
    if (!oldPass || !newPass || !confirmPass) { showToast("Semua field harus diisi!", "error"); return; }
    if (newPass !== confirmPass) { showToast("Password baru tidak cocok!", "error"); return; }
    if (newPass.length < 6) { showToast("Password minimal 6 karakter!", "error"); return; }
    const btn = document.querySelector('#modal-change-pass button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = "Memproses..."; }
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
        if (err.code === 'auth/wrong-password') showToast("Password lama salah!", "error");
        else if (err.code === 'auth/requires-recent-login') showToast("Silakan logout dan login kembali.", "error");
        else showToast("Gagal: " + err.message, "error");
    } finally { if (btn) { btn.disabled = false; btn.textContent = "Simpan"; } }
}

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

function togglePassword(id, icon) {
    const input = document.getElementById(id);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    if (icon) icon.style.color = input.type === "text" ? "var(--primary)" : "#aaa";
}

// Ekspor fungsi QR scanner ke global
window.openQrScanner = openQrScanner;
window.handleQrScan = handleQrScan;

// Ekspor fungsi lain
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.toggleAuth = toggleAuth;
window.togglePassword = togglePassword;
window.processForgot = processForgot;
window.handleChangePassword = handleChangePassword;

console.log("✅ auth.js (direct registration + QR scanner) loaded");