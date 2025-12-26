const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
    name: { type: String, required: true },
    classID: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    resourcePoolModifier: { type: Object, default: { 
        HP: 1,
        STA: 1,
        MP: 1
    } },
    baseStatModifier: { type: Object, default: {}},
    baseProficiencies: { type: [String], default: [] },
    baseEquipment: { type: [String], default: [] },
    featuresByLevel: { type: Map, of: [String], default: {} },

    choices: { type: Object, default: {} },





    createdAt: { type: Date, default: Date.now },

})

module.exports = mongoose.model('Class', classSchema);