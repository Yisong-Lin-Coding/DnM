const mongoose = require('mongoose');

const passiveSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    tags: { type: [String], default: [] },
    level: { type: Number, default: 1 },
    effect: { type: String, required: true },
    duration: { type: Number, default: -1 }, // Duration in seconds, -1 means permanent
    code:{ type: String, required: true },
    createdAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('Passive', passiveSchema);