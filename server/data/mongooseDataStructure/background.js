const mongoose = require('mongoose');

const backgroundSchema = new mongoose.Schema({
    name: { type: String, required: true },
    backgroundID: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    baseStatModifier: { type: Object, default: {}},
    baseProficiencies: { type: [String], default: [] },
    baseEquipment: { type: [String], default: [] },
    features: { type: Map, of: [String], default: {} },
    choices: { type: Object, default: {} },
    gp:{ type: Number, default: 0 },

    createdAt: { type: Date, default: Date.now },

})

module.exports = mongoose.model('Background', backgroundSchema);