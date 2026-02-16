const Player = require(`../data/mongooseDataStructure/player`)

module.exports = (socket)=> {
    socket.on("login_tokenSave", async (data, callback) => {
        const playerID = String(data?.playerID || "").trim();
        const sessionID = String(data?.sessionID || "").trim();

        if (!playerID || !sessionID) {
            return callback({success:false, error:"playerID and sessionID are required"});
        }

        try {
            const player = await Player.findById(playerID);

            if (!player) {
                return callback ({success:false, error:"Player not found"});
            }

            // sessionID is unique across players.
            await Player.updateMany(
                { sessionID, _id: { $ne: player._id } },
                { $unset: { sessionID: "" } }
            );

            player.sessionID = sessionID;
            await player.save();
            callback ({success:true, message:`session token saved ${sessionID}`});
        }
        catch(error){
            console.error("login_tokenSave error:", error);
            callback ({success:false, error:"An error occurred while saving session token"});
        }


    });
};
