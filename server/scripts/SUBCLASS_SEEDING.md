# Subclass Database Seeding Guide

## Overview
This guide explains how to seed subclass data into MongoDB for the D&D game system.

## Prerequisites
- MongoDB running locally on `mongodb://localhost:27017`
- Database name: `d-and-d-game`
- Node.js installed

## Files Involved

### 1. **Mongoose Schema** (`server/data/mongooseDataStructure/subclass.js`)
Defines the structure for subclass documents in MongoDB:
- `name`: Subclass name (e.g., "Path of Wrath")
- `classID`: Unique identifier (e.g., "pathOfWrath")
- `description`: Subclass description
- `parentClass`: Parent class name (e.g., "Barbarian")
- `featuresByLevel`: Map of features by level (ready for future population)

### 2. **Database Query Handler** (`server/api/database_query.js`)
Updated to support subclasses collection with operations:
- `findAll`: Fetch all subclasses
- `findOne`: Find specific subclass
- `findById`: Find by MongoDB ID
- `count`: Count subclasses
- `distinct`: Get unique field values

### 3. **Seeding Script** (`server/scripts/seedSubclasses.js`)
Automatically seeds 88 subclasses from `server/data/gameFiles/class/subclasses.json`

## How to Run

### Option 1: Direct Node Command
```bash
cd c:\Projects\server
node scripts/seedSubclasses.js
```

### Option 2: From NPM Scripts (if configured)
Add to `package.json`:
```json
{
  "scripts": {
    "seed:subclasses": "node scripts/seedSubclasses.js"
  }
}
```

Then run:
```bash
npm run seed:subclasses
```

## What Gets Seeded

The script seeds **88 subclasses** across 12 classes:
- **Barbarian**: 7 subclasses (Path of Wrath, Path of Madness, etc.)
- **Bard**: 7 subclasses (Rush E, Beethoven's Symphony, etc.)
- **Cleric**: 8 subclasses (Mandate of Heaven, Domain of Communion, etc.)
- **Druid**: 5 subclasses (Fruit of the Land, Fruit of Spores, etc.)
- **Fighter**: 7 subclasses (Legacy of the Great Khan, etc.)
- **Monk**: 7 subclasses (Way of the Stoic, Way of the Buddha, etc.)
- **Paladin**: 5 subclasses (Sacred Oath, Oath of Devotion, etc.)
- **Ranger**: 5 subclasses (Mark of the Hunter, Mark of the Tracker, etc.)
- **Rogue**: 8 subclasses (Assassin, Ripper, Ninja, Spy, etc.)
- **Sorcerer**: 8 subclasses (Blood of Inferna, Blood of Tempestas, etc.)
- **Warlock**: 5 subclasses (Temptation of Love, Temptation of Thought, etc.)
- **Wizard**: 8 subclasses (School of Elements, School of Arcane, etc.)

## Frontend Usage

The subclass data is accessible via the database_query API:

```javascript
socket.emit('database_query', {
    collection: 'subclasses',
    operation: 'findAll'
}, (response) => {
    if (response.success) {
        console.log('Subclasses:', response.data);
    }
});
```

### Filtering by Class
To get subclasses for a specific class:

```javascript
socket.emit('database_query', {
    collection: 'subclasses',
    operation: 'findAll',
    filter: { parentClass: 'Barbarian' }
}, (response) => {
    if (response.success) {
        console.log('Barbarian subclasses:', response.data);
    }
});
```

## Integration with Class.jsx

The Class.jsx component automatically:
1. Fetches all subclasses on mount
2. Filters subclasses by selected class
3. Displays them in a dropdown
4. Shows features when subclass features are populated

## Next Steps

1. **Run the seed script** to populate MongoDB with subclass data
2. **Start the server** and verify data loads correctly
3. **Select a class** in character creation to see available subclasses
4. **Populate subclass features** in `subclasses.json` once feature data is ready
5. **Re-run seed script** to update features in database

## Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running: `mongod`
- Check connection string in `seedSubclasses.js`
- Verify database exists: `d-and-d-game`

### No Subclasses Appearing
- Run the seed script: `node scripts/seedSubclasses.js`
- Check MongoDB collections: `db.subclasses.find()`
- Verify API handler includes Subclass model

### Features Not Showing
- Features are empty by default in `subclasses.json`
- Once features are added, re-run the seed script
- Features will display in Class.jsx when `featuresByLevel` is populated

## Data Structure Example

```javascript
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Path of Wrath",
  "classID": "pathOfWrath",
  "description": "A barbarian subclass focusing on pure destructive power and combat fury",
  "parentClass": "Barbarian",
  "featuresByLevel": {},  // Will be populated with { "level1": ["featureId1"], ... }
  "createdAt": "2026-01-24T12:00:00.000Z"
}
```

## Related Files
- Subclass JSON data: `server/data/gameFiles/class/subclasses.json`
- Class features data: `server/data/gameFiles/class/classfeatures.js`
- Class schema: `server/data/mongooseDataStructure/class.js`
- Database query API: `server/api/database_query.js`
