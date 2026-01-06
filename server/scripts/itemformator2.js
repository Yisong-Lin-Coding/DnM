const fs = require('fs');
const path = require('path');

// ===== CONFIGURE THESE PATHS =====
const INPUT_FILE = '../server/data/gameFiles/item/itemsimport.json';  // Path to your input JSON file
const OUTPUT_FILE = '../server/data/gameFiles/item/items2.json'; // Path where you want the output saved
// =================================

const VALID_RARITIES = ['common', 'uncommon', 'rare', 'veryRare', 'epic', 'legendary', 'artifact'];

function normalizeRarity(rarity) {
  if (!rarity) return 'common';
  
  const normalized = rarity.toLowerCase().trim();
  
  // Direct matches
  if (VALID_RARITIES.includes(normalized)) {
    return normalized;
  }
  
  // Handle "very rare" -> "veryRare"
  if (normalized === 'very rare') {
    return 'veryRare';
  }
  
  // If it's not a valid rarity, default to common
  console.log(`  ⚠ Unknown rarity "${rarity}" - defaulting to "common"`);
  return 'common';
}

function convertDnDItems(inputArray) {
  const output = {
    items: []
  };
  
  const seenIds = new Set(); // Track IDs we've already added
  let duplicateCount = 0;
  let plusItemCount = 0;

  inputArray.forEach((item, index) => {
    try {
      // Safety check for item structure
      if (!item || !item.name) {
        console.log(`  ⚠ Skipping item at index ${index}: missing name`);
        return;
      }

      // Check if name contains +1, +2, +3, etc. and skip it
      if (/\+\d/.test(item.name)) {
        plusItemCount++;
        return;
      }

      // Check if name has more than 2 words
      const wordCount = item.name.trim().split(/\s+/).length;
      if (wordCount > 2) {
        return; // Skip this item
      }

      // Create a simple ID from the name (camelCase)
      // Remove apostrophes and special characters from the ID
      const id = item.name
        .replace(/['\+\-]/g, '') // Remove apostrophes, plus signs, and hyphens
        .split(/\s+/)
        .map((word, index) => 
          index === 0 
            ? word.toLowerCase() 
            : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('');

      // Skip if we've already seen this ID
      if (seenIds.has(id)) {
        duplicateCount++;
        console.log(`  ⚠ Skipping duplicate ID: "${id}" (from item: "${item.name}")`);
        return;
      }
      
      // Add ID to our tracking set
      seenIds.add(id);

      // Determine basic attributes based on item type and rarity
      const attributes = [];
      const itemType = item.properties?.["Item Type"] || item.type || "Item";
      
      // Add type-based attributes
      if (itemType.toLowerCase().includes("weapon")) {
        attributes.push("weapon");
      }
      if (itemType.toLowerCase().includes("armor")) {
        attributes.push("armor");
      }
      if (itemType.toLowerCase().includes("scroll")) {
        attributes.push("consumable", "scroll");
      }
      if (itemType.toLowerCase().includes("potion")) {
        attributes.push("consumable", "potion");
      }

      // Get and normalize rarity
      const rawRarity = item.properties?.["Item Rarity"] || "common";
      const rarity = normalizeRarity(rawRarity);
      
      // Build the converted item
      const convertedItem = {
        id: id,
        name: item.name, // Keep apostrophe in name
        description: item.description || `A ${item.name}.`,
        type: itemType.includes("Weapon") ? "Weapon" : 
              itemType.includes("Armor") ? "Armor" : 
              itemType.includes("Potion") || itemType.includes("Consumable") ? "Consumable" : "Item",
        rarity: rarity,
        weight: 64, // Default weight, adjust as needed
        cost: 10,   // Default cost, adjust as needed
        attributes: attributes.length > 0 ? attributes : ["item"],
        properties: {}
      };

      output.items.push(convertedItem);
    } catch (error) {
      console.log(`  ⚠ Error processing item at index ${index}:`, error.message);
    }
  });

  if (duplicateCount > 0) {
    console.log(`\n  ℹ Skipped ${duplicateCount} duplicate ID(s)`);
  }
  
  if (plusItemCount > 0) {
    console.log(`  ℹ Skipped ${plusItemCount} item(s) with +1/+2/+3 modifiers`);
  }

  return output;
}

function main() {
  console.log('=== D&D Item Converter Starting ===');
  console.log(`Current directory: ${process.cwd()}`);
  console.log(`Input file: ${path.resolve(INPUT_FILE)}`);
  console.log(`Output file: ${path.resolve(OUTPUT_FILE)}`);
  console.log('');
  
  try {
    // Check if input file exists
    if (!fs.existsSync(INPUT_FILE)) {
      console.error(`ERROR: Input file not found: ${INPUT_FILE}`);
      console.error('Please create the file or update the INPUT_FILE path');
      process.exit(1);
    }
    
    console.log('✓ Input file found');
    console.log('Reading input file...');
    const inputData = fs.readFileSync(INPUT_FILE, 'utf8');
    
    console.log('Parsing JSON...');
    const parsed = JSON.parse(inputData);
    
    // Handle both array and object with items property
    let items;
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed.items && Array.isArray(parsed.items)) {
      items = parsed.items;
    } else {
      console.error('ERROR: Expected an array or object with "items" array');
      console.error('Found:', typeof parsed);
      process.exit(1);
    }
    
    console.log(`✓ Found ${items.length} items in input file`);
    
    console.log('Converting items...');
    const converted = convertDnDItems(items);
    
    console.log(`✓ Converted ${converted.items.length} items`);
    console.log(`  (filtered out ${items.length - converted.items.length} items total)`);
    
    console.log('Writing output file...');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(converted, null, 2), 'utf8');
    
    console.log(`✓ Success! Output written to: ${OUTPUT_FILE}`);
    console.log('=== Conversion Complete ===');
  } catch (error) {
    console.error('');
    console.error('=== ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Only run if this file is executed directly (not imported)
if (require.main === module) {
  main();
}

function main() {
  console.log('=== D&D Item Converter Starting ===');
  console.log(`Current directory: ${process.cwd()}`);
  console.log(`Input file: ${path.resolve(INPUT_FILE)}`);
  console.log(`Output file: ${path.resolve(OUTPUT_FILE)}`);
  console.log('');
  
  try {
    // Check if input file exists
    if (!fs.existsSync(INPUT_FILE)) {
      console.error(`ERROR: Input file not found: ${INPUT_FILE}`);
      console.error('Please create the file or update the INPUT_FILE path');
      process.exit(1);
    }
    
    console.log('✓ Input file found');
    console.log('Reading input file...');
    const inputData = fs.readFileSync(INPUT_FILE, 'utf8');
    
    console.log('Parsing JSON...');
    const parsed = JSON.parse(inputData);
    
    // Handle both array and object with items property
    let items;
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed.items && Array.isArray(parsed.items)) {
      items = parsed.items;
    } else {
      console.error('ERROR: Expected an array or object with "items" array');
      console.error('Found:', typeof parsed);
      process.exit(1);
    }
    
    console.log(`✓ Found ${items.length} items in input file`);
    
    console.log('Converting items...');
    const converted = convertDnDItems(items);
    
    console.log(`✓ Converted ${converted.items.length} items`);
    console.log(`  (filtered out ${items.length - converted.items.length} items with >2 word names or duplicate IDs)`);
    
    console.log('Writing output file...');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(converted, null, 2), 'utf8');
    
    console.log(`✓ Success! Output written to: ${OUTPUT_FILE}`);
    console.log('=== Conversion Complete ===');
  } catch (error) {
    console.error('');
    console.error('=== ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the script
main();