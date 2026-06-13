// Halaman Login
if (document.getElementById('loginForm')) {
    const loginForm = document.getElementById('loginForm');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');
        
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                saveAuthData(data.token, data.user);
                showAlert('alertMessage', 'Login berhasil! Mengalihkan...', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                showAlert('alertMessage', data.error || 'Login gagal', 'error');
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            }
        } catch (error) {
            console.error('Login error:', error);
            showAlert('alertMessage', 'Terjadi kesalahan: ' + error.message, 'error');
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        }
    });
}

// Halaman Register
if (document.getElementById('registerForm')) {
    const registerForm = document.getElementById('registerForm');
    
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const role = document.getElementById('role').value;
        const registerBtn = document.getElementById('registerBtn');
        
        if (password !== confirmPassword) {
            showAlert('alertMessage', 'Password tidak cocok!', 'error');
            return;
        }
        
        if (password.length < 6) {
            showAlert('alertMessage', 'Password minimal 6 karakter!', 'error');
            return;
        }
        
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        
        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showAlert('alertMessage', 'Registrasi berhasil! Silakan login.', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            } else {
                showAlert('alertMessage', data.error || 'Registrasi gagal', 'error');
                registerBtn.disabled = false;
                registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Daftar';
            }
        } catch (error) {
            console.error('Register error:', error);
            showAlert('alertMessage', 'Terjadi kesalahan: ' + error.message, 'error');
            registerBtn.disabled = false;
            registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Daftar';
        }
    });
}

// Cek login status untuk halaman dashboard
if (window.location.pathname.includes('dashboard.html')) {
    if (!requireAuth()) {
        // Redirect sudah di handle di requireAuth
    }
}