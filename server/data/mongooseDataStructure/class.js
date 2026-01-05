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
    baseProficiencies: {
            armor: { type: [String], default: [] },
            weapons: { type: [String], default: [] },
            tools: { type: [String], default: [] },
            abilityScore: { type: [String], default: [] },
            skills: { type: [String], default: [] },
            },

    baseEquipment: { type: [String], default: [] },
    featuresByLevel: { type: Map, of: [String], default: {} },

    choices: { type: Object, default: {} },
    subclasses: { type: [String], default: [] },





    createdAt: { type: Date, default: Date.now },

})

module.exports = mongoose.model('Class', classSchema);