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
        // Tampilkan konfirmasi
        if (confirm('Apakah Anda yakin ingin logout?')) {
            // Hapus semua data session
            authToken = null;
            currentUser = null;
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            
            // Reset tampilan ke halaman login
            document.getElementById('loginCard').style.display = 'block';
            document.getElementById('mainApp').style.display = 'none';
            
            // Reset form login
            document.getElementById('loginPassword').value = '';
            
            // Tampilkan pesan
            Utils.showStatus('loginStatus', '✅ Logout berhasil!', 'success');
        }
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
    },

    // ============ FORGOT PASSWORD ============
    
    showForgotPasswordModal() {
        // Reset form
        document.getElementById('forgotStep1').style.display = 'block';
        document.getElementById('forgotStep2').style.display = 'none';
        document.getElementById('forgotEmail').value = '';
        document.getElementById('resetToken').value = '';
        document.getElementById('resetNewPassword').value = '';
        document.getElementById('resetConfirmPassword').value = '';
        document.getElementById('forgotStatus').className = 'status';
        
        const modal = document.getElementById('forgotPasswordModal');
        if (modal) modal.style.display = 'flex';
    },
    
    closeForgotPasswordModal() {
        const modal = document.getElementById('forgotPasswordModal');
        if (modal) modal.style.display = 'none';
    },
    
    backToForgotStep1() {
        document.getElementById('forgotStep1').style.display = 'block';
        document.getElementById('forgotStep2').style.display = 'none';
        document.getElementById('forgotStatus').className = 'status';
        document.getElementById('resetToken').value = '';
    },
    
    async requestResetPassword() {
        const email = document.getElementById('forgotEmail').value;
        
        if (!email) {
            Utils.showStatus('forgotStatus', 'Masukkan email Anda', 'error');
            return;
        }
        
        const btn = event.target;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                Utils.showStatus('forgotStatus', 
                    '✅ Link reset password telah dikirim. Cek email Anda untuk mendapatkan token reset.\n\n' +
                    (data.resetToken ? `(Development Mode - Token: ${data.resetToken})` : ''), 
                    'success');
                
                setTimeout(() => {
                    document.getElementById('forgotStep1').style.display = 'none';
                    document.getElementById('forgotStep2').style.display = 'block';
                    document.getElementById('forgotStatus').className = 'status';
                }, 2000);
            } else {
                Utils.showStatus('forgotStatus', data.message || 'Gagal mengirim link reset', 'error');
            }
        } catch (error) {
            Utils.showStatus('forgotStatus', `❌ Error: ${error.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Link Reset';
        }
    },
    
    async resetPassword() {
        const token = document.getElementById('resetToken').value;
        const newPassword = document.getElementById('resetNewPassword').value;
        const confirmPassword = document.getElementById('resetConfirmPassword').value;
        
        if (!token || !newPassword || !confirmPassword) {
            Utils.showStatus('forgotStatus', 'Semua field wajib diisi', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            Utils.showStatus('forgotStatus', 'Password baru tidak cocok', 'error');
            return;
        }
        
        if (newPassword.length < 6) {
            Utils.showStatus('forgotStatus', 'Password minimal 6 karakter', 'error');
            return;
        }
        
        const btn = event.target;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mereset...';
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword, confirmPassword })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                Utils.showStatus('forgotStatus', '✅ Password berhasil direset! Silakan login dengan password baru.', 'success');
                
                setTimeout(() => {
                    window.auth.closeForgotPasswordModal();
                    document.getElementById('loginPassword').value = '';
                }, 2000);
            } else {
                Utils.showStatus('forgotStatus', data.message || 'Gagal mereset password', 'error');
            }
        } catch (error) {
            Utils.showStatus('forgotStatus', `❌ Error: ${error.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-key"></i> Reset Password';
        }
    }
};