/**
 * Seed script: Extract items from class and background baseEquipment and choices
 * Then upsert them into the items database before the main seedItems script runs
 * Run: node server/scripts/seedEquipmentItems.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const classesData = require('../data/gameFiles/class/classes.json');
const backgroundsData = require('../data/gameFiles/background/background.json');
const Item = require('../data/mongooseDataStructure/item');

const MONGO_URI = process.env.MONGO_URI;

// Helper to convert camelCase to Title Case
const toTitleCase = (str) => {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .replace(/:\d+$/, '') // Remove quantity suffix if present
    .trim();
};

async function seedEquipmentItems() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
    });
    console.log('✓ Connected to MongoDB');

    const uniqueItems = new Set();

    // Extract items from classes
    console.log('Extracting items from classes...');
    for (const className in classesData) {
      const classData = classesData[className];
      
      // Extract from baseEquipment (format: "itemId:quantity")
      if (Array.isArray(classData.baseEquipment)) {
        classData.baseEquipment.forEach(equipmentStr => {
          const itemId = equipmentStr.split(':')[0];
          uniqueItems.add(itemId);
        });
      }

      // Extract from equipment choices
      if (classData.choices?.equipment) {
        for (const choiceKey in classData.choices.equipment) {
          const choiceOptions = classData.choices.equipment[choiceKey];
          for (const optionKey in choiceOptions) {
            const items = choiceOptions[optionKey];
            for (const itemId in items) {
              // Skip "any" items as they're selections, not actual items
              if (!itemId.toLowerCase().startsWith('any')) {
                uniqueItems.add(itemId);
              }
            }
          }
        }
      }
    }
    console.log(`✓ Found ${uniqueItems.size} unique items in classes`);

    // Extract items from backgrounds
    console.log('Extracting items from backgrounds...');
    if (Array.isArray(backgroundsData)) {
      backgroundsData.forEach(background => {
        // Extract from baseEquipment (flat array of itemIds)
        if (Array.isArray(background.baseEquipment)) {
          background.baseEquipment.forEach(itemId => {
            uniqueItems.add(itemId);
          });
        }

        // Extract from equipment choices
        if (background.choices?.equipment) {
          for (const choiceKey in background.choices.equipment) {
            const choiceOptions = background.choices.equipment[choiceKey];
            for (const optionKey in choiceOptions) {
              const items = choiceOptions[optionKey];
              for (const itemId in items) {
                // Skip "any" items
                if (!itemId.toLowerCase().startsWith('any')) {
                  uniqueItems.add(itemId);
                }
              }
            }
          }
        }
      });
    }
    console.log(`✓ Found total of ${uniqueItems.size} unique items across classes and backgrounds`);

    // Prepare bulk operations to upsert items
    console.log('Preparing items for database...');
    const bulkOps = Array.from(uniqueItems).map(itemId => {
      return {
        updateOne: {
          filter: { itemId: itemId },
          update: {
            $set: {
              itemId: itemId,
              name: toTitleCase(itemId),
              description: `Equipment from character creation classes and backgrounds`,
              rarity: 'common',
              weight: 0,
              cost: 0,
              attributes: [],
              properties: {}
            }
          },
          upsert: true
        }
      };
    });

    console.log(`\nUpserting ${bulkOps.length} items into database...`);
    const result = await Item.bulkWrite(bulkOps);

    console.log('✓ Bulk write completed');
    console.log(`  - Matched: ${result.matchedCount}`);
    console.log(`  - Upserted: ${result.upsertedCount}`);
    console.log(`  - Modified: ${result.modifiedCount}`);

    console.log('\n✓ Equipment items seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error seeding equipment items:', error);
    process.exit(1);
  }
}

seedEquipmentItems();
