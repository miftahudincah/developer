/**
 * UI.JS - Sistem Absensi (Firebase Sync)
 * File ini menangani seluruh interaksi visual, manajemen modal, 
 * render tabel, dan logika tampilan berbasis role.
 */

// ==========================================
// 1. INISIALISASI & CORE UI
// ==========================================

function initApp() {
    console.log("Initializing UI components...");
    
    // 1. Proteksi Halaman Berdasarkan Auth
    if (!currentUser) {
        document.getElementById('auth-section').style.display = 'flex';
        document.getElementById('dashboard-section').style.display = 'none';
        return;
    }

    // 2. Tampilkan Dashboard
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';

    // 3. Update Identitas Header
    const userDisplay = document.getElementById('userProfileDisplay');
    const roleDisplay = document.getElementById('userRoleDisplay');
    const headerAvatar = document.getElementById('headerAvatar');

    if (userDisplay) userDisplay.textContent = currentUser.nama || "User";
    if (roleDisplay) {
        roleDisplay.textContent = currentUser.role.toUpperCase();
        roleDisplay.className = `role-badge role-${currentUser.role}`;
    }

    // 4. Update Foto Profil
    const photo = currentUser.photoUrl || "https://ui-avatars.com/api/?name=" + (currentUser.nama || "User");
    if (headerAvatar) headerAvatar.src = photo;
    const profileImg = document.getElementById('profileImg');
    if (profileImg) profileImg.src = photo;

    // 5. Jalankan Fitur UI
    applyRolePermissions();
    populateFilters();
    startClock();
    
    // Load config nama sekolah
    if(typeof initSystemConfig === 'function') initSystemConfig();
    
    // 6. Sinkronisasi Awal Tabel
    refreshAllTables();

    // Default Tab
    switchTab('attendance');
}

/**
 * Mengatur visibilitas elemen berdasarkan Role (Admin, Guru, Siswa)
 */
function applyRolePermissions() {
    const role = currentUser.role;
    console.log("Applying permissions for role:", role);

    // Elemen khusus Admin
    document.querySelectorAll('.role-admin').forEach(el => {
        el.style.display = (role === 'admin') ? '' : 'none';
    });

    // Elemen khusus Guru dan Admin
    document.querySelectorAll('.role-guru').forEach(el => {
        el.style.display = (role === 'guru' || role === 'admin') ? '' : 'none';
    });

    // Jika Siswa, batasi beberapa navigasi tab jika perlu
    const studentTabs = document.querySelectorAll('.nav-tabs .tab-btn');
    studentTabs.forEach(tab => {
        // Logika tambahan jika ada tab yang benar-benar dilarang diklik
    });
}

function startClock() {
    const clockEl = document.getElementById('clock');
    if (!clockEl) return;
    
    setInterval(() => {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }, 1000);
}

// ==========================================
// 2. NAVIGASI & TAB
// ==========================================

function switchTab(tabId) {
    console.log("Switching to tab:", tabId);
    
    // Update Button Active
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)) {
            btn.classList.add('active');
        }
    });

    // Update Content Active
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    // Trigger render khusus saat pindah tab
    if (tabId === 'attendance') renderTable();
    if (tabId === 'students') renderStudentsTable();
    if (tabId === 'users') {
        renderUsersTable();
        renderCodesTable();
        updateStudentDropdownForCode();
    }
}

// ==========================================
// 3. AUTH UI & REGISTER (FIXED)
// ==========================================

/**
 * Memperbaiki masalah textbox nama yang tidak muncul saat pilih Guru
 */
function toggleRegisterInput() {
    const roleRadios = document.getElementsByName('regRoleType');
    let selectedRole = 'siswa';

    for (const radio of roleRadios) {
        if (radio.checked) {
            selectedRole = radio.value;
            break;
        }
    }

    console.log("Register Mode Changed to:", selectedRole);

    const groupID = document.getElementById('group-reg-id');
    const groupNama = document.getElementById('group-reg-nama');
    const groupSubject = document.getElementById('group-reg-subject');
    const codeInput = document.getElementById('regCode');

    if (selectedRole === 'siswa') {
        // MODE SISWA
        if (groupID) groupID.style.display = 'block';
        if (groupNama) groupNama.style.display = 'none';
        if (groupSubject) groupSubject.style.display = 'none';
        
        // Reset inputs
        document.getElementById('regNama').value = "";
        document.getElementById('regSubject').value = "";
        
        if (codeInput) codeInput.placeholder = "KODE DARI GURU (SISWA)";
    } else {
        // MODE GURU
        if (groupID) groupID.style.display = 'none';
        if (groupNama) groupNama.style.display = 'block'; // Pastikan tampil
        if (groupSubject) groupSubject.style.display = 'block'; // Pastikan tampil
        
        // Reset inputs
        document.getElementById('regGeneratedId').value = "";
        
        if (codeInput) codeInput.placeholder = "KODE KHUSUS PENDAFTARAN GURU";
    }
}

function toggleAuth(type) {
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');

    if (type === 'register') {
        loginCard.style.display = 'none';
        registerCard.style.display = 'block';
    } else {
        loginCard.style.display = 'block';
        registerCard.style.display = 'none';
    }
}

function togglePassword(id, el) {
    const input = document.getElementById(id);
    const svg = el.querySelector('svg');
    
    if (input.type === "password") {
        input.type = "text";
        el.style.opacity = "1";
        el.style.color = "var(--primary)";
    } else {
        input.type = "password";
        el.style.opacity = "0.5";
        el.style.color = "white";
    }
}

// ==========================================
// 4. MANAJEMEN MODAL
// ==========================================

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('open');
        // Effect backdrop
        modal.style.backdropFilter = "blur(5px)";
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('open');
    }
}

function openProfileModal() {
    if (!currentUser) return;

    openModal('modal-profile');

    // Load Data ke Input Profil
    const fields = {
        'profileNameInput': currentUser.nama || "",
        'profileKelas': currentUser.kelas || "",
        'profileJurusan': currentUser.jurusan || "",
        'profileSubject': currentUser.subject || ""
    };

    for (let id in fields) {
        const el = document.getElementById(id);
        if (el) el.value = fields[id];
    }

    const emailEl = document.getElementById('profileEmail');
    if (emailEl) emailEl.textContent = currentUser.email;

    const imgEl = document.getElementById('profileImg');
    if (imgEl) imgEl.src = currentUser.photoUrl || "https://ui-avatars.com/api/?name=" + currentUser.nama;

    // Proteksi Field Berdasarkan Role
    const isSiswa = currentUser.role === 'siswa';
    const profileInputs = ['profileNameInput', 'profileKelas', 'profileJurusan'];
    
    profileInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.readOnly = isSiswa;
            input.style.background = isSiswa ? "rgba(255,255,255,0.05)" : "#2c2c2c";
            input.style.cursor = isSiswa ? "not-allowed" : "text";
        }
    });

    // Toggle Field Mata Pelajaran (Hanya Guru/Admin)
    const subjectGroup = document.getElementById('group-subject');
    if (subjectGroup) {
        subjectGroup.style.display = isSiswa ? 'none' : 'block';
    }

    // Toggle Tombol Simpan
    const saveBtn = document.querySelector('#modal-profile .btn-save');
    if (saveBtn) {
        saveBtn.style.display = isSiswa ? 'none' : 'block';
    }
}

// ==========================================
// 5. TOAST NOTIFICATION
// ==========================================

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    
    // Styling berdasarkan tipe
    toast.style.borderLeft = "5px solid";
    if (type === 'success') {
        toast.style.borderLeftColor = "var(--success)";
        toast.style.backgroundColor = "#1e2a1e";
    } else if (type === 'error') {
        toast.style.borderLeftColor = "var(--danger)";
        toast.style.backgroundColor = "#2a1e1e";
    } else {
        toast.style.borderLeftColor = "var(--primary)";
        toast.style.backgroundColor = "#1e222a";
    }

    toast.className = "toast show";
    
    // Auto hide
    setTimeout(() => {
        toast.className = toast.className.replace("show", "");
    }, 4000);
}

// ==========================================
// 6. RENDER DATA & TABEL (LOGIC UI)
// ==========================================

function refreshAllTables() {
    renderTable();
    renderStudentsTable();
    renderUsersTable();
    renderCodesTable();
}

function populateFilters() {
    if (!dbData || !dbData.users) return;

    // 1. Ambil data unik dari database fingerprint
    const classes = [...new Set(Object.values(dbData.users).map(s => s.kelas))].filter(Boolean).sort();
    const majors = [...new Set(Object.values(dbData.users).map(s => s.jurusan))].filter(Boolean).sort();

    // 2. Filter Tab Absensi
    const fKelas = document.getElementById('filterKelas');
    const fJurusan = document.getElementById('filterJurusan');
    
    if (fKelas) fKelas.innerHTML = '<option value="all">Semua</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
    if (fJurusan) fJurusan.innerHTML = '<option value="all">Semua</option>' + majors.map(j => `<option value="${j}">${j}</option>`).join('');

    // 3. Filter Tab Data Siswa
    const fsKelas = document.getElementById('filterStudentKelas');
    const fsJurusan = document.getElementById('filterStudentJurusan');

    if (fsKelas) fsKelas.innerHTML = '<option value="all">Semua Kelas</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
    if (fsJurusan) fsJurusan.innerHTML = '<option value="all">Semua Jurusan</option>' + majors.map(j => `<option value="${j}">${j}</option>`).join('');
    
    console.log("Filters populated successfully.");
}

/**
 * Menampilkan pilihan siswa saat Admin/Guru ingin generate kode pendaftaran
 */
function updateStudentDropdownForCode() {
    const select = document.getElementById('selectStudentForCode');
    if (!select || !dbData || !dbData.users) return;

    const students = Object.keys(dbData.users).map(id => ({
        id: id,
        nama: dbData.users[id].nama
    })).sort((a, b) => a.nama.localeCompare(b.nama));

    let html = '<option value="">-- Pilih Siswa --</option>';
    students.forEach(s => {
        html += `<option value="${s.id}">${s.nama} (ID: ${s.id})</option>`;
    });
    select.innerHTML = html;
}

// ==========================================
// 7. PROFILE UPDATE LOGIC (UI INTERACTION)
// ==========================================

async function handleUpdateProfileInfo() {
    if (currentUser.role === 'siswa') {
        showToast("Siswa tidak diizinkan mengubah profil secara manual", "error");
        return;
    }

    const btn = document.querySelector('#modal-profile .btn-save');
    const originalText = btn.innerText;

    const newNama = document.getElementById('profileNameInput').value.trim();
    const newKelas = document.getElementById('profileKelas').value.trim().toUpperCase();
    const newJurusan = document.getElementById('profileJurusan').value.trim();
    const newSubject = document.getElementById('profileSubject').value.trim();

    if (!newNama) return showToast("Nama tidak boleh kosong!", "error");

    btn.innerText = "Memproses...";
    btn.disabled = true;

    try {
        const updateData = {
            nama: newNama,
            kelas: newKelas,
            jurusan: newJurusan,
            subject: newSubject
        };

        await db.ref(`users_auth/${currentUser.uid}`).update(updateData);
        
        // Sinkronisasi ke Local Data
        currentUser.nama = newNama;
        currentUser.kelas = newKelas;
        currentUser.jurusan = newJurusan;
        currentUser.subject = newSubject;

        // Update UI secara instan
        document.getElementById('userProfileDisplay').textContent = newNama;
        
        showToast("Profil berhasil diperbarui!");
        closeModal('modal-profile');
        
        // Refresh filter jika ada perubahan kelas/jurusan
        populateFilters();
        
    } catch (err) {
        showToast("Error: " + err.message, "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

/**
 * Handle Upload Foto Profil ke ImgBB melalui Proxy wsrv.nl
 */
async function uploadProfilePhoto(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
        showToast("Ukuran file terlalu besar (Maks 2MB)", "error");
        input.value = "";
        return;
    }

    const imgEl = document.getElementById('profileImg');
    const originalSrc = imgEl.src;
    
    imgEl.style.opacity = "0.3";
    showToast("Sedang mengunggah...", "neutral");

    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
            method: "POST",
            body: formData
        });
        const result = await response.json();

        if (result.success) {
            const rawUrl = result.data.image.url;
            // Gunakan Proxy agar tidak terkena hotlink protection & resize otomatis
            const optimizedUrl = `https://wsrv.nl/?url=${encodeURIComponent(rawUrl)}&w=200&h=200&fit=cover`;

            await db.ref(`users_auth/${currentUser.uid}`).update({ photoUrl: optimizedUrl });
            
            currentUser.photoUrl = optimizedUrl;
            imgEl.src = optimizedUrl;
            document.getElementById('headerAvatar').src = optimizedUrl;
            
            showToast("Foto profil diperbarui!");
        } else {
            throw new Error("Upload gagal");
        }
    } catch (err) {
        showToast("Gagal mengunggah foto", "error");
        imgEl.src = originalSrc;
    } finally {
        imgEl.style.opacity = "1";
        input.value = "";
    }
}

// ==========================================
// 8. DATA EXPORT (EXCEL)
// ==========================================

function exportToExcel() {
    showToast("Menyiapkan data Excel...", "neutral");
    
    setTimeout(() => {
        const table = document.querySelector("#tab-attendance table");
        if (!table) return;

        let csv = [];
        const rows = table.querySelectorAll("tr");
        
        for (let i = 0; i < rows.length; i++) {
            const row = [], cols = rows[i].querySelectorAll("td, th");
            for (let j = 0; j < cols.length; j++) {
                // Bersihkan text dari koma agar CSV tidak rusak
                let data = cols[j].innerText.replace(/,/g, ".");
                row.push(data);
            }
            csv.push(row.join(","));
        }

        const csvContent = "data:text/csv;charset=utf-8," + csv.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        const date = new Date().toISOString().split('T')[0];
        
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Laporan_Absensi_${date}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("Laporan berhasil diunduh!");
    }, 1000);
}

// ==========================================
// 9. SYSTEM CONFIGURATION (ADMIN ONLY)
// ==========================================

function initSystemConfig() {
    const schoolNameEl = document.getElementById('schoolNameDisplay');
    const inputSchool = document.getElementById('inputSchoolName');

    db.ref('system_config/schoolName').on('value', (snapshot) => {
        const name = snapshot.val() || "Sistem Absensi";
        if (schoolNameEl) schoolNameEl.textContent = name;
        if (inputSchool) inputSchool.value = snapshot.val() || "";
    });
}

/**
 * Reset Seluruh Data Firebase (Sangat Berbahaya)
 */
async function resetSystemData() {
    if (currentUser.role !== 'admin') return;

    const confirm1 = confirm("⚠️ PERINGATAN: Anda akan menghapus SELURUH DATA absensi dan siswa!");
    if (!confirm1) return;

    const pass = prompt("Masukkan password Admin untuk konfirmasi:");
    if (pass !== "CONFIRM-RESET") {
        alert("Kode salah. Reset dibatalkan.");
        return;
    }

    showToast("Sedang menghapus data...", "error");

    try {
        await db.ref('attendance').remove();
        await db.ref('users').remove();
        await db.ref('registration_codes').remove();
        
        showToast("Database berhasil dibersihkan.");
        location.reload();
    } catch (err) {
        showToast("Gagal reset data: " + err.message, "error");
    }
}

// ==========================================
// 10. HELPER INTERACTION
// ==========================================

/**
 * Fungsi untuk beralih mode generate kode (Siswa vs Guru)
 */
function toggleGenerateInput() {
    const radios = document.getElementsByName('genTarget');
    let target = 'siswa';
    
    for (const r of radios) {
        if (r.checked) target = r.value;
    }

    const selectSiswa = document.getElementById('group-select-siswa');
    const desc = document.getElementById('gen-desc');

    if (target === 'siswa') {
        selectSiswa.style.display = 'block';
        desc.textContent = "Kode akan dikunci khusus untuk ID Siswa yang dipilih.";
    } else {
        selectSiswa.style.display = 'none';
        desc.textContent = "Kode bebas digunakan oleh pendaftar Guru manapun.";
    }
}

// Auto-run init saat file dimuat
console.log("UI Script Loaded Successfully - Version 2.1.0");