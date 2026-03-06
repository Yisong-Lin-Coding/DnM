/**
 * INTEGRATION EXAMPLE - How to add the action system to game.jsx
 * 
 * This shows the complete flow for implementing the dice rolling and action system
 */

import React, { useState, useEffect, useContext } from 'react';
import DiceRollGallery from '../../pageComponents/DiceRollGallery';
import ActionSelector from '../../pageComponents/ActionSelector';
import { useGameActions } from '../../hooks/useGameActions';
import { SocketContext } from '../../socket.io/context';

const Game = () => {
    // ============================================================
    // YOUR EXISTING STATE
    // ============================================================
    const socket = useContext(SocketContext);
    const [campaignId, setCampaignId] = useState(null);
    const [currentCharacter, setCurrentCharacter] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isInCombat, setIsInCombat] = useState(false);

    // Example character structure (adjust to match your actual data)
    useEffect(() => {
        // Load your character data
        const mockCharacter = {
            id: 'char-123',
            name: 'Warrior McFighter',
            characterName: 'Warrior McFighter',
            stats: {
                STR: { score: 16, modifier: 3 },
                DEX: { score: 14, modifier: 2 },
                CON: { score: 14, modifier: 2 },
                INT: { score: 10, modifier: 0 },
                WIS: { score: 12, modifier: 1 },
                CHA: { score: 10, modifier: 0 }
            },
            position: { x: 100, y: 100 }
        };
        setCurrentCharacter(mockCharacter);
        setUserId('player-123');
        setCampaignId('campaign-456');
    }, []);

    // ============================================================
    // GAME ACTIONS HOOK
    // ============================================================
    const {
        gameState,
        availableActions,
        selectedAction,
        isYourTurn,
        diceRolls,
        showDiceGallery,
        startGame,
        selectAction,
        confirmAction,
        cancelAction,
        refreshAvailableActions,
        closeDiceGallery,
        joinGame
    } = useGameActions(
        campaignId,
        currentCharacter?.id,
        userId
    );

    // ============================================================
    // JOIN GAME WHEN CHARACTER IS LOADED
    // ============================================================
    useEffect(() => {
        if (socket && campaignId && currentCharacter && userId) {
            console.log('Joining game with character:', currentCharacter.name);
            joinGame(currentCharacter);
        }
    }, [socket, campaignId, currentCharacter, userId, joinGame]);

    // ============================================================
    // COMBAT START HANDLER
    // ============================================================
    const handleStartCombat = () => {
        console.log('Starting combat...');
        setIsInCombat(true);
        
        // Start the game (this will roll initiative)
        startGame();
    };

    // ============================================================
    // ACTION CONFIRMATION WITH TARGET SELECTION
    // ============================================================
    const [targetingMode, setTargetingMode] = useState(false);
    const [selectedTarget, setSelectedTarget] = useState(null);

    const handleActionSelect = (action) => {
        selectAction(action);
        
        // If action requires target, enter targeting mode
        if (action.requiresTarget) {
            setTargetingMode(true);
            console.log('Select a target on the map...');
        }
    };

    const handleMapClick = (clickedCharacter) => {
        if (targetingMode && selectedAction) {
            // User clicked a character on the map
            setSelectedTarget(clickedCharacter);
            setTargetingMode(false);
            
            // Confirm action with this target
            confirmAction({
                characterId: clickedCharacter.id,
                position: clickedCharacter.position
            });
        }
    };

    const handleActionCancel = () => {
        cancelAction();
        setTargetingMode(false);
        setSelectedTarget(null);
    };

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="h-screen overflow-hidden">
            <div className="w-full h-full relative overflow-hidden">
                
                {/* YOUR EXISTING GAME CANVAS AND UI */}
                <canvas ref={canvasRef} />
                
                {/* ================================================ */}
                {/* START COMBAT BUTTON (for testing/DM control) */}
                {/* ================================================ */}
                {!isInCombat && currentCharacter && (
                    <button 
                        onClick={handleStartCombat}
                        className="absolute top-4 right-4 z-[200] px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold"
                    >
                        ⚔️ Start Combat
                    </button>
                )}

                {/* ================================================ */}
                {/* COMBAT STATUS INDICATOR */}
                {/* ================================================ */}
                {isInCombat && (
                    <div className="absolute top-4 left-4 z-[200] bg-black/80 text-white px-4 py-2 rounded-lg">
                        <div className="text-sm">
                            Combat Active - Round {Math.floor(gameState.currentTurnIndex / (gameState.turnOrder?.length || 1)) + 1}
                        </div>
                        {isYourTurn && (
                            <div className="text-green-400 font-bold">YOUR TURN</div>
                        )}
                        {!isYourTurn && gameState.currentTurn && (
                            <div className="text-yellow-400">Waiting for turn...</div>
                        )}
                    </div>
                )}

                {/* ================================================ */}
                {/* ACTION SELECTOR - Shows on your turn */}
                {/* ================================================ */}
                {isInCombat && isYourTurn && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[200]">
                        <ActionSelector
                            character={currentCharacter}
                            availableActions={availableActions}
                            isYourTurn={isYourTurn}
                            onActionSelect={handleActionSelect}
                            onActionConfirm={(action, target) => {
                                // If no target needed or targeting mode handled it
                                if (!action.requiresTarget) {
                                    confirmAction(null);
                                }
                            }}
                            onActionCancel={handleActionCancel}
                            selectedAction={selectedAction}
                        />
                    </div>
                )}

                {/* ================================================ */}
                {/* TARGETING INDICATOR */}
                {/* ================================================ */}
                {targetingMode && selectedAction && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[190] bg-yellow-500/90 text-black px-6 py-3 rounded-lg font-bold text-center">
                        <div className="text-xl mb-2">🎯 Select Target</div>
                        <div className="text-sm">
                            Click on an enemy to target with {selectedAction.name}
                        </div>
                        <button
                            onClick={handleActionCancel}
                            className="mt-3 px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {/* ================================================ */}
                {/* DICE ROLL GALLERY - Shows when dice are rolled */}
                {/* ================================================ */}
                {showDiceGallery && diceRolls.length > 0 && (
                    <DiceRollGallery
                        rolls={diceRolls}
                        currentPlayerId={currentCharacter?.id}
                        onAllViewed={closeDiceGallery}
                    />
                )}

            </div>
        </div>
    );
};

export default Game;
