const mongoose = require("mongoose");
const numberRef = require("./numberRef");

const ARSchema = new mongoose.Schema({
    physical: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }},
    pierce: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }},
    slash: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }},
    blunt: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }},
    magical: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }},
    fire: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }},
    cold: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }},
    lightning: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }},
    thunder: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }},
    acid: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }},
    poison: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }},
    necrotic: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }},
    radiant: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }},
    force: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }},
    psychic: {type:numberRef, default: { total: 0, permMods: {base:0}, tempMods: {} }}
    
})
module.exports = mongoose.model("AR", ARSchema);