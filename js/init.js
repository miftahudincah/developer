// init.js - INISIALISASI TERURUT
// Tempatkan setelah file config.js, sebelum file lainnya

let appInitialized = false;
let dataReady = {
    users: false,
    users_auth: false,
    attendance: false,
    codes: false,
    schoolConfig: false,
    globalDelay: false
};

function checkAllDataReady() {
    // Semua data harus ready sebelum render
    const allReady = dataReady.users && dataReady.users_auth && 
                     dataReady.attendance && dataReady.schoolConfig && 
                     dataReady.globalDelay;
    
    if (allReady && currentUser && !appInitialized) {
        console.log("✅ Semua data siap, memulai render...");
        appInitialized = true;
        renderAllData();
    }
}

function renderAllData() {
    // Populate dropdowns terlebih dahulu
    if (typeof populateKelasOptions === 'function') populateKelasOptions();
    if (typeof populateJurusanOptions === 'function') populateJurusanOptions();
    if (typeof populateStudentFilters === 'function') populateStudentFilters();
    if (typeof populateFilters === 'function') populateFilters();
    if (typeof populateStudentSelectForCode === 'function') populateStudentSelectForCode();
    
    // Render semua tabel
    if (typeof renderStudentsTable === 'function') renderStudentsTable();
    if (typeof renderTable === 'function') renderTable();
    if (typeof renderUsersTable === 'function') renderUsersTable();
    if (typeof renderCodesTable === 'function') renderCodesTable();
    
    // System announcement
    if (typeof initAnnouncementSystem === 'function') {
        setTimeout(() => initAnnouncementSystem(), 300);
    }
    
    // Update UI tambahan
    updateProfileDelayDisplay();
    
    // Floating button
    const floatingBtn = document.getElementById('floatingAnnouncementBtn');
    if (floatingBtn && currentUser && (currentUser.role === 'admin' || currentUser.role === 'guru')) {
        floatingBtn.style.display = 'flex';
    }
}

// Override listener di db.js untuk track data ready
// Hapus atau modifikasi listener yang ada di db.js, lalu tambahkan:

// Data Users (Siswa FP)
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
});

// Data Auth Users
db.ref('users_auth').on('value', (snapshot) => {
    const data = snapshot.val();
    dbData.users_auth = [];
    if (data) {
        Object.keys(data).forEach(uid => {
            dbData.users_auth.push({ uid: uid, ...data[uid] });
        });
    }
    dataReady.users_auth = true;
    checkAllDataReady();
});

// Data Absensi
db.ref('absensi').on('value', (snapshot) => {
    const data = snapshot.val();
    dbData.attendance = [];
    if (data) {
        Object.keys(data).forEach(date => {
            const dailyRecords = data[date];
            Object.keys(dailyRecords).forEach(id => {
                const record = dailyRecords[id];
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
            });
        });
    }
    dbData.attendance.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    dataReady.attendance = true;
    checkAllDataReady();
});

// School Config
db.ref('school_config').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        currentSchoolConfig.type = data.type || 'smp';
        currentSchoolConfig.majors = data.majors || [];
    } else {
        currentSchoolConfig.type = 'smp';
        currentSchoolConfig.majors = [];
    }
    dataReady.schoolConfig = true;
    checkAllDataReady();
    
    // Update UI langsung
    const typeSelect = document.getElementById('schoolTypeSelect');
    if (typeSelect) typeSelect.value = currentSchoolConfig.type;
    const majorsDiv = document.getElementById('majorsManager');
    if (majorsDiv) {
        majorsDiv.style.display = (currentSchoolConfig.type === 'smk' || currentSchoolConfig.type === 'both') ? 'block' : 'none';
    }
    if (typeof renderMajorsList === 'function') renderMajorsList();
});

// Global Delay
db.ref('settings/delayOut').on('value', (snapshot) => {
    const delay = snapshot.val();
    const displaySpan = document.getElementById('globalDelayDisplay');
    if (displaySpan) {
        displaySpan.textContent = formatDelayText?.(delay) || (delay ? `${delay} menit` : '60 menit');
    }
    if (typeof setGlobalDelayFormValue === 'function') {
        setGlobalDelayFormValue(delay || 60);
    }
    dataReady.globalDelay = true;
    checkAllDataReady();
});

// Codes (tidak blocking untuk render awal)
db.ref('codes').on('value', (snapshot) => {
    const data = snapshot.val();
    if (typeof cleanupOldCodes === 'function') cleanupOldCodes(data);
    dbData.codes = [];
    if (data) {
        Object.keys(data).forEach(key => {
            dbData.codes.push({ code: key, ...data[key] });
        });
    }
    if (typeof renderCodesTable === 'function') renderCodesTable();
});