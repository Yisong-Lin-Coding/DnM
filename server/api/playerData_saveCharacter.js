const Character = require(`../data/mongooseDataStructure/character`)
const Player = require('../data/mongooseDataStructure/player')
const ClassModel = require('../data/mongooseDataStructure/class');
const SubclassModel = require('../data/mongooseDataStructure/subclass');
const RaceModel = require('../data/mongooseDataStructure/race');
const SubraceModel = require('../data/mongooseDataStructure/subrace');
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

        // --- Authoritative compute: resolve refs and compute derived fields ---
        const getDoc = async (Model, id) => {
            if (!id || !mongoose.isValidObjectId(id)) return null;
            try { return await Model.findById(id).lean(); } catch { return null; }
        };

        const level = parseInt(character.level, 10) || 1;
        const cls = await getDoc(ClassModel, character.class);
        const subcls = await getDoc(SubclassModel, character.subclass);
        const race = await getDoc(RaceModel, character.race);
        const subrace = await getDoc(SubraceModel, character.subrace);

        // Final stats (core six) from base + modifiers
        const baseStats = character.stats || {};
        const classMods = (cls && cls.baseStatModifier) || {};
        const raceMods = (race && race.abilityScoreModifiers) || {};
        const subraceMods = (subrace && subrace.abilityScoreModifiers) || {};
        const STAT_KEYS = ['str','dex','con','int','wis','cha'];
        const finalStats = {};
        for (const k of STAT_KEYS) {
            const base = parseInt(baseStats[k], 10) || 0;
            finalStats[k] = base + (classMods[k] || 0) + (raceMods[k] || 0) + (subraceMods[k] || 0);
        }

        // Resources
        const resourceBase = (cls && cls.resourceBase) || { HP: 0, MP: 0, STA: 0 };
        const resourceLevelUp = (cls && cls.resourceLevelUp) || { HP: 0, MP: 0, STA: 0 };
        const DEX = finalStats.dex || 0;
        const WIS = finalStats.wis || 0;
        const CON = finalStats.con || 0;
        const maxSTA = Math.floor(2 * DEX * (1 + (resourceBase.STA || 0) + ((level / 2) * (resourceLevelUp.STA || 0))));
        const maxMP = Math.floor(WIS * (1 + (resourceBase.MP || 0) + ((level / 2) * (resourceLevelUp.MP || 0))));
        const maxHP = Math.floor(CON * (1 + (resourceBase.HP || 0) + ((level / 2) * (resourceLevelUp.HP || 0))));

        // Normalize proficiencies
        const profOut = {
            armor: Array.isArray(cls?.baseProficiencies?.armor) ? cls.baseProficiencies.armor : [],
            weapons: Array.isArray(cls?.baseProficiencies?.weapons) ? cls.baseProficiencies.weapons : [],
            tools: Array.isArray(cls?.baseProficiencies?.tools) ? cls.baseProficiencies.tools : [],
            abilityScore: Array.isArray(cls?.baseProficiencies?.abilityScore) ? cls.baseProficiencies.abilityScore : [],
            skills: [],
        };
        const chosenMap = character.skills?.proficiencies || {};
        const skillOptions = cls?.choices?.proficiencies?.skills?.options || [];
        profOut.skills = Object.keys(chosenMap).filter(k => skillOptions.includes(k));

        // Languages from race/subrace
        const langs = [
            ...(Array.isArray(race?.languages) ? race.languages : []),
            ...(Array.isArray(subrace?.languages) ? subrace.languages : []),
        ];
        const languagesMap = {};
        langs.forEach(l => { languagesMap[l] = 'native'; });

        // Apply computed fields and normalized skills to incoming character
        character.playerId = playerID;
        character.HP = {
            current: Math.max(0, Math.min(character.HP?.current ?? maxHP, maxHP)),
            max: maxHP,
            temp: character.HP?.temp || 0
        };
        character.MP = {
            current: Math.max(0, Math.min(character.MP?.current ?? maxMP, maxMP)),
            max: maxMP,
            temp: character.MP?.temp || 0
        };
        character.STA = {
            current: Math.max(0, Math.min(character.STA?.current ?? maxSTA, maxSTA)),
            max: maxSTA,
            temp: character.STA?.temp || 0
        };

        character.skills = {
            active: character.skills?.active || {},
            passive: character.skills?.passive || {},
            proficiencies: profOut,
            languages: languagesMap,
        };

        // --- Clean character ---
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