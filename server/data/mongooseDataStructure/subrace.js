const mongoose = require('mongoose');

const subraceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    subraceID: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    speed: { type: Number, default: 30 },
    abilityScoreModifiers: { type: Object, default: {} },
    size: { type: String, default: 'M' }, 
    languages: { type: [String], default: [] },
    traits: { type: [String], default: [] },
    choices: { type: Object, default: {} },
    mainrace: { type: [Object], default: [] },






    createdAt: { type: Date, default: Date.now },

})

module.exports = mongoose.model('SubRace', subraceSchema);