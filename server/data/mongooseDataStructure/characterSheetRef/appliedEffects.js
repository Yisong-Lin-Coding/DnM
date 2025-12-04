const mongoose = require("mongoose");

const appliedEffectSchema = new mongoose.Schema({
    effectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Effect', default:"poison-A001" },
    duration: { type: Number, default: 0 }, // Duration in seconds
    appliedAt: { type: Date, default: Date.now },
    source: { type: mongoose.Schema.Types.ObjectId, ref: 'Character', default:"self" },
})

module.exports = appliedEffectSchema;