const mongoose = require("mongoose");
const statSchema = require("./characterSheetRef/stats");
const ARSchema = require("./characterSheetRef/AR");
const invSchema = require("./characterSheetRef/inv"); 
const skillsSchema = require('./characterSheetRef/skills');
const effectsAppliedSchema = require('./characterSheetRef/appliedEffects');

const characterSchema   = new mongoose.Schema({
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    characterId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    class: { type: mongoose.Schema.Types.ObjectId,ref:'Class', required: true },
    race: { type: mongoose.Schema.Types.ObjectId, ref: 'Race', required: true },
    background: { type: mongoose.Schema.Types.ObjectId, ref: 'Background', required: true },
    age: { type: Number, default: 18 },
    sex: { type: String, required: true},
    height: { type: String, required: true },
    weight: { type: Number, required: true },
    alignment: { type: String, required: true },
    level: { type: Number, default: 1 },
    experience: {current: { type: Number, default: 0 }, nextLevel: { type: Number, default: 300 }},
    HP:{ current: {type:Number, default: 10}, max: {type:Number, default:10} },
    STA:{ current: {type:Number, default: 10}, max: {type:Number, default:10} },
    MP:{ current: {type:Number, default: 10}, max: {type:Number, default:10} },
    water: { current: {type:Number, default: 0}, max: {type:Number, default:8} },
    food:{ current: {type:Number, default: 0}, max: {type:Number, default:12}, },
    stats: statSchema,
    AR:ARSchema,
    inv:invSchema,
    skills: skillsSchema,
    effects:effectsAppliedSchema,
    

})

module.exports = mongoose.model("Character", characterSchema);
