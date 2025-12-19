const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    crystals: {
        type: Number,
        required: true
    },
    kaspiPhone: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'confirmed', 'rejected'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    paidAt: {
        type: Date
    },
    confirmedAt: {
        type: Date
    },
    rejectedAt: {
        type: Date
    },
    adminNote: {
        type: String
    }
});

module.exports = mongoose.model('Payment', paymentSchema);
