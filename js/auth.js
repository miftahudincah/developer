// ========================================
// AUTHENTICATION MODULE
// ========================================

window.auth = {
    async login() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const loginBtn = document.getElementById('loginBtn');
        
        if (!email || !password) {
            Utils.showStatus('loginStatus', 'Email dan password wajib diisi', 'error');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';

        try {
            let response = await fetch(`${CONFIG.API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            let data = await response.json();

            if (!response.ok && data.message === 'Email atau password salah') {
                // Coba register
                const registerResponse = await fetch(`${CONFIG.API_BASE}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: email,
                        password: password,
                        nama: email.split('@')[0],
                        role: 'siswa'
                    })
                });
                
                const registerData = await registerResponse.json();
                
                if (registerResponse.ok) {
                    data = registerData;
                    response = registerResponse;
                } else {
                    throw new Error(registerData.message || 'Registrasi gagal');
                }
            }

            if (response.ok && data.status === 'success') {
                authToken = data.data.token;
                currentUser = data.data.user;
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                
                // Show main app
                document.getElementById('loginCard').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                
                // Show admin tab if admin/developer
                if (currentUser.role === 'admin' || currentUser.role === 'developer') {
                    const adminBtn = document.getElementById('adminTabBtn');
                    if (adminBtn) adminBtn.style.display = 'flex';
                }
                
                // Load data
                if (window.profile) window.profile.load();
                if (window.absensi) {
                    window.absensi.loadToday();
                    window.absensi.loadRiwayat();
                }
                if (window.gallery) window.gallery.load();
                
                Utils.showStatus('loginStatus', `✅ Login berhasil! Selamat datang ${currentUser.nama}`, 'success');
            } else {
                throw new Error(data.message || 'Login gagal');
            }
        } catch (error) {
            Utils.showStatus('loginStatus', `❌ Error: ${error.message}`, 'error');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        }
    },
    
    logout() {
        authToken = null;
        currentUser = null;
        localStorage.clear();
        location.reload();
    },
    
    showRegisterModal() {
        const modal = document.getElementById('registerModal');
        if (modal) modal.style.display = 'flex';
    },
    
    closeRegisterModal() {
        const modal = document.getElementById('registerModal');
        if (modal) modal.style.display = 'none';
        const status = document.getElementById('registerStatus');
        if (status) status.className = 'status';
    },
    
    async register() {
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const role = document.getElementById('regRole').value;
        
        if (!name || !email || !password) {
            Utils.showStatus('registerStatus', 'Semua field wajib diisi', 'error');
            return;
        }
        
        if (password.length < 6) {
            Utils.showStatus('registerStatus', 'Password minimal 6 karakter', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nama: name, email, password, role })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                Utils.showStatus('registerStatus', '✅ Registrasi berhasil! Silakan login.', 'success');
                setTimeout(() => {
                    window.auth.closeRegisterModal();
                    document.getElementById('loginEmail').value = email;
                }, 1500);
            } else {
                Utils.showStatus('registerStatus', data.message, 'error');
            }
        } catch (error) {
            Utils.showStatus('registerStatus', error.message, 'error');
        }
    }
};