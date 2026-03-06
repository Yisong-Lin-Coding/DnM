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
        this.state  = 'setup'; // setup | active | paused | ended

        // Game participants
        this.characters = new Map(); // characterId -> CHARACTER instance
        this.players    = new Map(); // playerId    -> { socketId, characterIds[] }
        this.pendingActions = new Map(); // characterId -> actionData

        // Turn management
        this.turnOrder        = [];
        this.currentTurnIndex = 0;
        this.roundNumber      = 1;

        // Combat tracking
        this.combatLog = [];
        this.startTime = null;
        this.endTime   = null;

        // Settings
        this.settings = {
            maxPlayers:    settings.maxPlayers    || 6,
            turnTimeLimit: settings.turnTimeLimit || 60, // seconds
            autoEndTurn:   settings.autoEndTurn   !== false,
            ...settings
        };

        this.turnTimer = null;
    }

    // =========================================================================
    // SETUP
    // =========================================================================

    /**
     * Add a character to the game (setup phase only).
     * @param {CHARACTER} character - Character instance
     * @param {string}    playerId  - Owner player ID
     */
    addCharacter(character, playerId) {
        if (this.state !== 'setup') {
            throw new Error('Cannot add characters after game has started');
        }

        this.characters.set(character.id, character);

        if (!this.players.has(playerId)) {
            this.players.set(playerId, { characterIds: [], socketId: null });
        }
        this.players.get(playerId).characterIds.push(character.id);

        this.log(`${character.name} joined the battle`);
        return this;
    }

    /** Associate a socket connection with a player. */
    connectPlayer(playerId, socketId) {
        if (this.players.has(playerId)) {
            this.players.get(playerId).socketId = socketId;
        }
    }

    // =========================================================================
    // INITIATIVE & TURN ORDER
    // =========================================================================

    /**
     * Roll initiative for all characters and set turn order.
     * FIX: calls character.rollInitiative() instead of reading the getter directly,
     *      because the getter no longer rolls dice — it returns the stored value.
     */
    rollInitiative() {
        const initiatives = [];

        for (const [id, character] of this.characters) {
            // rollInitiative() stores the result inside the character and returns it
            const roll = character.rollInitiative();
            initiatives.push({
                characterId: id,
                character,
                initiative:  roll,
                dexMod:      character.stats.DEX.modifier
            });
            this.log(`${character.name} rolled ${roll} for initiative`);
        }

        // Highest first; tie-break by DEX modifier
        initiatives.sort((a, b) =>
            b.initiative !== a.initiative
                ? b.initiative - a.initiative
                : b.dexMod - a.dexMod
        );

        this.turnOrder = initiatives.map((i) => i.characterId);
        this.log('Initiative order: ' + initiatives.map((i) => `${i.character.name} (${i.initiative})`).join(', '));
        return this.turnOrder;
    }

    // =========================================================================
    // GAME LIFECYCLE
    // =========================================================================

    startGame() {
        if (this.state !== 'setup') throw new Error('Game already started');
        if (this.characters.size === 0) throw new Error('No characters in game');

        this.rollInitiative();
        this.state        = 'active';
        this.startTime    = Date.now();
        this.currentTurnIndex = 0;

        this.log('=== COMBAT BEGINS ===');
        this._startTurn();

        return this.getGameState();
    }

    getCurrentCharacter() {
        const characterId = this.turnOrder[this.currentTurnIndex];
        return this.characters.get(characterId);
    }

    /** @private */
    _startTurn() {
        const character = this.getCurrentCharacter();
        this.log(`\n--- Round ${this.roundNumber}, Turn ${this.currentTurnIndex + 1} ---`);
        this.log(`${character.name}'s turn`);

        this._processTurnStart(character);

        if (this.settings.autoEndTurn && this.settings.turnTimeLimit > 0) {
            this.turnTimer = setTimeout(() => {
                this.log(`${character.name}'s turn timed out`);
                this.endTurn();
            }, this.settings.turnTimeLimit * 1000);
        }

        gameEvents.emitGameEvent('turnStart', {
            gameId:        this.gameId,
            characterId:   character.id,
            characterName: character.name,
            round:         this.roundNumber,
            turnIndex:     this.currentTurnIndex
        });
    }

    /** @private — Tick down status effect durations and fire the onTurnStart modifier pipeline. */
    _processTurnStart(character) {
        // 1. Reset per-turn resources (movement, action points)
        character.startTurn();

        // 2. Fire the onTurnStart pipeline — handles tick damage (bleed, poison,
        //    etc.) and any per-turn modifier logic. Effects must still be alive
        //    so their modifiers run before we check expiry. Movement/AP context
        //    allows effects (exhaustion, haste) to modify available resources.
        const context = {
            character,
            movement:     character.movement,
            actionPoints: character._actionPoints || { action: 1, bonusAction: 1, movement: 1 }
        };

        // DEBUG: Log status effects before pipeline
        if (character.statusEffects && character.statusEffects.length > 0) {
            this.log(`[DEBUG] ${character.name} has ${character.statusEffects.length} status effects: ${character.statusEffects.map(e => e.name || e.id).join(', ')}`);
        }

        character.applyModifierPipeline('onTurnStart', context);

        // Write back any modifications from the pipeline
        if (Number.isFinite(context.movement)) {
            character._baseMovement = context.movement;
        }
        if (context.actionPoints && typeof context.actionPoints === 'object') {
            character._actionPoints = context.actionPoints;
        }

        // 3. NOW tick down durations and remove expired effects (after they've had
        //    their last tick). Iterate over a copy so we can safely remove.
        [...character.statusEffects].forEach((effect) => {
            if (Number.isFinite(effect.duration) && effect.duration !== -1) {
                const oldDuration = effect.duration;
                effect.duration--;
                this.log(`[DEBUG] ${effect.name}: duration ${oldDuration} → ${effect.duration}`);
                if (effect.duration <= 0) {
                    character.removeStatusEffect(effect.name);
                    this.log(`${effect.name} expired on ${character.name}`);
                }
            }
        });
    }

    endTurn() {
        if (this.state !== 'active') throw new Error('Game is not active');

        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
            this.turnTimer = null;
        }

        const character = this.getCurrentCharacter();
        this._processTurnEnd(character);

        this.currentTurnIndex++;

        if (this.currentTurnIndex >= this.turnOrder.length) {
            this.currentTurnIndex = 0;
            this.roundNumber++;
            this.log(`\n=== Round ${this.roundNumber} ===`);
            
            // Re-roll initiative at the start of each new round
            this.rollInitiative();
            this.log('Initiative re-rolled for new round');
        }

        if (this.state === 'active') this._startTurn();

        gameEvents.emitGameEvent('turnEnd', {
            gameId:           this.gameId,
            characterId:      character.id,
            nextCharacterId:  this.getCurrentCharacter()?.id
        });

        return this.getGameState();
    }

    /** @private */
    _processTurnEnd(character) {
        // Hook for end-of-turn cleanup (dash resets, concentrations, etc.)
        // Extend this as needed
    }

    endGame(winnerId = null) {
        this.state   = 'ended';
        this.endTime = Date.now();

        const duration = Math.floor((this.endTime - this.startTime) / 1000);
        this.log(`\n=== COMBAT ENDED ===`);
        this.log(`Duration: ${duration} seconds, Rounds: ${this.roundNumber}`);
        if (winnerId) this.log(`Winner: Player ${winnerId}`);

        gameEvents.emitGameEvent('gameEnd', {
            gameId:   this.gameId,
            winnerId,
            duration,
            rounds:   this.roundNumber
        });

        return this.getGameState();
    }

    // =========================================================================
    // ACTION DISPATCH
    // =========================================================================

    stageAction(characterId, actionData) {
        this.pendingActions.set(String(characterId), actionData);
        return { success: true, message: "Action staged" };
    }

    getStagedAction(characterId) {
        return this.pendingActions.get(String(characterId));
    }

    clearStagedAction(characterId) {
        const existed = this.pendingActions.has(String(characterId));
        this.pendingActions.delete(String(characterId));
        return existed;
    }

    /**
     * Execute a character action.
     * Supports both the new path-based action engine (character.executeAction) and
     * the legacy switch-case actions for backward compatibility.
     *
     * @param {string} characterId - ID of the acting character
     * @param {string} actionType  - Action type or dot-path (e.g. 'main.attack')
     * @param {object} actionData  - Action parameters
     */
    executeAction(characterId, actionType, actionData) {
        if (this.state !== 'active') throw new Error('Game is not active');

        const character = this.characters.get(characterId);
        if (!character) throw new Error('Character not found');

        const currentChar = this.getCurrentCharacter();
        if (currentChar.id !== characterId) throw new Error("Not this character's turn");

        // Inject game context so character actions can resolve targets by ID
        const normalizedActionData = {
            ...(actionData || {}),
            characters:   this.characters,
            combatEngine: this
        };

        const actionRef = normalizedActionData.actionPath || normalizedActionData.actionId || actionType;

        // If the caller is using the path-based system (dot-notation or explicit actionPath/actionId),
        // delegate to the character's own action engine.
        const useCharacterEngine = Boolean(
            normalizedActionData.actionPath ||
            normalizedActionData.actionId   ||
            (typeof actionType === 'string' && actionType.includes('.'))
        );

        if (useCharacterEngine && typeof character.executeAction === 'function') {
            const result = character.executeAction(actionRef, normalizedActionData);
            this._checkVictoryConditions();
            gameEvents.emitGameEvent('actionExecuted', { gameId: this.gameId, characterId: character.id, actionType: actionRef, result });
            return result;
        }

        // Legacy switch-case dispatch
        let result;
        switch (actionType) {
            case 'attack':   result = this._executeAttack(character, normalizedActionData);  break;
            case 'cast':     result = this._executeCast(character, normalizedActionData);    break;
            case 'move':     result = this._executeMove(character, normalizedActionData);    break;
            case 'useItem':  result = this._executeUseItem(character, normalizedActionData); break;
            case 'dash':     result = this._executeDash(character);                          break;
            case 'dodge':    result = this._executeDodge(character);                         break;
            case 'help':     result = this._executeHelp(character, normalizedActionData);    break;
            default:
                throw new Error(`Unknown action type: ${actionType}`);
        }

        gameEvents.emitGameEvent('actionExecuted', { gameId: this.gameId, characterId: character.id, actionType, result });
        return result;
    }

    // =========================================================================
    // LEGACY ACTION HANDLERS (kept for backward compatibility)
    // =========================================================================

    /** @private */
    _executeAttack(attacker, data) {
        const { targetId, weaponId } = data;
        const target = this.characters.get(targetId);
        if (!target) throw new Error('Target not found');

        const weapon = attacker.equippedItems.find((i) => i.id === weaponId);
        this.log(`${attacker.name} attacks ${target.name}!`);

        const result = attacker.attack({ target, weapon });

        if (target.HP.current <= 0) this._handleCharacterDeath(target);
        this._checkVictoryConditions();

        return {
            success:    true,
            attackRoll: result.attackRoll,
            hits:       result.hits,
            damage:     result.totalDamage,
            targetHP:   target.HP.current,
            targetMaxHP:target.HP.max
        };
    }

    /** @private */
    _executeCast(caster, data) {
        const { abilityId, targetId } = data;
        const ability = caster.abilities.find((a) => a.id === abilityId);
        if (!ability) throw new Error('Ability not found');

        if (ability.mpCost && caster.MP.current < ability.mpCost) throw new Error('Not enough MP');
        this.log(`${caster.name} casts ${ability.name}!`);

        if (ability.mpCost) caster._baseMP.current -= ability.mpCost;

        const getTarget = (id) => this.characters.get(id);

        if (ability.targetType === 'self') return this._executeAbilityOnTarget(caster, ability, caster);
        if (targetId) {
            const target = getTarget(targetId);
            if (!target) throw new Error('Target not found');
            return this._executeAbilityOnTarget(caster, ability, target);
        }

        return { success: false, message: 'No valid target for this ability.' };
    }

    /** @private */
    _executeAbilityOnTarget(caster, ability, target) {
        if (ability.effectType === 'damage') {
            const damage = this._rollDice(ability.damage);
            target.takeDamage({
                damage,
                damageParts: [{ dice: ability.damage, type: ability.damageType, source: ability.name }],
                attacker:    caster
            });
            return { success: true, damage, targetHP: target.HP.current };
        }

        if (ability.effectType === 'heal') {
            const healing = this._rollDice(ability.healing);
            target._baseHP.current = Math.min(target.HP.max, target.HP.current + healing);
            this.log(`${target.name} healed for ${healing} HP`);
            return { success: true, healing, targetHP: target.HP.current };
        }

        if (ability.effectType === 'buff' || ability.effectType === 'debuff') {
            target.addStatusEffect(ability.effect);
            return { success: true, effectApplied: ability.effect.name };
        }

        return { success: false, message: `Unknown effectType: ${ability.effectType}` };
    }

    /** @private */
    _executeMove(character, data) {
        const { x, y, z } = data;
        const distance = Math.sqrt(
            (x - character.position.x) ** 2 +
            (y - character.position.y) ** 2 +
            (z - character.position.z) ** 2
        );

        if (distance > character.movement) {
            throw new Error(`Movement distance ${distance.toFixed(1)} exceeds limit ${character.movement}`);
        }

        const oldPos = { ...character.position };
        character.position = { x, y, z };
        this.log(`${character.name} moved from (${oldPos.x},${oldPos.y}) to (${x},${y})`);

        return { success: true, newPosition: character.position, distanceMoved: distance };
    }

    /** @private */
    _executeUseItem(character, data) {
        const { itemId } = data;
        const item = character.inventory.find((i) => i.id === itemId);
        if (!item) throw new Error('Item not found in inventory');

        this.log(`${character.name} uses ${item.name}`);

        if (item.effect === 'heal') {
            const healing = this._rollDice(item.healing);
            character._baseHP.current = Math.min(character.HP.max, character.HP.current + healing);
            if (item.consumable) {
                character.inventory = character.inventory.filter((i) => i.id !== itemId);
            }
            return { success: true, healing, hp: character.HP.current };
        }

        return { success: true };
    }

    /** @private — Double movement for one turn. */
    _executeDash(character) {
        const currentMovement = character.movement;
        character._baseMovement = currentMovement * 2;
        this.log(`${character.name} dashes (movement doubled this turn)`);
        return { success: true, newMovement: character.movement };
    }

    /** @private — Attackers have disadvantage; character has advantage on DEX saves. */
    _executeDodge(character) {
        character.addStatusEffect({
            name:      'Dodging',
            duration:  1,
            modifiers: [{
                name:     'Dodge DEX Save Advantage',
                hook:     'onSavingThrow',
                priority: 80,
                action:   (context) => { if (context.saveType === 'DEX') context.advantage = true; }
            }]
        });
        this.log(`${character.name} takes the Dodge action`);
        return { success: true };
    }

    /** @private — Give an ally advantage on their next attack. */
    _executeHelp(character, data) {
        const target = this.characters.get(data.targetId);
        if (!target) throw new Error('Target not found');

        target.addStatusEffect({
            name:      'Helped',
            duration:  1,
            modifiers: [{
                name:     'Help Advantage',
                hook:     'onAttackRoll',
                priority: 80,
                action:   (context) => { context.advantage = 1; }
            }]
        });

        this.log(`${character.name} helps ${target.name}`);
        return { success: true };
    }

    // =========================================================================
    // DEATH & VICTORY
    // =========================================================================

    /** @private */
    _handleCharacterDeath(character) {
        this.log(`${character.name} has been defeated!`);
        this.turnOrder = this.turnOrder.filter((id) => id !== character.id);

        if (this.currentTurnIndex >= this.turnOrder.length && this.turnOrder.length > 0) {
            this.currentTurnIndex = 0;
        }

        gameEvents.emitGameEvent('characterDefeated', {
            gameId:        this.gameId,
            characterId:   character.id,
            characterName: character.name
        });
    }

    /** @private */
    _checkVictoryConditions() {
        const activePlayers = new Set();

        for (const [id, character] of this.characters) {
            if (character.HP.current > 0) {
                for (const [playerId, playerData] of this.players) {
                    if (playerData.characterIds.includes(id)) {
                        activePlayers.add(playerId);
                        break;
                    }
                }
            }
        }

        if (activePlayers.size <= 1) {
            this.endGame([...activePlayers][0] || null);
        }
    }

    // =========================================================================
    // STATE SYNC
    // =========================================================================

    /**
     * Serialise current game state for client delivery.
     * FIX: was using char.AC — the getter is named AR on CHARACTER.
     */
    getGameState() {
        const characters = {};
        for (const [id, char] of this.characters) {
            characters[id] = {
                id:          char.id,
                name:        char.name,
                level:       char.level,
                classType:   char.classType,
                race:        char.race,
                HP:          char.HP,
                MP:          char.MP,
                STA:         char.STA,
                AR:          char.AR,   // FIX: was char.AC — the getter is char.AR
                position:    char.position,
                statusEffects: char.statusEffects.map((e) => ({ name: e.name, duration: e.duration })),
                stats: {
                    STR:  char.stats.STR,
                    DEX:  char.stats.DEX,
                    CON:  char.stats.CON,
                    INT:  char.stats.INT,
                    WIS:  char.stats.WIS,
                    CHA:  char.stats.CHA,
                    LUCK: char.stats.LUCK
                }
            };
        }

        // Expose player → character ownership so the client knows which characters it controls
        const playerOwnership = {};
        for (const [playerId, playerData] of this.players) {
            playerOwnership[playerId] = playerData.characterIds;
        }

        return {
            gameId:             this.gameId,
            state:              this.state,
            round:              this.roundNumber,
            currentTurnIndex:   this.currentTurnIndex,
            currentCharacterId: this.getCurrentCharacter()?.id,
            turnOrder:          this.turnOrder,
            characters,
            playerOwnership,         // NEW: lets client resolve "my characters"
            combatLog:          this.combatLog.slice(-20),
            startTime:          this.startTime,
            endTime:            this.endTime
        };
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================

    log(message) {
        this.combatLog.push({ timestamp: Date.now(), message, round: this.roundNumber });
        console.log(`[Game ${this.gameId}] ${message}`);
    }

    /**
     * Simple dice roller for the engine itself.
     * Accepts a dice string like '2d6'.
     * NOTE: CHARACTER._rollDice uses a different signature ({ dice, advantage }).
     *       Keep this version for internal engine use (no advantage mechanic needed here).
     */
    _rollDice(diceString) {
        const [countStr, sidesStr] = String(diceString || '1d6').toLowerCase().split('d');
        const count = Math.max(1, Number(countStr) || 1);
        const sides = Math.max(2, Number(sidesStr) || 6);
        let total   = 0;
        for (let i = 0; i < count; i++) {
            total += Math.floor(Math.random() * sides) + 1;
        }
        return total;
    }
}

module.exports = GameEngine;