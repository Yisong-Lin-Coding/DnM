const express = require("express");
const router = express.Router();
const Player = require("../data/mongooseDataStructure/player");

module.exports = (socket) => {
    socket.on("login", async (data, callback) => {
        const { username, password } = data;

        try {
            const player = await Player.findOne({ username, password });
            if (player) {
            
                console.log(player._id.toString())
                callback({ success: true, userID: player._id.toString() });
                
            } else {
                // Login failed
                callback({ success: false, error: "Invalid username or password" });
            }
        }
        catch (error) {
            console.error("Login error:", error);
            callback({ success: false, error: "An error occurred during login" });
        }

    })
}