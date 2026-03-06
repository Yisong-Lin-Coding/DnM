# Quick Start Guide - Action System & Dice Rolling (UPDATED)

## 🚀 Quick Setup (5 minutes)

### 1. Ensure Server Files Are Loaded

The action system needs the following server files:
- ✅ `server/worldEngine/diceRoller.js` - Dice rolling engine
- ✅ `server/worldEngine/actionProcessor.js` - Action execution
- ✅ `server/api/game_actions.js` - Socket API (with acknowledgment system)

### 2. Add to Client

```bash
# All client files are in place:
# - client/src/pageComponents/DiceRollPopup.jsx
# - client/src/pageComponents/DiceRollGallery.jsx
# - client/src/pageComponents/ActionSelector.jsx
# - client/src/hooks/useGameActions.js (with acknowledgment support)
```

### 3. Quick Integration in game.jsx

Add these three lines at the top:
```javascript
import DiceRollGallery from '../../pageComponents/DiceRollGallery';
import ActionSelector from '../../pageComponents/ActionSelector';
import { useGameActions } from '../../hooks/useGameActions';
```

Add this hook in your component:
```javascript
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
    joinGame  // NEW: Manual join with character data
} = useGameActions(campaignId, characterId, userId);
```

**IMPORTANT:** Join the game with character data:
```javascript
useEffect(() => {
    if (socket && campaignId && currentCharacter && userId) {
        joinGame(currentCharacter);  // Pass character object
    }
}, [socket, campaignId, currentCharacter, userId, joinGame]);
```

Add these two components to your JSX:
```javascript
{/* Dice Gallery - Shows when dice are rolled */}
{showDiceGallery && diceRolls.length > 0 && (
    <DiceRollGallery
        rolls={diceRolls}
        currentPlayerId={characterId}
        onAllViewed={closeDiceGallery}
    />
)}

{/* Action Selector - Shows on your turn */}
{isYourTurn && (
    <ActionSelector
        character={currentCharacter}
        availableActions={availableActions}
        isYourTurn={isYourTurn}
        onActionSelect={selectAction}
        onActionConfirm={(action, target) => confirmAction(target)}
        onActionCancel={cancelAction}
        selectedAction={selectedAction}
    />
)}
```

## 🎮 How to Use

### Starting Combat
```javascript
// When combat begins (button click or DM action)
// Make sure you've joined the game first!
startGame();
```

### Required Character Data Structure
```javascript
const character = {
    id: 'char-123',
    name: 'Character Name',
    stats: {
        DEX: { modifier: 2 },  // Required for initiative
        STR: { modifier: 3 },  // For attacks
        // ... other stats
    },
    position: { x: 100, y: 100 }  // Optional
};
```

### Player Turn Flow
1. **Wait for your turn** - ActionSelector will activate
2. **Choose an action** - Click on Attack, Dodge, etc.
3. **Select target** (if needed) - Click on enemy
4. **Confirm** - Click "Confirm Action" button
5. **Watch dice roll** - Animated popup shows results
6. **Turn ends** - Next player's turn begins

### Dice Roll Display
- **Your rolls** - Highlighted in gold
- **Other players' rolls** - Standard blue
- **Multiple rolls** - Use arrows to navigate
- **Gallery view** - See all concurrent rolls

## 🎯 Features

### ✨ Animated Dice Rolling
- 2-second rolling animation
- Smooth reveal of results
- Individual dice shown with colors by type (d20, d6, etc.)
- Bonuses listed separately
- Final total displayed prominently

### 🎨 Action Selection
- Categorized actions (Main, Movement, Bonus, Other)
- Visual feedback for selected action
- Disabled state when not your turn
- Target requirement indicator
- Confirmation dialog

### 🎭 Multiple Player Support
- See all players rolling initiative
- Gallery navigation for simultaneous rolls
- Your rolls prioritized
- Viewed/unviewed indicators

## 🔧 Customization

### Add Custom Actions
Edit `server/api/game_actions.js`, function `buildAvailableActions()`:

```javascript
actions.push({
    id: 'custom-spell',
    name: 'Fireball',
    type: 'cast',
    category: 'main',
    description: 'Launch a ball of fire',
    icon: '🔥',
    requiresTarget: true,
    available: true
});
```

### Modify Dice Colors
Edit `client/src/pageComponents/DiceRollPopup.css`:

```css
.dice.d20 .dice-face {
    background: linear-gradient(135deg, #YOUR_COLOR1 0%, #YOUR_COLOR2 100%);
}
```

### Change Animation Timing
In `DiceRollPopup.jsx`, line 27:
```javascript
const rollingTimer = setTimeout(() => {
    setIsRolling(false);
    setShowResults(true);
}, 2000); // Change this value (milliseconds)
```

## 🐛 Troubleshooting

### "Actions not showing"
- Check `isYourTurn` is `true`
- Verify character data is loaded
- Check console for errors

### "Dice not appearing"
- Ensure socket is connected
- Check `showDiceGallery` state
- Verify rolls array has data

### "Socket not connecting"
- Check server is running on port 3001
- Verify REACT_APP_SOCKET_URLS in .env
- Check for CORS errors in console

## 📊 Data Structures

### Roll Data Format
```javascript
{
    characterName: "Your Character",
    characterId: "char-123",
    description: "Attack Roll",
    dice: [
        { type: "d20", value: 18 }
    ],
    bonuses: [
        { name: "Strength", value: 3 },
        { name: "Proficiency", value: 2 }
    ],
    total: 23,
    timestamp: 1234567890
}
```

### Action Format
```javascript
{
    id: "attack",
    name: "Attack",
    type: "attack",
    category: "main",
    description: "Make an attack",
    icon: "⚔️",
    requiresTarget: true,
    available: true
}
```

## 🎬 Demo Scenario

Test the complete flow:

1. **Join Game**
   ```javascript
   // Automatically done by useGameActions hook
   ```

2. **Start Combat**
   ```javascript
   startGame(); // Rolls initiative for all
   ```

3. **On Your Turn**
   - ActionSelector appears
   - Click "Attack"
   - Click on enemy
   - Click "Confirm Action"

4. **Watch Results**
   - Attack roll animates
   - Damage roll shows (if hit)
   - Turn ends automatically

## 📝 Notes

- **Pre-rolled dice**: Server rolls dice before sending to clients for "reveal" effect
- **Turn timer**: Built-in but optional (6 seconds after action)
- **Multiple targets**: Supported in action processor
- **Status effects**: Can be added via action results
- **Combat log**: Consider adding for permanent record

## 🎉 You're Ready!

The action system is fully integrated and ready to use. Start by:
1. Running your server
2. Loading the game
3. Clicking "Start Combat" (or triggering via DM controls)
4. Selecting actions when it's your turn

Enjoy your animated dice rolling and turn-based combat! 🎲✨
