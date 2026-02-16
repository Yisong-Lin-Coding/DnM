const Player = require("../data/mongooseDataStructure/player");

module.exports = (socket) => {
    socket.on("signup", async (data, callback) => {
        const username = String(data?.username || "").trim();
        const password = String(data?.password || "");
        const sessionID = String(data?.sessionID || "").trim();

        if (!username || !password) {
            return callback({ success: false, error: "Username and password are required" });
        }

        if (!sessionID) {
            return callback({
                success: false,
                error: "Session not established. Please refresh and try again.",
            });
        }

        try {
            const existingUser = await Player.findOne({ username });
            if (existingUser) {
                return callback({ success: false, error: "Username already exists" });
            }

            // sessionID is unique: clear stale ownership before assigning.
            await Player.updateMany({ sessionID }, { $unset: { sessionID: "" } });

            const newPlayer = new Player({
                username,
                password,
                sessionID,
            });

            await newPlayer.save();

            return callback({
                success: true,
                userID: newPlayer._id.toString(),
                userId: newPlayer._id.toString(),
            });
        } catch (error) {
            console.error("Signup error:", error);

            if (error?.code === 11000 && error?.keyPattern?.sessionID) {
                return callback({
                    success: false,
                    error: "Session is already active. Please refresh and try again.",
                });
            }

            return callback({ success: false, error: "An error occurred during signup" });
        }
    });
};
