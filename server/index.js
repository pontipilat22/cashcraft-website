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
const Template = require('./models/Template');
const SupportTicket = require('./models/SupportTicket');

const app = express();
const { initBot, notifyAdminNewRequest, notifyAdminNewPayment } = require('./services/telegramBot');

// Init Bot
initBot();
const PORT = process.env.PORT || 3000;

// Google OAuth Client
// Google OAuth Client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const fs = require('fs');

// Cloudinary Config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer Config (Uploads)
const upload = multer({ dest: 'uploads/' });

const path = require('path');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the parent directory (frontend)
app.use(express.static(path.join(__dirname, '../')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// ============================================
// SERVER SETTINGS (in-memory, resets on restart)
// ============================================
let serverSettings = {
    paymentsEnabled: true
};

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
// ============================================
// UPLOAD & WEBHOOKS
// ============================================

// Upload file to Cloudinary
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'cashcraft_uploads',
            width: 1024,
            crop: "limit"
        });

        // Clean up local file
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        res.json({ success: true, url: result.secure_url });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error('Upload Error:', error);
        res.status(500).json({ success: false, error: 'Upload failed: ' + error.message });
    }
});

// Astria Webhook
app.post('/api/webhooks/astria', async (req, res) => {
    try {
        const { type, modelId, userId, aspectRatio } = req.query;
        console.log(`[Astria Webhook] Received type: ${type}`);
        console.log(`[Astria Webhook] Query Params:`, req.query);
        console.log(`[Astria Webhook] Body:`, JSON.stringify(req.body, null, 2));

        if (type === 'tune') {
            // Handle Model Training Completion
            if (mongoose.Types.ObjectId.isValid(modelId)) {
                const model = await Model.findById(modelId);
                if (model) {
                    model.status = req.body.status === 'failed' ? 'failed' : 'ready';
                    model.completedAt = new Date();
                    await model.save();
                    console.log(`Model ${modelId} marked as ${model.status}.`);
                }
            }
        } else if (type === 'prompt') {
            // Handle Image Generation Completion
            const generationId = req.query.generationId;
            let images = req.body.images;
            if (!images && req.body.prompt && req.body.prompt.images) {
                images = req.body.prompt.images;
            }

            if (images && Array.isArray(images) && images.length > 0) {
                console.log(`[Webhook] Processing ${images.length} images for user ${userId}`);

                // If generationId exists, we update the FIRST image to that record
                // ASTNIA sends array of images.

                for (let i = 0; i < images.length; i++) {
                    const imgUrl = images[i];
                    try {
                        if (i === 0 && generationId && mongoose.Types.ObjectId.isValid(generationId)) {
                            // Update existing record
                            const gen = await Generation.findByIdAndUpdate(generationId, {
                                status: 'completed',
                                imageUrl: imgUrl,
                                astriaId: req.body.id || 0
                            });
                            console.log(`[Webhook] Updated existing generation ${generationId}`);
                        } else {
                            // Create new records for extra images (or if no generationId)
                            let modelName = 'Anna Flux (Demo)';
                            if (modelId !== '3783799' && mongoose.Types.ObjectId.isValid(modelId)) {
                                const model = await Model.findById(modelId);
                                if (model) modelName = model.name;
                            }

                            await Generation.create({
                                userId: userId,
                                prompt: (req.body.prompt && req.body.prompt.text) ? req.body.prompt.text : 'AI Generated (Extra)',
                                imageUrl: imgUrl,
                                aspectRatio: aspectRatio || '2:3',
                                modelName: modelName,
                                modelId: modelId || '3783799',
                                status: 'completed',
                                astriaId: req.body.id || 0
                            });
                            console.log(`[Webhook] Created new generation record for image ${i + 1}`);
                        }
                    } catch (genError) {
                        console.error('[Astria Webhook] Error processing image:', genError.message);
                    }
                }
            } else {
                console.warn('Webhook received but no images found in body.');
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).json({ success: false, error: error.message });
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

// Cleanup test data (Picsum images)
app.post('/api/generations/cleanup-test-data', async (req, res) => {
    try {
        const result = await Generation.deleteMany({
            imageUrl: { $regex: /picsum\.photos|unsplash\.com|random=/i }
        });
        res.json({ success: true, deletedCount: result.deletedCount });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new generation (Start)
app.post('/api/generations', async (req, res) => {
    try {
        const { userId, prompt, modelId, aspectRatio, count, superResolution, filmGrain, inpaintFaces, templateImageUrl } = req.body;
        const photoCount = count || 4;

        if (modelId === 'demo') {
            // Demo mode: Return placeholder URL immediately (or handle differently)
            return res.json({ success: true, message: 'Demo generation simulated' });
        }

        const cost = photoCount * 3; // Cost: 3 crystals per photo

        // 1. Check User Credits
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.credits < cost) {
            return res.status(402).json({ error: 'Not enough credits' });
        }

        // 2. Check Model
        console.log(`[Generation] Received modelId: ${modelId} from User: ${userId}`);
        let modelAstriaId = modelId;
        let modelGender = 'woman';
        let modelName = 'Anna Flux (Demo)';

        if (modelId !== '3783799') {
            if (!mongoose.Types.ObjectId.isValid(modelId)) {
                return res.status(400).json({ error: 'Invalid Model ID format' });
            }
            const model = await Model.findById(modelId);

            // SECURITY CHECK: Verify ownership
            if (!model) {
                return res.status(404).json({ error: 'Model not found' });
            }

            // Check if model belongs to user (Security Fix)
            // EXCEPTION: Allow if it's the specific Demo Model ID
            if (model.userId.toString() !== userId && modelId !== '3783799') {
                console.warn(`[Security Alert] User ${userId} tried to use model ${modelId} belonging to ${model.userId}`);
                return res.status(403).json({ error: 'Access denied: You do not own this model' });
            }

            if (!model.astriaId) {
                return res.status(400).json({ error: 'Model not trained yet' });
            }

            modelAstriaId = model.astriaId;
            modelGender = model.gender || 'person';
            modelName = model.name;
        }

        // 3. Deduct Credits
        user.credits -= cost;
        await user.save();

        // 4. Enhance prompt with DeepSeek (RU -> EN + Professional enhancement)
        let enhancedPrompt = prompt;
        const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

        console.log(`[DeepSeek Check] Key exists: ${!!DEEPSEEK_KEY}`);

        if (DEEPSEEK_KEY) {
            try {
                // ... DeepSeek logic remains same ...
                console.log(`[DeepSeek] Start enhancement for: "${prompt}"`);
                const dsResponse = await axios.post('https://api.deepseek.com/chat/completions', {
                    model: "deepseek-chat",
                    messages: [
                        {
                            role: "system",
                            content: "You are a professional AI prompt engineer. MANDATORY: Translate the input to English and expand it into a detailed photorealistic prompt. Structure: [Subject], [Environment], [Lighting], [Camera/Quality]. CRITICAL: Always output in English only. Never include Russian text. NEVER include '<lora:...>' or 'ohwx' trigger words in your output. Just describe the image visual details."
                        },
                        { role: "user", content: `Translate and enhance this for Flux.1 AI: ${prompt}` }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                }, {
                    headers: {
                        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000
                });

                if (dsResponse.data.choices && dsResponse.data.choices[0].message) {
                    const result = dsResponse.data.choices[0].message.content.trim();
                    if (result && result.length > 5) {
                        // Clean up any potential LoRA tags from DeepSeek output
                        enhancedPrompt = result.replace(/<lora:[^>]+>/g, '').replace(/\bohwx\b/g, '').trim();
                        console.log(`[DeepSeek] Success! New prompt: ${enhancedPrompt}`);
                    }
                }
                // ... End DeepSeek logic ...
            } catch (dsError) {
                console.error('[DeepSeek Error] Detail:', dsError.response?.data || dsError.message);
            }
        }

        // 5. Create Generation Record EARLY (To save enhanced prompt)
        const bbox = {
            '1:1': { w: 512, h: 512 },
            '2:3': { w: 512, h: 768 },
            '3:2': { w: 768, h: 512 },
            '9:16': { w: 512, h: 896 },
            '16:9': { w: 896, h: 512 }
        };
        const size = bbox[aspectRatio] || bbox['2:3'];

        const newGeneration = await Generation.create({
            userId: user._id,
            prompt: enhancedPrompt, // Save the ENHANCED prompt
            originalPrompt: prompt, // Optional: save original if needed later
            imageUrl: 'https://via.placeholder.com/512?text=Processing...', // Temp placeholder
            status: 'processing',
            modelName: modelName,
            modelId: modelId || '3783799',
            aspectRatio: aspectRatio,
            astriaId: null, // Will be updated on callback
        });

        const API_KEY = process.env.ASTRIA_API_KEY;
        const BASE_DOMAIN = process.env.BASE_DOMAIN || 'https://www.ai-photo.kz';

        // Add generationId to webhook URL
        const webhookUrl = `${BASE_DOMAIN}/api/webhooks/astria?type=prompt&userId=${userId}&modelId=${modelId}&generationId=${newGeneration._id}`;

        const promptPayload = {
            prompt: {
                text: `<lora:${modelAstriaId}:1.0> ohwx ${modelGender} ${enhancedPrompt}`,
                num_images: Math.min(photoCount, 8),
                callback: webhookUrl,
                super_resolution: !!superResolution,
                film_grain: !!filmGrain,
                inpaint_faces: !!inpaintFaces,
                input_image_url: templateImageUrl || undefined,
                w: size.w,
                h: size.h
            }
        };

        console.log(`[Astria] Sending to tune ID: ${modelAstriaId}`);
        console.log(`[Astria] Generation ID: ${newGeneration._id}`);

        try {
            const response = await axios.post(`https://api.astria.ai/tunes/${modelAstriaId}/prompts`, promptPayload, {
                headers: { 'Authorization': `Bearer ${API_KEY}` }
            });

            // Update generation with Astria ID
            newGeneration.astriaId = response.data.id;
            await newGeneration.save();

            res.json({ success: true, promptId: response.data.id, remainingCredits: user.credits });

        } catch (astriaError) {
            // Rollback: Mark as failed and refund credits
            console.error('Astria API Failed:', astriaError.message);
            newGeneration.status = 'failed';
            await newGeneration.save();

            user.credits += cost;
            await user.save();

            throw astriaError; // Re-throw to catch block
        }

    } catch (error) {
        console.error('Generation Error Detail:', error.response?.data);
        const errorMsg = error.response?.data
            ? JSON.stringify(error.response.data)
            : error.message;
        res.status(500).json({ success: false, error: 'Generation failed: ' + errorMsg });
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

// Create new model (Training)
app.post('/api/models', async (req, res) => {
    try {
        const { userId, name, gender, trainingImages } = req.body; // trainingImages must be URLs

        const COST = 50; // Training cost

        // 1. Check User Credits
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.credits < COST) {
            return res.status(402).json({ error: 'Not enough credits' });
        }

        // 2. Deduct Credits
        user.credits -= COST;
        await user.save();

        // 3. Create Model in DB (processing status)
        const model = await Model.create({
            userId,
            name,
            gender: gender || 'person',
            trainingImages,
            status: 'processing'
        });

        // 2. Call Astria API to start training
        const API_KEY = process.env.ASTRIA_API_KEY;
        const BASE_DOMAIN = process.env.BASE_DOMAIN || 'https://www.ai-photo.kz';
        const WEBHOOK_URL = `${BASE_DOMAIN}/api/webhooks/astria?type=tune&modelId=${model._id}`;

        const tunePayload = {
            tune: {
                title: name,
                name: gender || 'person', // Class name (man, woman, person)
                token: 'ohwx', // Trigger word
                image_urls: trainingImages,
                callback: WEBHOOK_URL,
                base_tune_id: 1504944, // Flux 1 (Flux1.dev)
                model_type: 'lora',
                preset: 'flux-lora-portrait'
            }
        };

        console.log('Starting Astria training for:', model._id);
        console.log('Images to train:', trainingImages.length);

        const response = await axios.post('https://api.astria.ai/tunes', tunePayload, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Astria Response ID:', response.data.id);

        // 5. Update Model with Astria ID
        model.astriaId = response.data.id;
        await model.save();

        res.json({ success: true, model, remainingCredits: user.credits });
    } catch (error) {
        console.error('Training Error Detail:', JSON.stringify(error.response?.data || error.message, null, 2));

        // Cleanup the created model if training failed to start
        try {
            const modelToClean = await Model.findOne({ userId, status: 'processing', astriaId: { $exists: false } }).sort({ createdAt: -1 });
            if (modelToClean) {
                await Model.findByIdAndDelete(modelToClean._id);
                console.log('Ghost model deleted.');
            }
        } catch (cleanupErr) {
            console.error('Cleanup Err:', cleanupErr.message);
        }

        // Refund Credits on failure
        try {
            const user = await User.findById(req.body.userId);
            if (user) {
                user.credits += 50;
                await user.save();
                console.log('Credits refunded due to training start failure.');
            }
        } catch (refundError) {
            console.error('Failed to refund credits:', refundError.message);
        }

        const astriaError = error.response?.data?.error || error.response?.data?.errors || error.message;
        res.status(500).json({
            success: false,
            error: 'Training failed: ' + (typeof astriaError === 'object' ? JSON.stringify(astriaError) : astriaError)
        });
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

        // Notify Admin via Telegram about new request
        notifyAdminNewRequest(payment);

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

        // Notify Admin via Telegram
        notifyAdminNewPayment(payment);

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

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        // 1. Priority: Check Environment Variables
        if (adminEmail && adminPassword) {
            if (email === adminEmail && password === adminPassword) {
                return res.json({
                    success: true,
                    admin: { email, role: 'admin' }
                });
            }
        }


        // 3. Auth Failed
        res.status(401).json({ success: false, error: 'Invalid credentials' });
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
                totalRevenue,
                paymentsEnabled: serverSettings.paymentsEnabled
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Toggle payments enabled (Admin)
app.post('/api/admin/settings/payments', async (req, res) => {
    try {
        const { enabled } = req.body;
        serverSettings.paymentsEnabled = !!enabled;
        console.log(`[Settings] Payments enabled: ${serverSettings.paymentsEnabled}`);
        res.json({ success: true, paymentsEnabled: serverSettings.paymentsEnabled });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get payment status (Public)
app.get('/api/settings/payments', (req, res) => {
    res.json({ success: true, paymentsEnabled: serverSettings.paymentsEnabled });
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

// Delete payment (Permanently)
app.delete('/api/admin/payments/:id', async (req, res) => {
    try {
        await Payment.findByIdAndDelete(req.params.id);
        res.json({ success: true });
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
// SUPPORT TICKET ROUTES
// ============================================

// Create support ticket (User)
app.post('/api/support/create', async (req, res) => {
    try {
        const { userId, subject, message } = req.body;

        const ticket = await SupportTicket.create({
            userId,
            subject,
            message,
            status: 'open'
        });

        res.json({ success: true, ticket });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user's support tickets
app.get('/api/support/user/:userId', async (req, res) => {
    try {
        const tickets = await SupportTicket.find({ userId: req.params.userId })
            .sort({ createdAt: -1 });

        res.json({ success: true, tickets });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all support tickets (Admin)
app.get('/api/admin/support', async (req, res) => {
    try {
        const tickets = await SupportTicket.find()
            .populate('userId', 'name email picture credits')
            .sort({ createdAt: -1 });

        res.json({ success: true, tickets });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reply to support ticket (Admin)
app.post('/api/admin/support/:id/reply', async (req, res) => {
    try {
        const { reply } = req.body;
        const ticket = await SupportTicket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }

        ticket.adminReply = reply;
        ticket.status = 'answered';
        ticket.repliedAt = new Date();
        await ticket.save();

        res.json({ success: true, ticket });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Close support ticket (Admin)
app.post('/api/admin/support/:id/close', async (req, res) => {
    try {
        const ticket = await SupportTicket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }

        ticket.status = 'closed';
        await ticket.save();

        res.json({ success: true, ticket });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Manually add crystals to user (Admin)
app.post('/api/admin/users/:userId/add-crystals', async (req, res) => {
    try {
        const { crystals, reason } = req.body;
        const userId = req.params.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        user.credits += parseInt(crystals);
        await user.save();

        console.log(`[ADMIN] Added ${crystals} crystals to user ${user.email}. Reason: ${reason || 'Manual'}`);

        res.json({
            success: true,
            newBalance: user.credits,
            message: `Добавлено ${crystals} кристаллов пользователю ${user.email}`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user's payments (Admin - for support dispute resolution)
app.get('/api/admin/users/:userId/payments', async (req, res) => {
    try {
        const payments = await Payment.find({ userId: req.params.userId })
            .sort({ createdAt: -1 });

        res.json({ success: true, payments });
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


// ============================================
// TEMPLATE ROUTES (Styles)
// ============================================

// Get all templates (sorted by isHit then date)
app.get('/api/templates', async (req, res) => {
    try {
        const templates = await Template.find().sort({ isHit: -1, createdAt: -1 });
        res.json({ success: true, templates });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new template (Admin)
app.post('/api/templates', upload.single('image'), async (req, res) => {
    try {
        let { name, prompt, imageUrl, isHit, category } = req.body;

        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'templates',
                width: 800,
                crop: "limit"
            });
            imageUrl = result.secure_url;
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        }

        const template = await Template.create({
            name,
            prompt,
            imageUrl: imageUrl || 'https://via.placeholder.com/300',
            isHit: isHit === 'true' || isHit === true,
            category: category || 'General'
        });
        res.json({ success: true, template });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Toggle hit status (Admin)
app.patch('/api/templates/:id/hit', async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);
        if (!template) return res.status(404).json({ error: 'Template not found' });

        template.isHit = !template.isHit;
        await template.save();
        res.json({ success: true, template });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete model
app.delete('/api/models/:id', async (req, res) => {
    try {
        await Model.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete template (Admin)
app.delete('/api/templates/:id', async (req, res) => {
    try {
        await Template.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
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
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
