const express = require("express");
const router = express.Router();
const Player = require("../data/mongooseDataStructure/player");

module.exports = (socket) => {
    socket.on("login", async (data, callback) => {
        const { username, password } = data;

        try {
            const player = await Player.findOne({ username, password });
            if (player) {
                // Successful login
                socket.join(player._id.toString()); // Join the player room
                callback({ success: true, userId: player._id });
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