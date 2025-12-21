const mongoose = require('mongoose');

const generationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    prompt: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    astriaId: {
        type: Number
    },
    status: {
        type: String,
        enum: ['processing', 'completed', 'failed'],
        default: 'processing'
    },
    aspectRatio: {
        type: String,
        default: '2:3'
    },
    modelName: {
        type: String,
        default: 'Demo'
    },
    modelId: {
        type: String,
        default: '3783799'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Generation', generationSchema);
