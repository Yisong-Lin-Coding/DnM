const Player = require('../data/mongooseDataStructure/player')
const path = require("path");
const mongoose = require("mongoose")


module.exports = (socket) => {
socket.on("playerData_logOn", async (data, callback) => {
    if(data && data.playerID){
        await Player.findByIdAndUpdate(data.playerID, {
            isActive: true,
            lastLogOn: new Date()
        });
    }
    callback({ success: true });
});
}