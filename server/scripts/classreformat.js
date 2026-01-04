const fs = require('fs');
const path = require('path');

const classesData = require('../data/gameFiles/class/classes.json');

function reformatClassesForSchema() {
    const reformatted = {};

    for (const className in classesData) {
        if (className === 'features') continue;

        const classData = classesData[className];
        
        // Convert baseEquipment from object to array of strings
        const baseEquipmentArray = [];
        if (classData.baseEquipment) {
            for (const [item, quantity] of Object.entries(classData.baseEquipment)) {
                baseEquipmentArray.push(`${item}:${quantity}`);
            }
        }

        // Convert features from level objects to Map format
        const featuresByLevel = {};
        if (classData.features) {
            for (const [level, featuresObj] of Object.entries(classData.features)) {
                const featureIds = [];
                for (const [featureName, featureData] of Object.entries(featuresObj)) {
                    if (featureData && featureData.id) {
                        featureIds.push(featureData.id);
                    }
                }
                if (featureIds.length > 0) {
                    featuresByLevel[level] = featureIds;
                }
            }
        }

        // Build choices object from choiceProficiencies and choiceEquipment
        const choices = {};
        
        if (classData.choiceProficiencies) {
            choices.proficiencies = classData.choiceProficiencies;
        }
        
        if (classData.choiceEquipment) {
            choices.equipment = classData.choiceEquipment;
        }

        // Create the reformatted class object
        reformatted[className] = {
            name: classData.name,
            classID: className.toLowerCase(),
            description: classData.description,
            resourcePoolModifier: classData.resourcePoolModifier || { HP: 1, STA: 1, MP: 1 },
            baseStatModifier: classData.baseStatModifier || {},
            baseProficiencies: classData.baseProficiencies || [],
            baseEquipment: baseEquipmentArray,
            featuresByLevel: featuresByLevel,
            choices: choices
        };
    }

    return reformatted;
}

const reformattedClasses = reformatClassesForSchema();

// Write to the JSON file
const filePath = path.join(__dirname, '../data/gameFiles/class/classes_reforamtted.json');
fs.writeFileSync(filePath, JSON.stringify(reformattedClasses, null, 2), 'utf8');

console.log('Successfully reformatted classes.json to match schema!');
console.log(`Processed ${Object.keys(reformattedClasses).length} classes`);