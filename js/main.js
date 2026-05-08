// Cek status login saat aplikasi dimuat
auth.onAuthStateChanged((user) => {
    if (user) {
        db.ref('users_auth/' + user.uid).once('value').then((snapshot) => {
            if (snapshot.exists()) {
                currentUser = { uid: user.uid, email: user.email, ...snapshot.val() };
                initApp();
            } else {
                console.log("User deleted by admin. Signing out...");
                auth.signOut().then(() => {
                    document.getElementById('auth-section').style.display = 'flex';
                    document.getElementById('dashboard-section').style.display = 'none';
                    showToast("Akun Anda telah dihapus oleh Admin.", "error");
                });
            }
        });
    } else {
        document.getElementById('auth-section').style.display = 'flex';
        document.getElementById('dashboard-section').style.display = 'none';
    }
});