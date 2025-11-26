const Player = require(`../data/mongooseDataStructure/player`)
const Character = require(`../data/mongooseDataStructure/character`)
const path = require("path");

module.exports = (socket) => {

    socket.on(`playerData_saveCharacter`, async (data,callback) =>{
        const character = {data}
        try{
            const newCharacter = new Character(character) 
            await newCharacter.save();
            callback({ success: true});
        }
        catch(ERR){
            console.log(`ERROR @ ${__filename} ${Date.Now} : ${ERR}`)
            callback({success:false, error:ERR})
        }
    })


}