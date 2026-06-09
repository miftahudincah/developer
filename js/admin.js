// ========================================
// ADMIN MODULE
// ========================================

window.admin = {
    async loadUsers() {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading users...</td></tr>';
        
        try {
            const data = await API.request('/admin/users');
            allUsers = data.data || [];
            
            if (allUsers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="loading">Tidak ada user</td></tr>';
                return;
            }
            
            let html = '';
            allUsers.forEach(user => {
                const roleClass = Utils.getRoleClass(user.role);
                const photoUrl = Utils.getAvatarUrl(user.nama, user.photoURL);
                const statusText = user.isActive !== false ? 'Aktif' : 'Nonaktif';
                const statusColor = user.isActive !== false ? '#10b981' : '#ef4444';
                
                html += `
                    <tr>
                        <td><img src="${photoUrl}" class="user-avatar" onerror="this.src='https://ui-avatars.com/api/?background=667eea&color=fff&name=${encodeURIComponent(user.nama)}'"></td>
                        <td>${Utils.escapeHtml(user.nama)}</td>
                        <td>${Utils.escapeHtml(user.email)}</td>
                        <td><span class="role-badge ${roleClass}">${Utils.formatRole(user.role)}</span></td>
                        <td style="color: ${statusColor};">${statusText}</td>
                        <td>
                            <button class="btn-secondary btn-sm" onclick="window.admin.openEditUserModal('${user.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn-danger btn-sm" onclick="window.admin.deleteUser('${user.id}')">
                                <i class="fas fa-trash"></i> Hapus
                            </button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="6" class="loading">❌ ${error.message}</td></tr>`;
        }
    },
    
    openEditUserModal(userId) {
        const user = allUsers.find(u => u.id === userId);
        if (user) {
            document.getElementById('editUserId').value = user.id;
            document.getElementById('editUserName').value = user.nama;
            document.getElementById('editUserEmail').value = user.email;
            document.getElementById('editUserRole').value = user.role;
            document.getElementById('editUserStatus').value = user.isActive !== false ? 'true' : 'false';
            document.getElementById('editUserModal').style.display = 'flex';
        }
    },
    
    closeEditUserModal() {
        document.getElementById('editUserModal').style.display = 'none';
        document.getElementById('editUserStatusMsg').className = 'status';
    },
    
    async updateUser() {
        const userId = document.getElementById('editUserId').value;
        const nama = document.getElementById('editUserName').value;
        const role = document.getElementById('editUserRole').value;
        const isActive = document.getElementById('editUserStatus').value === 'true';
        
        try {
            await API.request(`/admin/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ nama, role, isActive })
            });
            
            Utils.showStatus('editUserStatusMsg', '✅ User berhasil diupdate!', 'success');
            setTimeout(() => {
                window.admin.closeEditUserModal();
                window.admin.loadUsers();
            }, 1000);
        } catch (error) {
            Utils.showStatus('editUserStatusMsg', `❌ ${error.message}`, 'error');
        }
    },
    
    async deleteUser(userId) {
        if (!confirm('Yakin ingin menghapus user ini? Semua data absensi akan terhapus!')) return;
        
        try {
            await API.request(`/admin/users/${userId}`, { method: 'DELETE' });
            window.admin.loadUsers();
            Utils.showStatus('editUserStatusMsg', '✅ User berhasil dihapus!', 'success');
        } catch (error) {
            alert(error.message);
        }
    },
    
    showAddUserModal() {
        document.getElementById('addUserModal').style.display = 'flex';
    },
    
    closeAddUserModal() {
        document.getElementById('addUserModal').style.display = 'none';
        document.getElementById('addUserStatus').className = 'status';
        document.getElementById('addUserName').value = '';
        document.getElementById('addUserEmail').value = '';
        document.getElementById('addUserPassword').value = '';
    },
    
    async addUser() {
        const name = document.getElementById('addUserName').value;
        const email = document.getElementById('addUserEmail').value;
        const password = document.getElementById('addUserPassword').value;
        const role = document.getElementById('addUserRole').value;
        
        if (!name || !email || !password) {
            Utils.showStatus('addUserStatus', 'Semua field wajib diisi', 'error');
            return;
        }
        
        if (password.length < 6) {
            Utils.showStatus('addUserStatus', 'Password minimal 6 karakter', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nama: name, email, password, role })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                Utils.showStatus('addUserStatus', '✅ User berhasil ditambahkan!', 'success');
                setTimeout(() => {
                    window.admin.closeAddUserModal();
                    window.admin.loadUsers();
                }, 1500);
            } else {
                Utils.showStatus('addUserStatus', data.message, 'error');
            }
        } catch (error) {
            Utils.showStatus('addUserStatus', `❌ ${error.message}`, 'error');
        }
    }
};