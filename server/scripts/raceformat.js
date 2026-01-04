const fs = require('fs');
const path = require('path');

const racesData = require('../data/gameFiles/race/races_formatted.json');

function splitRacesAndSubraces() {
    const mainRaces = [];
    const subraces = [];
    
    // First pass: identify all main races
    const mainRaceIds = new Set();
    
    for (const race of racesData) {
        const raceId = race.race_id;
        
        // Half-elf and variants are subraces of elf
        if (raceId === 'halfelf' || raceId.startsWith('halfelf_')) {
            mainRaceIds.add('elf');
        }
        // Half-orc and variants are subraces of orc
        else if (raceId === 'halforc' || raceId.startsWith('halforc_')) {
            mainRaceIds.add('orc');
        }
        // Check if this is a subrace (has underscore indicating variant)
        else if (raceId.includes('_')) {
            const parts = raceId.split('_');
            const mainRaceId = parts[0];
            mainRaceIds.add(mainRaceId);
        } else {
            // This is already a main race
            mainRaceIds.add(raceId);
        }
    }
    
    // Second pass: process each race
    for (const race of racesData) {
        const raceId = race.race_id;
        
        // Half-elf and all variants are subraces of elf
        if (raceId === 'halfelf' || raceId.startsWith('halfelf_')) {
            subraces.push({
                ...race,
                race: 'elf'
            });
        }
        // Half-orc and all variants are subraces of orc
        else if (raceId === 'halforc' || raceId.startsWith('halforc_')) {
            subraces.push({
                ...race,
                race: 'orc'
            });
        }
        // Regular subrace handling
        else if (raceId.includes('_')) {
            const parts = raceId.split('_');
            const mainRaceId = parts[0];
            
            subraces.push({
                ...race,
                race: mainRaceId
            });
        } else {
            // This is a main race
            mainRaces.push({
                ...race,
                subraces: []
            });
        }
    }
    
    // Third pass: populate subrace arrays in main races
    for (const mainRace of mainRaces) {
        const matchingSubraces = subraces
            .filter(subrace => subrace.race === mainRace.race_id)
            .map(subrace => subrace.race_id);
        
        mainRace.subraces = matchingSubraces;
    }
    
    // Fourth pass: Add main races that only exist as subraces
    for (const mainRaceId of mainRaceIds) {
        const exists = mainRaces.some(r => r.race_id === mainRaceId);
        
        if (!exists) {
            // Find a subrace to extract basic info from
            const sampleSubrace = subraces.find(s => s.race === mainRaceId);
            
            if (sampleSubrace) {
                let baseName = sampleSubrace.name.split('(')[0].trim();
                
                const matchingSubraces = subraces
                    .filter(s => s.race === mainRaceId)
                    .map(s => s.race_id);
                
                mainRaces.push({
                    name: baseName,
                    race_id: mainRaceId,
                    description: `A ${baseName} with various subraces and variants.`,
                    speed: sampleSubrace.speed,
                    ability_score_modifiers: {},
                    size: sampleSubrace.size,
                    languages: [],
                    traits: [],
                    choices: {},
                    subraces: matchingSubraces
                });
            }
        }
    }
    
    return { mainRaces, subraces };
}

const { mainRaces, subraces } = splitRacesAndSubraces();

// Write main races to file
const mainRacesPath = path.join(__dirname, '../data/gameFiles/race/main_races.json');
fs.writeFileSync(mainRacesPath, JSON.stringify(mainRaces, null, 2), 'utf8');

// Write subraces to file
const subracesPath = path.join(__dirname, '../data/gameFiles/race/subraces.json');
fs.writeFileSync(subracesPath, JSON.stringify(subraces, null, 2), 'utf8');

console.log('Successfully split races into main races and subraces!');
console.log(`Main races: ${mainRaces.length}`);
console.log(`Subraces: ${subraces.length}`);
console.log(`\nFiles created:`);
console.log(`- ${mainRacesPath}`);
console.log(`- ${subracesPath}`);

// Log some examples for verification
console.log('\nExample main races with subraces:');
const exampleRaces = ['elf', 'orc', 'dwarf', 'human'];
for (const raceId of exampleRaces) {
    const race = mainRaces.find(r => r.race_id === raceId);
    if (race) {
        console.log(`\n${race.name} (${race.race_id}):`);
        console.log(`  Subraces (${race.subraces.length}): ${race.subraces.slice(0, 5).join(', ')}${race.subraces.length > 5 ? '...' : ''}`);
    }
}