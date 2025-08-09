const mongoose = require('mongoose');

const spellSchema = new mongoose.Schema({

    name: { type: String, required: true },
    description: { type: String, required: true },
    level: { type: Number, default: 1 },
    difficulty: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    code: { type: String, required: true },
    cost: { type: mongoose.Schema.Types.Mixed, default: {}, required: true },
    upkeep: { type: mongoose.Schema.Types.Mixed, default: {} },


})

module.exports = mongoose.model('Spell', spellSchema);