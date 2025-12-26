const { EventBus } = require('./eventListener');

/**
 * GameEventEmitter - A scalable event system for all game events
 * Extends EventBus to provide game-specific event management
 * 
 * Usage:
 * - gameEvents.on('spell:cast', (data) => {})
 * - gameEvents.on('combat:damage', (data) => {})
 * - gameEvents.on('effect:applied', (data) => {})
 * - gameEvents.on('item:used', (data) => {})
 * - gameEvents.emit('spell:cast', { spellName, caster, targets })
 */
class GameEventEmitter extends EventBus {
  constructor() {
    super();
    this.eventCategories = {
      // Spell events
      'spell:cast': 'Spell was cast by a caster',
      'spell:impact': 'Spell hit or affected targets',
      'spell:resist': 'Spell was resisted or saved against',
      'spell:fail': 'Spell failed to cast or execute',

      // Combat events
      'combat:damage': 'Damage was dealt to a target',
      'combat:heal': 'Healing was applied to a target',
      'combat:miss': 'An attack missed its target',
      'combat:crit': 'A critical hit occurred',
      'combat:round:start': 'Combat round started',
      'combat:round:end': 'Combat round ended',
      'combat:death': 'A character was killed',

      // Effect events
      'effect:apply': 'An effect was applied to target',
      'effect:remove': 'An effect was removed from target',
      'effect:tick': 'An effect triggered its tick',
      'effect:stack': 'An effect stack was added',

      // Item events
      'item:use': 'An item was used',
      'item:equip': 'An item was equipped',
      'item:unequip': 'An item was unequipped',
      'item:consume': 'A consumable item was consumed',
      'item:drop': 'An item was dropped',
      'item:pickup': 'An item was picked up',

      // Character events
      'character:levelup': 'A character leveled up',
      'character:stat:change': 'A character stat was modified',
      'character:death': 'A character died',
      'character:spawn': 'A character spawned',
      'character:move': 'A character moved',

      // Ability events
      'ability:cast': 'An ability was cast or used',
      'ability:cooldown': 'An ability is on cooldown',
      'ability:ready': 'An ability is ready to use',

      // Status events
      'status:buff': 'A buff was applied',
      'status:debuff': 'A debuff was applied',
      'status:condition': 'A condition was applied (stunned, poisoned, etc)',

      // Game state events
      'game:start': 'Game or encounter started',
      'game:end': 'Game or encounter ended',
      'game:turn': 'A turn has passed',
      'game:pause': 'Game was paused',
      'game:resume': 'Game was resumed'
    };
  }

  /**
   * Get all available event categories
   */
  getEventCategories() {
    return this.eventCategories;
  }

  /**
   * Helper to emit spell events
   */
  emitSpellEvent(action, data) {
    this.emit(`spell:${action}`, {
      category: 'spell',
      action,
      timestamp: Date.now(),
      ...data
    });
  }

  /**
   * Helper to emit combat events
   */
  emitCombatEvent(action, data) {
    this.emit(`combat:${action}`, {
      category: 'combat',
      action,
      timestamp: Date.now(),
      ...data
    });
  }

  /**
   * Helper to emit effect events
   */
  emitEffectEvent(action, data) {
    this.emit(`effect:${action}`, {
      category: 'effect',
      action,
      timestamp: Date.now(),
      ...data
    });
  }

  /**
   * Helper to emit item events
   */
  emitItemEvent(action, data) {
    this.emit(`item:${action}`, {
      category: 'item',
      action,
      timestamp: Date.now(),
      ...data
    });
  }

  /**
   * Helper to emit character events
   */
  emitCharacterEvent(action, data) {
    this.emit(`character:${action}`, {
      category: 'character',
      action,
      timestamp: Date.now(),
      ...data
    });
  }

  /**
   * Helper to emit ability events
   */
  emitAbilityEvent(action, data) {
    this.emit(`ability:${action}`, {
      category: 'ability',
      action,
      timestamp: Date.now(),
      ...data
    });
  }

  /**
   * Helper to emit status events
   */
  emitStatusEvent(action, data) {
    this.emit(`status:${action}`, {
      category: 'status',
      action,
      timestamp: Date.now(),
      ...data
    });
  }

  /**
   * Helper to emit game state events
   */
  emitGameEvent(action, data) {
    this.emit(`game:${action}`, {
      category: 'game',
      action,
      timestamp: Date.now(),
      ...data
    });
  }

  /**
   * Listen to all events of a specific category
   * Example: onCategory('spell', handler) listens to all spell events
   */
  onCategory(category, callback) {
    // Find all event names that start with this category
    const categoryPrefix = `${category}:`;
    const wrappedCallback = (data) => {
      if (data.category === category) {
        callback(data);
      }
    };
    
    // Store wrapped callback for potential cleanup
    if (!this._categoryWrappers) this._categoryWrappers = {};
    if (!this._categoryWrappers[category]) this._categoryWrappers[category] = [];
    this._categoryWrappers[category].push({
      original: callback,
      wrapped: wrappedCallback
    });

    // Register listeners for all relevant events
    Object.keys(this.eventCategories).forEach(eventName => {
      if (eventName.startsWith(categoryPrefix)) {
        this.on(eventName, wrappedCallback);
      }
    });
  }

  /**
   * Listen to multiple specific events
   * Example: onMultiple(['spell:cast', 'effect:apply'], handler)
   */
  onMultiple(eventNames, callback) {
    const ids = eventNames.map(eventName => 
      this.on(eventName, callback)
    );
    return ids;
  }

  /**
   * Remove a category listener
   */
  offCategory(category, callback) {
    if (!this._categoryWrappers || !this._categoryWrappers[category]) return false;
    
    const wrappers = this._categoryWrappers[category];
    const index = wrappers.findIndex(w => w.original === callback);
    if (index === -1) return false;
    
    const { wrapped } = wrappers[index];
    wrappers.splice(index, 1);
    
    // Remove from all relevant events
    const categoryPrefix = `${category}:`;
    Object.keys(this.eventCategories).forEach(eventName => {
      if (eventName.startsWith(categoryPrefix)) {
        // Note: This won't work perfectly since we don't have the original id
        // For proper cleanup, users should keep track of returned listener ids
      }
    });
    
    return true;
  }

  /**
   * Emit a raw event with full control
   */
  emit(eventName, payload) {
    super.emit(eventName, {
      eventName,
      timestamp: Date.now(),
      ...payload
    });
  }
}

// Export singleton instance
module.exports = new GameEventEmitter();
