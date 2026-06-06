// firebase.js - VERSION 3.0 (INTEGRATED WITH VERCEL BACKEND API)
// Fungsi untuk sinkronisasi data ke Firebase Realtime Database dan Backend API
// V3.0: Terintegrasi dengan API backend Vercel untuk operasi CRUD
// ============================================================================

// Backend API URL (Vercel)
const BACKEND_API_URL = "https://absensi-backend-3we5.vercel.app/api";

// Firebase Database URL (fallback)
const DATABASE_URL = "https://absensi-4389a-default-rtdb.firebaseio.com/";

// Konfigurasi
const SYNC_CONFIG = {
    retryAttempts: 3,
    retryDelay: 1000,
    batchSize: 10,
    enableAPISync: true,      // Sinkronisasi ke API backend
    enableFirebaseSync: true  // Sinkronisasi ke Firebase (fallback)
};

// Queue untuk sync yang gagal
let syncQueue = [];
let isProcessingQueue = false;

// ======================= FUNGSI UTILITY =======================

/**
 * Delay function untuk retry mechanism
 * @param {number} ms - Milidetik
 * @returns {Promise}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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
 * @param {string} endpoint - Endpoint API
 * @param {Object} options - Options fetch
 * @returns {Promise<any>}
 */
async function apiRequest(endpoint, options = {}) {
    try {
        const token = await getAuthToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        };
        
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
        console.warn(`API request failed: ${endpoint}`, error);
        throw error;
    }
}

/**
 * Melakukan request ke Firebase Realtime Database
 * @param {string} path - Path di database
 * @param {string} method - HTTP method
 * @param {Object} data - Data yang akan dikirim
 * @returns {Promise<any>}
 */
async function firebaseRequest(path, method = 'GET', data = null) {
    const url = `${DATABASE_URL}${path}.json`;
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (data && (method === 'PUT' || method === 'POST' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        if (method !== 'DELETE') {
            return await response.json();
        }
        return true;
    } catch (error) {
        console.error(`Firebase request failed: ${path}`, error);
        throw error;
    }
}

// ======================= SINKRONISASI SISWA =======================

/**
 * Sinkronisasi data siswa ke API backend dan Firebase
 * @param {Object} user - Data siswa
 * @param {number} retryCount - Jumlah percobaan saat ini
 * @returns {Promise<boolean>}
 */
async function syncUserToFirebase(user, retryCount = 0) {
    if (!user || !user.id) {
        console.error("Invalid user data for sync");
        return false;
    }
    
    const userData = {
        id: parseInt(user.id),
        nama: user.nama,
        kelas: user.kelas,
        jurusan: user.jurusan,
        delayOut: user.delayOut || "60"
    };
    
    let apiSuccess = false;
    let firebaseSuccess = false;
    
    // Sinkronisasi ke API backend
    if (SYNC_CONFIG.enableAPISync) {
        try {
            // Cek apakah user sudah ada
            const existing = await apiRequest(`/students/${user.id}`).catch(() => null);
            
            if (existing && existing.success) {
                // Update existing user
                await apiRequest(`/students/${user.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        nama: userData.nama,
                        kelas: userData.kelas,
                        jurusan: userData.jurusan,
                        delayOut: userData.delayOut
                    })
                });
            } else {
                // Create new user
                await apiRequest('/students', {
                    method: 'POST',
                    body: JSON.stringify(userData)
                });
            }
            
            apiSuccess = true;
            console.log(`✅ API synced for user ${user.id}`);
        } catch (error) {
            console.error(`API sync failed for user ${user.id}:`, error);
            
            if (retryCount < SYNC_CONFIG.retryAttempts) {
                await delay(SYNC_CONFIG.retryDelay);
                return syncUserToFirebase(user, retryCount + 1);
            }
        }
    }
    
    // Sinkronisasi ke Firebase (fallback)
    if (SYNC_CONFIG.enableFirebaseSync) {
        try {
            await firebaseRequest(`users/${user.id}`, 'PUT', userData);
            firebaseSuccess = true;
            console.log(`✅ Firebase synced for user ${user.id}`);
        } catch (error) {
            console.error(`Firebase sync failed for user ${user.id}:`, error);
        }
    }
    
    return apiSuccess || firebaseSuccess;
}

/**
 * Bulk sync multiple users
 * @param {Array} users - Array data siswa
 * @returns {Promise<Object>}
 */
async function bulkSyncUsers(users) {
    if (!users || users.length === 0) return { success: 0, failed: 0 };
    
    console.log(`📦 Bulk syncing ${users.length} users...`);
    
    let success = 0;
    let failed = 0;
    
    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < users.length; i += SYNC_CONFIG.batchSize) {
        const batch = users.slice(i, i + SYNC_CONFIG.batchSize);
        const promises = batch.map(user => syncUserToFirebase(user));
        
        const results = await Promise.all(promises);
        results.forEach(result => {
            if (result) success++;
            else failed++;
        });
        
        console.log(`📊 Batch progress: ${success + failed}/${users.length}`);
    }
    
    console.log(`✅ Bulk sync complete: ${success} success, ${failed} failed`);
    return { success, failed };
}

// ======================= SINKRONISASI ABSENSI =======================

/**
 * Sinkronisasi data absensi ke API backend dan Firebase
 * @param {Object} log - Data absensi
 * @param {Object} user - Data user
 * @param {number} retryCount - Jumlah percobaan saat ini
 * @returns {Promise<boolean>}
 */
async function syncAttendanceToFirebase(log, user, retryCount = 0) {
    if (!log || !log.studentId) {
        console.error("Invalid attendance data for sync");
        return false;
    }
    
    const dateStr = new Date(log.timestamp).toISOString().split('T')[0];
    const timeStr = new Date(log.timestamp).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Tentukan status berdasarkan waktu
    const lateThreshold = '07:30';
    const isLate = timeStr > lateThreshold;
    const status = isLate ? 'Terlambat' : 'Hadir';
    
    const attendanceData = {
        studentId: parseInt(log.studentId),
        nama: user.nama,
        kelas: user.kelas,
        jurusan: user.jurusan,
        in: timeStr,
        out: null,
        date: dateStr,
        status: status,
        timestamp: log.timestamp
    };
    
    let apiSuccess = false;
    let firebaseSuccess = false;
    
    // Sinkronisasi ke API backend via simulate-in
    if (SYNC_CONFIG.enableAPISync) {
        try {
            await apiRequest('/attendance/simulate-in', {
                method: 'POST',
                body: JSON.stringify({
                    studentId: log.studentId,
                    status: 'hadir'
                })
            });
            
            apiSuccess = true;
            console.log(`✅ API synced for attendance ${log.studentId} at ${timeStr}`);
        } catch (error) {
            console.error(`API sync failed for attendance ${log.studentId}:`, error);
            
            if (retryCount < SYNC_CONFIG.retryAttempts) {
                await delay(SYNC_CONFIG.retryDelay);
                return syncAttendanceToFirebase(log, user, retryCount + 1);
            }
        }
    }
    
    // Sinkronisasi ke Firebase (fallback)
    if (SYNC_CONFIG.enableFirebaseSync) {
        try {
            const firebaseData = {
                nama: user.nama,
                kelas: user.kelas,
                jurusan: user.jurusan,
                in: timeStr,
                out: "",
                status: status
            };
            
            await firebaseRequest(`absensi/${dateStr}/${log.studentId}`, 'PUT', firebaseData);
            firebaseSuccess = true;
            console.log(`✅ Firebase synced for attendance ${log.studentId}`);
        } catch (error) {
            console.error(`Firebase sync failed for attendance ${log.studentId}:`, error);
        }
    }
    
    return apiSuccess || firebaseSuccess;
}

/**
 * Sinkronisasi absensi pulang
 * @param {string} studentId - ID siswa
 * @param {number} timestamp - Timestamp
 * @param {number} retryCount - Jumlah percobaan
 * @returns {Promise<boolean>}
 */
async function syncAttendanceOutToFirebase(studentId, timestamp, retryCount = 0) {
    if (!studentId) {
        console.error("Invalid student ID for attendance out");
        return false;
    }
    
    const dateStr = new Date(timestamp).toISOString().split('T')[0];
    const timeOutStr = new Date(timestamp).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    let apiSuccess = false;
    let firebaseSuccess = false;
    
    // Sinkronisasi ke API backend via simulate-out
    if (SYNC_CONFIG.enableAPISync) {
        try {
            await apiRequest('/attendance/simulate-out', {
                method: 'POST',
                body: JSON.stringify({ studentId })
            });
            
            apiSuccess = true;
            console.log(`✅ API synced for attendance out ${studentId} at ${timeOutStr}`);
        } catch (error) {
            console.error(`API sync failed for attendance out ${studentId}:`, error);
            
            if (retryCount < SYNC_CONFIG.retryAttempts) {
                await delay(SYNC_CONFIG.retryDelay);
                return syncAttendanceOutToFirebase(studentId, timestamp, retryCount + 1);
            }
        }
    }
    
    // Sinkronisasi ke Firebase (fallback)
    if (SYNC_CONFIG.enableFirebaseSync) {
        try {
            // Ambil data absensi yang ada
            const existing = await firebaseRequest(`absensi/${dateStr}/${studentId}`, 'GET');
            
            if (existing) {
                const updateData = {
                    ...existing,
                    out: timeOutStr,
                    status: 'Pulang'
                };
                
                await firebaseRequest(`absensi/${dateStr}/${studentId}`, 'PUT', updateData);
                firebaseSuccess = true;
                console.log(`✅ Firebase synced for attendance out ${studentId}`);
            }
        } catch (error) {
            console.error(`Firebase sync failed for attendance out ${studentId}:`, error);
        }
    }
    
    return apiSuccess || firebaseSuccess;
}

// ======================= QUEUE MANAGEMENT =======================

/**
 * Menambahkan task ke queue untuk diproses nanti
 * @param {Object} task - Task yang akan diqueue
 */
function addToSyncQueue(task) {
    syncQueue.push(task);
    processSyncQueue();
}

/**
 * Memproses queue sinkronisasi
 */
async function processSyncQueue() {
    if (isProcessingQueue || syncQueue.length === 0) return;
    
    isProcessingQueue = true;
    
    while (syncQueue.length > 0) {
        const task = syncQueue.shift();
        
        try {
            switch (task.type) {
                case 'user':
                    await syncUserToFirebase(task.data);
                    break;
                case 'attendance_in':
                    await syncAttendanceToFirebase(task.data, task.user);
                    break;
                case 'attendance_out':
                    await syncAttendanceOutToFirebase(task.studentId, task.timestamp);
                    break;
                default:
                    console.warn(`Unknown task type: ${task.type}`);
            }
        } catch (error) {
            console.error(`Failed to process task:`, error);
            // Re-queue jika masih bisa dicoba
            if (task.retryCount < SYNC_CONFIG.retryAttempts) {
                task.retryCount = (task.retryCount || 0) + 1;
                syncQueue.push(task);
            }
        }
        
        // Delay antar task untuk menghindari rate limiting
        await delay(100);
    }
    
    isProcessingQueue = false;
}

// ======================= FUNGSI PEMBANTU LAINNYA =======================

/**
 * Hapus data siswa dari API dan Firebase
 * @param {string|number} studentId - ID siswa
 * @returns {Promise<boolean>}
 */
async function deleteStudentFromSync(studentId) {
    let apiSuccess = false;
    let firebaseSuccess = false;
    
    if (SYNC_CONFIG.enableAPISync) {
        try {
            await apiRequest(`/students/${studentId}`, { method: 'DELETE' });
            apiSuccess = true;
            console.log(`✅ API deleted student ${studentId}`);
        } catch (error) {
            console.error(`API delete failed for student ${studentId}:`, error);
        }
    }
    
    if (SYNC_CONFIG.enableFirebaseSync) {
        try {
            await firebaseRequest(`users/${studentId}`, 'DELETE');
            firebaseSuccess = true;
            console.log(`✅ Firebase deleted student ${studentId}`);
        } catch (error) {
            console.error(`Firebase delete failed for student ${studentId}:`, error);
        }
    }
    
    return apiSuccess || firebaseSuccess;
}

/**
 * Hapus data absensi dari API dan Firebase
 * @param {string} date - Tanggal absensi
 * @param {string|number} studentId - ID siswa
 * @returns {Promise<boolean>}
 */
async function deleteAttendanceFromSync(date, studentId) {
    let apiSuccess = false;
    let firebaseSuccess = false;
    
    if (SYNC_CONFIG.enableAPISync) {
        try {
            await apiRequest(`/attendance/${date}/${studentId}`, { method: 'DELETE' });
            apiSuccess = true;
            console.log(`✅ API deleted attendance ${studentId} on ${date}`);
        } catch (error) {
            console.error(`API delete failed for attendance:`, error);
        }
    }
    
    if (SYNC_CONFIG.enableFirebaseSync) {
        try {
            await firebaseRequest(`absensi/${date}/${studentId}`, 'DELETE');
            firebaseSuccess = true;
            console.log(`✅ Firebase deleted attendance ${studentId} on ${date}`);
        } catch (error) {
            console.error(`Firebase delete failed for attendance:`, error);
        }
    }
    
    return apiSuccess || firebaseSuccess;
}

/**
 * Cek status koneksi ke API backend
 * @returns {Promise<boolean>}
 */
async function checkAPIConnection() {
    try {
        const response = await fetch(`${BACKEND_API_URL}/health`);
        const data = await response.json();
        return data.status === 'OK';
    } catch (error) {
        console.warn("API connection check failed:", error);
        return false;
    }
}

/**
 * Cek status koneksi ke Firebase
 * @returns {Promise<boolean>}
 */
async function checkFirebaseConnection() {
    try {
        await firebaseRequest('.info/connected', 'GET');
        return true;
    } catch (error) {
        console.warn("Firebase connection check failed:", error);
        return false;
    }
}

/**
 * Mendapatkan status sinkronisasi
 * @returns {Object}
 */
function getSyncStatus() {
    return {
        config: SYNC_CONFIG,
        queueLength: syncQueue.length,
        isProcessing: isProcessingQueue,
        apiUrl: BACKEND_API_URL,
        databaseUrl: DATABASE_URL
    };
}

/**
 * Reset queue sinkronisasi
 */
function resetSyncQueue() {
    syncQueue = [];
    isProcessingQueue = false;
    console.log("🔄 Sync queue reset");
}

// ======================= INISIALISASI =======================

// Cek koneksi saat startup
setTimeout(async () => {
    const apiConnected = await checkAPIConnection();
    const firebaseConnected = await checkFirebaseConnection();
    
    console.log(`🔌 Connection status - API: ${apiConnected ? '✅' : '❌'}, Firebase: ${firebaseConnected ? '✅' : '❌'}`);
    
    // Adjust config based on connection status
    SYNC_CONFIG.enableAPISync = apiConnected;
    SYNC_CONFIG.enableFirebaseSync = firebaseConnected || true;
}, 1000);

// ======================= EKSPOR KE GLOBAL =======================
window.syncUserToFirebase = syncUserToFirebase;
window.syncAttendanceToFirebase = syncAttendanceToFirebase;
window.syncAttendanceOutToFirebase = syncAttendanceOutToFirebase;
window.bulkSyncUsers = bulkSyncUsers;
window.deleteStudentFromSync = deleteStudentFromSync;
window.deleteAttendanceFromSync = deleteAttendanceFromSync;
window.addToSyncQueue = addToSyncQueue;
window.getSyncStatus = getSyncStatus;
window.resetSyncQueue = resetSyncQueue;
window.checkAPIConnection = checkAPIConnection;
window.checkFirebaseConnection = checkFirebaseConnection;
window.apiRequest = apiRequest;
window.firebaseRequest = firebaseRequest;

console.log("✅ firebase.js V3.0 loaded - Terintegrasi dengan API Backend Vercel untuk sinkronisasi data!");