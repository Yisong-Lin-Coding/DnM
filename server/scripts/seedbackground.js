/**
 * Seed script: Load backgrounds from backgrounds.json into MongoDB
 * Run: node server/scripts/seedBackgrounds.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const backgroundsData = require('../data/gameFiles/background/background.json');
const Background = require('../data/mongooseDataStructure/background');

const MONGO_URI = process.env.MONGO_URI;

async function seedBackgrounds() {
  try {
    console.log('Connecting to MongoDB...');

    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
    });

    console.log('✓ Connected to MongoDB');

    // Clear existing backgrounds
    const deleteResult = await Background.deleteMany({});
    console.log(`✓ Deleted ${deleteResult.deletedCount} existing backgrounds`);

    console.log('Seeding backgrounds...');

    const backgroundsToInsert = backgroundsData.map(bg => ({
      name: bg.name,
      backgroundID: bg.backgroundID,
      description: bg.description,

      baseStatModifier: bg.baseStatModifier || {},
      baseProficiencies: bg.baseProficiencies || [],
      baseEquipment: bg.baseEquipment || [],

      features: bg.features || {},
      choices: bg.choices || {},
      gp: bg.gp ?? 0,
    }));

    const result = await Background.insertMany(backgroundsToInsert);
    console.log(`✓ Successfully seeded ${result.length} backgrounds`);

    await mongoose.connection.close();
    console.log('✓ Connection closed');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedBackgrounds();
