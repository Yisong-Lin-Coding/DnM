const Player = require('../data/mongooseDataStructure/player')
const path = require("path");
const mongoose = require("mongoose")


module.exports = (socket) => {
socket.on("playerData_logOn", async (data) => {
    if(data && data.playerID){
        await Player.findByIdAndUpdate(data.playerID, {
            isActive: true,
            lastLogin: new Date()
        });
    }
});
}