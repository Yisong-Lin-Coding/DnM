const mongoose = require("mongoose");

const invSchema = new mongoose.Schema({
    gp: { type: Number, default: 0 },
    items: { 
        itemname:{
            type: [mongoose.Schema.Types.ObjectId], 
            ref: 'Item', 
            default: {}},
        quantity: { type: Number, default: 0 }
    },
    equipment: {
        head: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        body: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        legs: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        feet: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        arms: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        hands: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        weapon: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        fingers: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        neck: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: [] },
        trinkets: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
    }

})

module.exports = invSchema;