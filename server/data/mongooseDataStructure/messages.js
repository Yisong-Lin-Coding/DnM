const mongoose = require("mongoose");


const messageSchema = new mongoose.Schema({
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    to: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true }],
    time: { type: Date, default: Date.now },
    message: { type: String, required: true }
});

module.exports = mongoose.model("Messages", playerSchema);
