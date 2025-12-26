/**
 * GAME EVENT SYSTEM - COMPREHENSIVE USAGE GUIDE
 * 
 * The GameEventEmitter is a scalable event system that all game systems can use.
 * It's built on top of EventBus and provides a unified way to track all game events.
 */

const gameEvents = require('./gameEventEmitter');

// ============================================================
// QUICK START
// ============================================================

// Listen to a specific event
gameEvents.on('spell:cast', (data) => {
  console.log(`${data.caster} cast ${data.spellName}`);
});

// Listen to all events of a category
gameEvents.onCategory('spell', (data) => {
  console.log(`Spell event: ${data.action}`);
});

// Emit an event
gameEvents.emitSpellEvent('cast', {
  spellName: 'fireball',
  caster: 'Wizard',
  targetCount: 3
});

// ============================================================
// EVENT CATEGORIES
// ============================================================

const categories = gameEvents.getEventCategories();

// Spell Events
// - spell:cast      Spell was cast by a caster
// - spell:impact    Spell hit or affected targets
// - spell:resist    Spell was resisted or saved against
// - spell:fail      Spell failed to cast or execute

// Combat Events
// - combat:damage   Damage was dealt to a target
// - combat:heal     Healing was applied to a target
// - combat:miss     An attack missed its target
// - combat:crit     A critical hit occurred
// - combat:round:*  Round start/end events
// - combat:death    A character was killed

// Effect Events
// - effect:apply    An effect was applied to target
// - effect:remove   An effect was removed from target
// - effect:tick     An effect triggered its tick
// - effect:stack    An effect stack was added

// Item Events
// - item:use        An item was used
// - item:equip      An item was equipped
// - item:unequip    An item was unequipped
// - item:consume    A consumable item was consumed
// - item:drop       An item was dropped
// - item:pickup     An item was picked up

// Character Events
// - character:levelup     A character leveled up
// - character:stat:change A character stat was modified
// - character:death       A character died
// - character:spawn       A character spawned
// - character:move        A character moved

// Ability Events
// - ability:cast    An ability was cast or used
// - ability:cooldown An ability is on cooldown
// - ability:ready   An ability is ready to use

// Status Events
// - status:buff     A buff was applied
// - status:debuff   A debuff was applied
// - status:condition A condition was applied

// Game State Events
// - game:start  Game or encounter started
// - game:end    Game or encounter ended
// - game:turn   A turn has passed
// - game:pause  Game was paused
// - game:resume Game was resumed

// ============================================================
// LISTENING PATTERNS
// ============================================================

// 1. Listen to specific event
gameEvents.on('spell:cast', (data) => {
  console.log('Spell cast:', data);
});

// 2. Listen to all events of a category
gameEvents.onCategory('combat', (data) => {
  console.log('Combat event:', data.action, data);
});

// 3. Listen to multiple specific events
const ids = gameEvents.onMultiple(['spell:cast', 'effect:apply'], (data) => {
  console.log('Spell or effect event:', data);
});

// 4. One-time listener
gameEvents.once('game:start', (data) => {
  console.log('Game started, this will only fire once');
});

// 5. Remove listener by event name and ID
const listenerId = gameEvents.on('spell:cast', (data) => {
  console.log('Listening...');
});
gameEvents.off('spell:cast', listenerId);

// ============================================================
// EMITTING PATTERNS
// ============================================================

// Using helper methods (recommended)
gameEvents.emitSpellEvent('cast', {
  spellName: 'fireball',
  caster: 'Wizard',
  targetCount: 3,
  spellLevel: 3
});

gameEvents.emitCombatEvent('damage', {
  source: 'Warrior',
  target: 'Goblin',
  damage: 25,
  damageType: 'slashing'
});

gameEvents.emitEffectEvent('apply', {
  effect: 'bleed',
  target: 'Goblin',
  stacks: 2,
  duration: 5
});

gameEvents.emitItemEvent('use', {
  item: 'Health Potion',
  user: 'Cleric',
  effect: 'healed for 20 HP'
});

gameEvents.emitCharacterEvent('levelup', {
  character: 'Warrior',
  newLevel: 5,
  gainedExperience: 1000
});

gameEvents.emitAbilityEvent('cast', {
  ability: 'Power Attack',
  caster: 'Warrior',
  targets: 1
});

gameEvents.emitStatusEvent('buff', {
  status: 'Strength Boost',
  target: 'Warrior',
  magnitude: '+2 STR',
  duration: 10
});

gameEvents.emitGameEvent('turn', {
  turnNumber: 5,
  currentActor: 'Wizard'
});

// Using raw emit for custom events
gameEvents.emit('custom:event', {
  customData: 'value'
});

// ============================================================
// PRACTICAL EXAMPLES
// ============================================================

// Example 1: Combat Logger
const combatLogger = {
  init() {
    gameEvents.onCategory('combat', (data) => {
      const timestamp = new Date(data.timestamp).toLocaleTimeString();
      console.log(`[${timestamp}] ${data.action}: `, data);
    });
  }
};
combatLogger.init();

// Example 2: Damage Tracker
const damageTracker = {
  stats: {},
  init() {
    gameEvents.on('combat:damage', (data) => {
      if (!this.stats[data.source]) this.stats[data.source] = 0;
      this.stats[data.source] += data.damage;
    });
  },
  getStats() { return this.stats; }
};
damageTracker.init();

// Example 3: Spell Cast Counter
const spellCounter = {
  counts: {},
  init() {
    gameEvents.on('spell:cast', (data) => {
      const spell = data.spellName;
      this.counts[spell] = (this.counts[spell] || 0) + 1;
    });
  },
  getMostUsedSpell() {
    return Object.entries(this.counts).sort((a, b) => b[1] - a[1])[0];
  }
};
spellCounter.init();

// Example 4: Effect Manager with Event Hooks
const effectManager = {
  activeEffects: new Map(),
  
  init() {
    gameEvents.on('effect:apply', (data) => {
      const key = `${data.target}:${data.effect}`;
      this.activeEffects.set(key, {
        effect: data.effect,
        target: data.target,
        stacks: data.stacks || 1,
        appliedAt: data.timestamp,
        duration: data.duration
      });
      console.log(`Effect applied: ${data.effect} on ${data.target}`);
    });

    gameEvents.on('effect:remove', (data) => {
      const key = `${data.target}:${data.effect}`;
      this.activeEffects.delete(key);
      console.log(`Effect removed: ${data.effect} from ${data.target}`);
    });

    gameEvents.on('effect:tick', (data) => {
      console.log(`${data.effect} ticked on ${data.target}`);
    });
  },

  getActiveEffects(target) {
    const effects = [];
    this.activeEffects.forEach((value, key) => {
      if (key.startsWith(target)) {
        effects.push(value);
      }
    });
    return effects;
  }
};
effectManager.init();

// Example 5: Spell Event Integration in Spells
// In spells.js:
// gameEvents.emitSpellEvent('cast', {
//   spellName: 'fireball',
//   caster: caster.name,
//   targetCount: targets.length
// });
//
// gameEvents.emitCombatEvent('damage', {
//   source: caster.name,
//   target: target.name,
//   damage: finalDamage,
//   damageType: 'fire'
// });

// Example 6: Multiple System Integration
const gameLogicHub = {
  init() {
    // React to spell casts by triggering effects
    gameEvents.on('spell:cast', (data) => {
      if (data.spellName === 'fireball') {
        // Execute fireball-specific logic
        console.log('Fireball special logic triggered');
      }
    });

    // React to damage by applying statuses
    gameEvents.on('combat:damage', (data) => {
      if (data.damage > 20) {
        // Heavy damage triggers a stagger
        gameEvents.emitStatusEvent('debuff', {
          status: 'Staggered',
          target: data.target,
          duration: 1
        });
      }
    });

    // React to effects by modifying game state
    gameEvents.on('effect:apply', (data) => {
      if (data.effect === 'burning') {
        // Burning reduces movement speed
        console.log(`${data.target} is burning - speed reduced`);
      }
    });
  }
};
gameLogicHub.init();

// Example 7: UI/Client Updates via Socket.IO
// In your socket handler:
// gameEvents.on('spell:cast', (data) => {
//   socket.emit('game:spell:cast', data);
// });
//
// gameEvents.on('combat:damage', (data) => {
//   socket.emit('game:damage', data);
// });

// ============================================================
// EVENT DATA STRUCTURE
// ============================================================

// All events automatically include:
{
  eventName: 'spell:cast',      // The event name
  timestamp: 1703116800000,     // When it happened
  // ... plus your custom data
}

// Spell Cast Example:
{
  eventName: 'spell:cast',
  category: 'spell',
  action: 'cast',
  timestamp: 1703116800000,
  spellName: 'fireball',
  spellLevel: 3,
  school: 'evocation',
  caster: 'Wizard',
  targetCount: 3
}

// Combat Damage Example:
{
  eventName: 'combat:damage',
  category: 'combat',
  action: 'damage',
  timestamp: 1703116800000,
  source: 'Warrior',
  target: 'Goblin',
  damage: 25,
  damageType: 'slashing',
  sourceType: 'spell',
  spellName: 'acid_splash'
}

// ============================================================
// BEST PRACTICES
// ============================================================

// 1. Store listener IDs if you need to remove them later
const spellCastId = gameEvents.on('spell:cast', myHandler);
// ... later ...
gameEvents.off('spell:cast', spellCastId);

// 2. Use onCategory for broad event listening
gameEvents.onCategory('spell', (data) => {
  // Handles spell:cast, spell:impact, spell:resist, spell:fail
  handleSpellEvent(data);
});

// 3. Wrap emit calls in try-catch for safety
try {
  gameEvents.emitCombatEvent('damage', data);
} catch (err) {
  console.error('Failed to emit damage event:', err);
}

// 4. Use descriptive event names
// Good: 'spell:cast', 'effect:apply'
// Bad: 'event', 'data'

// 5. Include enough context in event data
// Good: { source, target, damage, damageType }
// Bad: { amount }

module.exports = { gameEvents };
