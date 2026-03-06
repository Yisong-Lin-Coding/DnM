# Combat System Flow - Fixed Version

## ✅ What Was Fixed

### Problem 1: Initiative Rolls Not Showing
**Issue:** Dice popup wasn't appearing when combat started
**Fix:** 
- Added proper character data passing when joining game
- Server now validates characters exist before rolling initiative
- Added better error logging

### Problem 2: Server Not Waiting for Dice Viewing
**Issue:** Server immediately proceeded without waiting for players to see dice
**Fix:**
- Implemented acknowledgment system
- Server tracks which players have viewed dice
- Server only proceeds when all (or majority) have acknowledged
- 10-second fallback timeout if no acknowledgments received

## 🎮 New Flow

### 1. **Game Join**
```javascript
// Client joins and passes character data
joinGame(currentCharacter);

// Server receives character and adds to session
// Server logs: "Added character Warrior to session"
```

### 2. **Combat Start**
```javascript
// Client triggers combat
startGame();

// Server checks: Do we have characters?
// If yes: Roll initiative for all characters
// If no: Return error "No characters in game session"
```

### 3. **Initiative Rolls**
```javascript
// Server rolls initiative for each character
// Server sends: game:initiativeRolls event
// Server logs: "Waiting for X players to acknowledge..."

// Client receives and shows DiceRollGallery
// Players view the dice animations (2 seconds)
// Players can navigate between multiple rolls
```

### 4. **Client Acknowledgment**
```javascript
// When gallery closes (all rolls viewed):
closeDiceGallery();

// Automatically sends: game:acknowledgeDiceRoll
// Server receives and logs: "Player X acknowledged initiative roll"
// Server checks: Have all players acknowledged?
```

### 5. **Turn Start**
```javascript
// Once all acknowledged (or majority + timeout):
// Server proceeds with first turn
// Server sends: game:turnStart event

// ActionSelector appears for current player
```

### 6. **Action Execution**
```javascript
// Player selects and confirms action
confirmAction(target);

// Server processes action and rolls dice
// Server sends: game:diceRolls event
// Server waits for acknowledgments...

// Same acknowledgment flow as initiative
// After acknowledgment: Turn ends, next turn starts
```

## 🔧 Key Changes

### Server (game_actions.js)
1. **Acknowledgment Tracking**
   ```javascript
   session.pendingAcknowledgments = new Map();
   // Tracks which players have viewed dice
   ```

2. **Character Validation**
   ```javascript
   if (characters.length === 0) {
       return error('No characters in game session');
   }
   ```

3. **Wait for Acknowledgments**
   ```javascript
   // Checks if all or majority acknowledged
   if (allAcknowledged || acknowledgedCount >= Math.ceil(totalCount / 2))
   ```

### Client (useGameActions.js)
1. **Character Data Passing**
   ```javascript
   joinGame(character) // Now accepts character data
   ```

2. **Automatic Acknowledgment**
   ```javascript
   closeDiceGallery() // Sends acknowledgment before closing
   ```

3. **Better Validation**
   ```javascript
   if (data.rolls && data.rolls.length > 0) {
       // Only show gallery if rolls exist
   }
   ```

## 📋 Testing Checklist

### Test 1: Basic Combat Start
- [ ] Load game with character
- [ ] Click "Start Combat"
- [ ] See initiative dice roll popup
- [ ] See character name in popup
- [ ] See d20 die with result
- [ ] See DEX modifier as bonus
- [ ] See total initiative score

### Test 2: Multiple Characters
- [ ] Have 2+ characters join
- [ ] Start combat
- [ ] See gallery navigation arrows
- [ ] Navigate between initiative rolls
- [ ] Your character's roll highlighted in gold
- [ ] Close gallery (Continue button)
- [ ] Turn starts for highest initiative

### Test 3: Action Flow
- [ ] Wait for your turn
- [ ] ActionSelector appears
- [ ] Select Attack action
- [ ] Select target on map
- [ ] Confirm action
- [ ] See attack roll dice popup
- [ ] See damage roll dice popup (if hit)
- [ ] Close gallery
- [ ] Turn ends automatically
- [ ] Next player's turn starts

### Test 4: Acknowledgment System
- [ ] Open browser console
- [ ] Start combat
- [ ] See log: "Player X acknowledged initiative roll"
- [ ] See log: "X/Y players acknowledged"
- [ ] See log: "All or majority acknowledged, proceeding..."
- [ ] Turn start happens after acknowledgment

## 🐛 Troubleshooting

### "No characters in game session"
**Cause:** joinGame() called without character data
**Fix:** 
```javascript
// WRONG
joinGame();

// RIGHT
joinGame(currentCharacter);
```

### Dice popup doesn't show
**Checks:**
1. Console shows "Initiative rolls received"?
2. `diceRolls` array has data?
3. `showDiceGallery` is true?
4. Character has stats.DEX defined?

**Debug:**
```javascript
console.log('Dice state:', { 
    showDiceGallery, 
    diceRolls 
});
```

### Server proceeds too fast
**Cause:** Acknowledgments not being sent
**Check:** 
1. `closeDiceGallery` is being called?
2. Socket is connected?
3. playerId is defined?

**Debug:**
```javascript
// In closeDiceGallery
console.log('Sending ack:', { gameId, playerId, rollType });
```

### Character stats not working
**Ensure character has:**
```javascript
{
    id: 'char-123',
    name: 'Character Name',
    stats: {
        DEX: { modifier: 2 }  // Required for initiative
    }
}
```

## 🎯 Quick Start Commands

### Start Combat (with logging)
```javascript
// In browser console
console.log('Current character:', currentCharacter);
console.log('User ID:', userId);
console.log('Campaign ID:', campaignId);

// Join game
joinGame(currentCharacter);

// Wait 1 second, then start
setTimeout(() => startGame(), 1000);
```

### Test Dice Display Manually
```javascript
// Force show dice popup for testing
setDiceRolls([{
    characterName: 'Test Character',
    characterId: 'test-123',
    description: 'Initiative Roll',
    dice: [{ type: 'd20', value: 18 }],
    bonuses: [{ name: 'DEX', value: 2 }],
    total: 20,
    timestamp: Date.now()
}]);
setShowDiceGallery(true);
```

## 📊 Expected Console Output

### Successful Combat Start
```
Joining game: { gameId: "campaign-456", characterId: "char-123", playerId: "player-123" }
✅ Successfully joined game: { state: "waiting", turnOrder: [], ... }
Starting combat...
Initiative rolls received: [{ characterName: "Warrior", total: 18, ... }]
Dice roll acknowledged
Player player-123 acknowledged initiative roll
1/1 players acknowledged
All or majority acknowledged, proceeding...
Turn started: { characterId: "char-123", ... }
```

## 🎉 Ready to Test!

The system is now properly configured to:
1. ✅ Wait for character data before rolling
2. ✅ Show dice roll popups
3. ✅ Wait for player acknowledgment
4. ✅ Proceed only after viewing complete
5. ✅ Handle multiple players gracefully

Try starting combat and watch the console logs to see the flow in action!
