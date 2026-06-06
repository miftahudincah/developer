// global-functions.js - VERSION 2.0 (ENHANCED GLOBAL FUNCTIONS)
// Fungsi global yang digunakan di seluruh aplikasi
// V2.0: Menambahkan fitur loading, konfirmasi, copy to clipboard, export data, dan utility functions
// ============================================================================

// Backend API URL (Vercel) untuk referensi
const BACKEND_API_URL = "https://absensi-backend-3we5.vercel.app/api";

// Toast timeout ID untuk queue management
let toastTimeout = null;
let toastQueue = [];

// ======================= TOAST NOTIFICATION =======================

/**
 * Menampilkan toast notification dengan queue system
 * @param {string} msg - Pesan yang akan ditampilkan
 * @param {string} type - Tipe notifikasi ('success', 'error', 'info', 'warning')
 * @param {number} duration - Durasi tampil dalam ms (default 3000)
 */
function showToast(msg, type = 'info', duration = 3000) {
    // Queue system untuk multiple toast
    toastQueue.push({ msg, type, duration });
    processToastQueue();
}

function processToastQueue() {
    if (toastTimeout || toastQueue.length === 0) return;
    
    const { msg, type, duration } = toastQueue.shift();
    
    let toast = document.getElementById('toast');
    if (!toast) {
        // Buat elemen toast jika belum ada
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            white-space: nowrap;
            max-width: 90%;
            white-space: normal;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(toast);
    }
    
    // Set warna berdasarkan tipe
    let bgColor = '#333';
    let borderColor = '';
    switch (type) {
        case 'success':
            bgColor = '#4caf50';
            borderColor = '#388e3c';
            break;
        case 'error':
            bgColor = '#f44336';
            borderColor = '#d32f2f';
            break;
        case 'warning':
            bgColor = '#ff9800';
            borderColor = '#f57c00';
            break;
        case 'info':
        default:
            bgColor = '#2196f3';
            borderColor = '#1976d2';
            break;
    }
    
    toast.textContent = msg;
    toast.style.backgroundColor = bgColor;
    toast.style.borderLeft = `4px solid ${borderColor}`;
    toast.style.opacity = '1';
    
    toastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
        toastTimeout = null;
        setTimeout(processToastQueue, 300);
    }, duration);
}

/**
 * Menampilkan loading toast (tanpa auto close)
 * @param {string} msg - Pesan loading
 * @returns {number} ID toast untuk close
 */
function showLoadingToast(msg = 'Memproses...') {
    let toast = document.getElementById('toast-loading');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-loading';
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10001;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(toast);
    }
    
    toast.innerHTML = `
        <div class="loading-spinner-small" style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        <span>${msg}</span>
    `;
    toast.style.display = 'flex';
    
    return Date.now();
}

/**
 * Menutup loading toast
 */
function hideLoadingToast() {
    const toast = document.getElementById('toast-loading');
    if (toast) {
        toast.style.display = 'none';
    }
}

// ======================= MODAL MANAGEMENT =======================

/**
 * Menutup modal berdasarkan ID
 * @param {string} id - ID modal yang akan ditutup
 */
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('open');
        // Trigger event setelah modal ditutup
        const event = new CustomEvent('modalClosed', {
            detail: { modalId: id }
        });
        window.dispatchEvent(event);
    }
}

/**
 * Membuka modal berdasarkan ID
 * @param {string} id - ID modal yang akan dibuka
 */
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('open');
        const event = new CustomEvent('modalOpened', {
            detail: { modalId: id }
        });
        window.dispatchEvent(event);
    }
}

/**
 * Toggle modal friends
 */
function toggleFriendsModal() {
    const modal = document.getElementById('modal-friends');
    if (modal) {
        if (modal.classList.contains('open')) {
            closeModal('modal-friends');
        } else {
            openModal('modal-friends');
            if (typeof renderFriendsPanel === 'function') {
                setTimeout(() => renderFriendsPanel(), 100);
            }
        }
    }
}

/**
 * Buka modal chat
 */
function openChatModal() {
    const modal = document.getElementById('modal-chat');
    if (modal) {
        openModal('modal-chat');
        if (typeof renderChatInterface === 'function') {
            setTimeout(() => renderChatInterface('chatModalPanel'), 100);
        }
    }
}

/**
 * Buka modal AI Summary
 */
function openAISummaryModal() {
    if (typeof window.openAISummaryModal === 'function') {
        window.openAISummaryModal();
    } else if (typeof window.openPowerfulAISummaryModal === 'function') {
        window.openPowerfulAISummaryModal();
    } else {
        showToast("Fitur AI Summary sedang dimuat, coba lagi nanti", "warning");
    }
}

/**
 * Buka modal AI Assistant
 */
function openAIAssistantModal() {
    if (typeof window.openAIAssistantModal === 'function') {
        window.openAIAssistantModal();
    } else {
        showToast("Fitur AI Assistant sedang dimuat, coba lagi nanti", "warning");
    }
}

/**
 * Tutup modal AI Assistant
 */
function closeAIAssistantModal() {
    const modal = document.getElementById('modal-ai-assistant');
    if (modal) modal.classList.remove('open');
    if (typeof window.closeAIAssistantModal === 'function') {
        window.closeAIAssistantModal();
    }
}

// ======================= KONFIRMASI =======================

/**
 * Menampilkan dialog konfirmasi
 * @param {string} message - Pesan konfirmasi
 * @param {Function} onConfirm - Fungsi jika user klik OK
 * @param {Function} onCancel - Fungsi jika user klik Cancel (opsional)
 */
function showConfirm(message, onConfirm, onCancel) {
    // Cek apakah modal konfirmasi sudah ada
    let modal = document.getElementById('modal-confirm');
    if (!modal) {
        const modalHtml = `
            <div id="modal-confirm" class="modal-overlay">
                <div class="modal-box" style="max-width: 400px;">
                    <div class="modal-title">
                        <span>⚠️ Konfirmasi</span>
                        <span onclick="closeModal('modal-confirm')">✖</span>
                    </div>
                    <div id="confirmMessage" style="padding: 20px;"></div>
                    <div class="modal-actions" style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn-cancel" onclick="closeModal('modal-confirm')">Batal</button>
                        <button id="confirmOkBtn" class="btn-save">OK</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('modal-confirm');
    }
    
    const confirmMessage = document.getElementById('confirmMessage');
    if (confirmMessage) confirmMessage.innerHTML = message;
    
    const okBtn = document.getElementById('confirmOkBtn');
    const oldOnClick = okBtn.onclick;
    if (oldOnClick) okBtn.onclick = null;
    
    okBtn.onclick = () => {
        closeModal('modal-confirm');
        if (typeof onConfirm === 'function') onConfirm();
    };
    
    openModal('modal-confirm');
}

// ======================= COPY TO CLIPBOARD =======================

/**
 * Copy text ke clipboard
 * @param {string} text - Teks yang akan di-copy
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast("✅ Berhasil disalin ke clipboard", "success");
        return true;
    } catch (error) {
        console.error("Copy to clipboard failed:", error);
        // Fallback untuk browser lama
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast("✅ Berhasil disalin ke clipboard", "success");
        return true;
    }
}

// ======================= FORMAT UTILITY =======================

/**
 * Format angka menjadi format Rupiah
 * @param {number} number - Angka yang akan diformat
 * @returns {string}
 */
function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
}

/**
 * Format tanggal ke format Indonesia
 * @param {Date|string|number} date - Tanggal
 * @param {boolean} includeTime - Sertakan waktu atau tidak
 * @returns {string}
 */
function formatIndonesianDate(date, includeTime = false) {
    if (!date) return '-';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    
    const options = {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    };
    
    if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }
    
    return d.toLocaleDateString('id-ID', options);
}

/**
 * Format waktu relatif (time ago)
 * @param {Date|string|number} date - Tanggal
 * @returns {string}
 */
function timeAgo(date) {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const weeks = Math.floor(diff / 604800000);
    const months = Math.floor(diff / 2592000000);
    const years = Math.floor(diff / 31536000000);
    
    if (minutes < 1) return 'baru saja';
    if (minutes < 60) return `${minutes} menit yang lalu`;
    if (hours < 24) return `${hours} jam yang lalu`;
    if (days < 7) return `${days} hari yang lalu`;
    if (weeks < 4) return `${weeks} minggu yang lalu`;
    if (months < 12) return `${months} bulan yang lalu`;
    return `${years} tahun yang lalu`;
}

/**
 * Truncate text dengan ellipsis
 * @param {string} text - Teks yang akan dipotong
 * @param {number} maxLength - Panjang maksimal
 * @returns {string}
 */
function truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// ======================= EKSPORT DATA =======================

/**
 * Export data ke CSV
 * @param {Array} data - Array data
 * @param {string} filename - Nama file
 * @param {Array} headers - Header kolom (opsional)
 */
function exportToCSV(data, filename, headers = null) {
    if (!data || data.length === 0) {
        showToast("Tidak ada data untuk diekspor", "error");
        return;
    }
    
    let csvRows = [];
    
    // Header
    if (headers) {
        csvRows.push(headers.join(','));
    } else {
        csvRows.push(Object.keys(data[0]).join(','));
    }
    
    // Data
    for (const row of data) {
        const values = Object.values(row).map(value => {
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value).replace(/,/g, ';');
        });
        csvRows.push(values.join(','));
    }
    
    const csv = csvRows.join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast(`📥 ${filename} berhasil diunduh`, "success");
}

/**
 * Export data ke JSON
 * @param {Object|Array} data - Data yang akan diekspor
 * @param {string} filename - Nama file
 */
function exportToJSON(data, filename) {
    if (!data) {
        showToast("Tidak ada data untuk diekspor", "error");
        return;
    }
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast(`📥 ${filename} berhasil diunduh`, "success");
}

// ======================= LOADING OVERLAY =======================

let loadingOverlayCount = 0;

/**
 * Menampilkan loading overlay
 * @param {string} message - Pesan loading
 */
function showLoadingOverlay(message = 'Memuat...') {
    let overlay = document.getElementById('loadingOverlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            backdrop-filter: blur(5px);
        `;
        overlay.innerHTML = `
            <div style="text-align: center;">
                <div class="loading-spinner" style="width: 50px; height: 50px; margin: 0 auto 20px;"></div>
                <p id="loadingMessage" style="color: white; font-size: 16px;">Memuat...</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    
    loadingOverlayCount++;
    const msgEl = document.getElementById('loadingMessage');
    if (msgEl) msgEl.textContent = message;
    overlay.style.display = 'flex';
}

/**
 * Menyembunyikan loading overlay
 */
function hideLoadingOverlay() {
    loadingOverlayCount--;
    if (loadingOverlayCount <= 0) {
        loadingOverlayCount = 0;
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
}

// ======================= VALIDATION =======================

/**
 * Validasi email
 * @param {string} email - Email yang divalidasi
 * @returns {boolean}
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
    return emailRegex.test(email);
}

/**
 * Validasi nomor telepon Indonesia
 * @param {string} phone - Nomor telepon
 * @returns {boolean}
 */
function isValidPhoneNumber(phone) {
    const phoneRegex = /^(^\+62|62|^08)(\d{3,4}-?){2}\d{3,4}$/;
    return phoneRegex.test(phone);
}

/**
 * Validasi input tidak kosong
 * @param {string} value - Nilai yang divalidasi
 * @returns {boolean}
 */
function isNotEmpty(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
}

// ======================= COLOR GENERATOR =======================

/**
 * Generate random color
 * @returns {string}
 */
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

/**
 * Generate color based on string (consistent)
 * @param {string} str - String input
 * @returns {string}
 */
function getColorFromString(str) {
    if (!str) return '#00bcd4';
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}

// ======================= SCROLL TO ELEMENT =======================

/**
 * Scroll ke element dengan animasi
 * @param {string} elementId - ID element tujuan
 * @param {number} offset - Offset dari atas (opsional)
 */
function scrollToElement(elementId, offset = 0) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;
    
    window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
    });
}

/**
 * Scroll ke atas halaman
 */
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// ======================= NETWORK CHECK =======================

/**
 * Cek koneksi internet
 * @returns {Promise<boolean>}
 */
async function isOnline() {
    return navigator.onLine;
}

/**
 * Cek koneksi ke backend API
 * @returns {Promise<boolean>}
 */
async function checkBackendConnection() {
    try {
        const response = await fetch(`${BACKEND_API_URL}/health`);
        const data = await response.json();
        return data.status === 'OK';
    } catch (error) {
        return false;
    }
}

// ======================= EKSPOR KE GLOBAL =======================
window.showToast = showToast;
window.showLoadingToast = showLoadingToast;
window.hideLoadingToast = hideLoadingToast;
window.showConfirm = showConfirm;
window.closeModal = closeModal;
window.openModal = openModal;
window.toggleFriendsModal = toggleFriendsModal;
window.openChatModal = openChatModal;
window.openAISummaryModal = openAISummaryModal;
window.openAIAssistantModal = openAIAssistantModal;
window.closeAIAssistantModal = closeAIAssistantModal;
window.copyToClipboard = copyToClipboard;
window.formatRupiah = formatRupiah;
window.formatIndonesianDate = formatIndonesianDate;
window.timeAgo = timeAgo;
window.truncateText = truncateText;
window.exportToCSV = exportToCSV;
window.exportToJSON = exportToJSON;
window.showLoadingOverlay = showLoadingOverlay;
window.hideLoadingOverlay = hideLoadingOverlay;
window.isValidEmail = isValidEmail;
window.isValidPhoneNumber = isValidPhoneNumber;
window.isNotEmpty = isNotEmpty;
window.getRandomColor = getRandomColor;
window.getColorFromString = getColorFromString;
window.scrollToElement = scrollToElement;
window.scrollToTop = scrollToTop;
window.isOnline = isOnline;
window.checkBackendConnection = checkBackendConnection;

// Tambahkan CSS untuk animasi loading spinner jika belum ada
if (!document.getElementById('global-functions-style')) {
    const style = document.createElement('style');
    style.id = 'global-functions-style';
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .loading-spinner {
            border: 4px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        .loading-spinner-small {
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
    `;
    document.head.appendChild(style);
}

console.log("✅ global-functions.js V2.0 loaded - Backend API: " + BACKEND_API_URL);