const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
    {
        current: { type: Number, default: 10 },
        max: { type: Number, default: 10 },
        temp: { type: Number, default: 0 },
    },
    { _id: false }
);

const enemySchema = new mongoose.Schema({
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
    name: { type: String, required: true, trim: true },
    kind: { type: String, default: "enemy", trim: true },
    level: { type: Number, default: 1 },
    HP: { type: resourceSchema, default: () => ({}) },
    MP: { type: resourceSchema, default: () => ({}) },
    STA: { type: resourceSchema, default: () => ({}) },
    size: { type: Number, default: 30 },
    visionDistance: { type: Number, default: 150 },
    visionArc: { type: Number, default: 90 },
    rotation: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Enemy", enemySchema);
