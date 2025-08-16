const express = require("express");
const Player = require("../data/mongooseDataStructure/player");

module.exports = (socket) => {
    socket.on("signup", async (data, callback) => {
        const { username, password } = data;
        try {
            const existingUser = await Player.findOne({ username });
            if (existingUser) {
                return callback({ success: false, error: "Username already exists" });
            }}
        catch (error) {
            console.error("Signup error:", error);
            return callback({ success: false, error: "An error occurred during signup" });
        }
        try {
            // Create a new player
            const newPlayer = new Player({
                username: username,
                password: password                 
                
            });
            await newPlayer.save();

            socket.join(newPlayer._id.toString()); // Join the player room
            callback({ success: true, userId: newPlayer._id });
            sessionStorage.setItem("player_ID", Json.stringify(player._id));
        } catch (error) {
            console.error("Signup error:", error);
            callback({ success: false, error: "An error occurred during signup" });
        }
        

    })
}