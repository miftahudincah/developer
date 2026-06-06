// Components.js - VERSION 2.0 (INTEGRATED WITH VERCEL BACKEND API)
// Fungsi untuk memuat komponen HTML dari file partial
// Mendukung: lazy loading, error handling, retry mechanism, dan cache
// V2.0: Terintegrasi dengan API backend Vercel dan menambahkan fitur loading states
// ============================================================================

// Konfigurasi
const COMPONENTS_CONFIG = {
    basePath: 'partials/',
    cacheTTL: 5 * 60 * 1000, // 5 menit cache
    maxRetries: 3,
    retryDelay: 1000
};

// Cache untuk komponen yang sudah dimuat
let componentCache = new Map();

// ======================= UTILITY FUNCTIONS =======================

/**
 * Delay function untuk retry mechanism
 * @param {number} ms - Milidetik
 * @returns {Promise}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mendapatkan base URL untuk partials
 * @returns {string}
 */
function getBasePath() {
    // Deteksi apakah sedang di localhost atau production
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1';
    return isLocalhost ? 'partials/' : '/partials/';
}

/**
 * Memuat komponen HTML dengan retry mechanism
 * @param {string} elementId - ID element target
 * @param {string} filePath - Path file partial
 * @param {number} retryCount - Jumlah percobaan saat ini
 * @returns {Promise<boolean>}
 */
async function loadComponent(elementId, filePath, retryCount = 0) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element dengan ID "${elementId}" tidak ditemukan!`);
        return false;
    }
    
    // Cek cache
    const cacheKey = filePath;
    const cached = componentCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < COMPONENTS_CONFIG.cacheTTL) {
        console.log(`📦 Using cached component: ${filePath}`);
        element.innerHTML = cached.html;
        return true;
    }
    
    // Tampilkan loading indicator
    if (retryCount === 0) {
        element.innerHTML = `
            <div class="component-loading" style="text-align: center; padding: 40px;">
                <div class="loading-spinner" style="width: 40px; height: 40px; margin: 0 auto 15px;"></div>
                <p>Memuat komponen...</p>
            </div>
        `;
    }
    
    try {
        const basePath = getBasePath();
        const fullPath = filePath.startsWith('/') ? filePath : basePath + filePath;
        
        console.log(`📥 Loading component: ${fullPath}`);
        const response = await fetch(fullPath);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // Validasi HTML tidak kosong
        if (!html || html.trim().length === 0) {
            throw new Error('File komponen kosong');
        }
        
        // Simpan ke cache
        componentCache.set(cacheKey, {
            html: html,
            timestamp: Date.now()
        });
        
        element.innerHTML = html;
        
        // Trigger event setelah komponen dimuat
        const event = new CustomEvent('componentLoaded', {
            detail: { componentId: elementId, filePath: filePath }
        });
        window.dispatchEvent(event);
        
        console.log(`✅ Component loaded: ${filePath}`);
        return true;
        
    } catch (error) {
        console.error(`Gagal memuat ${filePath} (attempt ${retryCount + 1}/${COMPONENTS_CONFIG.maxRetries}):`, error);
        
        // Retry mechanism
        if (retryCount < COMPONENTS_CONFIG.maxRetries - 1) {
            element.innerHTML = `
                <div class="component-retry" style="text-align: center; padding: 40px;">
                    <div class="retry-icon" style="font-size: 48px; margin-bottom: 15px;">🔄</div>
                    <p>Gagal memuat komponen. Mencoba ulang (${retryCount + 1}/${COMPONENTS_CONFIG.maxRetries})...</p>
                </div>
            `;
            await delay(COMPONENTS_CONFIG.retryDelay);
            return loadComponent(elementId, filePath, retryCount + 1);
        }
        
        // Tampilkan error
        element.innerHTML = `
            <div class="component-error" style="text-align: center; padding: 40px; color: #f44336;">
                <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
                <h4>Gagal Memuat Komponen</h4>
                <p>${escapeHtmlStatic(error.message)}</p>
                <button onclick="reloadComponent('${elementId}', '${filePath}')" 
                        style="margin-top: 15px; padding: 8px 20px; background: #2196f3; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    🔄 Muat Ulang
                </button>
            </div>
        `;
        return false;
    }
}

/**
 * Reload komponen (untuk tombol retry)
 * @param {string} elementId - ID element target
 * @param {string} filePath - Path file partial
 */
async function reloadComponent(elementId, filePath) {
    // Hapus dari cache
    componentCache.delete(filePath);
    await loadComponent(elementId, filePath);
}

/**
 * Muat semua komponen untuk halaman utama
 * @returns {Promise<boolean>}
 */
async function loadAllComponents() {
    console.log("🚀 Loading all components...");
    
    // Tampilkan loading global
    showGlobalLoading(true);
    
    try {
        // Urutan penting: auth dulu, lalu modal, dashboard
        const authLoaded = await loadComponent('auth-section', 'auth.html');
        if (!authLoaded) {
            throw new Error('Gagal memuat komponen auth');
        }
        
        const modalLoaded = await loadComponent('modal-container', 'modals.html');
        if (!modalLoaded) {
            throw new Error('Gagal memuat komponen modal');
        }
        
        // Inisialisasi event listener untuk modal dan auth setelah komponen terpasang
        initComponentEventListeners();
        
        console.log("✅ All components loaded successfully");
        showGlobalLoading(false);
        
        // Trigger event bahwa komponen sudah siap
        const event = new CustomEvent('componentsReady', {
            detail: { timestamp: Date.now() }
        });
        window.dispatchEvent(event);
        
        return true;
        
    } catch (error) {
        console.error("Failed to load components:", error);
        showGlobalLoading(false);
        showErrorNotification("Gagal memuat komponen utama. Silakan muat ulang halaman.");
        return false;
    }
}

/**
 * Muat komponen dashboard (header + tabs)
 * @returns {Promise<boolean>}
 */
async function loadDashboardComponents() {
    console.log("📊 Loading dashboard components...");
    
    // Tampilkan loading di dashboard section
    const dashboardSection = document.getElementById('dashboard-section');
    if (dashboardSection) {
        dashboardSection.innerHTML = `
            <div class="dashboard-loading" style="text-align: center; padding: 60px;">
                <div class="loading-spinner" style="width: 50px; height: 50px; margin: 0 auto 20px;"></div>
                <h3>Memuat Dashboard...</h3>
                <p style="color: var(--text-muted);">Mohon tunggu sebentar</p>
            </div>
        `;
    }
    
    try {
        // Load dashboard header
        const headerLoaded = await loadComponent('dashboard-section', 'dashboard-header.html');
        if (!headerLoaded) {
            throw new Error('Gagal memuat dashboard header');
        }
        
        // Load tabs dengan parallel loading untuk mempercepat
        const tabIds = [
            { id: 'tab-attendance', file: 'tab-attendance.html' },
            { id: 'tab-students', file: 'tab-students.html' },
            { id: 'tab-users', file: 'tab-users.html' },
            { id: 'tab-config', file: 'tab-config.html' },
            { id: 'tab-guide', file: 'tab-guide.html' },
            { id: 'tab-chat', file: 'tab-chat.html' },
            { id: 'tab-announcement', file: 'tab-announcement.html' }
        ];
        
        // Load tabs in parallel
        const results = await Promise.all(
            tabIds.map(tab => loadComponent(tab.id, tab.file))
        );
        
        const allLoaded = results.every(result => result === true);
        
        if (!allLoaded) {
            console.warn("Some tabs failed to load, but continuing...");
        }
        
        console.log("✅ Dashboard components loaded");
        
        // Trigger event bahwa dashboard sudah siap
        const event = new CustomEvent('dashboardReady', {
            detail: { timestamp: Date.now() }
        });
        window.dispatchEvent(event);
        
        return true;
        
    } catch (error) {
        console.error("Failed to load dashboard components:", error);
        
        if (dashboardSection) {
            dashboardSection.innerHTML = `
                <div class="dashboard-error" style="text-align: center; padding: 60px;">
                    <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
                    <h3>Gagal Memuat Dashboard</h3>
                    <p>${escapeHtmlStatic(error.message)}</p>
                    <button onclick="location.reload()" style="margin-top: 15px; padding: 10px 24px; background: #2196f3; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        🔄 Muat Ulang Halaman
                    </button>
                </div>
            `;
        }
        return false;
    }
}

/**
 * Inisialisasi event listener untuk komponen yang sudah dimuat
 */
function initComponentEventListeners() {
    // Inisialisasi toggle password di modal login/register
    const togglePasswordBtns = document.querySelectorAll('.toggle-password');
    togglePasswordBtns.forEach(btn => {
        if (typeof togglePassword === 'function') {
            btn.onclick = () => {
                const targetId = btn.getAttribute('data-target');
                togglePassword(targetId, btn);
            };
        }
    });
    
    // Inisialisasi close modal buttons
    const closeModalBtns = document.querySelectorAll('.close-modal, [onclick*="closeModal"]');
    closeModalBtns.forEach(btn => {
        if (typeof closeModal === 'function') {
            btn.onclick = () => {
                const modalId = btn.getAttribute('data-modal') || 'modal-default';
                closeModal(modalId);
            };
        }
    });
    
    // Inisialisasi form login jika ada
    const loginForm = document.getElementById('loginForm');
    if (loginForm && typeof handleLogin === 'function') {
        loginForm.onsubmit = handleLogin;
    }
    
    // Inisialisasi form register jika ada
    const registerForm = document.getElementById('registerForm');
    if (registerForm && typeof handleRegister === 'function') {
        registerForm.onsubmit = handleRegister;
    }
    
    // Inisialisasi role type radio buttons
    const roleRadios = document.querySelectorAll('input[name="regRoleType"]');
    if (roleRadios.length > 0 && typeof toggleRegisterInput === 'function') {
        roleRadios.forEach(radio => {
            radio.addEventListener('change', toggleRegisterInput);
        });
        toggleRegisterInput(); // Initial call
    }
    
    console.log("✅ Component event listeners initialized");
}

/**
 * Tampilkan atau sembunyikan loading global
 * @param {boolean} show - Tampilkan atau sembunyikan
 */
function showGlobalLoading(show) {
    let loader = document.getElementById('globalLoader');
    
    if (show) {
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'globalLoader';
            loader.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                backdrop-filter: blur(5px);
            `;
            loader.innerHTML = `
                <div style="text-align: center;">
                    <div class="loading-spinner" style="width: 60px; height: 60px; margin: 0 auto 20px;"></div>
                    <p style="color: white; font-size: 16px;">Memuat sistem...</p>
                </div>
            `;
            document.body.appendChild(loader);
        } else {
            loader.style.display = 'flex';
        }
    } else {
        if (loader) {
            loader.style.display = 'none';
        }
    }
}

/**
 * Tampilkan notifikasi error
 * @param {string} message - Pesan error
 */
function showErrorNotification(message) {
    if (typeof showToast === 'function') {
        showToast(message, "error");
    } else {
        alert(message);
    }
}

/**
 * Escape HTML string
 * @param {string} str - String yang akan di-escape
 * @returns {string}
 */
function escapeHtmlStatic(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

/**
 * Clear component cache
 * @param {string} filePath - Optional specific file path to clear
 */
function clearComponentCache(filePath) {
    if (filePath) {
        componentCache.delete(filePath);
        console.log(`🗑️ Cache cleared for: ${filePath}`);
    } else {
        componentCache.clear();
        console.log("🗑️ All component cache cleared");
    }
}

/**
 * Preload components for faster loading
 * @param {Array<string>} filePaths - Array of file paths to preload
 */
async function preloadComponents(filePaths) {
    console.log(`📦 Preloading ${filePaths.length} components...`);
    const promises = filePaths.map(filePath => {
        const elementId = `preload-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const tempDiv = document.createElement('div');
        tempDiv.id = elementId;
        tempDiv.style.display = 'none';
        document.body.appendChild(tempDiv);
        return loadComponent(elementId, filePath).then(() => {
            tempDiv.remove();
            return true;
        }).catch(() => {
            tempDiv.remove();
            return false;
        });
    });
    await Promise.all(promises);
    console.log("✅ Preloading complete");
}

/**
 * Get component loading status
 * @returns {Object}
 */
function getComponentStatus() {
    return {
        cacheSize: componentCache.size,
        cacheKeys: Array.from(componentCache.keys()),
        config: COMPONENTS_CONFIG
    };
}

// ======================= AUTO INITIALIZATION =======================

// Auto load components when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Small delay to ensure other scripts are loaded
        setTimeout(() => {
            loadAllComponents();
        }, 100);
    });
} else {
    setTimeout(() => {
        loadAllComponents();
    }, 100);
}

// ======================= EXPORT TO GLOBAL =======================
window.loadComponent = loadComponent;
window.loadAllComponents = loadAllComponents;
window.loadDashboardComponents = loadDashboardComponents;
window.reloadComponent = reloadComponent;
window.clearComponentCache = clearComponentCache;
window.preloadComponents = preloadComponents;
window.getComponentStatus = getComponentStatus;
window.initComponentEventListeners = initComponentEventListeners;

console.log("✅ Components.js V2.0 loaded - Compatible with Vercel Backend API!");