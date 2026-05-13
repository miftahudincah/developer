// main.js - VERSION 3.0 (FIXED - NO DUPLICATE LISTENERS)
// Fokus: Session persistence, Auth state handler, Periodic refresh
// Semua Firebase data listeners sudah dipindahkan ke init.js

// ======================== GLOBAL VARIABLES ========================
let refreshInterval = null;
let isInitialized = false;

// ======================== SESSION PERSISTENCE ========================

/**
 * Menyimpan data user ke localStorage
 */
function saveUserToLocalStorage(userData) {
    if (!userData) {
        localStorage.removeItem('currentUser');
        return;
    }
    
    const storageData = {
        uid: userData.uid,
        email: userData.email,
        nama: userData.nama,
        role: userData.role,
        kelas: userData.kelas || '',
        jurusan: userData.jurusan || '',
        fpId: userData.fpId || null,
        photoUrl: userData.photoUrl || '',
        subject: userData.subject || '',
        registeredAt: userData.registeredAt
    };
    localStorage.setItem('currentUser', JSON.stringify(storageData));
}

/**
 * Memuat data user dari localStorage
 */
function loadUserFromLocalStorage() {
    const savedData = localStorage.getItem('currentUser');
    if (savedData) {
        try {
            return JSON.parse(savedData);
        } catch (e) {
            console.error("Error parsing localStorage data:", e);
            localStorage.removeItem('currentUser');
        }
    }
    return null;
}

/**
 * Membersihkan session
 */
function clearUserSession() {
    localStorage.removeItem('currentUser');
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// ======================== PERIODIC REFRESH (FALLBACK) ========================

/**
 * Memulai periodic refresh sebagai fallback jika websocket bermasalah
 * Hanya melakukan sekali value, BUKAN on() listener
 */
function startPeriodicRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    
    // Refresh setiap 30 detik sebagai fallback (hanya sekali value, BUKAN on)
    refreshInterval = setInterval(() => {
        if (currentUser && typeof db !== 'undefined' && db) {
            console.log("🔄 Periodic refresh check (fallback)...");
            // Hanya refresh data yang penting, BUKAN attach listener baru
            db.ref('users').once('value').catch(err => console.warn("Periodic refresh users error:", err));
            db.ref('users_auth').once('value').catch(err => console.warn("Periodic refresh users_auth error:", err));
            db.ref('absensi').once('value').catch(err => console.warn("Periodic refresh absensi error:", err));
        }
    }, 30000);
}

/**
 * Hentikan periodic refresh
 */
function stopPeriodicRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
        console.log("⏹️ Periodic refresh stopped");
    }
}

// ======================== LOAD COMPONENTS ========================

/**
 * Memuat event listeners untuk berbagai komponen
 * Hanya event listener UI, BUKAN Firebase listeners
 */
async function loadDashboardComponents() {
    console.log("🔧 Loading dashboard components...");
    
    // Inisialisasi listener delay untuk form siswa
    if (typeof initDelayEventListeners === 'function') {
        try {
            initDelayEventListeners();
        } catch(e) { console.warn("initDelayEventListeners error:", e); }
    } else if (typeof initManualDelayListeners === 'function') {
        try {
            initManualDelayListeners();
        } catch(e) { console.warn("initManualDelayListeners error:", e); }
    }
    
    // Inisialisasi listener global delay
    if (typeof initGlobalDelayListeners === 'function') {
        try {
            initGlobalDelayListeners();
        } catch(e) { console.warn("initGlobalDelayListeners error:", e); }
    }
    
    // Setup chart year listener
    if (typeof setupChartYearListener === 'function') {
        try {
            setupChartYearListener();
        } catch(e) { console.warn("setupChartYearListener error:", e); }
    }
    
    console.log("✅ Dashboard components loaded");
}

// ======================== AUTH STATE HANDLER ========================

/**
 * Handler untuk perubahan state autentikasi
 * Ini adalah fungsi utama yang mengatur login/logout flow
 */
function initAuthStateHandler() {
    console.log("🚀 Initializing auth state handler...");
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log("👤 User found:", user.email);
            
            try {
                // Cek data user di database
                const snapshot = await db.ref('users_auth/' + user.uid).once('value');
                
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    currentUser = { 
                        uid: user.uid, 
                        email: user.email, 
                        ...userData 
                    };
                    
                    // Normalisasi kelas (uppercase)
                    if (currentUser.kelas) currentUser.kelas = currentUser.kelas.toUpperCase();
                    
                    // Simpan ke localStorage
                    saveUserToLocalStorage(currentUser);
                    
                    // Inisialisasi periodic refresh (fallback) - HANYA SEKALI
                    if (!isInitialized) {
                        startPeriodicRefresh();
                        isInitialized = true;
                    }
                    
                    // Muat dashboard components (UI listeners)
                    await loadDashboardComponents();
                    
                    // Inisialisasi app (render UI)
                    if (typeof initApp === 'function') {
                        initApp();
                    } else {
                        console.error("❌ initApp function not found!");
                        // Fallback: tampilkan dashboard
                        const authSection = document.getElementById('auth-section');
                        const dashboardSection = document.getElementById('dashboard-section');
                        if (authSection) authSection.style.display = 'none';
                        if (dashboardSection) dashboardSection.style.display = 'block';
                    }
                    
                    console.log("✅ Login successful for:", currentUser.nama);
                    
                } else {
                    console.warn("⚠️ User data not found in database!");
                    clearUserSession();
                    await auth.signOut();
                    showAuthScreen();
                    
                    if (typeof showToast === 'function') {
                        showToast("Akun Anda telah dihapus oleh Admin.", "error");
                    }
                }
            } catch (err) {
                console.error("Auth state handler error:", err);
                showAuthScreen();
                if (typeof showToast === 'function') {
                    showToast("Error memuat data user: " + err.message, "error");
                }
            }
        } else {
            console.log("👤 No user logged in");
            
            // Hapus session yang tersimpan (jika ada)
            const savedUser = loadUserFromLocalStorage();
            if (savedUser && savedUser.uid) {
                console.log("📱 Clearing invalid saved session...");
                clearUserSession();
            }
            
            // Stop periodic refresh
            stopPeriodicRefresh();
            isInitialized = false;
            
            // Tampilkan layar login
            showAuthScreen();
        }
    });
}

/**
 * Menampilkan layar auth (login/register) dan menyembunyikan dashboard
 */
function showAuthScreen() {
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    
    if (authSection) authSection.style.display = 'flex';
    if (dashboardSection) dashboardSection.style.display = 'none';
    
    // Reset currentUser
    currentUser = null;
}

/**
 * Menampilkan layar dashboard dan menyembunyikan auth
 */
function showDashboardScreen() {
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    
    if (authSection) authSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'block';
}

// ======================== HELPER FUNCTIONS ========================

/**
 * Force refresh semua data (manual)
 * Hanya melakukan once() value, BUKAN re-attach listeners
 */
function forceRefreshAllData() {
    console.log("🔄 Manual force refresh triggered...");
    
    if (typeof db !== 'undefined' && db) {
        db.ref('users').once('value').catch(err => console.warn("Refresh users error:", err));
        db.ref('users_auth').once('value').catch(err => console.warn("Refresh users_auth error:", err));
        db.ref('absensi').once('value').catch(err => console.warn("Refresh absensi error:", err));
        db.ref('codes').once('value').catch(err => console.warn("Refresh codes error:", err));
        db.ref('school_config').once('value').catch(err => console.warn("Refresh school_config error:", err));
        db.ref('settings/delayOut').once('value').catch(err => console.warn("Refresh delayOut error:", err));
    }
    
    if (typeof showToast === 'function') {
        showToast("🔄 Data berhasil direfresh!", "success");
    }
}

/**
 * Reset semua state (dipanggil saat logout)
 */
function resetAppState() {
    console.log("🔄 Resetting app state...");
    
    // Stop periodic refresh
    stopPeriodicRefresh();
    
    // Reset flags
    isInitialized = false;
    
    // Reset global data
    if (typeof dbData !== 'undefined') {
        dbData = {
            users: [],
            users_auth: [],
            attendance: [],
            codes: []
        };
    }
    
    // Cleanup modul-modul lain (akan dipanggil oleh handleLogout)
    console.log("✅ App state reset complete");
}

// ======================== EKSPOR KE GLOBAL ========================
window.forceRefreshAllData = forceRefreshAllData;
window.saveUserToLocalStorage = saveUserToLocalStorage;
window.clearUserSession = clearUserSession;
window.showAuthScreen = showAuthScreen;
window.showDashboardScreen = showDashboardScreen;
window.resetAppState = resetAppState;
window.stopPeriodicRefresh = stopPeriodicRefresh;

// ======================== AUTO INITIALIZATION ========================
// Tunggu DOM dan Firebase siap sebelum inisialisasi auth handler

function waitForFirebaseAndInit() {
    if (typeof db === 'undefined' || !db || typeof auth === 'undefined' || !auth) {
        console.log("⏳ Waiting for Firebase (db/auth)...");
        setTimeout(waitForFirebaseAndInit, 500);
        return;
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => initAuthStateHandler(), 100);
        });
    } else {
        setTimeout(() => initAuthStateHandler(), 100);
    }
}

// Mulai inisialisasi
waitForFirebaseAndInit();

console.log("✅ main.js V3.0 loaded - No duplicate Firebase listeners");