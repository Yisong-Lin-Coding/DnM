const Player = require("../data/mongooseDataStructure/player");

module.exports = (socket) => {
    socket.on("login", async (data, callback) => {
        const username = String(data?.username || "").trim();
        const password = String(data?.password || "");

        if (!username || !password) {
            return callback({ success: false, error: "Username and password are required" });
        }

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
