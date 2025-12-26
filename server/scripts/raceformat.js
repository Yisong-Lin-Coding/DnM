const fs = require('fs');
const path = require('path');

const racesData = require('../data/gameFiles/race/race.json');

// Convert string to snake_case
function toSnakeCase(str) {
    return str
        .replace(/\s+/g, '_')           // Replace spaces with underscores
        .replace(/[()]/g, '')            // Remove parentheses
        .replace(/([a-z])([A-Z])/g, '$1_$2')  // Add underscore between camelCase
        .replace(/[^\w_]/g, '')          // Remove non-word characters except underscore
        .toLowerCase();
}

function parseAbilityScores(abilityString) {
    if (!abilityString) return {};
    
    const modifiers = {};
    const parts = abilityString.split(',').map(s => s.trim());
    
    for (const part of parts) {
        // Handle formats like "Str 2", "Dex 1", "Choose 2 1"
        const match = part.match(/(\w+)\s+([+-]?\d+)/);
        if (match) {
            const [, stat, value] = match;
            const statSnake = toSnakeCase(stat);
            modifiers[statSnake] = parseInt(value);
        }
    }
    
    return modifiers;
}

function extractLanguages(traits) {
    const languages = [];
    
    for (const trait of traits) {
        if (trait.name === 'Languages' || trait.name === 'Language') {
            // Extract language names from text
            const text = trait.text.join(' ');
            
            // Common patterns: "Common", "Elvish", "Dwarvish", etc.
            const commonLangs = ['Common', 'Elvish', 'Dwarvish', 'Halfling', 'Gnomish', 
                               'Draconic', 'Orc', 'Giant', 'Goblin', 'Infernal', 'Abyssal',
                               'Celestial', 'Primordial', 'Sylvan', 'Undercommon', 'Auran',
                               'Vedalken', 'Merfolk', 'Vampire'];
            
            for (const lang of commonLangs) {
                if (text.includes(lang)) {
                    languages.push(toSnakeCase(lang));
                }
            }
        }
    }
    
    return [...new Set(languages)]; // Remove duplicates
}

function extractTraitNames(traits) {
    return traits
        .filter(t => t.name !== 'Languages' && t.name !== 'Language' && t.name !== 'Ability Score Increase')
        .map(t => toSnakeCase(t.name));
}

function extractChoices(race) {
    const choices = {};
    
    // Check for ability score choices
    if (race.ability && (race.ability.includes('Choose') || race.ability.includes('choice'))) {
        choices.ability_scores = race.ability;
    }
    
    // Check for skill/proficiency choices in traits
    for (const trait of race.trait) {
        if (trait.name.includes('Variant') || trait.name.includes('Choose')) {
            if (!choices.traits) choices.traits = [];
            choices.traits.push({
                name: toSnakeCase(trait.name),
                description: trait.text.join(' ')
            });
        }
    }
    
    // Check for proficiency that indicates choice
    if (race.proficiency && race.proficiency.includes(',')) {
        choices.proficiencies = race.proficiency.split(',').map(p => toSnakeCase(p.trim()));
    }
    
    return Object.keys(choices).length > 0 ? choices : {};
}

function generateRaceID(name) {
    return toSnakeCase(name);
}

function reformatRacesForSchema() {
    const reformatted = [];

    for (const race of racesData) {
        const raceID = generateRaceID(race.name);
        
        // Extract description from first trait or use source
        let description = race.source || 'A playable race';
        if (race.trait && race.trait.length > 0 && race.trait[0].text) {
            const firstText = race.trait[0].text[0];
            if (firstText && firstText.length > 50) {
                description = firstText.substring(0, 200) + '...';
            }
        }

        reformatted.push({
            name: race.name,
            race_id: raceID,
            description: description,
            speed: parseInt(race.speed) || 30,
            ability_score_modifiers: parseAbilityScores(race.ability),
            size: race.size || 'M',
            languages: extractLanguages(race.trait),
            traits: extractTraitNames(race.trait),
            choices: extractChoices(race)
        });
    }

    return reformatted;
}

const reformattedRaces = reformatRacesForSchema();

// Write to a new JSON file
const filePath = path.join(__dirname, '../data/gameFiles/race/races_formatted.json');
fs.writeFileSync(filePath, JSON.stringify(reformattedRaces, null, 2), 'utf8');

console.log('Successfully reformatted races data to snake_case!');
console.log(`Processed ${reformattedRaces.length} races`);
console.log(`Output saved to: ${filePath}`);
