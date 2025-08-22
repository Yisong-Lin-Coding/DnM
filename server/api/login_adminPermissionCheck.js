const Player = require(`../data/mongooseDataStructure/player`)

module.exports = (socket) => {

    socket.on(`login_adminPermissionCheck`, async (data,callback) =>{
        const {playerID} = data
        const player = await Player.findById(playerID)
        if(!player){
            callback({sucess:false, message: 'This player does not exist'})
        }
        
        if(player.role == `admin`) {
            callback({success:true, message:`This player is a admin`})
        }
        else{
            callback({success:false, message:`this player is not a admin`})
        }



    })


}