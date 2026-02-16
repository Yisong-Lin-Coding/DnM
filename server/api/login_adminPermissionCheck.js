const Player = require(`../data/mongooseDataStructure/player`)

module.exports = (socket) => {

    socket.on(`login_adminPermissionCheck`, async (data,callback) =>{
        const playerID = String(data?.playerID || "").trim();

        if (!playerID) {
            return callback({success:false, message: "Missing player ID"});
        }

        try {
            const player = await Player.findById(playerID).select("role");
            if(!player){
                return callback({success:false, message: "This player does not exist"});
            }
            
            if(player.role === `admin`) {
                return callback({success:true, message:`This player is an admin`});
            }

            return callback({success:false, message:`This player is not an admin`});
        } catch (error) {
            console.error("login_adminPermissionCheck error:", error);
            return callback({success:false, message:"Unable to verify admin permission"});
        }
    });
};
