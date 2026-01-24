// Class Features Database - Client-side version
// Displays feature descriptions and names during character creation

const classFeatures = {
  // BARBARIAN FEATURES
  
  // Level 1
  rage001: {
    id: "rage001",
    name: "Rage",
    level: 1,
    class: "Barbarian",
    description: "In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action. While raging, you gain advantage on Strength checks and Strength saving throws. When you make a melee weapon attack using Strength, you gain a bonus to the damage roll."
  },

  INTDisable001: {
    id: "INTDisable001",
    name: "Intelligence Limitation",
    level: 1,
    class: "Barbarian",
    description: "While raging, you have disadvantage on Intelligence checks."
  },

  BarbEmotion001: {
    id: "BarbEmotion001",
    name: "Reckless Abandon",
    level: 1,
    class: "Barbarian",
    description: "While raging, you can't cast spells. Your rage lasts for 1 minute and ends early if you are knocked prone, your turn ends without attacking, or you choose to end it."
  },

  // Level 2
  madDash001: {
    id: "madDash001",
    name: "Reckless Attack",
    level: 2,
    class: "Barbarian",
    description: "You can throw aside all concern for defense to attack with fierce desperation. When you make your first attack roll on your turn, you can decide to attack recklessly. This gives you advantage on melee weapon attack rolls using Strength, but attack rolls against you have advantage until your next turn."
  },

  unarmoredDefense001: {
    id: "unarmoredDefense001",
    name: "Unarmored Defense",
    level: 2,
    class: "Barbarian",
    description: "While you are not wearing any armor, your armor class equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit."
  },

  // Level 4
  muscleMemory001: {
    id: "muscleMemory001",
    name: "Ability Score Improvement",
    level: 4,
    class: "Barbarian",
    description: "You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. You can't increase an ability score above 20 using this feature."
  },

  // Level 5
  fastMovement001: {
    id: "fastMovement001",
    name: "Extra Attack",
    level: 5,
    class: "Barbarian",
    description: "You can attack twice, instead of once, whenever you take the Attack action on your turn."
  },

  // Level 6
  BarbAttack001: {
    id: "BarbAttack001",
    name: "Mindless Rage",
    level: 6,
    class: "Barbarian",
    description: "You can't be charmed or frightened while raging. If you are charmed or frightened when you enter your rage, the effect is suspended for the duration of the rage."
  },

  // Level 7
  dangerSense001: {
    id: "dangerSense001",
    name: "Danger Sense",
    level: 7,
    class: "Barbarian",
    description: "You gain an uncanny sense of when things nearby aren't as they should be. You have advantage on Dexterity saving throws against effects that you can see, such as traps and spells."
  },

  BarbMantel001: {
    id: "BarbMantel001",
    name: "Ancestral Protectors",
    level: 7,
    class: "Barbarian",
    description: "You can call on your ancestral spirits to protect you. When a creature within 5 feet of you hits you with an attack, you can use your reaction to impose disadvantage on that attack roll."
  },

  // Level 8
  battleInstinct001: {
    id: "battleInstinct001",
    name: "Ability Score Improvement",
    level: 8,
    class: "Barbarian",
    description: "You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1."
  },

  extraAttack001: {
    id: "extraAttack001",
    name: "Relentless Rage",
    level: 8,
    class: "Barbarian",
    description: "Your rage can keep you fighting even when you should be overwhelmed. If you drop to 0 hit points while raging and don't die outright, you can make a DC 10 Constitution saving throw. If you succeed, you drop to 1 hit point instead."
  },

  tribalKnowledge001: {
    id: "tribalKnowledge001",
    name: "Brutal Critical",
    level: 8,
    class: "Barbarian",
    description: "When you hit with a weapon attack, you can roll one additional weapon damage die and add it to the damage. You gain more additional dice as you level up."
  },

  // Level 9
  feralInstinct001: {
    id: "feralInstinct001",
    name: "Feral Instinct",
    level: 9,
    class: "Barbarian",
    description: "Your instincts are so honed that you have advantage on initiative rolls. If you are surprised at the start of combat and aren't incapacitated, you can act on your first turn if you enter your rage before doing anything else."
  },

  // Level 10
  BarbEmotion002: {
    id: "BarbEmotion002",
    name: "Relentless Rage",
    level: 10,
    class: "Barbarian",
    description: "Your rage keeps you fighting even when wounded. If you drop to 0 hit points while raging and don't die outright, you can make a DC 10 Constitution saving throw. If you succeed, you drop to 1 hit point instead."
  },

  fastMovement002: {
    id: "fastMovement002",
    name: "Primal Champion",
    level: 10,
    class: "Barbarian",
    description: "Your speed increases by 10 feet while you aren't wearing heavy armor."
  },

  undyingFury001: {
    id: "undyingFury001",
    name: "Undying Fury",
    level: 10,
    class: "Barbarian",
    description: "When you would normally drop to 0 hit points, you can use your reaction to stay conscious with 1 hit point instead. You can't use this feature again until you finish a long rest."
  },

  // Level 11
  BarbScream001: {
    id: "BarbScream001",
    name: "Relentless Assault",
    level: 11,
    class: "Barbarian",
    description: "When you take the Attack action on your turn, you can make one additional melee weapon attack as part of that action."
  },

  // Level 12
  BarbAttack002: {
    id: "BarbAttack002",
    name: "Ability Score Improvement",
    level: 12,
    class: "Barbarian",
    description: "You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1."
  },

  destructiveGlance001: {
    id: "destructiveGlance001",
    name: "Destructive Glance",
    level: 12,
    class: "Barbarian",
    description: "When you hit a creature with a weapon attack while raging, you can use a bonus action to force that creature to make a Strength saving throw or be knocked prone."
  },

  BarbMantel002: {
    id: "BarbMantel002",
    name: "Ancestral Shield",
    level: 12,
    class: "Barbarian",
    description: "When you use your Ancestral Protectors feature to impose disadvantage on an attack, the attacker takes psychic damage equal to your Wisdom modifier when the attack hits."
  },

  rage002: {
    id: "rage002",
    name: "Improved Rage",
    level: 12,
    class: "Barbarian",
    description: "Your damage reduction from raging increases. The bonus to melee weapon damage rolls increases as you level up."
  },

  proteinShake: {
    id: "proteinShake",
    name: "Recovery Vitality",
    level: 12,
    class: "Barbarian",
    description: "You can add protein shakes to your rations to regain hit points during short rests."
  },

  // Level 13
  rageAura001: {
    id: "rageAura001",
    name: "Rage Aura",
    level: 13,
    class: "Barbarian",
    description: "While you are raging, allies within 10 feet of you have advantage on melee weapon attack rolls."
  }
};

export default classFeatures;
