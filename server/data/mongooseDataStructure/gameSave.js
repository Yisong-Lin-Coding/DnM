const mongoose = require("mongoose");

const gameSaveSchema = new mongoose.Schema(
    {
        campaignId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Campaign",
            required: true,
            index: true,
        },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: "", trim: true },
        savedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
        snapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
        metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
        version: { type: Number, default: 1 },
        isAutoSave: { type: Boolean, default: false },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("GameSave", gameSaveSchema);
