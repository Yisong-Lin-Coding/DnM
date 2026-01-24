
class Character {
    constructor({name,level,classType,stats,race,abilities,equipment}) {
        this.name = name;
        this.level = level;
        this.classType = classType;
        this.stats = stats;
        this.race = race;
        this.abilities = abilities;
        this.equipment = equipment;
        this.modifiers = {}
    }
    printStat(statName) {
        return this.stats[statName] || null;
    }
    rollInitiative() {
        const dexMod = Math.floor((this.stats.dexterity - 10) / 2);
        return Math.floor(Math.random() * 20) + 1 + dexMod + (this.modifiers.initiativeBonus || 0);
    }
}


Kello = new Character({
    name: "Kello",
    level: 5,
    classType: "Rogue",
    stats: { strength: 12, dexterity: 18, constitution: 14, intelligence: 10, wisdom: 13, charisma: 11 },
    race: "Halfling",
    abilities: ["Stealth", "Lockpicking", "Backstab"],
    equipment: { weapon: "Dagger", armor: "Leather" }
});

console.log(Kello.rollInitiative());





