/**
 * Seed script: Load races from races_formatted.json into MongoDB
 * Run: node server/scripts/seedRaces.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const racesData = require('../data/gameFiles/race/races_formatted.json');
const Race = require('../data/mongooseDataStructure/race');

const MONGO_URI = process.env.MONGO_URI;

async function seedRaces() {
  try {
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
    });
    
    console.log('✓ Connected to MongoDB');

    // Delete all existing races
    const deleteResult = await Race.deleteMany({});
    console.log(`✓ Deleted ${deleteResult.deletedCount} existing races from database`);

    console.log('Transforming and seeding races...');
    const racesToInsert = racesData.map(race => ({
      name: race.name,
      raceID: race.race_id,
      description: race.description,
      speed: race.speed || 30,
      abilityScoreModifiers: race.ability_score_modifiers || {},
      size: race.size || 'M',
      languages: race.languages || [],
      traits: race.traits || [],
      choices: race.choices || {}
    }));

    const result = await Race.insertMany(racesToInsert);
    console.log(`✓ Successfully seeded ${result.length} races into database`);

    await mongoose.connection.close();
    console.log('✓ Connection closed');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedRaces();