const { createEffect } = require('../effects');
const { rollDice } = require('../utils/dice');

class Item {
  constructor(data = {}) {
    this.id = data.id || data.name || null;
    this.type = data.type || 'Item';
    this.name = data.name || 'Unnamed';
    this.description = data.description || '';
    this.weight = data.weight || 0;
    this.cost = data.cost || 0;
    this.rarity = data.rarity || 'common';
    this.meta = data;
  }

  equip(character) {}
  unequip(character) {}
  use(character, target) {}
}

class Weapon extends Item {
  constructor(data = {}) {
    super(data);
    this.damageType = data.damageType || 'bludgeon';
    // damage: object mapping action -> dice string, or damageDice simple string
    this.damage = data.damage || (data.damageDice ? { default: data.damageDice } : {});
    this.slot = data.slot || { hands: 1 };
    this.effects = (data.effects || []).map(e => createEffect(e));
  }

  equip(character) {
    character.equipment = character.equipment || {};
    // slot can be string or object mapping slotName -> count
    const slots = typeof this.slot === 'string' ? { [this.slot]: 1 } : this.slot;
    Object.entries(slots).forEach(([slotName, count]) => {
      character.equipment[slotName] = character.equipment[slotName] || [];
      for (let i = 0; i < (count || 1); i++) character.equipment[slotName].push(this);
    });
  }

  unequip(character) {
    if (!character.equipment) return;
    const slots = typeof this.slot === 'string' ? { [this.slot]: 1 } : this.slot;
    Object.keys(slots).forEach(slotName => {
      if (!character.equipment[slotName]) return;
      character.equipment[slotName] = character.equipment[slotName].filter(i => i !== this);
      if (character.equipment[slotName].length === 0) delete character.equipment[slotName];
    });
  }

  use(character, target, action = 'default') {
    const actionKey = action || 'default';
    const dice = this.damage[actionKey] || this.damage.default || this.damage.attack || '0';
    const roll = rollDice(dice);
    // decide stat bonus: melee uses STR unless item.meta.finesse true
    const isMelee = (this.meta && this.meta.attributes && this.meta.attributes.includes('melee'));
    const finesse = this.meta && this.meta.attributes && this.meta.attributes.includes('finesse');
    const stat = (isMelee && finesse) ? ((character.stats && character.stats.DEX) || 0) : ((character.stats && character.stats.STR) || 0);
    const total = roll + stat;
    if (target && typeof target.takeDamage === 'function') target.takeDamage(total, { source: this, action: actionKey });
    this.effects.forEach(e => target.addEffect && target.addEffect(createEffect(e.meta || e)));
    return total;
  }
}

class Armor extends Item {
  constructor(data = {}) {
    super(data);
    this.armorClass = data.armorClass || 0;
    this.slot = data.slot || 'chest';
    this.statBonuses = data.statBonuses || {};
  }

  equip(character) {
    character.equipment = character.equipment || {};
    character.equipment[this.slot] = this;
    character.armorClass = (character.armorClass || 0) + this.armorClass;
    Object.entries(this.statBonuses).forEach(([k, v]) => {
      character.stats = character.stats || {};
      character.stats[k] = (character.stats[k] || 0) + v;
    });
  }

  unequip(character) {
    if (character.equipment) delete character.equipment[this.slot];
    character.armorClass = (character.armorClass || 0) - this.armorClass;
    Object.entries(this.statBonuses).forEach(([k, v]) => {
      character.stats[k] = (character.stats[k] || 0) - v;
    });
  }
}

class Consumable extends Item {
  constructor(data = {}) {
    super(data);
    this.maxCharges = data.maxCharges || 1;
    this.currentCharges = data.currentCharges == null ? this.maxCharges : data.currentCharges;
    this.effects = (data.effects || []).map(e => createEffect(e));
  }

  use(character, target) {
    if (this.currentCharges <= 0) return false;
    this.effects.forEach(e => {
      const inst = createEffect(e.meta || e);
      target.addEffect && target.addEffect(inst);
    });
    this.currentCharges--;
    return true;
  }
}

class MagicItem extends Item {
  constructor(data = {}) {
    super(data);
    this.enchantment = data.enchantment;
    this.activeEffect = data.activeEffect ? createEffect(data.activeEffect) : null;
    this.passiveEffects = (data.passiveEffects || []).map(e => createEffect(e));
  }

  equip(character) {
    this.passiveEffects.forEach(e => character.addEffect && character.addEffect(e));
  }

  unequip(character) {
    this.passiveEffects.forEach(e => character.removeEffect && character.removeEffect(e));
  }

  use(character, target) {
    if (this.activeEffect) target.addEffect && target.addEffect(this.activeEffect);
  }
}

const registry = { Weapon, Armor, Consumable, MagicItem };

function createItem(data) {
  const C = registry[data.type];
  if (!C) throw new Error(`Unknown item type: ${data.type}`);
  return new C(data);
}

module.exports = { Item, Weapon, Armor, Consumable, MagicItem, createItem };
