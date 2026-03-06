import { useState, useEffect, useCallback, useContext } from 'react';
import { SocketContext } from '../socket.io/context';

/**
 * useGameActions - Hook for managing turn-based actions and dice rolls
 * 
 * @param {string} gameId - Current game session ID
 * @param {string} characterId - Current player's character ID
 * @param {string} playerId - Current player ID
 * @returns {Object} - Game action state and handlers
 */
export const useGameActions = (gameId, characterId, playerId) => {
    const socket = useContext(SocketContext);
    
    // Game state
    const [gameState, setGameState] = useState({
        state: 'waiting', // waiting, active, ended
        turnOrder: [],
        currentTurnIndex: 0,
        currentTurn: null
    });

    // Action state
    const [availableActions, setAvailableActions] = useState([]);
    const [selectedAction, setSelectedAction] = useState(null);
    const [isYourTurn, setIsYourTurn] = useState(false);

    // Dice rolls state
    const [diceRolls, setDiceRolls] = useState([]);
    const [showDiceGallery, setShowDiceGallery] = useState(false);

    /**
     * Join the game session
     */
    const joinGame = useCallback((character = null) => {
        if (!socket || !gameId || !characterId || !playerId) {
            console.warn('Cannot join game: missing required data', { socket: !!socket, gameId, characterId, playerId });
            return;
        }

        console.log('Joining game:', { gameId, characterId, playerId });

        socket.emit('game:join', { 
            gameId, 
            characterId, 
            playerId,
            character // Pass character data to server
        }, (response) => {
            if (response.success) {
                console.log('✅ Successfully joined game:', response.session);
                setGameState(response.session);
            } else {
                console.error('❌ Failed to join game:', response.error);
            }
        });
    }, [socket, gameId, characterId, playerId]);

    /**
     * Start the game and roll initiative
     */
    const startGame = useCallback(() => {
        if (!socket || !gameId) return;

        socket.emit('game:start', { gameId }, (response) => {
            if (response.success) {
                console.log('Game started! Initiative:', response.initiativeRolls);
            } else {
                console.error('Failed to start game:', response.error);
            }
        });
    }, [socket, gameId]);

    /**
     * Select an action
     */
    const selectAction = useCallback((action) => {
        if (!socket || !gameId || !characterId || !isYourTurn) return;

        setSelectedAction(action);

        socket.emit('game:selectAction', { 
            gameId, 
            characterId, 
            action 
        }, (response) => {
            if (!response.success) {
                console.error('Failed to select action:', response.error);
                setSelectedAction(null);
            }
        });
    }, [socket, gameId, characterId, isYourTurn]);

    /**
     * Confirm and execute action
     */
    const confirmAction = useCallback((target = null) => {
        if (!socket || !gameId || !characterId || !selectedAction) return;

        socket.emit('game:confirmAction', { 
            gameId, 
            characterId, 
            target 
        }, (response) => {
            if (response.success) {
                console.log('Action confirmed:', response.result);
                setSelectedAction(null);
            } else {
                console.error('Failed to confirm action:', response.error);
            }
        });
    }, [socket, gameId, characterId, selectedAction]);

    /**
     * Cancel selected action
     */
    const cancelAction = useCallback(() => {
        if (!socket || !gameId || !characterId) return;

        socket.emit('game:cancelAction', { 
            gameId, 
            characterId 
        }, (response) => {
            if (response.success) {
                setSelectedAction(null);
            }
        });
    }, [socket, gameId, characterId]);

    /**
     * Get available actions for current character
     */
    const refreshAvailableActions = useCallback(() => {
        if (!socket || !gameId || !characterId) return;

        socket.emit('game:getAvailableActions', { 
            gameId, 
            characterId 
        }, (response) => {
            if (response.success) {
                setAvailableActions(response.actions);
            } else {
                console.error('Failed to get actions:', response.error);
            }
        });
    }, [socket, gameId, characterId]);

    /**
     * Close dice gallery and acknowledge to server
     */
    const closeDiceGallery = useCallback(() => {
        // Send acknowledgment to server before closing
        if (socket && gameId && playerId && diceRolls.length > 0) {
            // Determine roll type based on the rolls
            const rollType = diceRolls[0]?.description?.includes('Initiative') ? 'initiative' : 'action';
            
            socket.emit('game:acknowledgeDiceRoll', {
                gameId,
                playerId,
                rollType
            }, (response) => {
                if (response?.success) {
                    console.log('Dice roll acknowledged');
                } else {
                    console.error('Failed to acknowledge dice roll');
                }
            });
        }

        setShowDiceGallery(false);
        setDiceRolls([]);
    }, [socket, gameId, playerId, diceRolls]);

    // Socket event listeners
    useEffect(() => {
        if (!socket) return;

        /**
         * Handle initiative rolls
         */
        const handleInitiativeRolls = (data) => {
            console.log('Initiative rolls received:', data.rolls);
            if (data.rolls && data.rolls.length > 0) {
                setDiceRolls(data.rolls);
                setShowDiceGallery(true);
            } else {
                console.warn('Received initiative rolls but no roll data');
            }
        };

        /**
         * Handle turn start
         */
        const handleTurnStart = (data) => {
            console.log('Turn started:', data);
            setGameState(prev => ({
                ...prev,
                currentTurn: data.characterId,
                currentTurnIndex: data.turnIndex,
                turnOrder: data.turnOrder,
                state: 'active'
            }));

            const isMyTurn = data.characterId === characterId;
            setIsYourTurn(isMyTurn);

            if (isMyTurn) {
                refreshAvailableActions();
            }
        };

        /**
         * Handle dice rolls during actions
         */
        const handleDiceRolls = (data) => {
            console.log('Dice rolls received:', data.rolls);
            if (data.rolls && data.rolls.length > 0) {
                setDiceRolls(data.rolls);
                setShowDiceGallery(true);
            } else {
                console.warn('Received dice rolls but no roll data');
            }
        };

        /**
         * Handle new round
         */
        const handleNewRound = (data) => {
            console.log('New round:', data.round);
        };

        /**
         * Handle player joined
         */
        const handlePlayerJoined = (data) => {
            console.log('Player joined:', data);
        };

        /**
         * Handle player left
         */
        const handlePlayerLeft = (data) => {
            console.log('Player left:', data);
        };

        /**
         * Handle player disconnected
         */
        const handlePlayerDisconnected = (data) => {
            console.log('Player disconnected:', data);
        };

        // Register listeners
        socket.on('game:initiativeRolls', handleInitiativeRolls);
        socket.on('game:turnStart', handleTurnStart);
        socket.on('game:diceRolls', handleDiceRolls);
        socket.on('game:newRound', handleNewRound);
        socket.on('game:playerJoined', handlePlayerJoined);
        socket.on('game:playerLeft', handlePlayerLeft);
        socket.on('game:playerDisconnected', handlePlayerDisconnected);

        return () => {
            socket.off('game:initiativeRolls', handleInitiativeRolls);
            socket.off('game:turnStart', handleTurnStart);
            socket.off('game:diceRolls', handleDiceRolls);
            socket.off('game:newRound', handleNewRound);
            socket.off('game:playerJoined', handlePlayerJoined);
            socket.off('game:playerLeft', handlePlayerLeft);
            socket.off('game:playerDisconnected', handlePlayerDisconnected);
        };
    }, [socket, characterId, refreshAvailableActions]);

    // Auto-join game when component mounts (only if character data is available)
    // NOTE: You may want to call joinGame() manually with character data instead
    useEffect(() => {
        // Don't auto-join - let the game component call joinGame with character data
        // This allows proper character initialization
    }, [socket, gameId, characterId, playerId, joinGame]);

    return {
        // State
        gameState,
        availableActions,
        selectedAction,
        isYourTurn,
        diceRolls,
        showDiceGallery,

        // Actions
        startGame,
        selectAction,
        confirmAction,
        cancelAction,
        refreshAvailableActions,
        closeDiceGallery,
        joinGame
    };
};

export default useGameActions;
