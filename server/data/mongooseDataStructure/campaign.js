const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: "" },
    dmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: [] }],
    createdAt: { type: Date, default: Date.now },
    settings: {
        
    },
    maps: [{ type: String, required: true }],
    npcs: [{ type: String, required: true }],
    gameSaves: {type: Map, of: mongoose.Schema.Types.Mixed, default: {} }
})

module.exports = mongoose.model('Campaign', spellSchema);