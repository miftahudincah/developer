// ========================================
// ABSENSI MODULE
// ========================================

window.absensi = {
    async doMasuk() {
        const now = new Date();
        const jam = now.getHours();
        const menit = now.getMinutes();
        const statusJam = jam < 9 ? 'Tepat Waktu' : 'Terlambat';
        
        try {
            const data = await API.request('/absensi/masuk', {
                method: 'POST',
                body: JSON.stringify({ lokasi: 'Sekolah', keterangan: 'Hadir' })
            });
            
            if (data.status === 'success') {
                Utils.showStatus('todayAbsenStatus', 
                    `✅ Absen Masuk: ${statusJam} (${jam.toString().padStart(2,'0')}:${menit.toString().padStart(2,'0')})`, 
                    'success');
                window.absensi.loadToday();
                window.absensi.loadRiwayat();
            }
        } catch (error) {
            Utils.showStatus('todayAbsenStatus', `❌ ${error.message}`, 'error');
        }
    },
    
    async doPulang() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const absenData = await API.request('/absensi/all?limit=10');
            const todayAbsen = absenData.data?.find(a => a.tanggal === today && a.userId === currentUser.id);
            
            if (!todayAbsen) {
                Utils.showStatus('todayAbsenStatus', '❌ Belum melakukan absen masuk hari ini', 'error');
                return;
            }
            
            if (todayAbsen.status === 'pulang') {
                Utils.showStatus('todayAbsenStatus', '⚠️ Anda sudah melakukan absen pulang', 'error');
                return;
            }
            
            await API.request(`/absensi/pulang/${todayAbsen.id}`, {
                method: 'PUT',
                body: JSON.stringify({ keterangan: 'Pulang' })
            });
            
            Utils.showStatus('todayAbsenStatus', '✅ Absen Pulang berhasil!', 'success');
            window.absensi.loadToday();
            window.absensi.loadRiwayat();
        } catch (error) {
            Utils.showStatus('todayAbsenStatus', `❌ ${error.message}`, 'error');
        }
    },
    
    async loadToday() {
        const today = new Date().toISOString().split('T')[0];
        try {
            const data = await API.request(`/absensi/date/${today}`);
            const absen = data.data?.find(a => a.userId === currentUser.id);
            
            const statusDiv = document.getElementById('todayAbsenStatus');
            if (absen) {
                statusDiv.innerHTML = `
                    <i class="fas fa-calendar-day"></i> ${today}<br>
                    <i class="fas fa-sign-in-alt"></i> Masuk: ${absen.jam_masuk || '-'}<br>
                    ${absen.jam_pulang ? `<i class="fas fa-sign-out-alt"></i> Pulang: ${absen.jam_pulang}` : '<i class="fas fa-hourglass-half"></i> Belum pulang'}
                `;
                statusDiv.className = 'status info';
            } else {
                statusDiv.innerHTML = '<i class="fas fa-info-circle"></i> Belum melakukan absensi hari ini';
                statusDiv.className = 'status info';
            }
        } catch (error) {
            console.error('Load today absen error:', error);
        }
    },
    
    async loadRiwayat() {
        const container = document.getElementById('riwayatAbsensi');
        if (!container) return;
        
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading riwayat...</div>';
        
        try {
            const data = await API.request(`/absensi/user/${currentUser.id}?limit=20`);
            const riwayat = data.data || [];
            
            if (riwayat.length === 0) {
                container.innerHTML = '<div class="loading">📭 Belum ada riwayat absensi</div>';
                return;
            }
            
            let html = '<div class="gallery">';
            riwayat.forEach(a => {
                html += `
                    <div class="gallery-item">
                        <div class="gallery-item-info">
                            <strong><i class="fas fa-calendar"></i> ${a.tanggal}</strong><br>
                            <i class="fas fa-sign-in-alt"></i> Masuk: ${a.jam_masuk || '-'}<br>
                            ${a.jam_pulang ? `<i class="fas fa-sign-out-alt"></i> Pulang: ${a.jam_pulang}` : '<i class="fas fa-hourglass-half"></i> Belum pulang'}<br>
                            <span class="badge" style="background: ${a.statusJam === 'tepat waktu' ? '#10b981' : '#f59e0b'};">${a.statusJam || 'Normal'}</span>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        } catch (error) {
            container.innerHTML = `<div class="loading">❌ ${error.message}</div>`;
        }
    }
};