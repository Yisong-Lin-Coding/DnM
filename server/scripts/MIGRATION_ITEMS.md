# Items Database Migration

This document explains the items migration from JSON to MongoDB.

## What Changed

- **Old**: Items stored in `server/data/gameFiles/item/items.json` (static JSON)
- **New**: Items stored in MongoDB collection `items` (dynamic, queryable)

## Files

- `server/scripts/seedItems.js` — Seed script: migrates items.json → MongoDB
- `server/handlers/itemLoader.js` — Runtime loader: caches items from DB in memory
- `server/api/playerData_getCharacter.js` — Character retrieval (unchanged)
- `server/data/mongooseDataStructure/item.js` — Item schema

## How to Migrate

### 1. Run the seed script

```bash
cd server
node scripts/seedItems.js
```

This will:
- Connect to MongoDB
- Clear any existing items
- Transform and insert all items from `items.json`
- Cache them in memory

### 2. Verify

Check MongoDB directly or the server logs should show:
```
✓ Successfully seeded XXX items into database
✓ Loaded XXX items
```

### 3. Optional: Remove old files

Once seeded and tested, you can remove:
- `server/data/gameFiles/item/items.json` (kept for reference, but not used)

## Using Items in Code

```javascript
const { getItemById, getAllItems, searchItems } = require('../handlers/itemLoader');

// Get single item by ID
const sword = getItemById('longsword_001');

// Get all items
const allItems = getAllItems();

// Search items
const daggers = searchItems('dagger');
```

## Future: Classes, Races, Effects

Same pattern:
1. Create seed scripts for each
2. Create loaders with caching
3. Remove static JSON files after migration

This keeps the codebase clean and enables live balance updates.
