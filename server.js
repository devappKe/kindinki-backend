const path = require('path');
const fs = require('fs');

// Load environment variables from .env file if it exists (useful for local development)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan'); 
const connectDB = require('./config/db');

// 1. Pre-flight Check
if (!process.env.MONGO_URI) {
  console.error('❌ FATAL ERROR: MONGO_URI is not defined in process environment or .env file.');
  console.error('Please ensure MONGO_URI is set in your Render dashboard environment variables.');
  process.exit(1);
}

// Initialize App
const app = express();

// 2. Connect to Database 
connectDB();

// 3. Global Middleware
app.use(helmet()); 
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://kindinki-frontend.onrender.com' 
    : 'http://localhost:5173',
  credentials: true
})); 
app.use(express.json({ limit: '10kb' })); 
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); 
}

// 4. Rate Limiting (Protects those 8-digit keys and recovery attempts) [cite: 2026-01-10]
const securityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { 
    status: 'error', 
    message: "Too many attempts. Security lock active for 15 minutes." 
  }
});
// Apply limiter to auth AND recovery AND sensitive account actions
app.use('/api/auth', securityLimiter);
app.use('/api/recovery', securityLimiter);

// 5. Define Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/invites', require('./routes/inviteRoutes'));
app.use('/api/recovery', require('./routes/recoveryRoutes'));
// ADDED: User routes for Profile and Merit Score (Angel/Devil logic) [cite: 2026-01-10]
app.use('/api/users', require('./routes/userRoutes'));

// NEW: Hybrid Sync Architecture Routes
app.use('/api/merit', require('./routes/meritRoutes'));
app.use('/api/storage', require('./routes/storageRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/parental', require('./routes/parentalRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));

// Basic Health Check
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'success', 
    message: 'KINDINKI API is running...',
    version: '1.0.0'
  });
});

// 6. 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    status: 'fail', 
    message: `Can't find ${req.originalUrl} on this server.` 
  });
});

// 7. Global Error Handling
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
  🚀 KINDINKI Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}
  -------------------------------------------------------
  Standard Auth:    http://localhost:${PORT}/api/auth
  Invite System:    http://localhost:${PORT}/api/invites
  User Profiles:    http://localhost:${PORT}/api/users
  Secure Recovery:  http://localhost:${PORT}/api/recovery
  -------------------------------------------------------
  🔄 HYBRID SYNC ARCHITECTURE
  Merit System:     http://localhost:${PORT}/api/merit
  Storage Sharing:  http://localhost:${PORT}/api/storage
  Payments:         http://localhost:${PORT}/api/payments
  Parental Controls:http://localhost:${PORT}/api/parental
  Webhooks:         http://localhost:${PORT}/api/webhooks
  -------------------------------------------------------
  `);
});

// 8. Handle Uncaught Exceptions
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

// 9. Handle Unhandled Promise Rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});