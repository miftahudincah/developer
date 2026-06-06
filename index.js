// backend/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./api/auth');
const studentsRoutes = require('./api/students');
const attendanceRoutes = require('./api/attendance');
const usersRoutes = require('./api/users');
const announcementsRoutes = require('./api/announcement'); // Menggunakan announcement.js (tanpa 's')
const izinRoutes = require('./api/izin');
const staffRoutes = require('./api/staff');
const logsRoutes = require('./api/logs');
const configRoutes = require('./api/config');

const app = express();

// Environment check (untuk debugging)
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

console.log(`🚀 Starting server...`);
console.log(`📦 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`☁️ Platform: ${isVercel ? 'Vercel Serverless' : 'Local Server'}`);
console.log(`📁 Firebase Project: ${process.env.FIREBASE_PROJECT_ID || 'Not Set'}`);

// ========================
// SECURITY MIDDLEWARE
// ========================

// Helmet untuk security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Diperlukan untuk akses dari frontend
}));

// CORS configuration
const allowedOrigins = [
  'https://absensi-4389a.web.app',
  'https://absensi-4389a.firebaseapp.com',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080',
  'https://absensi-backend-3we5.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Izinkan request tanpa origin (seperti mobile apps atau curl)
    if (!origin) return callback(null, true);
    
    // Di development, izinkan semua origin
    if (!isProduction) {
      return callback(null, true);
    }
    
    // Di production, cek whitelist
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Body parser dengan limit lebih besar untuk upload
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========================
// RATE LIMITING
// ========================

// Rate limiter umum untuk semua API
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 200, // maksimal 200 request per windowMs
  message: { 
    success: false, 
    error: 'Terlalu banyak request, silakan coba lagi setelah 15 menit' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

// Rate limiter ketat untuk endpoint authentication
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 20, // maksimal 20 attempt per jam
  message: { 
    success: false, 
    error: 'Terlalu banyak percobaan login, silakan coba lagi setelah 1 jam' 
  },
  skipSuccessfulRequests: true
});

// Rate limiter untuk operasi write (POST, PUT, DELETE)
const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 100,
  message: { 
    success: false, 
    error: 'Terlalu banyak operasi write, silakan coba lagi nanti' 
  }
});

// Apply rate limiters
app.use('/api/', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/students', writeLimiter);
app.use('/api/attendance', writeLimiter);

// ========================
// REQUEST LOGGING (Development only)
// ========================

if (!isProduction) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    next();
  });
}

// ========================
// API ROUTES
// ========================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: isProduction ? 'production' : 'development',
    platform: isVercel ? 'vercel' : 'local',
    version: '1.0.0'
  });
});

// Root endpoint untuk verifikasi
app.get('/', (req, res) => {
  res.json({
    name: 'Absensi API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      students: '/api/students',
      attendance: '/api/attendance',
      announcements: '/api/announcements',
      izin: '/api/izin',
      staff: '/api/staff',
      logs: '/api/logs',
      config: '/api/config'
    }
  });
});

// Route handlers
app.use('/api/auth', authRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/announcements', announcementsRoutes); // Ini akan memanggil announcement.js
app.use('/api/izin', izinRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/config', configRoutes);

// ========================
// DEBUG ENDPOINTS (Development only)
// ========================

if (!isProduction) {
  app.get('/api/debug/env', (req, res) => {
    res.json({
      nodeEnv: process.env.NODE_ENV,
      isVercel: isVercel,
      firebaseConfig: {
        projectId: process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL ? '✅ Set' : '❌ Missing',
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? '✅ Set' : '❌ Missing'
      },
      allowedOrigins: allowedOrigins,
      timestamp: new Date().toISOString()
    });
  });
  
  app.get('/api/debug/routes', (req, res) => {
    const routes = [];
    app._router.stack.forEach(middleware => {
      if (middleware.route) {
        routes.push({
          path: middleware.route.path,
          methods: Object.keys(middleware.route.methods)
        });
      } else if (middleware.name === 'router') {
        middleware.handle.stack.forEach(handler => {
          if (handler.route) {
            routes.push({
              path: handler.route.path,
              methods: Object.keys(handler.route.methods)
            });
          }
        });
      }
    });
    res.json({ routes });
  });
}

// ========================
// ERROR HANDLING
// ========================

// 404 handler untuk endpoint yang tidak ditemukan
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint tidak ditemukan',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      '/api/health',
      '/api/auth',
      '/api/students',
      '/api/attendance',
      '/api/announcements',
      '/api/izin',
      '/api/staff',
      '/api/logs',
      '/api/config'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', {
    message: err.message,
    stack: isProduction ? undefined : err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  // Handle CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      success: false, 
      error: 'CORS error: Origin not allowed',
      origin: req.headers.origin
    });
  }
  
  // Handle rate limit error
  if (err.statusCode === 429 || err.message === 'Too many requests') {
    return res.status(429).json({ 
      success: false, 
      error: 'Too many requests, please try again later' 
    });
  }
  
  // Handle JSON parsing error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid JSON format' 
    });
  }
  
  // Default error response
  res.status(500).json({ 
    success: false, 
    error: isProduction 
      ? 'Terjadi kesalahan pada server. Silakan coba lagi nanti.' 
      : err.message 
  });
});

// ========================
// GRACEFUL SHUTDOWN
// ========================

const gracefulShutdown = (signal) => {
  console.log(`${signal} received, closing server gracefully...`);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ========================
// SERVER START
// ========================

// Untuk Vercel serverless
if (isVercel) {
  console.log('✅ Ready on Vercel Serverless');
  module.exports = app;
} 
// Untuk local development
else {
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`\n✨ Server is running!`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`❤️ Health: http://localhost:${PORT}/api/health`);
    console.log(`📋 Environment: ${isProduction ? 'production' : 'development'}`);
    console.log(`\n📚 Available API Endpoints:`);
    console.log(`   POST   /api/auth/login`);
    console.log(`   POST   /api/auth/register`);
    console.log(`   GET    /api/students`);
    console.log(`   GET    /api/attendance`);
    console.log(`   GET    /api/announcements`);
    console.log(`   GET    /api/izin`);
    console.log(`   GET    /api/staff`);
    console.log(`   GET    /api/logs (admin only)`);
    console.log(`   GET    /api/config`);
    console.log(`\n🚀 Ready to accept requests!\n`);
  });
  
  module.exports = { app, server };
}