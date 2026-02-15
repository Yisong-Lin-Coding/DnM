const fs = require('fs');
const path = require('path');

// Paths to your files
const filesToProcess = [
    path.join(__dirname, '../data/gameFiles/race/main_races.json'),
    path.join(__dirname, '../data/gameFiles/race/subraces.json')
];

/**
 * Converts a snake_case string to camelCase
 */
const toCamel = (str) => {
    return str.replace(/([-_][a-z])/ig, ($1) => {
        return $1.toUpperCase()
            .replace('-', '')
            .replace('_', '');
    });
};

/**
 * Recursively processes objects and arrays
 */
function processValue(value, keyContext = '') {
    // 1. Handle Arrays
    if (Array.isArray(value)) {
        return value.map(item => {
            // Convert strings inside traits, subraces, or languages arrays
            if (typeof item === 'string' && ['traits', 'subraces', 'languages', 'subraceID'].includes(keyContext)) {
                return toCamel(item);
            }
            return processValue(item, keyContext);
        });
    }

    // 2. Handle Objects
    if (value !== null && typeof value === 'object') {
        const newNode = {};
        for (const key in value) {
            const camelKey = toCamel(key);
            // We pass the key as context so we know if the value (if it's a string) needs converting
            newNode[camelKey] = processValue(value[key], camelKey);
        }
        return newNode;
    }

    // 3. Handle Strings (Specific IDs only)
    if (typeof value === 'string') {
        const idFields = ['raceId', 'raceID', 'subraceId', 'subraceID', 'race'];
        if (idFields.includes(keyContext)) {
            return toCamel(value);
        }
    }

    return value;
}

function runConversion() {
    filesToProcess.forEach(filePath => {
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️ File not found: ${filePath}`);
            return;
        }

        try {
            const rawData = fs.readFileSync(filePath, 'utf8');
            const jsonData = JSON.parse(rawData);
            
            const processedData = processValue(jsonData);

            fs.writeFileSync(filePath, JSON.stringify(processedData, null, 2), 'utf8');
            console.log(`✅ Successfully overwritten: ${path.basename(filePath)}`);
        } catch (error) {
            console.error(`❌ Error processing ${filePath}:`, error.message);
        }
    });
}

runConversion();