

// Effects use the Character modifier pipeline.
// Each effect's `modifiers` array contains { name, hook, priority, action(ctx) } objects.
// ctx always contains `character` (the affected character) plus hook-specific fields.
// ctx.effectStack is injected by getModifiersForHook with the current stack count.
//
// Hooks fired by Character.js:
//   onTurnStart      - start of turn (ctx: { character, movement, actionPoints })
//   onMovementCalc   - movement calculation (ctx: { base, finalSpeed, character })
//   onCheck          - all ability/saving throw checks (ctx: { character, checkType, baseValue, advantage, DC, roll })
//   onCheck_CON/INT/WIS/etc - specific stat check (same ctx as onCheck)
//   onPerceptionCalc - perception calculation (ctx: { base, value, character })
//   onAttackRoll     - attacker rolling to hit (ctx: { attacker, advantage, attackRoll, damageParts, flatBonus })
//   onDamageCalc     - after a hit, before damage is rolled (ctx: { attacker, target, damageParts, flatBonus })
//   onTakeDamage     - receiving damage (ctx: { target, attacker, damageParts, resistances, immunities, ar, finalDamage })
//   onDefenseCalc    - defense calculation (ctx: { character, ar, resistances, immunities })
//   onReaction       - reacting to an incoming attack (ctx: { character, attackContext, totalAR, blocked })
//   onVisionCalc     - vision calculation (ctx: { base: { distance, angle, radius }, character })

const rawEffects = {

  // ===========================================================================
  // CONDITIONS
  // ===========================================================================

  exhaustion: {
    id: "exhaustion",
    name: "Exhaustion",
    tier: "Lesser",
    description: "Progressive exhaustion. -2 to all rolls per stack. Lethal at 9 stacks.",
    school: "condition",
    stackable: true,
    maxStacks: 9,
    modifiers: [
      {
        name: "Exhaustion - Roll Penalty",
        hook: "onCheck",
        priority: 80,
        action: (ctx) => {
          ctx.baseValue -= 2 * (ctx.effectStack || 1);
        }
      },
      {
        name: "Exhaustion - Death at 9",
        hook: "onTurnStart",
        priority: 99,
        action: (ctx) => {
          if ((ctx.effectStack || 1) >= 9) {
            ctx.character.takeDamage({
              damageParts: [{ dice: '1d1', total: 99999, type: 'force', source: 'Exhaustion Death' }],
              flatBonus: [],
              attacker: null
            });
          }
        }
      }
    ]
  },

  bleed: {
    id: "bleed",
    name: "Bleed",
    tier: "Lesser",
    description: "1d4 physical damage per stack at turn start.",
    school: "condition",
    stackable: true,
    maxStacks: 99,
    modifiers: [
      {
        name: "Bleed - Tick Damage",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          const stacks = ctx.effectStack || 1;
          const total = ctx.character._rollDice({ dice: '1d4', advantage: 0 }) * stacks;
          ctx.character.takeDamage({
            damageParts: [{ dice: '1d4', type: 'physical', source: 'Bleed', total }],
            flatBonus: [],
            attacker: null
          });
        }
      }
    ]
  },

  frightened: {
    id: "frightened",
    name: "Frightened",
    tier: "Lesser",
    description: "Disadvantage on attacks, increased incoming damage.",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Frightened - Attack Disadvantage",
        hook: "onAttackRoll",
        priority: 80,
        action: (ctx) => { ctx.advantage -= 1; }
      },
      {
        name: "Frightened - Damage Vulnerability",
        hook: "onTakeDamage",
        priority: 80,
        action: (ctx) => {
          ctx.damageParts.forEach((part) => {
            if (part.total) part.total = Math.ceil(part.total * 1.1);
          });
        }
      }
    ]
  },

  bind: {
    id: "bind",
    name: "Bind",
    tier: "Lesser",
    description: "Decreases speed by 1 per stack.",
    school: "condition",
    stackable: true,
    maxStacks: 99,
    modifiers: [
      {
        name: "Bind - Speed Reduction",
        hook: "onMovementCalc",
        priority: 80,
        action: (ctx) => {
          ctx.finalSpeed = Math.max(0, ctx.finalSpeed - (ctx.effectStack || 1));
        }
      }
    ]
  },

  lockdown: {
    id: "lockdown",
    name: "Lockdown",
    tier: "Greater",
    description: "Decreases speed by 5 per stack.",
    school: "condition",
    stackable: true,
    maxStacks: 99,
    modifiers: [
      {
        name: "Lockdown - Speed Reduction",
        hook: "onMovementCalc",
        priority: 80,
        action: (ctx) => {
          ctx.finalSpeed = Math.max(0, ctx.finalSpeed - 5 * (ctx.effectStack || 1));
        }
      }
    ]
  },

  marked: {
    id: "marked",
    name: "Marked",
    tier: "Greater",
    description: "Various effects depending on opponent subclass. Modifiers injected at runtime.",
    school: "condition",
    stackable: true,
    maxStacks: 99,
    modifiers: [] // Subclass injects its own modifiers via addStatusEffect({ id: 'marked', modifiers: [...] })
  },

  speed_blitzed: {
    id: "speed_blitzed",
    name: "Speed Blitzed",
    tier: "Greater",
    description: "Target cannot react to fast movements — reduced effective AR on reaction.",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Speed Blitzed - Reaction Penalty",
        hook: "onReaction",
        priority: 80,
        action: (ctx) => { ctx.totalAR = Math.max(0, ctx.totalAR - 2); }
      }
    ]
  },

  // ===========================================================================
  // AFFLICTIONS — BLINDNESS
  // ===========================================================================

  lesser_blindness: {
    id: "lesser_blindness",
    name: "Lesser Blindness",
    tier: "Lesser",
    description: "Halves perception.",
    school: "affliction",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Lesser Blindness - Perception",
        hook: "onPerceptionCalc",
        priority: 80,
        action: (ctx) => { ctx.value = Math.floor(ctx.value * 0.5); }
      }
    ]
  },

  greater_blindness: {
    id: "greater_blindness",
    name: "Greater Blindness",
    tier: "Greater",
    description: "Halves perception and applies disadvantage per stack on all checks.",
    school: "affliction",
    stackable: true,
    maxStacks: 3,
    modifiers: [
      {
        name: "Greater Blindness - Perception",
        hook: "onPerceptionCalc",
        priority: 80,
        action: (ctx) => { ctx.value = Math.floor(ctx.value * 0.5); }
      },
      {
        name: "Greater Blindness - Check Disadvantage",
        hook: "onCheck",
        priority: 80,
        action: (ctx) => { ctx.advantage -= (ctx.effectStack || 1); }
      }
    ]
  },

  true_blindness: {
    id: "true_blindness",
    name: "True Blindness",
    tier: "Greater",
    description: "Perception set to zero, heavy disadvantage on all checks.",
    school: "affliction",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "True Blindness - Perception",
        hook: "onPerceptionCalc",
        priority: 80,
        action: (ctx) => { ctx.value = 0; }
      },
      {
        name: "True Blindness - Disadvantage",
        hook: "onCheck",
        priority: 80,
        action: (ctx) => { ctx.advantage -= 10; }
      }
    ]
  },

  // ===========================================================================
  // POISON
  // ===========================================================================

  weak_poison: {
    id: "weak_poison",
    name: "Weak Poison",
    tier: "Lesser",
    description: "1d4 poison damage each turn on failed CON DC 11 check.",
    school: "poison",
    difficultyClass: 11,
    savingThrow: "CON",
    modifiers: [
      {
        name: "Weak Poison - Tick",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          if (!ctx.character.check({ checkType: 'CON', DC: 11 }).success) {
            const total = ctx.character._rollDice({ dice: '1d4', advantage: 0 });
            ctx.character.takeDamage({
              damageParts: [{ dice: '1d4', type: 'poison', source: 'Weak Poison', total }],
              flatBonus: [], attacker: null
            });
          }
        }
      }
    ]
  },

  strong_poison: {
    id: "strong_poison",
    name: "Strong Poison",
    tier: "Lesser",
    description: "2d6 poison damage each turn on failed CON DC 13 check.",
    school: "poison",
    difficultyClass: 13,
    savingThrow: "CON",
    modifiers: [
      {
        name: "Strong Poison - Tick",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          if (!ctx.character.check({ checkType: 'CON', DC: 13 }).success) {
            const total = ctx.character._rollDice({ dice: '2d6', advantage: 0 });
            ctx.character.takeDamage({
              damageParts: [{ dice: '2d6', type: 'poison', source: 'Strong Poison', total }],
              flatBonus: [], attacker: null
            });
          }
        }
      }
    ]
  },

  advanced_poison: {
    id: "advanced_poison",
    name: "Advanced Poison",
    tier: "Lesser",
    description: "4d4 poison damage each turn on failed CON DC 15 check.",
    school: "poison",
    difficultyClass: 15,
    savingThrow: "CON",
    modifiers: [
      {
        name: "Advanced Poison - Tick",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          if (!ctx.character.check({ checkType: 'CON', DC: 15 }).success) {
            const total = ctx.character._rollDice({ dice: '4d4', advantage: 0 });
            ctx.character.takeDamage({
              damageParts: [{ dice: '4d4', type: 'poison', source: 'Advanced Poison', total }],
              flatBonus: [], attacker: null
            });
          }
        }
      }
    ]
  },

  lesser_draconic_poison: {
    id: "lesser_draconic_poison",
    name: "Lesser Draconic Poison",
    tier: "Greater",
    description: "4d8 poison damage each turn on failed CON DC 17 check.",
    school: "poison",
    difficultyClass: 17,
    savingThrow: "CON",
    modifiers: [
      {
        name: "Lesser Draconic Poison - Tick",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          if (!ctx.character.check({ checkType: 'CON', DC: 17 }).success) {
            const total = ctx.character._rollDice({ dice: '4d8', advantage: 0 });
            ctx.character.takeDamage({
              damageParts: [{ dice: '4d8', type: 'poison', source: 'Lesser Draconic Poison', total }],
              flatBonus: [], attacker: null
            });
          }
        }
      }
    ]
  },

  greater_draconic_poison: {
    id: "greater_draconic_poison",
    name: "Greater Draconic Poison",
    tier: "Greater",
    description: "4d12 poison damage each turn on failed CON DC 19 check.",
    school: "poison",
    difficultyClass: 19,
    savingThrow: "CON",
    modifiers: [
      {
        name: "Greater Draconic Poison - Tick",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          if (!ctx.character.check({ checkType: 'CON', DC: 19 }).success) {
            const total = ctx.character._rollDice({ dice: '4d12', advantage: 0 });
            ctx.character.takeDamage({
              damageParts: [{ dice: '4d12', type: 'poison', source: 'Greater Draconic Poison', total }],
              flatBonus: [], attacker: null
            });
          }
        }
      }
    ]
  },

  deaths_touch: {
    id: "deaths_touch",
    name: "Death's Touch",
    tier: "Titan",
    description: "6d20 poison damage each turn on failed CON DC 21 check.",
    school: "poison",
    difficultyClass: 21,
    savingThrow: "CON",
    modifiers: [
      {
        name: "Death's Touch - Tick",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          if (!ctx.character.check({ checkType: 'CON', DC: 21 }).success) {
            const total = ctx.character._rollDice({ dice: '6d20', advantage: 0 });
            ctx.character.takeDamage({
              damageParts: [{ dice: '6d20', type: 'poison', source: "Death's Touch", total }],
              flatBonus: [], attacker: null
            });
          }
        }
      }
    ]
  },

  wyvern_poison: {
    id: "wyvern_poison",
    name: "Wyvern Poison",
    tier: "Greater",
    description: "5d10 poison damage each turn on failed CON DC 20 check. At 3+ stacks: paralysis.",
    school: "poison",
    difficultyClass: 20,
    savingThrow: "CON",
    stackable: true,
    maxStacks: 5,
    modifiers: [
      {
        name: "Wyvern Poison - Tick",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          if (!ctx.character.check({ checkType: 'CON', DC: 20 }).success) {
            const total = ctx.character._rollDice({ dice: '5d10', advantage: 0 });
            ctx.character.takeDamage({
              damageParts: [{ dice: '5d10', type: 'poison', source: 'Wyvern Poison', total }],
              flatBonus: [], attacker: null
            });
          }
        }
      },
      {
        name: "Wyvern Poison - Paralysis",
        hook: "onMovementCalc",
        priority: 80,
        action: (ctx) => {
          if ((ctx.effectStack || 1) >= 3) ctx.finalSpeed = 0;
        }
      }
    ]
  },

  // ===========================================================================
  // FIRE
  // ===========================================================================

  burn: {
    id: "burn",
    name: "Burn",
    tier: "Lesser",
    description: "1d4 fire damage per stack at turn start.",
    school: "fire",
    stackable: true,
    maxStacks: 10,
    modifiers: [
      {
        name: "Burn - Tick Damage",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          const stacks = ctx.effectStack || 1;
          const total = ctx.character._rollDice({ dice: '1d4', advantage: 0 }) * stacks;
          ctx.character.takeDamage({
            damageParts: [{ dice: '1d4', type: 'fire', source: 'Burn', total }],
            flatBonus: [], attacker: null
          });
        }
      }
    ]
  },

  scorch: {
    id: "scorch",
    name: "Scorch",
    tier: "Greater",
    description: "2d6 fire damage per stack at turn start. Reduces fire resistance.",
    school: "fire",
    stackable: true,
    maxStacks: 5,
    modifiers: [
      {
        name: "Scorch - Tick Damage",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          const stacks = ctx.effectStack || 1;
          const total = ctx.character._rollDice({ dice: '2d6', advantage: 0 }) * stacks;
          ctx.character.takeDamage({
            damageParts: [{ dice: '2d6', type: 'fire', source: 'Scorch', total }],
            flatBonus: [], attacker: null
          });
        }
      },
      {
        name: "Scorch - Fire Vulnerability",
        hook: "onTakeDamage",
        priority: 80,
        action: (ctx) => {
          ctx.resistances.fire = (ctx.resistances.fire || 0) - (ctx.effectStack || 1);
        }
      }
    ]
  },

  // Burn effects — the initial hit damage is dealt by the enchantment.
  // These effects provide the lingering fire resistance decrease.

  first_degree_burn: {
    id: "first_degree_burn",
    name: "1st Degree Burn",
    tier: "Lesser",
    description: "Fire resistance decreased by 1 tier.",
    school: "fire",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "1st Degree Burn - Fire Vulnerability",
        hook: "onTakeDamage",
        priority: 80,
        action: (ctx) => { ctx.resistances.fire = (ctx.resistances.fire || 0) - 1; }
      }
    ]
  },

  second_degree_burn: {
    id: "second_degree_burn",
    name: "2nd Degree Burn",
    tier: "Lesser",
    description: "Fire resistance decreased by 2 tiers.",
    school: "fire",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "2nd Degree Burn - Fire Vulnerability",
        hook: "onTakeDamage",
        priority: 80,
        action: (ctx) => { ctx.resistances.fire = (ctx.resistances.fire || 0) - 2; }
      }
    ]
  },

  third_degree_burn: {
    id: "third_degree_burn",
    name: "3rd Degree Burn",
    tier: "Greater",
    description: "Fire resistance decreased by 3 tiers.",
    school: "fire",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "3rd Degree Burn - Fire Vulnerability",
        hook: "onTakeDamage",
        priority: 80,
        action: (ctx) => { ctx.resistances.fire = (ctx.resistances.fire || 0) - 3; }
      }
    ]
  },

  fourth_degree_burn: {
    id: "fourth_degree_burn",
    name: "4th Degree Burn",
    tier: "Greater",
    description: "Fire resistance decreased by 4 tiers.",
    school: "fire",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "4th Degree Burn - Fire Vulnerability",
        hook: "onTakeDamage",
        priority: 80,
        action: (ctx) => { ctx.resistances.fire = (ctx.resistances.fire || 0) - 4; }
      }
    ]
  },

  wrath: {
    id: "wrath",
    name: "Wrath",
    tier: "Titan",
    description: "Fire resistance decreased by 5 tiers.",
    school: "fire",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Wrath - Fire Vulnerability",
        hook: "onTakeDamage",
        priority: 80,
        action: (ctx) => { ctx.resistances.fire = (ctx.resistances.fire || 0) - 5; }
      }
    ]
  },

  // ===========================================================================
  // NECROTIC
  // ===========================================================================

  rot: {
    id: "rot",
    name: "Rot",
    tier: "Lesser",
    description: "2d4 necrotic damage each turn on failed CON DC 13. -2 to all rolls.",
    school: "necrotic",
    difficultyClass: 13,
    savingThrow: "CON",
    modifiers: [
      {
        name: "Rot - Tick Damage",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          if (!ctx.character.check({ checkType: 'CON', DC: 13 }).success) {
            const total = ctx.character._rollDice({ dice: '2d4', advantage: 0 });
            ctx.character.takeDamage({
              damageParts: [{ dice: '2d4', type: 'necrotic', source: 'Rot', total }],
              flatBonus: [], attacker: null
            });
          }
        }
      },
      {
        name: "Rot - Roll Penalty",
        hook: "onCheck",
        priority: 80,
        action: (ctx) => { ctx.baseValue -= 2; }
      }
    ]
  },

  decay: {
    id: "decay",
    name: "Decay",
    tier: "Lesser",
    description: "2d6 necrotic damage each turn on failed CON DC 15. -3 to all rolls.",
    school: "necrotic",
    difficultyClass: 15,
    savingThrow: "CON",
    modifiers: [
      {
        name: "Decay - Tick Damage",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          if (!ctx.character.check({ checkType: 'CON', DC: 15 }).success) {
            const total = ctx.character._rollDice({ dice: '2d6', advantage: 0 });
            ctx.character.takeDamage({
              damageParts: [{ dice: '2d6', type: 'necrotic', source: 'Decay', total }],
              flatBonus: [], attacker: null
            });
          }
        }
      },
      {
        name: "Decay - Roll Penalty",
        hook: "onCheck",
        priority: 80,
        action: (ctx) => { ctx.baseValue -= 3; }
      }
    ]
  },

  withering: {
    id: "withering",
    name: "Withering",
    tier: "Greater",
    description: "2d8 necrotic damage each turn on failed CON DC 17. -5 to all rolls.",
    school: "necrotic",
    difficultyClass: 17,
    savingThrow: "CON",
    modifiers: [
      {
        name: "Withering - Tick Damage",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          if (!ctx.character.check({ checkType: 'CON', DC: 17 }).success) {
            const total = ctx.character._rollDice({ dice: '2d8', advantage: 0 });
            ctx.character.takeDamage({
              damageParts: [{ dice: '2d8', type: 'necrotic', source: 'Withering', total }],
              flatBonus: [], attacker: null
            });
          }
        }
      },
      {
        name: "Withering - Roll Penalty",
        hook: "onCheck",
        priority: 80,
        action: (ctx) => { ctx.baseValue -= 5; }
      }
    ]
  },

  consumed: {
    id: "consumed",
    name: "Consumed",
    tier: "Greater",
    description: "4d8 necrotic damage each turn on failed CON DC 19. -7 to all rolls.",
    school: "necrotic",
    difficultyClass: 19,
    savingThrow: "CON",
    modifiers: [
      {
        name: "Consumed - Tick Damage",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          if (!ctx.character.check({ checkType: 'CON', DC: 19 }).success) {
            const total = ctx.character._rollDice({ dice: '4d8', advantage: 0 });
            ctx.character.takeDamage({
              damageParts: [{ dice: '4d8', type: 'necrotic', source: 'Consumed', total }],
              flatBonus: [], attacker: null
            });
          }
        }
      },
      {
        name: "Consumed - Roll Penalty",
        hook: "onCheck",
        priority: 80,
        action: (ctx) => { ctx.baseValue -= 7; }
      }
    ]
  },

  gluttony: {
    id: "gluttony",
    name: "Gluttony",
    tier: "Titan",
    description: "6d12 necrotic damage each turn on failed CON DC 21. -9 to all rolls.",
    school: "necrotic",
    difficultyClass: 21,
    savingThrow: "CON",
    modifiers: [
      {
        name: "Gluttony - Tick Damage",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          if (!ctx.character.check({ checkType: 'CON', DC: 21 }).success) {
            const total = ctx.character._rollDice({ dice: '6d12', advantage: 0 });
            ctx.character.takeDamage({
              damageParts: [{ dice: '6d12', type: 'necrotic', source: 'Gluttony', total }],
              flatBonus: [], attacker: null
            });
          }
        }
      },
      {
        name: "Gluttony - Roll Penalty",
        hook: "onCheck",
        priority: 80,
        action: (ctx) => { ctx.baseValue -= 9; }
      }
    ]
  },

  // ===========================================================================
  // FRAGILITY — take more damage; fractional return to attacker
  // ===========================================================================

  weak: {
    id: "weak",
    name: "Weak",
    tier: "Lesser",
    description: "Takes 5% more damage from all sources.",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Weak - Vulnerability",
        hook: "onTakeDamage",
        priority: 80,
        action: (ctx) => {
          ctx.damageParts.forEach((p) => { if (p.total) p.total = Math.ceil(p.total * 1.05); });
        }
      }
    ]
  },

  brittle: {
    id: "brittle",
    name: "Brittle",
    tier: "Lesser",
    description: "Takes 10% more damage. Attacker absorbs 25% of damage dealt.",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Brittle - Vulnerability",
        hook: "onTakeDamage",
        priority: 80,
        action: (ctx) => {
          const preTotals = ctx.damageParts.map((p) => p.total || 0);
          ctx.damageParts.forEach((p) => { if (p.total) p.total = Math.ceil(p.total * 1.1); });
          if (ctx.attacker) {
            const rebound = Math.floor(preTotals.reduce((s, v) => s + v, 0) * 0.25);
            if (rebound > 0) {
              ctx.attacker.takeDamage({
                damageParts: [{ dice: '1d1', type: 'force', source: 'Brittle Rebound', total: rebound }],
                flatBonus: [], attacker: null
              });
            }
          }
        }
      }
    ]
  },

  fragile: {
    id: "fragile",
    name: "Fragile",
    tier: "Greater",
    description: "Takes 20% more damage. Attacker absorbs 50% of damage dealt.",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Fragile - Vulnerability",
        hook: "onTakeDamage",
        priority: 80,
        action: (ctx) => {
          const preTotals = ctx.damageParts.map((p) => p.total || 0);
          ctx.damageParts.forEach((p) => { if (p.total) p.total = Math.ceil(p.total * 1.2); });
          if (ctx.attacker) {
            const rebound = Math.floor(preTotals.reduce((s, v) => s + v, 0) * 0.5);
            if (rebound > 0) {
              ctx.attacker.takeDamage({
                damageParts: [{ dice: '1d1', type: 'force', source: 'Fragile Rebound', total: rebound }],
                flatBonus: [], attacker: null
              });
            }
          }
        }
      }
    ]
  },

  cracked: {
    id: "cracked",
    name: "Cracked",
    tier: "Greater",
    description: "Takes 35% more damage. Attacker absorbs 100% of damage dealt.",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Cracked - Vulnerability",
        hook: "onTakeDamage",
        priority: 80,
        action: (ctx) => {
          const preTotals = ctx.damageParts.map((p) => p.total || 0);
          ctx.damageParts.forEach((p) => { if (p.total) p.total = Math.ceil(p.total * 1.35); });
          if (ctx.attacker) {
            const rebound = Math.floor(preTotals.reduce((s, v) => s + v, 0));
            if (rebound > 0) {
              ctx.attacker.takeDamage({
                damageParts: [{ dice: '1d1', type: 'force', source: 'Cracked Rebound', total: rebound }],
                flatBonus: [], attacker: null
              });
            }
          }
        }
      }
    ]
  },

  envy: {
    id: "envy",
    name: "Envy",
    tier: "Titan",
    description: "Takes 55% more damage. Attacker absorbs 200% of damage dealt.",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Envy - Vulnerability",
        hook: "onTakeDamage",
        priority: 80,
        action: (ctx) => {
          const preTotals = ctx.damageParts.map((p) => p.total || 0);
          ctx.damageParts.forEach((p) => { if (p.total) p.total = Math.ceil(p.total * 1.55); });
          if (ctx.attacker) {
            const rebound = Math.floor(preTotals.reduce((s, v) => s + v, 0) * 2);
            if (rebound > 0) {
              ctx.attacker.takeDamage({
                damageParts: [{ dice: '1d1', type: 'force', source: 'Envy Rebound', total: rebound }],
                flatBonus: [], attacker: null
              });
            }
          }
        }
      }
    ]
  },

  // ===========================================================================
  // SANITY / DESPAIR
  // ===========================================================================

  melancholy: {
    id: "melancholy",
    name: "Melancholy",
    tier: "Lesser",
    description: "Grants 1d4 bind per turn. Failed INT DC 11 also inflicts panic, despair, depravity.",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Melancholy - Tick",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          const bindAmount = ctx.character._rollDice({ dice: '1d4', advantage: 0 });
          ctx.character.addStatusEffect({ id: 'bind', stack: bindAmount });
          if (!ctx.character.check({ checkType: 'INT', DC: 11 }).success) {
            ctx.character.addStatusEffect('panic');
            ctx.character.addStatusEffect('despair');
            ctx.character.addStatusEffect('depravity');
          }
        }
      }
    ]
  },

  gloom: {
    id: "gloom",
    name: "Gloom",
    tier: "Lesser",
    description: "Grants 2d4 bind per turn. Failed INT DC 13 also inflicts panic, despair, depravity.",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Gloom - Tick",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          const bindAmount = ctx.character._rollDice({ dice: '2d4', advantage: 0 });
          ctx.character.addStatusEffect({ id: 'bind', stack: bindAmount });
          if (!ctx.character.check({ checkType: 'INT', DC: 13 }).success) {
            ctx.character.addStatusEffect('panic');
            ctx.character.addStatusEffect('despair');
            ctx.character.addStatusEffect('depravity');
          }
        }
      }
    ]
  },

  sinking: {
    id: "sinking",
    name: "Sinking",
    tier: "Greater",
    description: "Grants 2d8 bind per turn. Failed INT DC 15 also inflicts panic, despair, depravity.",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Sinking - Tick",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          const bindAmount = ctx.character._rollDice({ dice: '2d8', advantage: 0 });
          ctx.character.addStatusEffect({ id: 'bind', stack: bindAmount });
          if (!ctx.character.check({ checkType: 'INT', DC: 15 }).success) {
            ctx.character.addStatusEffect('panic');
            ctx.character.addStatusEffect('despair');
            ctx.character.addStatusEffect('depravity');
          }
        }
      }
    ]
  },

  depression: {
    id: "depression",
    name: "Depression",
    tier: "Greater",
    description: "Grants 2d4 lockdown per turn. Failed INT DC 17 also inflicts panic, despair, depravity.",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Depression - Tick",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          const lockAmount = ctx.character._rollDice({ dice: '2d4', advantage: 0 });
          ctx.character.addStatusEffect({ id: 'lockdown', stack: lockAmount });
          if (!ctx.character.check({ checkType: 'INT', DC: 17 }).success) {
            ctx.character.addStatusEffect('panic');
            ctx.character.addStatusEffect('despair');
            ctx.character.addStatusEffect('depravity');
          }
        }
      }
    ]
  },

  sloth: {
    id: "sloth",
    name: "Sloth",
    tier: "Titan",
    description: "Grants 4d8 lockdown per turn. Failed INT DC 19 also inflicts panic, despair, depravity.",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Sloth - Tick",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          const lockAmount = ctx.character._rollDice({ dice: '4d8', advantage: 0 });
          ctx.character.addStatusEffect({ id: 'lockdown', stack: lockAmount });
          if (!ctx.character.check({ checkType: 'INT', DC: 19 }).success) {
            ctx.character.addStatusEffect('panic');
            ctx.character.addStatusEffect('despair');
            ctx.character.addStatusEffect('depravity');
          }
        }
      }
    ]
  },

  panic: {
    id: "panic",
    name: "Panic",
    tier: "Lesser",
    description: "Disadvantage on INT checks. Reduced vision range.",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Panic - INT Disadvantage",
        hook: "onCheck_INT",
        priority: 80,
        action: (ctx) => { ctx.advantage -= 1; }
      },
      {
        name: "Panic - Vision Distortion",
        hook: "onVisionCalc",
        priority: 80,
        action: (ctx) => {
          ctx.base.distance = Math.floor(ctx.base.distance * 0.5);
        }
      }
    ]
  },

  despair: {
    id: "despair",
    name: "Despair",
    tier: "Lesser",
    description: "Disadvantage on all checks. Severely reduced vision.",
    school: "condition",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Despair - Disadvantage",
        hook: "onCheck",
        priority: 80,
        action: (ctx) => { ctx.advantage -= 1; }
      },
      {
        name: "Despair - Vision",
        hook: "onVisionCalc",
        priority: 80,
        action: (ctx) => { ctx.base.distance = 0; }
      }
    ]
  },

  depravity: {
    id: "depravity",
    name: "Depravity",
    tier: "Greater",
    description: "Disadvantage per stack on all checks. Adds bind stacks each turn.",
    school: "condition",
    stackable: true,
    maxStacks: 9,
    modifiers: [
      {
        name: "Depravity - Disadvantage",
        hook: "onCheck",
        priority: 80,
        action: (ctx) => { ctx.advantage -= (ctx.effectStack || 1); }
      },
      {
        name: "Depravity - Bind Tick",
        hook: "onTurnStart",
        priority: 80,
        action: (ctx) => {
          const bindAmount = ctx.character._rollDice({ dice: '1d4', advantage: 0 }) * (ctx.effectStack || 1);
          ctx.character.addStatusEffect({ id: 'bind', stack: bindAmount });
        }
      }
    ]
  },

  // ===========================================================================
  // ENCHANTMENT
  // ===========================================================================

  enchanted: {
    id: "enchanted",
    name: "Enchanted",
    tier: "Lesser",
    description: "Disadvantage on attacks (DC 11 WIS). Checks against the caster are harder.",
    school: "enchantment",
    difficultyClass: 11,
    savingThrow: "WIS",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Enchanted - Attack Penalty",
        hook: "onAttackRoll",
        priority: 80,
        action: (ctx) => { ctx.advantage -= 1; }
      }
    ]
  },

  mesmerized: {
    id: "mesmerized",
    name: "Mesmerized",
    tier: "Lesser",
    description: "Strong disadvantage on attacks (DC 15 WIS).",
    school: "enchantment",
    difficultyClass: 15,
    savingThrow: "WIS",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Mesmerized - Attack Penalty",
        hook: "onAttackRoll",
        priority: 80,
        action: (ctx) => { ctx.advantage -= 2; }
      }
    ]
  },

  charmed: {
    id: "charmed",
    name: "Charmed",
    tier: "Greater",
    description: "Cannot harm the caster — all attacks have extreme disadvantage.",
    school: "enchantment",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Charmed - Attack Block",
        hook: "onAttackRoll",
        priority: 80,
        action: (ctx) => { ctx.advantage -= 99; }
      }
    ]
  },

  enthralled: {
    id: "enthralled",
    name: "Enthralled",
    tier: "Greater",
    description: "Will protect caster with all power. Cannot attack under compulsion.",
    school: "enchantment",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Enthralled - Cannot Attack",
        hook: "onAttackRoll",
        priority: 80,
        action: (ctx) => { ctx.advantage -= 99; }
      }
    ]
  },

  lust: {
    id: "lust",
    name: "Lust",
    tier: "Titan",
    description: "Will protect and obey the caster. Full compulsion.",
    school: "enchantment",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Lust - Total Compulsion",
        hook: "onAttackRoll",
        priority: 80,
        action: (ctx) => { ctx.advantage -= 99; }
      }
    ]
  },

  // ===========================================================================
  // BUFF
  // ===========================================================================

  empowered: {
    id: "empowered",
    name: "Empowered",
    tier: "Lesser",
    description: "Adds 1d6 force damage per stack to attacks.",
    school: "buff",
    stackable: true,
    maxStacks: 5,
    modifiers: [
      {
        name: "Empowered - Bonus Damage",
        hook: "onDamageCalc",
        priority: 80,
        action: (ctx) => {
          const stacks = ctx.effectStack || 1;
          for (let i = 0; i < stacks; i++) {
            ctx.damageParts.push({ dice: '1d6', type: 'force', source: 'Empowered' });
          }
        }
      }
    ]
  },

  enhancePerception: {
    id: "enhancePerception",
    name: "Enhanced Perception",
    tier: "Greater",
    description: "Adds 2 to all perception checks per stack.",
    school: "buff",
    stackable: true,
    maxStacks: 99,
    modifiers: [
      {
        name: "Enhanced Perception - Bonus",
        hook: "onPerceptionCalc",
        priority: 80,
        action: (ctx) => { 
          const stack = ctx.effectStack || 1;
          const bonus = 2 * stack;
          const oldValue = ctx.value;
          ctx.value += bonus;
          console.log(`[EFFECT ACTION] Enhanced Perception: stack=${stack}, bonus=${bonus}, oldValue=${oldValue}, newValue=${ctx.value}`);
        }
      }
    ]
  },

  // ===========================================================================
  // MAGIC SUPPRESSION
  // Note: scorn/disdained/judgement/silenced/pride throttle spell costs.
  // A dedicated onMPCostCalc / onSTACostCalc hook is needed for full fidelity.
  // Until then these effects reduce the character's max MP/STA pool as a proxy
  // so the net effect is still fewer casts available.
  // ===========================================================================

  scorn: {
    id: "scorn",
    name: "Scorn",
    tier: "Lesser",
    description: "All spells cost 1.5x MP. (Requires onMPCostCalc hook for exact cost; currently reduces MP pool.)",
    school: "magic",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Scorn - MP Reduction",
        hook: "onMPCalc",
        priority: 80,
        action: (ctx) => { ctx.baseMax = Math.floor(ctx.baseMax / 1.5); }
      }
    ]
  },

  disdained: {
    id: "disdained",
    name: "Disdained",
    tier: "Lesser",
    description: "All spells cost 2x MP and 1.5x STA. (Proxy: reduces MP/STA pools.)",
    school: "magic",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Disdained - MP Reduction",
        hook: "onMPCalc",
        priority: 80,
        action: (ctx) => { ctx.baseMax = Math.floor(ctx.baseMax / 2); }
      },
      {
        name: "Disdained - STA Reduction",
        hook: "onSTACalc",
        priority: 80,
        action: (ctx) => { ctx.baseMax = Math.floor(ctx.baseMax / 1.5); }
      }
    ]
  },

  judgement: {
    id: "judgement",
    name: "Judgement",
    tier: "Greater",
    description: "All spells cost 3x MP and 2x STA. (Proxy: reduces MP/STA pools.)",
    school: "magic",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Judgement - MP Reduction",
        hook: "onMPCalc",
        priority: 80,
        action: (ctx) => { ctx.baseMax = Math.floor(ctx.baseMax / 3); }
      },
      {
        name: "Judgement - STA Reduction",
        hook: "onSTACalc",
        priority: 80,
        action: (ctx) => { ctx.baseMax = Math.floor(ctx.baseMax / 2); }
      }
    ]
  },

  silenced: {
    id: "silenced",
    name: "Silenced",
    tier: "Greater",
    description: "All spells cost 5x MP and 3x STA. (Proxy: reduces MP/STA pools.)",
    school: "magic",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Silenced - MP Reduction",
        hook: "onMPCalc",
        priority: 80,
        action: (ctx) => { ctx.baseMax = Math.floor(ctx.baseMax / 5); }
      },
      {
        name: "Silenced - STA Reduction",
        hook: "onSTACalc",
        priority: 80,
        action: (ctx) => { ctx.baseMax = Math.floor(ctx.baseMax / 3); }
      }
    ]
  },

  pride: {
    id: "pride",
    name: "Pride",
    tier: "Titan",
    description: "Cannot cast spells — MP pool reduced to zero.",
    school: "magic",
    stackable: false,
    maxStacks: 1,
    modifiers: [
      {
        name: "Pride - No MP",
        hook: "onMPCalc",
        priority: 80,
        action: (ctx) => { ctx.baseMax = 0; }
      }
    ]
  }
};

// Aliases for common naming variations and typos
// Maps alternate id → canonical id in rawEffects
const effectAliases = {
  // Poison variations
  'weak_poison': 'weak_poison',
  'weakPoison': 'weak_poison',
  'strong_poison': 'strong_poison',
  'strongPoison': 'strong_poison',
  'advanced_poison': 'advanced_poison',
  'advancedPoison': 'advanced_poison',
  'advance_poison': 'advanced_poison',  // old name
  'wyvern_poison': 'wyvern_poison',
  'wyvernPoison': 'wyvern_poison',
  
  // Bleed variations
  'bleeding': 'bleed',
  'bleed': 'bleed',
  
  // Judgment/Judgement spelling
  'judgment': 'judgement',
  'judgement': 'judgement',
  
  // Disdain/Disdained variations
  'distain': 'disdained',
  'disdain': 'disdained',
  'disdained': 'disdained',
  
  // Burn/fire variations
  'burning': 'burn',
  'burn': 'burn',
  'scorched': 'scorch',
  'scorch': 'scorch'
};

const normalizeEffect = (effect) => {
  const normalized = { ...effect };
  if (!normalized.name && normalized.id) {
    normalized.name = normalized.id;
  }
  if (normalized.isStackable === undefined) {
    normalized.isStackable = normalized.stackable !== false;
  }
  if (normalized.maxStack == null) {
    normalized.maxStack = normalized.maxStacks == null ? 1 : normalized.maxStacks;
  }
  if (normalized.stack == null) {
    normalized.stack = normalized.stacks == null ? 1 : normalized.stacks;
  }
  // Add aliases array for lookup
  normalized.aliases = Object.entries(effectAliases)
    .filter(([alias, target]) => target === normalized.id)
    .map(([alias]) => alias.toLowerCase());
  return normalized;
};

const effects = Object.values(rawEffects).map(normalizeEffect);

// Export both the array and the alias map for flexible lookups
effects.aliases = effectAliases;

module.exports = effects;
