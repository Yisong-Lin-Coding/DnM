const Character = require(`../data/mongooseDataStructure/character`)
const Player = require('../data/mongooseDataStructure/player')
const path = require("path");
const mongoose = require("mongoose")

module.exports = (socket) => {

    socket.on(`playerData_saveCharacter`, async (data,callback) =>{
        const { character, playerID} = data
        try {
            const player = await Player.findById(playerID);
            if (!player) {
                return callback({ success: false, message: "Player not found" });
            }

            const hasId = character._id && mongoose.isValidObjectId(character._id);
            let savedCharacter;

            if (hasId) {
                // --- Character Exists? ---
                const exists = await Character.findById(character._id);

                if (exists) {
                    // --- Update Existing Character ---
                    savedCharacter = await Character.findByIdAndUpdate(
                        character._id,
                        character,
                        { new: true }
                    );
                } else {
                    // --- ID provided but not found → create new ---
                    savedCharacter = await Character.create(character);
                }
            } else {
                // --- No ID Provided → create new ---
                savedCharacter = await Character.create(character);
            }

            callback({ success: true, character: savedCharacter });

        } catch (ERR) {
            console.log("ERROR saving character:", ERR);
            callback({ success: false, message: "Server error", error: ERR });
        }
    })


}