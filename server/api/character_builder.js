const CharacterBuilder = require('../worldEngine/Character/characterbuilder');

/**
 * Character Builder Socket Handler
 * 
 * Handles the 'character_builder' socket event
 * Builds a fully hydrated CHARACTER instance from a character ID
 */
module.exports = (socket) => {
    
    socket.on('character_builder', async (data, callback) => {
        const { characterID } = data;
        
        // Validate input
        if (!characterID) {
            return callback({ 
                success: false, 
                message: 'characterID is required' 
            });
        }
        
        try {
            // Create builder with socket instance
            const builder = new CharacterBuilder(socket);
            
            // Build character from ID
            const character = await builder.buildFromId(characterID);
            
            // Return success
            callback({ 
                success: true, 
                character: character 
            });
            
        } catch (error) {
            console.error(`Error building character ${characterID}:`, error.message);
            
            callback({ 
                success: false, 
                message: error.message 
            });
        }
    });
    
};
