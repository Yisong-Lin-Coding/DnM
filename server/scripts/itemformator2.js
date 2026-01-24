const fs = require('fs');
const path = require('path');

// ===== CONFIGURE THESE PATHS =====
const INPUT_FILE = '../server/data/gameFiles/item/itemsimport.json';
const OUTPUT_FILE = '../server/data/gameFiles/item/items2.json';
// =================================

const VALID_RARITIES = ['common', 'uncommon', 'rare', 'veryRare', 'epic', 'legendary', 'artifact'];

/* =========================
   Utility Functions
========================= */

function normalizeRarity(rarity) {
  if (!rarity) return 'common';

  const normalized = rarity.toLowerCase().trim();
  if (VALID_RARITIES.includes(normalized)) return normalized;
  if (normalized === 'very rare') return 'veryRare';

  console.log(`  ⚠ Unknown rarity "${rarity}" - defaulting to "common"`);
  return 'common';
}

function parsePropertiesString(str = '') {
  return str
    .split(',')
    .map(p => p.trim().toLowerCase())
    .filter(Boolean);
}

function inferDamageUses(damageType = '', properties = []) {
  const uses = new Set();

  if (damageType.includes('piercing')) uses.add('stab');
  if (damageType.includes('slashing')) uses.add('slash');
  if (damageType.includes('bludgeoning')) uses.add('blunt');
  if (properties.includes('thrown')) uses.add('throw');

  return Array.from(uses);
}

function buildWeaponProperties(item) {
  const props = item.properties || {};
  const rawProps = parsePropertiesString(props["Properties"]);
  const damageDie = props["Damage"];
  const damageType = (props["Damage Type"] || '').toLowerCase();

  const uses = inferDamageUses(damageType, rawProps);

  const damage = {};
  uses.forEach(use => {
    damage[use] = damageDie;
  });

  return {
    damage,
    uses,
    slot: { fist: 1 }
  };
}

function inferAttributes(itemType = '', props = {}, damageType = '') {
  const attributes = new Set();
  const type = itemType.toLowerCase();
  const rawProps = parsePropertiesString(props["Properties"]);

  if (type.includes('weapon')) attributes.add('weapon');
  if (type.includes('melee')) attributes.add('melee');
  if (type.includes('ranged')) attributes.add('ranged');

  if (rawProps.includes('thrown')) attributes.add('thrown');
  if (rawProps.includes('finesse')) attributes.add('finesse');
  if (rawProps.includes('light')) attributes.add('light');
  if (rawProps.includes('heavy')) attributes.add('heavy');
  if (rawProps.includes('two-handed')) attributes.add('two-handed');
  if (rawProps.includes('versatile')) attributes.add('versatile');

  if (damageType.includes('piercing')) attributes.add('pierce');
  if (damageType.includes('slashing')) attributes.add('slash');
  if (damageType.includes('bludgeoning')) attributes.add('blunt');

  if (type.includes('simple')) attributes.add('simple');
  if (type.includes('martial')) attributes.add('martial');

  if (attributes.size === 0) attributes.add('item');
  return Array.from(attributes);
}

/* =========================
   Conversion Logic
========================= */

function convertDnDItems(inputArray) {
  const output = { items: [] };
  const seenIds = new Set();
  const seenItemTypes = new Set();

  let duplicateCount = 0;
  let plusItemCount = 0;

  inputArray.forEach((item, index) => {
    try {
      if (!item || !item.name) return;

      // Skip +X items
      if (/\+\d/.test(item.name)) {
        plusItemCount++;
        return;
      }

      // Skip names longer than 2 words
      const wordCount = item.name.trim().split(/\s+/).length;
      if (wordCount > 2) return;

      // Build ID
      const id = item.name
        .replace(/['\+\-]/g, '')
        .split(/\s+/)
        .map((w, i) => i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())
        .join('');

      if (seenIds.has(id)) {
        duplicateCount++;
        return;
      }
      seenIds.add(id);

      const props = item.properties || {};
      const itemType = props["Item Type"] || item.type || "Item";

      // Track raw item types
      seenItemTypes.add(itemType);

      const rarity = normalizeRarity(props["Item Rarity"]);
      const isWeapon = itemType.toLowerCase().includes('weapon');

      const convertedItem = {
        id,
        name: item.name,
        description: item.description || `A ${item.name}.`,
        type: isWeapon ? "Weapon" :
              itemType.toLowerCase().includes("armor") ? "Armor" :
              itemType.toLowerCase().includes("potion") ? "Consumable" :
              "Item",
        rarity,
        weight: props.Weight ? props.Weight * 32 : 64,
        cost: 10,
        attributes: inferAttributes(
          itemType,
          props,
          (props["Damage Type"] || '').toLowerCase()
        ),
        properties: {}
      };

      if (isWeapon && props["Damage"]) {
        convertedItem.properties = buildWeaponProperties(item);
      }

      output.items.push(convertedItem);

    } catch (err) {
      console.log(`⚠ Error processing item at index ${index}: ${err.message}`);
    }
  });

  // ---- Summary Logs ----
  if (duplicateCount) console.log(`ℹ Skipped ${duplicateCount} duplicate ID(s)`);
  if (plusItemCount) console.log(`ℹ Skipped ${plusItemCount} +X item(s)`);

  console.log('\n=== Item Types Found ===');
  Array.from(seenItemTypes)
    .sort()
    .forEach(type => console.log(` - ${type}`));

  return output;
}

/* =========================
   Runner
========================= */

function main() {
  console.log('=== D&D Item Converter Starting ===');
  console.log(`Input:  ${path.resolve(INPUT_FILE)}`);
  console.log(`Output: ${path.resolve(OUTPUT_FILE)}\n`);

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`ERROR: Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT_FILE, 'utf8');
  const parsed = JSON.parse(raw);

  const items = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.items)
      ? parsed.items
      : null;

  if (!items) {
    console.error('ERROR: Input JSON must be an array or { items: [] }');
    process.exit(1);
  }

  console.log(`✓ Loaded ${items.length} items`);
  const converted = convertDnDItems(items);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(converted, null, 2), 'utf8');
  console.log(`\n✓ Converted ${converted.items.length} items`);
  console.log('=== Conversion Complete ===');
}

if (require.main === module) {
  main();
}
