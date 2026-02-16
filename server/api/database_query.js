const mongoose = require('mongoose');
const Item = require('../data/mongooseDataStructure/item');
const Class = require('../data/mongooseDataStructure/class');
const Subclass = require('../data/mongooseDataStructure/subclass');
const Race = require('../data/mongooseDataStructure/race');
const SubRace = require('../data/mongooseDataStructure/subrace');
const Player = require('../data/mongooseDataStructure/player');
const Character = require('../data/mongooseDataStructure/character');
const Background = require('../data/mongooseDataStructure/background');
const Campaign = require('../data/mongooseDataStructure/campaign');
const GameSave = require('../data/mongooseDataStructure/gameSave');

// Define all available models here
const MODELS = {
    items: Item,
    classes: Class,
    subclasses: Subclass,
    races: Race,
    subraces: SubRace,
    players: Player,
    characters: Character,
    backgrounds: Background,
    campaigns: Campaign,
    gameSaves: GameSave,
    // Add new models here as needed
};

module.exports = (socket) => {

    socket.on('database_query', async (data, callback) => {
        const { collection, operation, filter = {}, options = {} } = data;

        try {
            // 1️⃣ Check collection
            const Model = MODELS[collection];
            if (!Model) {
                callback({ 
                    success: false, 
                    message: `Invalid collection: ${collection}. Available collections: ${Object.keys(MODELS).join(', ')}`
                });
                return;
            }

            let result;

            // 2️⃣ Handle operations
            switch (operation) {

                case 'findAll':
                    result = await Model.find(filter);
                    if (options.limit) result = result.slice(0, options.limit);
                    break;

                case 'findOne':
                    result = await Model.findOne(filter);
                    if (!result) {
                        callback({ success: false, message: 'Document not found' });
                        return;
                    }
                    break;

                case 'findById':
                    const idValue = filter._id || filter.id || filter.characterID;
                    if (!idValue) {
                        callback({ success: false, message: 'No ID provided for findById' });
                        return;
                    }

                    console.log('Server: looking for _id =', idValue);

                    // Use findById to auto-cast string to ObjectId
                    result = await Model.findById(idValue);

                    if (!result) {
                        console.log('Server: document not found!');
                        callback({ success: false, message: 'Document not found' });
                        return;
                    }
                    break;

                case 'count':
                    result = await Model.countDocuments(filter);
                    break;

                case 'distinct':
                    if (!options.field) {
                        callback({ success: false, message: 'Field required for distinct operation' });
                        return;
                    }
                    result = await Model.distinct(options.field, filter);
                    break;

                default:
                    callback({ success: false, message: `Invalid operation: ${operation}` });
                    return;
            }

            // 3️⃣ Return result
            callback({ success: true, data: result });

        } catch (err) {
            console.error('Database query error:', err);
            callback({ success: false, message: 'Database query failed', error: err.message });
        }
    });
};
