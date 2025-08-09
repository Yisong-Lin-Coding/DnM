const mongoose = require("mongoose");
const numberRef = require("./numberRef");

const statSchema = new mongoose.Schema({
    STR: numberRef,
    DEX: numberRef,
    CON: numberRef,
    INT: numberRef,
    WIS: numberRef,
    CHA: numberRef,
    LUCK: numberRef
})

module.exports = mongoose.model("Stat", statSchema);