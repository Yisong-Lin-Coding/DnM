/**
 * Shared inventory utilities for character creation
 * Used by Class.jsx and Background.jsx to avoid duplication
 */

/**
 * Convert camelCase string to Title Case
 * @param {string} str - The string to convert
 * @returns {string} Title cased string
 */
export const toTitleCase = (str) => {
    return str
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (char) => char.toUpperCase())
        .trim();
};

/**
 * Generate a unique ID for inventory items
 * @returns {string} Unique identifier
 */
export const generateUniqueId = () => {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Starting packs definition with their contents (in camelCase itemId format)
 */
export const startingPacks = {
    burglarsPack: {
        name: "Burglar's Pack",
        items: ['backpack:1', 'ballBearings:1000', 'string:10', 'bell:1', 'candle:5', 
               'crowbar:1', 'hammer:1', 'piton:10', 'hoodedLantern:1', 'oilFlask:2', 
               'rations:5', 'tinderbox:1', 'waterskin:1', 'hempenRope:1']
    },
    diplomatsPack: {
        name: "Diplomat's Pack",
        items: ['chest:1', 'mapCase:2', 'fineClothes:1', 'inkBottle:1', 'inkPen:1', 
               'lamp:1', 'oilFlask:2', 'paper:5', 'perfume:1', 'sealingWax:1', 'soap:1']
    },
    dungeoneersPack: {
        name: "Dungeoneer's Pack",
        items: ['backpack:1', 'crowbar:1', 'hammer:1', 'piton:10', 'torch:10', 
               'tinderbox:1', 'rations:10', 'waterskin:1', 'hempenRope:1']
    },
    entertainersPack: {
        name: "Entertainer's Pack",
        items: ['backpack:1', 'bedroll:1', 'costume:2', 'candle:5', 'rations:5', 
               'waterskin:1', 'disguiseKit:1']
    },
    explorersPack: {
        name: "Explorer's Pack",
        items: ['backpack:1', 'bedroll:1', 'messKit:1', 'tinderbox:1', 'torch:10', 
               'rations:10', 'waterskin:1', 'hempenRope:1']
    },
    priestsPack: {
        name: "Priest's Pack",
        items: ['backpack:1', 'blanket:1', 'candle:10', 'tinderbox:1', 'almsBox:1', 
               'incense:2', 'censer:1', 'vestments:1', 'rations:2', 'waterskin:1']
    },
    scholarsPack: {
        name: "Scholar's Pack",
        items: ['backpack:1', 'bookLore:1', 'inkBottle:1', 'inkPen:1', 'parchment:10', 
               'littleBagSand:1', 'smallKnife:1']
    }
};

/**
 * Check if an item key is a starting pack
 * @param {string} itemKey - The item key to check
 * @returns {boolean}
 */
export const isStartingPack = (itemKey) => {
    return startingPacks.hasOwnProperty(itemKey);
};

/**
 * Check if an item key is an "any" item or category (needs selection from dropdown)
 * Matches both "anyXxx" patterns and plain category names like "martialWeapon"
 * @param {string} itemKey - The item key to check
 * @returns {boolean}
 */
export const isAnyItem = (itemKey) => {
    const lower = itemKey.toLowerCase();
    // Check for "any" prefix (anyMartialWeapon, anySimpleWeapon, etc.)
    if (lower.startsWith('any')) {
        return true;
    }
    // Check for plain category names that have options in getAnyItemOptions
    if (lower.includes('simpleweapon') || 
        lower.includes('martialweapon') ||
        lower.includes('simplemelee') ||
        lower.includes('musicalinstrument') ||
        lower.includes('artisanstool') ||
        lower.includes('gamingset')) {
        return true;
    }
    return false;
};

/**
 * Convert items array with itemId and quantity to inventory map with MongoDB IDs
 * Uses the itemsByItemId map from context for instant lookups
 * 
 * @param {Array} itemsArray - Array of {itemId, quantity} objects in camelCase
 * @param {Object} options - Configuration object
 * @param {Object} options.itemsByItemId - Map of itemId (camelCase) to item objects
 * @returns {Object} Inventory map with structure: { uniqueId: { equipped: false, ItemID: mongoId } }
 */
export const addItemsToInventory = (itemsArray, { itemsByItemId = {} }) => {
    if (!itemsArray || itemsArray.length === 0) {
        console.log('No items to add to inventory');
        return {};
    }

    const inventoryMap = {};
    
    itemsArray.forEach(({ itemId, quantity }) => {
        // Look up the item in the context-provided map
        const item = itemsByItemId[itemId];
        const itemMongoId = item?._id;
        
        if (itemMongoId) {
            // Create entries for each quantity
            for (let i = 0; i < quantity; i++) {
                const uniqueId = generateUniqueId();
                inventoryMap[uniqueId] = {
                    equipped: false,
                    ItemID: itemMongoId
                };
            }
            console.log(`Added ${quantity}x ${itemId} to inventory`);
        } else {
            console.warn(`Item not found in items map: ${itemId}`);
        }
    });

    console.log(`Inventory map created with ${Object.keys(inventoryMap).length} item instances`);
    return inventoryMap;
};

/**
 * Weapon and tool lists for "any" item selections
 */
export const weaponLists = {
    simpleWeapons: [
        'club', 'dagger', 'greatclub', 'handaxe', 'javelin', 'lightHammer', 'mace', 
        'quarterstaff', 'sickle', 'spear', 'lightCrossbow', 'dart', 'shortbow', 'sling'
    ],
    
    martialWeapons: [
        'battleaxe', 'flail', 'glaive', 'greataxe', 'greatsword', 'halberd', 'lance', 
        'longsword', 'maul', 'morningstar', 'pike', 'rapier', 'scimitar', 'shortsword', 
        'trident', 'warPick', 'warhammer', 'whip', 'blowgun', 'handCrossbow', 
        'heavyCrossbow', 'longbow', 'net'
    ],
    
    simpleMeleeWeapons: [
        'club', 'dagger', 'greatclub', 'handaxe', 'javelin', 'lightHammer', 'mace', 
        'quarterstaff', 'sickle', 'spear'
    ]
};

export const toolLists = {
    musicalInstruments: [
        'bagpipes', 'drum', 'dulcimer', 'flute', 'lute', 'lyre', 'horn', 'panFlute', 
        'shawm', 'viol'
    ],
    
    artisansTools: [
        'alchemistsSupplies', 'brewersSupplies', 'calligraphersSupplies', 'carpentersTools',
        'cartographersTools', 'cobblersTools', 'cooksUtensils', 'glassblowersTools',
        'jewelersTools', 'leatherworkersTools', 'masonsTools', 'paintersSupplies',
        'pottersTools', 'smithsTools', 'tinkersTools', 'weaversTools', 'woodcarversTools'
    ],
    
    gamingSets: [
        'diceSet', 'dragonchessSet', 'playingCardSet', 'threedragonAnteSet'
    ]
};

export const languages = [
    'common', 'dwarvish', 'elvish', 'giant', 'gnomish', 'goblin', 'halfling', 'orc',
    'abyssal', 'celestial', 'draconic', 'deepSpeech', 'infernal', 'primordial', 
    'sylvan', 'undercommon'
];

/**
 * Get dropdown options based on "any" item type
 * @param {string} itemKey - The item key to match
 * @returns {Array} List of available options
 */
export const getAnyItemOptions = (itemKey) => {
    const lowerKey = itemKey.toLowerCase();
    if (lowerKey.includes('simpleweapon')) return weaponLists.simpleWeapons;
    if (lowerKey.includes('martialweapon')) return weaponLists.martialWeapons;
    if (lowerKey.includes('simplemelee')) return weaponLists.simpleMeleeWeapons;
    if (lowerKey.includes('musicalinstrument')) return toolLists.musicalInstruments;
    if (lowerKey.includes('artisanstool')) return toolLists.artisansTools;
    if (lowerKey.includes('gamingset')) return toolLists.gamingSets;
    return [];
};
