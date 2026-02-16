const Character = require("../data/mongooseDataStructure/character");
const Player = require("../data/mongooseDataStructure/player");
const Campaign = require("../data/mongooseDataStructure/campaign");

module.exports = (socket) => {
    socket.on("character_delete", async (data, callback) => {
        const { characterID } = data || {};
        if (!characterID) {
            callback({ success: false, message: "No character ID provided" });
            return;
        }

        try {
            const deletedCharacter = await Character.findByIdAndDelete(characterID);
            if (!deletedCharacter) {
                callback({ success: false, message: "Character not found" });
                return;
            }

            // Update the player's character list by removing the deleted character ID
            const player = await Player.findOneAndUpdate(
                { characters: characterID },
                { $pull: { characters: characterID } },
                { new: true }
            );

            if (!player) {
                console.warn(
                    `Character ${characterID} deleted but no player found with that character ID in their list.`
                );
            }

            await Campaign.updateMany(
                {
                    $or: [
                        { "characterAssignments.characterId": deletedCharacter._id },
                        { "characterStates.characterId": deletedCharacter._id },
                    ],
                },
                {
                    $pull: {
                        characterAssignments: { characterId: deletedCharacter._id },
                        characterStates: { characterId: deletedCharacter._id },
                    },
                }
            );

            callback({ success: true, deletedCharacter });
        } catch (error) {
            console.error(`Error deleting character: ${error.message}`);
            callback({ success: false, message: error.message });
        }
    });
};
