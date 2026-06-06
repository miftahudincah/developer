// ai-assistant.js - VERSION 6.0 (FIXED: Compatible with Vercel Backend API)
// Asisten AI SUPER POWERFULL dengan Groq API + Action Executor
// Fitur LENGKAP dengan aksi nyata ke database via API Backend
// ============================================================================

// ======================= KONFIGURASI API =======================
const GROQ_API_KEY = "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";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// Backend API URL (Vercel)
const BACKEND_API_URL = "https://absensi-backend-3we5.vercel.app/api";

// Konfigurasi AI
const AI_CONFIG = {
    temperature: 0.75,
    maxTokens: 2000,
    topP: 0.95,
    contextMemoryMinutes: 30,
    maxContextMessages: 15
};

// State AI
let aiAssistantInitialized = false;
let aiAssistantModalOpen = false;
let conversationHistory = [];
let longTermMemory = {};
let lastActivityTimestamp = null;
let currentAIContext = null;

// Cache data sistem
let systemDataCache = {
    students: [],
    attendance: [],
    usersAuth: [],
    settings: {},
    schoolConfig: {},
    announcements: [],
    lastUpdate: 0
};

// Pending actions untuk konfirmasi
let pendingDeleteConfirmation = null;
let pendingAction = null;

// ======================= UTILITY FUNCTIONS =======================

function getAuthToken() {
    // Ambil token dari localStorage atau dari firebase auth
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        return firebase.auth().currentUser.getIdToken();
    }
    return Promise.resolve(null);
}

async function apiRequest(endpoint, options = {}) {
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
}

function getTimestamp() {
    return new Date().toLocaleTimeString('id-ID');
}

async function updateSystemDataCache() {
    const now = Date.now();
    if (now - systemDataCache.lastUpdate < 30000 && systemDataCache.students.length > 0) {
        return systemDataCache;
    }
    
    try {
        // Ambil data siswa dari API
        const studentsData = await apiRequest('/students');
        systemDataCache.students = studentsData.data || [];
        
        // Ambil data absensi
        const attendanceData = await apiRequest('/attendance');
        systemDataCache.attendance = attendanceData.data || [];
        
        // Ambil data user (hanya jika admin)
        try {
            const usersData = await apiRequest('/users');
            systemDataCache.usersAuth = usersData.data || [];
        } catch(e) {
            systemDataCache.usersAuth = [];
        }
        
        // Ambil data konfigurasi sekolah
        try {
            const configData = await apiRequest('/config');
            systemDataCache.settings = configData.data || {};
            systemDataCache.schoolConfig = {
                type: configData.data?.school_type || 'smp',
                classes: configData.data?.classes || [],
                majors: configData.data?.majors || []
            };
        } catch(e) {}
        
        systemDataCache.lastUpdate = now;
        console.log(`🤖 AI Cache: ${systemDataCache.students.length} siswa, ${systemDataCache.attendance.length} absensi`);
    } catch(error) {
        console.warn('Update cache error:', error);
    }
    
    return systemDataCache;
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

function formatMarkdown(text) {
    if (!text) return '';
    text = String(text);
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/`(.*?)`/g, '<code style="background:rgba(0,0,0,0.2);padding:2px 6px;border-radius:4px;">$1</code>');
    text = text.replace(/\n/g, '<br>');
    text = text.replace(/^[•\-]\s+(.*?)$/gm, '<li>$1</li>');
    if (text.includes('<li>') && !text.includes('<ul>')) {
        text = text.replace(/(<li>.*?<\/li>)/s, '<ul style="margin:8px 0 8px 20px;">$1</ul>');
    }
    text = text.replace(/^(\d+)\.\s+(.*?)$/gm, '<li value="$1">$2</li>');
    return text;
}

function hasAdminAccess() {
    if (!currentUser) return false;
    return ['admin', 'guru', 'developer'].includes(currentUser.role);
}

function canDeleteUser() {
    if (!currentUser) return false;
    return ['admin', 'developer'].includes(currentUser.role);
}

// ======================= INTENT PARSING =======================

function parseProfessionalIntent(command) {
    const lowerCommand = String(command).toLowerCase();
    
    if (lowerCommand.match(/^(hai|halo|hello|hey|selamat|pagi|siang|malam|apa kabar|how are you|hy|hii?|assalamualaikum)/i)) {
        return { intent: 'greeting', confidence: 0.99 };
    }
    
    if (lowerCommand.match(/terima kasih|makasih|thanks|thank you|thx|tq/i)) {
        return { intent: 'thanks', confidence: 0.99 };
    }
    
    if (lowerCommand.match(/siapa kamu|kamu siapa|perkenalan|tell me about yourself|fitur apa|bisa apa aja|keahlian/i)) {
        return { intent: 'introduction', confidence: 0.98 };
    }
    
    if (lowerCommand.match(/bantuan|help|tolong|perintah|fitur|bisa apa|command|guide|panduan|list perintah|daftar perintah/i)) {
        return { intent: 'help', confidence: 0.99 };
    }
    
    // MANAJEMEN SISWA - TAMBAH
    if (lowerCommand.match(/tambah|buat|input|simpan|add/) && lowerCommand.match(/siswa|student/)) {
        const addMatch = command.match(/(?:tambah|buat|input|simpan|add)\s+(?:siswa|data siswa|student)\s+(?:nama|name)?\s*["']?([A-Za-z\s]+)["']?\s*(?:id|ID)?\s*(\d+)\s*(?:kelas|class)?\s*["']?([A-Z0-9\s]+)["']?\s*(?:jurusan|major)?\s*["']?([A-Za-z0-9\s]+)["']?/i);
        if (addMatch && addMatch[1] && addMatch[2] && addMatch[3]) {
            return { intent: 'add_student', nama: addMatch[1].trim(), id: parseInt(addMatch[2]), kelas: addMatch[3].trim().toUpperCase(), jurusan: addMatch[4]?.trim().toUpperCase() || 'UMUM', confidence: 0.95 };
        }
        return { intent: 'add_student', need_data: true };
    }
    
    // MANAJEMEN SISWA - UPDATE
    if (lowerCommand.match(/update|edit|ubah|ganti/) && lowerCommand.match(/siswa/)) {
        const updateMatch = command.match(/(?:update|edit|ubah|ganti)\s+(?:siswa|data siswa)\s+(?:id|ID)?\s*(\d+)\s*(?:delay|kelas|jurusan)?\s*(\d+|[A-Z0-9]+)?/i);
        if (updateMatch && updateMatch[1]) {
            return { intent: 'update_student', id: parseInt(updateMatch[1]), value: updateMatch[2] || null, confidence: 0.93 };
        }
        return { intent: 'update_student', need_data: true };
    }
    
    // MANAJEMEN SISWA - HAPUS
    if (lowerCommand.match(/hapus|delete|remove|padam/) && lowerCommand.match(/siswa/)) {
        const deleteMatch = command.match(/(?:hapus|delete|remove|padam)\s+(?:siswa|data siswa)\s+(?:id|ID)?\s*(\d+)/i);
        if (deleteMatch && deleteMatch[1]) {
            return { intent: 'delete_student', id: parseInt(deleteMatch[1]), confidence: 0.98 };
        }
        return { intent: 'delete_student', need_id: true };
    }
    
    // CARI DATA SISWA
    const nameMatch = command.match(/(?:data|info|detail|cari|lihat|tampilkan|show)\s+(?:siswa|student)?\s*["']?([A-Za-z\s]+)["']?(?:\s|$)/i);
    const idMatch = command.match(/(?:id|ID|fingerprint|fp)\s*[:#]?\s*(\d+)/i);
    
    if (nameMatch && nameMatch[1] && nameMatch[1].length > 2 && !lowerCommand.match(/kelas|jurusan|rekap/)) {
        return { intent: 'query_student', name: nameMatch[1].trim(), confidence: 0.96 };
    }
    if (idMatch) {
        return { intent: 'query_student_by_id', id: idMatch[1], confidence: 0.98 };
    }
    
    // SISWA PER KELAS
    const kelasMatch = command.match(/(?:siswa|student|data)\s+(?:kelas|class)\s+["']?([A-Z0-9\s]+)["']?/i);
    if (kelasMatch) {
        return { intent: 'students_by_class', kelas: kelasMatch[1].trim().toUpperCase(), confidence: 0.94 };
    }
    
    // REKAP ABSENSI SISWA
    if (lowerCommand.match(/rekap|absensi|kehadiran|lihat absen|riwayat/i)) {
        const rekapMatch = command.match(/(?:rekap|absensi|kehadiran|riwayat|lihat absen)\s+(?:siswa)?\s*["']?([A-Za-z\s]+)["']?/i);
        if (rekapMatch && rekapMatch[1] && rekapMatch[1].length > 2) {
            return { intent: 'rekap_student', name: rekapMatch[1].trim(), confidence: 0.94 };
        }
        return { intent: 'general_stats', confidence: 0.96 };
    }
    
    // STATISTIK & METRIK
    if (lowerCommand.match(/statistik|stat|ringkasan|summary|dashboard|gambaran|total|berapa|jumlah/i)) {
        return { intent: 'general_stats', confidence: 0.95 };
    }
    
    // TOP/PERINGKAT SISWA
    if (lowerCommand.match(/terbaik|tertinggi|teratas|juara|ranking|top|paling rajin|paling baik|pintar/i)) {
        const limitMatch = command.match(/(\d+)/);
        const limit = limitMatch ? Math.min(parseInt(limitMatch[1]), 20) : 5;
        return { intent: 'top_students', limit, confidence: 0.94 };
    }
    
    return { intent: 'general_chat', message: command, confidence: 0.65 };
}

// ======================= EKSEKUSI INTENT =======================

async function executeProfessionalIntent(intent) {
    await updateSystemDataCache();
    
    switch(intent.intent) {
        case 'greeting': return getProfessionalGreeting();
        case 'thanks': return getProfessionalThanks();
        case 'introduction': return getProfessionalIntroduction();
        case 'help': return getProfessionalHelp();
        
        case 'add_student': return await addStudentViaAI(intent);
        case 'update_student': return await updateStudentViaAI(intent);
        case 'delete_student': return await deleteStudentViaAI(intent);
        
        case 'query_student': return await queryStudentProfessional(intent.name);
        case 'query_student_by_id': return await queryStudentByIdProfessional(intent.id);
        case 'students_by_class': return await getStudentsByClassProfessional(intent.kelas);
        case 'rekap_student': return await getStudentRekapProfessional(intent.name);
        case 'top_students': return await getTopStudentsProfessional(intent.limit);
        case 'general_stats': return await getGeneralStatsProfessional();
        
        default: return null;
    }
}

// ======================= RESPON PROFESIONAL =======================

function getProfessionalGreeting() {
    const hour = new Date().getHours();
    let greeting = "Selamat";
    if (hour < 12) greeting += " Pagi 🌅";
    else if (hour < 15) greeting += " Siang ☀️";
    else if (hour < 19) greeting += " Sore 🌤️";
    else greeting += " Malam 🌙";
    
    const userName = currentUser?.nama || 'Pengguna';
    let roleText = '';
    switch(currentUser?.role) {
        case 'admin': roleText = 'Administrator'; break;
        case 'guru': roleText = 'Guru'; break;
        case 'developer': roleText = 'Developer'; break;
        default: roleText = 'Siswa';
    }
    
    const schoolName = systemDataCache.settings.schoolName || 'Sekolah';
    
    return `👋 **${greeting}, ${escapeHtml(userName)}!**\n\nSaya adalah **Asisten AI Super Powerfull** sistem absensi **${escapeHtml(schoolName)}**.\n\n` +
           `📋 **Yang bisa saya bantu hari ini:**\n` +
           `• 🔍 **Cari data siswa** - "data siswa Budi" atau "id 123 siapa?"\n` +
           `• 📊 **Lihat rekap absensi** - "rekap Ani" atau "statistik kehadiran"\n` +
           `• ✏️ **Kelola data siswa** - "tambah siswa nama Toni id 7 kelas X jurusan RPL"\n` +
           `• 🏆 **Lihat peringkat** - "siapa siswa terbaik?"\n\n` +
           `💬 Ada yang bisa saya bantu, ${roleText} ${escapeHtml(userName)}?`;
}

function getProfessionalThanks() {
    return "🙏 **Sama-sama!** Senang dapat membantu.\n\nAda yang lain bisa saya bantu? 😊";
}

function getProfessionalIntroduction() {
    return `## 🤖 **Tentang Saya - AI Super Powerfull**\n\n` +
           `Saya adalah **Asisten AI Super Powerfull** untuk Sistem Absensi Berbasis Fingerprint ESP32.\n\n` +
           `**⚡ Kemampuan Utama:**\n` +
           `✅ **Manajemen Data Siswa** - Tambah, edit, hapus, cari data siswa\n` +
           `✅ **Analisis Absensi** - Rekap, statistik, peringkat\n` +
           `✅ **Informasi Sistem** - Data real-time dari database\n\n` +
           `💡 **Ketik "bantuan"** untuk melihat semua perintah yang tersedia!`;
}

function getProfessionalHelp() {
    return `## 📚 **PANDUAN LENGKAP ASISTEN AI**\n\n` +
           `### 🔹 MANAJEMEN SISWA\n` +
           `| Perintah | Contoh |\n` +
           `|----------|--------|\n` +
           `| Tambah siswa | "tambah siswa nama Budi id 5 kelas X jurusan RPL" |\n` +
           `| Edit siswa | "update siswa id 5 delay 90" |\n` +
           `| Hapus siswa | "hapus siswa id 5" |\n` +
           `| Cari siswa | "data siswa Budi" atau "id 5 siapa?" |\n\n` +
           `### 🔹 DATA & STATISTIK\n` +
           `| Perintah | Contoh |\n` +
           `|----------|--------|\n` +
           `| Rekap siswa | "rekap Budi" |\n` +
           `| Statistik umum | "statistik sistem" |\n` +
           `| Siswa per kelas | "siswa kelas X" |\n` +
           `| Peringkat | "top 10 siswa" |\n\n` +
           `✨ **Tips:** Gunakan bahasa natural, AI akan memahami maksud Anda!`;
}

// ======================= CRUD SISWA VIA API =======================

async function addStudentViaAI(data) {
    if (!hasAdminAccess()) {
        return "⛔ **Akses Ditolak!**\n\nFitur tambah siswa hanya untuk **Admin, Guru, dan Developer**.";
    }
    
    if (data.need_data) {
        return "📝 **Format Tambah Siswa:**\n\n`tambah siswa nama [Nama] id [ID] kelas [Kelas] jurusan [Jurusan]`\n\n**Contoh:** `tambah siswa nama Budi id 5 kelas X jurusan RPL`";
    }
    
    const existing = systemDataCache.students.find(s => s.id == data.id);
    if (existing) {
        return `⚠️ **Gagal!** Siswa dengan ID **${data.id}** sudah ada (${existing.nama}).`;
    }
    
    try {
        await apiRequest('/students', {
            method: 'POST',
            body: JSON.stringify({
                id: data.id,
                nama: data.nama,
                kelas: data.kelas,
                jurusan: data.jurusan || 'UMUM',
                delayOut: data.delay || 60
            })
        });
        
        await updateSystemDataCache();
        return `✅ **BERHASIL!** Siswa **${data.nama}** (ID: ${data.id}) berhasil ditambahkan.`;
    } catch (error) {
        return `❌ **Gagal!** ${error.message}`;
    }
}

async function updateStudentViaAI(data) {
    if (!hasAdminAccess()) {
        return "⛔ **Akses Ditolak!**";
    }
    
    if (data.need_data) {
        return "📝 **Format Update:** `update siswa id [ID] delay [menit]`\n\nContoh: `update siswa id 5 delay 90`";
    }
    
    const student = systemDataCache.students.find(s => s.id == data.id);
    if (!student) {
        return `❌ **Siswa dengan ID ${data.id} tidak ditemukan.**`;
    }
    
    try {
        await apiRequest(`/students/${data.id}`, {
            method: 'PUT',
            body: JSON.stringify({ delayOut: parseInt(data.value) })
        });
        
        await updateSystemDataCache();
        return `✅ **BERHASIL!** Delay pulang ${student.nama} diubah menjadi ${data.value} menit.`;
    } catch (error) {
        return `❌ **Gagal!** ${error.message}`;
    }
}

async function deleteStudentViaAI(data) {
    if (!hasAdminAccess()) {
        return "⛔ **Akses Ditolak!**";
    }
    
    if (data.need_id) {
        return "📝 **Format Hapus:** `hapus siswa id [ID]`\n\nContoh: `hapus siswa id 5`\n\n⚠️ **Peringatan:** Tindakan ini tidak dapat dibatalkan!";
    }
    
    const student = systemDataCache.students.find(s => s.id == data.id);
    if (!student) {
        return `❌ **Siswa dengan ID ${data.id} tidak ditemukan.**`;
    }
    
    return `⚠️ **Konfirmasi Hapus**\n\nAnda akan menghapus: **${student.nama}** (ID: ${student.id})\n\n**Ketik "YA HAPUS ${data.id}"** untuk konfirmasi.\n_(Ketik "batal" untuk membatalkan)_`;
}

// ======================= QUERY FUNCTIONS =======================

async function queryStudentProfessional(name) {
    await updateSystemDataCache();
    const students = systemDataCache.students.filter(s => 
        s.nama && s.nama.toLowerCase().includes(String(name).toLowerCase())
    );
    
    if (students.length === 0) {
        return `📭 **Siswa "${escapeHtml(name)}" tidak ditemukan.**\n\n💡 Coba gunakan ID: "id 123 siapa?"`;
    }
    
    if (students.length === 1) {
        const s = students[0];
        const hasAccount = systemDataCache.usersAuth.some(u => u.fpId == s.id);
        return `## 👤 **DETAIL SISWA**\n\n` +
               `**📌 Nama:** ${escapeHtml(s.nama)}\n` +
               `**🆔 ID:** ${s.id}\n` +
               `**📚 Kelas:** ${s.kelas || '-'}\n` +
               `**🎓 Jurusan:** ${s.jurusan || '-'}\n` +
               `**⏰ Delay Pulang:** ${s.delayOut || 60} menit\n` +
               `**🔐 Akun:** ${hasAccount ? '✅ Sudah memiliki akun' : '⏳ Belum memiliki akun'}\n\n` +
               `💡 **Perintah:** "rekap ${s.nama}" - lihat detail absensi`;
    }
    
    let result = `🔍 **${students.length} Siswa Ditemukan:**\n\n`;
    students.slice(0, 10).forEach((s, idx) => {
        result += `${idx+1}. **${escapeHtml(s.nama)}** (ID: ${s.id}) - Kelas ${s.kelas || '-'}\n`;
    });
    return result;
}

async function queryStudentByIdProfessional(id) {
    await updateSystemDataCache();
    const student = systemDataCache.students.find(s => s.id == id);
    if (!student) {
        return `📭 **Siswa dengan ID ${id} tidak ditemukan.**`;
    }
    const hasAccount = systemDataCache.usersAuth.some(u => u.fpId == student.id);
    return `## 👤 **DETAIL SISWA**\n\n` +
           `**📌 Nama:** ${escapeHtml(student.nama)}\n` +
           `**🆔 ID:** ${student.id}\n` +
           `**📚 Kelas:** ${student.kelas || '-'}\n` +
           `**🎓 Jurusan:** ${student.jurusan || '-'}\n` +
           `**⏰ Delay Pulang:** ${student.delayOut || 60} menit\n` +
           `**🔐 Akun:** ${hasAccount ? '✅ Sudah memiliki akun' : '⏳ Belum memiliki akun'}`;
}

async function getStudentsByClassProfessional(kelas) {
    await updateSystemDataCache();
    const students = systemDataCache.students.filter(s => s.kelas === kelas);
    
    if (students.length === 0) {
        return `📭 **Tidak ada siswa di kelas ${kelas}.**`;
    }
    
    let result = `## 📚 **SISWA KELAS ${kelas}**\n\n`;
    students.forEach((s, idx) => {
        result += `${idx+1}. ${escapeHtml(s.nama)} (ID: ${s.id})\n`;
    });
    return result;
}

async function getStudentRekapProfessional(name) {
    await updateSystemDataCache();
    
    const student = systemDataCache.students.find(s => 
        s.nama && s.nama.toLowerCase().includes(String(name).toLowerCase())
    );
    
    if (!student) {
        return `📭 **Siswa "${escapeHtml(name)}" tidak ditemukan.**`;
    }
    
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    
    const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
    let schoolDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(thisYear, thisMonth, d);
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) schoolDays++;
    }
    
    const attendanceRecords = systemDataCache.attendance.filter(a => 
        a.studentId == student.id && 
        a.date && new Date(a.date).getMonth() === thisMonth
    );
    
    const hadir = attendanceRecords.filter(r => r.status === 'Hadir' || r.status === 'Pulang').length;
    const persentase = schoolDays > 0 ? ((hadir / schoolDays) * 100).toFixed(1) : 0;
    
    let grade = '';
    if (persentase >= 90) grade = '🏆 Sangat Baik';
    else if (persentase >= 75) grade = '👍 Baik';
    else if (persentase >= 60) grade = '📊 Cukup';
    else grade = '⚠️ Perlu Perhatian';
    
    return `## 📊 **REKAP ABSENSI ${escapeHtml(student.nama)}**\n\n` +
           `📅 **Periode:** ${now.toLocaleString('id-ID', { month: 'long' })} ${thisYear}\n` +
           `✅ **Hadir:** ${hadir} dari ${schoolDays} hari (${persentase}%)\n` +
           `⭐ **Status:** ${grade}\n\n` +
           `💡 ${persentase >= 75 ? 'Pertahankan prestasi Anda!' : 'Tingkatkan kehadiran Anda!'}`;
}

async function getTopStudentsProfessional(limit = 5) {
    await updateSystemDataCache();
    
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    
    const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
    let schoolDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(thisYear, thisMonth, d);
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) schoolDays++;
    }
    
    const monthAttendance = systemDataCache.attendance.filter(a => {
        if (!a.date) return false;
        const d = new Date(a.date);
        return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    });
    
    const studentStats = systemDataCache.students.map(student => {
        const records = monthAttendance.filter(a => a.studentId == student.id);
        const hadir = records.filter(r => r.status === 'Hadir' || r.status === 'Pulang').length;
        const persen = schoolDays > 0 ? (hadir / schoolDays * 100).toFixed(1) : 0;
        return { ...student, hadir, persen };
    });
    
    const topStudents = studentStats.sort((a, b) => b.hadir - a.hadir).slice(0, limit);
    
    let result = `## 🏆 **TOP ${limit} SISWA TERBAIK**\n*${now.toLocaleString('id-ID', { month: 'long' })} ${thisYear}*\n\n`;
    topStudents.forEach((s, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '📌';
        result += `${medal} **${escapeHtml(s.nama)}** (${s.kelas || '-'}) - ${s.hadir}/${schoolDays} hari (${s.persen}%)\n`;
    });
    return result;
}

async function getGeneralStatsProfessional() {
    await updateSystemDataCache();
    
    const totalSiswa = systemDataCache.students.length;
    const totalAbsensi = systemDataCache.attendance.length;
    
    const today = new Date().toISOString().split('T')[0];
    const todayAbsensi = systemDataCache.attendance.filter(a => a.date === today);
    const hadirToday = todayAbsensi.filter(a => a.status === 'Hadir' || a.status === 'Pulang').length;
    
    const schoolName = systemDataCache.settings.schoolName || 'Sistem Absensi';
    
    return `## 📊 **STATISTIK SISTEM**\n\n` +
           `**🏫 Nama Sekolah:** ${escapeHtml(schoolName)}\n\n` +
           `### 👥 **Data Siswa**\n` +
           `• Total siswa: **${totalSiswa}**\n\n` +
           `### 📋 **Absensi Hari Ini (${today})**\n` +
           `• ✅ Sudah masuk: **${hadirToday}** siswa\n` +
           `• 📊 Total transaksi: ${todayAbsensi.length}\n\n` +
           `💡 Total catatan absensi di database: **${totalAbsensi}** transaksi.`;
}

// ======================= CALL GROQ API =======================

async function callGroqAPI(userMessage) {
    const systemPrompt = `Anda adalah Asisten AI Profesional untuk Sistem Absensi Sekolah.

=== DATA SISTEM REAL-TIME ===
Total siswa: ${systemDataCache.students.length}
Total absensi: ${systemDataCache.attendance.length}
Role pengguna: ${currentUser?.role || 'unknown'}
Waktu: ${new Date().toLocaleString('id-ID')}
Nama Sekolah: ${systemDataCache.settings.schoolName || 'Sistem Absensi'}

=== RESPONSIBILITAS ===
1. Berikan jawaban AKURAT, INFORMATIF, dan PROFESIONAL
2. Gunakan format markdown untuk data
3. Jika tidak tahu, akui dengan jujur
4. Jangan pernah memberikan informasi palsu

=== GAYA BAHASA ===
- Bahasa Indonesia formal namun ramah
- Gunakan emoji secukupnya (✅, 📊, 👤, dll)`;

    const messages = [
        { role: "system", content: String(systemPrompt) },
        { role: "user", content: String(userMessage) }
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: messages,
                temperature: AI_CONFIG.temperature,
                max_tokens: AI_CONFIG.maxTokens
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        const aiResponse = result.choices[0]?.message?.content || "Maaf, saya tidak dapat memproses permintaan Anda saat ini.";
        
        conversationHistory.push(
            { role: "user", content: userMessage },
            { role: "assistant", content: String(aiResponse) }
        );
        
        if (conversationHistory.length > AI_CONFIG.maxContextMessages * 2) {
            conversationHistory = conversationHistory.slice(-AI_CONFIG.maxContextMessages * 2);
        }
        
        lastActivityTimestamp = Date.now();
        return aiResponse;

    } catch (error) {
        clearTimeout(timeoutId);
        console.error("Groq API error:", error);
        
        if (error.name === 'AbortError') {
            return "⏰ **Request timeout**\n\nPermintaan terlalu lama. Silakan coba lagi.";
        }
        
        return generateFallbackProfessional(userMessage);
    }
}

function generateFallbackProfessional(message) {
    const lowerMsg = String(message).toLowerCase();
    
    if (lowerMsg.match(/halo|hai|hello|hy|hii?/)) return getProfessionalGreeting();
    if (lowerMsg.match(/terima kasih|makasih|thanks/)) return getProfessionalThanks();
    if (lowerMsg.match(/siapa kamu|kamu siapa/)) return getProfessionalIntroduction();
    
    return `🤔 **Maaf, saya belum bisa memproses perintah itu dengan baik.**

📋 **Perintah yang saya pahami:**
• 🔍 **Cari data** - "data siswa Budi", "id 5 siapa?"
• 📊 **Rekap** - "rekap absensi Ani", "statistik"
• ✏️ **Kelola** - "tambah siswa ...", "hapus siswa id 5"
• 🏆 **Peringkat** - "siswa terbaik", "top 10"

💬 **Ketik "bantuan"** untuk panduan lengkap.`;
}

async function processAIMessage(message) {
    const messageStr = String(message || '');
    await updateSystemDataCache();
    
    const intent = parseProfessionalIntent(messageStr);
    console.log(`🤖 Intent: ${intent.intent} (confidence: ${intent.confidence})`);
    
    if (intent.confidence >= 0.8) {
        const result = await executeProfessionalIntent(intent);
        if (result) return result;
    }
    
    if (intent.intent === 'delete_student' && intent.id) {
        const student = systemDataCache.students.find(s => s.id == intent.id);
        if (student) {
            pendingDeleteConfirmation = { id: student.id, nama: student.nama };
            return await deleteStudentViaAI(intent);
        }
    }
    
    // Handle delete confirmation
    if (pendingDeleteConfirmation) {
        const confirmPattern = new RegExp(`YA HAPUS ${pendingDeleteConfirmation.id}`, 'i');
        if (confirmPattern.test(messageStr)) {
            try {
                await apiRequest(`/students/${pendingDeleteConfirmation.id}`, { method: 'DELETE' });
                await updateSystemDataCache();
                const nama = pendingDeleteConfirmation.nama;
                pendingDeleteConfirmation = null;
                return `✅ **BERHASIL DIHAPUS!**\n\nSiswa **${nama}** (ID: ${pendingDeleteConfirmation?.id}) telah dihapus dari database.`;
            } catch (error) {
                pendingDeleteConfirmation = null;
                return `❌ **Gagal Hapus!** ${error.message}`;
            }
        }
        if (String(messageStr).toLowerCase().includes('batal')) {
            pendingDeleteConfirmation = null;
            return `✅ **Penghapusan dibatalkan.** Data siswa tetap aman.`;
        }
        return null;
    }
    
    return await callGroqAPI(messageStr);
}

// ======================= UI KOMPONEN =======================

function addAIAssistantButton() {
    if (document.getElementById('aiAssistantBtn')) return;
    
    const floatingBtn = document.createElement('button');
    floatingBtn.id = 'aiAssistantBtn';
    floatingBtn.innerHTML = '🤖';
    floatingBtn.title = 'AI Assistant Super Powerfull';
    floatingBtn.onclick = () => openAIAssistantModal();
    floatingBtn.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 20px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #00bcd4, #2196f3);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        z-index: 998;
        border: none;
        font-size: 28px;
        transition: all 0.2s;
    `;
    
    floatingBtn.addEventListener('mouseenter', () => {
        floatingBtn.style.transform = 'scale(1.1)';
        floatingBtn.style.boxShadow = '0 6px 20px rgba(0,188,212,0.4)';
    });
    floatingBtn.addEventListener('mouseleave', () => {
        floatingBtn.style.transform = 'scale(1)';
        floatingBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
    });
    
    document.body.appendChild(floatingBtn);
}

function openAIAssistantModal() {
    if (aiAssistantModalOpen) return;
    
    let modal = document.getElementById('modal-ai-assistant');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="modal-ai-assistant" class="modal-overlay">
                <div class="modal-box" style="max-width: 650px; width: 90%; height: 85vh; display: flex; flex-direction: column; padding: 0;">
                    <div class="modal-title" style="padding: 15px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                        <span>🤖 <strong>AI Assistant Super Powerfull</strong> <small style="font-size: 11px; color: #00bcd4;">Powered by Groq Llama 3.3 70B</small></span>
                        <span onclick="closeAIAssistantModal()" style="cursor: pointer; font-size: 24px;">✖</span>
                    </div>
                    <div id="aiChatMessages" style="flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 12px;">
                        <div class="ai-message ai-bot">
                            <div class="ai-avatar" style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #00bcd4, #2196f3); display: flex; align-items: center; justify-content: center; font-size: 20px;">🤖</div>
                            <div class="ai-bubble" style="background: var(--bg-hover); padding: 10px 15px; border-radius: 18px; max-width: 80%; line-height: 1.5;">
                                ${formatMarkdown(getProfessionalGreeting())}
                            </div>
                        </div>
                    </div>
                    <div style="padding: 15px; border-top: 1px solid var(--border); display: flex; gap: 10px;">
                        <input type="text" id="aiChatInput" placeholder="Tanyakan sesuatu... misal: 'data siswa Budi' atau 'statistik sistem'" 
                               style="flex: 1; padding: 12px; border-radius: 30px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary);">
                        <button id="aiSendBtn" style="padding: 12px 20px; border-radius: 30px; background: linear-gradient(135deg, #00bcd4, #2196f3); border: none; color: white; cursor: pointer;">📤 Kirim</button>
                    </div>
                </div>
            </div>
        `);
        modal = document.getElementById('modal-ai-assistant');
    }
    
    modal.classList.add('open');
    aiAssistantModalOpen = true;
    
    const input = document.getElementById('aiChatInput');
    const sendBtn = document.getElementById('aiSendBtn');
    const messagesContainer = document.getElementById('aiChatMessages');
    
    const sendMessage = async () => {
        const message = input.value.trim();
        if (!message) return;
        
        const userMsgDiv = document.createElement('div');
        userMsgDiv.className = 'ai-message ai-user';
        userMsgDiv.innerHTML = `
            <div class="ai-avatar" style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 20px;">👤</div>
            <div class="ai-bubble" style="background: var(--primary); padding: 10px 15px; border-radius: 18px; max-width: 80%; line-height: 1.5;">${escapeHtml(message)}</div>
        `;
        messagesContainer.appendChild(userMsgDiv);
        
        input.value = '';
        input.disabled = true;
        sendBtn.disabled = true;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'aiTypingIndicator';
        loadingDiv.className = 'ai-message ai-bot';
        loadingDiv.innerHTML = `
            <div class="ai-avatar" style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #00bcd4, #2196f3); display: flex; align-items: center; justify-content: center; font-size: 20px;">🤖</div>
            <div class="ai-bubble" style="background: var(--bg-hover); padding: 12px 18px; border-radius: 18px;">
                <span class="typing-dot">●</span><span class="typing-dot">●</span><span class="typing-dot">●</span>
            </div>
        `;
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        try {
            const response = await processAIMessage(message);
            document.getElementById('aiTypingIndicator')?.remove();
            
            const botMsgDiv = document.createElement('div');
            botMsgDiv.className = 'ai-message ai-bot';
            botMsgDiv.innerHTML = `
                <div class="ai-avatar" style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #00bcd4, #2196f3); display: flex; align-items: center; justify-content: center; font-size: 20px;">🤖</div>
                <div class="ai-bubble" style="background: var(--bg-hover); padding: 10px 15px; border-radius: 18px; max-width: 80%; line-height: 1.5;">${formatMarkdown(response)}</div>
            `;
            messagesContainer.appendChild(botMsgDiv);
        } catch (error) {
            document.getElementById('aiTypingIndicator')?.remove();
            const errorDiv = document.createElement('div');
            errorDiv.className = 'ai-message ai-bot';
            errorDiv.innerHTML = `
                <div class="ai-avatar" style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #00bcd4, #2196f3); display: flex; align-items: center; justify-content: center; font-size: 20px;">🤖</div>
                <div class="ai-bubble" style="background: rgba(244, 67, 54, 0.2); padding: 10px 15px; border-radius: 18px; max-width: 80%; line-height: 1.5; color: #f44336;">
                    ❌ Maaf, terjadi kesalahan. Silakan coba lagi nanti.
                </div>
            `;
            messagesContainer.appendChild(errorDiv);
        } finally {
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    };
    
    sendBtn.onclick = sendMessage;
    input.onkeypress = (e) => {
        if (e.key === 'Enter') sendMessage();
    };
    
    input.focus();
}

function closeAIAssistantModal() {
    const modal = document.getElementById('modal-ai-assistant');
    if (modal) {
        modal.classList.remove('open');
        aiAssistantModalOpen = false;
    }
}

// ======================= INISIALISASI =======================

function initAIAssistant() {
    if (aiAssistantInitialized) return;
    
    if (!currentUser || !hasAdminAccess()) {
        console.log("🔒 AI Assistant: Akses ditolak untuk role:", currentUser?.role);
        return;
    }
    
    aiAssistantInitialized = true;
    console.log("🤖 AI Assistant v6.0 initialized - Compatible with Vercel Backend API!");
    
    addAIAssistantButton();
    setInterval(() => updateSystemDataCache(), 30000);
    setInterval(() => {
        if (aiAssistantModalOpen) updateSystemDataCache();
    }, 15000);
}

window.addEventListener('uiReady', (e) => {
    if (e.detail?.currentUser) setTimeout(() => initAIAssistant(), 500);
});

window.addEventListener('dataReady', () => {
    if (currentUser && hasAdminAccess() && !aiAssistantInitialized) initAIAssistant();
});

window.initAIAssistant = initAIAssistant;
window.openAIAssistantModal = openAIAssistantModal;
window.closeAIAssistantModal = closeAIAssistantModal;

console.log("✅ ai-assistant.js V6.0 loaded - Compatible with Vercel Backend API!");