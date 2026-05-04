// Cek status login saat aplikasi dimuat
auth.onAuthStateChanged((user) => {
    if (user) {
        // Cek apakah data detail user masih ada di Database (users_auth)
        db.ref('users_auth/' + user.uid).once('value').then((snapshot) => {
            if(snapshot.exists()) {
                // Data valid, Izinkan akses aplikasi
                currentUser = { uid: user.uid, email: user.email, ...snapshot.val() };
                initApp();
            } else {
                // Data Auth ada, TAPI Data Database TIDAK ADA (User dihapus oleh Admin)
                // Lakukan Logout paksa
                console.log("User deleted by admin. Signing out...");
                auth.signOut().then(() => {
                    // Biarkan user tetap di halaman login
                    document.getElementById('auth-section').style.display = 'flex';
                    document.getElementById('dashboard-section').style.display = 'none';
                    showToast("Akun Anda telah dihapus oleh Admin.", "error");
                });
            }
        });
    } else {
        // Belum login atau berhasil logout
        document.getElementById('auth-section').style.display = 'flex';
        document.getElementById('dashboard-section').style.display = 'none';
    }
});