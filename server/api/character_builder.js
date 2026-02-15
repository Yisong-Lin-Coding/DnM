const CharacterBuilder = require('../worldEngine/Character/characterbuilder');


module.exports = (socket) => {

    socket.on(`character_builder`, async (data,callback) =>{
        const {characterID} = data
        try {
            const builder = new CharacterBuilder();
            const character = await builder.buildFromId(characterID);
            callback({ success: true, character });
        } catch (error) {
            console.error(`Error building character: ${error.message}`);
            callback({ success: false, message: error.message });
        }

        



    })


}