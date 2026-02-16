const CHARACTER = require('./character');
const fs = require('fs').promises;
const path = require('path');
const Item = require('../../data/mongooseDataStructure/item');
const Class = require('../../data/mongooseDataStructure/class');
const Subclass = require('../../data/mongooseDataStructure/subclass');
const Race = require('../../data/mongooseDataStructure/race');
const SubRace = require('../../data/mongooseDataStructure/subrace');
const Character = require('../../data/mongooseDataStructure/character');
const Background = require('../../data/mongooseDataStructure/background');

const MODELS = {
    items: Item,
    classes: Class,
    subclasses: Subclass,
    races: Race,
    subraces: SubRace,
    characters: Character,
    backgrounds: Background
};

const CORE_CHARACTER_ACTIONS = [
    {
        id: 'attack',
        name: 'Attack',
        actionType: 'action',
        source: 'core',
        description: 'Make a weapon or unarmed attack.'
    },
    {
        id: 'cast',
        name: 'Cast Spell',
        actionType: 'action',
        source: 'core',
        description: 'Cast an available spell.'
    },
    {
        id: 'move',
        name: 'Move',
        actionType: 'movement',
        source: 'core',
        description: 'Move up to your movement speed.'
    },
    {
        id: 'use_item',
        name: 'Use Item',
        actionType: 'action',
        source: 'core',
        description: 'Use an item from inventory or equipment.'
    },
    {
        id: 'dash',
        name: 'Dash',
        actionType: 'action',
        source: 'core',
        description: 'Double your movement for the turn.'
    },
    {
        id: 'dodge',
        name: 'Dodge',
        actionType: 'action',
        source: 'core',
        description: 'Focus on defense until your next turn.'
    },
    {
        id: 'help',
        name: 'Help',
        actionType: 'action',
        source: 'core',
        description: 'Grant support to an ally or assist with a task.'
    }
];

/**
 * CharacterBuilder - MongoDB + Server File Hybrid System
 * 
 * Fetches main documents from MongoDB (races, classes, items)
 * Then looks up nested references from server files (traits, features, enchantments)
 */
class CharacterBuilder {
    constructor(socket) {
        if (!socket) {
            throw new Error('CharacterBuilder requires a socket instance');
        }
        
        this.socket = socket;
        this.data = null;
        this.logPrefix = '[CharacterBuilder]';
        
        // ==================================================
        // TODO: REPLACE THESE WITH YOUR ACTUAL FILE PATHS
        // ==================================================
        this.filePaths = {
            // Nested references (loaded from files)
            traits: '/path/to/traits',              // Race/subrace traits
            features: '/path/to/features',          // Class/subclass features
            enchantments: '/path/to/enchantments',  // Item enchantments
            backgrounds: '/path/to/backgrounds'     // Background features (if needed)
        };
    }

    /**
     * Helper to query MongoDB via socket
     */
    async _queryDatabase(collection, operation, filter = {}) {
        const startedAt = Date.now();
        const Model = MODELS[collection];
        if (!Model) {
            throw new Error(`Invalid collection: ${collection}`);
        }

        try {
            let result;

            switch (operation) {
                case 'findById': {
                    const idValue = filter._id || filter.id || filter.characterID;
                    if (!idValue) throw new Error('No ID provided for findById');
                    result = await Model.findById(idValue);
                    break;
                }
                case 'findOne':
                    result = await Model.findOne(filter);
                    break;
                case 'findAll':
                    result = await Model.find(filter);
                    break;
                default:
                    throw new Error(`Unsupported operation in CharacterBuilder: ${operation}`);
            }

            console.log(`${this.logPrefix} db query success`, {
                collection,
                operation,
                durationMs: Date.now() - startedAt
            });
            return result;
        } catch (error) {
            console.warn(`${this.logPrefix} db query failed`, {
                collection,
                operation,
                durationMs: Date.now() - startedAt,
                message: error.message
            });
            throw error;
        }
    }

    /**
     * Load data from a file by ID
     * Supports:
     * - Directory with individual JSON files
     * - Single JSON file with array
     * - Single JSON file with object (ID as key)
     */
    async _loadFromFile(basePath, id) {
        try {
            const stats = await fs.stat(basePath);
            
            if (stats.isDirectory()) {
                // Directory: Look for file named {id}.json
                const filePath = path.join(basePath, `${id}.json`);
                const content = await fs.readFile(filePath, 'utf8');
                return JSON.parse(content);
                
            } else if (stats.isFile()) {
                // Single file: Load and search
                const content = await fs.readFile(basePath, 'utf8');
                const data = JSON.parse(content);
                
                if (Array.isArray(data)) {
                    // Array of objects: Find by ID
                    return data.find(item => 
                        item._id === id || 
                        item.id === id ||
                        item._id?.toString() === id?.toString()
                    );
                } else if (typeof data === 'object') {
                    // Object with ID keys: Direct lookup
                    return data[id] || data[id.toString()];
                }
            }
            
            return null;
            
        } catch (error) {
            console.warn(`Failed to load from ${basePath} for ID ${id}:`, error.message);
            return null;
        }
    }

    /**
     * Transform MongoDB stat structure to simple values
     */
    _transformStats(mongoStats) {
        const stats = {};
        const statNames = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA', 'LUCK'];
        
        for (const statName of statNames) {
            if (mongoStats[statName]) {
                stats[statName] = mongoStats[statName].permMods?.base 
                    || mongoStats[statName].total 
                    || 10;
            } else {
                stats[statName] = 10;
            }
        }
        
        return stats;
    }

    /**
     * Ensure a feature/trait has proper modifiers array structure
     */
    _ensureModifiersStructure(feature) {
        if (typeof feature === 'string') {
            return {
                name: feature,
                description: feature,
                modifiers: []
            };
        }
        
        if (typeof feature === 'object' && feature !== null) {
            return {
                ...feature,
                modifiers: Array.isArray(feature.modifiers) ? feature.modifiers : []
            };
        }
        
        return {
            name: 'Unknown Feature',
            description: '',
            modifiers: []
        };
    }

    _toDisplayName(value) {
        return String(value || '')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    _toActionId(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    _toStringArray(value) {
        if (Array.isArray(value)) {
            return value.map((entry) => String(entry).trim()).filter(Boolean);
        }
        if (typeof value === 'string') {
            return value
                .split(/[\n,]/g)
                .map((entry) => entry.trim())
                .filter(Boolean);
        }
        return [];
    }

    _normalizeActionType(rawType) {
        const normalized = String(rawType || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '');

        switch (normalized) {
            case 'bonus':
            case 'bonusaction':
                return 'bonusAction';
            case 'reaction':
                return 'reaction';
            case 'move':
            case 'movement':
                return 'movement';
            case 'free':
            case 'freeaction':
                return 'free';
            case 'passive':
                return 'passive';
            case 'special':
                return 'special';
            default:
                return 'action';
        }
    }

    _readProperty(properties, key) {
        if (!properties) return undefined;
        if (typeof properties.get === 'function') {
            return properties.get(key);
        }
        return properties[key];
    }

    _inferActionTypeFromDescription(description) {
        const text = String(description || '').toLowerCase();
        if (!text) return 'action';
        if (text.includes('bonus action')) return 'bonusAction';
        if (text.includes('reaction')) return 'reaction';
        if (text.includes('free action')) return 'free';
        if (text.includes('move') || text.includes('movement')) return 'movement';
        return 'action';
    }

    _isActionableFeature(feature) {
        const text = String(feature?.description || '').toLowerCase();
        if (!text) return false;
        return /as an action|use an action|bonus action|reaction|on your turn|you can use/.test(text);
    }

    _normalizeAction(action, fallback = {}) {
        const source = typeof action === 'string'
            ? { name: action }
            : (action && typeof action === 'object' ? action : null);
        if (!source) return null;

        const name = String(
            source.name ||
            source.label ||
            source.title ||
            fallback.name ||
            ''
        ).trim();
        if (!name) return null;

        return {
            id: String(source.id || fallback.id || this._toActionId(name)),
            name,
            actionType: this._normalizeActionType(source.actionType || source.type || fallback.actionType),
            source: String(source.source || source.sourceType || fallback.source || 'custom'),
            sourceId: String(source.sourceId || source.sourceKey || fallback.sourceId || ''),
            description: String(source.description || fallback.description || ''),
            cost: String(source.cost || fallback.cost || ''),
            requirements: this._toStringArray(source.requirements || fallback.requirements),
            enabled: source.enabled !== false
        };
    }

    _normalizeActionCollection(rawActions, fallback = {}) {
        if (Array.isArray(rawActions)) {
            return rawActions
                .map((action) => this._normalizeAction(action, fallback))
                .filter(Boolean);
        }

        if (typeof rawActions === 'string') {
            const normalized = this._normalizeAction(rawActions, fallback);
            return normalized ? [normalized] : [];
        }

        if (rawActions && typeof rawActions === 'object') {
            return Object.entries(rawActions)
                .map(([name, value]) => {
                    if (value && typeof value === 'object' && !Array.isArray(value)) {
                        return this._normalizeAction(
                            { ...value, name: value.name || name },
                            fallback
                        );
                    }
                    if (typeof value === 'string') {
                        return this._normalizeAction(
                            { name, description: value },
                            fallback
                        );
                    }
                    return this._normalizeAction({ name }, fallback);
                })
                .filter(Boolean);
        }

        return [];
    }

    _extractSkillActions(activeSkills) {
        if (!activeSkills || typeof activeSkills !== 'object') {
            return [];
        }

        return Object.entries(activeSkills)
            .map(([skillName, details]) => this._normalizeAction({
                id: `skill_${this._toActionId(skillName)}`,
                name: this._toDisplayName(skillName),
                actionType: this._normalizeActionType(details?.actionType || details?.type || 'action'),
                source: 'skill',
                sourceId: String(skillName),
                description: typeof details === 'string' ? details : String(details?.description || '')
            }))
            .filter(Boolean);
    }

    _extractFeatureActions(features, source) {
        if (!Array.isArray(features)) {
            return [];
        }

        return features
            .filter((feature) => feature?.name && this._isActionableFeature(feature))
            .map((feature) => this._normalizeAction({
                id: feature.id || feature.featureId || this._toActionId(feature.name),
                name: feature.name,
                actionType: this._inferActionTypeFromDescription(feature.description),
                source,
                sourceId: String(feature.id || feature.featureId || ''),
                description: feature.description || ''
            }))
            .filter(Boolean);
    }

    _extractItemActions(items) {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }

        const actions = [];

        items.forEach((item) => {
            const rawUses = this._readProperty(item?.properties, 'uses');
            const uses = Array.isArray(rawUses)
                ? rawUses
                : (typeof rawUses === 'string' ? [rawUses] : []);

            uses.forEach((useEntry, index) => {
                const useText = typeof useEntry === 'string'
                    ? useEntry
                    : String(useEntry?.name || useEntry?.description || '').trim();
                if (!useText) return;

                const normalized = this._normalizeAction({
                    id: `item_${this._toActionId(item?.name || item?.itemId || item?._id)}_${index}`,
                    name: useText,
                    actionType: this._inferActionTypeFromDescription(useText),
                    source: 'item',
                    sourceId: String(item?.itemId || item?._id || item?.id || ''),
                    description: `Item action from ${item?.name || 'equipped item'}`
                });

                if (normalized) {
                    actions.push(normalized);
                }
            });
        });

        return actions;
    }

    _dedupeActions(actions) {
        const out = [];
        const dedupe = new Set();

        (actions || []).forEach((action) => {
            const normalized = this._normalizeAction(action);
            if (!normalized) return;

            const key = `${normalized.id}|${normalized.actionType}|${normalized.source}`.toLowerCase();
            if (dedupe.has(key)) return;

            dedupe.add(key);
            out.push(normalized);
        });

        return out;
    }

    _buildAvailableActions() {
        const customActions = this._normalizeActionCollection(this.data.actions, { source: 'custom' });
        const skillActions = this._extractSkillActions(this.data.skillIds?.active);
        const classFeatureActions = this._extractFeatureActions(this.data.classFeatures, 'classFeature');
        const raceFeatureActions = this._extractFeatureActions(this.data.raceFeatures, 'raceFeature');
        const itemActions = this._extractItemActions(this.data.equippedItems);

        return this._dedupeActions([
            ...CORE_CHARACTER_ACTIONS,
            ...customActions,
            ...skillActions,
            ...classFeatureActions,
            ...raceFeatureActions,
            ...itemActions
        ]);
    }

    /**
     * Load and process traits from server files
     * @param {Array} traitIds - Array of trait IDs from MongoDB
     * @returns {Array} Array of trait objects with modifiers
     */
    async _loadTraits(traitIds) {
        if (!Array.isArray(traitIds) || traitIds.length === 0) {
            return [];
        }

        const traitPromises = traitIds.map(async (traitId) => {
            const trait = await this._loadFromFile(this.filePaths.traits, traitId);
            
            if (!trait) {
                console.warn(`Trait not found: ${traitId}`);
                // Return a placeholder so we know it's missing
                return {
                    name: traitId,
                    description: `[UNDEFINED TRAIT: ${traitId}]`,
                    modifiers: []
                };
            }
            
            return this._ensureModifiersStructure(trait);
        });

        const traits = await Promise.all(traitPromises);
        return traits.filter(t => t !== null);
    }

    /**
     * Load and process features from server files
     * @param {Object} featuresByLevel - Object with level keys and feature ID arrays
     * @returns {Array} Flat array of all features with modifiers
     */
    async _loadFeatures(featuresByLevel) {
        if (!featuresByLevel || typeof featuresByLevel !== 'object') {
            return [];
        }

        const allFeatures = [];
        
        // Iterate through each level
        for (const level in featuresByLevel) {
            const featureIds = featuresByLevel[level];
            
            if (!Array.isArray(featureIds)) {
                continue;
            }
            
            const levelFeatures = await Promise.all(
                featureIds.map(async (featureId) => {
                    const feature = await this._loadFromFile(this.filePaths.features, featureId);
                    
                    if (!feature) {
                        console.warn(`Feature not found: ${featureId}`);
                        return {
                            name: featureId,
                            description: `[UNDEFINED FEATURE: ${featureId}]`,
                            level: parseInt(level),
                            modifiers: []
                        };
                    }
                    
                    return {
                        ...this._ensureModifiersStructure(feature),
                        level: parseInt(level)
                    };
                })
            );
            
            allFeatures.push(...levelFeatures);
        }

        return allFeatures;
    }

    /**
     * Load and process enchantments from server files
     * @param {Array} enchantmentIds - Array of enchantment IDs
     * @returns {Array} Array of enchantment objects with modifiers
     */
    async _loadEnchantments(enchantmentIds) {
        if (!Array.isArray(enchantmentIds) || enchantmentIds.length === 0) {
            return [];
        }

        const enchantmentPromises = enchantmentIds.map(async (enchantmentId) => {
            const enchantment = await this._loadFromFile(this.filePaths.enchantments, enchantmentId);
            
            if (!enchantment) {
                console.warn(`Enchantment not found: ${enchantmentId}`);
                return {
                    name: enchantmentId,
                    description: `[UNDEFINED ENCHANTMENT: ${enchantmentId}]`,
                    modifiers: []
                };
            }
            
            return this._ensureModifiersStructure(enchantment);
        });

        const enchantments = await Promise.all(enchantmentPromises);
        return enchantments.filter(e => e !== null);
    }

    /**
     * Load character data and transform it
     */
    loadCharacterData(characterData) {
        const rawData = JSON.parse(JSON.stringify(characterData));
        
        this.data = {
            // Basic info
            id: rawData._id,
            name: rawData.name,
            level: rawData.level || 1,
            
            // Stats (transform from MongoDB structure)
            stats: this._transformStats(rawData.stats || {}),
            
            // Resources
            HP: rawData.HP || { max: 10, current: 10, temp: 0 },
            MP: rawData.MP || { max: 10, current: 10, temp: 0 },
            STA: rawData.STA || { max: 10, current: 10, temp: 0 },
            
            // IDs for MongoDB lookups
            raceId: rawData.race,
            subraceId: rawData.subrace,
            classId: rawData.class,
            subclassId: rawData.subclass,
            backgroundId: rawData.background,
            
            // These will be populated by fetch methods
            race: null,
            subrace: null,
            classType: null,
            subclassType: null,
            background: null,
            
            // Collections
            inventory: [],
            equippedItems: [],
            statusEffects: [],
            classFeatures: [],
            raceFeatures: [],
            actions: this._normalizeActionCollection(rawData.actions, { source: 'custom' }),
            
            // Skills from MongoDB
            skillIds: {
                active: rawData.skills?.active || {},
                passive: rawData.skills?.passive || {}
            },
            
            // Effect IDs from MongoDB
            effectIds: rawData.effects || [],
            
            // Base modifiers
            modifiers: []
        };
        
        return this;
    }

    /**
     * Fetch race from MongoDB and load traits from files
     */
    async fetchRace() {
        if (!this.data.raceId) {
            console.warn('No race ID provided');
            return this;
        }

        try {
            // Fetch race from MongoDB
            const race = await this._queryDatabase('races', 'findById', { _id: this.data.raceId });
            
            if (!race) {
                console.warn(`Race not found in MongoDB: ${this.data.raceId}`);
                return this;
            }
            
            this.data.race = race;
            
            // Load traits from server files
            if (race.traits && Array.isArray(race.traits)) {
                this.data.raceFeatures = await this._loadTraits(race.traits);
            }
            
        } catch (error) {
            console.error('Error fetching race:', error);
        }

        return this;
    }

    /**
     * Fetch subrace from MongoDB and load traits from files
     */
    async fetchSubrace() {
        if (!this.data.subraceId) {
            return this;
        }

        try {
            // Fetch subrace from MongoDB
            const subrace = await this._queryDatabase('subraces', 'findById', { _id: this.data.subraceId });
            
            if (!subrace) {
                console.warn(`Subrace not found in MongoDB: ${this.data.subraceId}`);
                return this;
            }
            
            this.data.subrace = subrace;
            
            // Load subrace traits and add to race features
            if (subrace.traits && Array.isArray(subrace.traits)) {
                const subraceTraits = await this._loadTraits(subrace.traits);
                this.data.raceFeatures.push(...subraceTraits);
            }
            
        } catch (error) {
            console.error('Error fetching subrace:', error);
        }

        return this;
    }

    /**
     * Fetch class from MongoDB and load features from files
     */
    async fetchClass() {
        if (!this.data.classId) {
            console.warn('No class ID provided');
            return this;
        }

        try {
            // Fetch class from MongoDB
            const classData = await this._queryDatabase('classes', 'findById', { _id: this.data.classId });
            
            if (!classData) {
                console.warn(`Class not found in MongoDB: ${this.data.classId}`);
                return this;
            }
            
            this.data.classType = classData;
            
            // Load features from server files based on character level
            if (classData.featuresByLevel) {
                // Get all features up to current level
                const relevantFeatures = {};
                for (let lvl = 1; lvl <= this.data.level; lvl++) {
                    if (classData.featuresByLevel[lvl]) {
                        relevantFeatures[lvl] = classData.featuresByLevel[lvl];
                    }
                }
                
                this.data.classFeatures = await this._loadFeatures(relevantFeatures);
            }
            
        } catch (error) {
            console.error('Error fetching class:', error);
        }

        return this;
    }

    /**
     * Fetch subclass from MongoDB and load features from files
     */
    async fetchSubclass() {
        if (!this.data.subclassId) {
            return this;
        }

        try {
            // Fetch subclass from MongoDB
            const subclass = await this._queryDatabase('subclasses', 'findById', { _id: this.data.subclassId });
            
            if (!subclass) {
                console.warn(`Subclass not found in MongoDB: ${this.data.subclassId}`);
                return this;
            }
            
            this.data.subclassType = subclass;
            
            // Load subclass features and add to class features
            if (subclass.featuresByLevel) {
                const relevantFeatures = {};
                for (let lvl = 1; lvl <= this.data.level; lvl++) {
                    if (subclass.featuresByLevel[lvl]) {
                        relevantFeatures[lvl] = subclass.featuresByLevel[lvl];
                    }
                }
                
                const subclassFeatures = await this._loadFeatures(relevantFeatures);
                this.data.classFeatures.push(...subclassFeatures);
            }
            
        } catch (error) {
            console.error('Error fetching subclass:', error);
        }

        return this;
    }

    /**
     * Fetch background from MongoDB
     */
    async fetchBackground() {
        if (!this.data.backgroundId) {
            return this;
        }

        try {
            const background = await this._queryDatabase('backgrounds', 'findById', { _id: this.data.backgroundId });
            
            if (!background) {
                console.warn(`Background not found in MongoDB: ${this.data.backgroundId}`);
                return this;
            }
            
            this.data.background = background;
            
        } catch (error) {
            console.error('Error fetching background:', error);
        }

        return this;
    }

    /**
     * Fetch equipped items from MongoDB and load enchantments from files
     */
    async fetchEquippedItems(rawCharacterData) {
        if (!rawCharacterData.inv?.equipment) {
            console.warn('No equipment data found');
            return this;
        }

        try {
            const equipment = rawCharacterData.inv.equipment;
            const equippedItemIds = [];
            
            // Gather all item IDs from all equipment slots
            for (const slot in equipment) {
                if (Array.isArray(equipment[slot])) {
                    equippedItemIds.push(...equipment[slot]);
                }
            }
            
            // Fetch all equipped items from MongoDB
            if (equippedItemIds.length > 0) {
                const itemPromises = equippedItemIds.map(async (itemId) => {
                    try {
                        const item = await this._queryDatabase('items', 'findById', { _id: itemId });
                        
                        if (!item) {
                            console.warn(`Item not found in MongoDB: ${itemId}`);
                            return null;
                        }
                        
                        // Load enchantments from server files
                        let enchantments = [];
                        if (item.enchantments && Array.isArray(item.enchantments)) {
                            enchantments = await this._loadEnchantments(item.enchantments);
                        }
                        
                        // Combine item with its enchantments
                        // Enchantments are treated as modifiers on the item
                        const allModifiers = enchantments.flatMap(e => e.modifiers || []);
                        
                        return {
                            ...item,
                            modifiers: allModifiers
                        };
                        
                    } catch (err) {
                        console.warn(`Failed to fetch item ${itemId}:`, err.message);
                        return null;
                    }
                });

                const items = await Promise.all(itemPromises);
                this.data.equippedItems = items.filter(item => item !== null);
            }
            
        } catch (error) {
            console.error('Error fetching equipped items:', error);
        }

        return this;
    }

    /**
     * Build the final CHARACTER instance
     */
    async build(rawCharacterData) {
        if (!this.data) {
            throw new Error('No character data loaded. Call loadCharacterData() first.');
        }

        try {
            const startedAt = Date.now();
            console.log(`${this.logPrefix} build start`, {
                characterID: this.data.id,
                level: this.data.level
            });

            // Fetch all associated data in parallel
            const fetchStartedAt = Date.now();
            await Promise.all([
                this.fetchRace(),
                this.fetchSubrace(),
                this.fetchClass(),
                this.fetchSubclass(),
                this.fetchBackground(),
                this.fetchEquippedItems(rawCharacterData)
            ]);
            console.log(`${this.logPrefix} build fetches done`, {
                characterID: this.data.id,
                durationMs: Date.now() - fetchStartedAt
            });

            // Create CHARACTER instance
            const instantiateStartedAt = Date.now();
            const character = new CHARACTER(this.data);
            console.log(`${this.logPrefix} character instantiated`, {
                characterID: this.data.id,
                durationMs: Date.now() - instantiateStartedAt
            });

            // Clean up
            this.data = null;
            console.log(`${this.logPrefix} build done`, {
                durationMs: Date.now() - startedAt
            });

            return character;
            
        } catch (error) {
            console.error('Error building character:', error);
            throw error;
        }
    }

    /**
     * Convenience method to build from character ID
     */
    async buildFromId(characterId) {
        try {
            const startedAt = Date.now();
            console.log(`${this.logPrefix} buildFromId start`, { characterId });

            // Fetch the character document from MongoDB
            const characterData = await this._queryDatabase('characters', 'findById', { _id: characterId });
            
            if (!characterData) {
                throw new Error(`Character not found: ${characterId}`);
            }

            // Load and transform the data
            this.loadCharacterData(characterData);
            
            // Build with original data
            const builtCharacter = await this.build(characterData);
            console.log(`${this.logPrefix} buildFromId done`, {
                characterId,
                durationMs: Date.now() - startedAt
            });
            return builtCharacter;
            
        } catch (error) {
            console.error('Error in buildFromId:', error);
            throw error;
        }
    }
}

module.exports = CharacterBuilder;
