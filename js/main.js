// ========================================
// MAIN APPLICATION
// ========================================

// Initialize dark mode
DarkMode.init();

// Tab navigation
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', function() {
        const tabName = this.getAttribute('data-tab');
        
        // Update active tab
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        // Show tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const activeTab = document.getElementById(`${tabName}Tab`);
        if (activeTab) activeTab.classList.add('active');
        
        // Load data if needed
        if (tabName === 'users' && window.admin) {
            window.admin.loadUsers();
        }
        if (tabName === 'gallery' && window.gallery) {
            window.gallery.load();
        }
    });
});

// Check saved login
function checkSavedLogin() {
    if (authToken && currentUser && currentUser.id) {
        const loginCard = document.getElementById('loginCard');
        const mainApp = document.getElementById('mainApp');
        
        if (loginCard) loginCard.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        
        if (currentUser.role === 'admin' || currentUser.role === 'developer') {
            const adminBtn = document.getElementById('adminTabBtn');
            if (adminBtn) adminBtn.style.display = 'flex';
        }
        
        // Load all data
        if (window.profile) window.profile.load();
        if (window.absensi) {
            window.absensi.loadToday();
            window.absensi.loadRiwayat();
        }
        if (window.gallery) window.gallery.load();
    }
}

// Close modals on outside click
window.onclick = function(e) {
    if (e.target.classList && e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
};

// Start application
checkSavedLogin();