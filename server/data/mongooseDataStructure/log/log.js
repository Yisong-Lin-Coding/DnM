const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({

    
    message:{type: String, required: true},
    type:{type:String, enum: ['general', 'combat', ], required:true, default:'general'},
    time:{required:true, default: new Date() }



})