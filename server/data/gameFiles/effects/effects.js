// Damage resistance/vulnerability multipliers
const DAMAGE_MULTIPLIERS = {
  'flaw': 4,           // Takes 4x damage
  'weakness': 2,       // Takes 2x damage
  'vulnerable': 1.5,   // Takes 1.5x damage
  'normal': 1.0,       // Takes 1x damage
  'resistant': 0.75,   // Takes 0.75x damage
  'highly_resistant': 0.50,  // Takes 0.5x damage
  'immune': 0.25,      // Takes 0.25x damage
  'true_immunity': 0   // Takes 0 damage (cannot be stacked)
};

// Helper function to calculate final damage with resistance/vulnerability
const calculateDamageWithResistance = (baseDamage, target, damageType) => {
  const resistanceLevel = target.getResistanceLevel ? target.getResistanceLevel(damageType) : 'normal';
  const multiplier = DAMAGE_MULTIPLIERS[resistanceLevel] !== undefined ? DAMAGE_MULTIPLIERS[resistanceLevel] : 1.0;
  return Math.floor(baseDamage * multiplier);
};

const effects = {
  exhaustion: {
    id: "exhaustion",
    name: "Exhaustion",
    tier: "Lesser",
    description: "Progressive exhaustion effect with stacking penalties",
    school: "condition",
    stackable: true,
    maxStacks: 9,
    onApply(target, stacks) {
      target.addModifier('rollPenalty', -2 * stacks);
      target.addModifier('staCostMultiplier', 2 * stacks);
      target.addModifier('mpCostMultiplier', 2 * stacks);
      target.addModifier('painToleranceDecrease', 0.25 * stacks);
    },
    onTick(target, stacks) {
      if (stacks >= 9) {
        target.instantDeath();
      }
    },
    onStackAdd(target, newStack) {
      target.addModifier('rollPenalty', -2);
      target.addModifier('staCostMultiplier', 0.5);
      target.addModifier('mpCostMultiplier', 0.5);
      target.addModifier('painToleranceDecrease', 0.05);
    }
  },

  bleed: {
    id: "bleed",
    name: "Bleed",
    tier: "Lesser",
    description: "Take 1d4 damage per stack at end of turn",
    school: "condition",
    stackable: true,
    maxStacks: 99,
    onTick(target, stacks) {
      const baseDamage = this.rollDice("1d4") * stacks;
      const finalDamage = calculateDamageWithResistance(baseDamage, target, "physical");
      target.takeDamage(finalDamage, "physical");
    }
  },

  frightened: {
    id: "frightened",
    name: "Frightened",
    tier: "Lesser",
    description: "Unable to attack the caster, pain tolerance decreased",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    onApply(target, caster) {
      target.addModifier('cannotAttackCaster', true);
      target.addModifier('painToleranceDecrease', 0.1);
    }
  },

  bind: {
    id: "bind",
    name: "Bind",
    tier: "Lesser",
    description: "Decreases speed by 1 per stack",
    school: "condition",
    stackable: true,
    maxStacks: 99,
    onApply(target, stacks) {
      target.addModifier('speed', -1 * stacks);
    }
  },

  lockdown: {
    id: "lockdown",
    name: "Lockdown",
    tier: "Greater",
    description: "Decreases speed by 5 per stack",
    school: "condition",
    stackable: true,
    maxStacks: 99,
    onApply(target, stacks) {
      target.addModifier('speedDecrease', 5 * stacks);
    }
  },

  marked: {
    id: "marked",
    name: "Marked",
    tier: "Greater",
    description: "Various effects depending on opponent subclass",
    school: "condition",
    stackable: true,
    maxStacks: 99,
    onApply(target, caster) {
      const subclass = target.getSubclass();
      if (subclass && subclass.markedEffect) {
        subclass.markedEffect(target, caster);
      }
    }
  },

  speed_blitzed: {
    id: "speed_blitzed",
    name: "Speed Blitzed",
    tier: "Greater",
    description: "Target cannot react to fast movements",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      target.addModifier('reactionAdvantage', -1);
    }
  },

  lesser_blindness: {
    id: "lesser_blindness",
    name: "Lesser Blindness",
    tier: "Lesser",
    description: "Half perception",
    school: "affliction",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      target.addModifier('perceptionMultiplier', 0.5);
    }
  },

  greater_blindness: {
    id: "greater_blindness",
    name: "Greater Blindness",
    tier: "Greater",
    description: "Half perception and disadvantage per stack",
    school: "affliction",
    stackable: true,
    maxStacks: 3,
    onApply(target, stacks) {
      target.addModifier('perceptionMultiplier', 0.5);
      target.addModifier('advantage', -stacks);
    }
  },

  true_blindness: {
    id: "true_blindness",
    name: "True Blindness",
    tier: "Greater",
    description: "Perception set to zero, 10x disadvantage",
    school: "affliction",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      target.setModifier('perceptionMultiplier', 0);
      target.addModifier('disadvantge', 10);
    }
  },

  weak_poison: {
    id: "weak_poison",
    name: "Weak Poison",
    tier: "Lesser",
    description: "1d4 poison damage on failed CON check",
    school: "poison",
    difficultyClass: 11,
    savingThrow: "CON",
    onTick(target, stacks, caster) {
      const dc = 11;
      const result = target.makeSavingThrow("CON", dc);
      if (!result.success) {
        const baseDamage = this.rollDice("1d4");
        const finalDamage = calculateDamageWithResistance(baseDamage, target, "poison");
        target.takeDamage(finalDamage, "poison");
      }
    }
  },

  strong_poison: {
    id: "strong_poison",
    name: "Strong Poison",
    tier: "Lesser",
    description: "2d6 poison damage on failed CON check",
    school: "poison",
    difficultyClass: 13,
    savingThrow: "CON",
    onTick(target, stacks, caster) {
      const dc = 13;
      const result = target.makeSavingThrow("CON", dc);
      if (!result.success) {
        const baseDamage = this.rollDice("2d6");
        const finalDamage = calculateDamageWithResistance(baseDamage, target, "poison");
        target.takeDamage(finalDamage, "poison");
      }
    }
  },

  advance_poison: {
    id: "advance_poison",
    name: "Advance Poison",
    tier: "Lesser",
    description: "4d4 poison damage on failed CON check",
    school: "poison",
    difficultyClass: 15,
    savingThrow: "CON",
    onTick(target, stacks, caster) {
      const dc = 15;
      const result = target.makeSavingThrow("CON", dc);
      if (!result.success) {
        const baseDamage = this.rollDice("4d4");
        const finalDamage = calculateDamageWithResistance(baseDamage, target, "poison");
        target.takeDamage(finalDamage, "poison");
      }
    }
  },

  lesser_draconic_poison: {
    id: "lesser_draconic_poison",
    name: "Lesser Draconic Poison",
    tier: "Greater",
    description: "4d8 poison damage on failed CON check",
    school: "poison",
    difficultyClass: 17,
    savingThrow: "CON",
    onTick(target, stacks, caster) {
      const dc = 17;
      const result = target.makeSavingThrow("CON", dc);
      if (!result.success) {
        const baseDamage = this.rollDice("4d8");
        const finalDamage = calculateDamageWithResistance(baseDamage, target, "poison");
        target.takeDamage(finalDamage, "poison");
      }
    }
  },

  greater_draconic_poison: {
    id: "greater_draconic_poison",
    name: "Greater Draconic Poison",
    tier: "Greater",
    description: "4d12 poison damage on failed CON check",
    school: "poison",
    difficultyClass: 19,
    savingThrow: "CON",
    onTick(target, stacks, caster) {
      const dc = 19;
      const result = target.makeSavingThrow("CON", dc);
      if (!result.success) {
        const damage = this.rollDice("4d12");
        target.takeDamage(damage, "poison");
      }
    }
  },

  deaths_touch: {
    id: "deaths_touch",
    name: "Death's Touch",
    tier: "Titan",
    description: "6d20 poison damage on failed CON check",
    school: "poison",
    difficultyClass: 21,
    savingThrow: "CON",
    onTick(target, stacks, caster) {
      const dc = 21;
      const result = target.makeSavingThrow("CON", dc);
      if (!result.success) {
        const damage = this.rollDice("6d20");
        target.takeDamage(damage, "poison");
      }
    }
  },

  enchanted: {
    id: "enchanted",
    name: "Enchanted",
    tier: "Lesser",
    description: "Must make DC 11 Mental check to harm the caster",
    school: "enchantment",
    difficultyClass: 11,
    savingThrow: "WIS",
    stackable: false,
    maxStacks: 1,
    onAttack(target, caster) {
      const dc = 11;
      const result = target.makeAbilityCheck("WIS", dc);
      if (!result.success) {
        return false; // Cannot attack
      }
      return true;
    }
  },

  mesmerized: {
    id: "mesmerized",
    name: "Mesmerized",
    tier: "Lesser",
    description: "Must make DC 15 Mental check to harm the caster",
    school: "enchantment",
    difficultyClass: 15,
    savingThrow: "WIS",
    stackable: false,
    maxStacks: 1,
    onAttack(target, caster) {
      const dc = 15;
      const result = target.makeAbilityCheck("WIS", dc);
      if (!result.success) {
        return false; // Cannot attack
      }
      return true;
    }
  },

  charmed: {
    id: "charmed",
    name: "Charmed",
    tier: "Greater",
    description: "Cannot harm the caster",
    school: "enchantment",
    stackable: false,
    maxStacks: 1,
    onApply(target, caster) {
      target.addModifier('cannotHarmTarget', { target: caster });
    }
  },

  enthralled: {
    id: "enthralled",
    name: "Enthralled",
    tier: "Greater",
    description: "Will protect caster with all power (DM control)",
    school: "enchantment",
    stackable: false,
    maxStacks: 1,
    onApply(target, caster) {
      target.addModifier('protectTarget', { target: caster, priority: 'highest' });
      target.addModifier('dmControlled', true);
    }
  },

  lust: {
    id: "lust",
    name: "Lust",
    tier: "Titan",
    description: "Will protect caster and obey their commands (DM control)",
    school: "enchantment",
    stackable: false,
    maxStacks: 1,
    onApply(target, caster) {
      target.addModifier('protectTarget', { target: caster, priority: 'highest' });
      target.addModifier('obeyCommands', { target: caster });
      target.addModifier('dmControlled', true);
    }
  },

  first_degree_burn: {
    id: "first_degree_burn",
    name: "1st Degree Burn",
    tier: "Lesser",
    description: "1d4 fire damage, resistance decreased by 1 tier",
    school: "fire",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      const baseDamage = this.rollDice("1d4");
      const finalDamage = calculateDamageWithResistance(baseDamage, target, "fire");
      target.takeDamage(finalDamage, "fire");
      target.addModifier('resistanceDecrease', 1);
    }
  },

  second_degree_burn: {
    id: "second_degree_burn",
    name: "2nd Degree Burn",
    tier: "Lesser",
    description: "2d4 fire damage, resistance decreased by 2 tiers",
    school: "fire",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      const baseDamage = this.rollDice("2d4");
      const finalDamage = calculateDamageWithResistance(baseDamage, target, "fire");
      target.takeDamage(finalDamage, "fire");
      target.addModifier('resistanceDecrease', 2);
    }
  },

  third_degree_burn: {
    id: "third_degree_burn",
    name: "3rd Degree Burn",
    tier: "Greater",
    description: "3d6 fire damage, resistance decreased by 3 tiers",
    school: "fire",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      const baseDamage = this.rollDice("3d6");
      const finalDamage = calculateDamageWithResistance(baseDamage, target, "fire");
      target.takeDamage(finalDamage, "fire");
      target.addModifier('resistanceDecrease', 3);
    }
  },

  fourth_degree_burn: {
    id: "fourth_degree_burn",
    name: "4th Degree Burn",
    tier: "Greater",
    description: "4d8 fire damage, resistance decreased by 4 tiers",
    school: "fire",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      const baseDamage = this.rollDice("4d8");
      const finalDamage = calculateDamageWithResistance(baseDamage, target, "fire");
      target.takeDamage(finalDamage, "fire");
      target.addModifier('resistanceDecrease', 4);
    }
  },

  wrath: {
    id: "wrath",
    name: "Wrath",
    tier: "Titan",
    description: "5d12 fire damage, resistance decreased by 5 tiers",
    school: "fire",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      const damage = this.rollDice("5d12");
      target.takeDamage(damage, "fire");
      target.addModifier('resistanceDecrease', 5);
    }
  },

  rot: {
    id: "rot",
    name: "Rot",
    tier: "Lesser",
    description: "2d4 necrotic damage on failed CON check, -2 on all rolls",
    school: "necrotic",
    difficultyClass: 13,
    savingThrow: "CON",
    onTick(target, stacks, caster) {
      const dc = 13;
      const result = target.makeSavingThrow("CON", dc);
      if (!result.success) {
        const damage = this.rollDice("2d4");
        target.takeDamage(damage, "necrotic");
      }
      target.addModifier('rollPenalty', -2);
    }
  },

  decay: {
    id: "decay",
    name: "Decay",
    tier: "Lesser",
    description: "2d6 necrotic damage on failed CON check, -3 on all rolls",
    school: "necrotic",
    difficultyClass: 15,
    savingThrow: "CON",
    onTick(target, stacks, caster) {
      const dc = 15;
      const result = target.makeSavingThrow("CON", dc);
      if (!result.success) {
        const baseDamage = this.rollDice("2d6");
        const finalDamage = calculateDamageWithResistance(baseDamage, target, "necrotic");
        target.takeDamage(finalDamage, "necrotic");
      }
      target.addModifier('rollPenalty', -3);
    }
  },

  withering: {
    id: "withering",
    name: "Withering",
    tier: "Greater",
    description: "2d8 necrotic damage on failed CON check, -5 on all rolls",
    school: "necrotic",
    difficultyClass: 17,
    savingThrow: "CON",
    onTick(target, stacks, caster) {
      const dc = 17;
      const result = target.makeSavingThrow("CON", dc);
      if (!result.success) {
        const baseDamage = this.rollDice("2d8");
        const finalDamage = calculateDamageWithResistance(baseDamage, target, "necrotic");
        target.takeDamage(finalDamage, "necrotic");
      }
      target.addModifier('rollPenalty', -5);
    }
  },

  consumed: {
    id: "consumed",
    name: "Consumed",
    tier: "Greater",
    description: "4d8 necrotic damage on failed CON check, -7 on all rolls",
    school: "necrotic",
    difficultyClass: 19,
    savingThrow: "CON",
    onTick(target, stacks, caster) {
      const dc = 19;
      const result = target.makeSavingThrow("CON", dc);
      if (!result.success) {
        const baseDamage = this.rollDice("4d8");
        const finalDamage = calculateDamageWithResistance(baseDamage, target, "necrotic");
        target.takeDamage(finalDamage, "necrotic");
      }
      target.addModifier('rollPenalty', -7);
    }
  },

  gluttony: {
    id: "gluttony",
    name: "Gluttony",
    tier: "Titan",
    description: "6d12 necrotic damage on failed CON check, -9 on all rolls",
    school: "necrotic",
    difficultyClass: 21,
    savingThrow: "CON",
    onTick(target, stacks, caster) {
      const dc = 21;
      const result = target.makeSavingThrow("CON", dc);
      if (!result.success) {
        const baseDamage = this.rollDice("6d12");
        const finalDamage = calculateDamageWithResistance(baseDamage, target, "necrotic");
        target.takeDamage(finalDamage, "necrotic");
      }
      target.addModifier('rollPenalty', -9);
    }
  },

  weak: {
    id: "weak",
    name: "Weak",
    tier: "Lesser",
    description: "Pain tolerance decreased by 5%",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      target.addModifier('painToleranceDecrease', 0.05);
    }
  },

  brittle: {
    id: "brittle",
    name: "Brittle",
    tier: "Lesser",
    description: "Pain tolerance -10%, return 1/4 damage to self",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      target.addModifier('painToleranceDecrease', 0.1);
      target.addModifier('returnDamageToSelf', 0.25);
    }
  },

  fragile: {
    id: "fragile",
    name: "Fragile",
    tier: "Greater",
    description: "Pain tolerance -20%, return 1/2 damage to self",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      target.addModifier('painToleranceDecrease', 0.2);
      target.addModifier('returnDamageToSelf', 0.5);
    }
  },

  cracked: {
    id: "cracked",
    name: "Cracked",
    tier: "Greater",
    description: "Pain tolerance -35%, return all damage to self",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      target.addModifier('painToleranceDecrease', 0.35);
      target.addModifier('returnDamageToSelf', 1.0);
    }
  },

  envy: {
    id: "envy",
    name: "Envy",
    tier: "Titan",
    description: "Pain tolerance -55%, return double damage to self",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      target.addModifier('painToleranceDecrease', 0.55);
      target.addModifier('returnDamageToSelf', 2.0);
    }
  },

  melancholy: {
    id: "melancholy",
    name: "Melancholy",
    tier: "Lesser",
    description: "Grants 1d4 bind per turn, INT checks trigger panic/despair/depravity",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    onTick(target, stacks, caster) {
      const bindStacks = this.rollDice("1d4");
      target.applyEffect('bind', bindStacks);
      
      const dc = 11;
      const result = target.makeAbilityCheck("INT", dc);
      if (!result.success) {
        target.applyEffect('panic', 1);
        target.applyEffect('despair', 1);
        target.applyEffect('depravity', 1);
      }
    }
  },

  gloom: {
    id: "gloom",
    name: "Gloom",
    tier: "Lesser",
    description: "Grants 2d4 bind per turn, INT checks trigger panic/despair/depravity",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    onTick(target, stacks, caster) {
      const bindStacks = this.rollDice("2d4");
      target.applyEffect('bind', bindStacks);
      
      const dc = 13;
      const result = target.makeAbilityCheck("INT", dc);
      if (!result.success) {
        target.applyEffect('panic', 1);
        target.applyEffect('despair', 1);
        target.applyEffect('depravity', 1);
      }
    }
  },

  sinking: {
    id: "sinking",
    name: "Sinking",
    tier: "Greater",
    description: "Grants 2d8 bind per turn, INT checks trigger panic/despair/depravity",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    onTick(target, stacks, caster) {
      const bindStacks = this.rollDice("2d8");
      target.applyEffect('bind', bindStacks);
      
      const dc = 15;
      const result = target.makeAbilityCheck("INT", dc);
      if (!result.success) {
        target.applyEffect('panic', 1);
        target.applyEffect('despair', 1);
        target.applyEffect('depravity', 1);
      }
    }
  },

  depression: {
    id: "depression",
    name: "Depression",
    tier: "Greater",
    description: "Grants 2d4 lockdown per turn, INT checks trigger panic/despair/depravity",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    onTick(target, stacks, caster) {
      const lockdownStacks = this.rollDice("2d4");
      target.applyEffect('lockdown', lockdownStacks);
      
      const dc = 17;
      const result = target.makeAbilityCheck("INT", dc);
      if (!result.success) {
        target.applyEffect('panic', 1);
        target.applyEffect('despair', 1);
        target.applyEffect('depravity', 1);
      }
    }
  },

  sloth: {
    id: "sloth",
    name: "Sloth",
    tier: "Titan",
    description: "Grants 4d8 lockdown per turn, INT checks trigger panic/despair/depravity",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    onTick(target, stacks, caster) {
      const lockdownStacks = this.rollDice("4d8");
      target.applyEffect('lockdown', lockdownStacks);
      
      const dc = 19;
      const result = target.makeAbilityCheck("INT", dc);
      if (!result.success) {
        target.applyEffect('panic', 1);
        target.applyEffect('despair', 1);
        target.applyEffect('depravity', 1);
      }
    }
  },

  panic: {
    id: "panic",
    name: "Panic",
    tier: "Lesser",
    description: "Disadvantage on INT checks, -10% pain tolerance, doubled peripheral vision, halved main vision",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      target.addModifier('disadvantageOnINT', true);
      target.addModifier('painToleranceDecrease', 0.1);
      target.addModifier('peripheralVisionMultiplier', 2);
      target.addModifier('mainVisionMultiplier', 0.5);
    }
  },

  despair: {
    id: "despair",
    name: "Despair",
    tier: "Lesser",
    description: "Disadvantage on all checks, -15% pain tolerance, tripled peripheral vision, no main vision",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      target.addModifier('disadvantage', true);
      target.addModifier('painToleranceDecrease', 0.15);
      target.addModifier('peripheralVisionMultiplier', 3);
      target.addModifier('mainVisionMultiplier', 0);
    }
  },

  depravity: {
    id: "depravity",
    name: "Depravity",
    tier: "Greater",
    description: "Disadvantage per stack, -5% pain tolerance per stack, 1d4 bind per stack, reduced peripheral vision per stack",
    school: "condition",
    stackable: true,
    maxStacks: 9,
    onApply(target, stacks) {
      target.addModifier('disadvantage', stacks);
      target.addModifier('painToleranceDecrease', 0.05 * stacks);
      target.addModifier('peripheralVisionDecrease', 1 * stacks);
    },
    onStackAdd(target, newStack) {
      const bindStacks = this.rollDice("1d4");
      target.applyEffect('bind', bindStacks);
    }
  },

  scorn: {
    id: "scorn",
    name: "Scorn",
    tier: "Lesser",
    description: "All spells cost 1.5x MP",
    school: "magic",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      target.addModifier('mpCostMultiplier', 1.5);
    }
  },

  disdained: {
    id: "disdained",
    name: "Disdained",
    tier: "Lesser",
    description: "All spells cost 2x MP and 1.5x STA",
    school: "magic",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      target.addModifier('mpCostMultiplier', 2);
      target.addModifier('staCostMultiplier', 1.5);
    }
  },

  judgement: {
    id: "judgement",
    name: "Judgement",
    tier: "Greater",
    description: "All spells cost 3x MP and 2x STA",
    school: "magic",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      target.addModifier('mpCostMultiplier', 3);
      target.addModifier('staCostMultiplier', 2);
    }
  },

  silenced: {
    id: "silenced",
    name: "Silenced",
    tier: "Greater",
    description: "All spells cost 5x MP and 3x STA",
    school: "magic",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      target.addModifier('mpCostMultiplier', 5);
      target.addModifier('staCostMultiplier', 3);
    }
  },

  pride: {
    id: "pride",
    name: "Pride",
    tier: "Titan",
    description: "Cannot cast spells",
    school: "magic",
    stackable: false,
    maxStacks: 1,
    onApply(target) {
      target.addModifier('cannotCastSpells', true);
    }
  }
};

module.exports = effects;
