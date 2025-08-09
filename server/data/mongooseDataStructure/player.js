const mongoose = require("mongoose");
const character = require("./character");

const playerSchema = new mongoose.Schema({
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    characters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Character' }],
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    
});

module.exports = mongoose.model("Player", playerSchema);
