/**
 * Seed script: Load classes from classes.json into MongoDB
 * Run: node server/scripts/seedClasses.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const classesData = require('../../data/gameFiles/class/classes.json');
const Class = require('../../data/mongooseDataStructure/class');

const MONGO_URI = process.env.MONGO_URI;

async function seedClasses() {
  try {
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
    });
    
    console.log('✓ Connected to MongoDB');

    // 1. Clear existing data
    const deleteResult = await Class.deleteMany({});
    console.log(`✓ Deleted ${deleteResult.deletedCount} existing classes from database`);

    console.log('Transforming and seeding classes...');
    const classesToInsert = [];

    // 2. Map through the JSON keys (Barbarian, Bard, etc.)
    for (const className in classesData) {
      const classData = classesData[className];
      
      // Convert the featuresByLevel object from JSON into a Map for Mongoose
      // This matches your Schema: featuresByLevel: { type: Map, of: [String] }
      const featuresMap = new Map();
      if (classData.featuresByLevel) {
        for (const [level, features] of Object.entries(classData.featuresByLevel)) {
          featuresMap.set(level, features);
        }
      }

      // 3. Construct the clean object
      // We take the data directly from JSON because your JSON structure 
      // already matches your Schema requirements.
      classesToInsert.push({
        name: classData.name,
        classID: classData.classID, // Uses "barbarian", "bard", etc. from JSON
        description: classData.description,
        resourcePoolModifier: classData.resourcePoolModifier || { HP: 1, STA: 1, MP: 1 },
        baseStatModifier: classData.baseStatModifier || {},
        baseProficiencies: classData.baseProficiencies || {
          armor: [],
          weapons: [],
          tools: [],
          abilityScore: [],
          skills: []
        },
        baseEquipment: classData.baseEquipment || [],
        featuresByLevel: featuresMap,
        choices: classData.choices || {}, // This now correctly captures the choices object
        subclasses: classData.subclasses || []
      });
    }

    // 4. Batch insert
    const result = await Class.insertMany(classesToInsert);
    console.log(`✓ Successfully seeded ${result.length} classes into database`);

    await mongoose.connection.close();
    console.log('✓ Connection closed');
    process.exit(0);

  } catch (err) {
    console.error('Seed error:', err);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

seedClasses();