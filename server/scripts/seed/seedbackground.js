/**
 * Seed script: Load backgrounds into MongoDB (UPSERT)
 * Run: node server/scripts/seedBackgrounds.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const backgroundsData = require('../../data/gameFiles/background/background.json');
const Background = require('../../data/mongooseDataStructure/background');

const MONGO_URI = process.env.MONGO_URI;

async function seedBackgrounds() {
  try {
    console.log('Connecting to MongoDB...');

    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
    });

    console.log('✓ Connected to MongoDB');
    console.log('Updating backgrounds...');

    const bulkOps = backgroundsData.map(bg => ({
      replaceOne: {
        filter: { backgroundID: bg.backgroundID },
        replacement: {
          backgroundID: bg.backgroundID,
          name: bg.name,
          description: bg.description,
          gp: bg.gp ?? 0,
          baseStatModifier: bg.baseStatModifier || {},
          baseProficiencies: bg.baseProficiencies || [],
          baseEquipment: bg.baseEquipment || [],
          features: bg.features || {},
          choices: bg.choices || {}
        },
        upsert: true
      }
    }));

    const result = await Background.bulkWrite(bulkOps);

    console.log('✓ Backgrounds updated successfully');
    console.log({
      inserted: result.upsertedCount,
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

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