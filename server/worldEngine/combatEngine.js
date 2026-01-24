const gameEvents = require('../handlers/gameEventEmitter');

class CombatEngine {
    constructor(data) {
        this.characters = data.characters || {}; // array of character objects
        this.round = data.round || 0
        this.currentIndex = 0; // index in turn order
        this.isRunning = false;
        this.turnOrder = []; // array of {character, initiative} objects
    }

    // roll a single d20
    _rollD20() {
        return Math.floor(Math.random() * 20) + 1;
    }

    // Roll initiative for all participants and build turn order
    rollForInitiative() {
        // Each character may implement `rollInitiative()` to include modifiers
        this.turnOrder = this.characters
            .map((ch) => {
                const roll = typeof ch.rollInitiative === 'function'
                    ? ch.rollInitiative()
                    : this._rollD20() + (ch.initiativeMod || 0);
                return { character: ch, initiative: roll };
            })
            // sort descending (higher initiative acts first)
            .sort((a, b) => b.initiative - a.initiative);

        gameEvents.emitCombatEvent('initiative', {
            round: this.round,
            order: this.turnOrder.map((t) => ({ id: t.character.id || t.character.name, initiative: t.initiative }))
        });
    }

    // Start the combat encounter
    startCombat() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.round = 1;
        this.currentIndex = 0;
        this.rollForInitiative();
        gameEvents.emitGameEvent('start', { round: this.round });
        gameEvents.emitCombatEvent('round:start', { round: this.round });
        this.startTurn();
    }

    // Internal: advance to next living participant index (wraps rounds)
    _advanceIndex() {
        this.currentIndex++;
        // If we've exhausted the turnOrder, end round and start a new one
        if (this.currentIndex >= this.turnOrder.length) {
            this.endRound();
            return false;
        }
        return true;
    }

    // Start the current turn (will skip dead/unconscious characters)
    startTurn() {
        if (!this.isRunning) return;
        // find next valid character to act
        while (this.currentIndex < this.turnOrder.length) {
            const entry = this.turnOrder[this.currentIndex];
            const ch = entry.character;
            // skip if dead or flagged as inactive
            if (ch.currentHP !== undefined && ch.currentHP <= 0) {
                gameEvents.emitCombatEvent('miss', { reason: 'dead', target: ch.id || ch.name });
                this.currentIndex++;
                continue;
            }

            gameEvents.emitCombatEvent('turn:start', { round: this.round, character: ch.id || ch.name });
            if (typeof ch.startTurn === 'function') {
                try { ch.startTurn(); } catch (err) { console.error('startTurn handler failed', err); }
            }
            // Character is now active; it's up to the game loop or caller to call `endTurn()` when done.
            return;
        }

        // If no characters left, end round
        this.endRound();
    }

    // End the currently active character's turn and advance
    endTurn() {
        if (!this.isRunning) return;
        const entry = this.turnOrder[this.currentIndex];
        if (entry) {
            const ch = entry.character;
            gameEvents.emitCombatEvent('turn:end', { round: this.round, character: ch.id || ch.name });
            if (typeof ch.endTurn === 'function') {
                try { ch.endTurn(); } catch (err) { console.error('endTurn handler failed', err); }
            }
        }

        // Advance to next index and start its turn (or end round)
        const cont = this._advanceIndex();
        if (cont) this.startTurn();
    }

    // End the current round, increment round counter, reroll initiative, and begin the next round
    endRound() {
        gameEvents.emitCombatEvent('round:end', { round: this.round });
        this.round++;
        // Reroll initiative each round as requested
        this.rollForInitiative();
        this.currentIndex = 0;
        gameEvents.emitCombatEvent('round:start', { round: this.round });
        this.startTurn();
    }

    // Stop the combat encounter
    endCombat() {
        if (!this.isRunning) return;
        this.isRunning = false;
        gameEvents.emitCombatEvent('end', { round: this.round });
        gameEvents.emitGameEvent('end', { round: this.round });
    }

    // Utility: get current active character (may be undefined if none)
    getCurrentCharacter() {
        const entry = this.turnOrder[this.currentIndex];
        return entry ? entry.character : undefined;
    }

    // Utility: add a new participant mid-combat
    addCharacter(character) {
        this.characters.push(character);
        // optionally insert into turnOrder for current round at end
        this.turnOrder.push({ character, initiative: -Infinity });
    }
}

module.exports = CombatEngine;