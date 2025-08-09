const mongoose = require("mongoose");

const appliedEffectSchema = new mongoose.Schema({
    effectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Effect', required: true },
    duration: { type: Number, default: 0 }, // Duration in seconds
    appliedAt: { type: Date, default: Date.now },
    source: { type: mongoose.Schema.Types.ObjectId, ref: 'Character', required: true },
})

module.exports = mongoose.model("AppliedEffect", appliedEffectSchema);