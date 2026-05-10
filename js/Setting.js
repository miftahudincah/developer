// ======================= SETTING.JS - VERSION 2.0 =======================
// PENGATURAN SEKOLAH (SCHOOL CONFIG) & DELAY GLOBAL
// Dengan real-time updates, notifikasi, dan auto-sync

let currentSchoolConfig = {
    type: 'smp',      // 'smp', 'smk', 'both'
    majors: []        // array of string (jurusan)
};

let settingsRealtimeListener = null;
let delayRealtimeListener = null;
let schoolConfigListener = null;

// ======================= REAL-TIME INITIALIZATION =======================

/**
 * Inisialisasi real-time listener untuk semua pengaturan (dipanggil dari main.js)
 */
function initRealtimeSettings() {
    console.log("🔄 Initializing real-time settings system...");
    
    if (!currentUser) {
        console.log("⏳ Menunggu currentUser sebelum init realtime settings");
        setTimeout(initRealtimeSettings, 500);
        return;
    }
    
    // Listener untuk delay global
    if (delayRealtimeListener) {
        db.ref('settings/delayOut').off('value', delayRealtimeListener);
    }
    
    delayRealtimeListener = db.ref('settings/delayOut').on('value', (snapshot) => {
        const delay = snapshot.val();
        console.log("⏰ Global delay updated:", delay);
        
        if (delay && delay > 0) {
            const displaySpan = document.getElementById('globalDelayDisplay');
            if (displaySpan) {
                displaySpan.textContent = formatDelayText(delay);
                displaySpan.style.transition = 'color 0.3s';
                displaySpan.style.color = '#4caf50';
                setTimeout(() => {
                    if (displaySpan) displaySpan.style.color = '';
                }, 500);
            }
            setGlobalDelayFormValue(delay);
        } else {
            const displaySpan = document.getElementById('globalDelayDisplay');
            if (displaySpan) displaySpan.textContent = formatDelayText(60);
            setGlobalDelayFormValue(60);
        }
    });
    
    // Listener untuk konfigurasi sekolah
    if (schoolConfigListener) {
        db.ref('school_config').off('value', schoolConfigListener);
    }
    
    schoolConfigListener = db.ref('school_config').on('value', (snapshot) => {
        const data = snapshot.val();
        const oldType = currentSchoolConfig.type;
        
        if (data) {
            currentSchoolConfig.type = data.type || 'smp';
            currentSchoolConfig.majors = data.majors || [];
        } else {
            currentSchoolConfig.type = 'smp';
            currentSchoolConfig.majors = [];
        }
        
        console.log(`🏫 School config updated: ${oldType} -> ${currentSchoolConfig.type}`);
        
        const typeSelect = document.getElementById('schoolTypeSelect');
        if (typeSelect && typeSelect.value !== currentSchoolConfig.type) {
            typeSelect.value = currentSchoolConfig.type;
        }
        
        const majorsDiv = document.getElementById('majorsManager');
        if (majorsDiv) {
            majorsDiv.style.display = (currentSchoolConfig.type === 'smk' || currentSchoolConfig.type === 'both') ? 'block' : 'none';
        }
        
        renderMajorsList();
        
        if (typeof populateKelasOptions === 'function') populateKelasOptions();
        if (typeof populateJurusanOptions === 'function') populateJurusanOptions();
        if (typeof populateStudentFilters === 'function') populateStudentFilters();
    });
    
    console.log("✅ Real-time settings initialized");
}

// ======================= FUNGSI FORMAT DELAY =======================

function formatDelayText(delayMinutes) {
    if (!delayMinutes && delayMinutes !== 0) return '-';
    const hours = Math.floor(delayMinutes / 60);
    const minutes = delayMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours} jam ${minutes} menit`;
    if (hours > 0) return `${hours} jam`;
    return `${minutes} menit`;
}

// ======================= DELAY GLOBAL =======================

function toggleGlobalDelayInput() {
    const unit = document.getElementById('globalDelayUnit');
    if (!unit) return;
    
    const minutesGroup = document.getElementById('globalDelayMinutesGroup');
    const hoursGroup = document.getElementById('globalDelayHoursGroup');
    const hiddenDelay = document.getElementById('globalDelayHidden');
    
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

function updateGlobalDelayFromMinutes() {
    const minutesValue = parseInt(document.getElementById('globalDelayMinutesValue')?.value) || 0;
    const hiddenDelay = document.getElementById('globalDelayHidden');
    if (hiddenDelay) hiddenDelay.value = minutesValue;
}

function updateGlobalDelayFromHours() {
    const hoursValue = parseInt(document.getElementById('globalDelayHoursValue')?.value) || 0;
    const hiddenDelay = document.getElementById('globalDelayHidden');
    if (hiddenDelay) hiddenDelay.value = hoursValue * 60;
}

function getGlobalDelayFromForm() {
    const unit = document.getElementById('globalDelayUnit')?.value;
    if (unit === 'minutes') {
        return parseInt(document.getElementById('globalDelayMinutesValue')?.value) || 60;
    } else {
        const hours = parseInt(document.getElementById('globalDelayHoursValue')?.value) || 1;
        return hours * 60;
    }
}

function setGlobalDelayFormValue(delayMinutes) {
    if (!delayMinutes && delayMinutes !== 0) delayMinutes = 60;
    const hours = Math.floor(delayMinutes / 60);
    const minutes = delayMinutes % 60;
    const unit = document.getElementById('globalDelayUnit');
    const minutesInput = document.getElementById('globalDelayMinutesValue');
    const hoursSelect = document.getElementById('globalDelayHoursValue');
    
    if (hours > 0 && minutes === 0) {
        if (unit) unit.value = 'hours';
        if (hoursSelect) hoursSelect.value = hours;
    } else {
        if (unit) unit.value = 'minutes';
        if (minutesInput) minutesInput.value = delayMinutes;
    }
    toggleGlobalDelayInput();
}

function saveGlobalDelay() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast("⛔ Hanya admin yang dapat mengubah delay global.", "error");
        return;
    }
    const delayMinutes = getGlobalDelayFromForm();
    if (delayMinutes <= 0) {
        showToast("⚠️ Delay harus lebih dari 0 menit!", "error");
        return;
    }
    const btn = document.getElementById('btnSaveGlobalDelay');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '💾 Menyimpan...';
    }
    db.ref('settings/delayOut').set(delayMinutes)
        .then(() => showToast(`✅ Delay global berhasil diupdate menjadi ${formatDelayText(delayMinutes)}`))
        .catch(err => showToast("❌ Gagal menyimpan: " + err.message, "error"))
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '💾 Simpan Delay Global';
            }
        });
}

function loadGlobalDelay() {
    // Real-time sudah ditangani oleh listener, cukup sekali baca untuk inisialisasi form
    db.ref('settings/delayOut').once('value').then(snapshot => {
        const delay = snapshot.val();
        setGlobalDelayFormValue(delay || 60);
    });
}

function initGlobalDelayListeners() {
    const unitSelect = document.getElementById('globalDelayUnit');
    const minutesInput = document.getElementById('globalDelayMinutesValue');
    const hoursSelect = document.getElementById('globalDelayHoursValue');
    
    if (unitSelect) {
        unitSelect.removeEventListener('change', toggleGlobalDelayInput);
        unitSelect.addEventListener('change', toggleGlobalDelayInput);
    }
    if (minutesInput) {
        minutesInput.removeEventListener('input', updateGlobalDelayFromMinutes);
        minutesInput.addEventListener('input', updateGlobalDelayFromMinutes);
    }
    if (hoursSelect) {
        hoursSelect.removeEventListener('change', updateGlobalDelayFromHours);
        hoursSelect.addEventListener('change', updateGlobalDelayFromHours);
    }
    toggleGlobalDelayInput();
}

// ======================= PENGATURAN SEKOLAH =======================

function loadSchoolConfig() {
    db.ref('school_config').once('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            currentSchoolConfig.type = data.type || 'smp';
            currentSchoolConfig.majors = data.majors || [];
        } else {
            currentSchoolConfig.type = 'smp';
            currentSchoolConfig.majors = [];
        }
        const typeSelect = document.getElementById('schoolTypeSelect');
        if (typeSelect) typeSelect.value = currentSchoolConfig.type;
        const majorsDiv = document.getElementById('majorsManager');
        if (majorsDiv) {
            majorsDiv.style.display = (currentSchoolConfig.type === 'smk' || currentSchoolConfig.type === 'both') ? 'block' : 'none';
        }
        renderMajorsList();
    });
}

function renderMajorsList() {
    const container = document.getElementById('majorsList');
    if (!container) return;
    if (!currentSchoolConfig.majors || currentSchoolConfig.majors.length === 0) {
        container.innerHTML = '<p class="text-small" style="margin: 8px;">📭 Belum ada jurusan. Tambahkan di bawah.</p>';
        return;
    }
    let html = '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';
    currentSchoolConfig.majors.forEach((major, index) => {
        html += `
            <div style="background: #2c2c2c; padding: 6px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px;">
                <span>📚 ${escapeHtmlStr(major)}</span>
                <span class="btn-icon delete" style="font-size: 14px; cursor: pointer;" onclick="removeMajor(${index})">✖</span>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function escapeHtmlStr(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

function saveSchoolType() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast("⛔ Hanya admin yang dapat mengubah tipe sekolah.", "error");
        return;
    }
    const newType = document.getElementById('schoolTypeSelect').value;
    const btn = document.querySelector('#tab-config button[onclick="saveSchoolType()"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '💾 Menyimpan...';
    }
    db.ref('school_config/type').set(newType)
        .then(() => showToast("✅ Tipe sekolah berhasil disimpan."))
        .catch(err => showToast("❌ Gagal: " + err.message, "error"))
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'Simpan';
            }
        });
}

function addMajor() {
    const input = document.getElementById('newMajorInput');
    const newMajor = input.value.trim().toUpperCase();
    if (!newMajor) {
        showToast("⚠️ Masukkan nama jurusan!", "error");
        return;
    }
    if (currentSchoolConfig.majors.includes(newMajor)) {
        showToast("❌ Jurusan sudah ada!", "error");
        return;
    }
    currentSchoolConfig.majors.push(newMajor);
    input.value = '';
    renderMajorsList();
    showToast(`✅ Jurusan "${newMajor}" ditambahkan. Jangan lupa klik 'Simpan Semua Jurusan'.`, "success");
}

function removeMajor(index) {
    if (index >= 0 && index < currentSchoolConfig.majors.length) {
        const removed = currentSchoolConfig.majors[index];
        currentSchoolConfig.majors.splice(index, 1);
        renderMajorsList();
        showToast(`🗑️ Jurusan "${removed}" dihapus sementara.`, "warning");
    }
}

function saveMajors() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast("⛔ Hanya admin yang dapat mengubah jurusan.", "error");
        return;
    }
    const btn = document.querySelector('#tab-config button[onclick="saveMajors()"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '💾 Menyimpan...';
    }
    db.ref('school_config/majors').set(currentSchoolConfig.majors)
        .then(() => showToast(`✅ Daftar jurusan berhasil disimpan (${currentSchoolConfig.majors.length} jurusan).`))
        .catch(err => showToast("❌ Gagal: " + err.message, "error"))
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'Simpan Semua Jurusan';
            }
        });
}

// ======================= RESET, EXPORT, IMPORT =======================

function resetAllSettings() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast("⛔ Hanya admin yang dapat mereset pengaturan!", "error");
        return;
    }
    if (!confirm("⚠️ Reset semua pengaturan ke default?\n\n- Delay global: 60 menit\n- Tipe sekolah: SMP\n- Jurusan: kosong\n\nLanjutkan?")) return;
    const btn = document.getElementById('btnResetSettings');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Mereset...';
    }
    Promise.all([
        db.ref('settings/delayOut').set(60),
        db.ref('school_config/type').set('smp'),
        db.ref('school_config/majors').set([])
    ]).then(() => showToast("✅ Semua pengaturan berhasil direset!", "success"))
      .catch(err => showToast("❌ Gagal mereset: " + err.message, "error"))
      .finally(() => { if (btn) { btn.disabled = false; btn.innerHTML = '🔄 Reset ke Default'; } });
}

function exportSchoolConfig() {
    const config = { schoolType: currentSchoolConfig.type, majors: currentSchoolConfig.majors, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `school_config_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("📥 Konfigurasi sekolah berhasil diekspor", "success");
}

function importSchoolConfig(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const config = JSON.parse(e.target.result);
            if (config.schoolType && ['smp','smk','both'].includes(config.schoolType)) {
                db.ref('school_config/type').set(config.schoolType);
                db.ref('school_config/majors').set(config.majors || []);
                showToast("✅ Konfigurasi sekolah berhasil diimpor!", "success");
            } else {
                showToast("❌ Format file tidak valid!", "error");
            }
        } catch(err) {
            showToast("❌ Gagal membaca file: " + err.message, "error");
        }
    };
    reader.readAsText(file);
}

// ======================= CLEANUP =======================

function cleanupSettingsSystem() {
    if (delayRealtimeListener) {
        db.ref('settings/delayOut').off('value', delayRealtimeListener);
        delayRealtimeListener = null;
    }
    if (schoolConfigListener) {
        db.ref('school_config').off('value', schoolConfigListener);
        schoolConfigListener = null;
    }
    console.log("🧹 Settings system cleaned up");
}

// ======================= INISIALISASI =======================

function initAllSettings() {
    console.log("🚀 initAllSettings - Memulai inisialisasi...");
    loadSchoolConfig();
    loadGlobalDelay();
    initGlobalDelayListeners();
    
    // Setup dropdown hours
    const globalHoursSelect = document.getElementById('globalDelayHoursValue');
    if (globalHoursSelect && globalHoursSelect.options.length <= 1) {
        for (let i = 1; i <= 24; i++) {
            globalHoursSelect.innerHTML += `<option value="${i}">${i} jam</option>`;
        }
    }
    console.log("✅ initAllSettings - Selesai");
}

// Auto-inisialisasi setelah DOM siap (tapi tidak usah auto, karena main.js akan panggil initRealtimeSettings)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initAllSettings, 500));
} else {
    setTimeout(initAllSettings, 500);
}

// Export ke global
window.formatDelayText = formatDelayText;
window.toggleGlobalDelayInput = toggleGlobalDelayInput;
window.updateGlobalDelayFromMinutes = updateGlobalDelayFromMinutes;
window.updateGlobalDelayFromHours = updateGlobalDelayFromHours;
window.saveGlobalDelay = saveGlobalDelay;
window.loadGlobalDelay = loadGlobalDelay;
window.initGlobalDelayListeners = initGlobalDelayListeners;
window.loadSchoolConfig = loadSchoolConfig;
window.renderMajorsList = renderMajorsList;
window.saveSchoolType = saveSchoolType;
window.addMajor = addMajor;
window.removeMajor = removeMajor;
window.saveMajors = saveMajors;
window.resetAllSettings = resetAllSettings;
window.exportSchoolConfig = exportSchoolConfig;
window.importSchoolConfig = importSchoolConfig;
window.initAllSettings = initAllSettings;
window.initRealtimeSettings = initRealtimeSettings;
window.cleanupSettingsSystem = cleanupSettingsSystem;