/**
 * Dice Rolling System - Server-side dice roller with pre-calculation
 * 
 * This module handles all dice rolling on the server side, ensuring
 * that results are predetermined before being sent to clients for
 * "reveal" animations.
 */

class DiceRoller {
    /**
     * Roll a single die
     * @param {number} sides - Number of sides on the die (e.g., 20 for d20)
     * @returns {number} - Random value between 1 and sides
     */
    static rollDie(sides) {
        return Math.floor(Math.random() * sides) + 1;
    }

    /**
     * Roll multiple dice
     * @param {number} count - Number of dice to roll
     * @param {number} sides - Number of sides on each die
     * @returns {Array<{type: string, value: number}>} - Array of dice results
     */
    static rollDice(count, sides) {
        const results = [];
        for (let i = 0; i < count; i++) {
            results.push({
                type: `d${sides}`,
                value: this.rollDie(sides)
            });
        }
        return results;
    }

    /**
     * Parse and roll a dice notation string (e.g., "2d6+3", "1d20")
     * @param {string} notation - Dice notation
     * @returns {Object} - Parsed roll results with bonuses
     */
    static rollNotation(notation) {
        const regex = /(\d+)d(\d+)([+-]\d+)?/i;
        const match = notation.match(regex);

        if (!match) {
            throw new Error(`Invalid dice notation: ${notation}`);
        }

        const count = parseInt(match[1]);
        const sides = parseInt(match[2]);
        const bonus = match[3] ? parseInt(match[3]) : 0;

        const dice = this.rollDice(count, sides);
        const diceTotal = dice.reduce((sum, die) => sum + die.value, 0);
        const total = diceTotal + bonus;

        return {
            notation,
            dice,
            bonuses: bonus !== 0 ? [{ name: 'Static Bonus', value: bonus }] : [],
            total
        };
    }

    /**
     * Roll for initiative with modifiers
     * @param {Object} character - Character object with stats
     * @returns {Object} - Initiative roll data
     */
    static rollInitiative(character) {
        const dice = this.rollDice(1, 20);
        const dexModifier = character.stats?.DEX?.modifier || 0;
        
        const bonuses = [];
        if (dexModifier !== 0) {
            bonuses.push({
                name: 'Dexterity Modifier',
                value: dexModifier
            });
        }

        // Check for other initiative bonuses (e.g., Alert feat, Jack of All Trades)
        if (character.features?.initiative) {
            bonuses.push(...character.features.initiative);
        }

        const diceTotal = dice.reduce((sum, die) => sum + die.value, 0);
        const bonusTotal = bonuses.reduce((sum, bonus) => sum + bonus.value, 0);
        const total = diceTotal + bonusTotal;

        return {
            characterId: character.id,
            characterName: character.name,
            description: 'Initiative Roll',
            dice,
            bonuses,
            total,
            timestamp: Date.now()
        };
    }

    /**
     * Roll for an attack with modifiers
     * @param {Object} attacker - Attacking character
     * @param {Object} weapon - Weapon or attack being used
     * @returns {Object} - Attack roll data
     */
    static rollAttack(attacker, weapon) {
        const dice = this.rollDice(1, 20);
        const bonuses = [];

        // Add ability modifier
        const abilityMod = this.getAbilityModifier(attacker, weapon.ability || 'STR');
        if (abilityMod !== 0) {
            bonuses.push({
                name: `${weapon.ability || 'STR'} Modifier`,
                value: abilityMod
            });
        }

        // Add proficiency bonus if proficient
        if (weapon.proficient) {
            const profBonus = attacker.proficiencyBonus || 0;
            if (profBonus !== 0) {
                bonuses.push({
                    name: 'Proficiency Bonus',
                    value: profBonus
                });
            }
        }

        // Add any magical bonuses
        if (weapon.magicBonus) {
            bonuses.push({
                name: 'Magic Bonus',
                value: weapon.magicBonus
            });
        }

        const diceTotal = dice.reduce((sum, die) => sum + die.value, 0);
        const bonusTotal = bonuses.reduce((sum, bonus) => sum + bonus.value, 0);
        const total = diceTotal + bonusTotal;

        return {
            characterId: attacker.id,
            characterName: attacker.name,
            description: `Attack Roll - ${weapon.name}`,
            dice,
            bonuses,
            total,
            timestamp: Date.now(),
            isCritical: dice[0].value === 20,
            isCriticalFail: dice[0].value === 1
        };
    }

    /**
     * Roll damage dice
     * @param {Object} attacker - Attacking character
     * @param {Object} weapon - Weapon or attack being used
     * @param {boolean} isCritical - Whether this is a critical hit
     * @returns {Object} - Damage roll data
     */
    static rollDamage(attacker, weapon, isCritical = false) {
        // Parse damage dice (e.g., "1d8", "2d6")
        const damageNotation = weapon.damage || '1d6';
        const regex = /(\d+)d(\d+)/i;
        const match = damageNotation.match(regex);

        if (!match) {
            throw new Error(`Invalid damage notation: ${damageNotation}`);
        }

        let count = parseInt(match[1]);
        const sides = parseInt(match[2]);

        // Double dice on critical hit
        if (isCritical) {
            count *= 2;
        }

        const dice = this.rollDice(count, sides);
        const bonuses = [];

        // Add ability modifier to damage (only once, not doubled on crit)
        const abilityMod = this.getAbilityModifier(attacker, weapon.ability || 'STR');
        if (abilityMod !== 0) {
            bonuses.push({
                name: `${weapon.ability || 'STR'} Modifier`,
                value: abilityMod
            });
        }

        // Add any magical bonuses
        if (weapon.magicBonus) {
            bonuses.push({
                name: 'Magic Bonus',
                value: weapon.magicBonus
            });
        }

        const diceTotal = dice.reduce((sum, die) => sum + die.value, 0);
        const bonusTotal = bonuses.reduce((sum, bonus) => sum + bonus.value, 0);
        const total = Math.max(1, diceTotal + bonusTotal); // Minimum 1 damage

        return {
            characterId: attacker.id,
            characterName: attacker.name,
            description: `${isCritical ? 'Critical ' : ''}Damage Roll - ${weapon.name}`,
            dice,
            bonuses,
            total,
            timestamp: Date.now(),
            damageType: weapon.damageType || 'physical'
        };
    }

    /**
     * Roll a saving throw
     * @param {Object} character - Character making the save
     * @param {string} ability - Ability being used (STR, DEX, CON, INT, WIS, CHA)
     * @param {number} dc - Difficulty class
     * @returns {Object} - Saving throw data
     */
    static rollSavingThrow(character, ability, dc) {
        const dice = this.rollDice(1, 20);
        const bonuses = [];

        const abilityMod = this.getAbilityModifier(character, ability);
        if (abilityMod !== 0) {
            bonuses.push({
                name: `${ability} Modifier`,
                value: abilityMod
            });
        }

        // Add proficiency if proficient in this save
        if (character.savingThrowProficiencies?.includes(ability)) {
            const profBonus = character.proficiencyBonus || 0;
            if (profBonus !== 0) {
                bonuses.push({
                    name: 'Proficiency Bonus',
                    value: profBonus
                });
            }
        }

        const diceTotal = dice.reduce((sum, die) => sum + die.value, 0);
        const bonusTotal = bonuses.reduce((sum, bonus) => sum + bonus.value, 0);
        const total = diceTotal + bonusTotal;

        return {
            characterId: character.id,
            characterName: character.name,
            description: `${ability} Saving Throw (DC ${dc})`,
            dice,
            bonuses,
            total,
            timestamp: Date.now(),
            success: total >= dc,
            dc
        };
    }

    /**
     * Roll an ability check
     * @param {Object} character - Character making the check
     * @param {string} ability - Ability being used
     * @param {string} skill - Optional skill name
     * @returns {Object} - Ability check data
     */
    static rollAbilityCheck(character, ability, skill = null) {
        const dice = this.rollDice(1, 20);
        const bonuses = [];

        const abilityMod = this.getAbilityModifier(character, ability);
        if (abilityMod !== 0) {
            bonuses.push({
                name: `${ability} Modifier`,
                value: abilityMod
            });
        }

        // Add skill proficiency if applicable
        if (skill && character.skills?.[skill]?.proficient) {
            const profBonus = character.proficiencyBonus || 0;
            if (profBonus !== 0) {
                bonuses.push({
                    name: `${skill} Proficiency`,
                    value: profBonus
                });
            }
        }

        const diceTotal = dice.reduce((sum, die) => sum + die.value, 0);
        const bonusTotal = bonuses.reduce((sum, bonus) => sum + bonus.value, 0);
        const total = diceTotal + bonusTotal;

        const description = skill 
            ? `${skill} Check (${ability})`
            : `${ability} Check`;

        return {
            characterId: character.id,
            characterName: character.name,
            description,
            dice,
            bonuses,
            total,
            timestamp: Date.now()
        };
    }

    /**
     * Helper: Get ability modifier from character
     * @param {Object} character - Character object
     * @param {string} ability - Ability abbreviation (STR, DEX, etc.)
     * @returns {number} - Ability modifier
     */
    static getAbilityModifier(character, ability) {
        if (!character.stats || !character.stats[ability]) {
            return 0;
        }
        return character.stats[ability].modifier || 0;
    }

    /**
     * Roll multiple characters' initiative at once
     * @param {Array<Object>} characters - Array of character objects
     * @returns {Array<Object>} - Array of initiative roll data
     */
    static rollGroupInitiative(characters) {
        return characters.map(char => this.rollInitiative(char));
    }
}

module.exports = DiceRoller;
