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
        const startedAt = Date.now();
        console.log('[character_builder] request start', {
            socketId: socket.id,
            characterID
        });
        
        // Validate input
        if (!characterID) {
            console.warn('[character_builder] missing characterID', { socketId: socket.id });
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
            console.log('[character_builder] request success', {
                socketId: socket.id,
                characterID,
                durationMs: Date.now() - startedAt
            });
            callback({ 
                success: true, 
                character: character 
            });
            
        } catch (error) {
            console.error('[character_builder] request failed', {
                socketId: socket.id,
                characterID,
                durationMs: Date.now() - startedAt,
                error: error.message
            });
            
            callback({ 
                success: false, 
                message: error.message 
            });
        }
    });
    
};
