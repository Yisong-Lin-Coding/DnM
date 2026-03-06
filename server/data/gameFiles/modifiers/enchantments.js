// Generated from enchantments.json.
// Edit this JS file directly; loader prefers .js over .json.
module.exports = [
  {
    name: "Rune of Poison - Base",
    id: "runeOfPoison-L0",
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
        "name": "Rune of Poison - Ancient Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.damageParts.push({ dice: '4d8', type: 'poison', source: 'Rune of Poison - Ancient' });
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
        "name": "Rune of Decay - Ancient Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.damageParts.push({ dice: '8d6', type: 'necrotic', source: 'Rune of Decay - Ancient' });
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
        "name": "Rune of the Glass - Ancient Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => 
          { context.attacker.takeDamage({
            damageParts: [
              {
                 dice: '1d12',
                 type: 'slashing', 
                 source: 'Rune of the Glass - Ancient' 
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
        "name": "Rune of Fire - Ancient Modifier",
        "hook": "onDamageCalc",
        "priority": 50,
        "action": (context) => { 
          context.damageParts.push(
            { dice: '4d8', type: 'fire', source: 'Rune of Fire - Ancient' });
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
            context.target.heal({ dice: 'd4', type: 'fire', source: 'Rune of Fire Absorption - Base' })
            context.target.addStatusEffect({id: 'empowered', duration: 5, stack: 1})
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
            context.target.heal({ dice: 'd6', type: 'fire', source: 'Rune of Fire Absorption - Empowered' })
            context.target.addStatusEffect({id: 'empowered', duration: 5, stack: 2})
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
            context.target.heal({ dice: 'd8', type: 'fire', source: 'Rune of Fire Absorption - Greater' })
            context.target.addStatusEffect({id: 'empowered', duration: 5, stack: 3})
          }
           }
      }
    ]
   },
   {
    "name": "Rune of Fire Absorption - Supreme",
    "id": "runeOfFireAbsorption-L3",
    "tier": 3,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Fire Absorption - Supreme Modifier",
        "hook": "onTakeDamage",
        "priority": 50,
        "action": (context) => { 
          if(context.damageParts.some(dp => dp.type === 'fire')) {
            context.target.heal({ dice: 'd12', type: 'fire', source: 'Rune of Fire Absorption - Supreme' })
            context.target.addStatusEffect({id: 'empowered', duration: 5, stack: 4})
          }
           }
      }
    ]
   },
   {
    "name": "Rune of Fire Absorption - Ultimate",
    "id": "runeOfFireAbsorption-L4",
    "tier": 3,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Fire Absorption - Ultimate Modifier",
        "hook": "onTakeDamage",
        "priority": 50,
        "action": (context) => { 
          if(context.damageParts.some(dp => dp.type === 'fire')) {
            context.target.heal({ dice: '2d10', type: 'fire', source: 'Rune of Fire Absorption - Ultimate' })
            context.target.addStatusEffect({id: 'empowered', duration: 5, stack: 5})
          }
           }
      }
    ]
   },
   {
    "name": "Rune of Fire Absorption - Ancient",
    "id": "runeOfFireAbsorption-L5",
    "tier": 3,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Fire Absorption - Ancient Modifier",
        "hook": "onTakeDamage",
        "priority": 50,
        "action": (context) => { 
          if(context.damageParts.some(dp => dp.type === 'fire')) {
            context.target.heal({ dice: '4d10', type: 'fire', source: 'Rune of Fire Absorption - Ancient' })
            context.target.addStatusEffect({id: 'empowered', duration: 5, stack: 6})
          }
           }
      }
    ]
    
  },
  {
    "name": "Rune of Scared Blaze - Base",
    "id": "runeOfScaredBlaze-L0",
    "tier": 3,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Scared Blaze - Base Modifier",
        "hook": "onAttack",
        "priority": 50,
        "action": (context) => {
          context.damageParts.push({ dice: '4d10', type: 'radiant', source: 'Rune of Scared Blaze - Base' });
          context.target.addStatusEffect({id: 'scorn', duration: 3})
        }
      }
    ]
  },
  {
    "name": "Rune of Scared Blaze - Empowered",
    "id": "runeOfScaredBlaze-L1",
    "tier": 3,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Scared Blaze - Empowered Modifier",
        "hook": "onAttack",
        "priority": 50,
        "action": (context) => {
          context.damageParts.push({ dice: '6d12', type: 'radiant', source: 'Rune of Scared Blaze - Empowered' });
          context.target.addStatusEffect({id: 'scorn', duration: 5})
        }
      }
    ]
  },
  {
    "name": "Rune of Scared Blaze - Greater",
    "id": "runeOfScaredBlaze-L2",
    "tier": 3,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Scared Blaze - Greater Modifier",
        "hook": "onAttack",
        "priority": 50,
        "action": (context) => {
          context.damageParts.push({ dice: '12d12', type: 'radiant', source: 'Rune of Scared Blaze - Greater' });
          context.target.addStatusEffect({id: 'distain', duration: 7})
        }
      }
    ]
  },
  {
    "name": "Rune of Scared Blaze - Supreme",
    "id": "runeOfScaredBlaze-L3",
    "tier": 3,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Scared Blaze - Supreme Modifier",
        "hook": "onAttack",
        "priority": 50,
        "action": (context) => {
          context.damageParts.push({ dice: '24d12', type: 'radiant', source: 'Rune of Scared Blaze - Supreme' });
          context.target.addStatusEffect({id: 'judgment', duration: 10})
        }
      }
    ]
  },
  {
    "name": "Rune of Scared Blaze - Ultimate",
    "id": "runeOfScaredBlaze-L4",
    "tier": 3,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Scared Blaze - Ultimate Modifier",
        "hook": "onAttack",
        "priority": 50,
        "action": (context) => {
          context.damageParts.push({ dice: '36d20', type: 'radiant', source: 'Rune of Scared Blaze - Ultimate' });
          context.target.addStatusEffect({id: 'silence', duration: 15})
        }
      }
    ]
  },
  {
    "name": "Rune of Scared Blaze - Ancient",
    "id": "runeOfScaredBlaze-L5",
    "tier": 3,
    "description": "",
    "modifiers": [
      {
        "name": "Rune of Scared Blaze - Ancient Modifier",
        "hook": "onAttack",
        "priority": 50,
        "action": (context) => {
          context.damageParts.push({ dice: '60d20', type: 'radiant', source: 'Rune of Scared Blaze - Ancient' });
          context.target.addStatusEffect({id: 'pride', duration: 20})
        }
      }
    ]
  },
  {
    "name":"Rune of Protection - Base",
    "id":"runeOfProtection-L0",
    "tier": 1,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Protection - Base Modifier",
        "hook":"onTakeDamage",
        "priority": 50,
        "action": (context) => {
          context.ar.magical += 1;
        }
      }
    ]
  },
  {
    "name":"Rune of Protection - Empowered",
    "id":"runeOfProtection-L1",
    "tier": 1,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Protection - Empowered Modifier",
        "hook":"onTakeDamage",
        "priority": 50,
        "action": (context) => {
          context.ar.magical += 2;
        }
      }
    ]
  },
  {
    "name":"Rune of Protection - Greater",
    "id":"runeOfProtection-L2",
    "tier": 1,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Protection - Greater Modifier",
        "hook":"onTakeDamage",
        "priority": 50,
        "action": (context) => {
          context.ar.magical += 3;
        }
      }
    ]
  },
  {
    "name":"Rune of Protection - Supreme",
    "id":"runeOfProtection-L3",
    "tier": 1,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Protection - Supreme Modifier",
        "hook":"onTakeDamage",
        "priority": 50,
        "action": (context) => {
          context.ar.magical += 4;
        }
      }
    ]
  },
  {
    "name":"Rune of Protection - Ultimate",
    "id":"runeOfProtection-L4",
    "tier": 1,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Protection - Ultimate Modifier",
        "hook":"onTakeDamage",
        "priority": 50,
        "action": (context) => {
          context.ar.magical += 5;
        }
      }
    ]
  },
  {
    "name":"Rune of Protection - Ancient",
    "id":"runeOfProtection-L5",
    "tier": 1,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Protection - Ancient Modifier",
        "hook":"onTakeDamage",
        "priority": 50,
        "action": (context) => {
          context.ar.magical += 6;
        }
      }
    ]
  },
  {
    "name":"Rune of Thorn - Base",
    "id":"runeOfThorn-L0",
    "tier": 2,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Thorn - Base Modifier",
        "hook":"onTakeDamage",
        "priority": 50,
        "action": (context) => {
          context.attacker.takeDamage({
            damageParts: [
              {
                 dice: 'd4',
                 type: 'force', 
                 source: 'Rune of Thorn - Base' 
                }],
            attacker:context.target
              });
        }
      }
    ]
  },
  {
    "name":"Rune of Thorn - Empowered",
    "id":"runeOfThorn-L1",
    "tier": 2,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Thorn - Empowered Modifier",
        "hook":"onTakeDamage",
        "priority": 50,
        "action": (context) => {
          context.attacker.takeDamage({
            damageParts: [
              {
                 dice: 'd8',
                 type: 'force', 
                 source: 'Rune of Thorn - Empowered' 
                }],
            attacker:context.target
              });
        }
      }
    ]
  },
  {
    "name":"Rune of Thorn - Greater",
    "id":"runeOfThorn-L2",
    "tier": 2,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Thorn - Greater Modifier",
        "hook":"onTakeDamage",
        "priority": 50,
        "action": (context) => {
          context.attacker.takeDamage({
            damageParts: [
              {
                 dice: 'd12',
                 type: 'force', 
                 source: 'Rune of Thorn - Greater' 
                }],
            attacker:context.target
              });
        }
      }
    ]
  },
  {
    "name":"Rune of Thorn - Supreme",
    "id":"runeOfThorn-L3",
    "tier": 2,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Thorn - Supreme Modifier",
        "hook":"onTakeDamage",
        "priority": 50,
        "action": (context) => {
          context.attacker.takeDamage({
            damageParts: [
              {
                 dice: '4d6',
                 type: 'force', 
                 source: 'Rune of Thorn - Supreme' 
                }],
            attacker:context.target
              });
        }
      }
    ]
  },
  {
    "name":"Rune of Thorn - Ultimate",
    "id":"runeOfThorn-L4",
    "tier": 2,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Thorn - Ultimate Modifier",
        "hook":"onTakeDamage",
        "priority": 50,
        "action": (context) => {
          context.attacker.takeDamage({
            damageParts: [
              {
                 dice: '4d10',
                 type: 'force', 
                 source: 'Rune of Thorn - Ultimate' 
                }],
            attacker:context.target
              });
        }
      }
    ]
  },
  {
    "name":"Rune of Thorn - Ancient",
    "id":"runeOfThorn-L5",
    "tier": 2,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Thorn - Ancient Modifier",
        "hook":"onTakeDamage",
        "priority": 50,
        "action": (context) => {
          context.attacker.takeDamage({
            damageParts: [
              { 
                  dice: '6d12',
                  type: 'force', 
                  source: 'Rune of Thorn - Ancient' 
                }],
            attacker:context.target
              });
        }
      }
     ]

  },
  {
    "name":"Rune of Sharpness - Base",
    "id":"runeOfSharpness-L0",
    "tier": 1,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Sharpness - Base Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.damageParts.push({ dice: 'd4', type: 'slashing', source: 'Rune of Sharpness - Base' });
          context.target.addStatusEffect({id: 'bleeding', duration: 3, stack: 1})
        }
      }
    ]

    
  },
  {
    "name":"Rune of Sharpness - Empowered",
    "id":"runeOfSharpness-L1",
    "tier": 1,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Sharpness - Empowered Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.damageParts.push({ dice: 'd8', type: 'slashing', source: 'Rune of Sharpness - Empowered' });
          context.target.addStatusEffect({id: 'bleeding', duration: 3, stack: 3})
        }
      }
    ]
  },
  {
    "name":"Rune of Sharpness - Greater",
    "id":"runeOfSharpness-L2",
    "tier": 1,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Sharpness - Greater Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.damageParts.push({ dice: 'd12', type: 'slashing', source: 'Rune of Sharpness - Greater' });
          context.target.addStatusEffect({id: 'bleeding', duration: 5, stack: 5})
        }
      }
    ]
  },
  {
    "name":"Rune of Sharpness - Supreme",
    "id":"runeOfSharpness-L3",
    "tier": 1,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Sharpness - Supreme Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.damageParts.push({ dice: 'd12', type: 'slashing', source: 'Rune of Sharpness - Supreme' });
          context.target.addStatusEffect({id: 'bleeding', duration: 7, stack: 7})
        }
      }
    ]
  },
  {
    "name":"Rune of Sharpness - Ultimate",
    "id":"runeOfSharpness-L4",
    "tier": 1,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Sharpness - Ultimate Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.damageParts.push({ dice: '4d6', type: 'slashing', source: 'Rune of Sharpness - Ultimate' });
          context.target.addStatusEffect({id: 'bleeding', duration: 10, stack: 10})
        }
      }
    ]
  },
  {
    "name":"Rune of Sharpness - Ancient",
    "id":"runeOfSharpness-L5",
    "tier": 1,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Sharpness - Ancient Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.damageParts.push({ dice: '6d6', type: 'slashing', source: 'Rune of Sharpness - Ancient' });
          context.target.addStatusEffect({id: 'bleeding', duration: 15, stack: 15})
        }
      }
     ]
  },
  {
    "name":"Rune of Power - Base",
    "id":"runeOfPower-L0",
    "tier": 2,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Power - Base Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.attacker.addStatusEffect({id: 'empowered', duration: 3, stack: 1})
        }
      }
     ]
   },
   {
    "name":"Rune of Power - Empowered",
    "id":"runeOfPower-L1",
    "tier": 2,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Power - Empowered Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.attacker.addStatusEffect({id: 'empowered', duration: 5, stack: 2})
        }
      }
     ]
   },
   {
    "name":"Rune of Power - Greater",
    "id":"runeOfPower-L2",
    "tier": 2,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Power - Greater Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.attacker.addStatusEffect({id: 'empowered', duration: 7, stack: 3})
        }
      }
     ]
  },
  {
    "name":"Rune of Power - Supreme",
    "id":"runeOfPower-L3",
    "tier": 2,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Power - Supreme Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.attacker.addStatusEffect({id: 'empowered', duration: 10, stack: 4})
        }
      }
     ]
  },
  {
    "name":"Rune of Power - Ultimate",
    "id":"runeOfPower-L4",
    "tier": 2,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Power - Ultimate Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.attacker.addStatusEffect({id: 'empowered', duration: 15, stack: 5})
        }
      }
     ]
  },
  {
    "name":"Rune of Power - Ancient",
    "id":"runeOfPower-L5",
    "tier": 2,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Power - Ancient Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.attacker.addStatusEffect({id: 'empowered', duration: 20, stack: 6})
        }
      }
     ]
   },
   {
    "name":"Rune of Vampirism - Base",
    "id":"runeOfVampirism-L0",
    "tier": 3,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Vampirism - Base Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.attacker.heal({
            healingParts: [
              { dice: '1d6', source: 'Rune of Vampirism - Base' }
            ],
            source: context.attacker
          }
        )
      }
    }
    ]      
   },
   {
    "name":"Rune of Vampirism - Empowered",
    "id":"runeOfVampirism-L1",
    "tier": 3,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Vampirism - Empowered Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.attacker.heal({
            healingParts: [
              { dice: '2d6', source: 'Rune of Vampirism - Empowered' }
            ],
            source: context.attacker
          }
        )
      }
      }
     ]
   },
   {
    "name":"Rune of Vampirism - Greater",
    "id":"runeOfVampirism-L2",
    "tier": 3,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Vampirism - Greater Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.attacker.heal({
            healingParts: [
              { dice: '3d6', source: 'Rune of Vampirism - Greater' }
            ],
            source: context.attacker
          }
        )
      }
     }
    ]
   },
   {
    "name":"Rune of Vampirism - Supreme",
    "id":"runeOfVampirism-L3",
    "tier": 3,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Vampirism - Supreme Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.attacker.heal({
            healingParts: [
              { dice: '4d6', source: 'Rune of Vampirism - Supreme' }
            ],
            source: context.attacker
          }
        )
      }
    }
      ]
   }, 
  {
    "name":"Rune of Vampirism - Ultimate",
    "id":"runeOfVampirism-L4",
    "tier": 3,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Vampirism - Ultimate Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.attacker.heal({
            healingParts: [
              { dice: '5d6', source: 'Rune of Vampirism - Ultimate' }
            ],
            source: context.attacker
          }
        )
      }
    }
      ]
  },
  {
    "name":"Rune of Vampirism - Ancient",
    "id":"runeOfVampirism-L5",
    "tier": 3,
    "description": "",
    "modifiers":[
      {
        "name":"Rune of Vampirism - Ancient Modifier",
        "hook":"onAttack",
        "priority": 50,
        "action": (context) => {
          context.attacker.heal({
            healingParts: [
              { dice: '6d6', source: 'Rune of Vampirism - Ancient' }
            ],
            source: context.attacker
          }
        )
      }
    }
      ]
    },
    {
      "name":"Rune of Quick Step - Base",
      "id":"runeOfQuickStep-L0",
      "tier": 1,
      "description": "",
      "modifiers":[
        {
          "name":"Rune of Quick Step - Base Modifier",
          "hook":"onMovementCalc",
          "priority": 50,
          "action": (context) => {
            context.finalSpeed += 5;

          }
        }
      ]
    }
  
            
]

