const mongoose = require("mongoose");

const skillsSchema = new mongoose.Schema({
    active: { type: Map, of: String, default: {} },
    passive: { type: Map, of: String, default: {} },
    proficiencies: {
            armor: { type: [String], default: [] },
            weapons: { type: [String], default: [] },
            tools: { type: [String], default: [] },
            abilityScore: { type: [String], default: [] },
            skills: { type: [String], default: [] },
            },
    languages: { type: Map, of: String, default: {} },
})
module.exports = skillsSchema;