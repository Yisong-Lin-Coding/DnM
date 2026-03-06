# System Architecture & Best Practices

## Overview
This document outlines the core architectural patterns and security principles used in this game system.

## Table of Contents
- [Server Authority Pattern](#server-authority-pattern)
- [Modifier Pipeline System](#modifier-pipeline-system)
- [Perception & Stealth Systems](#perception--stealth-systems)
- [Effect System](#effect-system)
- [Obfuscation & Security](#obfuscation--security)
- [Common Pitfalls](#common-pitfalls)

---

## Server Authority Pattern

### Principle
**The server is the single source of truth. Clients display data; they never calculate game mechanics.**

### Implementation
- Server calculates ALL game state changes, stat modifications, and derived values
- Every turn end, server force-syncs all character data to all clients
- Clients replace their local state entirely with server data
- Never trust client-submitted calculations

### Example: Turn End Sync
```javascript
// server/api/campaign_manager.js - campaign_endTurn
// Force-sync all characters to snapshot
allCharacters.forEach(char => {
    syncEngineCharacterToToken(char, char.id, snapshot.chars);
});

// Broadcast complete state to all clients
io.to(roomCode).emit('campaign_state_update', {
    snapshot: finalSnapshot,
    turn: campaign.turn
});
```

### Why This Matters
- Prevents client-side cheating (modified values in browser)
- Eliminates desyncs between players
- Single calculation logic = fewer bugs
- Easier to debug (one source of truth)

---

## Modifier Pipeline System

### Principle
**All stat calculations flow through a modifier pipeline that applies hooks in-place.**

### Architecture
```javascript
// Character.js
applyModifierPipeline(hookName, context) {
    // context is modified IN-PLACE by all modifiers
    this.statusEffects.forEach(effect => {
        effect.hooks[hookName]?.forEach(fn => fn(context));
    });
}
```

### Usage Pattern
```javascript
// Getter uses pipeline
get perception() {
    const context = { total: this.stats.INT.score };
    this.applyModifierPipeline('onPerceptionCalc', context);
    return context.total; // Modified value
}
```

### Available Hooks
- `onPerceptionCalc` - Modifies perception calculation
- `onStealthCalc` - Modifies stealth calculation
- `onVisionCalc` - Modifies vision range
- `onHPCalc` - Modifies HP pool
- `onMPCalc` - Modifies MP pool
- `onSTACalc` - Modifies stamina pool
- `onDefenseCalc` - Modifies defense values
- `onMovementCalc` - Modifies movement speed

### Critical Rule: In-Place Modification
**WRONG:**
```javascript
// DO NOT DO THIS - creates new object, original context lost
wrapperFunction: (target, context) => {
    return { ...context, total: context.total + 2 };
}
```

**CORRECT:**
```javascript
// DO THIS - modifies context in-place
wrapperFunction: (target, context) => {
    context.total += 2;
}
```

---

## Perception & Stealth Systems

### Calculation
```javascript
// Perception = INT + modifiers
get perception() {
    const context = { total: this.stats.INT.score };
    this.applyModifierPipeline('onPerceptionCalc', context);
    return context.total;
}

// Stealth = DEX + WIS + modifiers
get stealth() {
    const base = this.stats.DEX.score + this.stats.WIS.score;
    const context = { total: base };
    this.applyModifierPipeline('onStealthCalc', context);
    return context.total;
}
```

### Visibility System
Perception vs Stealth determines what information is revealed:

| Ratio | Visibility | Error Margin |
|-------|-----------|--------------|
| < 50% | Nothing   | N/A          |
| 50-55% | Name      | ±200%        |
| 55-60% | HP        | ±175%        |
| 60-65% | MP/STA    | ±150%        |
| 65-70% | Race/Class | ±125%       |
| 70-75% | Level/Max HP | ±100%     |
| 75-80% | Max MP/STA | ±75%        |
| 80-85% | Passives  | ±50%         |
| 85-90% | Defense   | ±25%         |
| 90%+   | Stats     | 0% (exact)   |

---

## Effect System

### Structure
```javascript
class StatusEffect {
    constructor(name, stacks, duration, hooks, metadata) {
        this.name = name;
        this.stacks = stacks;
        this.duration = duration; // -1 = permanent
        this.hooks = {
            onTurnStart: [],
            onTurnEnd: [],
            onPerceptionCalc: [],
            onStealthCalc: [],
            // ... other hooks
        };
        this.metadata = metadata;
    }
}
```

### Example: Enhanced Perception
```javascript
const enhancedPerception = {
    name: 'Enhanced Perception',
    hooks: {
        onPerceptionCalc: [(target, context) => {
            const effect = target.getEffect('Enhanced Perception');
            if (effect) {
                context.total += effect.stacks * 2; // +2 per stack
            }
        }]
    }
};
```

### Example: Bleed
```javascript
const bleed = {
    name: 'Bleed',
    hooks: {
        onTurnStart: [(target, context) => {
            const effect = target.getEffect('Bleed');
            if (effect && effect.stacks > 0) {
                target.takeDamage(effect.stacks, 'physical', null);
            }
        }]
    }
};
```

### Effect Lifecycle
1. **Applied**: `character.addEffect(effectName, stacks, duration)`
2. **Ticks**: Hooks execute at appropriate times (turn start/end, calculations)
3. **Stacks**: Multiple applications increase stacks
4. **Duration**: Decrements on turn end
5. **Expires**: Removed when duration reaches 0

---

## Obfuscation & Security

### Critical Principle
**Server calculates ranges and obfuscation. Client only displays pre-calculated values.**

### Why Server-Side Obfuscation?
- **Security**: Client JavaScript can be inspected via browser dev tools
- **Consistency**: Same seed produces same ranges for all players
- **Authority**: Server controls what information is revealed

### Implementation

#### Server Side (campaign_manager.js)
```javascript
// 1. Calculate perception ratio
const ratio = Math.max(0, Math.min(1, viewerPerception / targetStealth));

// 2. Determine visibility error
const error = getVisibilityError(ratio); // 0 to 2.0

// 3. Create seeded RNG for consistency
const seed = hashString(`${targetId}:${Math.round(ratio * 1000)}`);
const rng = createSeededRng(seed);

// 4. Apply ranges to all numeric values
char.HP = {
    current: buildRangeValue(realHP.current, error, rng),
    max: buildRangeValue(realHP.max, error, rng)
};
// Result: { value: 50, low: 45, high: 67, display: "45-67" }

// 5. Apply approximate markers to text
char.race = { value: "Human", display: "≈ Human", isApproximate: true };

// 6. Delete fields based on ratio thresholds
if (ratio < 0.8) delete char.AR;
if (ratio < 0.85) delete char.stats;
```

#### Client Side (infoWindows.jsx)
```javascript
// Simple display helper - no calculations
const getDisplayValue = (value) => {
    if (value === null || value === undefined) return '?';
    if (typeof value === 'object' && value.display !== undefined) {
        return value.display; // Server-calculated range: "45-67"
    }
    return String(value); // Exact value: "50"
};

// Use in display
<div>HP: {getDisplayValue(char.HP?.current)}</div>
// Shows "45-67" if obfuscated, "50" if exact
```

### Range Calculation
```javascript
// Server only - clients never see this function
function buildRangeValue(value, error, rng) {
    if (error <= 0) return { value, display: String(value) };
    
    const minVal = Math.max(0, value * (1 - error));
    const maxVal = value * (1 + error);
    const low = Math.round(minVal + rng() * (value - minVal));
    const high = Math.round(value + rng() * (maxVal - value));
    
    return {
        value,      // Real value (not sent to client)
        low,        // Range low
        high,       // Range high
        display: `${low}-${high}` // Pre-formatted string
    };
}
```

### Seeded RNG
Ensures consistency - same character-player pair always sees same ranges:
```javascript
function createSeededRng(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function hashString(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
```

---

## Common Pitfalls

### ❌ Don't: Modify Context with Spread Operator
```javascript
// WRONG - creates new object, original lost
wrapperFunction: (target, context) => {
    return { ...context, total: context.total + 2 };
}
```

### ✅ Do: Modify Context In-Place
```javascript
// CORRECT - modifies original context
wrapperFunction: (target, context) => {
    context.total += 2;
}
```

---

### ❌ Don't: Calculate Game Logic on Client
```javascript
// WRONG - client calculates damage
const damage = attackerStr * weaponMultiplier - defenderAR;
character.HP -= damage;
```

### ✅ Do: Send Action to Server, Display Result
```javascript
// CORRECT - client requests action
socket.emit('attack', { targetId });

// Server calculates
const damage = calculateDamage(attacker, target);
target.takeDamage(damage);
syncAllClients();
```

---

### ❌ Don't: Provide Client-Side Defaults for Server Data
```javascript
// WRONG - client guesses missing values
const hp = char.HP || { current: 0, max: 100 };
const stats = char.stats || { STR: 10, DEX: 10, ... };
```

### ✅ Do: Use Null and Existence Checks
```javascript
// CORRECT - only display what server sent
const hp = char.HP || null;
if (hp !== null) {
    displayHP(hp);
} else {
    displayUnknown();
}
```

---

### ❌ Don't: Calculate Ranges Client-Side
```javascript
// WRONG - client can see real values
const range = buildRange(realValue, error);
display(range); // Browser dev tools can see realValue
```

### ✅ Do: Display Server-Calculated Ranges
```javascript
// CORRECT - client never sees real value
display(char.HP.current.display); // "45-67"
// Real value never sent to client
```

---

### ❌ Don't: Store Sensitive Data in Client State
```javascript
// WRONG - real values accessible via dev tools
const [enemyRealHP, setEnemyRealHP] = useState(char._realHP);
```

### ✅ Do: Only Store Display Data
```javascript
// CORRECT - only display strings stored
const [enemyHPDisplay, setEnemyHPDisplay] = useState(char.HP.current.display);
```

---

## Testing Checklist

### Effect System
- [ ] Effect applies correctly
- [ ] Effect stacks accumulate
- [ ] Effect duration decrements
- [ ] Effect expires at duration 0
- [ ] Effect hooks execute at correct times
- [ ] Effect modifies calculations in-place

### Perception & Obfuscation
- [ ] Low perception (<50%) hides all info
- [ ] Perception ranges (50-90%) show progressive detail
- [ ] High perception (90%+) shows exact values
- [ ] Ranges are consistent per character-player pair
- [ ] Ranges get tighter as perception increases
- [ ] Browser dev tools can't see real values

### Server Authority
- [ ] Turn end syncs all character data
- [ ] Clients replace local state with server data
- [ ] Multiple clients see same state
- [ ] Client modifications don't persist
- [ ] Server recalculates all derived values

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         SERVER                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Game Engine                                       │    │
│  │  - Character state                                 │    │
│  │  - Combat calculations                             │    │
│  │  - Effect processing                               │    │
│  │  - Modifier pipelines                              │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Sync & Obfuscation Layer                          │    │
│  │  - Calculate perception vs stealth                 │    │
│  │  - Determine visibility thresholds                 │    │
│  │  - Apply ranges to numeric values                  │    │
│  │  - Delete restricted fields                        │    │
│  │  - Create seeded RNG for consistency               │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Campaign Manager                                  │    │
│  │  - syncEngineCharacterToToken()                    │    │
│  │  - obfuscateCharacterForPlayer()                   │    │
│  │  - Force-sync on turn end                          │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    Socket.IO Broadcast
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Display Only)                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  React Components                                  │    │
│  │  - Receive server data                             │    │
│  │  - Display pre-calculated ranges                   │    │
│  │  - Show/hide based on existence                    │    │
│  │  - NO game logic calculations                      │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Display Helpers                                   │    │
│  │  - getDisplayValue(): extracts .display property   │    │
│  │  - formatters for visualization only               │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## File Quick Reference

### Server Files
- `server/worldEngine/Character/character.js` - Character class, modifier pipelines, getters
- `server/worldEngine/Effect.js` - StatusEffect class
- `server/worldEngine/combatEngine.js` - Combat calculations, damage, healing
- `server/api/campaign_manager.js` - Sync logic, obfuscation, turn management

### Client Files
- `client/src/pages/game/infoWindows.jsx` - Character info display
- `client/src/data/gameDataContext.jsx` - Game state management

### Documentation
- `SYSTEM_ARCHITECTURE.md` - This file
- `server/worldEngine/VISION_SYSTEM.md` - Vision system details
- `server/handlers/GAME_EVENT_GUIDE.js` - Event system reference

---

## Version History

### v2.0 - Server Authority + Obfuscation (Current)
- Server calculates ALL ranges and visibility
- Client displays pre-calculated values only
- No sensitive data sent to client
- Seeded RNG for consistent ranges

### v1.5 - Perception System
- Added perception vs stealth visibility
- Progressive information reveal
- Client-side range calculation (DEPRECATED)

### v1.0 - Effect System
- Modifier pipeline architecture
- In-place context modification
- Status effect hooks
- Server force-sync on turn end

---

## Contributing Guidelines

### When Adding New Features
1. **Server calculates** - All game logic goes in server files
2. **Client displays** - UI only renders server-provided data
3. **In-place modification** - Modifier hooks modify context directly
4. **No defaults** - Client never guesses missing values
5. **Test obfuscation** - Verify browser dev tools can't access real values

### When Debugging
1. Check server logs first - single source of truth
2. Verify sync happens after state changes
3. Confirm hooks modify context in-place
4. Check if client is trying to calculate game logic
5. Verify obfuscated data doesn't leak real values

---

## Additional Resources

- [Vision System Documentation](server/worldEngine/VISION_SYSTEM.md)
- [Game Event Guide](server/handlers/GAME_EVENT_GUIDE.js)
- [Character Class Reference](server/worldEngine/Character/character.js)
