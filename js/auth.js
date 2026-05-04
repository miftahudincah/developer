function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;

    const btn = document.getElementById('btnLoginSubmit');
    btn.innerText = "Memproses..."; btn.disabled = true;

    auth.signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            const user = userCredential.user;
            // Ambil data role dan detail user dari database
            db.ref('users_auth/' + user.uid).once('value').then((snapshot) => {
                const userData = snapshot.val();
                if (userData) {
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
            showToast(error.message, "error");
        })
        .finally(() => {
            btn.innerText = "MASUK"; btn.disabled = false;
        });
}

function handleRegister(e) {
    e.preventDefault();
    const codeInput = document.getElementById('regCode').value.toUpperCase();
    const nama = document.getElementById('regNama').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPassword').value;
    const kelas = document.getElementById('regKelas').value;
    const jurusan = document.getElementById('regJurusan').value;

    // Cek Kode Terlebih Dahulu
    db.ref('codes/' + codeInput).once('value').then((snapshot) => {
        const codeData = snapshot.val();
        if (!codeData || codeData.used) {
            showToast("Kode Pendaftaran tidak valid atau sudah dipakai!", "error");
            return;
        }
        // Buat User di Authentication Firebase
        auth.createUserWithEmailAndPassword(email, pass)
            .then((userCredential) => {
                const user = userCredential.user;
                
                // Simpan data user ke Database (node users_auth)
                const authUserData = {
                    nama: nama, email: email, role: "siswa",
                    kelas: kelas, jurusan: jurusan,
                    photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(nama)}&background=random`,
                    registeredAt: firebase.database.ServerValue.TIMESTAMP
                };
                db.ref('users_auth/' + user.uid).set(authUserData);

                // Tandai kode sebagai terpakai
                db.ref('codes/' + codeInput).update({ used: true, userId: user.uid });

                showToast("Pendaftaran Berhasil! Silakan Login.");
                toggleAuth('login');
                document.getElementById('registerForm').reset();
            })
            .catch((err) => {
                showToast(err.message, "error");
            });
    });
}

function handleLogout() {
    auth.signOut().then(() => { location.reload(); });
}

function toggleAuth(mode) {
    if(mode === 'register') {
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