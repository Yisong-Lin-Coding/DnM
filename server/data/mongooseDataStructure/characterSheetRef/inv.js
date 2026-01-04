const mongoose = require("mongoose");

const invSchema = new mongoose.Schema({
    gp: { type: Number, default: 0 },
    items: {
        type: Map,
        of: new mongoose.Schema({
            equipped: { type: Boolean, default: false },
            ItemID: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
        })
    },
    equipment: {
        innerhead: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        outerhead: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        face: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        eyes: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        innerbody: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        outerbody: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        innerlegs: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        outerlegs: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        innerfeet: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        outerfeet: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        arms: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        hands: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        fists: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        wrist: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        waist: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        weapon: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        fingers: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        neck: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        trinkets: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
        back: { type: [mongoose.Schema.Types.ObjectId], ref: 'Item', default: [] },
    }

})

module.exports = invSchema;