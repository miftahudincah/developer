// students.js
// ======================= DROPDOWN KELAS & JURUSAN DINAMIS =======================

// Mengisi dropdown Kelas berdasarkan tipe sekolah (SMP / SMK / both)
function populateKelasOptions() {
    const kelasSelect = document.getElementById('newKelas');
    if (!kelasSelect) return;

    let options = [];
    const schoolType = currentSchoolConfig.type;

    if (schoolType === 'smp') {
        options = ['VII', 'VIII', 'IX'];
    } else if (schoolType === 'smk') {
        options = ['X', 'XI', 'XII'];
    } else if (schoolType === 'both') {
        options = ['VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    }

    kelasSelect.innerHTML = '<option value="">-- Pilih Kelas --</option>' +
        options.map(k => `<option value="${k}">${k}</option>`).join('');
}

// Mengisi dropdown Jurusan berdasarkan daftar jurusan dari school_config
function populateJurusanOptions() {
    const jurusanSelect = document.getElementById('newJurusan');
    if (!jurusanSelect) return;

    jurusanSelect.innerHTML = '<option value="">-- Pilih Jurusan --</option>';
    
    if (currentSchoolConfig.majors && currentSchoolConfig.majors.length > 0) {
        currentSchoolConfig.majors.forEach(j => {
            jurusanSelect.innerHTML += `<option value="${j}">${j}</option>`;
        });
    } else {
        jurusanSelect.innerHTML += '<option value="UMUM">UMUM</option>';
    }
}

// ======================= FUNGSI DELAY (JAM/MENIT) =======================

/**
 * Toggle tampilan input delay antara Menit dan Jam
 */
function toggleDelayInput() {
    const unit = document.getElementById('delayUnit');
    if (!unit) return;
    
    const minutesGroup = document.getElementById('delayMinutesGroup');
    const hoursGroup = document.getElementById('delayHoursGroup');
    const hiddenDelay = document.getElementById('newDelay');
    
    if (unit.value === 'minutes') {
        if (minutesGroup) minutesGroup.style.display = 'flex';
        if (hoursGroup) hoursGroup.style.display = 'none';
        const minutesValue = parseInt(document.getElementById('delayMinutesValue')?.value) || 0;
        if (hiddenDelay) hiddenDelay.value = minutesValue;
    } else {
        if (minutesGroup) minutesGroup.style.display = 'none';
        if (hoursGroup) hoursGroup.style.display = 'flex';
        const hoursValue = parseInt(document.getElementById('delayHoursValue')?.value) || 0;
        if (hiddenDelay) hiddenDelay.value = hoursValue * 60;
    }
}

/**
 * Update hidden field ketika nilai menit berubah
 */
function updateDelayFromMinutes() {
    const minutesValue = parseInt(document.getElementById('delayMinutesValue')?.value) || 0;
    const hiddenDelay = document.getElementById('newDelay');
    if (hiddenDelay) hiddenDelay.value = minutesValue;
}

/**
 * Update hidden field ketika nilai jam berubah
 */
function updateDelayFromHours() {
    const hoursValue = parseInt(document.getElementById('delayHoursValue')?.value) || 0;
    const hiddenDelay = document.getElementById('newDelay');
    if (hiddenDelay) hiddenDelay.value = hoursValue * 60;
}

/**
 * Mendapatkan nilai delay dalam menit dari form
 * @returns {number} Delay dalam menit
 */
function getDelayInMinutes() {
    const unit = document.getElementById('delayUnit')?.value;
    if (unit === 'minutes') {
        return parseInt(document.getElementById('delayMinutesValue')?.value) || 0;
    } else {
        const hours = parseInt(document.getElementById('delayHoursValue')?.value) || 0;
        return hours * 60;
    }
}

/**
 * Mengatur nilai delay pada form berdasarkan nilai dalam menit
 * @param {number} delayMinutes - Delay dalam menit
 */
function setDelayFormValue(delayMinutes) {
    if (!delayMinutes && delayMinutes !== 0) {
        delayMinutes = 60;
    }
    
    const hours = Math.floor(delayMinutes / 60);
    const minutes = delayMinutes % 60;
    
    if (hours > 0 && minutes === 0) {
        const delayUnit = document.getElementById('delayUnit');
        const delayHoursValue = document.getElementById('delayHoursValue');
        if (delayUnit) delayUnit.value = 'hours';
        if (delayHoursValue) delayHoursValue.value = hours;
        toggleDelayInput();
    } else {
        const delayUnit = document.getElementById('delayUnit');
        const delayMinutesValue = document.getElementById('delayMinutesValue');
        if (delayUnit) delayUnit.value = 'minutes';
        if (delayMinutesValue) delayMinutesValue.value = delayMinutes;
        toggleDelayInput();
    }
}

/**
 * Format delay untuk ditampilkan di tabel
 * @param {number} delayMinutes - Delay dalam menit
 * @returns {string} Format delay yang mudah dibaca
 */
function formatDelayDisplay(delayMinutes) {
    if (!delayMinutes && delayMinutes !== 0) return '-';
    
    const hours = Math.floor(delayMinutes / 60);
    const minutes = delayMinutes % 60;
    
    if (hours > 0 && minutes > 0) {
        return `${hours} jam ${minutes} menit`;
    } else if (hours > 0) {
        return `${hours} jam`;
    } else {
        return `${minutes} menit`;
    }
}

// ======================= FUNGSI FILTER SISWA =======================

function populateStudentFilters() {
    const kSelect = document.getElementById('filterStudentKelas');
    const jSelect = document.getElementById('filterStudentJurusan');
    
    if (!kSelect || !jSelect) return;

    let kelasOptions = [];
    const schoolType = currentSchoolConfig?.type || 'smp';
    if (schoolType === 'smp') kelasOptions = ['VII', 'VIII', 'IX'];
    else if (schoolType === 'smk') kelasOptions = ['X', 'XI', 'XII'];
    else if (schoolType === 'both') kelasOptions = ['VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

    kSelect.innerHTML = '<option value="all">Semua Kelas</option>' +
        kelasOptions.map(k => `<option value="${k}">${k}</option>`).join('');

    jSelect.innerHTML = '<option value="all">Semua Jurusan</option>';
    if (currentSchoolConfig?.majors && currentSchoolConfig.majors.length > 0) {
        currentSchoolConfig.majors.forEach(j => {
            jSelect.innerHTML += `<option value="${j}">${j}</option>`;
        });
    } else {
        jSelect.innerHTML += '<option value="UMUM">UMUM</option>';
    }
}

// ======================= RENDER TABEL SISWA =======================

function renderStudentsTable() {
    const tbody = document.getElementById('tbody-students');
    const search = document.getElementById('searchStudentName');
    const fKelas = document.getElementById('filterStudentKelas');
    const fJurusan = document.getElementById('filterStudentJurusan');
    
    if (!tbody) return;
    
    const searchValue = search?.value.toLowerCase() || '';
    const kelasValue = fKelas?.value || 'all';
    const jurusanValue = fJurusan?.value || 'all';

    let data = dbData.users.filter(u => u.nama && u.nama.toLowerCase().includes(searchValue));

    if (kelasValue !== 'all') data = data.filter(u => u.kelas === kelasValue);
    if (jurusanValue !== 'all') data = data.filter(u => u.jurusan === jurusanValue);

    tbody.innerHTML = '';
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Data siswa tidak ditemukan.</td></tr>';
        return;
    }

    data.forEach(s => {
        const delayDisplay = formatDelayDisplay(s.delayOut);
        
        tbody.innerHTML += `
            <tr>
                <td>${s.id}</td>
                <td>${escapeHtml(s.nama)}</td>
                <td>${s.kelas || '-'}</td>
                <td>${s.jurusan || '-'}</td>
                <td>${delayDisplay}</td>
                <td>
                    <button class="btn-icon edit" onclick="editStudent('${s.id}')" title="Edit">✎</button>
                    <button class="btn-icon delete" onclick="deleteStudent('${s.id}')" title="Hapus">🗑</button>
                </td>
            </td>`;
    });
}

// ======================= CRUD SISWA =======================

/**
 * Simpan data siswa ke Firebase
 * Struktur: users/{id} = { id, nama, kelas, jurusan, delayOut }
 */
function saveStudent() {
    let idStr = document.getElementById('newId')?.value;
    const nama = document.getElementById('newNama')?.value;
    const kelas = document.getElementById('newKelas')?.value;
    const jurusan = document.getElementById('newJurusan')?.value;
    const delayInMinutes = getDelayInMinutes();
    const mode = document.getElementById('editMode')?.value;

    if (!nama || !idStr) return showToast("ID & Nama wajib!", "error");
    if (!kelas) return showToast("Pilih Kelas!", "error");
    if (!jurusan) return showToast("Pilih Jurusan!", "error");
    if (delayInMinutes <= 0) return showToast("Delay harus lebih dari 0!", "error");

    // Struktur data yang akan disimpan ke Firebase
    // Sesuai dengan yang dibaca oleh ESP32 di node users/{id}
    const studentData = { 
        id: parseInt(idStr),
        nama: nama, 
        kelas: kelas, 
        jurusan: jurusan, 
        delayOut: delayInMinutes 
    };
    const path = `users/${idStr}`;

    if (mode === 'add' && dbData.users.find(u => u.id == idStr)) {
        return showToast("ID sudah ada!", "error");
    }

    db.ref(path).set(studentData).then(() => {
        showToast("Data tersimpan di Firebase");
        resetStudentForm();

        // Sinkronisasi ke users_auth jika siswa sudah punya akun
        const registeredUser = dbData.users_auth.find(u => u.fpId == idStr);
        if (registeredUser) {
            db.ref(`users_auth/${registeredUser.uid}`).update({ 
                nama: nama, 
                kelas: kelas, 
                jurusan: jurusan 
            }).then(() => showToast("Profil siswa juga diperbarui"));
        }
        
        // Optional: Update setting global delay jika diperlukan
        // updateGlobalDelaySetting();
    }).catch((err) => {
        showToast("Gagal menyimpan: " + err.message, "error");
    });
}

/**
 * Update pengaturan delay global (opsional)
 * ESP32 akan membaca node /settings/delayOut
 */
function updateGlobalDelaySetting() {
    // Ambil delay tertinggi atau rata-rata? 
    // Atau biarkan admin mengatur manual di tab Config
    // Fungsi ini bisa dikembangkan sesuai kebutuhan
}

function editStudent(id) {
    const s = dbData.users.find(u => u.id == id);
    if (s) {
        document.getElementById('newId').value = s.id;
        document.getElementById('newId').disabled = true;
        document.getElementById('newNama').value = s.nama;
        document.getElementById('newKelas').value = s.kelas;
        document.getElementById('newJurusan').value = s.jurusan;
        
        setDelayFormValue(s.delayOut);
        
        document.getElementById('editMode').value = 'edit';
        const btnSave = document.getElementById('btnSaveStudent');
        const btnCancel = document.getElementById('btnCancelStudent');
        if (btnSave) btnSave.innerHTML = '💾 Update';
        if (btnCancel) btnCancel.classList.remove('hidden');
    }
}

function resetStudentForm() {
    document.getElementById('newId').value = '';
    document.getElementById('newId').disabled = false;
    document.getElementById('newNama').value = '';
    document.getElementById('newKelas').value = '';
    document.getElementById('newJurusan').value = '';
    
    const delayUnit = document.getElementById('delayUnit');
    const delayMinutesValue = document.getElementById('delayMinutesValue');
    const delayHoursValue = document.getElementById('delayHoursValue');
    const hiddenDelay = document.getElementById('newDelay');
    
    if (delayUnit) delayUnit.value = 'minutes';
    if (delayMinutesValue) delayMinutesValue.value = '60';
    if (delayHoursValue) delayHoursValue.value = '1';
    if (hiddenDelay) hiddenDelay.value = '60';
    toggleDelayInput();
    
    document.getElementById('editMode').value = 'add';
    const btnSave = document.getElementById('btnSaveStudent');
    const btnCancel = document.getElementById('btnCancelStudent');
    if (btnSave) btnSave.innerHTML = '➕ Simpan Siswa';
    if (btnCancel) btnCancel.classList.add('hidden');
}

function deleteStudent(id) {
    if (!confirm("Hapus data siswa?")) return;
    
    db.ref(`users/${id}`).remove().then(() => {
        showToast("Data siswa dihapus");
    }).catch((err) => {
        showToast("Gagal menghapus: " + err.message, "error");
    });
}

// ======================= UTILITY =======================

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ======================= INISIALISASI =======================

function initDelayEventListeners() {
    const delayMinutesInput = document.getElementById('delayMinutesValue');
    const delayHoursSelect = document.getElementById('delayHoursValue');
    const delayUnitSelect = document.getElementById('delayUnit');
    
    if (delayMinutesInput) {
        delayMinutesInput.removeEventListener('input', updateDelayFromMinutes);
        delayMinutesInput.addEventListener('input', updateDelayFromMinutes);
    }
    if (delayHoursSelect) {
        delayHoursSelect.removeEventListener('change', updateDelayFromHours);
        delayHoursSelect.addEventListener('change', updateDelayFromHours);
    }
    if (delayUnitSelect) {
        delayUnitSelect.removeEventListener('change', toggleDelayInput);
        delayUnitSelect.addEventListener('change', toggleDelayInput);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDelayEventListeners);
} else {
    initDelayEventListeners();
}