// init.js - VERSION 4.3 (PERBAIKAN: JANGAN RESET SCHOOL CONFIG KE DEFAULT)
// INISIALISASI DATA DENGAN FLAG SYSTEM + EVENT DATA READY
// ============================================================================

let appInitialized = false;
let initListenersAttached = false;
let isSchoolConfigLoadedFromFirebase = false;

// Flags untuk mengecek ketersediaan data
let dataReady = {
    users: false,
    users_auth: false,
    attendance: false,
    codes: false,
    schoolConfig: false,
    globalDelay: false
};

// Callback ketika semua data siap
function checkAllDataReady() {
    const allReady = dataReady.users && dataReady.users_auth && 
                     dataReady.attendance && dataReady.schoolConfig && 
                     dataReady.globalDelay;
    
    if (allReady && currentUser && !appInitialized) {
        console.log("✅ All data ready, initializing app...");
        appInitialized = true;
        
        // Dispatch event dataReady untuk modul lain (rekap, friends, chat, status, sensor)
        if (!window._dataReadyDispatched) {
            window._dataReadyDispatched = true;
            console.log("📡 Dispatching 'dataReady' event to all modules...");
            window.dispatchEvent(new CustomEvent('dataReady', { 
                detail: { dbData, currentUser, timestamp: Date.now() }
            }));
        }
        
        // Beri sedikit delay untuk memastikan DOM siap
        setTimeout(() => {
            renderAllData();
            // Trigger dashboard render setelah data siap
            if (typeof renderDashboard === 'function') {
                renderDashboard();
            }
            // Trigger chart update
            if (typeof updateDashboardChart === 'function') {
                setTimeout(() => updateDashboardChart(), 200);
            }
        }, 100);
    }
}

// Render semua komponen setelah data siap
function renderAllData() {
    console.log("🎨 renderAllData - Rendering all components...");
    
    // 1. Populate semua dropdown dinamis
    if (typeof populateKelasOptions === 'function') {
        try { populateKelasOptions(); } catch(e) { console.warn("populateKelasOptions error:", e); }
    }
    if (typeof populateJurusanOptions === 'function') {
        try { populateJurusanOptions(); } catch(e) { console.warn("populateJurusanOptions error:", e); }
    }
    if (typeof populateStudentFilters === 'function') {
        try { populateStudentFilters(); } catch(e) { console.warn("populateStudentFilters error:", e); }
    }
    if (typeof populateFilters === 'function') {
        try { populateFilters(); } catch(e) { console.warn("populateFilters error:", e); }
    }
    if (typeof populateDateFilter === 'function') {
        try { populateDateFilter(); } catch(e) { console.warn("populateDateFilter error:", e); }
    }
    if (typeof populateStudentSelectForCode === 'function') {
        try { populateStudentSelectForCode(); } catch(e) { console.warn("populateStudentSelectForCode error:", e); }
    }
    
    // 2. Render semua tabel (selalu, tanpa conditional)
    if (typeof renderStudentsTable === 'function') {
        try { renderStudentsTable(); } catch(e) { console.warn("renderStudentsTable error:", e); }
    }
    if (typeof renderTable === 'function') {
        try { renderTable(); } catch(e) { console.warn("renderTable error:", e); }
    }
    if (typeof renderUsersTable === 'function') {
        try { renderUsersTable(); } catch(e) { console.warn("renderUsersTable error:", e); }
    }
    if (typeof renderCodesTable === 'function') {
        try { renderCodesTable(); } catch(e) { console.warn("renderCodesTable error:", e); }
    }
    
    // 3. Inisialisasi sistem pengumuman
    if (typeof initAnnouncementSystem === 'function') {
        setTimeout(() => {
            try { initAnnouncementSystem(); } catch(e) { console.warn("initAnnouncementSystem error:", e); }
        }, 300);
    }
    
    // 4. Update UI tambahan
    if (typeof updateProfileDelayDisplay === 'function') {
        try { updateProfileDelayDisplay(); } catch(e) { console.warn("updateProfileDelayDisplay error:", e); }
    }
    
    // 5. Setup floating buttons berdasarkan role
    const floatingBtn = document.getElementById('floatingAnnouncementBtn');
    if (floatingBtn && currentUser && (currentUser.role === 'admin' || currentUser.role === 'guru')) {
        floatingBtn.style.display = 'flex';
    }
    
    // 6. Setup default dates untuk rekap custom range
    setupRekapDefaultDates();
    
    console.log("✅ renderAllData completed");
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

// ======================== LISTENER INITIALIZATION ========================
// HANYA SATU KALI - TIDAK DUPLIKAT DENGAN main.js

function initDataListeners() {
    if (initListenersAttached) {
        console.log("⚠️ Data listeners already attached, skipping...");
        return;
    }
    
    console.log("🔌 Attaching Firebase data listeners (ONCE)...");
    initListenersAttached = true;
    
    // ========== 1. LISTENER DATA SISWA (users) ==========
    db.ref('users').on('value', (snapshot) => {
        const data = snapshot.val();
        const oldCount = dbData.users?.length || 0;
        
        dbData.users = [];
        if (data) {
            Object.keys(data).forEach(key => {
                dbData.users.push({ id: key, ...data[key] });
            });
        }
        
        const newCount = dbData.users.length;
        if (oldCount !== newCount) {
            console.log(`📊 Users data updated: ${oldCount} → ${newCount} students`);
        }
        
        dataReady.users = true;
        checkAllDataReady();
        
        if (typeof renderStudentsTable === 'function') {
            renderStudentsTable();
        }
        if (typeof populateStudentFilters === 'function') {
            populateStudentFilters();
        }
        if (typeof populateFilters === 'function') {
            populateFilters();
        }
        if (typeof populateDateFilter === 'function') {
            populateDateFilter();
        }
        if (typeof populateStudentSelectForCode === 'function') {
            populateStudentSelectForCode();
        }
        if (typeof updateStudentStatistics === 'function') {
            updateStudentStatistics();
        }
    });
    
    // ========== 2. LISTENER DATA USER AUTH (users_auth) ==========
    db.ref('users_auth').on('value', (snapshot) => {
        const data = snapshot.val();
        const oldCount = dbData.users_auth?.length || 0;
        
        dbData.users_auth = [];
        if (data) {
            Object.keys(data).forEach(uid => {
                dbData.users_auth.push({ uid: uid, ...data[uid] });
            });
        }
        
        const newCount = dbData.users_auth.length;
        if (oldCount !== newCount) {
            console.log(`👥 Users auth updated: ${oldCount} → ${newCount} users`);
        }
        
        dataReady.users_auth = true;
        checkAllDataReady();
        
        if (currentUser && currentUser.uid) {
            const updatedUser = dbData.users_auth.find(u => u.uid === currentUser.uid);
            if (updatedUser) {
                const oldRole = currentUser.role;
                currentUser = { ...currentUser, ...updatedUser };
                if (typeof saveUserToLocalStorage === 'function') {
                    saveUserToLocalStorage(currentUser);
                }
                if (oldRole !== currentUser.role && typeof applyRolePermissions === 'function') {
                    applyRolePermissions();
                }
            }
        }
        
        if (typeof renderUsersTable === 'function') {
            renderUsersTable();
        }
    });
    
    // ========== 3. LISTENER DATA ABSENSI ==========
    db.ref('absensi').on('value', (snapshot) => {
        const data = snapshot.val();
        const oldCount = dbData.attendance?.length || 0;
        
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
        
        const newCount = dbData.attendance.length;
        if (oldCount !== newCount) {
            console.log(`📋 Attendance updated: ${oldCount} → ${newCount} records`);
        }
        
        dataReady.attendance = true;
        checkAllDataReady();
        
        if (typeof renderTable === 'function') {
            renderTable();
        }
        
        if (typeof renderDashboard === 'function') {
            renderDashboard();
        }
        if (typeof updateDashboardChart === 'function') {
            setTimeout(() => updateDashboardChart(), 100);
        }
        if (typeof updateAttendanceDonutChart === 'function') {
            updateAttendanceDonutChart();
        }
        
        if (typeof loadRekap === 'function' && document.getElementById('tab-rekap')?.classList.contains('active')) {
            setTimeout(() => loadRekap(), 100);
        }
    });
    
    // ========== 4. LISTENER SCHOOL CONFIG (DIPERBAIKI - TIDAK RESET KE DEFAULT) ==========
    db.ref('school_config').on('value', (snapshot) => {
        const data = snapshot.val();
        
        // Cek apakah ada data di Firebase
        if (data && Object.keys(data).length > 0) {
            // Data ditemukan di Firebase, gunakan data tersebut
            console.log("🏫 School config found in Firebase:", data);
            
            if (typeof currentSchoolConfig !== 'undefined') {
                currentSchoolConfig.type = data.type || 'smp';
                currentSchoolConfig.majors = data.majors || [];
                currentSchoolConfig.classes = data.classes || [];
            }
            
            window.currentSchoolConfig = {
                type: data.type || 'smp',
                majors: data.majors || [],
                classes: data.classes || []
            };
            
            isSchoolConfigLoadedFromFirebase = true;
            console.log(`✅ School config loaded from Firebase: type=${window.currentSchoolConfig.type}, classes=${window.currentSchoolConfig.classes.length}, majors=${window.currentSchoolConfig.majors.length}`);
            
        } else {
            // TIDAK ADA data di Firebase - JANGAN RESET KE DEFAULT
            // Biarkan config yang sudah ada (dari memory) tetap digunakan
            console.log("⚠️ No school config in Firebase, keeping existing config");
            
            if (!window.currentSchoolConfig) {
                // Hanya jika benar-benar belum ada config sama sekali, baru buat default sementara
                window.currentSchoolConfig = {
                    type: 'smp',
                    majors: [],
                    classes: ['VII', 'VIII', 'IX']
                };
                console.log("📚 Created temporary default school config");
            }
            
            // Tandai tetap sebagai siap (biarkan config yang ada digunakan)
            isSchoolConfigLoadedFromFirebase = false;
        }
        
        dataReady.schoolConfig = true;
        checkAllDataReady();
        
        // Update UI (tanpa conditional)
        const typeSelect = document.getElementById('schoolTypeSelect');
        if (typeSelect && window.currentSchoolConfig) {
            typeSelect.value = window.currentSchoolConfig.type;
        }
        
        const majorsDiv = document.getElementById('majorsManager');
        if (majorsDiv && window.currentSchoolConfig) {
            majorsDiv.style.display = (window.currentSchoolConfig.type === 'smk' || window.currentSchoolConfig.type === 'both') ? 'block' : 'none';
        }
        
        if (typeof renderMajorsList === 'function') {
            renderMajorsList();
        }
        if (typeof renderClassesList === 'function') {
            renderClassesList();
        }
        if (typeof populateKelasOptions === 'function') {
            populateKelasOptions();
        }
        if (typeof populateJurusanOptions === 'function') {
            populateJurusanOptions();
        }
        if (typeof populateStudentFilters === 'function') {
            populateStudentFilters();
        }
        if (typeof populateFilters === 'function') {
            populateFilters();
        }
        if (typeof populateDateFilter === 'function') {
            populateDateFilter();
        }
        
        if (typeof loadRekap === 'function' && document.getElementById('tab-rekap')?.classList.contains('active')) {
            setTimeout(() => loadRekap(), 100);
        }
    });
    
    // ========== 5. LISTENER GLOBAL DELAY ==========
    db.ref('settings/delayOut').on('value', (snapshot) => {
        const delay = snapshot.val();
        console.log(`⏰ Global delay: ${delay || 60} minutes`);
        
        const displaySpan = document.getElementById('globalDelayDisplay');
        if (displaySpan) {
            if (typeof formatDelayText === 'function') {
                displaySpan.textContent = formatDelayText(delay || 60);
            } else {
                displaySpan.textContent = delay ? `${delay} menit` : '60 menit';
            }
        }
        
        if (typeof setGlobalDelayFormValue === 'function') {
            setGlobalDelayFormValue(delay || 60);
        }
        
        dataReady.globalDelay = true;
        checkAllDataReady();
    });
    
    // ========== 6. LISTENER KODE REGISTRASI ==========
    db.ref('codes').on('value', (snapshot) => {
        const data = snapshot.val();
        
        const now = Date.now();
        const fiveHoursInMs = 5 * 60 * 60 * 1000;
        if (data) {
            Object.keys(data).forEach(key => {
                const item = data[key];
                if (item && item.createdAt && (now - item.createdAt > fiveHoursInMs)) {
                    db.ref('codes/' + key).remove();
                    console.log(`🗑️ Expired code removed: ${key}`);
                }
            });
        }
        
        dbData.codes = [];
        if (data) {
            Object.keys(data).forEach(key => {
                dbData.codes.push({ code: key, ...data[key] });
            });
        }
        
        if (typeof renderCodesTable === 'function') {
            renderCodesTable();
        }
        if (typeof updateCodesStatistics === 'function') {
            updateCodesStatistics();
        }
    });
    
    // ========== 7. LISTENER NAMA SEKOLAH ==========
    db.ref('system_config/schoolName').on('value', (snapshot) => {
        const name = snapshot.val();
        const display = name || 'Sistem Absensi';
        
        const headerTitle = document.getElementById('schoolNameDisplay');
        if (headerTitle) headerTitle.textContent = display;
        
        const inputField = document.getElementById('inputSchoolName');
        if (inputField && inputField.value !== name) {
            inputField.value = name || '';
        }
    });
    
    console.log("✅ All Firebase data listeners attached successfully");
}

// ======================== CLEANUP FUNCTION ========================
function cleanupInitListeners() {
    if (initListenersAttached) {
        console.log("🧹 Cleaning up init.js listeners...");
        
        db.ref('users').off();
        db.ref('users_auth').off();
        db.ref('absensi').off();
        db.ref('school_config').off();
        db.ref('settings/delayOut').off();
        db.ref('codes').off();
        db.ref('system_config/schoolName').off();
        
        initListenersAttached = false;
        appInitialized = false;
        window._dataReadyDispatched = false;
        isSchoolConfigLoadedFromFirebase = false;
        
        dataReady = {
            users: false,
            users_auth: false,
            attendance: false,
            codes: false,
            schoolConfig: false,
            globalDelay: false
        };
        
        console.log("✅ Init listeners cleaned up");
    }
}

// ======================== AUTO INITIALIZATION ========================

function waitForFirebaseAndInit() {
    if (typeof db === 'undefined' || !db) {
        console.log("⏳ Waiting for Firebase...");
        setTimeout(waitForFirebaseAndInit, 500);
        return;
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => initDataListeners(), 100);
        });
    } else {
        setTimeout(() => initDataListeners(), 100);
    }
}

// Mulai inisialisasi
waitForFirebaseAndInit();

// ======================== EXPORT KE GLOBAL ========================
window.checkAllDataReady = checkAllDataReady;
window.renderAllData = renderAllData;
window.setupRekapDefaultDates = setupRekapDefaultDates;
window.initDataListeners = initDataListeners;
window.cleanupInitListeners = cleanupInitListeners;

console.log("✅ init.js V4.3 loaded - Fixed: Don't reset school config to default when no data in Firebase");