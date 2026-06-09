// ========================================
// PROFILE MODULE
// ========================================

window.profile = {
    async load() {
        try {
            const data = await API.request('/auth/me');
            if (data.status === 'success') {
                currentUser = data.data;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                
                const nameEl = document.getElementById('profileName');
                const emailEl = document.getElementById('profileEmail');
                const roleEl = document.getElementById('profileRole');
                const photoEl = document.getElementById('profilePhoto');
                
                if (nameEl) nameEl.textContent = currentUser.nama;
                if (emailEl) emailEl.textContent = currentUser.email;
                if (roleEl) roleEl.textContent = `Role: ${Utils.formatRole(currentUser.role)}`;
                
                const photoUrl = Utils.getAvatarUrl(currentUser.nama, currentUser.photoURL);
                if (photoEl) photoEl.src = photoUrl;
            }
        } catch (error) {
            console.error('Load profile error:', error);
        }
    },
    
    previewPhoto(input) {
        Utils.previewImage(input, 'profilePhotoPreview');
    },
    
    async updatePhoto() {
        const file = document.getElementById('profilePhotoInput').files[0];
        const validation = Utils.validateFile(file);
        
        if (!validation.valid) {
            Utils.showStatus('profilePhotoStatus', validation.message, 'error');
            return;
        }
        
        const btn = document.getElementById('updatePhotoBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        
        try {
            const base64 = await Utils.fileToBase64(file);
            const uploadResult = await API.uploadImage(base64, 'profile_photo');
            
            if (uploadResult.status === 'success') {
                const photoURL = uploadResult.data.url;
                
                await API.request('/api/users/update-photo', {
                    method: 'POST',
                    body: JSON.stringify({ photoURL })
                });
                
                Utils.showStatus('profilePhotoStatus', '✅ Foto profil berhasil diupdate!', 'success');
                window.profile.load();
                
                const fileInput = document.getElementById('profilePhotoInput');
                const preview = document.getElementById('profilePhotoPreview');
                if (fileInput) fileInput.value = '';
                if (preview) preview.innerHTML = '';
            }
        } catch (error) {
            Utils.showStatus('profilePhotoStatus', `❌ ${error.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-upload"></i> Upload Foto Profil';
        }
    },
    
    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            Utils.showStatus('passwordStatus', 'Semua field wajib diisi', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            Utils.showStatus('passwordStatus', 'Password baru tidak cocok', 'error');
            return;
        }
        
        if (newPassword.length < 6) {
            Utils.showStatus('passwordStatus', 'Password minimal 6 karakter', 'error');
            return;
        }
        
        try {
            await API.request('/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword: confirmPassword })
            });
            
            Utils.showStatus('passwordStatus', '✅ Password berhasil diubah!', 'success');
            
            const currPass = document.getElementById('currentPassword');
            const newPass = document.getElementById('newPassword');
            const confPass = document.getElementById('confirmPassword');
            if (currPass) currPass.value = '';
            if (newPass) newPass.value = '';
            if (confPass) confPass.value = '';
        } catch (error) {
            Utils.showStatus('passwordStatus', `❌ ${error.message}`, 'error');
        }
    },
    
    showEditModal() {
        const nameEl = document.getElementById('editName');
        const hpEl = document.getElementById('editNoHp');
        const alamatEl = document.getElementById('editAlamat');
        
        if (nameEl) nameEl.value = currentUser.nama || '';
        if (hpEl) hpEl.value = currentUser.noHp || '';
        if (alamatEl) alamatEl.value = currentUser.alamat || '';
        
        const modal = document.getElementById('editProfileModal');
        if (modal) modal.style.display = 'flex';
    },
    
    closeEditModal() {
        const modal = document.getElementById('editProfileModal');
        if (modal) modal.style.display = 'none';
    },
    
    async update() {
        const name = document.getElementById('editName').value;
        const noHp = document.getElementById('editNoHp').value;
        const alamat = document.getElementById('editAlamat').value;
        
        try {
            await API.request(`/admin/users/${currentUser.id}`, {
                method: 'PUT',
                body: JSON.stringify({ nama: name, noHp, alamat })
            });
            
            Utils.showStatus('editProfileStatus', '✅ Profil berhasil diupdate!', 'success');
            window.profile.closeEditModal();
            window.profile.load();
        } catch (error) {
            Utils.showStatus('editProfileStatus', `❌ ${error.message}`, 'error');
        }
    }
};