const mongoose = require('mongoose');

const raceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    raceID: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    speed: { type: Number, default: 30 },
    abilityScoreModifiers: { type: Object, default: {} },
    size: { type: String, default: 'M' }, 
    languages: { type: [String], default: [] },
    traits: { type: [String], default: [] },
    choices: { type: Object, default: {} },






    createdAt: { type: Date, default: Date.now },

})

module.exports = mongoose.model('Race', raceSchema);