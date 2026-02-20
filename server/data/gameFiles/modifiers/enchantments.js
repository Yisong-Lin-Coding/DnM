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
        "action": (context) => { 
          context.damageParts.push({ dice: 'd4', type: 'poison', source: 'Rune of Poison - Base' });
          if(context.target.check({ type: 'CON', dc: 11 })) {
            context.target.addStatusEffect({id: 'weakPoison', duration: 3, stack: 1})
          } }
      }
    ]
  },
  {
    "name": "Rune of Poison - Empowered",
    "id": "runeOfPoison-L1",
    "tier": 1,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Poison - Empowered Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push({ dice: 'd6', type: 'poison', source: 'Rune of Poison - Empowered' }); 
          if(context.target.check({ type: 'CON', dc: 13 })) {
            context.target.addStatusEffect({id: 'weakPoison', duration: 5, stack: 1})
          } }
      }
    ]
  },
  {
    "name": "Rune of Poison - Greater",
    "id": "runeOfPoison-L2",
    "tier": 1,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Poison - Greater Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.damageParts.push({ dice: 'd8', type: 'poison', source: 'Rune of Poison - Greater' });
          if(context.target.check({ type: 'CON', dc: 15 })) {
            context.target.addStatusEffect({id: 'strongPoison', duration: 3, stack: 1})
          }
        }
      }
    ]
  },
  {
    "name": "Rune of Poison - Supreme",
    "id": "runeOfPoison-L3",
    "tier": 1,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Poison - Supreme Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.damageParts.push({ dice: 'd12', type: 'poison', source: 'Rune of Poison - Supreme' });
          if(context.target.check({ type: 'CON', dc: 17 })) {
            context.target.addStatusEffect({id: 'advancedPoison', duration: 3, stack: 1})
          } }
      }
    ]
  },
  {
    "name": "Rune of Poison - Ultimate",
    "id": "runeOfPoison-L4",
    "tier": 1,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Poison - Ultimate Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.damageParts.push({ dice: '3d6', type: 'poison', source: 'Rune of Poison - Ultimate' });
          if(context.target.check({ type: 'CON', dc: 19 })) {
            context.target.addStatusEffect({id: 'advancedPoison', duration: 5, stack: 1})
          } }
      }
    ]
  },
  {
    "name": "Rune of Poison - Ancient",
    "id": "runeOfPoison-L5",
    "tier": 1,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Poison - Legendary Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.damageParts.push({ dice: '4d8', type: 'poison', source: 'Rune of Poison - Legendary' });
          if(context.target.check({ type: 'CON', dc: 21 })) {
            context.target.addStatusEffect({id: 'wyvernPoison', duration: 7, stack: 1})
          } }
      }
    ]
  },
  {
    "name": "Rune of Decay - Base",
    "id": "runeOfDecay-L0",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Decay - Base Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push({ dice: 'd4', type: 'necrotic', source: 'Rune of Decay - Base' });
          context.target.addStatusEffect({id: 'rot', duration: 3, stack: 1})
        }
      }
    ]
  },
  {
    "name": "Rune of Decay - Empowered",
    "id": "runeOfDecay-L1",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Decay - Empowered Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push({ dice: 'd8', type: 'necrotic', source: 'Rune of Decay - Empowered' }); 
          context.target.addStatusEffect({id: 'rot', duration: 5, stack: 1})
        }
      }
    ]
  },
  {
    "name": "Rune of Decay - Greater",
    "id": "runeOfDecay-L2",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Decay - Greater Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.damageParts.push({ dice: 'd12', type: 'necrotic', source: 'Rune of Decay - Greater' });
          context.target.addStatusEffect({id: 'decay', duration: 3, stack: 1})
        }
      }
    ]
  },
  {
    "name": "Rune of Decay - Supreme",
    "id": "runeOfDecay-L3",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Decay - Supreme Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.damageParts.push({ dice: '4d6', type: 'necrotic', source: 'Rune of Decay - Supreme' });
          context.target.addStatusEffect({id: 'decay', duration: 5, stack: 1})
        }
      }
    ]
  },
  {
    "name": "Rune of Decay - Ultimate",
    "id": "runeOfDecay-L4",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Decay - Ultimate Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.damageParts.push({ dice: '6d6', type: 'necrotic', source: 'Rune of Decay - Ultimate' });
          context.target.addStatusEffect({id: 'withering', duration: 7, stack: 1})
        }
      }
    ]
  },
  {
    "name": "Rune of Decay - Ancient",
    "id": "runeOfDecay-L5",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Decay - Legendary Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.damageParts.push({ dice: '8d6', type: 'necrotic', source: 'Rune of Decay - Legendary' });
          context.target.addStatusEffect({id: 'consumed', duration: 10, stack: 1})
        }
      }
    ]
  },
  {
    "name": "Rune of the Glass - Base",
    "id": "runeOfTheGlass-L0",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of the Glass - Base Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.attacker.takeDamage({
            damageParts: [
              {
                 dice: '6d6',
                 type: 'slashing', 
                 source: 'Rune of the Glass - Base' 
                }] 
              });
            context.target.addStatusEffect(
              {
                id: 'weak', 
                duration: 3, 
                stack: 1
              }) 
           }
      }
    ]
  },
  {
    "name": "Rune of the Glass - Empowered",
    "id": "runeOfTheGlass-L1",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of the Glass - Empowered Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.attacker.takeDamage({
            damageParts: [
              {
                 dice: '4d6',
                 type: 'slashing', 
                 source: 'Rune of the Glass - Empowered' 
                }] 
              });
            context.target.addStatusEffect(
              {
                id: 'weak', 
                duration: 5, 
                stack: 1
              }) 
           }
      }
    ]
  },
  {
    "name": "Rune of the Glass - Greater",
    "id": "runeOfTheGlass-L2",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of the Glass - Greater Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.attacker.takeDamage({
            damageParts: [
              {
                 dice: '4d4',
                 type: 'slashing', 
                 source: 'Rune of the Glass - Greater' 
                }] 
              });
            context.target.addStatusEffect(
              {
                id: 'brittle', 
                duration: 7, 
                stack: 1
              }) 
           }
      }
    ]
  },
  {
    "name": "Rune of the Glass - Supreme",
    "id": "runeOfTheGlass-L3",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of the Glass - Supreme Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.attacker.takeDamage({
            damageParts: [
              {
                 dice: 'd10',
                 type: 'slashing', 
                 source: 'Rune of the Glass - Supreme' 
                }] 
              });

 
            context.target.addStatusEffect(
              {
                id: 'brittle', 
                duration: 10, 
                stack: 1
              }) 
          } 
      }
    ]
  },
  {
    "name": "Rune of the Glass - Ultimate",
    "id": "runeOfTheGlass-L4",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of the Glass - Ultimate Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.attacker.takeDamage({
            damageParts: [
              {
                 dice: '1d8',
                 type: 'slashing', 
                 source: 'Rune of the Glass - Ultimate' 
                }] 
              });
            context.target.addStatusEffect(
              {
                id: 'fragile', 
                duration: 10, 
                stack: 1
              }) 
          }
      }
    ]
  },
  {
    "name": "Rune of the Glass - Ancient",
    "id": "runeOfTheGlass-L5",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of the Glass - Legendary Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.attacker.takeDamage({
            damageParts: [
              {
                 dice: '1d12',
                 type: 'slashing', 
                 source: 'Rune of the Glass - Legendary' 
                }] 
              });
            context.target.addStatusEffect(
              {
                id: 'cracked', 
                duration: 15, 
                stack: 1
              }) 
          }
      }
    ]
  },
  {
    "name": "Rune of Fire - Base",
    "id": "runeOfFire-L0",
    "tier": 1,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Fire - Base Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push(
            { dice: 'd4', type: 'fire', source: 'Rune of Fire - Base' });
           }
      }
    ]
  },
  {
    "name": "Rune of Fire - Empowered",
    "id": "runeOfFire-L1",
    "tier": 1,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Fire - Empowered Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push(
            { dice: 'd6', type: 'fire', source: 'Rune of Fire - Empowered' });
           }
      }
    ]
  },
  {
    "name": "Rune of Fire - Greater",
    "id": "runeOfFire-L2",
    "tier": 1,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Fire - Greater Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push(
            { dice: 'd8', type: 'fire', source: 'Rune of Fire - Greater' });
           }
      }
    ]
  },
  {
    "name": "Rune of Fire - Supreme",
    "id": "runeOfFire-L3",
    "tier": 1,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Fire - Supreme Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push(
            { dice: 'd12', type: 'fire', source: 'Rune of Fire - Supreme' });
           }
      }
    ]
   },
   {
    "name": "Rune of Fire - Ultimate",
    "id": "runeOfFire-L4",
    "tier": 1,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Fire - Ultimate Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push(
            { dice: '3d6', type: 'fire', source: 'Rune of Fire - Ultimate' });
           }
      }
    ]
  },
  {
    "name": "Rune of Fire - Ancient",
    "id": "runeOfFire-L5",
    "tier": 1,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Fire - Legendary Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push(
            { dice: '4d8', type: 'fire', source: 'Rune of Fire - Legendary' });
           }
      }
    ]
  },
  {
    "name": "Rune of Inferno - Base",
    "id": "runeOfInferno-L0",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Inferno - Base Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push(
            { dice: 'd4', type: 'fire', source: 'Rune of Inferno - Base' })
            
          context.target.addStatusEffect({id: 'burn', duration: 3, stack: 1})
           }
      }
    ]
   },
   {
    "name": "Rune of Inferno - Empowered",
    "id": "runeOfInferno-L1",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Inferno - Empowered Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push(
            { dice: 'd8', type: 'fire', source: 'Rune of Inferno - Empowered' })
            
          context.target.addStatusEffect({id: 'burn', duration: 5, stack: 2})
           }
      }
    ]
   },
   {
    "name": "Rune of Inferno - Greater",
    "id": "runeOfInferno-L2",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Inferno - Greater Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push(
            { dice: 'd12', type: 'fire', source: 'Rune of Inferno - Greater' })
            
          context.target.addStatusEffect({id: 'burn', duration: 5, stack: 3})
           }
      }
    ]
   },
   {
    "name": "Rune of Inferno - Supreme",
    "id": "runeOfInferno-L3",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Inferno - Supreme Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push(
            { dice: 'd12', type: 'fire', source: 'Rune of Inferno - Supreme' })
            
          context.target.addStatusEffect({id: 'burn', duration: 7, stack: 3})
           }
      }
    ]
  },
  {
    "name": "Rune of Inferno - Ultimate",
    "id": "runeOfInferno-L4",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Inferno - Ultimate Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push(
            { dice: '4d10', type: 'fire', source: 'Rune of Inferno - Ultimate' })
            
          context.target.addStatusEffect({id: 'scorch', duration:3, stack: 1})
           }
      }
    ]
  },
  {
    "name": "Rune of Inferno - Ancient",
    "id": "runeOfInferno-L5",
    "tier": 2,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Inferno - Ancient Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push(
            { dice: '6d12', type: 'fire', source: 'Rune of Inferno - Ancient' })
            
          context.target.addStatusEffect({id: 'scorch', duration: 5, stack: 2})
           }
      }
    ]
  },
  {
    "name": "Rune of Fire Absorption - Base",
    "id": "runeOfFireAbsorption-L0",
    "tier": 3,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Fire Absorption - Base Modifier",
        "hook": "onTakeDamage",
        "priority": 50,
        "action": (context) => { 
          if(context.damageParts.some(dp => dp.type === 'fire')) {
            context.attacker.heal({ dice: 'd4', type: 'fire', source: 'Rune of Fire Absorption - Base' })
          }
           }
      }
    ]
   },
   {
    "name": "Rune of Fire Absorption - Empowered",
    "id": "runeOfFireAbsorption-L1",
    "tier": 3,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Fire Absorption - Empowered Modifier",
        "hook": "onTakeDamage",
        "priority": 50,
        "action": (context) => { 
          if(context.damageParts.some(dp => dp.type === 'fire')) {
            context.attacker.heal({ dice: 'd6', type: 'fire', source: 'Rune of Fire Absorption - Empowered' })
          }
           }
      }
    ]
   },
   {
    "name": "Rune of Fire Absorption - Greater",
    "id": "runeOfFireAbsorption-L2",
    "tier": 3,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Fire Absorption - Greater Modifier",
        "hook": " onTakeDamage",  
        "priority": 50,
        "action": (context) => { 
          if(context.damageParts.some(dp => dp.type === 'fire')) {
            context.attacker.heal({ dice: 'd8', type: 'fire', source: 'Rune of Fire Absorption - Greater' })
          }
           }
      }
    ]
   },
   {
    
  }
];
