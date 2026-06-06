// ================== KONFIGURASI FIREBASE (AMAN) ==================
// Peringatan: API Key tetap terekspos di client-side.
// Untuk keamanan production, WAJIB mengaktifkan:
// 1. Firebase App Check (ReCaptcha v3) - tapi jangan gunakan kunci dummy!
// 2. Security Rules yang ketat
// 3. Cloud Functions untuk operasi sensitif (registrasi, hapus data)
// V6.0: Menambahkan konfigurasi untuk backend API Vercel

const firebaseConfig = {
  apiKey: "AIzaSyBZg9NpbBAg8dKHkCbYf4J_2bpHH2ZJWWI",
  authDomain: "absensi-4389a-default-rtdb.firebaseapp.com",
  databaseURL: "https://absensi-4389a-default-rtdb.firebaseio.com",
  projectId: "absensi-4389a-default-rtdb",
  storageBucket: "absensi-4389a-default-rtdb.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// ==================== BACKEND API VERCEL CONFIG ====================
// URL API Backend yang sudah dideploy di Vercel
const BACKEND_API_URL = "https://absensi-backend-3we5.vercel.app/api";

// API Key ImgBB - Hanya untuk upload gambar profile/status
// PERINGATAN: Di production, pindahkan upload ke Cloud Function
const IMGBB_KEY = "67650d8ee67ebb8bba94f3bb2c72eb4f";

// ==================== WHATSAPP GATEWAY CONFIG ====================
// Gunakan Fonnte API: https://fonnte.com (daftar gratis, 100 pesan/hari)
// Cara setup:
// 1. Daftar di https://fonnte.com
// 2. Verifikasi nomor WhatsApp
// 3. Dapatkan API Key dari dashboard
// 4. API Key sudah diisi dengan key asli Anda
const WHATSAPP_CONFIG = {
    gateway: 'fonnte',           // 'fonnte', 'waba', 'wati'
    fonnteApiKey: '2VoL53ZrVsDPxwDTNPdY', // API Key asli dari Fonnte
    enabled: true,               // Aktifkan/nonaktifkan notifikasi WA
    sendOnCheckIn: true,         // Notifikasi saat masuk
    sendOnCheckOut: true,        // Notifikasi saat pulang
    sendOnLate: true,            // Notifikasi jika terlambat
    sendOnAbsent: true,          // Notifikasi jika alpha (tidak hadir)
    senderNumber: ''             // Nomor pengirim (opsional, kosongkan jika pakai default)
};

// ==================== KONFIGURASI IZIN ONLINE ====================
const IZIN_CONFIG = {
    enabled: true,               // Aktifkan fitur izin online
    maxFileSize: 2 * 1024 * 1024, // Maksimal 2MB untuk lampiran
    allowedFileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
    autoApprove: false,          // True jika izin otomatis disetujui (tanpa review)
    notificationOnApprove: true, // Kirim notifikasi saat izin disetujui
    notificationOnReject: true   // Kirim notifikasi saat izin ditolak
};

// ==================== ROLE DISPLAY NAMES ====================
// Mapping role internal ke tampilan nama yang ramah pengguna
const ROLE_DISPLAY_NAMES = {
    admin: 'Kepala Sekolah',
    wakil_kepala: 'Wakil Kepala Sekolah',
    staff_tu: 'Staff TU',
    guru: 'Guru',
    developer: 'Developer',
    siswa: 'Siswa'
};

// ==================== ROLE ICONS ====================
const ROLE_ICONS = {
    admin: '👑',
    wakil_kepala: '👔',
    staff_tu: '📋',
    guru: '👨‍🏫',
    developer: '👨‍💻',
    siswa: '👨‍🎓'
};

// ==================== ROLE PERMISSIONS ====================
// Definisi akses untuk setiap role
const ROLE_PERMISSIONS = {
    // Role dengan akses penuh (super admin)
    full_access: ['admin', 'developer'],
    
    // Role yang bisa mengelola data (tambah/edit/hapus siswa, staff, dll)
    management_access: ['admin', 'developer', 'wakil_kepala', 'guru'],
    
    // Role yang bisa membaca semua data (tanpa bisa edit)
    read_all_access: ['admin', 'developer', 'wakil_kepala', 'guru', 'staff_tu'],
    
    // Role yang bisa mengelola pengumuman
    announcement_access: ['admin', 'developer', 'wakil_kepala', 'guru'],
    
    // Role yang bisa mengelola user (tambah/edit/hapus akun)
    user_management_access: ['admin', 'developer'],
    
    // Role yang bisa melihat log aktivitas
    log_access: ['admin', 'developer', 'wakil_kepala'],
    
    // Role yang bisa mengelola pengaturan sistem
    config_access: ['admin', 'developer', 'wakil_kepala'],
    
    // Role yang bisa mengelola staff (guru/karyawan)
    staff_management_access: ['admin', 'developer', 'wakil_kepala', 'guru'],
    
    // Role yang bisa mengelola izin online
    izin_management_access: ['admin', 'developer', 'wakil_kepala', 'guru', 'staff_tu'],
    
    // Role yang bisa mengakses rekap absensi
    rekap_access: ['admin', 'developer', 'wakil_kepala', 'guru', 'staff_tu'],
    
    // Role yang bisa mengakses AI Summary
    ai_summary_access: ['admin', 'developer', 'wakil_kepala', 'guru'],
    
    // Role yang bisa mengakses dashboard penuh
    full_dashboard_access: ['admin', 'developer', 'wakil_kepala', 'guru', 'staff_tu'],
    
    // Role yang bisa mengakses chat
    chat_access: ['admin', 'developer', 'wakil_kepala', 'guru', 'staff_tu', 'siswa'],
    
    // Role yang bisa mengirim pengumuman
    send_announcement_access: ['admin', 'developer', 'wakil_kepala', 'guru']
};

// ==================== FUNGSI UTILITY ROLE ====================

/**
 * Mendapatkan display name untuk suatu role
 * @param {string} role - Role internal (admin, guru, dll)
 * @returns {string} Nama tampilan yang ramah pengguna
 */
function getRoleDisplayName(role) {
    return ROLE_DISPLAY_NAMES[role] || role.toUpperCase();
}

/**
 * Mendapatkan icon untuk suatu role
 * @param {string} role - Role internal
 * @returns {string} Emoji icon
 */
function getRoleIcon(role) {
    return ROLE_ICONS[role] || '👤';
}

/**
 * Cek apakah suatu role memiliki permission tertentu
 * @param {string} role - Role yang akan dicek
 * @param {string} permissionType - Jenis permission (full_access, management_access, dll)
 * @returns {boolean} True jika memiliki akses
 */
function hasPermission(role, permissionType) {
    if (!role) return false;
    const allowedRoles = ROLE_PERMISSIONS[permissionType];
    return allowedRoles ? allowedRoles.includes(role) : false;
}

/**
 * Mendapatkan daftar semua role yang tersedia (untuk dropdown)
 * @returns {Array} Daftar role dengan display name dan icon
 */
function getAllRoles() {
    return [
        { value: 'admin', label: 'Kepala Sekolah', icon: '👑' },
        { value: 'wakil_kepala', label: 'Wakil Kepala Sekolah', icon: '👔' },
        { value: 'staff_tu', label: 'Staff TU', icon: '📋' },
        { value: 'guru', label: 'Guru', icon: '👨‍🏫' },
        { value: 'developer', label: 'Developer', icon: '👨‍💻' },
        { value: 'siswa', label: 'Siswa', icon: '👨‍🎓' }
    ];
}

/**
 * Validasi apakah role valid
 * @param {string} role - Role yang divalidasi
 * @returns {boolean}
 */
function isValidRole(role) {
    const validRoles = ['admin', 'wakil_kepala', 'staff_tu', 'guru', 'developer', 'siswa'];
    return validRoles.includes(role);
}

/**
 * Mendapatkan priority level role (untuk sorting)
 * @param {string} role - Role
 * @returns {number} Priority (1 tertinggi)
 */
function getRolePriority(role) {
    const priorities = {
        developer: 1,
        admin: 2,
        wakil_kepala: 3,
        guru: 4,
        staff_tu: 5,
        siswa: 6
    };
    return priorities[role] || 99;
}

/**
 * Mendapatkan daftar role yang memiliki permission tertentu
 * @param {string} permissionType - Jenis permission
 * @returns {Array} Daftar role
 */
function getRolesWithPermission(permissionType) {
    return ROLE_PERMISSIONS[permissionType] || [];
}

// ==================== FUNGSI API BACKEND ====================

/**
 * Mendapatkan token autentikasi dari Firebase
 * @returns {Promise<string|null>}
 */
async function getAuthToken() {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        try {
            return await firebase.auth().currentUser.getIdToken();
        } catch (error) {
            console.warn("Failed to get auth token:", error);
            return null;
        }
    }
    return null;
}

/**
 * Melakukan request ke backend API Vercel
 * @param {string} endpoint - Endpoint API (contoh: '/students')
 * @param {Object} options - Options fetch (method, body, dll)
 * @returns {Promise<any>}
 */
async function apiRequest(endpoint, options = {}) {
    const token = await getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };
    
    try {
        const response = await fetch(`${BACKEND_API_URL}${endpoint}`, {
            ...options,
            headers
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        return data;
    } catch (error) {
        console.error(`API request failed: ${endpoint}`, error);
        throw error;
    }
}

/**
 * Cek kesehatan backend API
 * @returns {Promise<boolean>}
 */
async function checkBackendHealth() {
    try {
        const response = await fetch(`${BACKEND_API_URL}/health`);
        const data = await response.json();
        return data.status === 'OK';
    } catch (error) {
        console.warn("Backend health check failed:", error);
        return false;
    }
}

// ==================== INISIALISASI FIREBASE ====================

// Pastikan Firebase SDK sudah dimuat sebelum inisialisasi
if (typeof firebase === 'undefined') {
  console.error("❌ Firebase SDK tidak dimuat! Periksa koneksi internet dan urutan script.");
} else {
  console.log("🔥 Firebase SDK terdeteksi, menginisialisasi...");
}

// Initialize Firebase
let auth = null;
let db = null;
let storage = null;

try {
  // Cek apakah Firebase sudah diinisialisasi
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("✅ Firebase berhasil diinisialisasi");
  } else {
    console.log("✅ Firebase sudah diinisialisasi sebelumnya");
  }
  
  auth = firebase.auth();
  db = firebase.database();
  storage = firebase.storage();
  
  console.log("📡 auth, db, dan storage siap:", { auth: !!auth, db: !!db, storage: !!storage });
  
  // Simpan ke global
  window.auth = auth;
  window.db = db;
  window.storage = storage;
  
} catch (err) {
  console.error("❌ Gagal initialize Firebase:", err);
}

// ================== FIREBASE APP CHECK (Keamanan) ==================
// PERINGATAN: Jangan aktifkan App Check dengan kunci palsu!
// Jika ingin mengaktifkan, daftar di https://console.firebase.google.com/project/_/appcheck
// dan gunakan site key yang valid. Untuk sementara, nonaktifkan dulu.
/*
if (typeof firebase.appCheck !== 'undefined') {
  try {
    const appCheck = firebase.appCheck();
    appCheck.activate('YOUR_RECAPTCHA_SITE_KEY', true);
    console.log("✅ App Check diaktifkan");
  } catch (e) {
    console.warn("⚠️ App Check gagal diaktifkan:", e);
  }
}
*/

// ================== VALIDASI KONEKSI ==================
// Cegah penggunaan di luar domain yang diizinkan (opsional)
const allowedDomains = ['absensi-4389a.web.app', 'localhost', '127.0.0.1', 'absensi-backend-3we5.vercel.app'];
const origin = window.location.hostname;
if (!allowedDomains.includes(origin) && !origin.endsWith('.web.app') && !origin.endsWith('.vercel.app')) {
  console.warn('⚠️ Domain tidak dikenal, beberapa fitur mungkin dibatasi');
  // Bisa juga redirect ke halaman error
  // window.location.href = '/error.html';
} else {
  console.log(`✅ Domain diizinkan: ${origin}`);
}

// ==================== CEK KONEKSI DATABASE ====================
// Fungsi untuk memeriksa koneksi ke Firebase
function checkFirebaseConnection() {
  if (!db) {
    console.error('❌ Database tidak tersedia');
    return false;
  }
  
  // Cek koneksi realtime database
  const connectedRef = firebase.database().ref('.info/connected');
  connectedRef.on('value', (snap) => {
    if (snap.val() === true) {
      console.log('✅ Terhubung ke Firebase Realtime Database');
      if (typeof showToast === 'function') {
        showToast('Tersambung ke server database', 'success');
      }
    } else {
      console.warn('⚠️ Tidak terhubung ke Firebase Realtime Database');
      if (typeof showToast === 'function') {
        showToast('Koneksi database terputus!', 'error');
      }
    }
  });
  
  return true;
}

// ==================== CEK KONEKSI BACKEND API ====================
async function checkBackendConnection() {
  try {
    const isHealthy = await checkBackendHealth();
    if (isHealthy) {
      console.log('✅ Terhubung ke Backend API Vercel');
      if (typeof showToast === 'function') {
        showToast('Tersambung ke server backend', 'success');
      }
    } else {
      console.warn('⚠️ Backend API tidak merespon dengan benar');
    }
    return isHealthy;
  } catch (error) {
    console.warn('⚠️ Tidak terhubung ke Backend API Vercel:', error.message);
    return false;
  }
}

// ==================== EKSPOR KE GLOBAL ====================
window.WHATSAPP_CONFIG = WHATSAPP_CONFIG;
window.IZIN_CONFIG = IZIN_CONFIG;
window.IMGBB_KEY = IMGBB_KEY;
window.firebaseConfig = firebaseConfig;
window.BACKEND_API_URL = BACKEND_API_URL;

// Ekspor role management functions
window.ROLE_DISPLAY_NAMES = ROLE_DISPLAY_NAMES;
window.ROLE_ICONS = ROLE_ICONS;
window.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
window.getRoleDisplayName = getRoleDisplayName;
window.getRoleIcon = getRoleIcon;
window.hasPermission = hasPermission;
window.getAllRoles = getAllRoles;
window.isValidRole = isValidRole;
window.getRolePriority = getRolePriority;
window.getRolesWithPermission = getRolesWithPermission;

// Ekspor API backend functions
window.getAuthToken = getAuthToken;
window.apiRequest = apiRequest;
window.checkBackendHealth = checkBackendHealth;
window.checkBackendConnection = checkBackendConnection;

// Ekspor fungsi koneksi
window.checkFirebaseConnection = checkFirebaseConnection;

// Jalankan pengecekan koneksi
setTimeout(() => {
  checkFirebaseConnection();
  checkBackendConnection();
}, 1000);

console.log("✅ config.js V6.0 loaded - Firebase, WhatsApp Gateway, Backend API Vercel, Role Management siap digunakan");