// init.js - VERSION 6.0 (INTEGRATED WITH VERCEL BACKEND API)
// INISIALISASI DATA DENGAN FLAG SYSTEM + EVENT DATA READY
// DENGAN DUKUNGAN API BACKEND VERCEL SEBAGAI SUMBER UTAMA
// V6.0: Mengintegrasikan API backend Vercel untuk pengambilan data
// ============================================================================

// Backend API URL (Vercel)
const BACKEND_API_URL = "https://absensi-backend-3we5.vercel.app/api";

let appInitialized = false;
let initListenersAttached = false;
let isSchoolConfigLoadedFromFirebase = false;
let usingAPIMode = true; // Flag untuk menggunakan API mode

// Flags untuk mengecek ketersediaan data
let dataReady = {
    users: false,
    users_auth: false,
    attendance: false,
    codes: false,
    schoolConfig: false,
    globalDelay: false,
    staff: false
};

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
 * Ambil data dari API backend untuk inisialisasi
 */
async function fetchInitialDataFromAPI() {
    console.log("📊 Fetching initial data from API...");
    
    try {
        // Parallel fetch untuk semua data
        const [studentsData, attendanceData, usersData, configData] = await Promise.all([
            apiRequest('/students').catch(() => ({ data: [] })),
            apiRequest('/attendance').catch(() => ({ data: [] })),
            apiRequest('/users').catch(() => ({ data: [] })),
            apiRequest('/config').catch(() => ({ data: {} }))
        ]);
        
        // Update dbData dengan data dari API
        if (studentsData.data) {
            dbData.users = studentsData.data.map(s => ({
                id: s.id,
                nama: s.nama,
                kelas: s.kelas,
                jurusan: s.jurusan,
                delayOut: s.delayOut || 60,
                hasAccount: s.hasAccount || false
            }));
            dataReady.users = true;
            console.log(`👨‍🎓 Students loaded from API: ${dbData.users.length} students`);
        }
        
        if (attendanceData.data) {
            dbData.attendance = attendanceData.data.map(a => ({
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
            dataReady.attendance = true;
            console.log(`📋 Attendance loaded from API: ${dbData.attendance.length} records`);
        }
        
        if (usersData.data) {
            dbData.users_auth = usersData.data.map(u => ({
                uid: u.uid,
                email: u.email,
                nama: u.nama,
                role: u.role,
                kelas: u.kelas,
                jurusan: u.jurusan,
                fpId: u.fpId,
                photoUrl: u.photoUrl
            }));
            dataReady.users_auth = true;
            console.log(`👥 Auth users loaded from API: ${dbData.users_auth.length} users`);
        }
        
        if (configData.data) {
            window.currentSchoolConfig = {
                type: configData.data.school_type || 'smp',
                classes: configData.data.classes || [],
                majors: configData.data.majors || []
            };
            dataReady.schoolConfig = true;
            console.log(`🏫 School config loaded from API: type=${window.currentSchoolConfig.type}`);
        }
        
        // For global delay, we might need a separate endpoint or fallback
        dataReady.globalDelay = true;
        
        usingAPIMode = true;
        checkAllDataReady();
        
    } catch (error) {
        console.error("Failed to fetch data from API:", error);
        console.log("🔄 Falling back to Firebase listeners...");
        usingAPIMode = false;
        initFirebaseListeners();
    }
}

// ======================= FIREBASE LISTENERS (FALLBACK) =======================

function initFirebaseListeners() {
    if (initListenersAttached) return;
    
    console.log("🔌 Attaching Firebase data listeners (fallback mode)...");
    initListenersAttached = true;
    
    // Listener untuk data siswa
    if (typeof db !== 'undefined' && db) {
        db.ref('users').on('value', (snapshot) => {
            const data = snapshot.val();
            dbData.users = [];
            if (data) {
                Object.keys(data).forEach(key => {
                    dbData.users.push({ id: key, ...data[key] });
                });
            }
            dataReady.users = true;
            checkAllDataReady();
            
            if (typeof renderStudentsTable === 'function') renderStudentsTable();
            if (typeof populateStudentFilters === 'function') populateStudentFilters();
            if (typeof populateFilters === 'function') populateFilters();
            if (typeof populateStudentSelectForCode === 'function') populateStudentSelectForCode();
        });
        
        // Listener untuk data user auth
        db.ref('users_auth').on('value', (snapshot) => {
            const data = snapshot.val();
            dbData.users_auth = [];
            if (data) {
                Object.keys(data).forEach(uid => {
                    let user = { uid: uid, ...data[uid] };
                    // Enforce developer role for specific email
                    if (user.email === 'zaki5go@gmail.com' && user.role !== 'developer') {
                        user.role = 'developer';
                        db.ref(`users_auth/${uid}/role`).set('developer');
                    }
                    dbData.users_auth.push(user);
                });
            }
            dataReady.users_auth = true;
            checkAllDataReady();
            
            if (typeof renderUsersTable === 'function') renderUsersTable();
        });
        
        // Listener untuk data absensi
        db.ref('absensi').on('value', (snapshot) => {
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
            dataReady.attendance = true;
            checkAllDataReady();
            
            if (typeof renderTable === 'function') renderTable();
            if (typeof renderDashboard === 'function') renderDashboard();
            if (typeof updateAttendanceDonutChart === 'function') updateAttendanceDonutChart();
        });
        
        // Listener untuk school config
        db.ref('school_config').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && typeof data === 'object') {
                window.currentSchoolConfig = {
                    type: data.type || 'smp',
                    majors: data.majors || [],
                    classes: data.classes || []
                };
            } else {
                window.currentSchoolConfig = {
                    type: 'smp',
                    majors: [],
                    classes: ['VII', 'VIII', 'IX']
                };
            }
            dataReady.schoolConfig = true;
            checkAllDataReady();
            
            setTimeout(() => {
                if (typeof populateKelasOptions === 'function') populateKelasOptions();
                if (typeof populateJurusanOptions === 'function') populateJurusanOptions();
                if (typeof populateStudentFilters === 'function') populateStudentFilters();
                if (typeof populateFilters === 'function') populateFilters();
                if (typeof populateDateFilter === 'function') populateDateFilter();
                if (typeof populateStudentSelectForCode === 'function') populateStudentSelectForCode();
            }, 150);
        });
        
        // Listener untuk global delay
        db.ref('settings/delayOut').on('value', (snapshot) => {
            const delay = snapshot.val();
            window.globalDelayValue = delay || 60;
            dataReady.globalDelay = true;
            checkAllDataReady();
            
            const displaySpan = document.getElementById('globalDelayDisplay');
            if (displaySpan) {
                displaySpan.textContent = delay ? `${delay} menit` : '60 menit';
            }
        });
    }
}

// Callback ketika semua data siap
function checkAllDataReady() {
    const allReady = dataReady.users && dataReady.users_auth && 
                     dataReady.attendance && dataReady.schoolConfig && 
                     dataReady.globalDelay;
    
    if (allReady && currentUser && !appInitialized) {
        console.log("✅ All data ready, initializing app...");
        appInitialized = true;
        
        // Dispatch event dataReady untuk modul lain
        if (!window._dataReadyDispatched) {
            window._dataReadyDispatched = true;
            console.log("📡 Dispatching 'dataReady' event to all modules...");
            window.dispatchEvent(new CustomEvent('dataReady', { 
                detail: { dbData, currentUser, timestamp: Date.now(), source: usingAPIMode ? 'api' : 'firebase' }
            }));
        }
        
        // Beri sedikit delay untuk memastikan DOM siap
        setTimeout(() => {
            renderAllData();
            if (typeof renderDashboard === 'function') {
                renderDashboard();
            }
            if (typeof updateDashboardChart === 'function') {
                setTimeout(() => updateDashboardChart(), 200);
            }
        }, 100);
    }
}

// Sync school config ke semua tempat yang membutuhkan
function syncSchoolConfigToAll() {
    console.log("🔄 Syncing school config to all modules...");
    
    if (!window.currentSchoolConfig) {
        window.currentSchoolConfig = {
            type: 'smp',
            majors: [],
            classes: ['VII', 'VIII', 'IX']
        };
    }
    
    // Sync ke currentSchoolConfig di setting.js (jika ada)
    if (typeof currentSchoolConfig !== 'undefined') {
        currentSchoolConfig.type = window.currentSchoolConfig.type;
        currentSchoolConfig.majors = [...window.currentSchoolConfig.majors];
        currentSchoolConfig.classes = [...window.currentSchoolConfig.classes];
    }
    
    // Update UI dropdown tipe sekolah
    const typeSelect = document.getElementById('schoolTypeSelect');
    if (typeSelect && typeSelect.value !== window.currentSchoolConfig.type) {
        typeSelect.value = window.currentSchoolConfig.type;
    }
    
    // Update majors manager visibility
    const majorsDiv = document.getElementById('majorsManager');
    if (majorsDiv) {
        const shouldShow = (window.currentSchoolConfig.type === 'smk' || window.currentSchoolConfig.type === 'both');
        majorsDiv.style.display = shouldShow ? 'block' : 'none';
    }
    
    // Render daftar kelas dan jurusan
    if (typeof renderClassesList === 'function') renderClassesList();
    if (typeof renderMajorsList === 'function') renderMajorsList();
    
    // Force populate semua dropdown
    setTimeout(() => {
        if (typeof populateKelasOptions === 'function') populateKelasOptions();
        if (typeof populateJurusanOptions === 'function') populateJurusanOptions();
        if (typeof populateStudentFilters === 'function') populateStudentFilters();
        if (typeof populateFilters === 'function') populateFilters();
        if (typeof populateDateFilter === 'function') populateDateFilter();
        if (typeof populateStudentSelectForCode === 'function') populateStudentSelectForCode();
    }, 50);
}

// Render semua komponen setelah data siap
function renderAllData() {
    console.log("🎨 renderAllData - Rendering all components...");
    
    syncSchoolConfigToAll();
    
    // Populate semua dropdown dinamis
    const populateFunctions = [
        'populateKelasOptions', 'populateJurusanOptions', 'populateStudentFilters',
        'populateFilters', 'populateDateFilter', 'populateStudentSelectForCode'
    ];
    populateFunctions.forEach(fn => {
        if (typeof window[fn] === 'function') {
            try { window[fn](); } catch(e) { console.warn(`${fn} error:`, e); }
        }
    });
    
    // Render semua tabel
    const renderFunctions = [
        'renderStudentsTable', 'renderTable', 'renderUsersTable', 'renderCodesTable'
    ];
    renderFunctions.forEach(fn => {
        if (typeof window[fn] === 'function') {
            try { window[fn](); } catch(e) { console.warn(`${fn} error:`, e); }
        }
    });
    
    // Inisialisasi sistem pengumuman
    if (typeof initAnnouncementSystem === 'function') {
        setTimeout(() => { try { initAnnouncementSystem(); } catch(e) {} }, 300);
    }
    
    // Setup floating buttons berdasarkan role
    const floatingBtn = document.getElementById('floatingAnnouncementBtn');
    if (floatingBtn && currentUser && ['admin', 'guru', 'developer'].includes(currentUser.role)) {
        floatingBtn.style.display = 'flex';
    }
    
    // Setup default dates untuk rekap custom range
    setupRekapDefaultDates();
    
    // Inisialisasi modules
    const modules = [
        { name: 'initSupabaseAutoDelete', fn: 'initSupabaseAutoDelete' },
        { name: 'initIzinOnline', fn: 'initIzinOnline' },
        { name: 'initStaffSystem', fn: 'initStaffSystem' },
        { name: 'initStaffAttendance', fn: 'initStaffAttendance' }
    ];
    
    modules.forEach(module => {
        if (typeof window[module.fn] === 'function') {
            try { window[module.fn](); } catch(e) { console.warn(`${module.name} error:`, e); }
        }
    });
    
    console.log("✅ renderAllData completed - All modules initialized!");
}

// Setup default dates untuk rekap custom range (30 hari terakhir)
function setupRekapDefaultDates() {
    const startInput = document.getElementById('rekapStartDate');
    const endInput = document.getElementById('rekapEndDate');
    
    if (startInput && endInput) {
        if (!startInput.value) {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            startInput.value = startDate.toISOString().split('T')[0];
        }
        if (!endInput.value) {
            const endDate = new Date();
            endInput.value = endDate.toISOString().split('T')[0];
        }
    }
}

/**
 * Inisialisasi auto-delete untuk status expired di Supabase
 */
function initSupabaseAutoDelete() {
    if (typeof startAutoDeleteExpiredStatus === 'function') {
        console.log("🗑️ Starting auto-delete for expired statuses...");
        startAutoDeleteExpiredStatus();
    } else if (typeof deleteExpiredStatusImages === 'function') {
        console.log("🗑️ Running one-time expired status cleanup...");
        setTimeout(() => deleteExpiredStatusImages(), 5000);
    }
}

/**
 * Stop auto-delete untuk status expired
 */
function stopSupabaseAutoDelete() {
    if (typeof stopAutoDeleteExpiredStatus === 'function') {
        console.log("⏹️ Stopping auto-delete for expired statuses");
        stopAutoDeleteExpiredStatus();
    }
}

// ======================== INITIALIZATION ========================

async function waitForFirebaseAndInit() {
    // Tunggu Firebase siap
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.log("⏳ Waiting for Firebase...");
        setTimeout(waitForFirebaseAndInit, 500);
        return;
    }
    
    // Tunggu auth siap
    if (!firebase.auth().currentUser) {
        console.log("⏳ Waiting for user authentication...");
        setTimeout(waitForFirebaseAndInit, 500);
        return;
    }
    
    console.log("🔥 Firebase and user ready, fetching data from API...");
    
    // Coba ambil data dari API terlebih dahulu
    await fetchInitialDataFromAPI();
}

// Mulai inisialisasi
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(waitForFirebaseAndInit, 100);
    });
} else {
    setTimeout(waitForFirebaseAndInit, 100);
}

// ======================== CLEANUP FUNCTION ========================
function cleanupInitListeners() {
    if (initListenersAttached && typeof db !== 'undefined' && db) {
        console.log("🧹 Cleaning up init.js listeners...");
        
        const refs = ['users', 'users_auth', 'absensi', 'school_config', 'settings/delayOut', 'codes', 'system_config/schoolName', 'izin', 'staff', 'staff_attendance'];
        refs.forEach(ref => {
            try { db.ref(ref).off(); } catch(e) {}
        });
        
        stopSupabaseAutoDelete();
        
        initListenersAttached = false;
        appInitialized = false;
        window._dataReadyDispatched = false;
        
        dataReady = {
            users: false, users_auth: false, attendance: false,
            codes: false, schoolConfig: false, globalDelay: false, staff: false
        };
        
        console.log("✅ Init listeners cleaned up");
    }
}

// ======================== EKSPOR KE GLOBAL ========================
window.checkAllDataReady = checkAllDataReady;
window.renderAllData = renderAllData;
window.setupRekapDefaultDates = setupRekapDefaultDates;
window.initDataListeners = initFirebaseListeners;
window.cleanupInitListeners = cleanupInitListeners;
window.syncSchoolConfigToAll = syncSchoolConfigToAll;
window.initSupabaseAutoDelete = initSupabaseAutoDelete;
window.stopSupabaseAutoDelete = stopSupabaseAutoDelete;
window.fetchInitialDataFromAPI = fetchInitialDataFromAPI;
window.BACKEND_API_URL = BACKEND_API_URL;

console.log("✅ init.js V6.0 loaded - Terintegrasi dengan API Backend Vercel!");