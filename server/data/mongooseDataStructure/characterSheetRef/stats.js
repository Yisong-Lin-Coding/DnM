const mongoose = require("mongoose");
const numberRefSchema = require("./numberRef");

const statSchema = new mongoose.Schema({
    STR: { type: numberRefSchema, default: { total: 10, permMods: { base: 10 }, tempMods: {} } },
    DEX: { type: numberRefSchema, default: { total: 10, permMods: { base: 10 }, tempMods: {} } },
    CON: { type: numberRefSchema, default: { total: 10, permMods: { base: 10 }, tempMods: {} } },
    INT: { type: numberRefSchema, default: { total: 10, permMods: { base: 10 }, tempMods: {} } },
    WIS: { type: numberRefSchema, default: { total: 10, permMods: { base: 10 }, tempMods: {} } },
    CHA: { type: numberRefSchema, default: { total: 10, permMods: { base: 10 }, tempMods: {} } },
    LUCK: { type: numberRefSchema, default: { total: 0, permMods: { base: 0 }, tempMods: {} } }
})

module.exports = statSchema;