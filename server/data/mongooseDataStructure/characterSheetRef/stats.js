const mongoose = require("mongoose");
const numberRef = require("./numberRef");

const statSchema = new mongoose.Schema({
    STR: {type:numberRef, default: { total: 10, permMods: {base:10}, tempMods: {} }},
    DEX: {type:numberRef, default: { total: 10, permMods: {base:10}, tempMods: {} }},
    CON: {type:numberRef, default: { total: 10, permMods: {base:10}, tempMods: {} }},
    INT: {type:numberRef, default: { total: 10, permMods: {base:10}, tempMods: {} }},
    WIS: {type:numberRef, default: { total: 10, permMods: {base:10}, tempMods: {} }},
    CHA: {type:numberRef, default: { total: 10, permMods: {base:10}, tempMods: {} }},
    LUCK: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }}
})