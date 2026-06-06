// school-name-animation.js - VERSION 7.0 (INTEGRATED WITH VERCEL BACKEND API)
// Animasi nama sekolah dengan LOOPING TYPING EFFECT + perubahan warna berulang
// Fitur:
// - Typing effect berulang (terus menerus)
// - Setelah selesai typing, akan pause sebentar lalu restart typing
// - Warna berubah terus menerus selama animasi berjalan
// - Mendukung perubahan nama sekolah dari API backend dan Firebase
// V7.0: Terintegrasi dengan API backend Vercel
// ============================================================================

// Backend API URL (Vercel)
const BACKEND_API_URL = "https://absensi-backend-3we5.vercel.app/api";

let schoolNameAnimationEnabled = true;
let originalSchoolName = '';
let currentUserRole = '';
let typingInterval = null;
let isTypingActive = false;
let animationRestartDebounceTimer = null;
let isInitialized = false;
let loopTimeout = null;
let currentTypingSpan = null;
let isLoopingEnabled = true;

// Konfigurasi animasi
const TYPING_SPEED = 80;
const PAUSE_BEFORE_RESTART = 2000;
const COLOR_ANIMATION_DURATION = 4000;
const DEBOUNCE_DELAY = 300;

// Cache untuk nama sekolah
let cachedSchoolName = null;
let cachedSchoolNameTimestamp = 0;
const SCHOOL_NAME_CACHE_TTL = 60 * 1000; // 1 menit

// ======================= FUNGSI API BACKEND =======================

function getAuthToken() {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        return firebase.auth().currentUser.getIdToken();
    }
    return Promise.resolve(null);
}

async function apiRequest(endpoint, options = {}) {
    try {
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
    } catch (error) {
        console.warn(`API request failed: ${endpoint}`, error);
        throw error;
    }
}

/**
 * Ambil nama sekolah dari API backend
 */
async function fetchSchoolNameFromAPI() {
    try {
        const now = Date.now();
        if (cachedSchoolName && (now - cachedSchoolNameTimestamp) < SCHOOL_NAME_CACHE_TTL) {
            console.log("📦 Using cached school name");
            return cachedSchoolName;
        }
        
        console.log("🏫 Fetching school name from API...");
        const data = await apiRequest('/config');
        const schoolName = data.data?.school_name || 'Sistem Absensi IoT';
        
        cachedSchoolName = schoolName;
        cachedSchoolNameTimestamp = now;
        return schoolName;
    } catch (error) {
        console.error("Fetch school name from API error:", error);
        return null;
    }
}

/**
 * Update nama sekolah ke API backend
 */
async function updateSchoolNameToAPI(schoolName) {
    const data = await apiRequest('/config', {
        method: 'PUT',
        body: JSON.stringify({ school_name: schoolName })
    });
    return data;
}

// ======================= FUNGSI UTILITY =======================

function clearAllAnimations() {
    if (typingInterval) {
        clearInterval(typingInterval);
        typingInterval = null;
    }
    if (loopTimeout) {
        clearTimeout(loopTimeout);
        loopTimeout = null;
    }
    if (animationRestartDebounceTimer) {
        clearTimeout(animationRestartDebounceTimer);
        animationRestartDebounceTimer = null;
    }
}

function getCurrentSchoolName() {
    const element = document.getElementById('schoolNameDisplay');
    if (!element) return 'Sistem Absensi IoT';
    const text = element.textContent || element.innerText || '';
    return text.trim() || 'Sistem Absensi IoT';
}

function updateOriginalSchoolName() {
    const newText = getCurrentSchoolName();
    if (newText !== originalSchoolName) {
        originalSchoolName = newText;
        console.log('📝 Original school name updated to:', originalSchoolName);
    }
}

// ======================= INJECT CSS STYLES =======================

function injectAnimationStyles() {
    if (document.getElementById('school-name-animation-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'school-name-animation-styles';
    style.textContent = `
        @keyframes schoolNameColorShift {
            0% { color: #ffd700; text-shadow: 0 0 5px rgba(255, 215, 0, 0.5); }
            15% { color: #ffaa00; text-shadow: 0 0 10px rgba(255, 170, 0, 0.6); }
            30% { color: #ff6600; text-shadow: 0 0 15px rgba(255, 102, 0, 0.7); }
            45% { color: #ff3366; text-shadow: 0 0 15px rgba(255, 51, 102, 0.7); }
            60% { color: #9c27b0; text-shadow: 0 0 15px rgba(156, 39, 176, 0.7); }
            75% { color: #00bcd4; text-shadow: 0 0 12px rgba(0, 188, 212, 0.6); }
            100% { color: #2196f3; text-shadow: 0 0 8px rgba(33, 150, 243, 0.5); }
        }

        @keyframes schoolNameColorShiftLight {
            0% { color: #d4a017; }
            15% { color: #e6a800; }
            30% { color: #cc6b00; }
            45% { color: #c2185b; }
            60% { color: #7b1fa2; }
            75% { color: #0097a7; }
            100% { color: #0288d1; }
        }

        @keyframes schoolNameGlow {
            0% { text-shadow: 0 0 5px rgba(255, 215, 0, 0.3); }
            50% { text-shadow: 0 0 20px rgba(0, 188, 212, 0.5), 0 0 8px rgba(255, 215, 0, 0.3); }
            100% { text-shadow: 0 0 5px rgba(33, 150, 243, 0.3); }
        }

        @keyframes schoolNameBounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
        }

        @keyframes blinkCursor {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
        }

        .school-name-typing {
            display: inline-block;
            font-weight: 800;
            letter-spacing: 0.5px;
            white-space: nowrap;
            overflow: hidden;
            border-right: 3px solid var(--primary, #00bcd4);
            animation: blinkCursor 0.8s step-end infinite;
        }

        .school-name-animated {
            display: inline-block;
            font-weight: 800;
            letter-spacing: 0.5px;
            animation: schoolNameColorShift 4s ease-in-out infinite;
            transition: all 0.3s ease;
            white-space: nowrap;
        }

        .school-name-animated:hover {
            animation: schoolNameColorShift 4s ease-in-out infinite, schoolNameBounce 0.5s ease-in-out, schoolNameGlow 1s ease-in-out;
            cursor: pointer;
        }

        body.light-mode .school-name-animated {
            animation: schoolNameColorShiftLight 4s ease-in-out infinite;
        }

        body.light-mode .school-name-animated:hover {
            animation: schoolNameColorShiftLight 4s ease-in-out infinite, schoolNameBounce 0.5s ease-in-out, schoolNameGlow 1s ease-in-out;
        }

        @media (max-width: 768px) {
            .school-name-animated,
            .school-name-typing {
                font-size: 1.2rem;
                animation-duration: 3s;
            }
        }

        .school-name-animated[title]:hover::after,
        .school-name-typing[title]:hover::after {
            content: attr(title);
            position: absolute;
            bottom: -30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 5px 10px;
            border-radius: 8px;
            font-size: 12px;
            white-space: nowrap;
            z-index: 100;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
    console.log('🎨 School name animation styles injected');
}

// ======================= FUNGSI ANIMASI UTAMA =======================

function runTypingEffect(container, text, onComplete) {
    if (!container || !text) {
        if (onComplete) onComplete();
        return;
    }
    
    container.innerHTML = '';
    container.style.opacity = '1';
    
    const typingSpan = document.createElement('span');
    typingSpan.className = 'school-name-typing';
    typingSpan.style.whiteSpace = 'nowrap';
    container.appendChild(typingSpan);
    currentTypingSpan = typingSpan;
    
    let i = 0;
    let currentText = '';
    
    typingInterval = setInterval(function() {
        if (i < text.length) {
            currentText += text.charAt(i);
            typingSpan.textContent = currentText;
            i++;
        } else {
            clearInterval(typingInterval);
            typingInterval = null;
            
            typingSpan.style.borderRight = 'none';
            typingSpan.className = 'school-name-animated';
            typingSpan.setAttribute('title', '✨ Sistem Absensi IoT - HakaTech ✨');
            typingSpan.style.transition = 'all 0.3s ease';
            
            console.log('✨ Typing animation completed for:', text);
            
            if (onComplete) {
                onComplete();
            }
        }
    }, TYPING_SPEED);
}

function startLoopingTyping(container, text) {
    if (!isLoopingEnabled || !schoolNameAnimationEnabled) return;
    
    runTypingEffect(container, text, function() {
        if (isLoopingEnabled && schoolNameAnimationEnabled) {
            loopTimeout = setTimeout(function() {
                const currentText = getCurrentSchoolName();
                if (currentText !== text) {
                    text = currentText;
                    originalSchoolName = text;
                }
                startLoopingTyping(container, text);
            }, PAUSE_BEFORE_RESTART);
        }
    });
}

function stopLoopingTyping() {
    isLoopingEnabled = false;
    if (loopTimeout) {
        clearTimeout(loopTimeout);
        loopTimeout = null;
    }
    if (typingInterval) {
        clearInterval(typingInterval);
        typingInterval = null;
    }
    isTypingActive = false;
}

function restartLoopingTyping() {
    const schoolNameElement = document.getElementById('schoolNameDisplay');
    if (!schoolNameElement) return;
    
    const newText = getCurrentSchoolName();
    originalSchoolName = newText;
    
    if (loopTimeout) {
        clearTimeout(loopTimeout);
        loopTimeout = null;
    }
    if (typingInterval) {
        clearInterval(typingInterval);
        typingInterval = null;
    }
    
    isLoopingEnabled = true;
    startLoopingTyping(schoolNameElement, newText);
    console.log('🔄 Looping typing restarted with text:', newText);
}

// ======================= INISIALISASI DENGAN API =======================

async function initSchoolNameFromAPI() {
    try {
        const apiSchoolName = await fetchSchoolNameFromAPI();
        if (apiSchoolName) {
            const schoolNameElement = document.getElementById('schoolNameDisplay');
            if (schoolNameElement && schoolNameElement.textContent !== apiSchoolName) {
                schoolNameElement.textContent = apiSchoolName;
                originalSchoolName = apiSchoolName;
                console.log('🏫 School name loaded from API:', apiSchoolName);
            }
            return apiSchoolName;
        }
    } catch (error) {
        console.warn('Failed to load school name from API:', error);
    }
    return null;
}

async function initSchoolNameAnimation() {
    const schoolNameElement = document.getElementById('schoolNameDisplay');
    if (!schoolNameElement) {
        console.warn('⚠️ schoolNameDisplay element not found, retrying in 500ms...');
        setTimeout(() => initSchoolNameAnimation(), 500);
        return;
    }
    
    // Coba ambil nama sekolah dari API
    const apiSchoolName = await initSchoolNameFromAPI();
    if (apiSchoolName) {
        schoolNameElement.textContent = apiSchoolName;
    }
    
    clearAllAnimations();
    isLoopingEnabled = true;
    isTypingActive = true;
    
    const fullText = getCurrentSchoolName();
    originalSchoolName = fullText;
    
    schoolNameElement.innerHTML = '';
    schoolNameElement.style.opacity = '1';
    schoolNameElement.style.display = 'inline-block';
    
    if (!schoolNameAnimationEnabled) {
        schoolNameElement.textContent = originalSchoolName;
        schoolNameElement.classList.remove('school-name-animated', 'school-name-typing');
        schoolNameElement.style.animation = 'none';
        console.log('🔇 School name animation disabled');
        return;
    }
    
    startLoopingTyping(schoolNameElement, fullText);
    
    console.log('✨ School name LOOPING typing animation initialized for:', fullText);
}

function restartSchoolNameAnimation() {
    if (animationRestartDebounceTimer) {
        clearTimeout(animationRestartDebounceTimer);
    }
    
    animationRestartDebounceTimer = setTimeout(async () => {
        const schoolNameElement = document.getElementById('schoolNameDisplay');
        if (!schoolNameElement) return;
        
        // Coba ambil nama sekolah terbaru dari API
        const apiSchoolName = await initSchoolNameFromAPI();
        let newText = apiSchoolName || getCurrentSchoolName();
        
        if (newText === originalSchoolName && !apiSchoolName) {
            console.log('📝 Text unchanged, skipping restart');
            return;
        }
        
        originalSchoolName = newText;
        
        stopLoopingTyping();
        
        schoolNameElement.innerHTML = '';
        schoolNameElement.style.opacity = '1';
        
        if (schoolNameAnimationEnabled) {
            isLoopingEnabled = true;
            startLoopingTyping(schoolNameElement, newText);
        } else {
            schoolNameElement.textContent = originalSchoolName;
            schoolNameElement.classList.remove('school-name-animated', 'school-name-typing');
            schoolNameElement.style.animation = 'none';
        }
        
        console.log('✨ School name animation restarted for:', originalSchoolName);
        animationRestartDebounceTimer = null;
    }, DEBOUNCE_DELAY);
}

function forceRestartSchoolNameAnimation() {
    if (animationRestartDebounceTimer) {
        clearTimeout(animationRestartDebounceTimer);
        animationRestartDebounceTimer = null;
    }
    
    const schoolNameElement = document.getElementById('schoolNameDisplay');
    if (!schoolNameElement) return;
    
    const newText = getCurrentSchoolName();
    originalSchoolName = newText;
    
    stopLoopingTyping();
    
    schoolNameElement.innerHTML = '';
    schoolNameElement.style.opacity = '1';
    
    if (schoolNameAnimationEnabled) {
        isLoopingEnabled = true;
        startLoopingTyping(schoolNameElement, newText);
    } else {
        schoolNameElement.textContent = originalSchoolName;
        schoolNameElement.classList.remove('school-name-animated', 'school-name-typing');
    }
    
    console.log('✨ Force restart completed for:', originalSchoolName);
}

function pauseSchoolNameAnimation() {
    const schoolNameElement = document.getElementById('schoolNameDisplay');
    if (!schoolNameElement) return;
    
    stopLoopingTyping();
    
    schoolNameElement.classList.remove('school-name-animated', 'school-name-typing');
    schoolNameElement.style.animation = 'none';
    if (schoolNameElement.firstChild) {
        schoolNameElement.firstChild.style.animation = 'none';
    }
    
    console.log('⏸️ School name animation paused');
}

function resumeSchoolNameAnimation() {
    const schoolNameElement = document.getElementById('schoolNameDisplay');
    if (!schoolNameElement) return;
    if (!schoolNameAnimationEnabled) return;
    
    const hasTypingClass = schoolNameElement.querySelector('.school-name-typing');
    const hasAnimatedClass = schoolNameElement.querySelector('.school-name-animated');
    
    if (!hasTypingClass && !hasAnimatedClass) {
        forceRestartSchoolNameAnimation();
    } else if (hasTypingClass && !isTypingActive) {
        forceRestartSchoolNameAnimation();
    } else if (hasAnimatedClass) {
        const animatedSpan = schoolNameElement.querySelector('.school-name-animated');
        animatedSpan.style.animation = '';
    }
    
    console.log('▶️ School name animation resumed');
}

function disableSchoolNameAnimation() {
    schoolNameAnimationEnabled = false;
    isLoopingEnabled = false;
    const schoolNameElement = document.getElementById('schoolNameDisplay');
    if (!schoolNameElement) return;
    
    stopLoopingTyping();
    
    const currentText = originalSchoolName;
    schoolNameElement.innerHTML = '';
    schoolNameElement.textContent = currentText;
    schoolNameElement.classList.remove('school-name-animated', 'school-name-typing');
    schoolNameElement.style.animation = 'none';
    
    console.log('🔇 School name animation disabled');
}

function enableSchoolNameAnimation() {
    if (schoolNameAnimationEnabled) return;
    
    schoolNameAnimationEnabled = true;
    isLoopingEnabled = true;
    const schoolNameElement = document.getElementById('schoolNameDisplay');
    if (!schoolNameElement) return;
    
    forceRestartSchoolNameAnimation();
    
    console.log('🔊 School name animation enabled');
}

// ======================= OBSERVER DAN LISTENER =======================

function setupSchoolNameObserver() {
    const schoolNameElement = document.getElementById('schoolNameDisplay');
    if (!schoolNameElement) {
        setTimeout(() => setupSchoolNameObserver(), 500);
        return;
    }
    
    if (window._schoolNameObserver) {
        window._schoolNameObserver.disconnect();
    }
    
    const observer = new MutationObserver((mutations) => {
        let textChanged = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                    textChanged = true;
                }
            } else if (mutation.type === 'characterData') {
                textChanged = true;
            }
        });
        
        if (textChanged && !isTypingActive) {
            const newText = schoolNameElement.textContent || schoolNameElement.innerText || '';
            if (newText && newText !== originalSchoolName) {
                console.log('📝 School name changed via DOM, restarting animation');
                originalSchoolName = newText;
                restartSchoolNameAnimation();
            }
        }
    });
    
    observer.observe(schoolNameElement, {
        childList: true,
        characterData: true,
        subtree: true,
        characterDataOldValue: true
    });
    
    window._schoolNameObserver = observer;
    console.log('👁️ School name observer set up');
}

function setupSchoolNameFirebaseListener() {
    if (typeof db === 'undefined' || !db) {
        console.warn('⚠️ Firebase not available, skipping realtime listener');
        setTimeout(() => setupSchoolNameFirebaseListener(), 1000);
        return;
    }
    
    if (window._schoolNameFirebaseListener) {
        db.ref('system_config/schoolName').off('value', window._schoolNameFirebaseListener);
    }
    
    window._schoolNameFirebaseListener = (snapshot) => {
        const newName = snapshot.val();
        if (newName && newName !== originalSchoolName) {
            console.log('📡 School name changed from Firebase:', newName);
            originalSchoolName = newName;
            // Invalidate cache
            cachedSchoolName = null;
            
            const schoolNameElement = document.getElementById('schoolNameDisplay');
            if (schoolNameElement) {
                if (typingInterval) {
                    clearInterval(typingInterval);
                    typingInterval = null;
                }
                if (loopTimeout) {
                    clearTimeout(loopTimeout);
                    loopTimeout = null;
                }
                schoolNameElement.innerHTML = '';
                
                if (schoolNameAnimationEnabled) {
                    isLoopingEnabled = true;
                    startLoopingTyping(schoolNameElement, newName);
                } else {
                    schoolNameElement.textContent = newName;
                }
            }
        }
    };
    
    db.ref('system_config/schoolName').on('value', window._schoolNameFirebaseListener);
    console.log('📡 Firebase school name listener set up');
}

function setupThemeChangeListener() {
    const themeObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                const schoolNameElement = document.getElementById('schoolNameDisplay');
                const animatedSpan = schoolNameElement?.querySelector('.school-name-animated');
                if (animatedSpan) {
                    animatedSpan.style.animation = 'none';
                    setTimeout(() => {
                        animatedSpan.style.animation = '';
                    }, 50);
                }
                console.log('🎨 Theme changed, animation refreshed');
            }
        });
    });
    
    themeObserver.observe(document.body, { attributes: true });
    console.log('🎨 Theme change listener set up');
}

function setupDashboardTabListener() {
    const originalSwitchTab = window.switchTab;
    if (originalSwitchTab && typeof originalSwitchTab === 'function') {
        window.switchTab = function(tabId) {
            originalSwitchTab(tabId);
            if (tabId === 'dashboard') {
                setTimeout(() => {
                    const schoolNameElement = document.getElementById('schoolNameDisplay');
                    if (schoolNameElement) {
                        const hasTypingClass = schoolNameElement.querySelector('.school-name-typing');
                        const hasAnimatedClass = schoolNameElement.querySelector('.school-name-animated');
                        if (!hasTypingClass && !hasAnimatedClass && schoolNameAnimationEnabled) {
                            console.log('📺 Dashboard tab activated, restarting animation');
                            forceRestartSchoolNameAnimation();
                        }
                    }
                }, 200);
            }
        };
    }
}

function setupPeriodicAnimationCheck() {
    setInterval(() => {
        const schoolNameElement = document.getElementById('schoolNameDisplay');
        if (!schoolNameElement) return;
        
        const hasTypingClass = schoolNameElement.querySelector('.school-name-typing');
        const hasAnimatedClass = schoolNameElement.querySelector('.school-name-animated');
        const isEmpty = schoolNameElement.innerHTML === '' || schoolNameElement.textContent === '';
        
        if ((isEmpty || (!hasTypingClass && !hasAnimatedClass)) && schoolNameAnimationEnabled && !isTypingActive) {
            console.log('🔄 Periodic check: animation missing, restarting');
            forceRestartSchoolNameAnimation();
        }
        
        if (hasAnimatedClass && hasAnimatedClass.style.animation === 'none') {
            hasAnimatedClass.style.animation = '';
        }
    }, 15000);
    console.log('🔄 Periodic animation check set up (every 15 seconds)');
}

// ======================= INISIALISASI LENGKAP =======================

async function initFullSchoolNameAnimation() {
    if (isInitialized) {
        console.log('⚠️ School name animation already initialized');
        return;
    }
    
    console.log('🚀 Initializing full school name animation system with API integration...');
    
    const init = async () => {
        injectAnimationStyles();
        
        // Coba ambil nama sekolah dari API
        const apiSchoolName = await initSchoolNameFromAPI();
        
        setupSchoolNameObserver();
        setupSchoolNameFirebaseListener();
        setupThemeChangeListener();
        setupDashboardTabListener();
        setupPeriodicAnimationCheck();
        
        await initSchoolNameAnimation();
        isInitialized = true;
        console.log('✅ Full school name animation system initialized with API integration!');
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(init, 300);
        });
    } else {
        setTimeout(init, 300);
    }
}

function resetSchoolNameAnimationSystem() {
    console.log('🔄 Resetting school name animation system...');
    
    if (window._schoolNameObserver) {
        window._schoolNameObserver.disconnect();
        window._schoolNameObserver = null;
    }
    
    if (window._schoolNameFirebaseListener && typeof db !== 'undefined' && db) {
        db.ref('system_config/schoolName').off('value', window._schoolNameFirebaseListener);
        window._schoolNameFirebaseListener = null;
    }
    
    clearAllAnimations();
    stopLoopingTyping();
    isTypingActive = false;
    isInitialized = false;
    isLoopingEnabled = true;
    cachedSchoolName = null;
    cachedSchoolNameTimestamp = 0;
    
    setTimeout(() => {
        initFullSchoolNameAnimation();
    }, 100);
}

function refreshLoopingTyping() {
    const schoolNameElement = document.getElementById('schoolNameDisplay');
    if (!schoolNameElement) return;
    
    const newText = getCurrentSchoolName();
    if (newText !== originalSchoolName) {
        originalSchoolName = newText;
    }
    
    stopLoopingTyping();
    isLoopingEnabled = true;
    startLoopingTyping(schoolNameElement, originalSchoolName);
    console.log('🔄 Looping typing refreshed');
}

// ======================= EKSPOR KE GLOBAL =======================

window.initSchoolNameAnimation = initSchoolNameAnimation;
window.restartSchoolNameAnimation = restartSchoolNameAnimation;
window.forceRestartSchoolNameAnimation = forceRestartSchoolNameAnimation;
window.pauseSchoolNameAnimation = pauseSchoolNameAnimation;
window.resumeSchoolNameAnimation = resumeSchoolNameAnimation;
window.disableSchoolNameAnimation = disableSchoolNameAnimation;
window.enableSchoolNameAnimation = enableSchoolNameAnimation;
window.resetSchoolNameAnimationSystem = resetSchoolNameAnimationSystem;
window.refreshLoopingTyping = refreshLoopingTyping;
window.stopLoopingTyping = stopLoopingTyping;
window.fetchSchoolNameFromAPI = fetchSchoolNameFromAPI;
window.updateSchoolNameToAPI = updateSchoolNameToAPI;

// Auto initialize
initFullSchoolNameAnimation();

console.log("✅ school-name-animation.js V7.0 loaded - Terintegrasi dengan API Backend Vercel! LOOPING TYPING + Looping color change animation ready!");