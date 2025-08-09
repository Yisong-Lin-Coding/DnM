const mongoose = require("mongoose");

const numberRef = new mongoose.Schema({
  total: Number,
  permMods: { type: Map, of: Number, default: {} },
  tempMods: { type: Map, of: Number, default: {} },
});
module.exports = numberRef;