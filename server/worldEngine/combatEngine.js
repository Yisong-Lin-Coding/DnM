import { GameEvents } from "../handlers/eventListener";
class COMBATENGINE{
    constructor([characters, map]){
        this.character = characters;
        this.turn = 0
        this.map = map;
    }

    rollInitiative(){
        GameEvents.emit("onInitiativeRoll", { characters: this.characters });
        this.characters.sort((a,b) => b.initiativeRoll - a.initiativeRoll);
    }

    startCombat(){
        GameEvents.emit("onCombatStart", { characters: this.characters, turn: this.turn,});
        this.rollInitiative()
        this.startTurn()
    }

    startTurn(){
       for(const char of this.characters){
            GameEvents.emit("onTurnStart",{ character: char, turn: this.turn  });
            char.startTurn()
            GameEvents.on
    }
}}