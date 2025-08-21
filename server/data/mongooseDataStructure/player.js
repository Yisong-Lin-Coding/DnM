const mongoose = require("mongoose");
const character = require("./character");

const playerSchema = new mongoose.Schema({
    sessionID :  {type: String, unique: true},
    characters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Character', default: [] }],
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    
});

module.exports = mongoose.model("Player", playerSchema);
