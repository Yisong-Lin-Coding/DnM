class CHARACTER{
    constructor({name,level,classType,stats,race,abilities,equipment}){
}

action(actionType, params){
    switch(actionType){
        case 'attack':
            this.performAttack(params);
            break;
        case 'cast':
            this.performCast(params);
            break;
        case 'useItem':
            this.useItem(params);
            break;
    }

}


}