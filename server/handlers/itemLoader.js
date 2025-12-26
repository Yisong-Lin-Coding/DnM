/**
 * Item loader: Load items from MongoDB
 * Called at server startup to populate game with items
 */

const Item = require('../data/mongooseDataStructure/item');

let itemCache = new Map();

/**
 * Load all items from database into memory cache
 */
async function loadItems() {
  try {
    console.log('Loading items from database...');
    const items = await Item.find({});
    itemCache.clear();
    items.forEach(item => {
      itemCache.set(item.itemId, item);
    });
    console.log(`✓ Loaded ${items.length} items`);
    return items;
  } catch (err) {
    console.error('Error loading items:', err);
    return [];
  }
}

/**
 * Get item by ID from cache
 */
function getItemById(itemId) {
  return itemCache.get(itemId);
}

/**
 * Get all items
 */
function getAllItems() {
  return Array.from(itemCache.values());
}

/**
 * Search items by name or tag
 */
function searchItems(query) {
  const q = query.toLowerCase();
  return Array.from(itemCache.values()).filter(item =>
    item.name.toLowerCase().includes(q) ||
    item.tags.some(tag => tag.toLowerCase().includes(q))
  );
}

/**
 * Create item instance (if you need runtime item objects)
 */
function createItemInstance(itemId, overrides = {}) {
  const baseItem = getItemById(itemId);
  if (!baseItem) return null;
  return { ...baseItem.toObject(), ...overrides };
}

module.exports = {
  loadItems,
  getItemById,
  getAllItems,
  searchItems,
  createItemInstance,
};
