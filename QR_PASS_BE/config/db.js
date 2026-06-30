const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB_NAME,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4 to avoid TLS issues on Windows with IPv6
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  if (err.message && err.message.includes('buffering timeout')) {
    setTimeout(() => connectDB(), 5000);
  }
});

module.exports = connectDB;