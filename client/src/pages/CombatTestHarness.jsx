/**
 * TEST HARNESS - Standalone component for testing the combat system
 * 
 * Use this to test the dice rolling and action system without integrating
 * into your main game component.
 * 
 * To use:
 * 1. Import this component
 * 2. Render it in a test page or temporarily in your app
 * 3. Click buttons to test different scenarios
 */

import React, { useState, useContext } from 'react';
import DiceRollGallery from '../pageComponents/DiceRollGallery';
import ActionSelector from '../pageComponents/ActionSelector';
import { useGameActions } from '../hooks/useGameActions';
import { SocketContext } from '../socket.io/context';

const CombatTestHarness = () => {
    const socket = useContext(SocketContext);
    
    // Test configuration
    const [testGameId] = useState('test-game-123');
    const [testPlayerId] = useState('test-player-456');
    const [testCharacterId] = useState('test-char-789');
    
    // Mock character data
    const [testCharacter] = useState({
        id: 'test-char-789',
        name: 'Test Warrior',
        characterName: 'Test Warrior',
        stats: {
            STR: { score: 16, modifier: 3 },
            DEX: { score: 14, modifier: 2 },
            CON: { score: 14, modifier: 2 },
            INT: { score: 10, modifier: 0 },
            WIS: { score: 12, modifier: 1 },
            CHA: { score: 10, modifier: 0 }
        },
        position: { x: 100, y: 100 },
        hp: { current: 30, max: 30 }
    });

    // Use game actions hook
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
        closeDiceGallery,
        joinGame
    } = useGameActions(testGameId, testCharacterId, testPlayerId);

    // Test state
    const [log, setLog] = useState([]);
    const [hasJoined, setHasJoined] = useState(false);
    const [combatStarted, setCombatStarted] = useState(false);

    // Logging helper
    const addLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setLog(prev => [...prev, { timestamp, message, type }]);
        console.log(`[${timestamp}] ${message}`);
    };

    // Test actions
    const handleJoinGame = () => {
        addLog('🔌 Joining game with test character...', 'action');
        joinGame(testCharacter);
        setHasJoined(true);
    };

    const handleStartCombat = () => {
        addLog('⚔️ Starting combat - rolling initiative...', 'action');
        startGame();
        setCombatStarted(true);
    };

    const handleTestDicePopup = () => {
        addLog('🎲 Showing test dice popup...', 'action');
        // Manually trigger dice display for testing
        const mockRolls = [
            {
                characterName: 'Test Warrior',
                characterId: testCharacterId,
                description: 'Test Initiative Roll',
                dice: [{ type: 'd20', value: 18 }],
                bonuses: [
                    { name: 'DEX Modifier', value: 2 }
                ],
                total: 20,
                timestamp: Date.now()
            },
            {
                characterName: 'Test Goblin',
                characterId: 'goblin-1',
                description: 'Test Initiative Roll',
                dice: [{ type: 'd20', value: 12 }],
                bonuses: [
                    { name: 'DEX Modifier', value: 1 }
                ],
                total: 13,
                timestamp: Date.now() + 1
            }
        ];
        
        // This would normally come from the server
        // For testing, we simulate it
        console.log('📦 Mock dice rolls:', mockRolls);
    };

    const handleTestAttackRoll = () => {
        addLog('⚔️ Simulating attack roll...', 'action');
        const mockAttackRoll = {
            characterName: 'Test Warrior',
            characterId: testCharacterId,
            description: 'Attack Roll - Longsword',
            dice: [{ type: 'd20', value: 17 }],
            bonuses: [
                { name: 'STR Modifier', value: 3 },
                { name: 'Proficiency', value: 2 }
            ],
            total: 22,
            timestamp: Date.now()
        };
        console.log('📦 Mock attack roll:', mockAttackRoll);
    };

    const handleClearLog = () => {
        setLog([]);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold mb-2">🎲 Combat System Test Harness</h1>
                    <p className="text-gray-400">
                        Test the dice rolling and action system in isolation
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Control Panel */}
                    <div className="bg-gray-800 rounded-lg p-6">
                        <h2 className="text-2xl font-bold mb-4">🎮 Controls</h2>
                        
                        <div className="space-y-3">
                            <button
                                onClick={handleJoinGame}
                                disabled={hasJoined || !socket}
                                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold transition"
                            >
                                {hasJoined ? '✅ Joined Game' : '1. Join Game'}
                            </button>

                            <button
                                onClick={handleStartCombat}
                                disabled={!hasJoined || combatStarted}
                                className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold transition"
                            >
                                {combatStarted ? '✅ Combat Started' : '2. Start Combat'}
                            </button>

                            <div className="border-t border-gray-700 pt-3 mt-3">
                                <p className="text-sm text-gray-400 mb-2">Manual Tests:</p>
                                
                                <button
                                    onClick={handleTestDicePopup}
                                    className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg mb-2 transition"
                                >
                                    🎲 Test Dice Popup
                                </button>

                                <button
                                    onClick={handleTestAttackRoll}
                                    className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                                >
                                    ⚔️ Test Attack Roll
                                </button>
                            </div>

                            <button
                                onClick={handleClearLog}
                                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                            >
                                🗑️ Clear Log
                            </button>
                        </div>

                        {/* Status */}
                        <div className="mt-6 p-4 bg-gray-900 rounded-lg">
                            <h3 className="font-bold mb-2">📊 Status</h3>
                            <div className="space-y-1 text-sm">
                                <div>Socket: {socket ? '🟢 Connected' : '🔴 Disconnected'}</div>
                                <div>Game State: {gameState.state}</div>
                                <div>Your Turn: {isYourTurn ? '✅ Yes' : '❌ No'}</div>
                                <div>Dice Showing: {showDiceGallery ? '✅ Yes' : '❌ No'}</div>
                                <div>Available Actions: {availableActions.length}</div>
                            </div>
                        </div>

                        {/* Character Info */}
                        <div className="mt-4 p-4 bg-gray-900 rounded-lg">
                            <h3 className="font-bold mb-2">👤 Test Character</h3>
                            <div className="text-sm">
                                <div><strong>Name:</strong> {testCharacter.name}</div>
                                <div><strong>STR:</strong> +{testCharacter.stats.STR.modifier}</div>
                                <div><strong>DEX:</strong> +{testCharacter.stats.DEX.modifier}</div>
                                <div><strong>HP:</strong> {testCharacter.hp.current}/{testCharacter.hp.max}</div>
                            </div>
                        </div>
                    </div>

                    {/* Log Panel */}
                    <div className="bg-gray-800 rounded-lg p-6">
                        <h2 className="text-2xl font-bold mb-4">📋 Event Log</h2>
                        
                        <div className="bg-black rounded-lg p-4 h-[600px] overflow-y-auto font-mono text-sm">
                            {log.length === 0 ? (
                                <div className="text-gray-500 text-center mt-20">
                                    No events yet. Start testing!
                                </div>
                            ) : (
                                log.map((entry, index) => (
                                    <div key={index} className="mb-2">
                                        <span className="text-gray-500">[{entry.timestamp}]</span>{' '}
                                        <span className={
                                            entry.type === 'error' ? 'text-red-400' :
                                            entry.type === 'action' ? 'text-green-400' :
                                            'text-white'
                                        }>
                                            {entry.message}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Dice Gallery (shows when rolls happen) */}
                {showDiceGallery && diceRolls.length > 0 && (
                    <DiceRollGallery
                        rolls={diceRolls}
                        currentPlayerId={testCharacterId}
                        onAllViewed={() => {
                            addLog('✅ Dice rolls viewed and acknowledged', 'success');
                            closeDiceGallery();
                        }}
                    />
                )}

                {/* Action Selector (shows on your turn) */}
                {isYourTurn && (
                    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[200]">
                        <ActionSelector
                            character={testCharacter}
                            availableActions={availableActions}
                            isYourTurn={isYourTurn}
                            onActionSelect={(action) => {
                                addLog(`Selected action: ${action.name}`, 'action');
                                selectAction(action);
                            }}
                            onActionConfirm={(action, target) => {
                                addLog(`Confirmed action: ${action.name}`, 'action');
                                confirmAction(target);
                            }}
                            onActionCancel={() => {
                                addLog('Cancelled action', 'info');
                                cancelAction();
                            }}
                            selectedAction={selectedAction}
                        />
                    </div>
                )}

                {/* Instructions */}
                <div className="mt-8 bg-blue-900/30 border border-blue-500/50 rounded-lg p-6">
                    <h3 className="text-xl font-bold mb-3">📖 Instructions</h3>
                    <ol className="space-y-2 text-sm">
                        <li><strong>1.</strong> Make sure your server is running on port 3001</li>
                        <li><strong>2.</strong> Click "Join Game" to connect to the test session</li>
                        <li><strong>3.</strong> Click "Start Combat" to roll initiative</li>
                        <li><strong>4.</strong> Watch the dice roll popup appear</li>
                        <li><strong>5.</strong> Click "Continue" to acknowledge seeing the rolls</li>
                        <li><strong>6.</strong> Your turn will start (if you won initiative)</li>
                        <li><strong>7.</strong> Select an action from the Action Selector</li>
                        <li><strong>8.</strong> Watch the logs to see the flow</li>
                    </ol>
                </div>
            </div>
        </div>
    );
};

export default CombatTestHarness;
