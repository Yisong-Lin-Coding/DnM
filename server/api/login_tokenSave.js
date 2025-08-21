
const Player = require(`../data/mongooseDataStructure/player`)

module.exports = (socket)=> {
    socket.on("login_tokenSave", async (data, callback) => {
        const {playerID, sessionID} = data

        try {
            const player = await Player.findById(playerID)

            if (!player) {
                callback ({success:false, error:"Player not found"});
                return
            }

            player.sessionID = sessionID
            await player.save()
            const updatedplayer = await Player.findById(playerID)
            callback ({success:true, message:`session token saved ${updatedplayer.sessionID}`})
        }
        catch(error){
            callback ({success:false, error:`An error was found\n${error}`})
        }


    })
}