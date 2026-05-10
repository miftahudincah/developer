// ======================= SETTING.JS =======================
// PENGATURAN SEKOLAH (SCHOOL CONFIG) & DELAY GLOBAL

let currentSchoolConfig = {
    type: 'smp',      // 'smp', 'smk', 'both'
    majors: []        // array of string (jurusan)
};

// ======================= FUNGSI FORMAT DELAY =======================

/**
 * Format delay dalam menit menjadi teks yang mudah dibaca
 * @param {number} delayMinutes - Delay dalam menit
 * @returns {string} Format teks (contoh: "2 jam 30 menit")
 */
function formatDelayText(delayMinutes) {
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

// ======================= DELAY GLOBAL (UNTUK ESP32) =======================

/**
 * Toggle tampilan input delay global antara Menit dan Jam
 */
function toggleGlobalDelayInput() {
    console.log("toggleGlobalDelayInput dipanggil");
    const unit = document.getElementById('globalDelayUnit');
    if (!unit) {
        console.log("Element globalDelayUnit tidak ditemukan");
        return;
    }
    
    const minutesGroup = document.getElementById('globalDelayMinutesGroup');
    const hoursGroup = document.getElementById('globalDelayHoursGroup');
    const hiddenDelay = document.getElementById('globalDelayHidden');
    
    console.log("Unit value:", unit.value);
    
    if (unit.value === 'minutes') {
        if (minutesGroup) minutesGroup.style.display = 'flex';
        if (hoursGroup) hoursGroup.style.display = 'none';
        const minutesValue = parseInt(document.getElementById('globalDelayMinutesValue')?.value) || 60;
        if (hiddenDelay) hiddenDelay.value = minutesValue;
    } else {
        if (minutesGroup) minutesGroup.style.display = 'none';
        if (hoursGroup) hoursGroup.style.display = 'flex';
        const hoursValue = parseInt(document.getElementById('globalDelayHoursValue')?.value) || 1;
        if (hiddenDelay) hiddenDelay.value = hoursValue * 60;
    }
}

/**
 * Update hidden field global delay ketika nilai menit berubah
 */
function updateGlobalDelayFromMinutes() {
    const minutesValue = parseInt(document.getElementById('globalDelayMinutesValue')?.value) || 0;
    const hiddenDelay = document.getElementById('globalDelayHidden');
    if (hiddenDelay) hiddenDelay.value = minutesValue;
    console.log("Update dari menit:", minutesValue);
}

/**
 * Update hidden field global delay ketika nilai jam berubah
 */
function updateGlobalDelayFromHours() {
    const hoursValue = parseInt(document.getElementById('globalDelayHoursValue')?.value) || 0;
    const hiddenDelay = document.getElementById('globalDelayHidden');
    if (hiddenDelay) hiddenDelay.value = hoursValue * 60;
    console.log("Update dari jam:", hoursValue, "=> menit:", hoursValue * 60);
}

/**
 * Mendapatkan nilai delay global dari form
 * @returns {number} Delay dalam menit
 */
function getGlobalDelayFromForm() {
    const unit = document.getElementById('globalDelayUnit')?.value;
    if (unit === 'minutes') {
        return parseInt(document.getElementById('globalDelayMinutesValue')?.value) || 60;
    } else {
        const hours = parseInt(document.getElementById('globalDelayHoursValue')?.value) || 1;
        return hours * 60;
    }
}

/**
 * Mengatur nilai global delay pada form berdasarkan nilai dalam menit
 * @param {number} delayMinutes - Delay dalam menit
 */
function setGlobalDelayFormValue(delayMinutes) {
    if (!delayMinutes && delayMinutes !== 0) {
        delayMinutes = 60;
    }
    
    const hours = Math.floor(delayMinutes / 60);
    const minutes = delayMinutes % 60;
    
    const unit = document.getElementById('globalDelayUnit');
    const minutesInput = document.getElementById('globalDelayMinutesValue');
    const hoursSelect = document.getElementById('globalDelayHoursValue');
    
    if (hours > 0 && minutes === 0) {
        // Genap jam
        if (unit) unit.value = 'hours';
        if (hoursSelect) hoursSelect.value = hours;
    } else {
        // Tidak genap jam
        if (unit) unit.value = 'minutes';
        if (minutesInput) minutesInput.value = delayMinutes;
    }
    
    // Panggil toggle untuk update tampilan
    toggleGlobalDelayInput();
}

/**
 * MENYIMPAN DELAY GLOBAL KE FIREBASE
 * Fungsi ini dipanggil saat tombol "Simpan Delay Global" diklik
 */
function saveGlobalDelay() {
    console.log("saveGlobalDelay dipanggil");
    
    // Cek login
    if (!currentUser) {
        showToast("Anda belum login!", "error");
        return;
    }
    
    // Cek role admin
    if (currentUser.role !== 'admin') {
        showToast("Hanya admin yang dapat mengubah delay global.", "error");
        return;
    }
    
    // Ambil nilai delay dari form
    const delayMinutes = getGlobalDelayFromForm();
    console.log("Delay yang akan disimpan:", delayMinutes, "menit");
    
    if (delayMinutes <= 0) {
        showToast("Delay harus lebih dari 0 menit!", "error");
        return;
    }
    
    // Nonaktifkan tombol sambil menyimpan
    const btn = document.getElementById('btnSaveGlobalDelay');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '💾 Menyimpan...';
    }
    
    // Simpan ke Firebase di node /settings/delayOut
    db.ref('settings/delayOut').set(delayMinutes)
        .then(() => {
            showToast(`✅ Delay global berhasil diupdate menjadi ${formatDelayText(delayMinutes)}`);
            console.log("Berhasil menyimpan delay global");
            
            // Update tampilan
            const displaySpan = document.getElementById('globalDelayDisplay');
            if (displaySpan) {
                displaySpan.textContent = formatDelayText(delayMinutes);
            }
        })
        .catch(err => {
            console.error("Gagal menyimpan:", err);
            showToast("❌ Gagal menyimpan: " + err.message, "error");
        })
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '💾 Simpan Delay Global';
            }
        });
}

/**
 * MEMBACA DELAY GLOBAL DARI FIREBASE
 */
function loadGlobalDelay() {
    console.log("loadGlobalDelay dipanggil");
    
    db.ref('settings/delayOut').on('value', (snapshot) => {
        const delay = snapshot.val();
        console.log("Delay global dari Firebase:", delay);
        
        if (delay && delay > 0) {
            // Update tampilan di UI
            const displaySpan = document.getElementById('globalDelayDisplay');
            if (displaySpan) {
                displaySpan.textContent = formatDelayText(delay);
            }
            
            // Set nilai ke form
            setGlobalDelayFormValue(delay);
        } else {
            // Default 60 menit jika belum ada setting
            const displaySpan = document.getElementById('globalDelayDisplay');
            if (displaySpan) {
                displaySpan.textContent = formatDelayText(60);
            }
            setGlobalDelayFormValue(60);
        }
    }, (error) => {
        console.error("Error membaca delay global:", error);
    });
}

/**
 * INISIALISASI EVENT LISTENER UNTUK GLOBAL DELAY
 */
function initGlobalDelayListeners() {
    console.log("initGlobalDelayListeners dipanggil");
    
    const unitSelect = document.getElementById('globalDelayUnit');
    const minutesInput = document.getElementById('globalDelayMinutesValue');
    const hoursSelect = document.getElementById('globalDelayHoursValue');
    
    if (unitSelect) {
        unitSelect.removeEventListener('change', toggleGlobalDelayInput);
        unitSelect.addEventListener('change', toggleGlobalDelayInput);
        console.log("Event listener unitSelect terpasang");
    }
    
    if (minutesInput) {
        minutesInput.removeEventListener('input', updateGlobalDelayFromMinutes);
        minutesInput.addEventListener('input', updateGlobalDelayFromMinutes);
        console.log("Event listener minutesInput terpasang");
    }
    
    if (hoursSelect) {
        hoursSelect.removeEventListener('change', updateGlobalDelayFromHours);
        hoursSelect.addEventListener('change', updateGlobalDelayFromHours);
        console.log("Event listener hoursSelect terpasang");
    }
    
    // Panggil toggle untuk memastikan tampilan sesuai
    toggleGlobalDelayInput();
}

// ======================= PENGATURAN SEKOLAH =======================

// Memuat konfigurasi sekolah dari Firebase
function loadSchoolConfig() {
    db.ref('school_config').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            currentSchoolConfig.type = data.type || 'smp';
            currentSchoolConfig.majors = data.majors || [];
        } else {
            currentSchoolConfig.type = 'smp';
            currentSchoolConfig.majors = [];
        }
        
        // Update UI form
        const typeSelect = document.getElementById('schoolTypeSelect');
        if (typeSelect) typeSelect.value = currentSchoolConfig.type;
        
        // Tampilkan/sembunyikan manager jurusan
        const majorsDiv = document.getElementById('majorsManager');
        if (majorsDiv) {
            majorsDiv.style.display = (currentSchoolConfig.type === 'smk' || currentSchoolConfig.type === 'both') ? 'block' : 'none';
        }
        renderMajorsList();

        // Panggilan ke dropdown siswa
        if (typeof populateKelasOptions === 'function') populateKelasOptions();
        if (typeof populateJurusanOptions === 'function') populateJurusanOptions();
        if (typeof populateStudentFilters === 'function') populateStudentFilters();
    });
}

// Render daftar jurusan di UI
function renderMajorsList() {
    const container = document.getElementById('majorsList');
    if (!container) return;
    
    if (!currentSchoolConfig.majors || currentSchoolConfig.majors.length === 0) {
        container.innerHTML = '<p class="text-small" style="margin: 8px;">Belum ada jurusan. Tambahkan di bawah.</p>';
        return;
    }
    
    let html = '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';
    currentSchoolConfig.majors.forEach((major, index) => {
        html += `
            <div style="background: #2c2c2c; padding: 5px 10px; border-radius: 20px; display: flex; align-items: center; gap: 8px;">
                <span>${escapeHtmlStr(major)}</span>
                <span class="btn-icon delete" style="font-size: 14px; cursor: pointer;" onclick="removeMajor(${index})">✖</span>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// Helper untuk menghindari XSS
function escapeHtmlStr(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Menyimpan tipe sekolah
function saveSchoolType() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast("Hanya admin yang dapat mengubah tipe sekolah.", "error");
        return;
    }
    const newType = document.getElementById('schoolTypeSelect').value;
    db.ref('school_config/type').set(newType)
        .then(() => {
            showToast("Tipe sekolah berhasil disimpan.");
            loadSchoolConfig();
        })
        .catch(err => showToast("Gagal: " + err.message, "error"));
}

// Menambah jurusan sementara
function addMajor() {
    const input = document.getElementById('newMajorInput');
    const newMajor = input.value.trim().toUpperCase();
    if (!newMajor) {
        showToast("Masukkan nama jurusan!", "error");
        return;
    }
    if (currentSchoolConfig.majors.includes(newMajor)) {
        showToast("Jurusan sudah ada!", "error");
        return;
    }
    currentSchoolConfig.majors.push(newMajor);
    input.value = '';
    renderMajorsList();
    showToast("Jurusan ditambahkan. Jangan lupa klik 'Simpan Semua Jurusan'.", "success");
}

// Menghapus jurusan dari array sementara
function removeMajor(index) {
    if (index >= 0 && index < currentSchoolConfig.majors.length) {
        currentSchoolConfig.majors.splice(index, 1);
        renderMajorsList();
        showToast("Jurusan dihapus sementara. Klik 'Simpan Semua Jurusan' untuk menyimpan perubahan.", "info");
    }
}

// Menyimpan daftar jurusan ke Firebase
function saveMajors() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast("Hanya admin yang dapat mengubah jurusan.", "error");
        return;
    }
    db.ref('school_config/majors').set(currentSchoolConfig.majors)
        .then(() => {
            showToast("Daftar jurusan berhasil disimpan.");
        })
        .catch(err => showToast("Gagal: " + err.message, "error"));
}

// ======================= INISIALISASI SEMUA PENGATURAN =======================

/**
 * INISIALISASI UTAMA - Panggil fungsi ini dari main.js atau ui.js
 */
function initAllSettings() {
    console.log("initAllSettings - Memulai inisialisasi...");
    
    // Load konfigurasi sekolah
    loadSchoolConfig();
    
    // Load delay global dari Firebase
    loadGlobalDelay();
    
    // Inisialisasi event listener untuk global delay
    initGlobalDelayListeners();
    
    console.log("initAllSettings - Selesai");
}

// Auto-inisialisasi jika DOM sudah siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log("DOMContentLoaded - Memanggil initAllSettings");
        initAllSettings();
    });
} else {
    console.log("DOM already loaded - Memanggil initAllSettings");
    initAllSettings();
}