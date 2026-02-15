/**
 * Template Generator Script - Standalone
 * 
 * Scans MongoDB collections and generates template files for:
 * - Traits (from races/subraces)
 * - Features (from classes/subclasses)
 * - Enchantments (from items)
 * 
 * Run: node generateTemplates.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

// Import your Mongoose models
const Race = require('../../data/mongooseDataStructure/race');
const Subrace = require('../../data/mongooseDataStructure/subrace');
const Class = require('../../data/mongooseDataStructure/class');
const Subclass = require('../../data/mongooseDataStructure/subclass');
const Item = require('../../data/mongooseDataStructure/item');

const MONGO_URI = process.env.MONGO_URI;

// ==================================================
// TODO: SET OUTPUT PATHS FOR TEMPLATE FILES
// ==================================================
const OUTPUT_PATHS = {
    traits: '../server/data/gameFiles/modifiers/traits.json',
    features: '../server/data/gameFiles/modifiers/features.json',
    enchantments: '../server/data/gameFiles/modifiers/enchantments.json',
    
    // Alternative: Individual files
    // traits: './data/templates/traits',        // Directory
    // features: './data/templates/features',    // Directory
    // enchantments: './data/templates/enchantments' // Directory
};

// Set to true to generate individual files instead of single JSON
const USE_INDIVIDUAL_FILES = false;

/**
 * Ensure directory exists
 */
async function ensureDirectory(filePath) {
    const dir = path.dirname(filePath);
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
}

/**
 * Format ID to readable name
 * Example: "draconicAncestry" -> "Draconic Ancestry"
 */
function formatName(id) {
    return id
        // Split on capital letters
        .replace(/([A-Z])/g, ' $1')
        // Split on underscores
        .replace(/_/g, ' ')
        // Capitalize first letter of each word
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .trim();
}

/**
 * Scan all races and subraces for trait IDs
 */
async function scanTraits() {
    console.log('Scanning races and subraces for traits...');
    
    const traitIds = new Set();
    
    try {
        // Get all races
        const races = await Race.find({}).lean();
        
        races.forEach(race => {
            if (race.traits && Array.isArray(race.traits)) {
                race.traits.forEach(traitId => traitIds.add(traitId));
            }
        });
        
        // Get all subraces
        const subraces = await Subrace.find({}).lean();
        
        subraces.forEach(subrace => {
            if (subrace.traits && Array.isArray(subrace.traits)) {
                subrace.traits.forEach(traitId => traitIds.add(traitId));
            }
        });
        
        console.log(`✓ Found ${traitIds.size} unique traits`);
        return Array.from(traitIds).sort();
        
    } catch (error) {
        console.error('Error scanning traits:', error);
        return [];
    }
}

/**
 * Scan all classes and subclasses for feature IDs
 */
async function scanFeatures() {
    console.log('Scanning classes and subclasses for features...');
    
    const featureIds = new Set();
    
    try {
        // Get all classes
        const classes = await Class.find({}).lean();
        
        classes.forEach(classData => {
            if (classData.featuresByLevel && typeof classData.featuresByLevel === 'object') {
                for (const level in classData.featuresByLevel) {
                    const features = classData.featuresByLevel[level];
                    if (Array.isArray(features)) {
                        features.forEach(featureId => featureIds.add(featureId));
                    }
                }
            }
        });
        
        // Get all subclasses
        const subclasses = await Subclass.find({}).lean();
        
        subclasses.forEach(subclass => {
            if (subclass.featuresByLevel && typeof subclass.featuresByLevel === 'object') {
                for (const level in subclass.featuresByLevel) {
                    const features = subclass.featuresByLevel[level];
                    if (Array.isArray(features)) {
                        features.forEach(featureId => featureIds.add(featureId));
                    }
                }
            }
        });
        
        console.log(`✓ Found ${featureIds.size} unique features`);
        return Array.from(featureIds).sort();
        
    } catch (error) {
        console.error('Error scanning features:', error);
        return [];
    }
}

/**
 * Scan all items for enchantment IDs
 */
async function scanEnchantments() {
    console.log('Scanning items for enchantments...');
    
    const enchantmentIds = new Set();
    
    try {
        // Get all items
        const items = await Item.find({}).lean();
        
        items.forEach(item => {
            if (item.enchantments && Array.isArray(item.enchantments)) {
                item.enchantments.forEach(enchantmentId => enchantmentIds.add(enchantmentId));
            }
        });
        
        console.log(`✓ Found ${enchantmentIds.size} unique enchantments`);
        return Array.from(enchantmentIds).sort();
        
    } catch (error) {
        console.error('Error scanning enchantments:', error);
        return [];
    }
}

/**
 * Generate trait templates
 */
async function generateTraitTemplates(traitIds, useIndividualFiles) {
    console.log(`Generating templates for ${traitIds.length} traits...`);
    
    const templates = traitIds.map(traitId => ({
        _id: traitId,
        name: formatName(traitId),
        description: `[TODO: Add description for ${traitId}]`,
        modifiers: [
            {
                name: `${formatName(traitId)} Modifier`,
                hook: "onStatCalc_STR", // TODO: Change to appropriate hook
                priority: 50,
                action: "(context) => { /* TODO: Implement */ }"
            }
        ]
    }));
    
    if (useIndividualFiles) {
        // Create directory and individual files
        await fs.mkdir(OUTPUT_PATHS.traits, { recursive: true });
        
        for (const template of templates) {
            await fs.writeFile(
                path.join(OUTPUT_PATHS.traits, `${template._id}.json`),
                JSON.stringify(template, null, 2),
                'utf8'
            );
        }
        console.log(`✓ Trait templates written to ${OUTPUT_PATHS.traits}/`);
    } else {
        // Single JSON file
        await ensureDirectory(OUTPUT_PATHS.traits);
        await fs.writeFile(
            OUTPUT_PATHS.traits,
            JSON.stringify(templates, null, 2),
            'utf8'
        );
        console.log(`✓ Trait templates written to ${OUTPUT_PATHS.traits}`);
    }
}

/**
 * Generate feature templates
 */
async function generateFeatureTemplates(featureIds, useIndividualFiles) {
    console.log(`Generating templates for ${featureIds.length} features...`);
    
    const templates = featureIds.map(featureId => ({
        _id: featureId,
        name: formatName(featureId),
        description: `[TODO: Add description for ${featureId}]`,
        modifiers: [
            {
                name: `${formatName(featureId)} Modifier`,
                hook: "onStatCalc_STR", // TODO: Change to appropriate hook
                priority: 50,
                action: "(context) => { /* TODO: Implement */ }"
            }
        ]
    }));
    
    if (useIndividualFiles) {
        // Create directory and individual files
        await fs.mkdir(OUTPUT_PATHS.features, { recursive: true });
        
        for (const template of templates) {
            await fs.writeFile(
                path.join(OUTPUT_PATHS.features, `${template._id}.json`),
                JSON.stringify(template, null, 2),
                'utf8'
            );
        }
        console.log(`✓ Feature templates written to ${OUTPUT_PATHS.features}/`);
    } else {
        // Single JSON file
        await ensureDirectory(OUTPUT_PATHS.features);
        await fs.writeFile(
            OUTPUT_PATHS.features,
            JSON.stringify(templates, null, 2),
            'utf8'
        );
        console.log(`✓ Feature templates written to ${OUTPUT_PATHS.features}`);
    }
}

/**
 * Generate enchantment templates
 */
async function generateEnchantmentTemplates(enchantmentIds, useIndividualFiles) {
    console.log(`Generating templates for ${enchantmentIds.length} enchantments...`);
    
    const templates = enchantmentIds.map(enchantmentId => ({
        _id: enchantmentId,
        name: formatName(enchantmentId),
        description: `[TODO: Add description for ${enchantmentId}]`,
        modifiers: [
            {
                name: `${formatName(enchantmentId)} Modifier`,
                hook: "onStatCalc_STR", // TODO: Change to appropriate hook
                priority: 50,
                action: "(context) => { /* TODO: Implement */ }"
            }
        ]
    }));
    
    if (useIndividualFiles) {
        // Create directory and individual files
        await fs.mkdir(OUTPUT_PATHS.enchantments, { recursive: true });
        
        for (const template of templates) {
            await fs.writeFile(
                path.join(OUTPUT_PATHS.enchantments, `${template._id}.json`),
                JSON.stringify(template, null, 2),
                'utf8'
            );
        }
        console.log(`✓ Enchantment templates written to ${OUTPUT_PATHS.enchantments}/`);
    } else {
        // Single JSON file
        await ensureDirectory(OUTPUT_PATHS.enchantments);
        await fs.writeFile(
            OUTPUT_PATHS.enchantments,
            JSON.stringify(templates, null, 2),
            'utf8'
        );
        console.log(`✓ Enchantment templates written to ${OUTPUT_PATHS.enchantments}`);
    }
}

/**
 * Main function
 */
async function generateAllTemplates() {
    try {
        console.log('='.repeat(50));
        console.log('Starting Template Generation');
        console.log('='.repeat(50));
        
        // Connect to MongoDB
        console.log('\nConnecting to MongoDB...');
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 30000,
        });
        console.log('✓ Connected to MongoDB\n');

        // Scan MongoDB for all IDs
        const [traitIds, featureIds, enchantmentIds] = await Promise.all([
            scanTraits(),
            scanFeatures(),
            scanEnchantments()
        ]);
        
        console.log('\n' + '='.repeat(50));
        console.log('Summary:');
        console.log(`  Traits:       ${traitIds.length}`);
        console.log(`  Features:     ${featureIds.length}`);
        console.log(`  Enchantments: ${enchantmentIds.length}`);
        console.log('='.repeat(50) + '\n');
        
        // Generate template files
        await Promise.all([
            generateTraitTemplates(traitIds, USE_INDIVIDUAL_FILES),
            generateFeatureTemplates(featureIds, USE_INDIVIDUAL_FILES),
            generateEnchantmentTemplates(enchantmentIds, USE_INDIVIDUAL_FILES)
        ]);
        
        console.log('\n' + '='.repeat(50));
        console.log('Template Generation Complete!');
        console.log('='.repeat(50));
        console.log('\nOutput format:', USE_INDIVIDUAL_FILES ? 'Individual files' : 'Single JSON files');
        console.log('\nNext steps:');
        console.log('1. Review the generated template files');
        console.log('2. Fill in descriptions and proper hooks');
        console.log('3. Implement the modifier actions');
        console.log('4. Move files to your server data directory');
        console.log('\nTemplate locations:');
        console.log(`  Traits:       ${OUTPUT_PATHS.traits}`);
        console.log(`  Features:     ${OUTPUT_PATHS.features}`);
        console.log(`  Enchantments: ${OUTPUT_PATHS.enchantments}`);
        
        await mongoose.disconnect();
        console.log('\n✓ Disconnected from MongoDB');
        process.exit(0);
        
    } catch (error) {
        console.error('\n✗ Error generating templates:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the script
generateAllTemplates();