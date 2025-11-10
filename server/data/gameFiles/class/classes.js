const classes ={
    "Barbarian":{
        "name":"Barbarian",
        "description":"A fierce warrior of primitive background who can enter a battle rage",
        "resourcePoolModifier":{
            "HP":2,
            'STA':1.2,
            'MP':0.3
        },
        "baseStatModifier":{
            "str":1,
            "con":1
        },
        "baseProficiencies":[
            "lightArmor",
            "mediumArmor",
            "shields",
            "simpleWeapons",
            "martialWeapons",
            "STRsavingThrows",
            "CONsavingThrows",                
            ],
        "choiceProficiencies":{
            "skills":{
                "amount":2,
                "options":[
                    "animalHandling",
                    "athletics",
                    "intimidation",
                    "nature",
                    "perception",
                    "survival"]}
                },
        "baseEquipment":{
            "explorerPack":1,
            "javelin":4
        },
        "choiceEquipment":{
            "choice1":{
                "option1":{
                    "greataxe":1,
                },
                "option2":{
                    "anyMartialWeapon":1
                }
            },
            "choice2":{
                "option1":{
                    "handaxes":2
                },
                "option2":{
                    "anySimpleWeapon":1,
                }
        }
    },
    "features":{
        "level1":{
            "rage":{
                "name":"Rage",
                "description":"Emotions are considered weaknesses by many, however, long ago the first barbarians discovered how to channel their fury into strength and resilience.",
                "effectsDescription":`On your turn, you can enter a rage as a bonus action. 
                While raging, you gain the following benefits if you aren't wearing heavy armor:
                - You have advantage on Strength checks and Strength saving throws.
                - When you make a melee weapon attack using Strength, you gain a bonus to the damage roll that increases as you gain levels as a barbarian, as shown in the Rage Damage column of the Barbarian table.
                - You have resistance to bludgeoning, piercing, and slashing damage.
                Your rage lasts for 1 minute. It ends early if you are knocked unconscious or if your turn ends and you haven't attacked a hostile creature since your last turn or taken damage since then. You can also end your rage on your turn as a bonus action.
                Once you have raged the number of times shown for your barbarian level in the Rages column of the Barbarian table, you must finish a long rest before you can rage again.`,
            },
        "unarmoredDefense":{
            "name":"Unarmored Defense",
            "description":"Barbarians have long practiced the art of surviving in the wilds without armor.",
            "effectsDescription":`While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier. 
            You can use a shield and still gain this benefit`
        },
        "muscleMemory":{
            "name":"Muscle Memory",
            "description":"Tuning your body, you can now react instinctively to danger.",
            "effetcDescription":`You have advantage on Strength Saving Throws against effects that you can see, such as traps and spells.
            To gain this benefit, you can't be **incapacitated**.`
        }
    }
        


    }
    }}
