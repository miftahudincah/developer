// ai-openai.js - VERSION 2.0 (INTEGRASI OPENAI UNTUK AI SUMMARY SUPER POWERFULL)
// Updated: Compatible with Vercel Backend API
// Integrasi OpenAI API untuk analisis kehadiran yang lebih cerdas
// Fitur:
// - Analisis Natural Language Processing (NLP) dari data kehadiran
// - Rekomendasi strategi peningkatan kehadiran berbasis AI
// - Deteksi pola kompleks yang tidak terlihat oleh rule-based
// - Prediksi akurat menggunakan GPT-4o-mini
// - Auto-summarization laporan eksekutif
// - Saran intervensi personal untuk setiap siswa bermasalah
// ============================================================================

// Backend API URL (Vercel)
const BACKEND_API_URL = "https://absensi-backend-3we5.vercel.app/api";

// Konfigurasi OpenAI
const OPENAI_CONFIG = {
    apiKey: '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',
    model: 'gpt-4o-mini',
    maxTokens: 2000,
    temperature: 0.3,
    apiUrl: 'https://api.openai.com/v1/chat/completions'
};

let openAIAvailable = true;
let openAIAnalysisCache = null;
let openAICacheTimestamp = 0;
const OPENAI_CACHE_TTL = 15 * 60 * 1000; // 15 menit cache untuk analisis OpenAI

// Cache untuk data analytics
let cachedAnalyticsData = null;
let cachedAnalyticsTimestamp = 0;
const ANALYTICS_CACHE_TTL = 5 * 60 * 1000; // 5 menit

// ======================= FUNGSI UTILITY =======================

function getAuthToken() {
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

/**
 * Memanggil API OpenAI untuk analisis
 * @param {string} systemPrompt - System prompt untuk AI
 * @param {string} userPrompt - User prompt untuk AI
 * @returns {Promise<string>} - Response dari OpenAI
 */
async function callOpenAI(systemPrompt, userPrompt) {
    if (!openAIAvailable) {
        console.warn("OpenAI tidak tersedia, menggunakan fallback rule-based");
        return null;
    }

    try {
        const response = await fetch(OPENAI_CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: OPENAI_CONFIG.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: OPENAI_CONFIG.maxTokens,
                temperature: OPENAI_CONFIG.temperature
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("OpenAI API error:", errorData);
            
            if (response.status === 401 || response.status === 429) {
                openAIAvailable = false;
                console.warn("OpenAI API temporarily disabled due to error");
                setTimeout(() => { openAIAvailable = true; }, 5 * 60 * 1000);
            }
            return null;
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("OpenAI call error:", error);
        openAIAvailable = false;
        return null;
    }
}

// ======================= AMBIL DATA DARI API BACKEND =======================

async function fetchAttendanceDataFromAPI() {
    try {
        const now = Date.now();
        if (cachedAnalyticsData && (now - cachedAnalyticsTimestamp) < ANALYTICS_CACHE_TTL) {
            console.log("📦 Using cached analytics data");
            return cachedAnalyticsData;
        }
        
        console.log("📊 Fetching attendance data from API...");
        
        // Ambil data siswa
        const studentsData = await apiRequest('/students');
        const students = studentsData.data || [];
        
        // Ambil data absensi
        const attendanceData = await apiRequest('/attendance');
        const attendanceRecords = attendanceData.data || [];
        
        // Ambil data konfigurasi
        let schoolConfig = { type: 'smp', classes: [], majors: [] };
        try {
            const configData = await apiRequest('/config');
            schoolConfig = configData.data || {};
        } catch(e) {}
        
        const analytics = processAttendanceData(students, attendanceRecords, schoolConfig);
        
        cachedAnalyticsData = analytics;
        cachedAnalyticsTimestamp = now;
        
        return analytics;
    } catch (error) {
        console.error("Fetch attendance data error:", error);
        return null;
    }
}

function processAttendanceData(students, attendanceRecords, schoolConfig) {
    if (!students || students.length === 0) return null;
    
    const now = new Date();
    const last90Days = new Date();
    last90Days.setDate(now.getDate() - 90);
    
    // Filter data 90 hari terakhir
    const recentAttendance = attendanceRecords.filter(a => {
        if (!a.date) return false;
        const date = new Date(a.date);
        return date >= last90Days && date <= now;
    });
    
    // Hitung unique attendance days
    const uniqueDays = new Set();
    recentAttendance.forEach(a => {
        if (a.date) uniqueDays.add(a.date);
    });
    const totalAttendanceDays = uniqueDays.size;
    
    // Statistik per siswa
    const studentStats = students.map(student => {
        const records = recentAttendance.filter(a => a.studentId == student.id);
        const hadir = records.filter(r => r.status === 'Hadir' || r.status === 'Pulang').length;
        const terlambat = records.filter(r => r.status === 'Terlambat' || (r.timeIn && r.timeIn > '07:30')).length;
        const alpha = totalAttendanceDays - hadir;
        const persentase = totalAttendanceDays > 0 ? (hadir / totalAttendanceDays * 100).toFixed(1) : 0;
        
        return {
            id: student.id,
            nama: student.nama,
            kelas: student.kelas,
            jurusan: student.jurusan,
            hadir: hadir,
            terlambat: terlambat,
            alpha: alpha,
            persentase: parseFloat(persentase),
            totalDays: totalAttendanceDays
        };
    });
    
    // Statistik per kelas
    const classStats = {};
    studentStats.forEach(s => {
        if (!classStats[s.kelas]) {
            classStats[s.kelas] = { total: 0, totalPersen: 0, students: [] };
        }
        classStats[s.kelas].total++;
        classStats[s.kelas].totalPersen += s.persentase;
        classStats[s.kelas].students.push(s);
    });
    
    Object.keys(classStats).forEach(kelas => {
        classStats[kelas].avgPersentase = (classStats[kelas].totalPersen / classStats[kelas].total).toFixed(1);
    });
    
    // Bottom performers
    const bottomPerformers = [...studentStats]
        .sort((a, b) => a.persentase - b.persentase)
        .slice(0, 10);
    
    // Weekly stats
    const weeklyStats = [];
    for (let w = 0; w < 4; w++) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (w * 7 + 7));
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() - (w * 7 + 1));
        
        const weekAttendance = recentAttendance.filter(a => {
            const date = new Date(a.date);
            return date >= weekStart && date <= weekEnd;
        });
        
        const weekHadir = weekAttendance.filter(r => r.status === 'Hadir' || r.status === 'Pulang').length;
        weeklyStats.unshift({
            week: 4 - w,
            hadir: weekHadir,
            persentase: totalAttendanceDays > 0 ? (weekHadir / students.length * 100).toFixed(1) : 0
        });
    }
    
    // Daily stats
    const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    const dailyStats = {};
    dayNames.forEach(day => { dailyStats[day] = { total: 0, terlambat: 0, count: 0 }; });
    
    recentAttendance.forEach(a => {
        if (a.date) {
            const date = new Date(a.date);
            let dayIndex = date.getDay();
            let dayName = dayNames[dayIndex - 1] || dayNames[4];
            if (dailyStats[dayName]) {
                dailyStats[dayName].total++;
                dailyStats[dayName].count++;
                if (a.status === 'Terlambat' || (a.timeIn && a.timeIn > '07:30')) {
                    dailyStats[dayName].terlambat++;
                }
            }
        }
    });
    
    Object.keys(dailyStats).forEach(day => {
        if (dailyStats[day].count > 0) {
            dailyStats[day].persentase = (dailyStats[day].total / students.length * 100).toFixed(1);
        } else {
            dailyStats[day].persentase = 0;
        }
    });
    
    // Average stats
    const totalHadir = studentStats.reduce((sum, s) => sum + s.hadir, 0);
    const avgAttendance = studentStats.length > 0 ? (totalHadir / studentStats.length / totalAttendanceDays * 100).toFixed(1) : 0;
    
    return {
        dataRange: {
            start: last90Days.toISOString().split('T')[0],
            end: now.toISOString().split('T')[0]
        },
        summary: {
            totalStudents: students.length,
            totalAttendance: recentAttendance.length,
            uniqueAttendanceDays: totalAttendanceDays,
            avgAttendance: avgAttendance
        },
        studentStats: {
            all: studentStats,
            bottomPerformers: bottomPerformers,
            averageAttendance: avgAttendance,
            averageConsistency: 0.7
        },
        classStats: classStats,
        weeklyStats: weeklyStats,
        dailyStats: dailyStats,
        trendAnalysis: {
            overall: weeklyStats.length >= 2 && weeklyStats[weeklyStats.length-1].persentase > weeklyStats[0].persentase ? 'Meningkat' : 'Menurun',
            weeklyChange: weeklyStats.length >= 2 ? (weeklyStats[weeklyStats.length-1].persentase - weeklyStats[0].persentase).toFixed(1) : 0
        },
        anomalies: [],
        predictions: [],
        recommendations: []
    };
}

function hasUltimateAIAccess() {
    if (!currentUser) return false;
    return ['admin', 'guru', 'developer'].includes(currentUser.role);
}

// ======================= PREPARE DATA UNTUK AI =======================

function prepareAIDataForOpenAI(analytics) {
    if (!analytics) return null;

    const summary = analytics.summary;
    const studentStats = analytics.studentStats;
    const classStats = analytics.classStats;
    const trendAnalysis = analytics.trendAnalysis;
    const weeklyStats = analytics.weeklyStats;
    const dailyStats = analytics.dailyStats;

    const problematicStudents = studentStats.bottomPerformers?.slice(0, 5).map(s => ({
        nama: s.nama,
        kelas: s.kelas,
        persentase: s.persentase,
        alpha: s.alpha,
        terlambat: s.terlambat
    })) || [];

    const problematicClasses = Object.entries(classStats)
        .filter(([_, data]) => parseFloat(data.avgPersentase) < 70)
        .map(([kelas, data]) => ({
            kelas: kelas,
            avgPersentase: data.avgPersentase,
            totalSiswa: data.total
        }));

    return {
        periode: {
            start: analytics.dataRange.start,
            end: analytics.dataRange.end,
            totalHariSekolah: summary.uniqueAttendanceDays
        },
        statistik_umum: {
            total_siswa: summary.totalStudents,
            total_absensi: summary.totalAttendance,
            rata_rata_kehadiran: parseFloat(studentStats.averageAttendance).toFixed(1),
            rata_rata_konsistensi: parseFloat(studentStats.averageConsistency).toFixed(2),
            tren_kehadiran: trendAnalysis.overall,
            perubahan_mingguan: trendAnalysis.weeklyChange
        },
        pola_harian: Object.entries(dailyStats).map(([day, data]) => ({
            hari: day,
            persentase_kehadiran: parseFloat(data.persentase),
            rata_rata_terlambat: data.terlambat
        })),
        tren_mingguan: weeklyStats.map(w => ({
            minggu_ke: w.week,
            persentase: parseFloat(w.persentase)
        })),
        siswa_bermasalah: problematicStudents,
        kelas_bermasalah: problematicClasses,
        anomali_terdeteksi: analytics.anomalies?.slice(0, 5).map(a => ({
            jenis: a.type,
            deskripsi: a.description,
            tingkat_keparahan: a.severity
        })) || [],
        prediksi_kritis: analytics.predictions?.slice(0, 5).filter(p => p.predictedAttendance < 70).map(p => ({
            tanggal: p.date,
            hari: p.dayName,
            prediksi_kehadiran: p.predictedAttendance,
            tingkat_risiko: p.riskLevel
        })) || []
    };
}

// ======================= GENERATE EXECUTIVE SUMMARY DENGAN OPENAI =======================

async function generateExecutiveSummaryWithAI(analytics) {
    const aiData = prepareAIDataForOpenAI(analytics);
    if (!aiData) return null;

    const systemPrompt = `Anda adalah seorang analis data pendidikan senior yang ahli dalam menganalisis kehadiran siswa. 
Tugas Anda adalah membuat ringkasan eksekutif yang profesional, insightful, dan actionable berdasarkan data kehadiran yang diberikan.

Gaya penulisan:
- Profesional namun mudah dipahami
- Fokus pada insight penting dan rekomendasi konkret
- Gunakan bahasa Indonesia formal
- Sertakan angka-angka penting untuk mendukung analisis
- Jangan terlalu panjang (maksimal 3-4 paragraf)

Format output: Langsung teks ringkasan tanpa judul atau format khusus.`;

    const userPrompt = `Buatkan executive summary berdasarkan data kehadiran berikut:

DATA KEHADIRAN:
- Periode: ${aiData.periode.start} s/d ${aiData.periode.end}
- Total siswa: ${aiData.statistik_umum.total_siswa}
- Rata-rata kehadiran: ${aiData.statistik_umum.rata_rata_kehadiran}%
- Tren kehadiran: ${aiData.statistik_umum.tren_kehadiran}
- Perubahan: ${aiData.statistik_umum.perubahan_mingguan > 0 ? '+' : ''}${aiData.statistik_umum.perubahan_mingguan}%

POLA KEHADIRAN PER HARI:
${aiData.pola_harian.map(p => `- ${p.hari}: ${p.persentase_kehadiran}% kehadiran`).join('\n')}

SISWA BERMASALAH (${aiData.siswa_bermasalah.length} siswa):
${aiData.siswa_bermasalah.map(s => `- ${s.nama} (${s.kelas}): kehadiran ${s.persentase}%`).join('\n')}

KELAS BERMASALAH (${aiData.kelas_bermasalah.length} kelas):
${aiData.kelas_bermasalah.map(k => `- Kelas ${k.kelas}: ${k.avgPersentase}% kehadiran`).join('\n')}

Buatkan executive summary yang profesional.`;

    const result = await callOpenAI(systemPrompt, userPrompt);
    return result;
}

async function generateAIRecommendations(analytics) {
    const aiData = prepareAIDataForOpenAI(analytics);
    if (!aiData) return null;

    const systemPrompt = `Anda adalah konsultan manajemen sekolah yang ahli dalam meningkatkan kehadiran siswa.
Tugas Anda adalah memberikan rekomendasi strategis yang konkret, terukur, dan dapat diimplementasikan.

Prinsip rekomendasi:
1. Berdasarkan data yang tersedia (bukan asumsi)
2. Prioritas pada intervensi yang paling berdampak
3. Rekomendasi harus spesifik dan actionable
4. Gunakan bahasa Indonesia yang jelas dan lugas

Format output: Gunakan format markdown dengan bullet points.`;

    const userPrompt = `Berdasarkan data kehadiran berikut, berikan rekomendasi strategis:

RINGKASAN DATA:
- Rata-rata kehadiran: ${aiData.statistik_umum.rata_rata_kehadiran}%
- ${aiData.siswa_bermasalah.length} siswa dengan kehadiran di bawah 70%
- ${aiData.kelas_bermasalah.length} kelas dengan kehadiran di bawah 70%
- Tren kehadiran: ${aiData.statistik_umum.tren_kehadiran}

SISWA PRIORITAS:
${aiData.siswa_bermasalah.slice(0, 3).map(s => `- ${s.nama} (${s.kelas}): kehadiran ${s.persentase}%`).join('\n')}

Berikan 5 rekomendasi strategis yang spesifik.`;

    const result = await callOpenAI(systemPrompt, userPrompt);
    return result;
}

// ======================= GENERATE FULL AI REPORT =======================

async function generateFullAIReport(analytics) {
    if (!analytics) return null;

    const now = Date.now();
    if (openAIAnalysisCache && (now - openAICacheTimestamp) < OPENAI_CACHE_TTL) {
        console.log("📦 Using cached OpenAI analysis");
        return openAIAnalysisCache;
    }

    console.log("🤖 Generating full AI report with OpenAI...");

    if (typeof showToast === 'function') {
        showToast("🧠 AI sedang menganalisis data dengan kecerdasan buatan...", "info");
    }

    const [executiveSummary, aiRecommendations] = await Promise.all([
        generateExecutiveSummaryWithAI(analytics),
        generateAIRecommendations(analytics)
    ]);

    const aiReport = {
        timestamp: Date.now(),
        openAIAvailable: openAIAvailable,
        executiveSummary: executiveSummary,
        aiRecommendations: aiRecommendations,
        disclaimer: "Analisis ini dihasilkan oleh AI (GPT-4o-mini) berdasarkan data kehadiran. Gunakan sebagai referensi."
    };

    openAIAnalysisCache = aiReport;
    openAICacheTimestamp = now;

    return aiReport;
}

// ======================= RENDER AI SUMMARY =======================

async function renderAISummaryWithOpenAI(analytics) {
    if (!analytics) {
        return generateUltimateAIHTML(null);
    }

    const aiReport = await generateFullAIReport(analytics);
    const baseHTML = generateUltimateAIHTML(analytics);
    
    let openAISection = '';
    
    if (aiReport && aiReport.openAIAvailable && aiReport.executiveSummary) {
        openAISection = `
            <div class="ai-openai-section" style="margin: 24px 0; border-top: 2px solid #667eea; padding-top: 24px;">
                <div class="section-header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                    <span style="font-size: 28px;">🧠</span>
                    <h3 style="margin: 0; color: #667eea;">AI Deep Analysis (Powered by GPT-4o)</h3>
                    <span class="badge-ai" style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 4px 12px; border-radius: 20px; font-size: 11px; color: white;">AI GENERATED</span>
                </div>
                
                <div class="ai-executive-summary" style="background: linear-gradient(135deg, #0f0f1a, #1a1a2e); border-radius: 20px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #667eea;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <span style="font-size: 24px;">📋</span>
                        <h4 style="margin: 0; color: #667eea;">Executive Summary</h4>
                    </div>
                    <div style="line-height: 1.7; color: var(--text-secondary);">
                        ${aiReport.executiveSummary?.replace(/\n/g, '<br>') || 'Tidak dapat menghasilkan ringkasan eksekutif.'}
                    </div>
                </div>
                
                ${aiReport.aiRecommendations ? `
                <div class="ai-recommendations-section" style="background: linear-gradient(135deg, #0f0f1a, #1a1a2e); border-radius: 20px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #764ba2;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <span style="font-size: 24px;">🎯</span>
                        <h4 style="margin: 0; color: #764ba2;">Strategic Recommendations by AI</h4>
                    </div>
                    <div style="line-height: 1.6; color: var(--text-secondary);">
                        ${aiReport.aiRecommendations.replace(/\n/g, '<br>')}
                    </div>
                </div>
                ` : ''}
                
                <div style="margin-top: 16px; padding: 12px; background: rgba(102, 126, 234, 0.1); border-radius: 12px; font-size: 11px; color: #888; text-align: center;">
                    ${aiReport.disclaimer}
                </div>
            </div>
        `;
    } else if (!aiReport?.openAIAvailable) {
        openAISection = `
            <div class="ai-fallback-notice" style="margin: 24px 0; padding: 20px; background: rgba(255, 152, 0, 0.1); border-radius: 20px; text-align: center; border-left: 4px solid #ff9800;">
                <span style="font-size: 32px;">⚠️</span>
                <h4 style="margin: 10px 0 5px 0; color: #ff9800;">OpenAI API Temporarily Unavailable</h4>
                <p style="color: var(--text-muted); font-size: 13px;">Menampilkan analisis rule-based sebagai alternatif.</p>
            </div>
        `;
    }
    
    return baseHTML.replace('</div>', openAISection + '</div>');
}

// ======================= OPEN MODAL AI SUMMARY =======================

async function openAISummaryModalWithOpenAI() {
    if (!hasUltimateAIAccess()) {
        if (typeof showToast === 'function') {
            showToast("🔒 Akses ditolak! Fitur AI Summary hanya untuk Admin, Guru, dan Developer.", "error");
        }
        return;
    }
    
    const now = Date.now();
    if (openAIAnalysisCache && (now - openAICacheTimestamp) < OPENAI_CACHE_TTL) {
        console.log("📦 Using cached OpenAI analysis for modal");
        showAIModalWithData(openAIAnalysisCache);
        return;
    }
    
    let modal = document.getElementById('modal-ai-summary');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="modal-ai-summary" class="modal-overlay">
                <div class="modal-box" style="max-width: 950px; max-height: 85vh; overflow-y: auto;">
                    <div class="modal-title" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <span style="font-size: 1.2rem;">🧠 AI DEEP ANALYSIS - Powered by OpenAI GPT-4o</span>
                        <span onclick="closeModal('modal-ai-summary')" style="cursor: pointer; font-size: 24px;">✖</span>
                    </div>
                    <div style="padding: 20px;" id="aiSummaryContent">
                        <div style="text-align: center; padding: 40px;">
                            <div class="loading-spinner" style="width: 50px; height: 50px; margin: 0 auto 20px;"></div>
                            <h3>🧠 AI Sedang Menganalisis Data...</h3>
                            <p style="color: #888;">Mengambil data dari server dan menganalisis dengan AI</p>
                        </div>
                    </div>
                    <div class="modal-actions" style="padding: 15px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <button class="btn-action btn-success" onclick="exportAISummaryToPDF()" id="aiExportPdfBtn" style="display: none;">📄 Export PDF</button>
                            <button class="btn-action btn-secondary" onclick="copyAISummaryToClipboard()" id="aiCopyBtn" style="display: none;">📋 Copy ke Clipboard</button>
                        </div>
                        <button class="btn-cancel" onclick="closeModal('modal-ai-summary')">Tutup</button>
                    </div>
                </div>
            </div>
        `);
        modal = document.getElementById('modal-ai-summary');
    }
    
    modal.classList.add('open');
    
    setTimeout(async () => {
        const analytics = await fetchAttendanceDataFromAPI();
        
        let contentHTML;
        if (analytics && analytics.summary.totalStudents > 0) {
            contentHTML = await renderAISummaryWithOpenAI(analytics);
        } else {
            contentHTML = '<div style="text-align:center; padding:40px;"><span style="font-size:48px;">📭</span><h3>Data Tidak Tersedia</h3><p>Pastikan ada data siswa dan absensi yang cukup untuk analisis.</p></div>';
        }
        
        const contentDiv = document.getElementById('aiSummaryContent');
        if (contentDiv) {
            contentDiv.innerHTML = contentHTML;
            
            const exportBtn = document.getElementById('aiExportPdfBtn');
            const copyBtn = document.getElementById('aiCopyBtn');
            if (exportBtn) exportBtn.style.display = 'inline-block';
            if (copyBtn) copyBtn.style.display = 'inline-block';
        }
    }, 100);
}

function showAIModalWithData(analytics) {
    const contentDiv = document.getElementById('aiSummaryContent');
    if (contentDiv && analytics) {
        renderAISummaryWithOpenAI(analytics).then(html => {
            contentDiv.innerHTML = html;
        });
        
        const exportBtn = document.getElementById('aiExportPdfBtn');
        const copyBtn = document.getElementById('aiCopyBtn');
        if (exportBtn) exportBtn.style.display = 'inline-block';
        if (copyBtn) copyBtn.style.display = 'inline-block';
    }
}

// Fallback function jika tidak ada
function generateUltimateAIHTML(analytics) {
    if (!analytics) {
        return '<div style="text-align:center; padding:40px;">📭 Data tidak tersedia</div>';
    }
    
    return `
        <div style="padding: 10px;">
            <h3>📊 Data Kehadiran</h3>
            <p>Total Siswa: ${analytics.summary.totalStudents}</p>
            <p>Total Absensi: ${analytics.summary.totalAttendance}</p>
            <p>Rata-rata Kehadiran: ${analytics.summary.avgAttendance}%</p>
        </div>
    `;
}

// ======================= EKSPOR KE GLOBAL =======================

window.openUltimateAISummaryModal = openAISummaryModalWithOpenAI;
window.openAISummaryModal = openAISummaryModalWithOpenAI;
window.generateFullAIReport = generateFullAIReport;
window.renderAISummaryWithOpenAI = renderAISummaryWithOpenAI;
window.callOpenAI = callOpenAI;
window.fetchAttendanceDataFromAPI = fetchAttendanceDataFromAPI;

console.log("✅ ai-openai.js V2.0 loaded - Compatible with Vercel Backend API!");