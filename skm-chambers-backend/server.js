const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware - Allow all origins for development
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Express built-in body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection - SIMPLIFIED for Mongoose 9+
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/skm-chambers')
.then(() => {
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
})
.catch(err => {
    console.log('❌ MongoDB connection error:', err.message);
    console.log('💡 Try: brew services restart mongodb-community');
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
    console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// API Routes

// POST /api/enquiry - Submit enquiry form
app.post('/api/enquiry', async (req, res) => {
    try {
        console.log('📋 Enquiry form data:', req.body);
        
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
        console.log('📅 Appointment form data:', req.body);
        
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
    
    res.json({ 
        status: 'OK',
        timestamp: new Date(),
        database: dbStatus,
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
        endpoints: {
            health: '/health',
            submitEnquiry: 'POST /api/enquiry',
            submitAppointment: 'POST /api/appointment',
            getEnquiries: 'GET /api/enquiries',
            getAppointments: 'GET /api/appointments'
        },
        documentation: 'See /health for detailed status'
    });
});

// 404 handler - FIXED: removed asterisk
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

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, HOST, () => {
    console.log(`
    🚀 SKM Chambers Backend Server
    ===============================
    📍 Server running at: http://${HOST}:${PORT}
    🔗 Health check:      http://${HOST}:${PORT}/health
    📝 Submit enquiry:    http://${HOST}:${PORT}/api/enquiry
    📅 Submit appointment:http://${HOST}:${PORT}/api/appointment
    
    📊 Database status:   ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}
    
    ⚠️  Make sure:
    1. MongoDB is running
    2. Frontend is sending requests to: http://${HOST}:${PORT}
    3. Check browser console for CORS errors
    `);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
});