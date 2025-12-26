const Player = require('../data/mongooseDataStructure/player')
const path = require("path");
const mongoose = require("mongoose")


module.exports = (socket) => {
socket.on("playerData_logOff", async (data, callback) => {
    if(data && data.playerID){
        await Player.findByIdAndUpdate(data.playerID, {
            isActive: false,
            lastLogOn: new Date()
        });
    }
    callback({ success: true });
});
}