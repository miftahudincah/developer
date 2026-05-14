// setting.js - VERSION 3.0 (EVENT-BASED, NO DUPLICATE LISTENERS)
// PENGATURAN SEKOLAH (SCHOOL CONFIG) & DELAY GLOBAL
// Dengan dukungan manajemen KELAS dan JURUSAN yang bisa diedit
// SENSOR STATUS: Dipisahkan ke modul sendiri (tetapi tetap di sini untuk kemudahan)
// PERUBAHAN: Menghapus semua listener Firebase duplikat, menggunakan event 'dataReady' dan 'uiReady'
// ============================================================================

let currentSchoolConfig = {
    type: 'smp',        // 'smp', 'smk', 'both'
    majors: [],         // array of string (jurusan) - untuk SMK
    classes: []         // array of string (kelas) - untuk semua tipe sekolah
};

let settingDataReadyListenerAdded = false;
let settingUiReadyListenerAdded = false;

// ======================= EVENT LISTENER ========================

function setupSettingDataReadyListener() {
    if (settingDataReadyListenerAdded) return;
    settingDataReadyListenerAdded = true;
    console.log("📡 Setting up dataReady event listener for settings module");

    window.addEventListener('dataReady', (e) => {
        console.log("⚙️ setting.js: dataReady received, updating settings UI");
        // Data schoolConfig dan globalDelay sudah diisi oleh init.js
        // Kita hanya perlu mengambil dari window.currentSchoolConfig (dari init.js)
        if (window.currentSchoolConfig) {
            currentSchoolConfig = window.currentSchoolConfig;
            updateSchoolTypeUI();
            renderClassesList();
            renderMajorsList();
        }
        // Update tampilan delay global
        const delaySpan = document.getElementById('globalDelayDisplay');
        if (delaySpan && window.globalDelayValue !== undefined) {
            delaySpan.textContent = formatDelayText(window.globalDelayValue);
        }
        // Populate dropdown yang bergantung
        if (typeof populateKelasOptions === 'function') populateKelasOptions();
        if (typeof populateJurusanOptions === 'function') populateJurusanOptions();
        if (typeof populateStudentFilters === 'function') populateStudentFilters();
    });
}

function setupSettingUiReadyListener() {
    if (settingUiReadyListenerAdded) return;
    settingUiReadyListenerAdded = true;
    console.log("📡 Setting up uiReady event listener for sensor status");

    window.addEventListener('uiReady', (e) => {
        const user = e.detail.currentUser;
        if (user && user.role === 'admin') {
            console.log("🔍 uiReady: initializing sensor status for admin");
            initSensorStatusListener();
        } else {
            // Sembunyikan panel sensor jika bukan admin
            const panel = document.getElementById('sensorStatusPanel');
            if (panel) panel.style.display = 'none';
        }
    });
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

// ======================= DELAY GLOBAL (UI only, tanpa listener) =======================

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

// ======================= MANAJEMEN KELAS =======================

function renderClassesList() {
    const container = document.getElementById('classesList');
    if (!container) return;
    
    const classes = currentSchoolConfig.classes || [];
    if (classes.length === 0) {
        container.innerHTML = '<p class="text-small" style="margin: 8px; color: #888;">📭 Belum ada kelas. Tambahkan di bawah.</p>';
        return;
    }
    
    let html = '<div style="display: flex; flex-wrap: wrap; gap: 10px;">';
    classes.forEach((className, index) => {
        html += `
            <div style="background: #2c2c3a; padding: 8px 14px; border-radius: 25px; display: flex; align-items: center; gap: 10px; border-left: 3px solid #4caf50;">
                <span>🏫 ${escapeHtmlStr(className)}</span>
                <span class="btn-icon delete" style="font-size: 14px; cursor: pointer; color: #f44336;" onclick="removeClass(${index})">✖</span>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function addClass() {
    const input = document.getElementById('newClassInput');
    if (!input) return;
    
    let newClass = input.value.trim().toUpperCase();
    if (!newClass) {
        showToast("⚠️ Masukkan nama kelas!", "error");
        return;
    }
    
    newClass = formatClassName(newClass);
    
    if (currentSchoolConfig.classes.includes(newClass)) {
        showToast("❌ Kelas sudah ada!", "error");
        return;
    }
    
    currentSchoolConfig.classes.push(newClass);
    input.value = '';
    renderClassesList();
    showToast(`✅ Kelas "${newClass}" ditambahkan. Jangan lupa klik 'Simpan Semua Kelas'.`, "success");
    input.focus();
}

function formatClassName(input) {
    let result = input.toUpperCase();
    const romanMap = {
        '7': 'VII', 'VIII': 'VIII', '7A': 'VII A', '7B': 'VII B', '7C': 'VII C',
        '8': 'VIII', '8A': 'VIII A', '8B': 'VIII B', '8C': 'VIII C',
        '9': 'IX', '9A': 'IX A', '9B': 'IX B', '9C': 'IX C',
        '10': 'X', '10A': 'X A', '10B': 'X B', '10C': 'X C',
        '11': 'XI', '11A': 'XI A', '11B': 'XI B', '11C': 'XI C',
        '12': 'XII', '12A': 'XII A', '12B': 'XII B', '12C': 'XII C'
    };
    if (romanMap[result]) return romanMap[result];
    if (romanMap[result.replace(' ', '')]) return romanMap[result.replace(' ', '')];
    
    const match = result.match(/^([0-9]+|[IVX]+)\s*([A-Z]+)?$/);
    if (match) {
        let num = match[1];
        let suffix = match[2] || '';
        const numToRoman = { '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X', '11': 'XI', '12': 'XII' };
        if (numToRoman[num]) {
            result = numToRoman[num];
            if (suffix) result += ' ' + suffix;
        }
    }
    return result;
}

function removeClass(index) {
    if (index >= 0 && index < currentSchoolConfig.classes.length) {
        const removed = currentSchoolConfig.classes[index];
        currentSchoolConfig.classes.splice(index, 1);
        renderClassesList();
        showToast(`🗑️ Kelas "${removed}" dihapus sementara.`, "warning");
    }
}

function saveClasses() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast("⛔ Hanya admin yang dapat mengubah daftar kelas.", "error");
        return;
    }
    if (currentSchoolConfig.classes.length === 0) {
        showToast("⚠️ Minimal harus ada 1 kelas!", "error");
        return;
    }
    const btn = document.getElementById('btnSaveClasses');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '💾 Menyimpan...';
    }
    db.ref('school_config/classes').set(currentSchoolConfig.classes)
        .then(() => showToast(`✅ Daftar kelas berhasil disimpan (${currentSchoolConfig.classes.length} kelas).`))
        .catch(err => showToast("❌ Gagal: " + err.message, "error"))
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '💾 Simpan Semua Kelas';
            }
        });
}

// ======================= PENGATURAN JURUSAN =======================

function updateSchoolTypeUI() {
    const typeSelect = document.getElementById('schoolTypeSelect');
    if (typeSelect && typeSelect.value !== currentSchoolConfig.type) {
        typeSelect.value = currentSchoolConfig.type;
    }
    const majorsManager = document.getElementById('majorsManager');
    if (majorsManager) {
        majorsManager.style.display = (currentSchoolConfig.type === 'smk' || currentSchoolConfig.type === 'both') ? 'block' : 'none';
    }
}

function renderMajorsList() {
    const container = document.getElementById('majorsList');
    if (!container) return;
    
    const majors = currentSchoolConfig.majors || [];
    if (majors.length === 0) {
        container.innerHTML = '<p class="text-small" style="margin: 8px; color: #888;">📭 Belum ada jurusan. Tambahkan di bawah.</p>';
        return;
    }
    
    let html = '<div style="display: flex; flex-wrap: wrap; gap: 10px;">';
    majors.forEach((major, index) => {
        html += `
            <div style="background: #2c2c3a; padding: 8px 14px; border-radius: 25px; display: flex; align-items: center; gap: 10px; border-left: 3px solid #00bcd4;">
                <span>📚 ${escapeHtmlStr(major)}</span>
                <span class="btn-icon delete" style="font-size: 14px; cursor: pointer; color: #f44336;" onclick="removeMajor(${index})">✖</span>
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
    const newClasses = getDefaultClasses(newType);
    Promise.all([
        db.ref('school_config/type').set(newType),
        db.ref('school_config/classes').set(newClasses)
    ]).then(() => {
        showToast("✅ Tipe sekolah berhasil disimpan.");
        currentSchoolConfig.type = newType;
        currentSchoolConfig.classes = newClasses;
        updateSchoolTypeUI();
        renderClassesList();
        if (newType !== 'smk' && newType !== 'both') {
            currentSchoolConfig.majors = [];
            renderMajorsList();
            db.ref('school_config/majors').set([]);
        }
    })
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
    if (!input) return;
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
    input.focus();
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
    const btn = document.getElementById('btnSaveMajors');
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
                btn.innerHTML = '💾 Simpan Semua Jurusan';
            }
        });
}

function getDefaultClasses(schoolType) {
    if (schoolType === 'smp') return ['VII', 'VIII', 'IX'];
    if (schoolType === 'smk') return ['X', 'XI', 'XII'];
    return ['VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
}

// ======================= RESET, EXPORT, IMPORT =======================

function resetAllSettings() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast("⛔ Hanya admin yang dapat mereset pengaturan!", "error");
        return;
    }
    if (!confirm("⚠️ Reset semua pengaturan ke default?\n\n- Delay global: 60 menit\n- Tipe sekolah: SMP\n- Kelas: VII, VIII, IX\n- Jurusan: kosong\n\nLanjutkan?")) return;
    
    const defaultClasses = ['VII', 'VIII', 'IX'];
    const btn = document.getElementById('btnResetSettings');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Mereset...';
    }
    Promise.all([
        db.ref('settings/delayOut').set(60),
        db.ref('school_config/type').set('smp'),
        db.ref('school_config/majors').set([]),
        db.ref('school_config/classes').set(defaultClasses)
    ]).then(() => {
        showToast("✅ Semua pengaturan berhasil direset!", "success");
        currentSchoolConfig.type = 'smp';
        currentSchoolConfig.majors = [];
        currentSchoolConfig.classes = defaultClasses;
        renderClassesList();
        renderMajorsList();
        updateSchoolTypeUI();
        const typeSelect = document.getElementById('schoolTypeSelect');
        if (typeSelect) typeSelect.value = 'smp';
    })
      .catch(err => showToast("❌ Gagal mereset: " + err.message, "error"))
      .finally(() => { if (btn) { btn.disabled = false; btn.innerHTML = '🔄 Reset ke Default'; } });
}

function exportSchoolConfig() {
    const config = { 
        schoolType: currentSchoolConfig.type, 
        classes: currentSchoolConfig.classes,
        majors: currentSchoolConfig.majors, 
        exportDate: new Date().toISOString() 
    };
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
                const updates = {
                    type: config.schoolType,
                    majors: config.majors || [],
                    classes: config.classes || getDefaultClasses(config.schoolType)
                };
                db.ref('school_config').update(updates);
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

// ======================= SENSOR STATUS (tetap pakai listener, tapi dipanggil via event) =======================

let sensorStatusListener = null;

function initSensorStatusListener() {
    if (!currentUser || currentUser.role !== 'admin') {
        const panel = document.getElementById('sensorStatusPanel');
        if (panel) panel.style.display = 'none';
        return;
    }
    
    const panel = document.getElementById('sensorStatusPanel');
    if (panel) panel.style.display = 'block';
    
    if (sensorStatusListener) {
        db.ref('status/esp32/sensors').off('value', sensorStatusListener);
    }
    
    sensorStatusListener = db.ref('status/esp32/sensors').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            renderSensorGrid(data);
            updateSensorHeaderInfo(data);
        } else {
            renderNoSensorData();
        }
    });
}

function renderSensorGrid(data) {
    const container = document.getElementById('sensorGrid');
    if (!container) return;
    if (!data.sensors || !Array.isArray(data.sensors)) {
        container.innerHTML = '<div class="sensor-loading">📡 Menunggu data dari ESP32...</div>';
        return;
    }
    let html = '';
    data.sensors.forEach(sensor => {
        const isOnline = sensor.status === 'online';
        const statusIcon = isOnline ? '✅' : '❌';
        const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
        const statusClass = isOnline ? 'online' : 'offline';
        const templates = sensor.templateCount || 0;
        html += `
            <div class="sensor-card ${statusClass}">
                <div class="sensor-number">#${sensor.id}</div>
                <div class="sensor-status-icon">${statusIcon}</div>
                <div class="sensor-status-text ${statusClass}">${statusText}</div>
                <div class="sensor-templates">📁 ${templates} sidik</div>
                ${sensor.error ? `<div class="sensor-error" style="font-size:10px;color:#f44336;margin-top:4px;">${escapeHtmlStr(sensor.error)}</div>` : ''}
            </div>
        `;
    });
    container.innerHTML = html;
}

function updateSensorHeaderInfo(data) {
    const onlineCount = data.onlineCount || 0;
    const totalTemplates = data.totalTemplates || 0;
    const timestamp = data.timestamp;
    const badge = document.getElementById('sensorOnlineBadge');
    if (badge) {
        badge.textContent = `${onlineCount}/16 Online`;
        if (onlineCount === 16) badge.className = 'badge-success';
        else if (onlineCount >= 12) badge.className = 'badge-warning';
        else badge.className = 'badge-danger';
    }
    const lastUpdateSpan = document.getElementById('sensorLastUpdate');
    if (lastUpdateSpan && timestamp) {
        const date = new Date(timestamp);
        lastUpdateSpan.textContent = `🕐 ${date.toLocaleTimeString('id-ID')}`;
        lastUpdateSpan.className = 'badge-info';
    } else if (lastUpdateSpan) {
        lastUpdateSpan.textContent = 'Menunggu data...';
    }
    const header = document.querySelector('#sensorStatusPanel .sensor-header h4');
    if (header) header.setAttribute('title', `Total ${totalTemplates} sidik jari tersimpan di semua sensor`);
}

function renderNoSensorData() {
    const container = document.getElementById('sensorGrid');
    if (!container) return;
    container.innerHTML = `<div class="sensor-loading">📡 Belum ada data dari ESP32<br><small>Pastikan ESP32 terhubung ke internet dan mengirim data status</small></div>`;
    const badge = document.getElementById('sensorOnlineBadge');
    if (badge) {
        badge.textContent = 'Menunggu data';
        badge.className = 'badge-warning';
    }
}

function refreshSensorStatus() {
    if (typeof showToast === 'function') showToast("📡 Meminta refresh data sensor...", "info");
    if (db) {
        db.ref('commands/esp32/check_sensors').set({
            requestedBy: currentUser?.nama || 'Admin',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            if (typeof showToast === 'function') showToast("✅ Perintah refresh dikirim ke ESP32", "success");
            setTimeout(() => db.ref('commands/esp32/check_sensors').remove(), 5000);
        }).catch(err => {
            console.error("Gagal kirim command:", err);
            if (typeof showToast === 'function') showToast("❌ Gagal mengirim perintah", "error");
        });
    }
    if (sensorStatusListener) {
        db.ref('status/esp32/sensors').once('value').then(snapshot => {
            const data = snapshot.val();
            if (data) { renderSensorGrid(data); updateSensorHeaderInfo(data); }
        }).catch(err => console.warn("Refresh error:", err));
    }
}

function cleanupSensorStatus() {
    if (sensorStatusListener) {
        db.ref('status/esp32/sensors').off('value', sensorStatusListener);
        sensorStatusListener = null;
    }
}

// ======================= CLEANUP =======================

function cleanupSettingsSystem() {
    cleanupSensorStatus();
    settingDataReadyListenerAdded = false;
    settingUiReadyListenerAdded = false;
    console.log("🧹 Settings system cleaned up");
}

// ======================= INISIALISASI =======================

function initAllSettings() {
    console.log("🚀 initAllSettings - Memulai inisialisasi UI settings...");
    initGlobalDelayListeners();
    
    // Setup dropdown hours
    const globalHoursSelect = document.getElementById('globalDelayHoursValue');
    if (globalHoursSelect && globalHoursSelect.options.length <= 1) {
        for (let i = 1; i <= 24; i++) {
            globalHoursSelect.innerHTML += `<option value="${i}">${i} jam</option>`;
        }
    }
    const studentHoursSelect = document.getElementById('delayHoursValue');
    if (studentHoursSelect && studentHoursSelect.options.length <= 1) {
        for (let i = 1; i <= 24; i++) {
            studentHoursSelect.innerHTML += `<option value="${i}">${i} jam</option>`;
        }
    }
    
    // Ambil nilai awal dari Firebase sekali saja untuk UI (tidak pakai listener)
    db.ref('settings/delayOut').once('value').then(snapshot => {
        const delay = snapshot.val();
        setGlobalDelayFormValue(delay || 60);
        const displaySpan = document.getElementById('globalDelayDisplay');
        if (displaySpan) displaySpan.textContent = formatDelayText(delay || 60);
    });
    
    console.log("✅ initAllSettings - Selesai");
}

// Setup event listeners
setupSettingDataReadyListener();
setupSettingUiReadyListener();

// Inisialisasi UI settings (tunggu DOM siap)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initAllSettings, 100));
} else {
    setTimeout(initAllSettings, 100);
}

// ======================= EXPORT KE GLOBAL =======================
window.formatDelayText = formatDelayText;
window.toggleGlobalDelayInput = toggleGlobalDelayInput;
window.updateGlobalDelayFromMinutes = updateGlobalDelayFromMinutes;
window.updateGlobalDelayFromHours = updateGlobalDelayFromHours;
window.saveGlobalDelay = saveGlobalDelay;
window.initGlobalDelayListeners = initGlobalDelayListeners;
window.renderClassesList = renderClassesList;
window.addClass = addClass;
window.removeClass = removeClass;
window.saveClasses = saveClasses;
window.renderMajorsList = renderMajorsList;
window.saveSchoolType = saveSchoolType;
window.addMajor = addMajor;
window.removeMajor = removeMajor;
window.saveMajors = saveMajors;
window.resetAllSettings = resetAllSettings;
window.exportSchoolConfig = exportSchoolConfig;
window.importSchoolConfig = importSchoolConfig;
window.initAllSettings = initAllSettings;
window.cleanupSettingsSystem = cleanupSettingsSystem;
window.initSensorStatusListener = initSensorStatusListener;
window.refreshSensorStatus = refreshSensorStatus;
window.cleanupSensorStatus = cleanupSensorStatus;

console.log("✅ setting.js V3.0 loaded - Event-based (no duplicate listeners)");