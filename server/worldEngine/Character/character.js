const gameEvents = require('../../handlers/gameEventEmitter');

class CHARACTER {
    constructor(data) {

        this._baseStats = { ...data.stats };
        
  
        this.name = data.name;
        this.id = data.id;
        this.level = data.level || 1;
        this.classType = data.classType;
        this.subclassType = data.subclassType || null;
        this.race = data.race;
        this.subrace = data.subrace || null;
        this.background = data.background || null;
        

        this._baseHP = data.HP || { max: 0, current: 0, temp: 0 };
        this._baseMP = data.MP || { max: 0, current: 0, temp: 0 };
        this._baseSTA = data.STA || { max: 0, current: 0, temp: 0 };
        

        this.movement = data.movement || 30;
        this.position = data.position || { x: 0, y: 0, z: 0 };
        

        this.abilities = data.abilities || [];
        this.equipment = data.equipment || [];
        this.inventory = data.inventory || [];
        this.statusEffects = data.statusEffects || [];
        this.equippedItems = data.equippedItems || [];
        this.classFeatures = data.classFeatures || [];
        this.raceFeatures = data.raceFeatures || [];
        
        // Base modifiers (manually added, non-source modifiers)
        this._baseModifiers = data.modifiers || [];
        
        // Cache for performance
        this._cache = {};
        this._isDirty = true;
    }

    invalidateCache() {
        this._isDirty = true;
        this._cache = {};
    }

    /**
     * Get all modifiers from all sources for a specific hook
     * @param {string} hookName - The hook to filter by (e.g., 'onStatCalc_STR')
     * @returns {Array} Sorted array of modifiers
     */
    getModifiersForHook(hookName) {
        const allSources = [
            { modifiers: this._baseModifiers },
            ...this.inv.equipment ,
            ...this.effects,
            ...this.skills.passive,
            ...this.classType.classFeatures,
            ...this.race.traits,

        /** remember to add subclasses and also fix race.trait formating. Rn it's just a flat string, 
        * it needs to be an object with a modifiers array to work with this system
        *   Same with skills and passives
        *     as well as effects
        * all of these need to be formated in characterbuilder when we fetch the data, so that they can be properly processed here
        * everything needs to be formated as an object with a modifiers array, even if it's just a single modifier, to work with this system
        */
    ];

        return allSources
            .flatMap(source => source.modifiers || [])
            .filter(mod => mod.hook === hookName)
            .sort((a, b) => (a.priority || 100) - (b.priority || 100));
    }

    /**
     * Execute a modifier pipeline for a given hook
     * @param {string} hookName - The hook to execute
     * @param {object} context - The context object to pass through the pipeline
     * @returns {object} Modified context
     */
    applyModifierPipeline(hookName, context) {
        const modifiers = this.getModifiersForHook(hookName);
        
        modifiers.forEach(modifier => {
            try {
                if (typeof modifier.action === 'function') {
                    modifier.action(context);
                } else {
                    console.warn(`Modifier "${modifier.name}" has no executable action`);
                }
            } catch (error) {
                console.error(`Error executing modifier "${modifier.name}":`, error);
            }
        });

        return context;
    }

    /**
     * Calculate a single stat through the modifier pipeline
     * @param {string} statName - The stat to calculate (STR, DEX, etc.)
     * @returns {object} { score: number, modifier: number }
     */
    _calculateStat(statName) {
        const context = {
            stat: statName,
            value: (this._baseStats[statName])|| 10,
            character: this
        };

        if (this.race && this.race.abilityScoreModifiers) {
            const modValue = this.race.abilityScoreModifiers[statName];
            
            if (modValue) {
                context.value += modValue;
            }
        }

        if (this.subrace && this.subrace.abilityScoreModifiers) {
            const modValue = this.subrace.abilityScoreModifiers[statName];
            if (modValue) {
                context.value += modValue;
            }
        }

        if (this.classType && this.classType.baseStatModifier) {
            const modValue = this.classType.baseStatModifier[statName];
            if (modValue) {
                context.value += modValue;
            }
        }

        // Run through the pipeline
        this.applyModifierPipeline(`onStatCalc_${statName}`, context);

        return {
            score: Math.max(1, Math.min(30, context.value)), // Clamp between 1-30
            modifier: Math.floor((context.value - 10) / 2)
        };
    }

    /**
     * GETTER: Effective Stats (calculated on-the-fly)
     * Returns all stats with their scores and modifiers
     */
    get stats() {
        if (!this._isDirty && this._cache.stats) {
            return this._cache.stats;
        }

        const calculated = {};
        const statNames = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA', 'LUCK'];

        for (const statName of statNames) {
            calculated[statName] = this._calculateStat(statName);
        }

        this._cache.stats = calculated;
        return calculated;
    }

    /**
     * GETTER: Proficiency Bonus
     */
    get proficiencyBonus() {
        return Math.ceil(this.level / 4) + 1;
    }

    /**
     * GETTER: Armor Class (calculated through pipeline)
     */
    get AR() {
        if (!this._isDirty && this._cache.AR !== undefined) {
            return this._cache.AR;
        }

        const context = {
            baseAR:{},
            character: this,
            armor: this.equippedItems.find(item => item.type === 'armor'),
            shield: this.equippedItems.find(item => item.type === 'shield')
        };

        // Apply armor base AC if equipped
        if (context.armor && context.armor.AR) {
            
            for(const part of context.armor.AR) {
                context.baseAR[part] = context.armor.AR[part];
            }
            
            
        }


            if(context.shield && context.shield.AR) {
                for(const part of context.shield.AR) {
                    context.baseAR[part] = (context.baseAR[part] || 0) + context.shield.AR[part];
                }
            }

        // Run through modifier pipeline
        this.applyModifierPipeline('onARCalc', context);

        this._cache.AR = context.AR;
        return context.AR;
    }

    get initiative() {
        const context = {
            base: ((this.stats.DEX)-10)/2,
            character: this,
            roll:[{
                dice: '1d20',
                context: 'initiative roll'
            }]
        };

        this.applyModifierPipeline('onInitiativeCalc', context);

        for (const roll of context.roll) {
            context.base += this._rollDice(roll.dice);
        }

        return context.base;
    }

    /**
     * GETTER: Hit Points
     */
    get HP() {
        const context = {
            baseMax: this._baseHP.max,
            character: this,
            level: this.level,
            con: this.stats.CON,
            baseHPBonus: 0,
            classHPBonus: this.class.resourcePoolModifier.HP
        }

        this.applyModifierPipeline('onPreHPCalc', context);

        context.baseMax = context.con*(1+context.baseHPBonus+((context.level/2) * context.classHPBonus)); // Example HP scaling

        this.applyModifierPipeline('onHPCalc', context);

        return {
            max: context.baseMax,
            current: this._baseHP.current,
            temp: this._baseHP.temp
        };
    }

    /**
     * GETTER: Magic Points
     */
    get MP() {
        const context = {
            baseMax: this._baseMP.max,
            character: this,
            level: this.level,
            wis: this.stats.WIS.modifier,
            baseMPBonus: 0,
            classMPBonus: this.class.resourcePoolModifier.MP

        };

        this.applyModifierPipeline('onPreMPCalc', context);

        context.baseMax = context.wis*(1+context.baseMPBonus+((context.level/2) * context.classMPBonus)); // Example MP scaling

        this.applyModifierPipeline('onMPCalc', context);

        return {
            max: context.baseMax,
            current: this._baseMP.current,
            temp: this._baseMP.temp
        };
    }

    /**
     * GETTER: Stamina
     */
    get STA() {
        const context = {
            baseMax: this._baseSTA.max,
            character: this,
            level: this.level,
            con: this.stats.CON,
            baseSTABonus: 0,
            classSTABonus: this.class.resourcePoolModifier.STA
        };

        this.applyModifierPipeline('onPreSTACalc', context);

            context.baseMax = 2 * context.con * (1+context.baseSTABonus+((context.level/2) * context.classSTABonus)); // Example STA scaling

        this.applyModifierPipeline('onSTACalc', context);

        return {
            max: context.baseMax,
            current: this._baseSTA.current,
            temp: this._baseSTA.temp
        };
    }

    /**
     * Dice rolling utility
     */
_rollDice(context) {
    // 1. Parse the dice string
    const [countStr, sidesStr] = context.dice.toLowerCase().split('d');
    const count = Number(countStr) || 1;
    const sides = Number(sidesStr) || 20;
    let total = 0;

    for (let i = 0; i < count; i++) {
        let currentRolls = [];
        
        // 2. Determine how many dice to throw for this specific "count"
        // If advantage is 1, we roll 2 dice. If 0, we roll 1.
        const numToRoll = Math.abs(context.advantage || 0) + 1;

        for (let j = 0; j < numToRoll; j++) {
            currentRolls.push(Math.floor(Math.random() * sides) + 1);
        }

        // 3. Pick the result based on advantage/disadvantage/normal
        if (context.advantage > 0) {
            total += Math.max(...currentRolls);
        } else if (context.advantage < 0) {
            total += Math.min(...currentRolls);
        } else {
            total += currentRolls[0]; // Normal roll
        }
    }

    return total;
}

    /**
     * Main action handler
     */
    action(actionType, params) {
        switch (actionType) {
            case 'attack':
                this.attack(params);
                break;
            case 'cast':
                this.cast(params);
                break;
            case 'useItem':
                this.useItem(params);
                break;
        }
    }

    /**
     * Attack action with full pipeline support
     */


    check(params){
        
        const context = {
            character: this,
            checkType: params.checkType, // e.g., 'stealth', 'perception', etc.
            baseValue: 0,
            roll: [{
                dice: '1d20',
                context: 'check roll'
            }],
            advantage: 0,
            DC: params.DC || 10,
            success: false
        };

        



    }


    attack(params) {
        const context = {
            attacker: this,
            target: params.target,
            weapon: params.weapon || { name: 'Unarmed Strike', damage: '1d1', type: 'bludgeoning' },
            
            // Attack Roll
            attackRoll: [{
                dice: '1d20',
                context: 'attack roll',
            }],
            baseAC:0,
            AC:0,
            attackBonus: 0,
            advantage: 0,
            
            // Damage
            damageParts: [
                {
                    dice: params.weapon?.damage || '1d1',
                    type: params.weapon?.damageType || 'bludgeoning',
                    source: 'weapon'
                }
            ],
            flatBonus: [{

            }],
            damageAdvantage:0,
            
            isCrit: 0,
            hits: false
        };

        // Phase 1: Pre-Attack (modify attack roll)
        gameEvents.emitGameEvent('preAttack', { attacker: this.name, target: params.target.name });
        this.applyModifierPipeline('onAttackRoll', context);


            for (const roll of context.attackRoll) {
                // We call the helper and store the result in a new "roll" property
                const result = this._rollDice({dice:roll.dice, advantage: context.advantage});
                
                // This adds the 'roll' key to the object inside the array
                roll.roll = result.total; 
                
                // Optional: Store the raw dice if you want to check for Crits later
                roll.natural = result.allDiceThrown; 
            }

            if (context.attackRoll.find(r=>r.context === 'attack roll')?.roll === 20) {
                context.isCrit += 1;
            }

        this.applyModifierPipeline('onACCalc', context);

        for (const roll of context.attackRoll) {
            context.baseAC += roll.roll
        }

        context.AC = context.baseAC + context.attackBonus;

        context.hits = params.target.reaction({
            attackContext:context
        });

        if (context.hits) {
            // Phase 2: Damage Calculation
            this.applyModifierPipeline('onDamageCalc', context);

            for (const part of context.damageParts) {
                part.total = this._rollDice({dice:part.dice, advantage: context.damageAdvantage});
                for(let i = 0; i<context.isCrit; i++) {
                    part.total += this._rollDice({dice:part.dice, advantage: 99});
                }
            }

            params.target.takeDamage({
                damageParts: context.damageParts,
                flatBonus: context.flatBonus,
                attacker: this,
                isCrit: context.isCrit
            });

            gameEvents.emitGameEvent('attack', {
                attacker: this.name,
                target: params.target.name,
                damage: totalDamage,
                isCrit: context.isCrit
            });
        } else {
            gameEvents.emitGameEvent('attackMiss', {
                attacker: this.name,
                target: params.target.name
            });
        }

        return context;
    }

    /**
     * Take damage with full pipeline support
     */
    takeDamage(damageInfo) {
        const context = {
            target: this,
            attacker: damageInfo.attacker,
            damageParts: damageInfo.damageParts || [],
            flatBonus: damageInfo.flatBonus || [],
            finalDamage: damageInfo.damage,
            isCrit: damageInfo.isCrit || false,
            
            // Resistance tracking
            resistances: {},
            immunities: {},
            ar: this.AR
        };

        // Run defensive pipeline
        this.applyModifierPipeline('onTakeDamage', context);

        for (const part of context.damageParts) {
            if (context.immunities[part.type]) {
                part.total = 0;
            }
            else if (context.resistances[part.type]) {
                part.total = Math.floor(part.total * (0.95^context.resistances[part.type])); // Example: each resistance level reduces damage by 20%
            }

            if(context.ar[part.type]) {
                part.total = Math.max(0, part.total - context.ar[part.type]);
            }
            context.finalDamage += part.total;
        }

        for (const bonus of context.flatBonus) {

            if(context.immunities[bonus.type]) {
                bonus.value = 0;
            }
            else if (context.resistances[bonus.type]) {
                bonus.value = Math.floor(bonus.value * (0.95^context.resistances[bonus.type]));
            }
            if(context.ar[bonus.type]) {
                bonus.value = Math.max(0, bonus.value - context.ar[bonus.type]);
            }
            
            context.finalDamage += (bonus.value * (context?.isCrit || 1) * context.damageParts.length);
        }




        // Apply final damage
        const actualDamage = Math.max(1, Math.floor(context.finalDamage));
        
        // First apply to temp HP
        if (this._baseHP.temp > 0) {
            const tempDamage = Math.min(actualDamage, this._baseHP.temp);
            this._baseHP.temp -= tempDamage;
            const remaining = actualDamage - tempDamage;
            this._baseHP.current = Math.max(0, this._baseHP.current - remaining);
        } else {
            this._baseHP.current = Math.max(0, this._baseHP.current - actualDamage);
        }

        if (this._baseHP.current === 0) {
            gameEvents.emitGameEvent('characterDown', {
                target: this.name
            });
        }

        gameEvents.emitGameEvent('damageTaken', {
            target: this.name,
            damage: actualDamage,
            remaining: this._baseHP.current
        });

        return context;
    }

    /**
     * Add a status effect
     */
    addStatusEffect(effect) {
        this.effect.push(effect);
        this.invalidateCache();
        gameEvents.emitGameEvent('statusEffectAdded', {
            target: this.name,
            effect: effect.name
        });
    }

    /**
     * Remove a status effect
     */
    removeStatusEffect(effectName) {
        this.effect = this.effect.filter(e => e.name !== effectName);
        this.invalidateCache();
        gameEvents.emitGameEvent('statusEffectRemoved', {
            target: this.name,
            effect: effectName
        });
    }

    /**
     * Equip an item
     */
    equipItem(item) {
        this.inv.equipItem.push(item);
        this.invalidateCache();
    }

    /**
     * Unequip an item
     */
    unequipItem(itemName) {
        this.inv.equipItem = this.inv.equipItem.filter(i => i.name !== itemName);
        this.invalidateCache();
    }
}

module.exports = CHARACTER;