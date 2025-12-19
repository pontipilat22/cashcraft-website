const mongoose = require('mongoose');

const modelSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['processing', 'ready', 'failed'],
        default: 'processing'
    },
    trainingImages: [{
        type: String
    }],
    thumbnailUrl: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    }
});

module.exports = mongoose.model('Model', modelSchema);
