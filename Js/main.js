// main.js
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Cek data user di database
            const snapshot = await db.ref('users_auth/' + user.uid).once('value');
            if (snapshot.exists()) {
                currentUser = { uid: user.uid, email: user.email, ...snapshot.val() };
                // Muat dashboard components
                await loadDashboardComponents();
                initApp(); // initApp ada di ui.js
            } else {
                await auth.signOut();
                await loadAllComponents();
                document.getElementById('auth-section').style.display = 'flex';
                document.getElementById('dashboard-section').style.display = 'none';
                showToast("Akun Anda telah dihapus oleh Admin.", "error");
            }
        } else {
            await loadAllComponents();
            document.getElementById('auth-section').style.display = 'flex';
            document.getElementById('dashboard-section').style.display = 'none';
        }
    });
});