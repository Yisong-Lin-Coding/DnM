const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    itemId: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    rarity: { type: String, enum: ['common', 'uncommon', 'rare',"very rare", 'epic', 'legendary'], default: 'common' },
    unqiue: { type: Boolean, default: false },
    weight: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    attributes: { type: [String], default: [] },
    properties: { type: Map, of: String, default: {} },
    enchantments: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },

})

module.exports = mongoose.model('Item', itemSchema);