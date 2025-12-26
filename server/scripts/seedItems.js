require('dotenv').config();
const mongoose = require('mongoose');
const itemsData = require('../data/gameFiles/item/items.json');
const Item = require('../data/mongooseDataStructure/item');

const MONGO_URI = process.env.MONGO_URI;

async function seedItems() {
  try {
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
    });
    
    console.log('✓ Connected to MongoDB');

    console.log('Transforming and seeding items...');
    const itemsToInsert = itemsData.items.map(item => {
      const properties = {};
      
      // Handle properties that exist in the item
      if (item.properties) {
        // Store each property from the properties object
        for (const [key, value] of Object.entries(item.properties)) {
          properties[key] = JSON.stringify(value);
        }
      }
      
      // Add type to properties if it exists
      if (item.type) {
        properties.type = item.type;
      }

      return {
        name: item.name,
        itemId: item.id,
        description: item.description,
        rarity: item.rarity || 'common',
        weight: item.weight || 0,
        cost: item.cost || 0,
        attributes: item.attributes || [],
        properties: properties,
      };
    });

    // Clear existing items (optional)
    await Item.deleteMany({});
    console.log('✓ Cleared existing items');

    const result = await Item.insertMany(itemsToInsert);
    console.log(`✓ Successfully seeded ${result.length} items into database`);

    await mongoose.connection.close();
    console.log('✓ Connection closed');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedItems();