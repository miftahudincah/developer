// db.js - VERSION 4.0 (INTEGRATED WITH VERCEL BACKEND API)
// Memastikan akun zaki5go@gmail.com selalu memiliki role 'developer'
// V4.0: Mengintegrasikan data dari API backend Vercel sebagai sumber utama
// ============================================================================

// Backend API URL (Vercel)
const BACKEND_API_URL = "https://absensi-backend-3we5.vercel.app/api";

// Variabel Global untuk State Lokal
var dbData = {
    users: [],       // Data Siswa (Node: users) -> Untuk ESP32
    users_auth: [],  // Data User Auth (Node: users_auth) -> Untuk Login Web
    attendance: [],  // Data Absensi (Node: absensi)
    codes: []        // Kode Pendaftaran (Node: codes)
};

var currentUser = null;

// Flag untuk listener Firebase
let firebaseListenersAttached = false;
let apiDataLoaded = false;

console.log("📦 dbData initialized with default empty arrays", dbData);

// ======================= FUNGSI API BACKEND =======================

function getAuthToken() {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        return firebase.auth().currentUser.getIdToken();
    }
    return Promise.resolve(null);
}

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
 * Ambil data siswa dari API backend
 */
async function fetchStudentsFromAPI() {
    try {
        console.log("📊 Fetching students from API...");
        const data = await apiRequest('/students');
        const students = data.data || [];
        
        // Transform ke format yang sama dengan dbData.users
        dbData.users = students.map(s => ({
            id: s.id,
            nama: s.nama,
            kelas: s.kelas,
            jurusan: s.jurusan,
            delayOut: s.delayOut || 60,
            hasAccount: s.hasAccount || false,
            accountEmail: s.accountEmail || null
        }));
        
        console.log(`👨‍🎓 Students loaded from API: ${dbData.users.length} students`);
        
        // Trigger UI updates
        if (typeof renderStudentsTable === 'function') renderStudentsTable();
        if (typeof populateStudentFilters === 'function') populateStudentFilters();
        if (typeof populateFilters === 'function') populateFilters();
        if (typeof populateStudentSelectForCode === 'function') populateStudentSelectForCode();
        
        return dbData.users;
    } catch (error) {
        console.error("Fetch students from API error:", error);
        // Fallback ke Firebase
        if (typeof db !== 'undefined' && db) {
            return fetchStudentsFromFirebase();
        }
        return [];
    }
}

/**
 * Ambil data absensi dari API backend
 */
async function fetchAttendanceFromAPI() {
    try {
        console.log("📊 Fetching attendance from API...");
        const data = await apiRequest('/attendance');
        const attendance = data.data || [];
        
        // Transform ke format yang sama dengan dbData.attendance
        dbData.attendance = attendance.map(a => ({
            id: a.id,
            studentId: a.studentId,
            timestamp: a.timestamp,
            date: a.date,
            timeIn: a.timeIn,
            timeOut: a.timeOut,
            nama: a.nama,
            kelas: a.kelas,
            jurusan: a.jurusan,
            status: a.status
        }));
        
        dbData.attendance.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        console.log(`📋 Attendance loaded from API: ${dbData.attendance.length} records`);
        
        // Trigger UI updates
        if (typeof renderTable === 'function') renderTable();
        if (typeof updateAttendanceDonutChart === 'function') updateAttendanceDonutChart();
        
        return dbData.attendance;
    } catch (error) {
        console.error("Fetch attendance from API error:", error);
        // Fallback ke Firebase
        if (typeof db !== 'undefined' && db) {
            return fetchAttendanceFromFirebase();
        }
        return [];
    }
}

/**
 * Ambil data user auth dari API backend
 */
async function fetchUsersAuthFromAPI() {
    try {
        console.log("📊 Fetching users auth from API...");
        const data = await apiRequest('/users');
        const users = data.data || [];
        
        dbData.users_auth = users.map(u => ({
            uid: u.uid,
            email: u.email,
            nama: u.nama,
            role: u.role,
            kelas: u.kelas,
            jurusan: u.jurusan,
            fpId: u.fpId,
            photoUrl: u.photoUrl,
            registeredAt: u.registeredAt
        }));
        
        // Enforce developer role for zaki5go@gmail.com
        enforceDeveloperRoleForAllUsers();
        
        console.log(`👥 Auth users loaded from API: ${dbData.users_auth.length} users`);
        
        // Trigger UI updates
        if (typeof renderUsersTable === 'function') renderUsersTable();
        
        return dbData.users_auth;
    } catch (error) {
        console.error("Fetch users auth from API error:", error);
        // Fallback ke Firebase
        if (typeof db !== 'undefined' && db) {
            return fetchUsersAuthFromFirebase();
        }
        return [];
    }
}

// ======================= FALLBACK FUNGSI FIREBASE =======================

function fetchStudentsFromFirebase() {
    return new Promise((resolve) => {
        if (typeof db === 'undefined' || !db) {
            resolve([]);
            return;
        }
        
        db.ref('users').once('value', (snapshot) => {
            const data = snapshot.val();
            const students = [];
            if (data) {
                Object.keys(data).forEach(key => {
                    students.push({ id: key, ...data[key] });
                });
            }
            dbData.users = students;
            console.log(`👨‍🎓 Students loaded from Firebase (fallback): ${dbData.users.length} students`);
            resolve(students);
        }).catch(() => resolve([]));
    });
}

function fetchAttendanceFromFirebase() {
    return new Promise((resolve) => {
        if (typeof db === 'undefined' || !db) {
            resolve([]);
            return;
        }
        
        db.ref('absensi').once('value', (snapshot) => {
            const data = snapshot.val();
            const attendance = [];
            if (data) {
                Object.keys(data).forEach(date => {
                    const dailyRecords = data[date];
                    if (dailyRecords) {
                        Object.keys(dailyRecords).forEach(id => {
                            const record = dailyRecords[id];
                            if (record) {
                                attendance.push({
                                    id: date + "-" + id,
                                    studentId: id,
                                    timestamp: date + "T" + (record.in || "00:00"),
                                    date: date,
                                    timeIn: record.in,
                                    timeOut: record.out,
                                    nama: record.nama,
                                    kelas: record.kelas,
                                    jurusan: record.jurusan,
                                    status: (record.out) ? "Pulang" : "Hadir"
                                });
                            }
                        });
                    }
                });
            }
            attendance.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            dbData.attendance = attendance;
            console.log(`📋 Attendance loaded from Firebase (fallback): ${dbData.attendance.length} records`);
            resolve(attendance);
        }).catch(() => resolve([]));
    });
}

function fetchUsersAuthFromFirebase() {
    return new Promise((resolve) => {
        if (typeof db === 'undefined' || !db) {
            resolve([]);
            return;
        }
        
        db.ref('users_auth').once('value', (snapshot) => {
            const data = snapshot.val();
            const users = [];
            if (data) {
                Object.keys(data).forEach(uid => {
                    let user = { uid: uid, ...data[uid] };
                    enforceDeveloperRole(user, uid);
                    users.push(user);
                });
            }
            dbData.users_auth = users;
            console.log(`👥 Auth users loaded from Firebase (fallback): ${dbData.users_auth.length} users`);
            resolve(users);
        }).catch(() => resolve([]));
    });
}

// ======================= FUNGSI BANTU =======================

function enforceDeveloperRole(userData, uid) {
    if (userData && userData.email === 'zaki5go@gmail.com') {
        if (userData.role !== 'developer') {
            console.log(`🔧 Memperbaiki role untuk ${userData.email} menjadi 'developer'`);
            userData.role = 'developer';
            if (typeof db !== 'undefined' && db) {
                db.ref(`users_auth/${uid}/role`).set('developer')
                    .catch(err => console.error("Gagal update role developer:", err));
            }
        }
        return true;
    }
    return false;
}

function enforceDeveloperRoleForAllUsers() {
    dbData.users_auth.forEach(user => {
        if (user.email === 'zaki5go@gmail.com' && user.role !== 'developer') {
            user.role = 'developer';
            if (typeof db !== 'undefined' && db && user.uid) {
                db.ref(`users_auth/${user.uid}/role`).set('developer')
                    .catch(err => console.error("Gagal update role developer:", err));
            }
        }
    });
}

// ======================= SINKRONISASI CURRENT USER =======================

async function syncCurrentUser() {
    if (typeof firebase === 'undefined' || !firebase.auth) return;
    
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            // Cari user di users_auth
            let userData = dbData.users_auth.find(u => u.uid === user.uid);
            
            // Jika tidak ditemukan, coba fetch ulang
            if (!userData) {
                await fetchUsersAuthFromAPI();
                userData = dbData.users_auth.find(u => u.uid === user.uid);
            }
            
            if (userData) {
                currentUser = {
                    uid: user.uid,
                    email: user.email,
                    ...userData
                };
                
                // Enforce developer role
                if (currentUser.email === 'zaki5go@gmail.com' && currentUser.role !== 'developer') {
                    currentUser.role = 'developer';
                }
                
                console.log(`✅ Current user synced: ${currentUser.nama} (${currentUser.role})`);
                
                // Trigger event
                const event = new CustomEvent('userSynced', {
                    detail: { currentUser: currentUser }
                });
                window.dispatchEvent(event);
            }
        } else {
            currentUser = null;
            console.log("👤 No user logged in");
        }
    });
}

// ======================= LOAD ALL DATA =======================

async function loadAllData() {
    console.log("🔄 Loading all data from API...");
    
    try {
        // Load data in parallel
        await Promise.all([
            fetchStudentsFromAPI(),
            fetchAttendanceFromAPI(),
            fetchUsersAuthFromAPI()
        ]);
        
        apiDataLoaded = true;
        console.log("✅ All data loaded successfully from API");
        
        // Trigger dataReady event
        const event = new CustomEvent('dataReady', {
            detail: { 
                timestamp: Date.now(),
                source: 'api',
                data: {
                    students: dbData.users.length,
                    attendance: dbData.attendance.length,
                    users: dbData.users_auth.length
                }
            }
        });
        window.dispatchEvent(event);
        
        // Also trigger uiReady if needed
        if (currentUser) {
            const uiEvent = new CustomEvent('uiReady', {
                detail: { currentUser: currentUser }
            });
            window.dispatchEvent(uiEvent);
        }
        
    } catch (error) {
        console.error("Failed to load data from API:", error);
        console.log("🔄 Falling back to Firebase listeners...");
        
        // Fallback ke Firebase listeners
        attachFirebaseListeners();
    }
}

// ======================= FIREBASE LISTENERS (FALLBACK) =======================

function attachFirebaseListeners() {
    if (firebaseListenersAttached) return;
    if (typeof db === 'undefined' || !db) {
        console.error("❌ db not available, cannot attach Firebase listeners");
        return;
    }
    
    firebaseListenersAttached = true;
    console.log("🔌 Attaching Firebase listeners (fallback mode)...");
    
    // Listener untuk data siswa
    db.ref('users').on('value', (snapshot) => {
        if (apiDataLoaded) return; // Skip if API data is already loaded
        
        try {
            const data = snapshot.val();
            dbData.users = [];
            if (data) {
                Object.keys(data).forEach(key => {
                    dbData.users.push({ id: key, ...data[key] });
                });
            }
            console.log(`👨‍🎓 Students loaded from Firebase: ${dbData.users.length} students`);

            if (typeof renderStudentsTable === 'function') renderStudentsTable();
            if (typeof populateStudentFilters === 'function') populateStudentFilters();
            if (typeof populateFilters === 'function') populateFilters();
            if (typeof populateStudentSelectForCode === 'function') populateStudentSelectForCode();
        } catch (e) {
            console.error("Error processing users data:", e);
        }
    });
    
    // Listener untuk data auth users
    db.ref('users_auth').on('value', (snapshot) => {
        if (apiDataLoaded) return;
        
        try {
            const data = snapshot.val();
            dbData.users_auth = [];
            if (data) {
                Object.keys(data).forEach(uid => {
                    let user = { uid: uid, ...data[uid] };
                    enforceDeveloperRole(user, uid);
                    dbData.users_auth.push(user);
                });
            }
            console.log(`👥 Auth users loaded from Firebase: ${dbData.users_auth.length} users`);

            if (currentUser && currentUser.email === 'zaki5go@gmail.com' && currentUser.role !== 'developer') {
                console.log("🔧 Memperbaiki role currentUser menjadi developer");
                currentUser.role = 'developer';
                if (typeof saveUserToLocalStorage === 'function') saveUserToLocalStorage(currentUser);
                if (typeof applyRolePermissions === 'function') applyRolePermissions();
                if (typeof updateUserInterface === 'function') updateUserInterface();
            }

            if (typeof renderUsersTable === 'function') renderUsersTable();
        } catch (e) {
            console.error("Error processing users_auth data:", e);
        }
    });
    
    // Listener untuk data absensi
    db.ref('absensi').on('value', (snapshot) => {
        if (apiDataLoaded) return;
        
        try {
            const data = snapshot.val();
            dbData.attendance = [];
            if (data) {
                Object.keys(data).forEach(date => {
                    const dailyRecords = data[date];
                    if (dailyRecords) {
                        Object.keys(dailyRecords).forEach(id => {
                            const record = dailyRecords[id];
                            if (record) {
                                dbData.attendance.push({
                                    id: date + "-" + id,
                                    studentId: id,
                                    timestamp: date + "T" + (record.in || "00:00"),
                                    date: date,
                                    timeIn: record.in,
                                    timeOut: record.out,
                                    nama: record.nama,
                                    kelas: record.kelas,
                                    jurusan: record.jurusan,
                                    status: (record.out) ? "Pulang" : "Hadir"
                                });
                            }
                        });
                    }
                });
            }
            dbData.attendance.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            console.log(`📋 Attendance loaded from Firebase: ${dbData.attendance.length} records`);

            if (typeof renderTable === 'function') renderTable();
            if (typeof updateAttendanceDonutChart === 'function') updateAttendanceDonutChart();
        } catch (e) {
            console.error("Error processing attendance data:", e);
        }
    });
    
    // Listener untuk kode pendaftaran
    db.ref('codes').on('value', (snapshot) => {
        try {
            const data = snapshot.val();
            cleanupOldCodes(data);
            dbData.codes = [];
            if (data) {
                Object.keys(data).forEach(key => {
                    dbData.codes.push({ code: key, ...data[key] });
                });
            }
            console.log(`🔑 Registration codes loaded: ${dbData.codes.length} codes`);

            if (typeof renderCodesTable === 'function') renderCodesTable();
        } catch (e) {
            console.error("Error processing codes data:", e);
        }
    });
    
    // Trigger dataReady event for Firebase fallback
    setTimeout(() => {
        const event = new CustomEvent('dataReady', {
            detail: { 
                timestamp: Date.now(),
                source: 'firebase',
                data: {
                    students: dbData.users.length,
                    attendance: dbData.attendance.length,
                    users: dbData.users_auth.length
                }
            }
        });
        window.dispatchEvent(event);
    }, 2000);
}

// ======================= FUNGSI BERSIH-BERSIH KODE =======================

function cleanupOldCodes(data) {
    const now = Date.now();
    const fiveHoursInMs = 5 * 60 * 60 * 1000;
    if (!data) return;
    Object.keys(data).forEach(key => {
        const item = data[key];
        if (item.createdAt && (now - item.createdAt > fiveHoursInMs)) {
            if (typeof db !== 'undefined' && db) {
                db.ref('codes/' + key).remove()
                    .then(() => console.log(`🗑️ Kode ${key} kadaluarsa dan dihapus otomatis.`))
                    .catch(err => console.error("Gagal hapus kode kadaluarsa:", err));
            }
        }
    });
}

// ======================= INISIALISASI =======================

// Tunggu Firebase siap
function waitForFirebaseAndInit() {
    if (typeof firebase !== 'undefined' && firebase.auth && typeof db !== 'undefined' && db) {
        console.log("🔥 Firebase detected, initializing db.js...");
        syncCurrentUser();
        loadAllData();
    } else {
        console.log("⏳ Waiting for Firebase to be ready...");
        setTimeout(waitForFirebaseAndInit, 500);
    }
}

// Start initialization
waitForFirebaseAndInit();

// ======================= EKSPOR KE GLOBAL =======================
window.dbData = dbData;
window.currentUser = currentUser;
window.fetchStudentsFromAPI = fetchStudentsFromAPI;
window.fetchAttendanceFromAPI = fetchAttendanceFromAPI;
window.fetchUsersAuthFromAPI = fetchUsersAuthFromAPI;
window.loadAllData = loadAllData;
window.syncCurrentUser = syncCurrentUser;

console.log("✅ db.js V4.0 loaded - Terintegrasi dengan API Backend Vercel (dengan fallback Firebase)");