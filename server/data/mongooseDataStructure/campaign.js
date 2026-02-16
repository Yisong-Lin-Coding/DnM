const mongoose = require("mongoose");

const lobbySchema = new mongoose.Schema(
    {
        isActive: { type: Boolean, default: false },
        lobbyCode: { type: String, default: "" },
        startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
        startedAt: { type: Date, default: null },
        members: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player", default: [] }],
    },
    { _id: false }
);

const campaignSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    dmId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player", default: [] }],
    bannedPlayers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player", default: [] }],
    joinCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    maxPlayers: { type: Number, default: 6, min: 2, max: 12 },
    isPrivate: { type: Boolean, default: false },
    setting: { type: String, default: "", trim: true },
    activeLobby: { type: lobbySchema, default: () => ({}) },
    createdAt: { type: Date, default: Date.now },
    settings: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    maps: [{ type: String, default: [] }],
    npcs: [{ type: String, default: [] }],
    gameSaves: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: "GameSave" }],
        default: [],
    },
    activeGameSave: { type: mongoose.Schema.Types.ObjectId, ref: "GameSave", default: null },
});

module.exports = mongoose.model("Campaign", campaignSchema);
