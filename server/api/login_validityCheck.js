const Player = require(`../data/mongooseDataStructure/player`)

module.exports = (socket)=> {

    socket.on("login_validityCheck", async (data, callback) => {
        const {playerID, sessionID} = data

        try{
            const player = await Player.findById(playerID)
            if(player._id.toString() == playerID & player.sessionID == sessionID){
                console.log(`Success\nPlayerID: ${playerID}\nSessionID: ${sessionID}`)
                callback({sucess:true, message:`This player has been validated`})
            }
            else{
                callback({sucess:false, message: `This player has been invalidated`})
            }

        }
        catch(error){
            console.error(`Validity Error:${error}`) 
            callback({success:false, error:"An error has occured "})
        }

    }

)}