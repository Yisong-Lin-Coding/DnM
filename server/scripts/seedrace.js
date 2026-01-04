/**
 * Seed script: Load main races and subraces into MongoDB
 * Run: node server/scripts/seedRaces.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const mainRacesData = require('../data/gameFiles/race/main_races.json');
const subracesData = require('../data/gameFiles/race/subraces.json');

const Race = require('../data/mongooseDataStructure/race');
const SubRace = require('../data/mongooseDataStructure/subrace');

const MONGO_URI = process.env.MONGO_URI;

async function seedRaces() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 30000 });
    console.log('✓ Connected to MongoDB');

    // Clear existing races and subraces
    const deleteMain = await Race.deleteMany({});
    const deleteSub = await SubRace.deleteMany({});
    console.log(`✓ Deleted ${deleteMain.deletedCount} main races and ${deleteSub.deletedCount} subraces`);

    // Seed main races
    console.log('Seeding main races...');
    const mainRacesToInsert = mainRacesData.map(race => ({
      name: race.name,
      raceID: race.race_id,
      description: race.description,
      speed: race.speed,
      abilityScoreModifiers: race.ability_score_modifiers || {},
      size: race.size || 'M',
      languages: race.languages || [],
      traits: race.traits || [],
      choices: race.choices || {},
      subraces: race.subraces.map(sr => ({
        name: sr.name,
        subraceID: sr.race_id
      }))
    }));

    const insertedMainRaces = await Race.insertMany(mainRacesToInsert);
    console.log(`✓ Inserted ${insertedMainRaces.length} main races`);

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
