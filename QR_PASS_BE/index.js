const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectDB = require('./config/db');
const mongoose = require('mongoose');
require('dotenv').config();

const Admin = require('./models/Admin'); // 1. IMPORT YOUR ADMIN MODEL HERE (Adjust path if needed)

const app = express();

// Connect to database
connectDB();

// ====================================================
// 🚀 STEP 2 BOOTSTRAP: AUTO-CREATE ADMIN ON STARTUP
// ====================================================
mongoose.connection.once('open', async () => {
  console.log('MongoDB connection established. Checking default admin...');
  try {
    // Check if the admin already exists
    const adminExists = await Admin.findOne({ username: 'admin12345' });
    
    if (!adminExists) {
      const defaultAdmin = new Admin({
        adminId: 'ADM-ERNZ-001',
        username: 'admin12345',
        password: '1234567890' // Raw password: Mongoose pre-save hook handles encryption!
      });
      await defaultAdmin.save();
      console.log('🚀 Default admin created safely via Mongoose hook.');
    } else {
      console.log('✅ Admin "ernzmabangis" already exists in the database.');
    }
  } catch (error) {
    console.error('❌ Error creating default admin:', error);
  }
});
// ====================================================

// =============================
//         CORS WHITELIST
// =============================
const whitelist = [
  'https://techkadaqr.vercel.app',
  'https://techkadaqr.vercel.app/userPage.html',
  'https://techkadaqr.vercel.app/adminPage.html',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
];

const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

app.use(cors(corsOptions));
// =============================

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/api/admin', require('./routes/AdminRoutes'));
app.use('/api/attendance', require('./routes/AttendanceRoutes'));
app.use('/api/courses', require('./routes/CourseRoutes'));
app.use('/api', require('./routes/StudentRoutes'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = app;