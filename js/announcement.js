// backend/api/announcement.js
const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase');
const { verifyToken, requireGuru, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/announcements - Dapatkan semua pengumuman
 * Query: limit (opsional, default 50)
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    // Ambil pengumuman terbaru dengan limit
    const snapshot = await db.ref('announcements')
      .orderByChild('createdAt')
      .limitToLast(parseInt(limit))
      .once('value');
    
    const data = snapshot.val();
    let list = [];
    
    if (data) {
      list = Object.keys(data).map(key => ({ 
        id: key, 
        ...data[key],
        createdAtFormatted: data[key].createdAt ? new Date(data[key].createdAt).toLocaleDateString('id-ID') : null
      }));
      // Urutkan dari terbaru ke terlama
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    
    res.json({ 
      success: true, 
      data: list,
      total: list.length
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/announcements/:id - Dapatkan detail pengumuman
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = await db.ref(`announcements/${id}`).once('value');
    const data = snapshot.val();
    
    if (!data) {
      return res.status(404).json({ success: false, error: 'Pengumuman tidak ditemukan' });
    }
    
    res.json({ 
      success: true, 
      data: {
        id,
        ...data,
        createdAtFormatted: data.createdAt ? new Date(data.createdAt).toLocaleDateString('id-ID') : null
      }
    });
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/announcements - Tambah pengumuman baru (hanya guru+)
 * Body: { title, content, isPinned }
 */
router.post('/', verifyToken, requireGuru, async (req, res) => {
  try {
    const { title, content, isPinned = false } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Judul pengumuman wajib diisi' });
    }
    
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Isi pengumuman wajib diisi' });
    }
    
    const newRef = db.ref('announcements').push();
    const announcementData = {
      title: title.trim(),
      content: content.trim(),
      createdBy: req.user.email,
      createdByName: req.user.nama || req.user.email,
      createdAt: admin.database.ServerValue.TIMESTAMP,
      isPinned: isPinned,
      updatedAt: null
    };
    
    await newRef.set(announcementData);
    
    // Log aktivitas
    await db.ref('logs').push({
      action: 'create_announcement',
      userId: req.user.uid,
      userName: req.user.email,
      userRole: req.user.role,
      details: `Membuat pengumuman: ${title}`,
      timestamp: admin.database.ServerValue.TIMESTAMP,
      ipAddress: req.ip || req.connection.remoteAddress
    });
    
    res.json({ 
      success: true, 
      message: 'Pengumuman berhasil ditambahkan',
      data: { id: newRef.key, ...announcementData }
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/announcements/:id - Update pengumuman (hanya guru+)
 * Body: { title, content, isPinned }
 */
router.put('/:id', verifyToken, requireGuru, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, isPinned } = req.body;
    
    // Cek apakah pengumuman ada
    const snapshot = await db.ref(`announcements/${id}`).once('value');
    const existing = snapshot.val();
    
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Pengumuman tidak ditemukan' });
    }
    
    const updateData = {};
    if (title && title.trim()) updateData.title = title.trim();
    if (content && content.trim()) updateData.content = content.trim();
    if (isPinned !== undefined) updateData.isPinned = isPinned;
    updateData.updatedAt = admin.database.ServerValue.TIMESTAMP;
    updateData.updatedBy = req.user.email;
    
    await db.ref(`announcements/${id}`).update(updateData);
    
    // Log aktivitas
    await db.ref('logs').push({
      action: 'update_announcement',
      userId: req.user.uid,
      userName: req.user.email,
      userRole: req.user.role,
      details: `Mengupdate pengumuman: ${existing.title}`,
      timestamp: admin.database.ServerValue.TIMESTAMP,
      ipAddress: req.ip || req.connection.remoteAddress
    });
    
    res.json({ 
      success: true, 
      message: 'Pengumuman berhasil diupdate'
    });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/announcements/:id - Hapus pengumuman (hanya admin+)
 */
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Cek apakah pengumuman ada
    const snapshot = await db.ref(`announcements/${id}`).once('value');
    const existing = snapshot.val();
    
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Pengumuman tidak ditemukan' });
    }
    
    await db.ref(`announcements/${id}`).remove();
    
    // Log aktivitas
    await db.ref('logs').push({
      action: 'delete_announcement',
      userId: req.user.uid,
      userName: req.user.email,
      userRole: req.user.role,
      details: `Menghapus pengumuman: ${existing.title}`,
      timestamp: admin.database.ServerValue.TIMESTAMP,
      ipAddress: req.ip || req.connection.remoteAddress
    });
    
    res.json({ 
      success: true, 
      message: 'Pengumuman berhasil dihapus'
    });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;