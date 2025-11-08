const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    itemId: { type: String, required: true, unique: true },
    durability: { type: Number, default: 100 },
    description: { type: String, required: true },
    tags: { type: [String], default: [] },
    rarity: { type: String, enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'], default: 'common' },
    unqiue: { type: Boolean, default: false },
    weight: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
    properties: { type: Map, of: String, default: {} },
    code: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },

})

module.exports = mongoose.model('Item', itemSchema);