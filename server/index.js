require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');

const User = require('./models/User');
const Generation = require('./models/Generation');
const Model = require('./models/Model');
const Payment = require('./models/Payment');
const Admin = require('./models/Admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Google OAuth Client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const path = require('path');

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the parent directory (frontend)
app.use(express.static(path.join(__dirname, '../')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// ============================================
// AUTH ROUTES
// ============================================

// Google Sign-In
app.post('/api/auth/google', async (req, res) => {
    try {
        const { token } = req.body;

        // Verify Google token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        // Find or create user
        let user = await User.findOne({ googleId });

        if (!user) {
            user = await User.create({
                googleId,
                email,
                name,
                picture
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                picture: user.picture,
                credits: user.credits
            }
        });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ success: false, error: 'Authentication failed: ' + error.message });
    }
});

// ============================================
// USER ROUTES
// ============================================

// Get user profile
app.get('/api/user/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                picture: user.picture,
                credits: user.credits
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// GENERATION ROUTES
// ============================================

// Get user's generations
app.get('/api/generations/:userId', async (req, res) => {
    try {
        const generations = await Generation.find({ userId: req.params.userId })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({ success: true, generations });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save new generation
app.post('/api/generations', async (req, res) => {
    try {
        const { userId, prompt, imageUrl, aspectRatio, modelName } = req.body;

        const generation = await Generation.create({
            userId,
            prompt,
            imageUrl,
            aspectRatio,
            modelName
        });

        res.json({ success: true, generation });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete generation
app.delete('/api/generations/:id', async (req, res) => {
    try {
        await Generation.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// MODEL ROUTES
// ============================================

// Get user's models
app.get('/api/models/:userId', async (req, res) => {
    try {
        const models = await Model.find({ userId: req.params.userId })
            .sort({ createdAt: -1 });

        res.json({ success: true, models });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new model
app.post('/api/models', async (req, res) => {
    try {
        const { userId, name, trainingImages } = req.body;

        const model = await Model.create({
            userId,
            name,
            trainingImages,
            status: 'processing'
        });

        // Simulate training completion after 20 minutes
        setTimeout(async () => {
            model.status = 'ready';
            model.completedAt = new Date();
            await model.save();
        }, 20 * 60 * 1000);

        res.json({ success: true, model });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// PAYMENT ROUTES
// ============================================

// Create payment request
app.post('/api/payments/create', async (req, res) => {
    try {
        const { userId, amount, crystals, kaspiPhone, kaspiName } = req.body;

        const payment = await Payment.create({
            userId,
            amount,
            crystals,
            kaspiPhone,
            kaspiName,
            status: 'pending'
        });

        res.json({ success: true, payment });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark payment as paid by user
app.post('/api/payments/:id/mark-paid', async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).json({ success: false, error: 'Payment not found' });
        }

        payment.status = 'paid';
        payment.paidAt = new Date();
        await payment.save();

        res.json({ success: true, payment });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user's payments
app.get('/api/payments/user/:userId', async (req, res) => {
    try {
        const payments = await Payment.find({ userId: req.params.userId })
            .sort({ createdAt: -1 });

        res.json({ success: true, payments });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Simple admin auth (for demo - in production use proper JWT)
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // For demo: admin@example.com / admin123
        if (email === 'admin@example.com' && password === 'admin123') {
            res.json({
                success: true,
                admin: { email, role: 'admin' }
            });
        } else {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get admin statistics
app.get('/api/admin/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalPayments = await Payment.countDocuments();
        const confirmedPayments = await Payment.countDocuments({ status: 'confirmed' });
        const pendingPayments = await Payment.countDocuments({ status: 'pending' });
        const paidPayments = await Payment.countDocuments({ status: 'paid' });

        // Calculate total crystals sold
        const confirmedPaymentsList = await Payment.find({ status: 'confirmed' });
        const totalCrystalsSold = confirmedPaymentsList.reduce((sum, p) => sum + p.crystals, 0);
        const totalRevenue = confirmedPaymentsList.reduce((sum, p) => sum + p.amount, 0);

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalPayments,
                confirmedPayments,
                pendingPayments,
                paidPayments,
                totalCrystalsSold,
                totalRevenue
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all users
app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await User.find()
            .select('-googleId')
            .sort({ createdAt: -1 });

        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all payments
app.get('/api/admin/payments', async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate('userId', 'name email picture')
            .sort({ createdAt: -1 });

        res.json({ success: true, payments });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Confirm payment
app.post('/api/admin/payments/:id/confirm', async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).json({ success: false, error: 'Payment not found' });
        }

        // Update payment status
        payment.status = 'confirmed';
        payment.confirmedAt = new Date();
        await payment.save();

        // Add crystals to user
        const user = await User.findById(payment.userId);
        if (user) {
            user.credits += payment.crystals;
            await user.save();
        }

        res.json({ success: true, payment, user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reject payment
app.post('/api/admin/payments/:id/reject', async (req, res) => {
    try {
        const { note } = req.body;
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).json({ success: false, error: 'Payment not found' });
        }

        payment.status = 'rejected';
        payment.rejectedAt = new Date();
        payment.adminNote = note || '';
        await payment.save();

        res.json({ success: true, payment });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Serve admin.html
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin.html'));
});

// Serve index.html for any other requests (frontend)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
