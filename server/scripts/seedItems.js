require('dotenv').config();
const mongoose = require('mongoose');
const itemsData = require('../data/gameFiles/item/items2.json');
const Item = require('../data/mongooseDataStructure/item');

const MONGO_URI = process.env.MONGO_URI;

async function seedItems() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
    });
    console.log('✓ Connected to MongoDB');

    console.log('Transforming items...');

    const bulkOps = itemsData.items.map(item => {
      const properties = {};

      if (item.properties) {
        for (const [key, value] of Object.entries(item.properties)) {
          properties[key] = JSON.stringify(value);
        }
      }

      if (item.type) {
        properties.type = item.type;
      }

      return {
        updateOne: {
          filter: { itemId: item.id }, // 👈 MATCH BY ID
          update: {
            $set: {
              name: item.name,
              description: item.description,
              rarity: item.rarity || 'common',
              weight: item.weight || 0,
              cost: item.cost || 0,
              attributes: item.attributes || [],
              properties: properties,
            }
          },
          upsert: true // 👈 INSERT IF MISSING
        }
      };
    });

    const result = await Item.bulkWrite(bulkOps);
    console.log('✓ Items upserted successfully');
    console.log({
      inserted: result.upsertedCount,
      modified: result.modifiedCount
    });

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
