// Konfigurasi API Backend
const API_BASE_URL = 'https://backendtest-azure.vercel.app/api';

// Konfigurasi Aplikasi
const APP_CONFIG = {
    name: 'Sistem Absensi',
    version: '1.0.0',
    tokenKey: 'absensi_token',
    userKey: 'absensi_user'
};

// Helper functions
function showLoading(show = true) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function showAlert(elementId, message, type = 'info') {
    const alertDiv = document.getElementById(elementId);
    if (alertDiv) {
        alertDiv.textContent = message;
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.display = 'flex';
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 5000);
    }
}

function getToken() {
    return localStorage.getItem(APP_CONFIG.tokenKey);
}

function getUser() {
    const userStr = localStorage.getItem(APP_CONFIG.userKey);
    return userStr ? JSON.parse(userStr) : null;
}

function saveAuthData(token, user) {
    localStorage.setItem(APP_CONFIG.tokenKey, token);
    localStorage.setItem(APP_CONFIG.userKey, JSON.stringify(user));
}

function clearAuthData() {
    localStorage.removeItem(APP_CONFIG.tokenKey);
    localStorage.removeItem(APP_CONFIG.userKey);
}

function isLoggedIn() {
    return !!getToken();
}

function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}