/**
 * Seed script: Load classes from classes.json into MongoDB
 * Run: node server/scripts/seedClasses.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const classesData = require('../data/gameFiles/class/classes.json');
const Class = require('../data/mongooseDataStructure/class');

const MONGO_URI = process.env.MONGO_URI;

async function seedClasses() {
  try {
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
    });
    
    console.log('✓ Connected to MongoDB');

    // Delete all existing classes
    const deleteResult = await Class.deleteMany({});
    console.log(`✓ Deleted ${deleteResult.deletedCount} existing classes from database`);

    console.log('Transforming and seeding classes...');
    const classesToInsert = [];

    for (const className in classesData) {
      const classData = classesData[className];
      
      // Convert baseEquipment from object to array of strings
      const baseEquipmentArray = [];
      if (classData.baseEquipment) {
        for (const [item, quantity] of Object.entries(classData.baseEquipment)) {
          baseEquipmentArray.push(`${item}:${quantity}`);
        }
      }

      // Convert features from level objects to Map format
      const featuresByLevel = new Map();
      if (classData.features) {
        for (const [level, featuresObj] of Object.entries(classData.features)) {
          const featureIds = [];
          for (const [featureName, featureData] of Object.entries(featuresObj)) {
            if (featureData && featureData.id) {
              featureIds.push(featureData.id);
            }
          }
          if (featureIds.length > 0) {
            featuresByLevel.set(level, featureIds);
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

      // Create the class object for MongoDB
      classesToInsert.push({
        name: classData.name,
        classID: className.toLowerCase(),
        description: classData.description,
        resourcePoolModifier: classData.resourcePoolModifier || { HP: 1, STA: 1, MP: 1 },
        baseStatModifier: classData.baseStatModifier || {},
        baseProficiencies: classData.baseProficiencies || [],
        baseEquipment: baseEquipmentArray,
        featuresByLevel: featuresByLevel,
        choices: choices,
        subclasses: classData.subclasses || []
      });
    }

    const result = await Class.insertMany(classesToInsert);
    console.log(`✓ Successfully seeded ${result.length} classes into database`);

    await mongoose.connection.close();
    console.log('✓ Connection closed');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedClasses();