const { createEffect } = require('../effects');
const { rollDice } = require('../utils/dice');

class Spell {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.level = data.level || 0;
    this.school = data.school || 'divination';
    this.castingTime = data.castingTime || 'action';
    this.range = data.range || 'self';
    this.duration = data.duration || 'instantaneous';
    this.components = data.components || [];
    this.materials = data.materials || null;
    this.concentration = data.concentration || false;
    this.description = data.description || '';
    this.damage = data.damage || null;
    this.healing = data.healing || null;
    this.tempHP = data.tempHP || null;
    this.savingThrow = data.savingThrow || null;
    this.areaOfEffect = data.areaOfEffect || null;
    this.attributes = data.attributes || [];
    this.rarity = data.rarity || (this.level === 0 ? 'cantrip' : 'common');
  }

  /**
   * Check if spell is a cantrip
   */
  isCantrip() {
    return this.level === 0;
  }

  /**
   * Check if spell requires concentration
   */
  requiresConcentration() {
    return this.concentration;
  }

  /**
   * Check if spell requires specific components
   */
  hasComponent(type) {
    return this.components.includes(type);
  }

  /**
   * Cast the spell and resolve damage
   * @param {Object} caster - The creature casting the spell
   * @param {Object} target - The target creature (or null for AOE)
   * @param {Number} spellSlotLevel - The spell slot level used (for upcasting)
   * @returns {Object} result containing damage, healing, effects, etc.
   */
  cast(caster, target, spellSlotLevel = this.level) {
    const result = {
      spell: this.name,
      spellLevel: this.level,
      slotLevelUsed: spellSlotLevel,
      damage: null,
      healing: null,
      tempHP: null,
      effects: [],
      savingThrow: this.savingThrow,
      areaOfEffect: this.areaOfEffect,
      message: ''
    };

    // Calculate upcast bonus (some spells scale with higher slots)
    const upcastLevel = Math.max(0, spellSlotLevel - this.level);

    // Roll damage if applicable
    if (this.damage && target) {
      const damageRolls = {};
      for (const [damageType, diceString] of Object.entries(this.damage)) {
        const baseDamage = rollDice(diceString);
        // Some spells gain extra damage per upcast level (typically 1d6 or similar)
        const scaleDamage = upcastLevel > 0 && this.level >= 1 ? upcastLevel * rollDice('1d6') : 0;
        damageRolls[damageType] = baseDamage + scaleDamage;
      }
      result.damage = damageRolls;
      result.message += `${this.name} deals ${JSON.stringify(damageRolls)} damage. `;
    }

    // Roll healing if applicable
    if (this.healing) {
      const baseHealing = rollDice(this.healing);
      const scaleHealing = upcastLevel > 0 && this.level >= 1 ? upcastLevel * rollDice('1d4') : 0;
      result.healing = baseHealing + scaleHealing;
      result.message += `${this.name} heals ${result.healing} hit points. `;
    }

    // Award temporary hit points
    if (this.tempHP) {
      let temp = this.tempHP;
      if (typeof temp === 'string') {
        temp = rollDice(temp);
      }
      result.tempHP = temp;
      result.message += `${this.name} grants ${temp} temporary hit points. `;
    }

    // Create passive effects (concentration spells, buffs, debuffs, etc.)
    if (this.attributes.includes('defense') && this.concentration) {
      result.effects.push({
        type: 'DamageBonus',
        name: `${this.name} (Defense)`,
        duration: this.duration,
        statType: 'AC',
        amount: 1
      });
    }

    if (this.attributes.includes('buff')) {
      result.effects.push({
        type: 'CompositeEffect',
        name: `${this.name} (Buff)`,
        duration: this.duration,
        effects: []
      });
    }

    return result;
  }

  /**
   * Get spell information for display
   */
  getInfo() {
    return {
      name: this.name,
      level: this.level,
      school: this.school,
      castingTime: this.castingTime,
      range: this.range,
      duration: this.duration,
      components: this.components.join(', '),
      concentration: this.concentration,
      description: this.description
    };
  }
}

/**
 * Create a spell instance from JSON data
 * @param {Object} data - Spell data object
 * @returns {Spell} spell instance
 */
function createSpell(data) {
  return new Spell(data);
}

module.exports = {
  Spell,
  createSpell
};
