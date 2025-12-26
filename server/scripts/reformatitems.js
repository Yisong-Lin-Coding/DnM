const fs = require('fs');
const path = require('path');

const itemsPage = require('../data/gameFiles/item/items.json');
const items = itemsPage['items'] || [];

function reformatItems(items, safekeys = ["id", "name", "description", "type", "rarity", "weight", "cost", "attributes"]) {
    const formattedItems = [];

    for (const item of items) {
        const formattedItem = {};
        
        // First, copy the safe keys to the top level
        for (const key of safekeys) {
            if (item[key] !== null && item[key] !== undefined) {
                formattedItem[key] = item[key];
            } else {
                formattedItem[key] = '';
            }
        }
        
        // Then, move all other keys into a properties object
        formattedItem.properties = {};
        for (const key in item) {
            if (!safekeys.includes(key)) {
                formattedItem.properties[key] = item[key];
            }
        }
        
        formattedItems.push(formattedItem);
    }

    return formattedItems;
}

const reformattedItems = reformatItems(items);
const outputData = { items: reformattedItems };

// Write to the JSON file
const filePath = path.join(__dirname, '../data/gameFiles/item/items.json');
fs.writeFileSync(filePath, JSON.stringify(outputData, null, 2), 'utf8');

console.log('Successfully reformatted and saved items.json!');