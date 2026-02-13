const gameEvents = require('../../handlers/gameEventEmitter');

class CHARACTER {
    constructor(data) {
        // Raw base data (never modified directly)
        this._baseStats = { ...data.stats };
        
        // Identity & Core Data
        this.name = data.name;
        this.id = data.id;
        this.level = data.level || 1;
        this.classType = data.classType;
        this.subclassType = data.subclassType || null;
        this.race = data.race;
        this.subrace = data.subrace || null;
        this.background = data.background || null;
        
        // Resources (use base values, getters will calculate max)
        this._baseHP = data.HP || { max: 0, current: 0, temp: 0 };
        this._baseMP = data.MP || { max: 0, current: 0, temp: 0 };
        this._baseSTA = data.STA || { max: 0, current: 0, temp: 0 };
        
        // Gameplay State
        this.movement = data.movement || 30;
        this.position = data.position || { x: 0, y: 0, z: 0 };
        
        // Collections (these hold references to full objects with modifiers)
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

    /**
     * Mark cache as dirty when something changes
     */
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
            ...this.equippedItems,
            ...this.statusEffects,
            ...this.abilities,
            ...this.classFeatures,
            ...this.raceFeatures,
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
            value: this._baseStats[statName] || 10,
            character: this
        };

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
    get AC() {
        if (!this._isDirty && this._cache.AC !== undefined) {
            return this._cache.AC;
        }

        const context = {
            baseAC: 10,
            dexMod: this.stats.DEX.modifier,
            character: this,
            armor: this.equippedItems.find(item => item.type === 'armor'),
            shield: this.equippedItems.find(item => item.type === 'shield')
        };

        // Apply armor base AC if equipped
        if (context.armor && context.armor.baseAC) {
            context.baseAC = context.armor.baseAC;
            
            // Some armor limits DEX bonus
            if (context.armor.maxDexBonus !== undefined) {
                context.dexMod = Math.min(context.dexMod, context.armor.maxDexBonus);
            }
        }

        // Shield adds to AC
        if (context.shield && context.shield.acBonus) {
            context.baseAC += context.shield.acBonus;
        }

        context.totalAC = context.baseAC + context.dexMod;

        // Run through modifier pipeline
        this.applyModifierPipeline('onACCalc', context);

        this._cache.AC = context.totalAC;
        return context.totalAC;
    }

    /**
     * GETTER: Initiative (calculated through pipeline)
     */
    get initiative() {
        const context = {
            base: this.stats.DEX.modifier,
            character: this
        };

        this.applyModifierPipeline('onInitiativeCalc', context);

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
            conMod: this.stats.CON.modifier
        };

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
            intMod: this.stats.INT.modifier
        };

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
            conMod: this.stats.CON.modifier
        };

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
    _rollDice(dice) {
        const [countStr, sidesStr] = dice.toLowerCase().split('d');
        const count = Number(countStr);
        const sides = Number(sidesStr);
        let total = 0;

        for (let i = 0; i < count; i++) {
            total += Math.floor(Math.random() * sides) + 1;
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
    attack(params) {
        const context = {
            attacker: this,
            target: params.target,
            weapon: params.weapon || { name: 'Unarmed Strike', damage: '1d1', type: 'bludgeoning' },
            
            // Attack Roll
            attackRoll: this._rollDice('1d20'),
            attackBonus: 0,
            advantage: false,
            disadvantage: false,
            
            // Damage
            damageParts: [
                {
                    dice: params.weapon?.damage || '1d1',
                    type: params.weapon?.damageType || 'bludgeoning',
                    source: 'weapon'
                }
            ],
            flatBonus: 0,
            
            isCrit: false,
            hits: false
        };

        // Phase 1: Pre-Attack (modify attack roll)
        gameEvents.emitGameEvent('preAttack', { attacker: this.name, target: params.target.name });
        this.applyModifierPipeline('onAttackRoll', context);

        // Determine hit
        const totalAttackRoll = context.attackRoll + context.attackBonus;
        context.hits = totalAttackRoll >= params.target.AC;
        context.isCrit = context.attackRoll === 20;

        if (context.hits) {
            // Phase 2: Damage Calculation
            this.applyModifierPipeline('onDamageCalc', context);

            // Roll damage
            let totalDamage = context.flatBonus;
            context.damageParts.forEach(part => {
                const roll = this._rollDice(part.dice);
                totalDamage += context.isCrit ? roll * 2 : roll;
            });

            context.totalDamage = totalDamage;

            // Apply damage to target
            params.target.takeDamage({
                damage: totalDamage,
                damageParts: context.damageParts,
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
            incomingDamage: damageInfo.damage,
            damageParts: damageInfo.damageParts || [],
            finalDamage: damageInfo.damage,
            isCrit: damageInfo.isCrit || false,
            
            // Resistance tracking
            resistances: {},
            immunities: {},
            vulnerabilities: {}
        };

        // Run defensive pipeline
        this.applyModifierPipeline('onReceiveDamage', context);

        // Apply final damage
        const actualDamage = Math.max(0, Math.floor(context.finalDamage));
        
        // First apply to temp HP
        if (this._baseHP.temp > 0) {
            const tempDamage = Math.min(actualDamage, this._baseHP.temp);
            this._baseHP.temp -= tempDamage;
            const remaining = actualDamage - tempDamage;
            this._baseHP.current = Math.max(0, this._baseHP.current - remaining);
        } else {
            this._baseHP.current = Math.max(0, this._baseHP.current - actualDamage);
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
        this.statusEffects.push(effect);
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
        this.statusEffects = this.statusEffects.filter(e => e.name !== effectName);
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
        this.equippedItems.push(item);
        this.invalidateCache();
    }

    /**
     * Unequip an item
     */
    unequipItem(itemName) {
        this.equippedItems = this.equippedItems.filter(i => i.name !== itemName);
        this.invalidateCache();
    }
}

module.exports = CHARACTER;