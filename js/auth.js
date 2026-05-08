function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;

    const btn = document.getElementById('btnLoginSubmit');
    btn.innerText = "Memproses...";
    btn.disabled = true;

    auth.signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            const user = userCredential.user;
            db.ref('users_auth/' + user.uid).once('value').then((snapshot) => {
                const userData = snapshot.val();
                if (userData) {
                    if (userData.kelas) userData.kelas = userData.kelas.toUpperCase();
                    currentUser = { uid: user.uid, email: user.email, ...userData };
                    initApp();
                    showToast(`Selamat datang, ${userData.nama}`);
                } else {
                    showToast("Data user tidak ditemukan!", "error");
                    auth.signOut();
                }
            });
        })
        .catch((error) => {
            showToast(error.message, "error");
        })
        .finally(() => {
            btn.innerText = "MASUK";
            btn.disabled = false;
        });
}

function handleRegister(e) {
    e.preventDefault();
    const regType = document.querySelector('input[name="regRoleType"]:checked').value;
    const codeInput = document.getElementById('regCode').value.toUpperCase();
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPassword').value;

    db.ref('codes/' + codeInput).once('value').then((snapshot) => {
        const codeData = snapshot.val();
        if (!codeData) {
            showToast("Kode tidak valid!", "error");
            return;
        }
        if (codeData.used) {
            showToast("Kode sudah dipakai!", "error");
            return;
        }

        if (regType === 'siswa') {
            if (codeData.type !== 'siswa') {
                showToast("Kode ini bukan untuk Siswa!", "error");
                return;
            }
            const inputId = document.getElementById('regGeneratedId').value.trim();
            if (!inputId) {
                showToast("Masukkan ID Siswa!", "error");
                return;
            }
            if (codeData.linkedId != inputId) {
                showToast("ID tidak cocok dengan Kode!", "error");
                return;
            }
            db.ref('users/' + inputId).once('value').then((snapUser) => {
                const studentFpData = snapUser.val();
                if (!studentFpData) {
                    showToast("ID tidak ditemukan di Database!", "error");
                    return;
                }
                createUserAccount(email, pass, {
                    nama: studentFpData.nama,
                    kelas: studentFpData.kelas,
                    jurusan: studentFpData.jurusan,
                    fpId: inputId,
                    email: email,
                    role: "siswa",
                    subject: "",
                    photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(studentFpData.nama)}&background=random`,
                    registeredAt: firebase.database.ServerValue.TIMESTAMP
                }, codeInput);
            });
        } else {
            if (codeData.type !== 'guru') {
                showToast("Kode ini bukan untuk Guru!", "error");
                return;
            }
            const namaGuru = document.getElementById('regNama').value;
            const subjectGuru = document.getElementById('regSubject').value;
            if (!namaGuru) {
                showToast("Nama Guru wajib diisi!", "error");
                return;
            }
            createUserAccount(email, pass, {
                nama: namaGuru,
                email: email,
                role: "guru",
                fpId: null,
                kelas: "",
                jurusan: "",
                subject: subjectGuru,
                photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(namaGuru)}&background=random`,
                registeredAt: firebase.database.ServerValue.TIMESTAMP
            }, codeInput);
        }
    });
}

function createUserAccount(email, pass, userData, codeInput) {
    auth.createUserWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            const user = userCredential.user;
            db.ref('users_auth/' + user.uid).set(userData);
            db.ref('codes/' + codeInput).update({ used: true, userId: user.uid });
            showToast("Pendaftaran Berhasil! Silakan Login.");
            toggleAuth('login');
            document.getElementById('registerForm').reset();
            if (typeof toggleRegisterInput === 'function') toggleRegisterInput();
        })
        .catch((err) => {
            showToast(err.message, "error");
        });
}

function handleLogout() {
    auth.signOut().then(() => { location.reload(); });
}

function toggleAuth(mode) {
    if (mode === 'register') {
        document.getElementById('login-card').style.display = 'none';
        document.getElementById('register-card').style.display = 'block';
    } else {
        document.getElementById('login-card').style.display = 'block';
        document.getElementById('register-card').style.display = 'none';
    }
}

function togglePassword(id, icon) {
    const input = document.getElementById(id);
    input.type = input.type === "password" ? "text" : "password";
    icon.style.color = input.type === "text" ? "var(--primary)" : "#aaa";
}