const express = require("express");
const router = express.Router();

module.export = (socket) => {
    socket.on("admin", async (data, callback) => {
        const player_ID = sessionStorage.getItem("player_ID");

        try {
            const player = await Player.findById(player_ID);
            if (!player) {
                return callback({ success: false, error: "Player not found" });
            }
            if (player.role !== 'admin') {
                return callback({ success: false, error: "You do not have admin permissions" });
            }
            else{
                console.log(player.name + " has admin permissions");
                callback({ success: true, message: "Admin action successful" });
            }}
        catch (error) {
            console.error("Admin action error:", error);
            return callback({ success: false, error: "An error occurred during admin action" });
        }

    })



}