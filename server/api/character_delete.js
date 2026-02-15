const Character = require('../data/mongooseDataStructure/character');
const Player = require('../data/mongooseDataStructure/player');

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

            // Update the player's character list by removing the deleted character ID
            const player = await Player.findOneAndUpdate(
                { characters: characterID },
                { $pull: { characters: characterID } },
                { new: true }
            );

            if (!player) {
                console.warn(`Character ${characterID} deleted but no player found with that character ID in their list.`);
            }

            callback({ success: true, deletedCharacter });
        }
        catch (error) {
            console.error(`Error deleting character: ${error.message}`);
            callback({ success: false, message: error.message });
        }
        



    })


}