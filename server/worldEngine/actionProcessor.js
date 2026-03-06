const DiceRoller = require('./diceRoller');

/**
 * Action Processing System - Handles action execution and results
 * 
 * This module processes player actions, calculates results using the
 * dice roller, and formats results for client consumption.
 */

class ActionProcessor {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
    }

    /**
     * Process an action and generate dice rolls + results
     * @param {string} characterId - ID of the character performing the action
     * @param {Object} actionData - Action data {type, target, options}
     * @returns {Object} - Action result with dice rolls
     */
    processAction(characterId, actionData) {
        const character = this.gameEngine.characters.get(characterId);
        if (!character) {
            throw new Error('Character not found');
        }

        const { type, target, options = {} } = actionData;

        // Route to appropriate action handler
        switch (type) {
            case 'attack':
                return this.processAttack(character, target, options);
            
            case 'cast':
                return this.processCast(character, target, options);
            
            case 'move':
                return this.processMove(character, target, options);
            
            case 'dodge':
                return this.processDodge(character);
            
            case 'dash':
                return this.processDash(character);
            
            case 'disengage':
                return this.processDisengage(character);
            
            case 'help':
                return this.processHelp(character, target);
            
            case 'hide':
                return this.processHide(character);
            
            case 'ready':
                return this.processReady(character, options);
            
            case 'use':
                return this.processUseItem(character, options);
            
            default:
                throw new Error(`Unknown action type: ${type}`);
        }
    }

    /**
     * Process an attack action
     */
    processAttack(attacker, target, options = {}) {
        const targetChar = this.gameEngine.characters.get(target.characterId);
        if (!targetChar) {
            throw new Error('Target not found');
        }

        const weapon = options.weapon || attacker.equipment?.mainHand || {
            name: 'Unarmed Strike',
            damage: '1d4',
            ability: 'STR',
            proficient: true
        };

        // Roll attack
        const attackRoll = DiceRoller.rollAttack(attacker, weapon);
        const targetAC = targetChar.stats?.AC || 10;

        // Determine hit/miss
        const isHit = attackRoll.isCriticalFail ? false : 
                     (attackRoll.isCritical ? true : attackRoll.total >= targetAC);

        let damageRoll = null;
        let damageDealt = 0;

        if (isHit) {
            // Roll damage
            damageRoll = DiceRoller.rollDamage(attacker, weapon, attackRoll.isCritical);
            damageDealt = damageRoll.total;

            // Apply damage to target
            targetChar.hp.current = Math.max(0, targetChar.hp.current - damageDealt);
            
            this.gameEngine.log(
                `${attacker.name} ${attackRoll.isCritical ? 'critically ' : ''}hits ${targetChar.name} for ${damageDealt} damage!`
            );
        } else {
            this.gameEngine.log(`${attacker.name} misses ${targetChar.name}!`);
        }

        // Check if target is defeated
        let defeated = false;
        if (targetChar.hp.current <= 0) {
            defeated = true;
            this.gameEngine.log(`${targetChar.name} has been defeated!`);
        }

        return {
            type: 'attack',
            success: isHit,
            attacker: {
                id: attacker.id,
                name: attacker.name
            },
            target: {
                id: targetChar.id,
                name: targetChar.name,
                ac: targetAC,
                hpBefore: targetChar.hp.current + damageDealt,
                hpAfter: targetChar.hp.current,
                defeated
            },
            rolls: [
                attackRoll,
                ...(damageRoll ? [damageRoll] : [])
            ],
            critical: attackRoll.isCritical,
            criticalFail: attackRoll.isCriticalFail,
            timestamp: Date.now()
        };
    }

    /**
     * Process a spell casting action
     */
    processCast(caster, target, options = {}) {
        const spell = options.spell;
        if (!spell) {
            throw new Error('No spell specified');
        }

        const rolls = [];
        
        // If spell requires an attack roll
        if (spell.attackRoll) {
            const spellAttack = {
                name: spell.name,
                ability: caster.spellcastingAbility || 'INT',
                proficient: true,
                magicBonus: 0
            };
            
            const attackRoll = DiceRoller.rollAttack(caster, spellAttack);
            rolls.push(attackRoll);
        }

        // If spell requires a saving throw
        if (spell.savingThrow) {
            const targetChar = this.gameEngine.characters.get(target.characterId);
            if (targetChar) {
                const saveDC = 8 + (caster.proficiencyBonus || 0) + 
                              DiceRoller.getAbilityModifier(caster, caster.spellcastingAbility || 'INT');
                
                const saveRoll = DiceRoller.rollSavingThrow(
                    targetChar,
                    spell.savingThrow,
                    saveDC
                );
                rolls.push(saveRoll);
            }
        }

        // Roll spell damage if applicable
        if (spell.damage) {
            const damageData = this.rollSpellDamage(caster, spell, options.spellLevel);
            rolls.push(damageData);
        }

        this.gameEngine.log(`${caster.name} casts ${spell.name}!`);

        return {
            type: 'cast',
            success: true,
            caster: {
                id: caster.id,
                name: caster.name
            },
            spell: {
                name: spell.name,
                level: options.spellLevel || spell.level
            },
            rolls,
            timestamp: Date.now()
        };
    }

    /**
     * Roll spell damage
     */
    rollSpellDamage(caster, spell, spellLevel) {
        // Parse damage notation
        const regex = /(\d+)d(\d+)/i;
        const match = spell.damage.match(regex);
        
        if (!match) {
            throw new Error(`Invalid damage notation: ${spell.damage}`);
        }

        let count = parseInt(match[1]);
        const sides = parseInt(match[2]);

        // Upcast damage (e.g., +1d6 per level above spell level)
        if (spellLevel > spell.level && spell.damageScaling) {
            const extraLevels = spellLevel - spell.level;
            count += extraLevels * (spell.damageScaling.dicePerLevel || 1);
        }

        const dice = DiceRoller.rollDice(count, sides);
        const diceTotal = dice.reduce((sum, die) => sum + die.value, 0);

        return {
            characterId: caster.id,
            characterName: caster.name,
            description: `${spell.name} Damage`,
            dice,
            bonuses: [],
            total: diceTotal,
            timestamp: Date.now(),
            damageType: spell.damageType || 'magical'
        };
    }

    /**
     * Process a move action
     */
    processMove(character, target, options = {}) {
        const { position, path } = target;
        
        // Validate movement
        const distance = this.calculateDistance(character.position, position);
        const movement = character.movement || 30;
        
        if (distance > movement) {
            throw new Error('Movement exceeds available range');
        }

        // Update position
        character.position = position;
        
        this.gameEngine.log(`${character.name} moves ${Math.round(distance)} feet`);

        return {
            type: 'move',
            success: true,
            character: {
                id: character.id,
                name: character.name
            },
            from: character.position,
            to: position,
            distance,
            rolls: [], // No dice rolls for basic movement
            timestamp: Date.now()
        };
    }

    /**
     * Process dodge action
     */
    processDodge(character) {
        // Apply dodge status effect
        character.statusEffects = character.statusEffects || [];
        character.statusEffects.push({
            name: 'Dodging',
            duration: 1, // Until next turn
            type: 'defensive'
        });

        this.gameEngine.log(`${character.name} takes the Dodge action`);

        return {
            type: 'dodge',
            success: true,
            character: {
                id: character.id,
                name: character.name
            },
            rolls: [],
            timestamp: Date.now()
        };
    }

    /**
     * Process dash action
     */
    processDash(character) {
        const baseMovement = character.movement || 30;
        character.movement = baseMovement * 2;

        this.gameEngine.log(`${character.name} uses Dash (movement: ${character.movement} feet)`);

        return {
            type: 'dash',
            success: true,
            character: {
                id: character.id,
                name: character.name
            },
            movement: character.movement,
            rolls: [],
            timestamp: Date.now()
        };
    }

    /**
     * Process disengage action
     */
    processDisengage(character) {
        character.statusEffects = character.statusEffects || [];
        character.statusEffects.push({
            name: 'Disengaging',
            duration: 1,
            type: 'movement'
        });

        this.gameEngine.log(`${character.name} disengages`);

        return {
            type: 'disengage',
            success: true,
            character: {
                id: character.id,
                name: character.name
            },
            rolls: [],
            timestamp: Date.now()
        };
    }

    /**
     * Process help action
     */
    processHelp(character, target) {
        const targetChar = this.gameEngine.characters.get(target.characterId);
        if (!targetChar) {
            throw new Error('Target not found');
        }

        // Grant advantage on next action
        targetChar.statusEffects = targetChar.statusEffects || [];
        targetChar.statusEffects.push({
            name: 'Helped',
            duration: 1,
            type: 'buff',
            source: character.id
        });

        this.gameEngine.log(`${character.name} helps ${targetChar.name}`);

        return {
            type: 'help',
            success: true,
            helper: {
                id: character.id,
                name: character.name
            },
            target: {
                id: targetChar.id,
                name: targetChar.name
            },
            rolls: [],
            timestamp: Date.now()
        };
    }

    /**
     * Process hide action
     */
    processHide(character) {
        // Roll stealth check
        const stealthRoll = DiceRoller.rollAbilityCheck(character, 'DEX', 'Stealth');

        this.gameEngine.log(`${character.name} attempts to hide (Stealth: ${stealthRoll.total})`);

        return {
            type: 'hide',
            success: true,
            character: {
                id: character.id,
                name: character.name
            },
            rolls: [stealthRoll],
            timestamp: Date.now()
        };
    }

    /**
     * Process ready action
     */
    processReady(character, options = {}) {
        character.readiedAction = {
            trigger: options.trigger || 'when enemy approaches',
            action: options.action
        };

        this.gameEngine.log(`${character.name} readies an action: ${options.trigger}`);

        return {
            type: 'ready',
            success: true,
            character: {
                id: character.id,
                name: character.name
            },
            trigger: options.trigger,
            rolls: [],
            timestamp: Date.now()
        };
    }

    /**
     * Process use item action
     */
    processUseItem(character, options = {}) {
        const item = options.item;
        if (!item) {
            throw new Error('No item specified');
        }

        this.gameEngine.log(`${character.name} uses ${item.name}`);

        // Item-specific effects would go here
        const rolls = [];

        // If item has dice rolls (e.g., healing potion)
        if (item.effect && item.effect.dice) {
            const notation = item.effect.dice;
            const rollResult = DiceRoller.rollNotation(notation);
            rolls.push({
                ...rollResult,
                characterId: character.id,
                characterName: character.name,
                description: `${item.name} Effect`
            });
        }

        return {
            type: 'use',
            success: true,
            character: {
                id: character.id,
                name: character.name
            },
            item: {
                name: item.name,
                type: item.type
            },
            rolls,
            timestamp: Date.now()
        };
    }

    /**
     * Calculate distance between two points
     */
    calculateDistance(pos1, pos2) {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

module.exports = ActionProcessor;
