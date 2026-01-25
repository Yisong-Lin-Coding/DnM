/**
 * Seed script: Load subraces into MongoDB
 * Run: node server/scripts/seedSubraces.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const subracesData = require('../data/gameFiles/race/subraces.json');
const SubRace = require('../data/mongooseDataStructure/subrace');

const MONGO_URI = process.env.MONGO_URI;

async function seedSubraces() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 30000 });
    console.log('✓ Connected to MongoDB');

    // Clear existing subraces
    const deleteSub = await SubRace.deleteMany({});
    console.log(`✓ Deleted ${deleteSub.deletedCount} subraces`);

    // Seed subraces
    console.log('Seeding subraces...');
    const subracesToInsert = subracesData.map(sr => ({
      name: sr.name,
      subraceID: sr.race_id,
      mainrace: [
        {
          name: sr.race, // main race name
          raceID: sr.race // main race ID
        }
      ],
      description: sr.description,
      speed: sr.speed,
      abilityScoreModifiers: sr.ability_score_modifiers || {},
      size: sr.size || 'M',
      languages: sr.languages || [],
      traits: sr.traits || [],
      choices: sr.choices || {}
    }));

    const insertedSubraces = await SubRace.insertMany(subracesToInsert);
    console.log(`✓ Inserted ${insertedSubraces.length} subraces`);

    // Log first few for verification
    console.log('\nFirst 3 subraces:');
    insertedSubraces.slice(0, 3).forEach(sr => {
      console.log(`  - ${sr.name} (${sr.subraceID})`);
    });

    await mongoose.connection.close();
    console.log('\n✓ Connection closed');
    process.exit(0);

  } catch (err) {
    console.error('Seed error:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedSubraces();
