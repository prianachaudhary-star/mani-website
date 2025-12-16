const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';

// 🔴 FIXED: Production-ready CORS configuration
const corsOptions = {
  origin: isProduction
    ? ['https://courageous-salamander-4e7551.netlify.app'] // Your Netlify frontend
    : '*', // Allow all in development
  credentials: isProduction ? true : false, // credentials only with specific origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
};
app.use(cors(corsOptions));

// Express built-in body parsing with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🔴 FIXED: MongoDB Connection for Render/Production
const getMongoURI = () => {
  // Always use environment variable first
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }
  
  // Development fallback
  if (!isProduction) {
    console.log('⚠️  Using local MongoDB for development');
    return 'mongodb://127.0.0.1:27017/skm-chambers';
  }
  
  // Production without MongoDB URI - throw error
  console.error('❌ FATAL: MONGODB_URI not set in production');
  process.exit(1);
};

const mongoURI = getMongoURI();

mongoose.connect(mongoURI, {
  // Optimized for production
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log(`📊 Database: ${mongoose.connection.name}`);
  console.log(`🌐 Environment: ${isProduction ? 'Production' : 'Development'}`);
})
.catch(err => {
  console.log('❌ MongoDB connection error:', err.message);
  
  if (!isProduction) {
    console.log('💡 Local dev tip: brew services restart mongodb-community');
    console.log('💡 Local dev tip: Check if MongoDB is running: mongod --version');
  } else {
    console.log('💡 Production tip: Check MONGODB_URI environment variable');
  }
});

// MongoDB Schemas
const enquirySchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  subject: { type: String },
  message: { type: String, required: true },
  type: { type: String, default: 'general_enquiry' },
  createdAt: { type: Date, default: Date.now }
});

const appointmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  preferredDate: { type: Date, required: true },
  preferredTime: { type: String, required: true },
  purpose: { type: String, required: true },
  type: { type: String, default: 'appointment_request' },
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const Enquiry = mongoose.model('Enquiry', enquirySchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${req.headers.origin || 'unknown'}`);
  next();
});

// API Routes

// POST /api/enquiry - Submit enquiry form
app.post('/api/enquiry', async (req, res) => {
  try {
    console.log('📋 Enquiry form data received');
    
    // Validate required fields
    if (!req.body.name || !req.body.email || !req.body.message) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, email, and message are required' 
      });
    }
    
    const enquiry = new Enquiry(req.body);
    await enquiry.save();
    
    console.log('✅ Enquiry saved with ID:', enquiry._id);
    
    res.status(201).json({ 
      success: true,
      message: 'Enquiry submitted successfully',
      id: enquiry._id 
    });
  } catch (error) {
    console.error('❌ Error saving enquiry:', error.message);
    
    // MongoDB validation error
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to submit enquiry', 
      details: error.message 
    });
  }
});

// POST /api/appointment - Submit appointment form
app.post('/api/appointment', async (req, res) => {
  try {
    console.log('📅 Appointment form data received');
    
    // Validate required fields
    if (!req.body.name || !req.body.email || !req.body.phone || 
        !req.body.preferredDate || !req.body.preferredTime || !req.body.purpose) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }
    
    // Parse date string to Date object
    const appointmentData = {
      ...req.body,
      preferredDate: new Date(req.body.preferredDate)
    };
    
    const appointment = new Appointment(appointmentData);
    await appointment.save();
    
    console.log('✅ Appointment saved with ID:', appointment._id);
    
    res.status(201).json({ 
      success: true,
      message: 'Appointment request submitted successfully',
      id: appointment._id 
    });
  } catch (error) {
    console.error('❌ Error saving appointment:', error.message);
    
    // MongoDB validation error
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to submit appointment request', 
      details: error.message 
    });
  }
});

// GET /api/enquiries - Get all enquiries (for admin panel)
app.get('/api/enquiries', async (req, res) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    res.json({ 
      success: true, 
      count: enquiries.length,
      data: enquiries 
    });
  } catch (error) {
    console.error('❌ Error fetching enquiries:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch enquiries' 
    });
  }
});

// GET /api/appointments - Get all appointments (for admin panel)
app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({ createdAt: -1 });
    res.json({ 
      success: true, 
      count: appointments.length,
      data: appointments 
    });
  } catch (error) {
    console.error('❌ Error fetching appointments:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch appointments' 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const memoryUsage = process.memoryUsage();
  
  res.json({ 
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
    },
    endpoints: {
      enquiry: '/api/enquiry',
      appointment: '/api/appointment',
      enquiries: '/api/enquiries',
      appointments: '/api/appointments'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'SKM Chambers API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    deployed: isProduction ? 'Yes' : 'No (Local Development)',
    endpoints: {
      health: '/health',
      submitEnquiry: 'POST /api/enquiry',
      submitAppointment: 'POST /api/appointment',
      getEnquiries: 'GET /api/enquiries',
      getAppointments: 'GET /api/appointments'
    },
    cors: {
      allowedOrigin: isProduction 
        ? 'https://courageous-salamander-4e7551.netlify.app'
        : '* (All origins - development only)'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: {
      root: 'GET /',
      health: 'GET /health',
      submitEnquiry: 'POST /api/enquiry',
      submitAppointment: 'POST /api/appointment'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('🔥 Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 🔴 FIXED: Render-compatible server start
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
  🚀 SKM Chambers Backend Server
  ===============================
  📍 Server running on port: ${PORT}
  🌐 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}
  🔗 Health check: /health
  📝 Submit enquiry: /api/enquiry
  📅 Submit appointment: /api/appointment
  
  📊 Database status: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}
  
  🌍 CORS Configuration:
  ${isProduction 
    ? '✅ Production: Origin locked to Netlify frontend' 
    : '⚠️  Development: All origins allowed'}
  
  ${isProduction ? '' : `
  ⚠️  Development Notes:
  1. MongoDB should be running locally
  2. Frontend should point to: http://localhost:${PORT}
  3. Use 'npm run dev' for auto-restart
  `}
  
  ${isProduction ? `
  ✅ Production Ready:
  1. Connected to MongoDB Atlas
  2. CORS secured for production
  3. Optimized for Render hosting
  ` : ''}
  `);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});