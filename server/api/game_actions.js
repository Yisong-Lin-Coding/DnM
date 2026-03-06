/**
 * Game Actions API - Socket.IO handlers for turn-based action system
 * 
 * Handles:
 * - Action selection and staging
 * - Action confirmation and execution
 * - Dice roll broadcasting
 * - Turn management
 */

const ActionProcessor = require('../worldEngine/actionProcessor');
const DiceRoller = require('../worldEngine/diceRoller');

// In-memory game sessions (In production, this would be in a proper state manager/database)
const gameSessions = new Map();

function gameActionsAPI(socket) {
    
    /**
     * Join a game session
     */
    socket.on('game:join', async (data, callback) => {
        try {
            const { gameId, characterId, playerId, character } = data;
            
            if (!gameId || !characterId || !playerId) {
                return callback?.({ success: false, error: 'Missing required fields' });
            }

            // Join the game room
            socket.join(`game:${gameId}`);
            
            // Store player info on socket
            socket.gameId = gameId;
            socket.playerId = playerId;
            socket.characterId = characterId;

            // Get or create game session
            if (!gameSessions.has(gameId)) {
                gameSessions.set(gameId, {
                    id: gameId,
                    players: new Map(),
                    characters: new Map(),
                    turnOrder: [],
                    currentTurnIndex: 0,
                    pendingActions: new Map(),
                    state: 'waiting' // waiting, active, ended
                });
            }

            const session = gameSessions.get(gameId);
            
            // Add player to session
            if (!session.players.has(playerId)) {
                session.players.set(playerId, {
                    id: playerId,
                    socketId: socket.id,
                    characterIds: []
                });
            }

            const player = session.players.get(playerId);
            if (!player.characterIds.includes(characterId)) {
                player.characterIds.push(characterId);
            }

            // Add character to session if provided
            if (character && !session.characters.has(characterId)) {
                // Create a minimal character object for initiative rolling
                const charData = {
                    id: characterId,
                    name: character.name || character.characterName || `Character ${characterId}`,
                    stats: character.stats || {
                        DEX: { modifier: 0 }
                    },
                    position: character.position || { x: 0, y: 0 }
                };
                session.characters.set(characterId, charData);
                console.log(`Added character ${charData.name} to session`);
            }

            console.log(`Player ${playerId} joined game ${gameId} with character ${characterId}`);
            console.log(`Session now has ${session.characters.size} characters`);

            // Send session state to player
            callback?.({ 
                success: true, 
                session: getSessionState(session, playerId)
            });

            // Notify other players
            socket.to(`game:${gameId}`).emit('game:playerJoined', {
                playerId,
                characterId
            });

        } catch (error) {
            console.error('Error joining game:', error);
            callback?.({ success: false, error: error.message });
        }
    });

    /**
     * Start the game and roll initiative
     */
    socket.on('game:start', async (data, callback) => {
        try {
            const { gameId } = data;
            const session = gameSessions.get(gameId);

            if (!session) {
                return callback?.({ success: false, error: 'Game session not found' });
            }

            if (session.state !== 'waiting') {
                return callback?.({ success: false, error: 'Game already started' });
            }

            // Roll initiative for all characters
            const characters = Array.from(session.characters.values());
            
            if (characters.length === 0) {
                return callback?.({ success: false, error: 'No characters in game session' });
            }

            console.log(`Rolling initiative for ${characters.length} characters:`, characters.map(c => c.name || c.id));
            const initiativeRolls = DiceRoller.rollGroupInitiative(characters);

            // Sort by initiative (highest first)
            initiativeRolls.sort((a, b) => b.total - a.total);
            
            // Set turn order
            session.turnOrder = initiativeRolls.map(roll => roll.characterId);
            session.currentTurnIndex = 0;
            session.state = 'active';

            console.log(`Game ${gameId} started. Initiative order:`, session.turnOrder);

            // Initialize acknowledgment tracking
            session.pendingAcknowledgments = new Map();
            session.players.forEach((player, playerId) => {
                session.pendingAcknowledgments.set(playerId, {
                    type: 'initiative',
                    acknowledged: false
                });
            });

            // Broadcast initiative rolls to all players
            const io = socket.server;
            io.to(`game:${gameId}`).emit('game:initiativeRolls', {
                rolls: initiativeRolls,
                requiresAck: true
            });

            console.log(`Waiting for ${session.pendingAcknowledgments.size} players to acknowledge initiative rolls...`);

            callback?.({ success: true, initiativeRolls });

        } catch (error) {
            console.error('Error starting game:', error);
            callback?.({ success: false, error: error.message });
        }
    });

    /**
     * Select an action (staging)
     */
    socket.on('game:selectAction', async (data, callback) => {
        try {
            const { gameId, characterId, action } = data;
            const session = gameSessions.get(gameId);

            if (!session) {
                return callback?.({ success: false, error: 'Game session not found' });
            }

            // Verify it's this character's turn
            const currentCharId = session.turnOrder[session.currentTurnIndex];
            if (currentCharId !== characterId) {
                return callback?.({ success: false, error: 'Not your turn' });
            }

            // Stage the action
            session.pendingActions.set(characterId, action);

            console.log(`Character ${characterId} selected action:`, action.type);

            callback?.({ success: true });

        } catch (error) {
            console.error('Error selecting action:', error);
            callback?.({ success: false, error: error.message });
        }
    });

    /**
     * Confirm and execute an action
     */
    socket.on('game:confirmAction', async (data, callback) => {
        try {
            const { gameId, characterId, target } = data;
            const session = gameSessions.get(gameId);

            if (!session) {
                return callback?.({ success: false, error: 'Game session not found' });
            }

            // Verify it's this character's turn
            const currentCharId = session.turnOrder[session.currentTurnIndex];
            if (currentCharId !== characterId) {
                return callback?.({ success: false, error: 'Not your turn' });
            }

            // Get staged action
            const action = session.pendingActions.get(characterId);
            if (!action) {
                return callback?.({ success: false, error: 'No action selected' });
            }

            // Process the action
            const actionProcessor = new ActionProcessor({
                characters: session.characters,
                log: (msg) => console.log(`[Game ${gameId}] ${msg}`)
            });

            const actionData = {
                type: action.type,
                target: target || action.target,
                options: action.options || {}
            };

            const result = actionProcessor.processAction(characterId, actionData);

            console.log(`Action executed:`, result);

            // Clear the pending action
            session.pendingActions.delete(characterId);

            // Broadcast dice rolls to all players
            if (result.rolls && result.rolls.length > 0) {
                // Initialize acknowledgment tracking for this action
                session.pendingAcknowledgments = new Map();
                session.players.forEach((player, playerId) => {
                    session.pendingAcknowledgments.set(playerId, {
                        type: 'action',
                        acknowledged: false
                    });
                });

                const io = socket.server;
                io.to(`game:${gameId}`).emit('game:diceRolls', {
                    rolls: result.rolls,
                    actionResult: result,
                    requiresAck: true
                });

                console.log(`Waiting for players to view action dice rolls...`);

                // Fallback: if no one acknowledges after 10 seconds, proceed anyway
                setTimeout(() => {
                    if (session.pendingAcknowledgments) {
                        console.log('Timeout reached, proceeding with turn end regardless of acknowledgments');
                        session.pendingAcknowledgments = null;
                        endTurn(gameId, session, socket);
                    }
                }, 10000);
            } else {
                // No dice rolls, end turn immediately
                endTurn(gameId, session, socket);
            }

            callback?.({ success: true, result });

        } catch (error) {
            console.error('Error confirming action:', error);
            callback?.({ success: false, error: error.message });
        }
    });

    /**
     * Acknowledge dice roll viewing
     */
    socket.on('game:acknowledgeDiceRoll', async (data, callback) => {
        try {
            const { gameId, playerId, rollType } = data;
            const session = gameSessions.get(gameId);

            if (!session) {
                return callback?.({ success: false, error: 'Game session not found' });
            }

            // Mark this player as having acknowledged
            if (session.pendingAcknowledgments && session.pendingAcknowledgments.has(playerId)) {
                session.pendingAcknowledgments.get(playerId).acknowledged = true;
                console.log(`Player ${playerId} acknowledged ${rollType} roll`);
            }

            // Check if all players have acknowledged
            let allAcknowledged = true;
            let acknowledgedCount = 0;
            let totalCount = 0;

            if (session.pendingAcknowledgments) {
                session.pendingAcknowledgments.forEach((ack) => {
                    totalCount++;
                    if (ack.acknowledged) {
                        acknowledgedCount++;
                    } else {
                        allAcknowledged = false;
                    }
                });
            }

            console.log(`${acknowledgedCount}/${totalCount} players acknowledged`);

            // If all acknowledged OR majority acknowledged after timeout, proceed
            if (allAcknowledged || acknowledgedCount >= Math.ceil(totalCount / 2)) {
                console.log('All or majority acknowledged, proceeding...');
                session.pendingAcknowledgments = null;

                // Proceed based on roll type
                if (rollType === 'initiative') {
                    // Small delay for smooth transition
                    setTimeout(() => {
                        broadcastTurnStart(gameId, session, socket);
                    }, 1000);
                } else if (rollType === 'action') {
                    // Action rolls already handled in confirmAction
                }
            }

            callback?.({ success: true, allAcknowledged });

        } catch (error) {
            console.error('Error acknowledging dice roll:', error);
            callback?.({ success: false, error: error.message });
        }
    });

    /**
     * Cancel staged action
     */
    socket.on('game:cancelAction', async (data, callback) => {
        try {
            const { gameId, characterId } = data;
            const session = gameSessions.get(gameId);

            if (!session) {
                return callback?.({ success: false, error: 'Game session not found' });
            }

            session.pendingActions.delete(characterId);

            callback?.({ success: true });

        } catch (error) {
            console.error('Error canceling action:', error);
            callback?.({ success: false, error: error.message });
        }
    });

    /**
     * Get available actions for a character
     */
    socket.on('game:getAvailableActions', async (data, callback) => {
        try {
            const { gameId, characterId } = data;
            const session = gameSessions.get(gameId);

            if (!session) {
                return callback?.({ success: false, error: 'Game session not found' });
            }

            const character = session.characters.get(characterId);
            if (!character) {
                return callback?.({ success: false, error: 'Character not found' });
            }

            // Build list of available actions
            const actions = buildAvailableActions(character, session);

            callback?.({ success: true, actions });

        } catch (error) {
            console.error('Error getting available actions:', error);
            callback?.({ success: false, error: error.message });
        }
    });

    /**
     * Leave game
     */
    socket.on('game:leave', async (data, callback) => {
        try {
            const { gameId } = data;
            
            socket.leave(`game:${gameId}`);
            
            // Notify other players
            socket.to(`game:${gameId}`).emit('game:playerLeft', {
                playerId: socket.playerId,
                characterId: socket.characterId
            });

            callback?.({ success: true });

        } catch (error) {
            console.error('Error leaving game:', error);
            callback?.({ success: false, error: error.message });
        }
    });

    /**
     * Handle disconnect
     */
    socket.on('disconnect', () => {
        if (socket.gameId) {
            socket.to(`game:${socket.gameId}`).emit('game:playerDisconnected', {
                playerId: socket.playerId,
                characterId: socket.characterId
            });
        }
    });
}

/**
 * Helper: End turn and start next turn
 */
function endTurn(gameId, session, socket) {
    // Clear pending acknowledgments
    session.pendingAcknowledgments = null;
    
    session.currentTurnIndex++;
    
    if (session.currentTurnIndex >= session.turnOrder.length) {
        session.currentTurnIndex = 0;
        
        // Broadcast new round
        const io = socket.server;
        io.to(`game:${gameId}`).emit('game:newRound', {
            round: Math.floor(session.currentTurnIndex / session.turnOrder.length) + 1
        });
    }

    broadcastTurnStart(gameId, session, socket);
}

/**
 * Helper: Broadcast turn start to all players
 */
function broadcastTurnStart(gameId, session, socket) {
    const currentCharId = session.turnOrder[session.currentTurnIndex];
    const character = session.characters.get(currentCharId);

    if (!character) {
        console.error(`Character ${currentCharId} not found in session`);
        return;
    }

    const turnData = {
        characterId: currentCharId,
        characterName: character.name,
        turnIndex: session.currentTurnIndex,
        turnOrder: session.turnOrder
    };

    // Broadcast to all players in the game
    if (socket) {
        const io = socket.server;
        io.to(`game:${gameId}`).emit('game:turnStart', turnData);
    }
}

/**
 * Helper: Build list of available actions for a character
 */
function buildAvailableActions(character, session) {
    const actions = [];

    // Main actions
    actions.push(
        {
            id: 'attack',
            name: 'Attack',
            type: 'attack',
            category: 'main',
            description: 'Make a melee or ranged attack',
            icon: '⚔️',
            requiresTarget: true,
            available: true
        },
        {
            id: 'cast',
            name: 'Cast Spell',
            type: 'cast',
            category: 'main',
            description: 'Cast a spell',
            icon: '✨',
            requiresTarget: true,
            available: character.spells && character.spells.length > 0
        },
        {
            id: 'dodge',
            name: 'Dodge',
            type: 'dodge',
            category: 'main',
            description: 'Impose disadvantage on attack rolls against you',
            icon: '🛡️',
            available: true
        },
        {
            id: 'help',
            name: 'Help',
            type: 'help',
            category: 'main',
            description: 'Give an ally advantage on their next check or attack',
            icon: '🤝',
            requiresTarget: true,
            available: true
        }
    );

    // Movement actions
    actions.push(
        {
            id: 'move',
            name: 'Move',
            type: 'move',
            category: 'movement',
            description: 'Move up to your speed',
            icon: '🏃',
            available: true
        },
        {
            id: 'dash',
            name: 'Dash',
            type: 'dash',
            category: 'main',
            description: 'Double your movement speed',
            icon: '💨',
            available: true
        },
        {
            id: 'disengage',
            name: 'Disengage',
            type: 'disengage',
            category: 'main',
            description: 'Move without provoking opportunity attacks',
            icon: '↩️',
            available: true
        }
    );

    // Other actions
    actions.push(
        {
            id: 'hide',
            name: 'Hide',
            type: 'hide',
            category: 'main',
            description: 'Make a Stealth check to hide',
            icon: '👤',
            available: true
        },
        {
            id: 'ready',
            name: 'Ready',
            type: 'ready',
            category: 'main',
            description: 'Prepare an action for a specific trigger',
            icon: '⌛',
            available: true
        },
        {
            id: 'use',
            name: 'Use Item',
            type: 'use',
            category: 'main',
            description: 'Use an item from your inventory',
            icon: '📦',
            available: character.inventory && character.inventory.length > 0
        }
    );

    return actions;
}

/**
 * Helper: Get session state for a specific player
 */
function getSessionState(session, playerId) {
    return {
        id: session.id,
        state: session.state,
        turnOrder: session.turnOrder,
        currentTurnIndex: session.currentTurnIndex,
        currentTurn: session.turnOrder[session.currentTurnIndex],
        playerCharacters: session.players.get(playerId)?.characterIds || []
    };
}

module.exports = gameActionsAPI;
