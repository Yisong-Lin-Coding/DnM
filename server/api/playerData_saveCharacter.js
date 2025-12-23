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

            await Player.findByIdAndUpdate(
                playerID,
                { $addToSet: { characters: savedCharacter._id } }
                );

            const hasId = character._id && mongoose.isValidObjectId(character._id);

            character.playerID = playerID
            
            let characterCleaner = (obj) =>{

                if(Array.isArray(obj)){
                    return obj
                    .map(attribute => characterCleaner(attribute))
                    .filter(attribute => attribute !== null)

                }
                if (obj !== null && typeof obj === "object") {
                    const result = {};
                    for (const key in obj) {
                    const value = characterCleaner(obj[key]); // recurse into sub-objects

                    // Delete if empty string
                    if (value === "") continue;

                    // Delete empty array
                    if (Array.isArray(value) && value.length === 0) continue;

                    // Delete empty object
                    if (typeof value === "object" && value !== null && Object.keys(value).length === 0)
                        continue;

                    result[key] = value;
                    }
                    return result;
                }

                // Base case: return the value as-is
                return obj;

            }

            const cleanedCharacter = characterCleaner(character)
            cleanedCharacter.playerId = playerID;

            let savedCharacter;

            if (hasId) {
                // --- Character Exists? ---
                const exists = await Character.findById(character._id);
                

                if (exists) {
                    // --- Update Existing Character ---
                    savedCharacter = await Character.findByIdAndUpdate(
                        cleanedCharacter._id,
                        cleanedCharacter,
                        { new: true }
                    );
                } else {
                    // --- ID provided but not found → create new ---
                    savedCharacter = await Character.create(cleanedCharacter);
                }
            } else {
                // --- No ID Provided → create new ---
                savedCharacter = await Character.create(cleanedCharacter);
            }

            callback({ success: true, character: savedCharacter });

        } catch (ERR) {
            console.log("ERROR saving character:", ERR);
            callback({ success: false, message: "Server error", error: ERR });
        }
    })


}