const CHARACTER = require('./Character/character');
const CharacterBuilder = require('./Character/characterbuilder');
const gameEvents = require('../handlers/gameEventEmitter');

/**
 * GameEngine - Server-side combat and game state manager
 * 
 * Manages:
 * - Turn order and initiative
 * - Character actions (attack, cast, move, etc.)
 * - Combat resolution
 * - Game state synchronization
 * - Victory conditions
 */
class GameEngine {
    constructor(gameId, settings = {}) {
        this.gameId = gameId;
        this.state = 'setup'; // setup, active, paused, ended
        
        // Game participants
        this.characters = new Map(); // characterId -> CHARACTER instance
        this.players = new Map();    // playerId -> { socketId, characterIds[] }
        
        // Turn management
        this.turnOrder = [];
        this.currentTurnIndex = 0;
        this.roundNumber = 1;
        
        // Combat tracking
        this.combatLog = [];
        this.startTime = null;
        this.endTime = null;
        
        // Settings
        this.settings = {
            maxPlayers: settings.maxPlayers || 6,
            turnTimeLimit: settings.turnTimeLimit || 60, // seconds
            autoEndTurn: settings.autoEndTurn || true,
            ...settings
        };
        
        // Timer for turn limits
        this.turnTimer = null;
    }

    /**
     * Add a character to the game
     * @param {CHARACTER} character - Character instance
     * @param {string} playerId - Owner player ID
     */
    addCharacter(character, playerId) {
        if (this.state !== 'setup') {
            throw new Error('Cannot add characters after game has started');
        }
        
        this.characters.set(character.id, character);
        
        // Track player ownership
        if (!this.players.has(playerId)) {
            this.players.set(playerId, {
                characterIds: [],
                socketId: null
            });
        }
        this.players.get(playerId).characterIds.push(character.id);
        
        this.log(`${character.name} joined the battle`);
        return this;
    }

    /**
     * Associate a socket with a player
     */
    connectPlayer(playerId, socketId) {
        if (this.players.has(playerId)) {
            this.players.get(playerId).socketId = socketId;
        }
    }

    /**
     * Roll initiative for all characters and set turn order
     */
    rollInitiative() {
        const initiatives = [];
        
        for (const [id, character] of this.characters) {
            const roll = this._rollDice('1d20') + character.initiative;
            initiatives.push({
                characterId: id,
                character: character,
                initiative: roll,
                dexMod: character.stats.DEX.modifier
            });
            
            this.log(`${character.name} rolled ${roll} for initiative`);
        }
        
        // Sort by initiative (highest first), tie-breaker is DEX modifier
        initiatives.sort((a, b) => {
            if (b.initiative !== a.initiative) {
                return b.initiative - a.initiative;
            }
            return b.dexMod - a.dexMod;
        });
        
        this.turnOrder = initiatives.map(i => i.characterId);
        this.log('Initiative order set: ' + 
            initiatives.map(i => `${i.character.name} (${i.initiative})`).join(', '));
        
        return this.turnOrder;
    }

    /**
     * Start the game
     */
    startGame() {
        if (this.state !== 'setup') {
            throw new Error('Game already started');
        }
        
        if (this.characters.size === 0) {
            throw new Error('No characters in game');
        }
        
        this.rollInitiative();
        this.state = 'active';
        this.startTime = Date.now();
        this.currentTurnIndex = 0;
        
        this.log('=== COMBAT BEGINS ===');
        this._startTurn();
        
        return this.getGameState();
    }

    /**
     * Get current character whose turn it is
     */
    getCurrentCharacter() {
        const characterId = this.turnOrder[this.currentTurnIndex];
        return this.characters.get(characterId);
    }

    /**
     * Start a character's turn
     * @private
     */
    _startTurn() {
        const character = this.getCurrentCharacter();
        
        this.log(`\n--- Round ${this.roundNumber}, Turn ${this.currentTurnIndex + 1} ---`);
        this.log(`${character.name}'s turn`);
        
        // Process start-of-turn effects (e.g., tick down status durations)
        this._processTurnStart(character);
        
        // Start turn timer if enabled
        if (this.settings.autoEndTurn && this.settings.turnTimeLimit > 0) {
            this.turnTimer = setTimeout(() => {
                this.log(`${character.name}'s turn timed out`);
                this.endTurn();
            }, this.settings.turnTimeLimit * 1000);
        }
        
        // Emit turn start event
        gameEvents.emitGameEvent('turnStart', {
            gameId: this.gameId,
            characterId: character.id,
            characterName: character.name,
            round: this.roundNumber,
            turnIndex: this.currentTurnIndex
        });
    }

    /**
     * Process start-of-turn effects
     * @private
     */
    _processTurnStart(character) {
        // Tick down status effect durations
        character.statusEffects.forEach(effect => {
            if (effect.duration !== undefined) {
                effect.duration--;
                if (effect.duration <= 0) {
                    character.removeStatusEffect(effect.name);
                    this.log(`${effect.name} expired on ${character.name}`);
                }
            }
        });
    }

    /**
     * Execute a character action
     * @param {string} characterId - Character performing action
     * @param {string} actionType - Type of action (attack, cast, move, etc.)
     * @param {object} actionData - Action parameters
     */
    executeAction(characterId, actionType, actionData) {
        if (this.state !== 'active') {
            throw new Error('Game is not active');
        }
        
        const character = this.characters.get(characterId);
        if (!character) {
            throw new Error('Character not found');
        }
        
        // Verify it's this character's turn
        const currentChar = this.getCurrentCharacter();
        if (currentChar.id !== characterId) {
            throw new Error('Not this character\'s turn');
        }
        
        const normalizedActionData = {
            ...(actionData || {}),
            characters: this.characters,
            combatEngine: this
        };
        const actionRef = normalizedActionData.actionPath || normalizedActionData.actionId || actionType;
        const shouldUseCharacterActionEngine = Boolean(
            normalizedActionData.actionPath ||
            normalizedActionData.actionId ||
            (typeof actionType === 'string' && actionType.includes('.'))
        );

        if (shouldUseCharacterActionEngine && typeof character.executeAction === 'function') {
            const result = character.executeAction(actionRef, normalizedActionData);

            // Check for victory conditions after dynamic actions as well.
            this._checkVictoryConditions();

            gameEvents.emitGameEvent('actionExecuted', {
                gameId: this.gameId,
                characterId: character.id,
                actionType: actionRef,
                result: result
            });

            return result;
        }

        let result;
        
        switch (actionType) {
            case 'attack':
                result = this._executeAttack(character, normalizedActionData);
                break;
            
            case 'cast':
                result = this._executeCast(character, normalizedActionData);
                break;
            
            case 'move':
                result = this._executeMove(character, normalizedActionData);
                break;
            
            case 'useItem':
                result = this._executeUseItem(character, normalizedActionData);
                break;
            
            case 'dash':
                result = this._executeDash(character);
                break;
            
            case 'dodge':
                result = this._executeDodge(character);
                break;
            
            case 'help':
                result = this._executeHelp(character, actionData);
                break;
            
            default:
                throw new Error(`Unknown action type: ${actionType}`);
        }
        
        // Broadcast action to all players
        gameEvents.emitGameEvent('actionExecuted', {
            gameId: this.gameId,
            characterId: character.id,
            actionType: actionRef,
            result: result
        });
        
        return result;
    }

    /**
     * Execute an attack action
     * @private
     */
    _executeAttack(attacker, data) {
        const { targetId, weaponId } = data;
        
        const target = this.characters.get(targetId);
        if (!target) {
            throw new Error('Target not found');
        }
        
        const weapon = attacker.equippedItems.find(i => i.id === weaponId);
        
        this.log(`${attacker.name} attacks ${target.name}!`);
        
        const result = attacker.attack({
            target: target,
            weapon: weapon
        });
        
        // Check for death
        if (target.HP.current <= 0) {
            this._handleCharacterDeath(target);
        }
        
        // Check for victory conditions
        this._checkVictoryConditions();
        
        return {
            success: true,
            attackRoll: result.attackRoll,
            hits: result.hits,
            damage: result.totalDamage,
            targetHP: target.HP.current,
            targetMaxHP: target.HP.max
        };
    }

    /**
     * Execute a spell/ability cast
     * @private
     */
    _executeCast(caster, data) {
        const { abilityId, targetId } = data;
        
        const ability = caster.abilities.find(a => a.id === abilityId);
        if (!ability) {
            throw new Error('Ability not found');
        }
        
        // Check resource costs (MP, spell slots, etc.)
        if (ability.mpCost && caster.MP.current < ability.mpCost) {
            throw new Error('Not enough MP');
        }
        
        this.log(`${caster.name} casts ${ability.name}!`);
        
        // Deduct costs
        if (ability.mpCost) {
            caster._baseMP.current -= ability.mpCost;
        }
        
        // Execute ability effect
        let result;
        if (ability.targetType === 'enemy' && targetId) {
            const target = this.characters.get(targetId);
            result = this._executeAbilityOnTarget(caster, ability, target);
        } else if (ability.targetType === 'self') {
            result = this._executeAbilityOnTarget(caster, ability, caster);
        } else if (ability.targetType === 'ally' && targetId) {
            const target = this.characters.get(targetId);
            result = this._executeAbilityOnTarget(caster, ability, target);
        }
        
        return result;
    }

    /**
     * Execute ability on a target
     * @private
     */
    _executeAbilityOnTarget(caster, ability, target) {
        // This is simplified - you'd expand based on ability types
        if (ability.effectType === 'damage') {
            const damage = this._rollDice(ability.damage);
            target.takeDamage({
                damage: damage,
                damageParts: [{
                    dice: ability.damage,
                    type: ability.damageType,
                    source: ability.name
                }],
                attacker: caster
            });
            
            return {
                success: true,
                damage: damage,
                targetHP: target.HP.current
            };
        } else if (ability.effectType === 'heal') {
            const healing = this._rollDice(ability.healing);
            target._baseHP.current = Math.min(
                target.HP.max,
                target.HP.current + healing
            );
            
            this.log(`${target.name} healed for ${healing} HP`);
            
            return {
                success: true,
                healing: healing,
                targetHP: target.HP.current
            };
        } else if (ability.effectType === 'buff' || ability.effectType === 'debuff') {
            target.addStatusEffect(ability.effect);
            
            return {
                success: true,
                effectApplied: ability.effect.name
            };
        }
    }

    /**
     * Execute a move action
     * @private
     */
    _executeMove(character, data) {
        const { x, y, z } = data;
        
        // Calculate distance
        const distance = Math.sqrt(
            Math.pow(x - character.position.x, 2) +
            Math.pow(y - character.position.y, 2) +
            Math.pow(z - character.position.z, 2)
        );
        
        if (distance > character.movement) {
            throw new Error(`Movement distance ${distance} exceeds limit ${character.movement}`);
        }
        
        const oldPos = { ...character.position };
        character.position = { x, y, z };
        
        this.log(`${character.name} moved from (${oldPos.x},${oldPos.y}) to (${x},${y})`);
        
        return {
            success: true,
            newPosition: character.position,
            distanceMoved: distance
        };
    }

    /**
     * Execute use item action
     * @private
     */
    _executeUseItem(character, data) {
        const { itemId, targetId } = data;
        
        const item = character.inventory.find(i => i.id === itemId);
        if (!item) {
            throw new Error('Item not found in inventory');
        }
        
        this.log(`${character.name} uses ${item.name}`);
        
        // Execute item effect (simplified)
        if (item.effect === 'heal') {
            const healing = this._rollDice(item.healing);
            character._baseHP.current = Math.min(
                character.HP.max,
                character.HP.current + healing
            );
            
            // Remove item if consumable
            if (item.consumable) {
                character.inventory = character.inventory.filter(i => i.id !== itemId);
            }
            
            return {
                success: true,
                healing: healing,
                hp: character.HP.current
            };
        }
        
        return { success: true };
    }

    /**
     * Execute dash action (double movement)
     * @private
     */
    _executeDash(character) {
        character.movement *= 2;
        this.log(`${character.name} dashes (movement doubled this turn)`);
        
        return {
            success: true,
            newMovement: character.movement
        };
    }

    /**
     * Execute dodge action (advantage on DEX saves, attacks against have disadvantage)
     * @private
     */
    _executeDodge(character) {
        character.addStatusEffect({
            name: 'Dodging',
            duration: 1, // Until start of next turn
            modifiers: [
                {
                    name: 'Dodge DEX Save Advantage',
                    hook: 'onSavingThrow',
                    priority: 80,
                    action: (context) => {
                        if (context.saveType === 'DEX') {
                            context.advantage = true;
                        }
                    }
                }
            ]
        });
        
        this.log(`${character.name} takes the Dodge action`);
        
        return { success: true };
    }

    /**
     * Execute help action (give ally advantage)
     * @private
     */
    _executeHelp(character, data) {
        const { targetId } = data;
        const target = this.characters.get(targetId);
        
        if (!target) {
            throw new Error('Target not found');
        }
        
        target.addStatusEffect({
            name: 'Helped',
            duration: 1,
            modifiers: [
                {
                    name: 'Help Advantage',
                    hook: 'onAttackRoll',
                    priority: 80,
                    action: (context) => {
                        context.advantage = true;
                    }
                }
            ]
        });
        
        this.log(`${character.name} helps ${target.name}`);
        
        return { success: true };
    }

    /**
     * End the current turn and move to next
     */
    endTurn() {
        if (this.state !== 'active') {
            throw new Error('Game is not active');
        }
        
        // Clear turn timer
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
            this.turnTimer = null;
        }
        
        const character = this.getCurrentCharacter();
        
        // Process end-of-turn effects
        this._processTurnEnd(character);
        
        // Move to next turn
        this.currentTurnIndex++;
        
        // Check if round is complete
        if (this.currentTurnIndex >= this.turnOrder.length) {
            this.currentTurnIndex = 0;
            this.roundNumber++;
            this.log(`\n=== Round ${this.roundNumber} ===`);
        }
        
        // Start next turn
        if (this.state === 'active') {
            this._startTurn();
        }
        
        gameEvents.emitGameEvent('turnEnd', {
            gameId: this.gameId,
            characterId: character.id,
            nextCharacterId: this.getCurrentCharacter().id
        });
        
        return this.getGameState();
    }

    /**
     * Process end-of-turn effects
     * @private
     */
    _processTurnEnd(character) {
        // Reset temporary bonuses like movement from Dash
        // This would be more sophisticated in a full implementation
    }

    /**
     * Handle character death
     * @private
     */
    _handleCharacterDeath(character) {
        this.log(`${character.name} has been defeated!`);
        
        // Remove from turn order
        this.turnOrder = this.turnOrder.filter(id => id !== character.id);
        
        // Adjust current turn index if needed
        if (this.currentTurnIndex >= this.turnOrder.length && this.turnOrder.length > 0) {
            this.currentTurnIndex = 0;
        }
        
        gameEvents.emitGameEvent('characterDefeated', {
            gameId: this.gameId,
            characterId: character.id,
            characterName: character.name
        });
    }

    /**
     * Check if victory conditions are met
     * @private
     */
    _checkVictoryConditions() {
        // Simplified: check if only one player's characters remain
        const activePlayers = new Set();
        
        for (const [id, character] of this.characters) {
            if (character.HP.current > 0) {
                // Find which player owns this character
                for (const [playerId, playerData] of this.players) {
                    if (playerData.characterIds.includes(id)) {
                        activePlayers.add(playerId);
                        break;
                    }
                }
            }
        }
        
        if (activePlayers.size <= 1) {
            this.endGame([...activePlayers][0]);
        }
    }

    /**
     * End the game
     */
    endGame(winnerId = null) {
        this.state = 'ended';
        this.endTime = Date.now();
        
        const duration = Math.floor((this.endTime - this.startTime) / 1000);
        
        this.log(`\n=== COMBAT ENDED ===`);
        this.log(`Duration: ${duration} seconds`);
        this.log(`Rounds: ${this.roundNumber}`);
        
        if (winnerId) {
            this.log(`Winner: Player ${winnerId}`);
        }
        
        gameEvents.emitGameEvent('gameEnd', {
            gameId: this.gameId,
            winnerId: winnerId,
            duration: duration,
            rounds: this.roundNumber
        });
        
        return this.getGameState();
    }

    /**
     * Get current game state for client synchronization
     */
    getGameState() {
        const characters = {};
        for (const [id, char] of this.characters) {
            characters[id] = {
                id: char.id,
                name: char.name,
                level: char.level,
                classType: char.classType,
                race: char.race,
                HP: char.HP,
                MP: char.MP,
                STA: char.STA,
                AC: char.AC,
                position: char.position,
                statusEffects: char.statusEffects.map(e => ({
                    name: e.name,
                    duration: e.duration
                })),
                stats: {
                    STR: char.stats.STR,
                    DEX: char.stats.DEX,
                    CON: char.stats.CON,
                    INT: char.stats.INT,
                    WIS: char.stats.WIS,
                    CHA: char.stats.CHA
                }
            };
        }
        
        return {
            gameId: this.gameId,
            state: this.state,
            round: this.roundNumber,
            currentTurnIndex: this.currentTurnIndex,
            currentCharacterId: this.getCurrentCharacter()?.id,
            turnOrder: this.turnOrder,
            characters: characters,
            combatLog: this.combatLog.slice(-20), // Last 20 messages
            startTime: this.startTime,
            endTime: this.endTime
        };
    }

    /**
     * Add message to combat log
     * @private
     */
    log(message) {
        const entry = {
            timestamp: Date.now(),
            message: message,
            round: this.roundNumber
        };
        this.combatLog.push(entry);
        console.log(`[Game ${this.gameId}] ${message}`);
    }

    /**
     * Dice rolling utility
     * @private
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
}

module.exports = GameEngine;
