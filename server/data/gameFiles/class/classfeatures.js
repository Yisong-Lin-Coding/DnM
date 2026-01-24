// Barbarian Features
const rage001 = {
  id: "rage001",
  name: "Rage",
  level: 1,
  class: "Barbarian",
  description: "In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action.",
  
  onRageActivate(character, context) {
    // TODO: Implement rage activation logic
    return { success: true };
  }
};

const INTDisable001 = {
  id: "INTDisable001",
  name: "Intelligence Limitation",
  level: 1,
  class: "Barbarian",
  description: "While raging, you have disadvantage on Intelligence checks.",
  
  onRageActivate(character, context) {
    // TODO: Apply disadvantage to INT checks
    return { success: true };
  }
};

const BarbEmotion001 = {
  id: "BarbEmotion001",
  name: "Reckless Abandon",
  level: 1,
  class: "Barbarian",
  description: "While raging, you can't cast spells.",
  
  onRageEnd(character, context) {
    // TODO: Handle rage ending
    return { success: true };
  }
};

const madDash001 = {
  id: "madDash001",
  name: "Reckless Attack",
  level: 2,
  class: "Barbarian",
  description: "You can throw aside all concern for defense to attack with fierce desperation.",
  
  onRecklessAttack(character, context) {
    // TODO: Apply advantage on attack, disadvantage on defense
    return { success: true };
  }
};

const unarmoredDefense001 = {
  id: "unarmoredDefense001",
  name: "Unarmored Defense",
  level: 2,
  class: "Barbarian",
  description: "While unarmored, your AC equals 10 + DEX modifier + CON modifier.",
  
  calculateAC(character, context) {
    return 10 + character.stats.DEX + character.stats.CON;
  }
};

const muscleMemory001 = {
  id: "muscleMemory001",
  name: "Ability Score Improvement",
  level: 4,
  class: "Barbarian",
  description: "You can increase one ability score by 2, or two by 1.",
  
  onAbilityScoreImprovement(character, context) {
    // TODO: Handle ability score improvements
    return { success: true };
  }
};

const fastMovement001 = {
  id: "fastMovement001",
  name: "Extra Attack",
  level: 5,
  class: "Barbarian",
  description: "You can attack twice, instead of once, whenever you take the Attack action.",
  
  onExtraAttack(character, context) {
    // TODO: Allow extra attack
    return { success: true };
  }
};

const BarbAttack001 = {
  id: "BarbAttack001",
  name: "Mindless Rage",
  level: 6,
  class: "Barbarian",
  description: "You can't be charmed or frightened while raging.",
  
  onRageActivate(character, context) {
    // TODO: Apply charm/frighten immunity
    return { success: true };
  }
};

const dangerSense001 = {
  id: "dangerSense001",
  name: "Danger Sense",
  level: 7,
  class: "Barbarian",
  description: "You have advantage on DEX saves against visible effects.",
  
  onDexteritySave(character, context) {
    // TODO: Apply advantage on DEX saves
    return { success: true };
  }
};

const BarbMantel001 = {
  id: "BarbMantel001",
  name: "Ancestral Protectors",
  level: 7,
  class: "Barbarian",
  description: "When hit, you can use reaction to impose disadvantage on the attack roll.",
  
  onReaction(character, context) {
    // TODO: Implement reaction to impose disadvantage
    return { success: true };
  }
};

const battleInstinct001 = {
  id: "battleInstinct001",
  name: "Ability Score Improvement",
  level: 8,
  class: "Barbarian",
  description: "Increase ability scores.",
  
  onAbilityScoreImprovement(character, context) {
    return { success: true };
  }
};

const extraAttack001 = {
  id: "extraAttack001",
  name: "Relentless Rage",
  level: 8,
  class: "Barbarian",
  description: "Your rage can keep you fighting when you should be overwhelmed.",
  
  onHitPointsDrop(character, context) {
    // TODO: Implement CON save to stay conscious at 1 HP
    return { success: true };
  }
};

const tribalKnowledge001 = {
  id: "tribalKnowledge001",
  name: "Brutal Critical",
  level: 8,
  class: "Barbarian",
  description: "Roll additional weapon damage dice on hit.",
  
  onWeaponDamage(character, context) {
    // TODO: Add extra damage dice
    return { success: true };
  }
};

const feralInstinct001 = {
  id: "feralInstinct001",
  name: "Feral Instinct",
  level: 9,
  class: "Barbarian",
  description: "You have advantage on initiative rolls.",
  
  onInitiative(character, context) {
    return { success: true, advantage: true };
  }
};

const BarbEmotion002 = {
  id: "BarbEmotion002",
  name: "Relentless Rage",
  level: 10,
  class: "Barbarian",
  description: "Rage keeps you fighting when wounded.",
  
  onHitPointsDrop(character, context) {
    return { success: true };
  }
};

const fastMovement002 = {
  id: "fastMovement002",
  name: "Primal Champion",
  level: 10,
  class: "Barbarian",
  description: "Your speed increases by 10 feet while unarmored.",
  
  calculateMovement(character, context) {
    return character.movement + 10;
  }
};

const undyingFury001 = {
  id: "undyingFury001",
  name: "Undying Fury",
  level: 10,
  class: "Barbarian",
  description: "Stay conscious with 1 HP instead of dropping to 0.",
  
  onHitPointsDrop(character, context) {
    return { success: true, surviveWithOneHP: true };
  }
};

const BarbScream001 = {
  id: "BarbScream001",
  name: "Relentless Assault",
  level: 11,
  class: "Barbarian",
  description: "Make one additional melee weapon attack on your turn.",
  
  onAttackAction(character, context) {
    return { success: true };
  }
};

const BarbAttack002 = {
  id: "BarbAttack002",
  name: "Ability Score Improvement",
  level: 12,
  class: "Barbarian",
  description: "Increase ability scores.",
  
  onAbilityScoreImprovement(character, context) {
    return { success: true };
  }
};

const destructiveGlance001 = {
  id: "destructiveGlance001",
  name: "Destructive Glance",
  level: 12,
  class: "Barbarian",
  description: "Force creature to make STR save or be knocked prone.",
  
  onWeaponHit(character, context) {
    return { success: true };
  }
};

const BarbMantel002 = {
  id: "BarbMantel002",
  name: "Ancestral Shield",
  level: 12,
  class: "Barbarian",
  description: "Attacker takes psychic damage when Ancestral Protectors imposes disadvantage.",
  
  onReaction(character, context) {
    return { success: true };
  }
};

const rage002 = {
  id: "rage002",
  name: "Improved Rage",
  level: 12,
  class: "Barbarian",
  description: "Your damage bonus from raging increases.",
  
  onRageActivate(character, context) {
    return { success: true };
  }
};

const proteinShake = {
  id: "proteinShake",
  name: "Recovery Vitality",
  level: 12,
  class: "Barbarian",
  description: "Regain HP during short rests.",
  
  onShortRest(character, context) {
    return { success: true };
  }
};

const rageAura001 = {
  id: "rageAura001",
  name: "Rage Aura",
  level: 13,
  class: "Barbarian",
  description: "Allies within 10 feet have advantage on melee attacks while you rage.",
  
  onRageActivate(character, context) {
    return { success: true };
  }
};

const classFeatures = {
  rage001,
  INTDisable001,
  BarbEmotion001,
  madDash001,
  unarmoredDefense001,
  muscleMemory001,
  fastMovement001,
  BarbAttack001,
  dangerSense001,
  BarbMantel001,
  battleInstinct001,
  extraAttack001,
  tribalKnowledge001,
  feralInstinct001,
  BarbEmotion002,
  fastMovement002,
  undyingFury001,
  BarbScream001,
  BarbAttack002,
  destructiveGlance001,
  BarbMantel002,
  rage002,
  proteinShake,
  rageAura001
};

module.exports = classFeatures;