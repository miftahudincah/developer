// dropdown.js - VERSION 2.0 (ENHANCED DROPDOWN MANAGEMENT)
// Fungsi untuk mengelola dropdown menu dengan berbagai fitur tambahan
// V2.0: Menambahkan auto-close, click outside detection, keyboard navigation, dan animasi
// ============================================================================

// Konfigurasi dropdown
const DROPDOWN_CONFIG = {
    closeDelay: 200,        // Delay sebelum menutup (ms)
    animationDuration: 200, // Durasi animasi (ms)
    closeOnEsc: true,       // Tutup dengan tombol ESC
    closeOnClickOutside: true // Tutup saat klik di luar
};

// Track dropdown state
let activeDropdownId = null;
let closeTimeout = null;

/**
 * Toggle dropdown menu
 * @param {string} dropdownId - ID dari dropdown container
 * @param {Event} event - Event object (opsional)
 */
function toggleDropdown(dropdownId, event) {
    if (event) {
        event.stopPropagation();
    }
    
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) {
        console.warn(`Dropdown with ID "${dropdownId}" not found`);
        return;
    }
    
    const content = dropdown.querySelector('.dropdown-content');
    if (!content) {
        console.warn(`Dropdown content not found in "${dropdownId}"`);
        return;
    }
    
    const isOpen = content.classList.contains('open');
    
    // Clear pending close timeout
    if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
    }
    
    if (isOpen) {
        closeDropdown(dropdownId);
    } else {
        openDropdown(dropdownId);
    }
}

/**
 * Membuka dropdown
 * @param {string} dropdownId - ID dropdown
 */
function openDropdown(dropdownId) {
    // Tutup semua dropdown lain terlebih dahulu
    closeAllDropdowns();
    
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    const content = dropdown.querySelector('.dropdown-content');
    if (!content) return;
    
    // Tambahkan class open dengan animasi
    content.classList.add('open');
    content.style.animation = `dropdownSlideIn ${DROPDOWN_CONFIG.animationDuration}ms ease`;
    
    // Tandai dropdown aktif
    activeDropdownId = dropdownId;
    
    // Aktifkan overlay jika ada
    const overlay = document.getElementById('dropdownOverlay');
    if (overlay) overlay.classList.add('active');
    
    // Trigger event
    const event = new CustomEvent('dropdownOpened', {
        detail: { dropdownId: dropdownId }
    });
    window.dispatchEvent(event);
}

/**
 * Menutup dropdown tertentu
 * @param {string} dropdownId - ID dropdown (opsional, jika tidak diberikan akan menutup yang aktif)
 */
function closeDropdown(dropdownId) {
    const targetId = dropdownId || activeDropdownId;
    if (!targetId) return;
    
    const dropdown = document.getElementById(targetId);
    if (!dropdown) return;
    
    const content = dropdown.querySelector('.dropdown-content');
    if (!content) return;
    
    // Tambahkan animasi keluar
    content.style.animation = `dropdownSlideOut ${DROPDOWN_CONFIG.animationDuration}ms ease`;
    
    // Hapus class setelah animasi selesai
    setTimeout(() => {
        content.classList.remove('open');
        content.style.animation = '';
        
        if (activeDropdownId === targetId) {
            activeDropdownId = null;
        }
    }, DROPDOWN_CONFIG.animationDuration);
    
    // Nonaktifkan overlay jika tidak ada dropdown yang terbuka
    const anyOpen = document.querySelectorAll('.dropdown-content.open').length > 0;
    if (!anyOpen) {
        const overlay = document.getElementById('dropdownOverlay');
        if (overlay) overlay.classList.remove('active');
    }
}

/**
 * Menutup semua dropdown yang terbuka
 */
function closeAllDropdowns() {
    if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
    }
    
    const openDropdowns = document.querySelectorAll('.dropdown-content.open');
    openDropdowns.forEach(content => {
        const dropdown = content.closest('.dropdown');
        if (dropdown && dropdown.id) {
            closeDropdown(dropdown.id);
        } else {
            // Fallback: langsung hapus class
            content.classList.remove('open');
            content.style.animation = '';
        }
    });
    
    activeDropdownId = null;
    
    const overlay = document.getElementById('dropdownOverlay');
    if (overlay) overlay.classList.remove('active');
}

/**
 * Setup click outside detection
 */
function setupClickOutsideDetection() {
    if (!DROPDOWN_CONFIG.closeOnClickOutside) return;
    
    document.addEventListener('click', function(event) {
        // Cek apakah klik terjadi di dalam dropdown yang aktif
        if (activeDropdownId) {
            const activeDropdown = document.getElementById(activeDropdownId);
            if (activeDropdown && !activeDropdown.contains(event.target)) {
                // Klik di luar dropdown, tutup dengan delay
                if (closeTimeout) clearTimeout(closeTimeout);
                closeTimeout = setTimeout(() => {
                    closeAllDropdowns();
                    closeTimeout = null;
                }, DROPDOWN_CONFIG.closeDelay);
            }
        }
    });
}

/**
 * Setup keyboard listener (ESC key)
 */
function setupDropdownKeyboardListener() {
    if (!DROPDOWN_CONFIG.closeOnEsc) return;
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllDropdowns();
        }
        
        // Optional: Arrow keys untuk navigasi dropdown
        if (e.key === 'ArrowDown' && activeDropdownId) {
            e.preventDefault();
            const activeDropdown = document.getElementById(activeDropdownId);
            if (activeDropdown) {
                const firstItem = activeDropdown.querySelector('.dropdown-content a, .dropdown-content button');
                if (firstItem) firstItem.focus();
            }
        }
    });
}

/**
 * Setup hover detection untuk dropdown yang menggunakan hover
 * @param {string} dropdownId - ID dropdown
 * @param {number} delay - Delay sebelum buka/tutup (ms)
 */
function setupHoverDropdown(dropdownId, delay = 300) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    let hoverTimeout = null;
    
    dropdown.addEventListener('mouseenter', () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
            openDropdown(dropdownId);
        }, delay);
    });
    
    dropdown.addEventListener('mouseleave', () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
            closeDropdown(dropdownId);
        }, delay);
    });
}

/**
 * Setup dropdown toggle button
 * @param {string} buttonId - ID tombol toggle
 * @param {string} dropdownId - ID dropdown
 */
function setupDropdownToggle(buttonId, dropdownId) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(dropdownId, e);
    });
}

/**
 * Mendapatkan status dropdown
 * @param {string} dropdownId - ID dropdown
 * @returns {boolean} - Apakah dropdown terbuka
 */
function isDropdownOpen(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return false;
    
    const content = dropdown.querySelector('.dropdown-content');
    return content ? content.classList.contains('open') : false;
}

/**
 * Inisialisasi semua dropdown yang ada di halaman
 */
function initAllDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
        if (dropdown.id) {
            console.log(`📋 Dropdown initialized: ${dropdown.id}`);
        }
    });
}

// ======================= STYLE ANIMATION =======================

// Tambahkan CSS animation jika belum ada
function addDropdownAnimations() {
    if (document.getElementById('dropdown-animation-style')) return;
    
    const style = document.createElement('style');
    style.id = 'dropdown-animation-style';
    style.textContent = `
        @keyframes dropdownSlideIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes dropdownSlideOut {
            from {
                opacity: 1;
                transform: translateY(0);
            }
            to {
                opacity: 0;
                transform: translateY(-10px);
            }
        }
        
        .dropdown-content {
            transition: opacity 0.2s ease, visibility 0.2s ease;
        }
        
        .dropdown-content.open {
            display: block;
            opacity: 1;
            visibility: visible;
        }
        
        .dropdown-content:not(.open) {
            display: none;
            opacity: 0;
            visibility: hidden;
        }
    `;
    document.head.appendChild(style);
}

// ======================= OVERLAY MANAGEMENT =======================

/**
 * Membuat overlay untuk dropdown (jika belum ada)
 */
function ensureDropdownOverlay() {
    if (document.getElementById('dropdownOverlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'dropdownOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.3);
        z-index: 999;
        display: none;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    overlay.onclick = () => closeAllDropdowns();
    document.body.appendChild(overlay);
}

/**
 * Update overlay visibility
 */
function updateOverlayVisibility() {
    const overlay = document.getElementById('dropdownOverlay');
    if (!overlay) return;
    
    const hasOpenDropdown = document.querySelectorAll('.dropdown-content.open').length > 0;
    if (hasOpenDropdown) {
        overlay.style.display = 'block';
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 10);
    } else {
        overlay.style.opacity = '0';
        setTimeout(() => {
            if (document.querySelectorAll('.dropdown-content.open').length === 0) {
                overlay.style.display = 'none';
            }
        }, 300);
    }
}

// ======================= INISIALISASI =======================

function initDropdownSystem() {
    console.log("📋 Initializing dropdown system...");
    
    // Tambahkan animasi
    addDropdownAnimations();
    
    // Pastikan overlay ada
    ensureDropdownOverlay();
    
    // Setup event listeners
    setupClickOutsideDetection();
    setupDropdownKeyboardListener();
    
    // Inisialisasi semua dropdown
    initAllDropdowns();
    
    // Observer untuk mendeteksi dropdown baru yang ditambahkan secara dinamis
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1 && node.classList && node.classList.contains('dropdown')) {
                    if (node.id) {
                        console.log(`📋 New dropdown detected: ${node.id}`);
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    console.log("✅ Dropdown system initialized");
}

// Override closeModal untuk menutup dropdown juga
const originalCloseModal = window.closeModal;
if (originalCloseModal) {
    window.closeModal = function(modalId) {
        closeAllDropdowns();
        originalCloseModal(modalId);
    };
}

// ======================= EKSPOR KE GLOBAL =======================
window.toggleDropdown = toggleDropdown;
window.openDropdown = openDropdown;
window.closeDropdown = closeDropdown;
window.closeAllDropdowns = closeAllDropdowns;
window.isDropdownOpen = isDropdownOpen;
window.setupHoverDropdown = setupHoverDropdown;
window.setupDropdownToggle = setupDropdownToggle;
window.initDropdownSystem = initDropdownSystem;
window.setupDropdownKeyboardListener = setupDropdownKeyboardListener;

// Auto init saat DOM siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initDropdownSystem, 100);
    });
} else {
    setTimeout(initDropdownSystem, 100);
}

console.log("✅ dropdown.js V2.0 loaded - Enhanced dropdown management with animations");