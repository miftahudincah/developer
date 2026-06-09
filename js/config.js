// ========================================
// CONFIGURATION
// ========================================

const CONFIG = {
    API_BASE: 'https://backend9.vercel.app',
    MAX_FILE_SIZE: 4.5 * 1024 * 1024,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/jpg', 'image/gif']
};

// Global variables
let authToken = localStorage.getItem('authToken') || null;
let currentUser = null;

try {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser && savedUser !== 'null') {
        currentUser = JSON.parse(savedUser);
    }
} catch (e) {
    console.error('Error parsing currentUser:', e);
    currentUser = null;
}

let allUsers = [];