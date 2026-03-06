# Action System & Dice Rolling Integration Guide

This guide explains how to integrate the new action system and dice rolling components into your game.

## Files Created

### Client Components
1. **DiceRollPopup.jsx** - Individual dice roll display with animations
2. **DiceRollPopup.css** - Popup styles
3. **DiceRollGallery.jsx** - Gallery for multiple concurrent rolls
4. **DiceRollGallery.css** - Gallery styles
5. **ActionSelector.jsx** - Turn-based action selection UI
6. **ActionSelector.css** - Action selector styles
7. **useGameActions.js** - Hook for managing game actions and dice rolls

### Server Files
1. **diceRoller.js** - Server-side dice rolling system
2. **actionProcessor.js** - Action execution and result calculation
3. **game_actions.js** - Socket.IO API for game actions

## Integration Steps

### Step 1: Import Components in game.jsx

Add these imports at the top of your game.jsx file:

```javascript
import DiceRollGallery from '../../pageComponents/DiceRollGallery';
import ActionSelector from '../../pageComponents/ActionSelector';
import { useGameActions } from '../../hooks/useGameActions';
```

### Step 2: Add useGameActions Hook

Inside your Game component, add the hook:

```javascript
const Game = () => {
    // ... existing state ...
    
    // Add game actions hook
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
        closeDiceGallery
    } = useGameActions(
        campaignId,        // Your game ID
        characterId,       // Current player's character ID
        userId            // Current user/player ID
    );

    // ... rest of component ...
};
```

### Step 3: Add Dice Gallery to JSX

Add the DiceRollGallery component to your return statement:

```javascript
return (
    <div className="h-screen overflow-hidden">
        {/* ... existing game UI ... */}
        
        {/* Dice Roll Gallery */}
        {showDiceGallery && diceRolls.length > 0 && (
            <DiceRollGallery
                rolls={diceRolls}
                currentPlayerId={characterId}
                onAllViewed={closeDiceGallery}
            />
        )}

        {/* ... rest of UI ... */}
    </div>
);
```

### Step 4: Add Action Selector to Game UI

Add the ActionSelector where you want players to choose actions:

```javascript
{/* Action Selector - Show during combat */}
{isInCombat && (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[200]">
        <ActionSelector
            character={currentCharacter}
            availableActions={availableActions}
            isYourTurn={isYourTurn}
            onActionSelect={selectAction}
            onActionConfirm={(action, target) => {
                // If action requires targeting, you might handle it here
                // Otherwise, just confirm
                confirmAction(target);
            }}
            onActionCancel={cancelAction}
            selectedAction={selectedAction}
        />
    </div>
)}
```

### Step 5: Update Socket Context (if needed)

Make sure your socket connection is properly set up. In your app's root or game component:

```javascript
import { SocketContext, createSocket, getSocketUrls } from './socket.io/context';

// Create socket connection
const [socket, setSocket] = useState(null);

useEffect(() => {
    const urls = getSocketUrls();
    const newSocket = createSocket(urls[0]);
    newSocket.connect();
    setSocket(newSocket);

    return () => {
        newSocket.disconnect();
    };
}, []);

// Wrap your app in SocketContext.Provider
return (
    <SocketContext.Provider value={socket}>
        <Game />
    </SocketContext.Provider>
);
```

## Action Flow

### 1. Turn Start
- Server broadcasts `game:turnStart` event
- Client receives and updates `isYourTurn` state
- ActionSelector becomes active for current player

### 2. Action Selection
- Player clicks an action in ActionSelector
- `selectAction()` is called, staging the action
- If action requires target, player selects target on map
- Once ready, `confirmAction()` is called

### 3. Server Processing
- Server receives `game:confirmAction` event
- ActionProcessor calculates results
- DiceRoller pre-rolls all dice
- Results are broadcast to all clients

### 4. Dice Reveal
- All clients receive `game:diceRolls` event
- DiceRollGallery displays with animations
- Players see rolling animation, then results
- Can switch between multiple rolls if applicable

### 5. Turn End
- After dice animations complete (6 seconds)
- Server automatically ends turn
- Next player's turn begins

## Customization

### Action Types

You can add custom actions by modifying `buildAvailableActions()` in `game_actions.js`:

```javascript
actions.push({
    id: 'custom-action',
    name: 'Custom Action',
    type: 'custom',
    category: 'main',
    description: 'This is a custom action',
    icon: '🎯',
    requiresTarget: true,
    available: true
});
```

Then add handling in `actionProcessor.js`:

```javascript
case 'custom':
    return this.processCustomAction(character, target, options);
```

### Dice Roll Types

The DiceRoller supports various roll types:
- `rollInitiative(character)` - Initiative with DEX modifier
- `rollAttack(attacker, weapon)` - Attack rolls
- `rollDamage(attacker, weapon, isCritical)` - Damage rolls
- `rollSavingThrow(character, ability, dc)` - Saving throws
- `rollAbilityCheck(character, ability, skill)` - Skill checks
- `rollNotation(notation)` - Generic dice notation (e.g., "2d6+3")

### Styling

All components use CSS modules with customizable classes. You can modify:
- Colors in the gradient definitions
- Animation timings
- Layout and sizing
- Z-index values for proper layering

## Socket Events Reference

### Client → Server
- `game:join` - Join a game session
- `game:start` - Start the game and roll initiative
- `game:selectAction` - Stage an action
- `game:confirmAction` - Execute staged action
- `game:cancelAction` - Cancel staged action
- `game:getAvailableActions` - Get available actions
- `game:leave` - Leave the game

### Server → Client
- `game:initiativeRolls` - Initiative results
- `game:turnStart` - Turn begins for a character
- `game:diceRolls` - Dice roll results
- `game:newRound` - New combat round begins
- `game:playerJoined` - Player joined
- `game:playerLeft` - Player left
- `game:playerDisconnected` - Player disconnected

## Testing

### Test Initiative Rolling
```javascript
// In your game component or console
startGame(); // This will roll initiative for all characters
```

### Test Action Execution
```javascript
// Select an attack action
selectAction({
    id: 'attack',
    type: 'attack',
    name: 'Attack',
    requiresTarget: true
});

// Confirm with target
confirmAction({
    characterId: 'target-character-id'
});
```

### Test Dice Display
```javascript
// Manually trigger dice roll display (for testing)
setDiceRolls([
    {
        characterName: 'Test Character',
        characterId: 'test-id',
        description: 'Attack Roll',
        dice: [{ type: 'd20', value: 18 }],
        bonuses: [{ name: 'Strength', value: 3 }],
        total: 21,
        timestamp: Date.now()
    }
]);
setShowDiceGallery(true);
```

## Troubleshooting

### Dice rolls not showing
- Check that socket connection is established
- Verify `showDiceGallery` state is true
- Check browser console for errors

### Actions not available
- Ensure `isYourTurn` is true
- Check that `availableActions` array is populated
- Verify character data is loaded

### Socket connection issues
- Check server is running on correct port
- Verify REACT_APP_SOCKET_URLS environment variable
- Check for CORS issues in browser console

## Next Steps

1. **Add character data** - Ensure character objects have all required fields (stats, equipment, abilities)
2. **Implement targeting** - Add visual targeting system for actions that require targets
3. **Add spell system** - Integrate spell selection with the action system
4. **Add status effects** - Visual indicators for active effects
5. **Add combat log** - Display action results and dice rolls in a scrollable log
6. **Add animations** - Character animations for actions (attack, cast, etc.)
7. **Add sound effects** - Dice rolling sounds, hit sounds, etc.

## Example: Full Integration in game.jsx

```javascript
import React, { useState, useEffect, useContext } from 'react';
import DiceRollGallery from '../../pageComponents/DiceRollGallery';
import ActionSelector from '../../pageComponents/ActionSelector';
import { useGameActions } from '../../hooks/useGameActions';

const Game = () => {
    // Your existing state...
    const [currentCharacter, setCurrentCharacter] = useState(null);
    const [isInCombat, setIsInCombat] = useState(false);

    // Game actions integration
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
        closeDiceGallery
    } = useGameActions(campaignId, characterId, userId);

    return (
        <div className="h-screen overflow-hidden">
            <div className="w-full h-full relative overflow-hidden">
                {/* Your existing game canvas and UI */}
                
                {/* Action Selector */}
                {isInCombat && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[200]">
                        <ActionSelector
                            character={currentCharacter}
                            availableActions={availableActions}
                            isYourTurn={isYourTurn}
                            onActionSelect={selectAction}
                            onActionConfirm={(action, target) => confirmAction(target)}
                            onActionCancel={cancelAction}
                            selectedAction={selectedAction}
                        />
                    </div>
                )}

                {/* Dice Roll Gallery */}
                {showDiceGallery && diceRolls.length > 0 && (
                    <DiceRollGallery
                        rolls={diceRolls}
                        currentPlayerId={characterId}
                        onAllViewed={closeDiceGallery}
                    />
                )}

                {/* Start Combat Button (for testing) */}
                {!isInCombat && (
                    <button 
                        onClick={() => {
                            setIsInCombat(true);
                            startGame();
                        }}
                        className="absolute top-4 right-4 z-[200] px-4 py-2 bg-blue-500 text-white rounded"
                    >
                        Start Combat
                    </button>
                )}
            </div>
        </div>
    );
};

export default Game;
```
