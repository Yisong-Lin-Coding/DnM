const Player = require(`../data/mongooseDataStructure/player`)

module.exports = (socket)=> {

    socket.on("login_validityCheck", async (data, callback) => {
        const playerID = String(data?.playerID || "").trim();
        const sessionID = String(data?.sessionID || "").trim();

        if (!playerID || !sessionID) {
            return callback({success:false, message:"playerID and sessionID are required"});
        }

        try{
            const player = await Player.findById(playerID).select("sessionID");
            if(player && player.sessionID === sessionID){
                console.log(`Success\nPlayerID: ${playerID}\nSessionID: ${sessionID}`)
                callback({success:true, message:`This player has been validated`})
            }
            else{
                callback({success:false, message: `This player has been invalidated`})
            }

        }
        catch (error){
            console.error(`Validity Error:${error}`) 
            callback({success:false, error:"An error has occured"})
        }

    }

)}
