const mongoose = require('mongoose');

const subclassSchema = new mongoose.Schema({
    name: { type: String, required: true },
    classID: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    parentClass: { type: String, required: true },
    featuresByLevel: { type: Map, of: [String], default: {} },

    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Subclass', subclassSchema);
