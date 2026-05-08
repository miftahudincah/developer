// Variabel Global untuk State Lokal
let dbData = {
    users: [],        // Data Siswa (Node: users) -> Untuk ESP32
    users_auth: [],   // Data User Auth (Node: users_auth) -> Untuk Login Web
    attendance: [],   // Data Absensi (Node: absensi)
    codes: []         // Kode Pendaftaran (Node: codes)
};

let currentUser = null;

// Listener: Data Siswa (Untuk Tab Students & ESP32)
db.ref('users').on('value', (snapshot) => {
    const data = snapshot.val();
    dbData.users = [];
    if (data) {
        Object.keys(data).forEach(key => {
            dbData.users.push({ id: key, ...data[key] });
        });
    }
    
    if (typeof renderStudentsTable === 'function') renderStudentsTable();
    if (typeof populateStudentFilters === 'function') populateStudentFilters();
    if (typeof populateFilters === 'function') populateFilters();
    if (typeof populateStudentSelectForCode === 'function') populateStudentSelectForCode();
    if (typeof renderClassmatesTable === 'function') renderClassmatesTable();
});

// Listener: Data Auth Users
db.ref('users_auth').on('value', (snapshot) => {
    const data = snapshot.val();
    dbData.users_auth = [];
    if (data) {
        Object.keys(data).forEach(uid => {
            dbData.users_auth.push({ uid: uid, ...data[uid] });
        });
    }
    if (typeof renderUsersTable === 'function') renderUsersTable();
    if (typeof renderClassmatesTable === 'function') renderClassmatesTable();
});

// Listener: Data Absensi
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
    if (typeof renderTable === 'function') renderTable();
    if (typeof renderClassmatesTable === 'function') renderClassmatesTable();
});

// Cleanup kode kadaluarsa (5 jam)
function cleanupOldCodes(data) {
    const now = Date.now();
    const fiveHoursInMs = 5 * 60 * 60 * 1000;
    if (!data) return;
    Object.keys(data).forEach(key => {
        const item = data[key];
        if (item.createdAt && (now - item.createdAt > fiveHoursInMs) && !item.used) {
            db.ref('codes/' + key).remove()
                .then(() => console.log(`Kode ${key} kadaluarsa dihapus`))
                .catch(err => console.error("Gagal hapus kode:", err));
        }
    });
}

// Listener: Kode Pendaftaran
db.ref('codes').on('value', (snapshot) => {
    const data = snapshot.val();
    cleanupOldCodes(data);
    dbData.codes = [];
    if (data) {
        Object.keys(data).forEach(key => {
            dbData.codes.push({ code: key, ...data[key] });
        });
    }
    if (typeof renderCodesTable === 'function') renderCodesTable();
});