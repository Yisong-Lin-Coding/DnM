const mongoose = require("mongoose");


const messageSchema = new mongoose.Schema({
    from: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
    to: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true }],
    kind: { type: String, default: "system" },
    subject: { type: String, default: "" },
    message: { type: String, default: "" },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, default: "sent" },
    readBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }], default: [] },
    actedAt: { type: Date, default: null },
    time: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("Messages", messageSchema);
