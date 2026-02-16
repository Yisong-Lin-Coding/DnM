// Generated from enchantments.json.
// Edit this JS file directly; loader prefers .js over .json.
module.exports = [
  {
    "name": "Rune of Poison - Base",
    "id": "runeOfPoison-L0",
    "tier": 1,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Poison - Base Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { context.damageParts.push({ dice: 'd4', type: 'poison', source: 'Rune of Poison - Base' });if(context.target) context.target.addStatusEffect({id: 'weakPoison', duration: 3, stack: 1}); }
      }
    ]
  },
  {
    "name": "Rune of Poison - Empowered",
    "id": "runeOfPoison-L1",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Poison - Empowered Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { context.damageParts.push({ dice: 'd6', type: 'poison', source: 'Rune of Poison - Empowered' }); context.target.addStatusEffect({id: 'weakPoison', duration: 3, stack: 1}); }
      }
    ]
  },
  {
    "name": "Rune of Poison - Greater",
    "id": "runeOfPoison-L2",
    "tier": 3,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Poison - Greater Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.damageParts.push({ dice: 'd8', type: 'poison', source: 'Rune of Poison - Greater' });
         context.target.addStatusEffect({id: 'weakPoison', duration: 3, stack: 1}); }
      }
    ]
  }
];
