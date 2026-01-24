class Effect {
  constructor(data = {}) {
    this.id = data.id || data.name || null;
    this.name = data.name || data.id || 'Unnamed Effect';
    this.type = data.type || 'Effect';
    this.tier = data.tier || 'Lesser'; // Lesser, Greater, Titan
    this.duration = data.duration == null ? -1 : data.duration; // -1 = permanent
    this.stacks = data.stacks || 1;
    this.maxStacks = data.maxStacks || Infinity;
    this.stackable = data.stackable !== false; // default stackable
    this.description = data.description || '';
    this.school = data.school || 'general';
    this.difficultyClass = data.difficultyClass || null;
    this.savingThrow = data.savingThrow || null; // e.g., "CON", "INT", "WIS"
    
    // Event handlers
    this.onApply = data.onApply || null;
    this.onRemove = data.onRemove || null;
    this.onTick = data.onTick || null;
    this.onStackAdd = data.onStackAdd || null;
    this.onStackRemove = data.onStackRemove || null;
    this.onDamageReceived = data.onDamageReceived || null;
    this.onDealDamage = data.onDealDamage || null;
    this.onSpellCast = data.onSpellCast || null;
    this.onAttackRoll = data.onAttackRoll || null;
    this.onSavingThrow = data.onSavingThrow || null;
    
    this.meta = data;
  }

  // Core lifecycle methods
  apply(target, source = null) {
    // Called when effect is first applied to target
    return { success: true, source };
  }

  remove(target, source = null) {
    // Called when effect is completely removed from target
    return { success: true, source };
  }

  tick(target) {
    // Called every turn the effect is active
    return null;
  }

  // Stack management
  addStack() {
    if (this.stackable && this.stacks < this.maxStacks) {
      this.stacks++;
      return true;
    }
    return false;
  }

  removeStack() {
    if (this.stacks > 1) {
      this.stacks--;
      return true;
    }
    return false;
  }

  // Event execution helpers
  hasEvent(eventName) {
    return this[eventName] !== null && this[eventName] !== undefined;
  }

  getEventHandler(eventName) {
    return this[eventName];
  }

  executeEvent(eventName, context = {}) {
    const handler = this.getEventHandler(eventName);
    if (!handler) return null;
    return {
      effectId: this.id,
      eventName,
      handler,
      context
    };
  }
}

module.exports = Effect;
