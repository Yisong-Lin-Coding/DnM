const gameEvents = require('../handlers/gameEventEmitter');

class CHARACTER{
    constructor(data){
        this.name = data.name;
        this.id = data.id;
        this.level = data.level;
        this.classType = data.classType;
        this.stats = data.stats;
        this.race = data.race;
        this.abilities = data.abilities;
        this.equipment = data.equipment;
        this.modifiers = data.modifiers || [];
        this.HP = data.HP;
        this.MP = data.MP;
        this.STA = data.STA;
        this.movement = data.movement;
        this.position = data.position;
        this.statusEffects = data.statusEffects || [];
        this.inventory = data.inventory || [];
        this.abilities = data.abilities || [];
        this.equippedItems = data.equippedItems || [];

        
        }

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

action(actionType, params){
    switch(actionType){
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

_modificationsCalc(){
    for (const item of this.equippedItems){
        for (const enchantment of item.enchantments){
            
        }
    }
}

attack(parms){




    const ModVarName = this.modifiers.filter(mod => mod.type === 'onAttack');




    const damageContext = {
        original:parms.damage || [
            {
                type: 'physical',
                dice:"1d1",
                flat:0,
                source:parms.source || 'fists'
            }
        ],
        current: parms.damage || [
            {
                type: 'physical',
                dice:"1d1",
                flat: 0,
                source:parms.source || 'fists'
            }
        ],
        modifications:[this.modifiers.filter(mod => mod.type === 'onAttack')],
        target: parms.target,
        attacker: this,
        accuracy: parms.accuracy || "1d20",
    }
    

    gameEvents.emitGameEvent('preAttack',{
        attacker: this.name,
        target: parms.target.name,
        damage: parms.damage,
        damageType: parms.damageType,
    })






    parms.target.takeDamage({
        damage: this._rollDice(parms.damage),
        damageType: parms.damageType,
        source: {
            attacker: this.name,
        },


    });
    gameEvents.emitGameEvent('attack', {
        attacker: this.name,
        target: parms.target.name,
        damage: parms.damage,
        damageType: parms.damageType,
    });

}

takeDamage(damageInfo){
    const resistanceModifier = this.modifiers.find(mod => mod.type === 'resistance' && mod.damageType === damageInfo.damageType).value || 1;
    const armorModifier = this.modifiers.find(mod => mod.type === 'AR' && mod.damageType === damageInfo.damageType).value || 0;

    gameEvents.emitGameEvent('perDamageCheck', {
        target: this.name,
        damage: damageInfo.damage,
        damageType: damageInfo.damageType,
        finalDamage: Math.max(0, (damageInfo.damage * resistanceModifier) - armorModifier),
        source: damageInfo.source,
    });




}

}