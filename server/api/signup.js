const express = require("express");
const Player = require("../data/mongooseDataStructure/player");

module.exports = (socket) => {
    socket.on("signup", async (data, callback) => {
        const { username, password } = data;
        try {
            // Check if the username or email already exists
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
                password: password,
                role: 'admin', 
                
            });
            await newPlayer.save();

            // Successful signup
            socket.join(newPlayer._id.toString()); // Join the player room
            callback({ success: true, userId: newPlayer._id });
        } catch (error) {
            console.error("Signup error:", error);
            callback({ success: false, error: "An error occurred during signup" });
        }
        

    })
}