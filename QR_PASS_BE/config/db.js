const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error('MongoDB connection error: MONGO_URI environment variable is not defined!');
      return;
    }
    
    // Strip leading/trailing quotes if they were pasted accidentally
    mongoUri = mongoUri.replace(/^["']|["']$/g, '').trim();

    await mongoose.connect(mongoUri, {
      dbName: process.env.DB_NAME ? process.env.DB_NAME.replace(/^["']|["']$/g, '').trim() : undefined,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4 to avoid TLS issues on Windows with IPv6
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // Do not call process.exit(1) on serverless platforms, let mongoose throw/buffer
  }
};

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  if (err.message && err.message.includes('buffering timeout')) {
    setTimeout(() => connectDB(), 5000);
  }
});

module.exports = connectDB;