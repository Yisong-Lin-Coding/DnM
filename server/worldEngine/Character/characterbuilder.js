const CHARACTER = require('./character');

/**
 * CharacterBuilder - Fetches data from MongoDB and constructs fully hydrated characters
 * 
 * This builder:
 * 1. Accepts raw character data from MongoDB
 * 2. Fetches associated race, class, items, etc. via socket.io
 * 3. Applies all modifiers from various sources
 * 4. Calculates initial HP/MP/STA values
 * 5. Returns a fully functional CHARACTER instance
 */
class CharacterBuilder {
    constructor(socket) {
        this.socket = socket;
        this.data = null;
        this.fetchedData = {
            race: null,
            subrace: null,
            class: null,
            subclass: null,
            background: null,
            equippedItems: [],
        };
    }

    /**
     * Helper to query MongoDB via socket
     * @param {string} collection - Collection name (races, classes, items, etc.)
     * @param {string} operation - Operation type (findOne, findById, etc.)
     * @param {object} filter - MongoDB filter
     * @returns {Promise} Resolves with the query result
     */
    async _queryDatabase(collection, operation, filter = {}) {
        return new Promise((resolve, reject) => {
            this.socket.emit('database_query', {
                collection,
                operation,
                filter
            }, (response) => {
                if (response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response.message));
                }
            });
        });
    }

    /**
     * Load the base character data
     * @param {object} characterData - Raw character data from MongoDB
     */
    loadCharacterData(characterData) {
        this.data = JSON.parse(JSON.stringify(characterData)); // Deep clone
        return this;
    }

    /**
     * Fetch and apply race data
     */
    async fetchRace() {
        if (!this.data.race) return this;

        try {
            const race = await this._queryDatabase('races', 'findOne', { name: this.data.race });
            this.fetchedData.race = race;

            // Apply racial stat bonuses
            if (race.statBonuses) {
                for (const [stat, bonus] of Object.entries(race.statBonuses)) {
                    this.data.stats[stat] = (this.data.stats[stat] || 10) + bonus;
                }
            }

            // Store race features (which contain modifiers)
            if (race.features) {
                this.data.raceFeatures = this.data.raceFeatures || [];
                this.data.raceFeatures.push(...race.features);
            }

        } catch (error) {
            console.error('Error fetching race:', error);
        }

        return this;
    }

    /**
     * Fetch and apply subrace data
     */
    async fetchSubrace() {
        if (!this.data.subrace) return this;

        try {
            const subrace = await this._queryDatabase('subraces', 'findOne', { name: this.data.subrace });
            this.fetchedData.subrace = subrace;

            // Apply subrace stat bonuses
            if (subrace.statBonuses) {
                for (const [stat, bonus] of Object.entries(subrace.statBonuses)) {
                    this.data.stats[stat] = (this.data.stats[stat] || 10) + bonus;
                }
            }

            // Store subrace features
            if (subrace.features) {
                this.data.raceFeatures = this.data.raceFeatures || [];
                this.data.raceFeatures.push(...subrace.features);
            }

        } catch (error) {
            console.error('Error fetching subrace:', error);
        }

        return this;
    }

    /**
     * Fetch and apply class data
     */
    async fetchClass() {
        if (!this.data.classType) return this;

        try {
            const classData = await this._queryDatabase('classes', 'findOne', { name: this.data.classType });
            this.fetchedData.class = classData;

            // Calculate initial HP/MP/STA based on class
            const level = this.data.level || 1;
            const conMod = Math.floor((this.data.stats.CON - 10) / 2);
            const intMod = Math.floor((this.data.stats.INT - 10) / 2);

            this.data.HP = {
                max: (classData.hitDie + conMod) * level,
                current: (classData.hitDie + conMod) * level,
                temp: 0
            };

            this.data.MP = {
                max: Math.max(0, (classData.mpPerLevel || 0) + intMod) * level,
                current: Math.max(0, (classData.mpPerLevel || 0) + intMod) * level,
                temp: 0
            };

            this.data.STA = {
                max: Math.max(0, (classData.staminaPerLevel || 0) + conMod) * level,
                current: Math.max(0, (classData.staminaPerLevel || 0) + conMod) * level,
                temp: 0
            };

            // Store class features
            if (classData.features) {
                this.data.classFeatures = this.data.classFeatures || [];
                this.data.classFeatures.push(...classData.features);
            }

        } catch (error) {
            console.error('Error fetching class:', error);
        }

        return this;
    }

    /**
     * Fetch and apply subclass data
     */
    async fetchSubclass() {
        if (!this.data.subclassType) return this;

        try {
            const subclass = await this._queryDatabase('subclasses', 'findOne', { name: this.data.subclassType });
            this.fetchedData.subclass = subclass;

            // Store subclass features
            if (subclass.features) {
                this.data.classFeatures = this.data.classFeatures || [];
                this.data.classFeatures.push(...subclass.features);
            }

        } catch (error) {
            console.error('Error fetching subclass:', error);
        }

        return this;
    }

    /**
     * Fetch and apply background data
     */
    async fetchBackground() {
        if (!this.data.background) return this;

        try {
            const background = await this._queryDatabase('backgrounds', 'findOne', { name: this.data.background });
            this.fetchedData.background = background;

            // Backgrounds might provide skill proficiencies or equipment
            if (background.features) {
                this.data.abilities = this.data.abilities || [];
                this.data.abilities.push(...background.features);
            }

        } catch (error) {
            console.error('Error fetching background:', error);
        }

        return this;
    }

    /**
     * Fetch all equipped items
     */
    async fetchEquippedItems() {
        if (!this.data.equippedItemIds || this.data.equippedItemIds.length === 0) {
            return this;
        }

        try {
            const itemPromises = this.data.equippedItemIds.map(itemId =>
                this._queryDatabase('items', 'findById', { _id: itemId })
            );

            const items = await Promise.all(itemPromises);
            this.data.equippedItems = items.filter(item => item !== null);
            this.fetchedData.equippedItems = this.data.equippedItems;

        } catch (error) {
            console.error('Error fetching equipped items:', error);
            this.data.equippedItems = [];
        }

        return this;
    }

    /**
     * Process all active effects and aggregate modifiers
     * This gathers modifiers from items, abilities, and status effects
     */
    processActiveEffects() {
        // Initialize modifiers array if not present
        this.data.modifiers = this.data.modifiers || [];

        // Note: We don't aggregate here anymore - the CHARACTER class
        // will dynamically gather modifiers from all sources via getModifiersForHook()
        // This keeps the data clean and prevents duplication

        return this;
    }

    /**
     * Build the final CHARACTER instance
     * @returns {CHARACTER} Fully hydrated character
     */
    async build() {
        if (!this.data) {
            throw new Error('No character data loaded. Call loadCharacterData() first.');
        }

        // Fetch all associated data
        await this.fetchRace();
        await this.fetchSubrace();
        await this.fetchClass();
        await this.fetchSubclass();
        await this.fetchBackground();
        await this.fetchEquippedItems();
        
        // Process effects
        this.processActiveEffects();

        // Create and return CHARACTER instance
        const character = new CHARACTER(this.data);

        // Clean up
        this.data = null;
        this.fetchedData = {
            race: null,
            subrace: null,
            class: null,
            subclass: null,
            background: null,
            equippedItems: [],
        };

        return character;
    }

    /**
     * Convenience method to build from character ID
     * @param {string} characterId - MongoDB _id of the character
     * @returns {CHARACTER} Fully hydrated character
     */
    async buildFromId(characterId) {
        const characterData = await this._queryDatabase('characters', 'findById', { _id: characterId });
        
        if (!characterData) {
            throw new Error(`Character not found: ${characterId}`);
        }

        this.loadCharacterData(characterData);
        return await this.build();
    }
}

module.exports = CharacterBuilder;