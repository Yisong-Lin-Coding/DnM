const Effect = require('./Effect');

// Event Handler System
class EventBus {
  constructor() {
    this.listeners = {};
  }

  on(eventName, callback) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(callback);
  }

  off(eventName, callback) {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName] = this.listeners[eventName].filter(cb => cb !== callback);
  }

  emit(eventName, data) {
    if (!this.listeners[eventName]) return [];
    const results = [];
    this.listeners[eventName].forEach(callback => {
      const result = callback(data);
      if (result) results.push(result);
    });
    return results;
  }

  clear() {
    this.listeners = {};
  }
}

// Effect Handler Executors
class EffectExecutor {
  static executeHandler(handler, context = {}) {
    if (!handler) return null;

    const { type, ...params } = handler;

    switch (type) {
      case 'applyModifiers':
        return this.applyModifiers(params, context);
      case 'dealDamage':
        return this.dealDamage(params, context);
      case 'dealDamageOnSave':
        return this.dealDamageOnSave(params, context);
      case 'applyEffect':
        return this.applyEffect(params, context);
      case 'compoundEffect':
        return this.compoundEffect(params, context);
      case 'checkInstantDeath':
        return this.checkInstantDeath(params, context);
      case 'triggerSubclassAbility':
        return this.triggerSubclassAbility(params, context);
      case 'triggerCheckOnAttack':
        return this.triggerCheckOnAttack(params, context);
      case 'triggerCheckOnTick':
        return this.triggerCheckOnTick(params, context);
      default:
        return { type, params, context };
    }
  }

  static applyModifiers({ modifiers, stackingMode }, context = {}) {
    const { target, effect } = context;
    if (!target) return null;

    if (!target._effectModifiers) {
      target._effectModifiers = {};
    }

    const stacks = effect?.stacks || 1;
    const multiplier = stackingMode === 'perStack' ? stacks : 1;

    Object.entries(modifiers).forEach(([key, value]) => {
      if (typeof value === 'number') {
        target._effectModifiers[key] = (target._effectModifiers[key] || 0) + (value * multiplier);
      } else {
        target._effectModifiers[key] = value;
      }
    });

    return { success: true, modifiers, applied: stackingMode === 'perStack' ? multiplier : 1 };
  }

  static dealDamage({ diceFormula, damageType, scalingMode }, context = {}) {
    const { target, effect } = context;
    if (!target) return null;

    const stacks = effect?.stacks || 1;
    const scaling = scalingMode === 'perStack' ? stacks : 1;

    return {
      action: 'dealDamage',
      diceFormula,
      damageType,
      scaling,
      totalStacks: stacks
    };
  }

  static dealDamageOnSave({ diceFormula, damageType, savingThrow, dc }, context = {}) {
    const { target } = context;
    if (!target) return null;

    return {
      action: 'dealDamageOnSave',
      diceFormula,
      damageType,
      savingThrow,
      dc,
      targetId: target.id
    };
  }

  static applyEffect({ effectId, stacks }, context = {}) {
    return {
      action: 'applyEffect',
      effectId,
      stacks: stacks || 1
    };
  }

  static compoundEffect({ effects }, context = {}) {
    const results = [];
    effects.forEach(handler => {
      const result = EffectExecutor.executeHandler(handler, context);
      if (result) results.push(result);
    });
    return { action: 'compoundEffect', results };
  }

  static checkInstantDeath({ triggerAtStack }, context = {}) {
    const { effect } = context;
    if (!effect || effect.stacks < triggerAtStack) return null;

    return {
      action: 'instantDeath',
      triggerAtStack,
      currentStack: effect.stacks
    };
  }

  static triggerSubclassAbility({ abilityKey }, context = {}) {
    const { target } = context;
    if (!target) return null;

    return {
      action: 'triggerSubclassAbility',
      abilityKey,
      targetId: target.id
    };
  }

  static triggerCheckOnAttack({ checkType, dc, savingThrow, failureEffect }, context = {}) {
    return {
      action: 'triggerCheckOnAttack',
      checkType,
      dc,
      savingThrow,
      failureEffect
    };
  }

  static triggerCheckOnTick({ checkType, dc, onFailureChain }, context = {}) {
    return {
      action: 'triggerCheckOnTick',
      checkType,
      dc,
      onFailureChain
    };
  }
}

// Status Condition Effects
class StatusCondition extends Effect {
  constructor(data = {}) {
    super(data);
    this.attributes = data.attributes || [];
  }
}

class DamageBonus extends Effect {
  constructor(data = {}) {
    super(data);
    this.statType = data.statType || 'STR';
    this.amount = data.amount || 0;
  }

  apply(target) {
    target._effectBonuses = target._effectBonuses || {};
    target._effectBonuses[this.statType] = (target._effectBonuses[this.statType] || 0) + this.amount;
  }

  remove(target) {
    if (!target._effectBonuses) return;
    target._effectBonuses[this.statType] = (target._effectBonuses[this.statType] || 0) - this.amount;
  }
}

class HealthRegen extends Effect {
  constructor(data = {}) {
    super(data);
    this.amountPerTurn = data.amountPerTurn || 0;
  }

  tick(target) {
    if (!target || typeof target.hp !== 'number') return;
    target.hp = Math.min(target.maxHp || Infinity, (target.hp || 0) + this.amountPerTurn);
  }
}

class Stun extends Effect {
  constructor(data = {}) {
    super(data);
  }

  apply(target) {
    target.stunned = true;
  }

  remove(target) {
    target.stunned = false;
  }
}

class CompositeEffect extends Effect {
  constructor(data = {}) {
    super(data);
    this.childEffects = (data.effects || []).map(e => createEffect(e));
  }

  apply(target) {
    this.childEffects.forEach(e => e && e.apply && e.apply(target));
  }

  remove(target) {
    this.childEffects.forEach(e => e && e.remove && e.remove(target));
  }

  tick(target) {
    this.childEffects.forEach(e => e && e.tick && e.tick(target));
  }
}

const registry = {
  DamageBonus,
  HealthRegen,
  Stun,
  CompositeEffect,
  StatusCondition,
};

function createEffect(data) {
  if (!data) return null;
  const Type = registry[data.type] || registry.StatusCondition;
  return new Type(data);
}

// Load effects from JSON
const effectsData = require('./effects.json');
const effectRegistry = {};

effectsData.forEach(effectData => {
  effectRegistry[effectData.id] = effectData;
});

function getEffect(effectId) {
  const data = effectRegistry[effectId];
  if (!data) throw new Error(`Unknown effect: ${effectId}`);
  return createEffect(data);
}

function getEffectData(effectId) {
  return effectRegistry[effectId];
}

function getEffectsByTier(tier) {
  return effectsData.filter(e => e.tier === tier);
}

function getEffectsBySchool(school) {
  return effectsData.filter(e => e.school === school);
}

function getAllEffects() {
  return effectsData;
}

// Effect Application Context Handler
class EffectContext {
  constructor(target, source = null) {
    this.target = target;
    this.source = source;
    this.eventBus = new EventBus();
    this.activeEffects = {};
  }

  applyEffect(effectId, stacks = 1, source = null) {
    const effectData = getEffectData(effectId);
    if (!effectData) return { success: false, error: `Unknown effect: ${effectId}` };

    const effect = createEffect(effectData);
    effect.stacks = stacks;

    if (!this.activeEffects[effectId]) {
      this.activeEffects[effectId] = [];
    }

    // Execute onApply handler
    if (effect.onApply) {
      const context = { target: this.target, effect, source };
      const result = EffectExecutor.executeHandler(effect.onApply, context);
      if (result) {
        this.eventBus.emit('effectApplied', {
          effectId,
          effect,
          result,
          context
        });
      }
    }

    this.activeEffects[effectId].push(effect);
    return { success: true, effect };
  }

  removeEffect(effectId) {
    if (!this.activeEffects[effectId]) return { success: false };

    const effects = this.activeEffects[effectId];
    effects.forEach(effect => {
      if (effect.onRemove) {
        const context = { target: this.target, effect };
        EffectExecutor.executeHandler(effect.onRemove, context);
      }
    });

    delete this.activeEffects[effectId];
    return { success: true };
  }

  addStack(effectId, amount = 1) {
    if (!this.activeEffects[effectId] || this.activeEffects[effectId].length === 0) {
      return { success: false };
    }

    const effect = this.activeEffects[effectId][0];
    let added = 0;

    for (let i = 0; i < amount; i++) {
      if (effect.addStack()) {
        added++;
        // Execute onStackAdd handler
        if (effect.onStackAdd) {
          const context = { target: this.target, effect };
          EffectExecutor.executeHandler(effect.onStackAdd, context);
        }
      }
    }

    return { success: added > 0, stacksAdded: added };
  }

  tickAllEffects() {
    const results = [];
    Object.entries(this.activeEffects).forEach(([effectId, effects]) => {
      effects.forEach(effect => {
        if (effect.onTick) {
          const context = { target: this.target, effect };
          const result = EffectExecutor.executeHandler(effect.onTick, context);
          if (result) {
            results.push({
              effectId,
              effect,
              result
            });
          }
        }

        // Standard tick
        const tickResult = effect.tick(this.target);
        if (tickResult) results.push(tickResult);
      });
    });
    return results;
  }

  getActiveEffects(school = null) {
    const effects = [];
    Object.entries(this.activeEffects).forEach(([effectId, effectList]) => {
      effectList.forEach(effect => {
        if (!school || effectRegistry[effectId]?.school === school) {
          effects.push({
            id: effectId,
            effect,
            stacks: effect.stacks
          });
        }
      });
    });
    return effects;
  }
}

module.exports = {
  Effect,
  EventBus,
  EffectExecutor,
  EffectContext,
  registry,
  createEffect,
  getEffect,
  getEffectData,
  getEffectsByTier,
  getEffectsBySchool,
  getAllEffects,
  effectRegistry,
  DamageBonus,
  HealthRegen,
  Stun,
  CompositeEffect,
  StatusCondition,
};
