const Character = require(`../data/mongooseDataStructure/character`)
const Player = require('../data/mongooseDataStructure/player')
const path = require("path");
const mongoose = require("mongoose")


module.exports = (socket) => {
socket.on("playerData_saveCharacter", async (data, callback) => {
    const { character, playerID } = data;

    try {
        // --- Validate player ---
        const player = await Player.findById(playerID);
        if (!player) {
            return callback({ success: false, message: "Player not found" });
        }

        // --- Clean character ---
        character.playerId = playerID;

        const characterCleaner = (obj) => {
            if (Array.isArray(obj)) {
                return obj
                    .map(attribute => characterCleaner(attribute))
                    .filter(attribute => attribute !== null);
            }
            if (obj !== null && typeof obj === "object") {
                const result = {};
                for (const key in obj) {
                    const value = characterCleaner(obj[key]);

                    if (value === "") continue;
                    if (Array.isArray(value) && value.length === 0) continue;
                    if (typeof value === "object" && value !== null && Object.keys(value).length === 0)
                        continue;

                    result[key] = value;
                }
                return result;
            }
            return obj;
        };

        const cleanedCharacter = characterCleaner(character);

        // --- Save or update character ---
        let savedCharacter;

        if (character._id && mongoose.isValidObjectId(character._id)) {
            savedCharacter = await Character.findOneAndUpdate(
                { _id: character._id },
                { $set: cleanedCharacter },
                { new: true, upsert: true, runValidators: true }
            );
        } else {
            savedCharacter = await Character.create(cleanedCharacter);
        }

        // --- Add character to player's characters array ---
        try{await Player.findByIdAndUpdate(
            playerID,
            { $addToSet: { characters: savedCharacter._id } }
        )}
        catch(err){
                   console.error("ERROR SAVING PLAYER CHARACTER DATA:", err);
                 callback({ success: false, message: err.message || "Server error" });

        }

        // --- Respond to client ---
        callback({ success: true, character: savedCharacter });

    } catch (err) {
        console.error("ERROR saving character:", err);
        callback({ success: false, message: err.message || "Server error" });
    }
});
}