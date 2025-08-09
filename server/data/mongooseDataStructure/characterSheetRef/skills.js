const mongoose = require("mongoose");

const skillsSchema = new mongoose.Schema({
    active: { type: Map, of: String, default: {} },
    passive: { type: Map, of: String, default: {} },
    proficiencies: { type: Map, of: String, default: {} },
    expertise: { type: Map, of: String, default: {} },
    mastary: { type: Map, of: String, default: {} },
    languages: { type: Map, of: String, default: {} },
})
module.exports = skillsSchema;