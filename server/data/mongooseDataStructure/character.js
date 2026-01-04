const mongoose = require("mongoose");
const statSchema = require("./characterSheetRef/stats");
const ARSchema = require("./characterSheetRef/AR");
const invSchema = require("./characterSheetRef/inv"); 
const skillsSchema = require('./characterSheetRef/skills');
const appliedEffectSchema = require('./characterSheetRef/appliedEffects');
const { ServerClosedEvent } = require("mongodb");

const characterSchema   = new mongoose.Schema({
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    name: { type: String, default: null },
    class: { type: mongoose.Schema.Types.ObjectId,ref:'Class', default: null },
    subclass: { type: mongoose.Schema.Types.ObjectId, ref: 'Subclass', default: null },
    race: { type: mongoose.Schema.Types.ObjectId, ref: 'Race', default: null },
    background: { type: mongoose.Schema.Types.ObjectId, ref: 'Background', default: null },
    level: { type: Number, default: 1 },
    experience: {current: { type: Number, default: 0 }, nextLevel: { type: Number, default: 300 }},

    age: { years:{type:Number, default: null}, month:{type:Number, default: null}, day:{type:String, default: null} },
    gender: { type: String, default: null},
    model:{size: {type: String, default: null}, height: {type: String, default: null}, weight: {type: Number, default: null}},
    alignment: { type: String, default: null },

    customization: {
      skinColor: { type: String, default: null},  
      eyeColor: { type: String, default: null},
      hairColor: { type: String, default: null},
    },

    stories: { 
        longStory:{type:String, default: ""}, 
        personality: {type:[String], default: []}, 
        ideals: {type:[String], default: []}, 
        flaws: {type:[String], default: []}, 
        relationships: {
            type:Map, 
            of: new mongoose.Schema({
                        relationship: { type: String, default: 'Friend' },
                        description: { type: String, default: "Burger Owner" }
                    }, { _id: false })
                    ,  default: {}
                }},
    
    HP:{ current: {type:Number, default: 10}, max: {type:Number, default:10}, temp: {type:Number, default:0} },
    STA:{ current: {type:Number, default: 10}, max: {type:Number, default:10}, temp: {type:Number, default:0} },
    MP:{ current: {type:Number, default: 10}, max: {type:Number, default:10}, temp: {type:Number, default:0} },

    water: { current: {type:Number, default: 0}, max: {type:Number, default:8} },
    food:{ current: {type:Number, default: 0}, max: {type:Number, default:12}, },
    

    stats: statSchema,
    AR:ARSchema,
    inv:invSchema,
    skills: skillsSchema,
    effects: [{
        type: appliedEffectSchema,
        default: []
        }],
    

})

module.exports = mongoose.model("Character", characterSchema);
