const Character = require('../data/mongooseDataStructure/character');

module.exports = (socket) => {

    socket.on(`character_delete`, async (data,callback) =>{
        const {characterID} = data
        if (!characterID) {
            callback({ success: false, message: 'No character ID provided' });
        }
        try {
            const deletedCharacter = await Character.findByIdAndDelete(characterID);
            if (!deletedCharacter) {
                callback({ success: false, message: 'Character not found' });
                return;
            }
            callback({ success: true, deletedCharacter });
        }
        catch (error) {
            console.error(`Error deleting character: ${error.message}`);
            callback({ success: false, message: error.message });
        }
        



    })


}