require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Ensure these paths point to your new camelCase files
const mainRacesData = require('../../data/gameFiles/race/main_races.json');
const subracesData = require('../../data/gameFiles/race/subraces.json');

const Race = require('../../data/mongooseDataStructure/race');
const SubRace = require('../../data/mongooseDataStructure/subrace');

const MONGO_URI = process.env.MONGO_URI;

async function seedRaces() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    // Clear existing
    await Race.deleteMany({});
    await SubRace.deleteMany({});
    console.log('✓ Cleared existing collections');

    // Seed main races
    const mainRacesToInsert = mainRacesData.map(race => ({
      name: race.name,
      raceID: race.raceId, // Mapped from camelCase raceId
      description: race.description,
      speed: race.speed,
      abilityScoreModifiers: race.abilityScoreModifiers || {},
      size: race.size || 'M',
      languages: race.languages || [],
      traits: race.traits || [],
      choices: race.choices || {},
      subraces: race.subraces.map(srId => ({
        subraceID: srId // Mapping the ID strings to the subrace schema
      }))
    }));

    await Race.insertMany(mainRacesToInsert);
    console.log(`✓ Inserted ${mainRacesToInsert.length} main races`);

    // Seed subraces
    const subracesToInsert = subracesData.map(sr => ({
      name: sr.name,
      subraceID: sr.raceId, // Mapped from camelCase raceId
      mainrace: [
        {
          raceID: sr.race // The parent race identifier
        }
      ],
      description: sr.description,
      speed: sr.speed,
      abilityScoreModifiers: sr.abilityScoreModifiers || {},
      size: sr.size || 'M',
      languages: sr.languages || [],
      traits: sr.traits || [],
      choices: sr.choices || {}
    }));

    await SubRace.insertMany(subracesToInsert);
    console.log(`✓ Inserted ${subracesToInsert.length} subraces`);

    console.log('✓ Seeding Complete');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seedRaces();