const mongoose = require("mongoose");
const character = require("./character");

const playerSchema = new mongoose.Schema({
    sessionID :  {type: String, unique: true},
    characters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Character', default: [] }],
    friendID:{type: Number, unique:true,  default: () => {
        const time = Date.now().toString().slice(-7); // time component
        const rand = Math.floor(10 + Math.random() * 90); // 2 digits
        return Number(time + rand); // 9 digits total
    }},
    friends:[{ type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: [] }],
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    campaigns: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: [] }],
    
});

module.exports = mongoose.model("Player", playerSchema);
