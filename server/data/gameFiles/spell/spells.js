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

// Game event emitter for all game-wide events
const gameEvents = require('../../../handlers/gameEventEmitter');

// Helper function to calculate final damage with resistance/vulnerability
const calculateDamageWithResistance = (baseDamage, target, damageType) => {
  const resistanceLevel = target.getResistanceLevel ? target.getResistanceLevel(damageType) : 'normal';
  const multiplier = DAMAGE_MULTIPLIERS[resistanceLevel] !== undefined ? DAMAGE_MULTIPLIERS[resistanceLevel] : 1.0;
  return Math.floor(baseDamage * multiplier);
};

const spellLevels = {
  "0": "Cantrip",
  "1": "Aurora",
  "2": "Ushas",
  "3": "Meson",
  "4": "Vesper",
  "5": "Umbra",
  "6": "Nyx",
  "7": "Uial",
  "8": "Malkth",
  "9": "Aleph Null"
};

const spells = {
  acid_splash: {
    id: "acid_splash",
    name: "Acid Splash",
    level: 0,
    levelName: "Cantrip",
    mp: 1,
    school: "evocation",
    castingTime: "action",
    range: "60 feet",
    duration: "instantaneous",
    components: ["verbal", "somatic"],
    description: "The target must succeed on a Dexterity saving throw or take 1d6 acid damage.",
    attributes: ["cantrip", "damage", "ranged"],
    onCast(caster, targets) {
      // Emit spell cast event
      gameEvents.emitSpellEvent('cast', {
        spellName: 'acid_splash',
        spellLevel: 0,
        school: 'evocation',
        caster: caster.name || caster.id,
        targetCount: targets.length
      });

      targets.forEach(target => {
        const dc = 12;
        const result = target.makeSavingThrow("DEX", dc);
        if (!result.success) {
          const baseDamage = this.rollDice("1d6");
          const finalDamage = calculateDamageWithResistance(baseDamage, target, "acid");
          
          // Emit damage event
          gameEvents.emitCombatEvent('damage', {
            source: caster.name || caster.id,
            target: target.name || target.id,
            damage: finalDamage,
            damageType: 'acid',
            sourceType: 'spell',
            spellName: 'acid_splash'
          });
          
          target.takeDamage(finalDamage, "acid");
        } else {
          // Emit resist/save event
          gameEvents.emit('spell:resist', {
            spellName: 'acid_splash',
            source: caster.name || caster.id,
            target: target.name || target.id,
            saveType: 'DEX',
            saveDC: dc
          });
        }
      });
    }
  },

  blade_ward: {
    id: "blade_ward",
    name: "Blade Ward",
    level: 0,
    levelName: "Cantrip",
    mp: 1,
    school: "abjuration",
    castingTime: "action",
    range: "self",
    duration: "5 minutes",
    components: ["verbal", "somatic"],
    concentration: true,
    description: "You gain resistance to bludgeoning, piercing, and slashing damage.",
    attributes: ["cantrip", "defense", "concentration"],
    onCast(caster) {
      caster.addModifier('resistance', {
        bludgeoning: true,
        piercing: true,
        slashing: true
      });
    }
  },

  fire_bolt: {
    id: "fire_bolt",
    name: "Fire Bolt",
    level: 0,
    levelName: "Cantrip",
    mp: 1,
    school: "evocation",
    castingTime: "action",
    range: "120 feet",
    duration: "instantaneous",
    components: ["verbal", "somatic"],
    description: "Make a ranged spell attack. On hit, the target takes 1d10 fire damage.",
    attributes: ["cantrip", "damage", "ranged", "attack"],
    onCast(caster, targets) {
      targets.forEach(target => {
        const attackRoll = this.rollDice("1d20");
        if (attackRoll + caster.getSpellAttackBonus() >= target.getAC()) {
          const baseDamage = this.rollDice("1d10");
          const finalDamage = calculateDamageWithResistance(baseDamage, target, "fire");
          target.takeDamage(finalDamage, "fire");
        }
      });
    }
  },

  light: {
    id: "light",
    name: "Light",
    level: 0,
    levelName: "Cantrip",
    mp: 1,
    school: "evocation",
    castingTime: "action",
    range: "touch",
    duration: "1 hour",
    components: ["verbal", "material"],
    materials: "a firefly or phosphorescent moss",
    description: "The object sheds bright light in a 20-foot radius and dim light for an additional 20 feet.",
    attributes: ["cantrip", "utility", "light"],
    onCast(caster, targets) {
      targets.forEach(target => {
        target.addModifier('light', {
          bright: 20,
          dim: 40,
          type: "magical"
        });
      });
    }
  },

  mage_hand: {
    id: "mage_hand",
    name: "Mage Hand",
    level: 0,
    levelName: "Cantrip",
    mp: 1,
    school: "transmutation",
    castingTime: "action",
    range: "30 feet",
    duration: "1 minute",
    components: ["verbal", "somatic"],
    concentration: true,
    description: "You create an invisible spectral hand that can manipulate objects.",
    attributes: ["cantrip", "utility", "concentration"],
    onCast(caster) {
      caster.summon('mage_hand', {
        type: 'spectral_hand',
        range: 30,
        duration: 60
      });
    }
  },

  prestidigitation: {
    id: "prestidigitation",
    name: "Prestidigitation",
    level: 0,
    levelName: "Cantrip",
    mp: 1,
    school: "transmutation",
    castingTime: "action",
    range: "10 feet",
    duration: "1 hour",
    components: ["verbal", "somatic"],
    description: "Create a minor magical effect such as lighting a candle or creating a flavor.",
    attributes: ["cantrip", "utility"],
    onCast(caster) {
      // Flexible spell - execute minor magical effect
      return {
        effects: ["light", "clean", "flavor", "color"],
        prompt: "Choose a minor magical effect"
      };
    }
  },

  shocking_grasp: {
    id: "shocking_grasp",
    name: "Shocking Grasp",
    level: 0,
    levelName: "Cantrip",
    mp: 1,
    school: "evocation",
    castingTime: "action",
    range: "touch",
    duration: "instantaneous",
    components: ["verbal", "somatic"],
    description: "Make a melee spell attack. On hit, the target takes 1d8 lightning damage and cannot take reactions until the start of its next turn.",
    attributes: ["cantrip", "damage", "melee", "attack"],
    onCast(caster, targets) {
      targets.forEach(target => {
        const attackRoll = this.rollDice("1d20");
        if (attackRoll + caster.getSpellAttackBonus() >= target.getAC()) {
          const damage = this.rollDice("1d8");
          target.takeDamage(damage, "lightning");
          target.addModifier('cannotReact', true);
        }
      });
    }
  },

  armor_of_agathys: {
    id: "armor_of_agathys",
    name: "Armor of Agathys",
    level: 1,
    levelName: "Aurora",
    mp: 13,
    school: "abjuration",
    castingTime: "action",
    range: "self",
    duration: "1 hour",
    components: ["verbal", "somatic", "material"],
    materials: "a cup of water",
    description: "You gain 5 temporary hit points. When a creature hits you with a melee attack, it takes 5 cold damage.",
    attributes: ["1st-level", "defense", "damage-reflection"],
    onCast(caster) {
      caster.grantTemporaryHP(5);
      caster.addModifier('returnDamage', {
        type: 'cold',
        amount: 5,
        trigger: 'melee_hit'
      });
    }
  },

  burning_hands: {
    id: "burning_hands",
    name: "Burning Hands",
    level: 1,
    levelName: "Aurora",
    mp: 19,
    school: "evocation",
    castingTime: "action",
    range: "self (15-foot cone)",
    duration: "instantaneous",
    components: ["verbal", "somatic"],
    description: "Each creature in a 15-foot cone must make a Dexterity saving throw, taking 3d6 fire damage on a failed save, or half as much on a successful one.",
    attributes: ["1st-level", "damage", "aoe", "evocation"],
    areaOfEffect: { shape: "cone", size: "15 feet" },
    onCast(caster, targets) {
      const dc = 12;
      targets.forEach(target => {
        const result = target.makeSavingThrow("DEX", dc);
        const baseDamage = this.rollDice("3d6");
        const halfDamage = result.success ? Math.floor(baseDamage / 2) : baseDamage;
        const finalDamage = calculateDamageWithResistance(halfDamage, target, "fire");
        target.takeDamage(finalDamage, "fire");
      });
    }
  },

  command: {
    id: "command",
    name: "Command",
    level: 1,
    levelName: "Aurora",
    mp: 18,
    school: "enchantment",
    castingTime: "action",
    range: "60 feet",
    duration: "1 round",
    components: ["verbal"],
    description: "You utter a one-word command to a creature you can see. The target must succeed on a Wisdom saving throw or follow your command.",
    savingThrow: "wisdom",
    attributes: ["1st-level", "enchantment", "control"],
    onCast(caster, targets, command) {
      const dc = 12;
      targets.forEach(target => {
        const result = target.makeSavingThrow("WIS", dc);
        if (!result.success) {
          target.addModifier('forced_command', command);
        }
      });
    }
  },

  cure_wounds: {
    id: "cure_wounds",
    name: "Cure Wounds",
    level: 1,
    levelName: "Aurora",
    mp: 15,
    school: "evocation",
    castingTime: "action",
    range: "touch",
    duration: "instantaneous",
    components: ["verbal", "somatic"],
    description: "A creature you touch regains 3d8 hit points.",
    attributes: ["1st-level", "healing", "touch"],
    onCast(caster, targets) {
      targets.forEach(target => {
        const healing = this.rollDice("3d8");
        target.heal(healing);
      });
    }
  },

  detect_magic: {
    id: "detect_magic",
    name: "Detect Magic",
    level: 1,
    levelName: "Aurora",
    mp: 13,
    school: "divination",
    castingTime: "action",
    range: "self (30-foot radius)",
    duration: "10 minutes",
    components: ["verbal", "somatic"],
    concentration: true,
    description: "You sense the presence of magic within 30 feet of you.",
    attributes: ["1st-level", "divination", "concentration", "ritual"],
    onCast(caster) {
      caster.activateAbility('detect_magic', {
        range: 30,
        duration: 600
      });
    }
  },

  fireball: {
    id: "fireball",
    name: "Fireball",
    level: 3,
    levelName: "Meson",
    mp: 45,
    school: "evocation",
    castingTime: "action",
    range: "150 feet",
    duration: "instantaneous",
    components: ["verbal", "somatic", "material"],
    materials: "a tiny ball of bat guano and sulfur",
    description: "Each creature in a 20-foot radius sphere must make a Dexterity saving throw or take 8d6 fire damage.",
    attributes: ["3rd-level", "evocation", "damage", "aoe"],
    areaOfEffect: { shape: "sphere", size: "20 feet" },
    onCast(caster, targetLocation) {
      const dc = 13;
      const targets = this.getTargetsInArea(targetLocation, 20, "sphere");
      targets.forEach(target => {
        const result = target.makeSavingThrow("DEX", dc);
        const baseDamage = this.rollDice("8d6");
        const halfDamage = result.success ? Math.floor(baseDamage / 2) : baseDamage;
        const finalDamage = calculateDamageWithResistance(halfDamage, target, "fire");
        target.takeDamage(finalDamage, "fire");
      });
    }
  },

  magic_missile: {
    id: "magic_missile",
    name: "Magic Missile",
    level: 1,
    levelName: "Aurora",
    mp: 11,
    school: "evocation",
    castingTime: "action",
    range: "120 feet",
    duration: "instantaneous",
    components: ["verbal", "somatic"],
    description: "You create three glowing darts. Each dart hits a creature you choose within range, dealing 1d4+1 force damage.",
    attributes: ["1st-level", "evocation", "damage", "ranged"],
    onCast(caster, targets) {
      const missileCount = 3;
      for (let i = 0; i < missileCount && i < targets.length; i++) {
        const damage = this.rollDice("1d4") + 1;
        targets[i].takeDamage(damage, "force");
      }
    }
  },

  shield: {
    id: "shield",
    name: "Shield",
    level: 1,
    levelName: "Aurora",
    mp: 11,
    school: "abjuration",
    castingTime: "reaction",
    range: "self",
    duration: "1 round",
    components: ["verbal", "somatic"],
    description: "You gain a +5 bonus to AC against one attack that would hit you.",
    attributes: ["1st-level", "abjuration", "defense", "reaction"],
    onCast(caster) {
      caster.addModifier('ac_bonus', 5);
    }
  },

  sleep: {
    id: "sleep",
    name: "Sleep",
    level: 1,
    levelName: "Aurora",
    mp: 17,
    school: "enchantment",
    castingTime: "action",
    range: "90 feet",
    duration: "5 minutes",
    components: ["verbal", "somatic", "material"],
    materials: "a pinch of fine sand, rose petals, or a cricket",
    description: "You roll 5d8; subtract the total from creatures' hit points in order, starting with the weakest.",
    savingThrow: "none",
    areaOfEffect: { shape: "sphere", size: "20 feet" },
    attributes: ["1st-level", "enchantment", "control", "aoe"],
    onCast(caster, targetLocation) {
      const sleepPool = this.rollDice("5d8");
      const targets = this.getTargetsInArea(targetLocation, 20, "sphere")
        .sort((a, b) => a.currentHP - b.currentHP);
      
      let remaining = sleepPool;
      targets.forEach(target => {
        if (remaining <= 0) return;
        if (target.currentHP <= remaining) {
          target.addModifier('sleep', true);
          remaining -= target.currentHP;
        }
      });
    }
  },

  thunderwave: {
    id: "thunderwave",
    name: "Thunderwave",
    level: 1,
    levelName: "Aurora",
    mp: 15,
    school: "evocation",
    castingTime: "action",
    range: "self (15-foot cube)",
    duration: "instantaneous",
    components: ["verbal", "somatic"],
    description: "Each creature in a 15-foot cube must make a Constitution saving throw or take 2d8 thunder damage and be pushed 5 feet away.",
    attributes: ["1st-level", "evocation", "damage", "aoe", "control"],
    areaOfEffect: { shape: "cube", size: "15 feet" },
    onCast(caster) {
      const dc = 12;
      const targets = this.getTargetsInArea(caster.position, 15, "cube");
      targets.forEach(target => {
        const result = target.makeSavingThrow("CON", dc);
        const damage = this.rollDice("2d8");
        const finalDamage = result.success ? Math.floor(damage / 2) : damage;
        target.takeDamage(finalDamage, "thunder");
        target.push(5);
      });
    }
  },

  lightning_bolt: {
    id: "lightning_bolt",
    name: "Lightning Bolt",
    level: 3,
    levelName: "Meson",
    mp: 31,
    school: "evocation",
    castingTime: "action",
    range: "self (100-foot line)",
    duration: "instantaneous",
    components: ["verbal", "somatic", "material"],
    materials: "a bit of fur and a rod of amber, crystal, or glass",
    description: "Each creature in a 100-foot line must make a Dexterity saving throw or take 8d6 lightning damage.",
    attributes: ["3rd-level", "evocation", "damage", "aoe"],
    areaOfEffect: { shape: "line", size: "100 feet" },
    onCast(caster, targetLocation) {
      const dc = 13;
      const targets = this.getTargetsInArea(targetLocation, 100, "line");
      targets.forEach(target => {
        const result = target.makeSavingThrow("DEX", dc);
        const baseDamage = this.rollDice("8d6");
        const halfDamage = result.success ? Math.floor(baseDamage / 2) : baseDamage;
        const finalDamage = calculateDamageWithResistance(halfDamage, target, "lightning");
        target.takeDamage(finalDamage, "lightning");
      });
    }
  },

  fly: {
    id: "fly",
    name: "Fly",
    level: 3,
    levelName: "Meson",
    mp: 63,
    school: "transmutation",
    castingTime: "action",
    range: "touch",
    duration: "10 minutes",
    components: ["verbal", "somatic", "material"],
    materials: "a feather from any bird",
    concentration: true,
    description: "A creature you touch gains a flying speed of 60 feet for the duration.",
    attributes: ["3rd-level", "transmutation", "utility", "movement", "concentration"],
    onCast(caster, targets) {
      targets.forEach(target => {
        target.grantFlyingSpeed(60, 600);
      });
    }
  },

  haste: {
    id: "haste",
    name: "Haste",
    level: 3,
    levelName: "Meson",
    mp: 46,
    school: "transmutation",
    castingTime: "action",
    range: "30 feet",
    duration: "1 minute",
    components: ["verbal", "somatic", "material"],
    materials: "a shaving of licorice root",
    concentration: true,
    description: "A creature you choose gains an extra action and movement for the duration.",
    attributes: ["3rd-level", "transmutation", "buff", "concentration"],
    onCast(caster, targets) {
      targets.forEach(target => {
        target.addModifier('extra_action', true);
        target.addModifier('double_movement', true);
      });
    }
  },

  slow: {
    id: "slow",
    name: "Slow",
    level: 3,
    levelName: "Meson",
    mp: 67,
    school: "transmutation",
    castingTime: "action",
    range: "120 feet",
    duration: "1 minute",
    components: ["verbal", "somatic", "material"],
    materials: "a drop of treacle",
    concentration: true,
    description: "A creature you can see must make a Wisdom saving throw or be slowed.",
    savingThrow: "wisdom",
    attributes: ["3rd-level", "transmutation", "debuff", "concentration"],
    onCast(caster, targets) {
      const dc = 13;
      targets.forEach(target => {
        const result = target.makeSavingThrow("WIS", dc);
        if (!result.success) {
          target.addModifier('slow', {
            disadvantage: true,
            movement_half: true
          });
        }
      });
    }
  },

  cone_of_cold: {
    id: "cone_of_cold",
    name: "Cone of Cold",
    level: 5,
    levelName: "Umbra",
    mp: 93,
    school: "evocation",
    castingTime: "action",
    range: "self (60-foot cone)",
    duration: "instantaneous",
    components: ["verbal", "somatic", "material"],
    materials: "a small crystal or glass cone",
    description: "Each creature in a 60-foot cone must make a Constitution saving throw or take 8d8 cold damage.",
    attributes: ["5th-level", "evocation", "damage", "aoe"],
    areaOfEffect: { shape: "cone", size: "60 feet" },
    onCast(caster) {
      const dc = 15;
      const targets = this.getTargetsInArea(caster.position, 60, "cone");
      targets.forEach(target => {
        const result = target.makeSavingThrow("CON", dc);
        const baseDamage = this.rollDice("8d8");
        const halfDamage = result.success ? Math.floor(baseDamage / 2) : baseDamage;
        const finalDamage = calculateDamageWithResistance(halfDamage, target, "cold");
        target.takeDamage(finalDamage, "cold");
      });
    }
  },

  wish: {
    id: "wish",
    name: "Wish",
    level: 9,
    levelName: "Aleph Null",
    mp: 1023,
    school: "conjuration",
    castingTime: "action",
    range: "self",
    duration: "instantaneous",
    components: ["verbal"],
    description: "You can alter reality. You can duplicate any spell of 8th level or lower, create objects, grant immunity, or make other profound changes.",
    attributes: ["9th-level", "conjuration", "powerful", "reality-warping"],
    onCast(caster, effect) {
      // The most powerful spell - can do almost anything
      return {
        effect: effect,
        prompt: "Describe what you wish to happen",
        validation: (caster.hasUltimateAuthority === true)
      };
    }
  },

  true_polymorph: {
    id: "true_polymorph",
    name: "True Polymorph",
    level: 9,
    levelName: "Aleph Null",
    mp: 1150,
    school: "transmutation",
    castingTime: "action",
    range: "30 feet",
    duration: "concentration, up to 1 hour",
    components: ["verbal", "somatic", "material"],
    materials: "a caterpillar cocoon",
    concentration: true,
    description: "Transform a creature into another creature, an object into another object, or a creature into an object permanently.",
    attributes: ["9th-level", "transmutation", "powerful", "concentration"],
    onCast(caster, targets, transformType) {
      targets.forEach(target => {
        target.transform(transformType);
      });
    }
  },

  time_stop: {
    id: "time_stop",
    name: "Time Stop",
    level: 9,
    levelName: "Aleph Null",
    mp: 1385,
    school: "transmutation",
    castingTime: "action",
    range: "self",
    duration: "instantaneous",
    components: ["verbal"],
    description: "You briefly stop the flow of time. For 1d4+1 turns, you can act freely while other creatures are frozen in time.",
    attributes: ["9th-level", "transmutation", "powerful"],
    onCast(caster) {
      const turns = this.rollDice("1d4") + 1;
      caster.addModifier('time_stop', {
        turns: turns,
        others_frozen: true
      });
    }
  },

  meteor_swarm: {
    id: "meteor_swarm",
    name: "Meteor Swarm",
    level: 9,
    levelName: "Aleph Null",
    mp: 1321,
    school: "evocation",
    castingTime: "action",
    range: "1 mile",
    duration: "instantaneous",
    components: ["verbal", "somatic"],
    description: "Meteor-like projectiles streak toward four points you choose within range. Creatures in 40-foot radius spheres must make Dexterity saves or take 20d6 fire and 20d6 bludgeoning damage.",
    attributes: ["9th-level", "evocation", "damage", "powerful"],
    onCast(caster, targetLocations) {
      const dc = 18;
      targetLocations.slice(0, 4).forEach(location => {
        const targets = this.getTargetsInArea(location, 40, "sphere");
        targets.forEach(target => {
          const result = target.makeSavingThrow("DEX", dc);
          const fireDamage = this.rollDice("20d6");
          const bludDamage = this.rollDice("20d6");
          const finalFire = result.success ? Math.floor(fireDamage / 2) : fireDamage;
          const finalBlud = result.success ? Math.floor(bludDamage / 2) : bludDamage;
          target.takeDamage(finalFire, "fire");
          target.takeDamage(finalBlud, "bludgeoning");
        });
      });
    }
  },

  disintegrate: {
    id: "disintegrate",
    name: "Disintegrate",
    level: 6,
    levelName: "Nyx",
    mp: 281,
    school: "evocation",
    castingTime: "action",
    range: "60 feet",
    duration: "instantaneous",
    components: ["verbal", "somatic", "material"],
    materials: "a lodestone and a pinch of powder iron",
    description: "A beam of green energy springs from your finger. The target must make a Dexterity saving throw or take 10d8 force damage. If it's reduced to 0 hp, it disintegrates.",
    attributes: ["6th-level", "evocation", "damage"],
    onCast(caster, targets) {
      const dc = 16;
      targets.forEach(target => {
        const result = target.makeSavingThrow("DEX", dc);
        const baseDamage = this.rollDice("10d8");
        const halfDamage = result.success ? Math.floor(baseDamage / 2) : baseDamage;
        const finalDamage = calculateDamageWithResistance(halfDamage, target, "force");
        target.takeDamage(finalDamage, "force");
        
        if (target.currentHP <= 0) {
          target.disintegrate();
        }
      });
    }
  }
};

module.exports = {
  spellLevels,
  spells
};
