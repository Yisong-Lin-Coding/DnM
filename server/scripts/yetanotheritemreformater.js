

function reformateItem(item) {
  // Ensure properties exists
  if (!item.properties || typeof item.properties !== "object") {
    item.properties = {};
  }

  // Ensure uses exists
  if (!item.properties.uses) {
    item.properties.uses = {};
  }

  // Ensure slot exists only for Weapon or Armor
  if (
    (item.type === "Weapon" || item.type === "Armor") &&
    !item.properties.slot
  ) {
    item.properties.slot = {};
  }

  return item;
}


const fs = require('fs');
const path = require('path');
const itemsPage = require('../data/gameFiles/item/items2.json');
const items = itemsPage['items'] || [];

const reformattedItems = items.map(item => {
    reformateItem(item);
    return item;
});
const outputData = { items: reformattedItems };
const filePath = path.join(__dirname, '../data/gameFiles/item/items3.json');
fs.writeFileSync(filePath, JSON.stringify(outputData, null, 2), 'utf8');

console.log('Successfully reformatted and saved items2.json!')
console.log(reformattedItems);