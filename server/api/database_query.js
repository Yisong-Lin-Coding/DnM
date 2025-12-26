const Item = require('../data/mongooseDataStructure/item');
const Class = require('../data/mongooseDataStructure/class');
const Race = require('../data/mongooseDataStructure/race');
const Player = require('../data/mongooseDataStructure/player');
const Character = require('../data/mongooseDataStructure/character');
const Background = require('../data/mongooseDataStructure/background');

// Define all available models here - just add new ones to this array
const MODELS = {
    'items': Item,
    'classes': Class,
    'races': Race,
    'players': Player,
    'characters': Character,
    'backgrounds': Background,
    // Add new models here as you expand:
    // 'spells': Spell,
    // 'monsters': Monster,
    // 'players': Player,
};

module.exports = (socket) => {

    socket.on('database_query', async (data, callback) => {
        const { collection, operation, filter, options } = data;

        try {
            // Get the model from the MODELS object
            const Model = MODELS[collection];
            
            if (!Model) {
                callback({ 
                    success: false, 
                    message: `Invalid collection: ${collection}. Available collections: ${Object.keys(MODELS).join(', ')}` 
                });
                return;
            }

            let result;

            // Handle different operations
            switch(operation) {
                case 'findAll':
                    result = await Model.find(filter || {});
                    if (options?.limit) result = result.slice(0, options.limit);
                    break;

                case 'findOne':
                    result = await Model.findOne(filter || {});
                    if (!result) {
                        callback({ success: false, message: 'Document not found' });
                        return;
                    }
                    break;

                case 'findById':
                    const idField = options?.idField || '_id';
                    const query = { [idField]: filter.id };
                    result = await Model.findOne(query);
                    if (!result) {
                        callback({ success: false, message: 'Document not found' });
                        return;
                    }
                    break;

                case 'count':
                    result = await Model.countDocuments(filter || {});
                    break;

                case 'distinct':
                    if (!options?.field) {
                        callback({ success: false, message: 'Field required for distinct operation' });
                        return;
                    }
                    result = await Model.distinct(options.field, filter || {});
                    break;

                default:
                    callback({ success: false, message: `Invalid operation: ${operation}` });
                    return;
            }

            callback({ success: true, data: result });

        } catch (err) {
            console.error('Database query error:', err);
            callback({ success: false, message: 'Database query failed', error: err.message });
        }
    });

};