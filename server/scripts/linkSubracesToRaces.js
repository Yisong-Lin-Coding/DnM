/**
 * Script: Link Subraces to Races in MongoDB
 *
 * Purpose:
 *  - For each Race document, populate the `subraces` array with entries derived
 *    from SubRace documents that reference it via `mainrace`.
 *  - This ensures Race documents have consistent `subraces: [{ name, subraceID }]`.
 *
 * How it works:
 *  - Loads all Races and SubRaces from MongoDB
 *  - For each Race, finds SubRaces whose `mainrace` includes a match on either
 *    `raceID` or `name`
 *  - Sets Race.subraces to the computed array (avoiding duplicates)
 *  - Saves only modified Race documents
 *
 * Run:
 *  node server/scripts/linkSubracesToRaces.js
 *
 * Requirements:
 *  - process.env.MONGO_URI must be set
 */

require('dotenv').config();
const mongoose = require('mongoose');

const Race = require('../data/mongooseDataStructure/race');
const SubRace = require('../data/mongooseDataStructure/subrace');

const MONGO_URI = process.env.MONGO_URI;

(async function linkSubracesToRaces() {
  if (!MONGO_URI) {
    console.error('Error: MONGO_URI not set in environment.');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 30000 });
    console.log('✓ Connected to MongoDB');

    const [races, subraces] = await Promise.all([
      Race.find({}).lean(false),
      SubRace.find({}).lean(true),
    ]);

    console.log(`Loaded ${races.length} races and ${subraces.length} subraces.`);

    // Normalize helpers
    const norm = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

    let modifiedCount = 0;

    for (const race of races) {
      const raceIdNorm = norm(race.raceID);
      const raceNameNorm = norm(race.name);

      const subracesForRace = subraces.filter((sr) => {
        if (!Array.isArray(sr.mainrace)) return false;
        return sr.mainrace.some((mr) => {
          const mrIdNorm = norm(mr && mr.raceID);
          const mrNameNorm = norm(mr && mr.name);
          return (mrIdNorm && mrIdNorm === raceIdNorm) || (mrNameNorm && mrNameNorm === raceNameNorm);
        });
      });

      const newSubraceEntries = subracesForRace.map((sr) => ({
        name: sr.name,
        subraceID: sr.subraceID,
      }));

      // Compare with existing to avoid unnecessary writes
      const current = Array.isArray(race.subraces) ? race.subraces : [];

      const sameLength = current.length === newSubraceEntries.length;
      const sameEntries = sameLength && current.every((c) => newSubraceEntries.some((n) => n.name === c.name && n.subraceID === c.subraceID));

      if (!sameEntries) {
        race.subraces = newSubraceEntries;
        await race.save();
        modifiedCount++;
        console.log(`Updated race: ${race.name} (${race.raceID}) with ${newSubraceEntries.length} subraces.`);
      }
    }

    console.log(`\nDone. Modified ${modifiedCount} race documents.`);

    await mongoose.connection.close();
    console.log('✓ Connection closed');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    try {
      await mongoose.connection.close();
    } catch (_) {}
    process.exit(1);
  }
})();
