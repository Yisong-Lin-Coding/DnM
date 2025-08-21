const Player = require(`../data/mongooseDataStructure/player`)

module.exports = (socket)=> {

    socket.on("validityCheck_login", async (data, callback) => {
        const {playerID, sessionID} = data

        try{
            const player = await Player.findByID(playerID)
            if(player._id.toString() == playerID & player.sessionID == sessionID){
                console.log(`Success\nPlayerID: ${playerID}\nSessionID: ${sessionID}`)
                callback({sucess:true, message:`This player has been validated`})
            }
            else{
                callback({sucess:false, message: `This player has been invalidated`})
            }

        }
        catch{
            console.error("Validity Error", error) 
            callback({success:false, error:"An error has occured "})
        }

    }

)}