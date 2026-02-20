const gameEvents = require('../../handlers/gameEventEmitter');

class CHARACTER {
    constructor(data) {

        this._baseStats = { ...data.stats };
        
  
        this.name = data.name;
        this.id = data.id;
        this.level = data.level || 1;
        this.classType = data.classType;
        this.subclassType = data.subclassType || null;
        this.race = data.race;
        this.subrace = data.subrace || null;
        this.background = data.background || null;
        

        this._baseHP = data.HP || { max: 0, current: 0, temp: 0 };
        this._baseMP = data.MP || { max: 0, current: 0, temp: 0 };
        this._baseSTA = data.STA || { max: 0, current: 0, temp: 0 };
        

        this.movement = data.movement || 30;
        this.position = data.position || { x: 0, y: 0, z: 0 };
        

        this.abilities = data.abilities || [];
        this.equipment = data.equipment || [];
        this.inventory = data.inventory || [];
        this.statusEffects = data.statusEffects || [];
        this.equippedItems = data.equippedItems || [];
        this.classFeatures = data.classFeatures || [];
        this.raceFeatures = data.raceFeatures || [];
        this.skills = data.skillIds || data.skills || { active: {}, passive: {} };
        this.effects = data.effects || [];
        this.inv = data.inv || { equipment: [], items: {} };
        this._savedActions = Array.isArray(data.actions) ? data.actions : [];
        
        // Base modifiers (manually added, non-source modifiers)
        this._baseModifiers = data.modifiers || [];
        
        // Cache for performance
        this._cache = {};
        this._isDirty = true;

        // Dynamic action system (backend authoritative)
        this._actionDefinitions = [];
        this._actionById = new Map();
        this._actionByPath = new Map();
        this.actionTree = {};
        this.action = {};
        this.actions = [];
        this.rebuildActionTree();
    }

    invalidateCache() {
        this._isDirty = true;
        this._cache = {};
    }

    _toIdKey(value, fallback = 'action') {
        const normalized = String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
        return normalized || fallback;
    }

    _toPathKey(value, fallback = 'action') {
        const cleaned = String(value || '')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[^a-zA-Z0-9]+/g, ' ')
            .trim();
        if (!cleaned) return fallback;

        const parts = cleaned.split(/\s+/g).filter(Boolean);
        if (parts.length === 0) return fallback;

        return parts
            .map((part, index) => {
                const token = part.toLowerCase();
                if (index === 0) return token;
                return token.charAt(0).toUpperCase() + token.slice(1);
            })
            .join('');
    }

    _toDisplayName(value) {
        return String(value || '')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    _readProperty(properties, key) {
        if (!properties) return undefined;
        if (typeof properties.get === 'function') {
            return properties.get(key);
        }
        return properties[key];
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

    _normalizeActionType(actionType) {
        const normalized = String(actionType || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '');

        switch (normalized) {
            case 'move':
            case 'movement':
                return 'movement';
            case 'bonus':
            case 'bonusaction':
                return 'bonusAction';
            case 'reaction':
                return 'reaction';
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

    _tabFromActionType(actionType) {
        switch (this._normalizeActionType(actionType)) {
            case 'movement':
                return 'movement';
            case 'bonusAction':
                return 'bonus';
            case 'reaction':
                return 'reaction';
            case 'free':
                return 'free';
            case 'passive':
                return 'passive';
            default:
                return 'main';
        }
    }

    _toLookupId(value) {
        if (!value) return '';
        if (typeof value === 'string' || typeof value === 'number') return String(value);
        if (typeof value === 'object') {
            if (value.$oid) return String(value.$oid);
            if (value._id?.$oid) return String(value._id.$oid);
            if (value._id) return String(value._id);
            if (value.id) return String(value.id);
            if (value.itemId) return String(value.itemId);
        }
        return String(value);
    }

    _cloneActionMeta(actionDefinition) {
        return {
            id: actionDefinition.id,
            path: actionDefinition.path,
            pathSegments: [...actionDefinition.pathSegments],
            tab: actionDefinition.tab,
            actionType: actionDefinition.actionType,
            name: actionDefinition.name,
            source: actionDefinition.source,
            sourceId: actionDefinition.sourceId,
            description: actionDefinition.description,
            cost: actionDefinition.cost,
            requirements: [...(actionDefinition.requirements || [])],
            enabled: actionDefinition.enabled !== false
        };
    }

    _registerAction(definition) {
        if (!definition || definition.enabled === false) {
            return;
        }

        const actionType = this._normalizeActionType(definition.actionType);
        const tab = this._tabFromActionType(actionType);
        const rawPath = Array.isArray(definition.path) && definition.path.length > 0
            ? definition.path
            : [tab, definition.id || definition.name];
        const pathSegments = rawPath
            .map((segment) => this._toPathKey(segment))
            .filter(Boolean);

        if (pathSegments.length === 0) {
            pathSegments.push(tab, `action${this._actionDefinitions.length + 1}`);
        }
        if (pathSegments[0] !== tab) {
            pathSegments.unshift(tab);
        }

        let id = this._toIdKey(definition.id || pathSegments.join('_'), `action_${this._actionDefinitions.length + 1}`);
        let idCounter = 2;
        while (this._actionById.has(id)) {
            id = `${id}_${idCounter}`;
            idCounter += 1;
        }

        let path = pathSegments.join('.');
        let pathCounter = 2;
        while (this._actionByPath.has(path)) {
            const nextSegments = [...pathSegments];
            nextSegments[nextSegments.length - 1] = `${nextSegments[nextSegments.length - 1]}${pathCounter}`;
            path = nextSegments.join('.');
            pathCounter += 1;
        }

        const normalized = {
            id,
            path,
            pathSegments: path.split('.'),
            tab,
            actionType,
            name: String(definition.name || this._toDisplayName(id)),
            source: String(definition.source || 'core'),
            sourceId: String(definition.sourceId || ''),
            description: String(definition.description || ''),
            cost: String(definition.cost || ''),
            requirements: this._toStringArray(definition.requirements),
            enabled: definition.enabled !== false,
            execute: typeof definition.execute === 'function'
                ? definition.execute
                : ((params = {}) => ({
                    success: true,
                    actionId: id,
                    actionPath: path,
                    params
                }))
        };

        this._actionDefinitions.push(normalized);
        this._actionById.set(id, normalized);
        this._actionByPath.set(path, normalized);
    }

    _buildActionTrie() {
        const root = {
            key: 'root',
            path: '',
            children: new Map(),
            action: null
        };

        this._actionDefinitions.forEach((definition) => {
            let cursor = root;
            definition.pathSegments.forEach((segment, index) => {
                if (!cursor.children.has(segment)) {
                    const nextPath = definition.pathSegments.slice(0, index + 1).join('.');
                    cursor.children.set(segment, {
                        key: segment,
                        path: nextPath,
                        children: new Map(),
                        action: null
                    });
                }
                cursor = cursor.children.get(segment);
            });
            cursor.action = definition;
        });

        return root;
    }

    _trieNodeToActionApi(node) {
        let base = {};

        if (node.action) {
            const executable = (params = {}) => this.executeAction(node.action.id, params);
            executable.meta = this._cloneActionMeta(node.action);
            base = executable;
        }

        node.children.forEach((childNode, key) => {
            base[key] = this._trieNodeToActionApi(childNode);
        });

        if (typeof base === 'function') {
            base.list = () => {
                const childActions = [];
                node.children.forEach((childNode) => {
                    if (childNode.action) {
                        childActions.push(this._cloneActionMeta(childNode.action));
                    }
                });
                return childActions;
            };
        }

        return base;
    }

    _trieNodeToTree(node) {
        const children = [];
        node.children.forEach((childNode) => {
            children.push(this._trieNodeToTree(childNode));
        });

        const out = {
            key: node.key,
            path: node.path,
            label: this._toDisplayName(node.key),
            children
        };

        if (node.action) {
            out.action = this._cloneActionMeta(node.action);
        }

        return out;
    }

    _isWeaponItem(item) {
        const typeValue = String(item?.type || this._readProperty(item?.properties, 'type') || '').toLowerCase();
        if (typeValue.includes('weapon')) return true;

        const attributes = Array.isArray(item?.attributes) ? item.attributes : [];
        return attributes.some((entry) => String(entry || '').toLowerCase().includes('weapon'));
    }

    _inventoryItemsAsArray() {
        if (Array.isArray(this.inventory)) {
            return this.inventory;
        }
        if (this.inventory && typeof this.inventory === 'object') {
            return Object.values(this.inventory);
        }
        return [];
    }

    _resolveItem(itemRef) {
        if (!itemRef) return null;
        if (typeof itemRef === 'object') return itemRef;

        const requestedId = this._toLookupId(itemRef);
        const allItems = [
            ...(Array.isArray(this.equippedItems) ? this.equippedItems : []),
            ...this._inventoryItemsAsArray()
        ];

        return allItems.find((item) => {
            const itemId = this._toLookupId(item?.id || item?._id || item?.itemId);
            return itemId === requestedId;
        }) || null;
    }

    _resolveWeapon(weaponRef) {
        if (weaponRef && typeof weaponRef === 'object') return weaponRef;

        if (!weaponRef) {
            return (this.equippedItems || []).find((item) => this._isWeaponItem(item)) || null;
        }

        const requestedId = this._toLookupId(weaponRef);
        return (this.equippedItems || []).find((item) => {
            if (!this._isWeaponItem(item)) return false;
            const itemId = this._toLookupId(item?.id || item?._id || item?.itemId);
            return itemId === requestedId;
        }) || null;
    }

    _resolveAbility(abilityRef) {
        if (!abilityRef) return null;
        if (typeof abilityRef === 'object') return abilityRef;

        const requestedId = this._toLookupId(abilityRef).toLowerCase();
        return (this.abilities || []).find((ability) => {
            const abilityId = this._toLookupId(ability?.id || ability?.abilityId || ability?.name).toLowerCase();
            return abilityId === requestedId;
        }) || null;
    }

    _resolveTarget(params = {}) {
        if (params.target && typeof params.target === 'object') {
            return params.target;
        }

        const targetId = this._toLookupId(params.targetId || params.target || params.targetID);
        if (!targetId) return null;

        if (params.characters && typeof params.characters.get === 'function') {
            return params.characters.get(targetId) || null;
        }

        if (params.combatEngine?.characters && typeof params.combatEngine.characters.get === 'function') {
            return params.combatEngine.characters.get(targetId) || null;
        }

        return null;
    }

    _extractItemSpells(item) {
        const properties = item?.properties;
        const candidates = [
            this._readProperty(properties, 'spells'),
            this._readProperty(properties, 'spellList'),
            this._readProperty(properties, 'spellbook'),
            this._readProperty(properties, 'spellBook'),
            item?.spells
        ];

        const raw = candidates.find((entry) => entry !== undefined && entry !== null);
        if (!raw) return [];

        const normalizeSpell = (spell, index) => {
            if (!spell) return null;

            if (typeof spell === 'string') {
                return {
                    id: this._toIdKey(spell, `spell_${index + 1}`),
                    name: this._toDisplayName(spell),
                    description: '',
                    actionType: 'action',
                    mpCost: 0
                };
            }

            if (typeof spell === 'object') {
                const name = String(spell.name || spell.id || `Spell ${index + 1}`);
                return {
                    id: this._toIdKey(spell.id || name, `spell_${index + 1}`),
                    name: this._toDisplayName(name),
                    description: String(spell.description || ''),
                    actionType: this._normalizeActionType(spell.actionType || spell.type || 'action'),
                    mpCost: Number(spell.mpCost || spell.cost?.mp || 0) || 0,
                    effectType: spell.effectType,
                    damage: spell.damage,
                    damageType: spell.damageType,
                    healing: spell.healing,
                    effect: spell.effect
                };
            }

            return null;
        };

        if (Array.isArray(raw)) {
            return raw
                .map((spell, index) => normalizeSpell(spell, index))
                .filter(Boolean);
        }

        if (typeof raw === 'string') {
            return raw
                .split(/[\n,]/g)
                .map((entry) => entry.trim())
                .filter(Boolean)
                .map((entry, index) => normalizeSpell(entry, index))
                .filter(Boolean);
        }

        if (typeof raw === 'object') {
            return Object.entries(raw)
                .map(([key, value], index) => {
                    if (typeof value === 'string') {
                        return normalizeSpell({ id: key, name: key, description: value }, index);
                    }
                    if (value && typeof value === 'object') {
                        return normalizeSpell({ ...value, id: value.id || key, name: value.name || key }, index);
                    }
                    return normalizeSpell({ id: key, name: key }, index);
                })
                .filter(Boolean);
        }

        return [];
    }

    _extractItemUses(item) {
        const uses = this._readProperty(item?.properties, 'uses');
        if (!uses) return [];

        if (Array.isArray(uses)) {
            return uses.map((entry, index) => {
                if (typeof entry === 'string') {
                    return {
                        id: this._toIdKey(entry, `use_${index + 1}`),
                        name: this._toDisplayName(entry),
                        description: ''
                    };
                }
                if (entry && typeof entry === 'object') {
                    const name = String(entry.name || entry.id || `Use ${index + 1}`);
                    return {
                        id: this._toIdKey(entry.id || name, `use_${index + 1}`),
                        name: this._toDisplayName(name),
                        description: String(entry.description || ''),
                        actionType: this._normalizeActionType(entry.actionType || entry.type || 'action'),
                        effect: entry.effect
                    };
                }
                return null;
            }).filter(Boolean);
        }

        if (typeof uses === 'string') {
            return [{
                id: this._toIdKey(uses, 'use_1'),
                name: this._toDisplayName(uses),
                description: ''
            }];
        }

        return [];
    }

    _normalizeSavedAction(entry, index) {
        const source = typeof entry === 'string'
            ? { name: entry }
            : (entry && typeof entry === 'object' ? entry : null);
        if (!source) return null;

        const name = String(source.name || source.label || source.title || '').trim();
        if (!name) return null;

        const actionType = this._normalizeActionType(source.actionType || source.type || source.kind || 'action');
        const tab = this._tabFromActionType(actionType);
        const baseKey = this._toPathKey(source.id || name, `customAction${index + 1}`);

        let pathSegments;
        if (Array.isArray(source.path) && source.path.length > 0) {
            pathSegments = source.path.map((segment) => this._toPathKey(segment)).filter(Boolean);
        } else if (typeof source.path === 'string' && source.path.trim()) {
            pathSegments = source.path
                .split('.')
                .map((segment) => this._toPathKey(segment))
                .filter(Boolean);
        } else if (source.group) {
            pathSegments = [tab, this._toPathKey(source.group), baseKey];
        } else {
            pathSegments = [tab, baseKey];
        }

        return {
            id: this._toIdKey(source.id || name, `custom_action_${index + 1}`),
            name,
            path: pathSegments,
            tab,
            actionType,
            source: String(source.source || 'custom'),
            sourceId: String(source.sourceId || ''),
            description: String(source.description || ''),
            cost: String(source.cost || ''),
            requirements: this._toStringArray(source.requirements),
            enabled: source.enabled !== false,
            hook: source.hook || '',
            payload: source.payload
        };
    }

    _isActionableDescription(description) {
        const text = String(description || '').toLowerCase();
        if (!text) return false;
        return /as an action|use an action|bonus action|reaction|on your turn|you can use|you can cast/.test(text);
    }

    _inferActionTypeFromText(textValue) {
        const text = String(textValue || '').toLowerCase();
        if (text.includes('bonus action')) return 'bonusAction';
        if (text.includes('reaction')) return 'reaction';
        if (text.includes('move') || text.includes('movement')) return 'movement';
        if (text.includes('free action')) return 'free';
        return 'action';
    }

    _buildCoreActionDefinitions() {
        return [
            {
                id: 'movement_walk',
                name: 'Walk',
                path: ['movement', 'walk'],
                actionType: 'movement',
                source: 'core',
                description: 'Move your position normally.',
                execute: (params = {}) => this._executeMovementMode('walk', params)
            },
            {
                id: 'movement_run',
                name: 'Run',
                path: ['movement', 'run'],
                actionType: 'movement',
                source: 'core',
                description: 'Move quickly (higher movement commitment).',
                execute: (params = {}) => this._executeMovementMode('run', params)
            },
            {
                id: 'movement_dash',
                name: 'Dash',
                path: ['movement', 'dash'],
                actionType: 'movement',
                source: 'core',
                description: 'Double movement for this action.',
                execute: (params = {}) => this._executeMovementMode('dash', params)
            },
            {
                id: 'movement_jump',
                name: 'Jump',
                path: ['movement', 'jump'],
                actionType: 'movement',
                source: 'core',
                description: 'Move with vertical displacement.',
                execute: (params = {}) => this._executeMovementMode('jump', params)
            },
            {
                id: 'main_attack',
                name: 'Attack',
                path: ['main', 'attack'],
                actionType: 'action',
                source: 'core',
                description: 'Perform a weapon or unarmed attack.',
                execute: (params = {}) => this._executeAttackAction(params)
            },
            {
                id: 'main_cast',
                name: 'Cast',
                path: ['main', 'cast'],
                actionType: 'action',
                source: 'core',
                description: 'Cast a known ability or spell.',
                execute: (params = {}) => this._executeCastAction(params)
            },
            {
                id: 'main_use_item',
                name: 'Use Item',
                path: ['main', 'useItem'],
                actionType: 'action',
                source: 'core',
                description: 'Use an inventory or equipped item.',
                execute: (params = {}) => this._executeUseItemAction(params)
            }
        ];
    }

    _buildAttackDefinitions() {
        const weapons = (this.equippedItems || []).filter((item) => this._isWeaponItem(item));
        if (weapons.length === 0) {
            return [{
                id: 'attack_unarmed',
                name: 'Unarmed Strike',
                path: ['main', 'attack', 'with', 'unarmedStrike'],
                actionType: 'action',
                source: 'core',
                description: 'Attack without a weapon.',
                execute: (params = {}) => this._executeAttackAction(params)
            }];
        }

        return weapons.map((weapon, index) => {
            const weaponId = this._toLookupId(weapon?.id || weapon?._id || weapon?.itemId) || `weapon_${index + 1}`;
            const weaponKey = this._toPathKey(weapon?.name || weaponId, `weapon${index + 1}`);

            return {
                id: `attack_weapon_${this._toIdKey(weaponId, `weapon_${index + 1}`)}`,
                name: this._toDisplayName(weapon?.name || `Weapon ${index + 1}`),
                path: ['main', 'attack', 'with', weaponKey],
                actionType: 'action',
                source: 'item',
                sourceId: weaponId,
                description: `Attack using ${weapon?.name || 'equipped weapon'}.`,
                execute: (params = {}) => this._executeAttackAction({
                    ...params,
                    weapon,
                    weaponId
                })
            };
        });
    }

    _buildCastDefinitions() {
        const definitions = [];

        (this.abilities || []).forEach((ability, index) => {
            const abilityId = this._toLookupId(ability?.id || ability?.abilityId || ability?.name) || `ability_${index + 1}`;
            const abilityKey = this._toPathKey(ability?.name || abilityId, `spell${index + 1}`);
            definitions.push({
                id: `cast_ability_${this._toIdKey(abilityId, `ability_${index + 1}`)}`,
                name: this._toDisplayName(ability?.name || abilityId),
                path: ['main', 'cast', 'spells', abilityKey],
                actionType: ability?.actionType || 'action',
                source: 'ability',
                sourceId: abilityId,
                description: String(ability?.description || ''),
                execute: (params = {}) => this._executeCastAction({
                    ...params,
                    ability,
                    abilityId
                })
            });
        });

        (this.equippedItems || []).forEach((item, itemIndex) => {
            const itemId = this._toLookupId(item?.id || item?._id || item?.itemId) || `item_${itemIndex + 1}`;
            const itemKey = this._toPathKey(item?.name || itemId, `item${itemIndex + 1}`);
            const spells = this._extractItemSpells(item);

            spells.forEach((spell, spellIndex) => {
                const spellId = this._toLookupId(spell?.id || spell?.name) || `spell_${spellIndex + 1}`;
                const spellKey = this._toPathKey(spell?.name || spellId, `spell${spellIndex + 1}`);

                definitions.push({
                    id: `cast_book_${this._toIdKey(itemId)}_${this._toIdKey(spellId, `spell_${spellIndex + 1}`)}`,
                    name: this._toDisplayName(spell?.name || spellId),
                    path: ['main', 'cast', 'books', itemKey, spellKey],
                    actionType: spell?.actionType || 'action',
                    source: 'itemSpellbook',
                    sourceId: itemId,
                    description: String(spell?.description || `Cast from ${item?.name || 'equipped spellbook'}.`),
                    execute: (params = {}) => this._executeCastAction({
                        ...params,
                        ability: {
                            id: spellId,
                            name: spell?.name || spellId,
                            description: spell?.description || '',
                            mpCost: spell?.mpCost || 0,
                            effectType: spell?.effectType,
                            damage: spell?.damage,
                            damageType: spell?.damageType,
                            healing: spell?.healing,
                            effect: spell?.effect
                        },
                        abilityId: spellId,
                        sourceItemId: itemId
                    })
                });
            });
        });

        return definitions;
    }

    _buildItemDefinitions() {
        const definitions = [];
        const allItems = [
            ...(Array.isArray(this.equippedItems) ? this.equippedItems : []),
            ...this._inventoryItemsAsArray()
        ];

        allItems.forEach((item, itemIndex) => {
            const itemId = this._toLookupId(item?.id || item?._id || item?.itemId) || `item_${itemIndex + 1}`;
            const itemKey = this._toPathKey(item?.name || itemId, `item${itemIndex + 1}`);
            const uses = this._extractItemUses(item);

            uses.forEach((useEntry, useIndex) => {
                const useId = this._toIdKey(useEntry?.id || useEntry?.name, `use_${useIndex + 1}`);
                const useKey = this._toPathKey(useEntry?.name || useId, `use${useIndex + 1}`);

                definitions.push({
                    id: `item_use_${this._toIdKey(itemId)}_${useId}`,
                    name: this._toDisplayName(useEntry?.name || useId),
                    path: ['main', 'useItem', 'items', itemKey, useKey],
                    actionType: useEntry?.actionType || 'action',
                    source: 'item',
                    sourceId: itemId,
                    description: String(useEntry?.description || ''),
                    execute: (params = {}) => this._executeUseItemAction({
                        ...params,
                        item,
                        itemId,
                        use: useEntry
                    })
                });
            });
        });

        return definitions;
    }

    _buildSavedDefinitions() {
        const definitions = [];
        (this._savedActions || []).forEach((entry, index) => {
            const normalized = this._normalizeSavedAction(entry, index);
            if (!normalized) return;

            definitions.push({
                id: normalized.id,
                name: normalized.name,
                path: normalized.path,
                actionType: normalized.actionType,
                source: normalized.source,
                sourceId: normalized.sourceId,
                description: normalized.description,
                cost: normalized.cost,
                requirements: normalized.requirements,
                enabled: normalized.enabled,
                execute: (params = {}) => this._runSavedAction(normalized, params)
            });
        });

        return definitions;
    }

    _buildFeatureDefinitions() {
        const definitions = [];
        const featureBuckets = [
            ...(Array.isArray(this.classFeatures) ? this.classFeatures : []),
            ...(Array.isArray(this.raceFeatures) ? this.raceFeatures : [])
        ];

        featureBuckets.forEach((feature, index) => {
            if (!feature || typeof feature !== 'object') return;
            const name = String(feature.name || feature.id || '').trim();
            if (!name) return;
            if (!this._isActionableDescription(feature.description)) return;

            const actionType = this._inferActionTypeFromText(feature.description);
            const tab = this._tabFromActionType(actionType);
            const featureId = this._toIdKey(feature.id || name, `feature_${index + 1}`);
            const featureKey = this._toPathKey(name, `feature${index + 1}`);

            definitions.push({
                id: `feature_action_${featureId}`,
                name: this._toDisplayName(name),
                path: [tab, 'features', featureKey],
                actionType,
                source: 'feature',
                sourceId: featureId,
                description: String(feature.description || ''),
                execute: (params = {}) => {
                    const context = {
                        character: this,
                        feature,
                        params,
                        result: {
                            success: true,
                            actionId: `feature_action_${featureId}`,
                            actionPath: [tab, 'features', featureKey].join('.'),
                            source: 'feature'
                        }
                    };

                    this.applyModifierPipeline(`onFeatureAction_${featureId}`, context);
                    this.applyModifierPipeline('onFeatureAction', context);

                    return context.result;
                }
            });
        });

        return definitions;
    }

    _buildSkillDefinitions() {
        const definitions = [];
        const activeSkills = this.skills?.active;
        if (!activeSkills || typeof activeSkills !== 'object') {
            return definitions;
        }

        Object.entries(activeSkills).forEach(([skillId, rawSkill], index) => {
            const skill = typeof rawSkill === 'string'
                ? { name: skillId, description: rawSkill }
                : (rawSkill && typeof rawSkill === 'object' ? rawSkill : { name: skillId });

            const name = String(skill.name || skillId || '').trim();
            if (!name) return;

            const actionType = this._normalizeActionType(skill.actionType || skill.type || this._inferActionTypeFromText(skill.description));
            const tab = this._tabFromActionType(actionType);
            const normalizedSkillId = this._toIdKey(skill.id || skillId || name, `skill_${index + 1}`);
            const skillKey = this._toPathKey(name, `skill${index + 1}`);

            definitions.push({
                id: `skill_action_${normalizedSkillId}`,
                name: this._toDisplayName(name),
                path: [tab, 'skills', skillKey],
                actionType,
                source: 'skill',
                sourceId: normalizedSkillId,
                description: String(skill.description || ''),
                execute: (params = {}) => {
                    const context = {
                        character: this,
                        skill,
                        params,
                        result: {
                            success: true,
                            actionId: `skill_action_${normalizedSkillId}`,
                            actionPath: [tab, 'skills', skillKey].join('.'),
                            source: 'skill'
                        }
                    };

                    this.applyModifierPipeline(`onSkillAction_${normalizedSkillId}`, context);
                    this.applyModifierPipeline('onSkillAction', context);

                    return context.result;
                }
            });
        });

        return definitions;
    }

    rebuildActionTree() {
        this._actionDefinitions = [];
        this._actionById = new Map();
        this._actionByPath = new Map();

        const groups = [
            this._buildCoreActionDefinitions(),
            this._buildAttackDefinitions(),
            this._buildCastDefinitions(),
            this._buildItemDefinitions(),
            this._buildFeatureDefinitions(),
            this._buildSkillDefinitions(),
            this._buildSavedDefinitions()
        ];

        groups.flat().forEach((definition) => this._registerAction(definition));

        const trie = this._buildActionTrie();
        const actionApi = {};
        const tree = {};

        trie.children.forEach((childNode, key) => {
            actionApi[key] = this._trieNodeToActionApi(childNode);
            tree[key] = this._trieNodeToTree(childNode);
        });

        this.action = actionApi;
        this.actionTree = tree;
        this.actions = this._actionDefinitions.map((definition) => this._cloneActionMeta(definition));

        return this.actionTree;
    }

    _runSavedAction(savedAction, params = {}) {
        const hookId = savedAction.hook || `onAction_${this._toIdKey(savedAction.id || savedAction.name)}`;
        const context = {
            character: this,
            action: savedAction,
            params,
            result: {
                success: true,
                actionId: savedAction.id,
                actionPath: Array.isArray(savedAction.path) ? savedAction.path.join('.') : '',
                source: savedAction.source
            }
        };

        this.applyModifierPipeline(hookId, context);
        this.applyModifierPipeline('onActionCustom', context);

        return context.result;
    }

    _executeMovementMode(mode, params = {}) {
        const previousPosition = { ...(this.position || { x: 0, y: 0, z: 0 }) };
        const nextPosition = { ...previousPosition };
        const context = {
            character: this,
            mode,
            params,
            previousPosition,
            nextPosition,
            distanceMultiplier: mode === 'dash' ? 2 : (mode === 'run' ? 1.5 : 1),
            heightDelta: Number(params.height || 0)
        };

        this.applyModifierPipeline('onMovementAction', context);
        this.applyModifierPipeline(`onMovement_${mode}`, context);

        if (params.position && typeof params.position === 'object') {
            if (Number.isFinite(Number(params.position.x))) context.nextPosition.x = Number(params.position.x);
            if (Number.isFinite(Number(params.position.y))) context.nextPosition.y = Number(params.position.y);
            if (Number.isFinite(Number(params.position.z))) context.nextPosition.z = Number(params.position.z);
        } else {
            if (Number.isFinite(Number(params.x))) context.nextPosition.x = Number(params.x);
            if (Number.isFinite(Number(params.y))) context.nextPosition.y = Number(params.y);
            if (Number.isFinite(Number(params.z))) context.nextPosition.z = Number(params.z);
        }

        if (mode === 'jump' && Number.isFinite(context.heightDelta)) {
            context.nextPosition.z = (context.nextPosition.z || 0) + context.heightDelta;
        }

        this.position = context.nextPosition;

        const result = {
            success: true,
            mode,
            previousPosition,
            position: { ...this.position },
            distanceMultiplier: context.distanceMultiplier
        };

        gameEvents.emitGameEvent('movementAction', {
            characterId: this.id,
            characterName: this.name,
            ...result
        });

        return result;
    }

    _executeAttackAction(params = {}) {
        const target = this._resolveTarget(params);
        if (!target) {
            return { success: false, message: 'Target is required for attack actions.' };
        }

        const weapon = this._resolveWeapon(params.weapon || params.weaponId) || {
            name: 'Unarmed Strike',
            damage: '1d1',
            damageType: 'bludgeoning'
        };

        return this.attack({
            ...params,
            target,
            weapon
        });
    }

    _executeCastAction(params = {}) {
        const ability = this._resolveAbility(params.ability || params.abilityId || params.spellId) || params.ability;
        if (!ability) {
            return { success: false, message: 'No ability or spell was provided.' };
        }

        const mpCost = Number(ability.mpCost || ability.cost?.mp || 0);
        if (mpCost > 0 && this._baseMP.current < mpCost) {
            return { success: false, message: 'Not enough MP.' };
        }

        if (mpCost > 0) {
            this._baseMP.current -= mpCost;
        }

        const target = this._resolveTarget(params) || this;
        const effectType = String(ability.effectType || '').toLowerCase();
        const result = {
            success: true,
            abilityId: this._toLookupId(ability.id || ability.abilityId || ability.name),
            abilityName: ability.name || 'Unknown Spell',
            mpCost,
            remainingMP: this._baseMP.current,
            targetId: this._toLookupId(target.id || target._id)
        };

        if (effectType === 'heal' && target?._baseHP) {
            const healing = this._rollDice({ dice: ability.healing || '1d4', advantage: 0 });
            target._baseHP.current = Math.min(target.HP.max, target.HP.current + healing);
            result.healing = healing;
            result.targetHP = target._baseHP.current;
        } else if (effectType === 'damage' && typeof target?.takeDamage === 'function') {
            const damage = this._rollDice({ dice: ability.damage || '1d4', advantage: 0 });
            target.takeDamage({
                damage: damage,
                damageParts: [{
                    dice: ability.damage || '1d4',
                    total: damage,
                    type: ability.damageType || 'force',
                    source: ability.name || 'spell'
                }],
                attacker: this
            });
            result.damage = damage;
        } else if (ability.effect && typeof target?.addStatusEffect === 'function') {
            target.addStatusEffect(ability.effect);
            result.effectApplied = ability.effect.name || 'effect';
        }

        this.applyModifierPipeline('onCastAction', {
            character: this,
            target,
            ability,
            params,
            result
        });

        gameEvents.emitGameEvent('castAction', {
            characterId: this.id,
            characterName: this.name,
            ...result
        });

        return result;
    }

    _executeUseItemAction(params = {}) {
        const item = this._resolveItem(params.item || params.itemId);
        if (!item) {
            return { success: false, message: 'Item not found.' };
        }

        const use = params.use || null;
        const result = {
            success: true,
            itemId: this._toLookupId(item.id || item._id || item.itemId),
            itemName: item.name || 'Unknown Item',
            useId: use ? this._toIdKey(use.id || use.name, 'use') : '',
            useName: use?.name || ''
        };

        const useLabel = String(use?.name || item?.effect || '').toLowerCase();
        if (useLabel.includes('heal') || item?.effect === 'heal') {
            const healing = this._rollDice({ dice: use?.healing || item?.healing || '1d4', advantage: 0 });
            this._baseHP.current = Math.min(this.HP.max, this.HP.current + healing);
            result.healing = healing;
            result.hp = this._baseHP.current;
        }

        this.applyModifierPipeline('onUseItemAction', {
            character: this,
            item,
            use,
            params,
            result
        });

        gameEvents.emitGameEvent('itemAction', {
            characterId: this.id,
            characterName: this.name,
            ...result
        });

        return result;
    }

    executeAction(actionRef, params = {}) {
        const aliasMap = {
            attack: 'main.attack',
            cast: 'main.cast',
            useitem: 'main.useItem',
            walk: 'movement.walk',
            run: 'movement.run',
            dash: 'movement.dash',
            jump: 'movement.jump'
        };

        const requested = String(
            params.actionPath ||
            params.actionId ||
            actionRef ||
            ''
        ).trim();

        if (!requested) {
            throw new Error('Action reference is required.');
        }

        const directById = this._actionById.get(this._toIdKey(requested));
        const directByPath = this._actionByPath.get(requested);
        const normalizedPath = requested
            .split('.')
            .map((segment) => this._toPathKey(segment))
            .filter(Boolean)
            .join('.');
        const normalizedByPath = this._actionByPath.get(normalizedPath);
        const aliasedPath = aliasMap[this._toIdKey(requested)];
        const byAlias = aliasedPath ? this._actionByPath.get(aliasedPath) : null;

        const resolved = directByPath || normalizedByPath || directById || byAlias;
        if (!resolved) {
            throw new Error(`Unknown action: ${requested}`);
        }

        return resolved.execute({
            ...params,
            actionId: resolved.id,
            actionPath: resolved.path
        });
    }

    getActionTree() {
        return this.actionTree;
    }

    _toExecutableModifierAction(actionValue, modifierName = 'Unknown Modifier') {
        if (typeof actionValue === 'function') return actionValue;
        if (typeof actionValue !== 'string') return null;

        const actionCode = actionValue.trim();
        if (!actionCode) return null;

        try {
            const compiled = new Function(`"use strict"; return (${actionCode});`)();
            if (typeof compiled === 'function') {
                return compiled;
            }
        } catch (error) {
            // Fall through to body-form parser.
        }

        try {
            return new Function('context', actionCode);
        } catch (error) {
            console.warn(`Modifier "${modifierName}" has invalid action code: ${error.message}`);
            return null;
        }
    }

    /**
     * Get all modifiers from all sources for a specific hook
     * @param {string} hookName - The hook to filter by (e.g., 'onStatCalc_STR')
     * @returns {Array} Sorted array of modifiers
     */
    getModifiersForHook(hookName) {
        const equippedItemSources = Array.isArray(this.equippedItems) ? this.equippedItems : [];
        const legacyEquipmentSources = Array.isArray(this.inv?.equipment)
            ? this.inv.equipment
            : Object.values(this.inv?.equipment || {});
        const equipmentSources = [...equippedItemSources, ...legacyEquipmentSources];
        const effectSources = Array.isArray(this.effects)
            ? this.effects
            : Object.values(this.effects || {});
        const passiveSkillSources = Array.isArray(this.skills?.passive)
            ? this.skills.passive
            : Object.values(this.skills?.passive || {});
        const classFeatureSources = Array.isArray(this.classFeatures)
            ? this.classFeatures
            : Object.values(this.classType?.classFeatures || {});
        const raceTraitSources = Array.isArray(this.raceFeatures)
            ? this.raceFeatures
            : Object.values(this.race?.traits || {});

        const allSources = [
            { modifiers: this._baseModifiers },
            ...equipmentSources,
            ...effectSources,
            ...passiveSkillSources,
            ...classFeatureSources,
            ...raceTraitSources,

        /** remember to add subclasses and also fix race.trait formating. Rn it's just a flat string, 
        * it needs to be an object with a modifiers array to work with this system
        *   Same with skills and passives
        *     as well as effects
        * all of these need to be formated in characterbuilder when we fetch the data, so that they can be properly processed here
        * everything needs to be formated as an object with a modifiers array, even if it's just a single modifier, to work with this system
        */
    ];

        return allSources
            .flatMap(source => source.modifiers || [])
            .filter(mod => mod.hook === hookName)
            .sort((a, b) => (a.priority || 100) - (b.priority || 100));
    }

    /**
     * Execute a modifier pipeline for a given hook
     * @param {string} hookName - The hook to execute
     * @param {object} context - The context object to pass through the pipeline
     * @returns {object} Modified context
     */
    applyModifierPipeline(hookName, context) {
        const modifiers = this.getModifiersForHook(hookName);
        
        modifiers.forEach(modifier => {
            try {
                let executableAction = modifier.action;
                if (typeof executableAction !== 'function') {
                    executableAction = this._toExecutableModifierAction(modifier.action, modifier.name);
                    if (executableAction) {
                        modifier.action = executableAction;
                    }
                }

                if (typeof executableAction === 'function') {
                    executableAction(context);
                } else {
                    console.warn(`Modifier "${modifier.name}" has no executable action`);
                }
            } catch (error) {
                console.error(`Error executing modifier "${modifier.name}":`, error);
            }
        });

        return context;
    }

    /**
     * Calculate a single stat through the modifier pipeline
     * @param {string} statName - The stat to calculate (STR, DEX, etc.)
     * @returns {object} { score: number, modifier: number }
     */
    _calculateStat(statName) {
        const context = {
            stat: statName,
            value: (this._baseStats[statName])|| 10,
            character: this
        };

        if (this.race && this.race.abilityScoreModifiers) {
            const modValue = this.race.abilityScoreModifiers[statName];
            
            if (modValue) {
                context.value += modValue;
            }
        }

        if (this.subrace && this.subrace.abilityScoreModifiers) {
            const modValue = this.subrace.abilityScoreModifiers[statName];
            if (modValue) {
                context.value += modValue;
            }
        }

        if (this.classType && this.classType.baseStatModifier) {
            const modValue = this.classType.baseStatModifier[statName];
            if (modValue) {
                context.value += modValue;
            }
        }

        // Run through the pipeline
        this.applyModifierPipeline(`onStatCalc_${statName}`, context);

        return {
            score: Math.max(1, Math.min(30, context.value)), // Clamp between 1-30
            modifier: Math.floor((context.value - 10) / 2)
        };
    }

    /**
     * GETTER: Effective Stats (calculated on-the-fly)
     * Returns all stats with their scores and modifiers
     */
    get stats() {
        if (!this._isDirty && this._cache.stats) {
            return this._cache.stats;
        }

        const calculated = {};
        const statNames = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA', 'LUCK'];

        for (const statName of statNames) {
            calculated[statName] = this._calculateStat(statName);
        }

        this._cache.stats = calculated;
        return calculated;
    }

    /**
     * GETTER: Proficiency Bonus
     */
    get proficiencyBonus() {
        return Math.ceil(this.level / 4) + 1;
    }

    /**
     * GETTER: Armor Class (calculated through pipeline)
     */
    get AR() {
        if (!this._isDirty && this._cache.AR !== undefined) {
            return this._cache.AR;
        }

        const context = {
            baseAR:{},
            character: this,
            armor: this.equippedItems.find(item => item.type === 'armor'),
            shield: this.equippedItems.find(item => item.type === 'shield')
        };

        // Apply armor base AC if equipped
        if (context.armor && context.armor.AR) {
            
            for(const part of context.armor.AR) {
                context.baseAR[part] = context.armor.AR[part];
            }
            
            
        }


            if(context.shield && context.shield.AR) {
                for(const part of context.shield.AR) {
                    context.baseAR[part] = (context.baseAR[part] || 0) + context.shield.AR[part];
                }
            }

        // Run through modifier pipeline
        this.applyModifierPipeline('onARCalc', context);

        this._cache.AR = context.AR;
        return context.AR;
    }

    get initiative() {
        const dexScore = this.stats?.DEX?.score ?? this.stats?.DEX?.total ?? this.stats?.DEX ?? 10;
        const context = {
            base: (dexScore - 10) / 2,
            character: this,
            roll:[{
                dice: '1d20',
                context: 'initiative roll'
            }]
        };

        this.applyModifierPipeline('onInitiativeCalc', context);

        for (const roll of context.roll) {
            context.base += this._rollDice(roll.dice);
        }

        return context.base;
    }

    /**
     * GETTER: Hit Points
     */
    get HP() {
        const conScore = this.stats?.CON?.score ?? this.stats?.CON?.total ?? this.stats?.CON ?? 10;
        const classHPBonus = this.classType?.resourcePoolModifier?.HP || 0;
        const context = {
            baseMax: this._baseHP.max,
            character: this,
            level: this.level,
            con: conScore,
            baseHPBonus: 0,
            classHPBonus: classHPBonus
        }

        this.applyModifierPipeline('onPreHPCalc', context);

        context.baseMax = context.con*(1+context.baseHPBonus+((context.level/2) * context.classHPBonus)); // Example HP scaling

        this.applyModifierPipeline('onHPCalc', context);

        return {
            max: context.baseMax,
            current: this._baseHP.current,
            temp: this._baseHP.temp
        };
    }

    /**
     * GETTER: Magic Points
     */
    get MP() {
        const wisModifier = this.stats?.WIS?.modifier ?? Math.floor(((this.stats?.WIS?.score ?? this.stats?.WIS?.total ?? this.stats?.WIS ?? 10) - 10) / 2);
        const classMPBonus = this.classType?.resourcePoolModifier?.MP || 0;
        const context = {
            baseMax: this._baseMP.max,
            character: this,
            level: this.level,
            wis: wisModifier,
            baseMPBonus: 0,
            classMPBonus: classMPBonus

        };

        this.applyModifierPipeline('onPreMPCalc', context);

        context.baseMax = context.wis*(1+context.baseMPBonus+((context.level/2) * context.classMPBonus)); // Example MP scaling

        this.applyModifierPipeline('onMPCalc', context);

        return {
            max: context.baseMax,
            current: this._baseMP.current,
            temp: this._baseMP.temp
        };
    }

    /**
     * GETTER: Stamina
     */
    get STA() {
        const conScore = this.stats?.CON?.score ?? this.stats?.CON?.total ?? this.stats?.CON ?? 10;
        const classSTABonus = this.classType?.resourcePoolModifier?.STA || 0;
        const context = {
            baseMax: this._baseSTA.max,
            character: this,
            level: this.level,
            con: conScore,
            baseSTABonus: 0,
            classSTABonus: classSTABonus
        };

        this.applyModifierPipeline('onPreSTACalc', context);

            context.baseMax = 2 * context.con * (1+context.baseSTABonus+((context.level/2) * context.classSTABonus)); // Example STA scaling

        this.applyModifierPipeline('onSTACalc', context);

        return {
            max: context.baseMax,
            current: this._baseSTA.current,
            temp: this._baseSTA.temp
        };
    }

    /**
     * Dice rolling utility
     */
_rollDice(context) {
    // 1. Parse the dice string
    const [countStr, sidesStr] = context.dice.toLowerCase().split('d');
    const count = Number(countStr) || 1;
    const sides = Number(sidesStr) || 20;
    let total = 0;

    for (let i = 0; i < count; i++) {
        let currentRolls = [];
        
        // 2. Determine how many dice to throw for this specific "count"
        // If advantage is 1, we roll 2 dice. If 0, we roll 1.
        const numToRoll = Math.abs(context.advantage || 0) + 1;

        for (let j = 0; j < numToRoll; j++) {
            currentRolls.push(Math.floor(Math.random() * sides) + 1);
        }

        // 3. Pick the result based on advantage/disadvantage/normal
        if (context.advantage > 0) {
            total += Math.max(...currentRolls);
        } else if (context.advantage < 0) {
            total += Math.min(...currentRolls);
        } else {
            total += currentRolls[0]; // Normal roll
        }
    }

    return total;
}

    /**
     * Main action handler
     */
    getAvailableActions() {
        return (this.actions || []).filter((entry) => entry?.enabled !== false);
    }

    action(actionType, params = {}) {
        return this.executeAction(actionType, params);
    }

    /**
     * Attack action with full pipeline support
     */


    check(params){
        
        const context = {
            character: this,
            checkType: params.checkType, // e.g., 'stealth', 'perception', etc.
            baseValue: 0,
            roll: [{
                dice: '1d20',
                context: 'check roll'
            }],
            advantage: 0,
            DC: params.DC || 10,
            success: false
        };

        



    }


    attack(params) {
        const context = {
            attacker: this,
            target: params.target,
            weapon: params.weapon || { name: 'Unarmed Strike', damage: '1d1', type: 'bludgeoning' },
            
            // Attack Roll
            attackRoll: [{
                dice: '1d20',
                context: 'attack roll',
            }],
            baseAC:0,
            AC:0,
            attackBonus: 0,
            advantage: 0,
            
            // Damage
            damageParts: [
                ...params.damageParts,
                {
                    dice: params.weapon?.damage || '1d1',
                    type: params.weapon?.damageType || 'bludgeoning',
                    source: 'weapon'
                }
            ],
            flatBonus: [{

            }],
            damageAdvantage:0,
            
            isCrit: 0,
            hits: false
        };

        // Phase 1: Pre-Attack (modify attack roll)
        gameEvents.emitGameEvent('preAttack', { attacker: this.name, target: params.target.name });
        this.applyModifierPipeline('onAttackRoll', context);


            for (const roll of context.attackRoll) {
                // We call the helper and store the result in a new "roll" property
                const result = this._rollDice({dice:roll.dice, advantage: context.advantage});
                
                // This adds the 'roll' key to the object inside the array
                roll.roll = typeof result === 'number' ? result : (result?.total || 0); 
                
                // Optional: Store the raw dice if you want to check for Crits later
                roll.natural = roll.roll; 
            }

            if (context.attackRoll.find(r=>r.context === 'attack roll')?.roll === 20) {
                context.isCrit += 1;
            }

        this.applyModifierPipeline('onACCalc', context);

        for (const roll of context.attackRoll) {
            context.baseAC += roll.roll
        }

        context.AC = context.baseAC + context.attackBonus;

        context.hits = params.target.reaction({
            attackContext:context
        });

        if (context.hits) {
            // Phase 2: Damage Calculation
            this.applyModifierPipeline('onDamageCalc', context);

            for (const part of context.damageParts) {
                part.total = this._rollDice({dice:part.dice, advantage: context.damageAdvantage});
                for(let i = 0; i<context.isCrit; i++) {
                    part.total += this._rollDice({dice:part.dice, advantage: 99});
                }
            }

            params.target.takeDamage({
                damageParts: context.damageParts,
                flatBonus: context.flatBonus,
                attacker: this,
                isCrit: context.isCrit
            });

            const totalDamage = context.damageParts.reduce((sum, part) => sum + (part.total || 0), 0) +
                context.flatBonus.reduce((sum, bonus) => sum + (bonus.value || 0), 0);
            context.totalDamage = totalDamage;

            gameEvents.emitGameEvent('attack', {
                attacker: this.name,
                target: params.target.name,
                damage: totalDamage,
                isCrit: context.isCrit
            });
        } else {
            context.totalDamage = 0;
            gameEvents.emitGameEvent('attackMiss', {
                attacker: this.name,
                target: params.target.name
            });
        }

        return context;
    }

    /**
     * Take damage with full pipeline support
     */
    takeDamage(damageInfo) {
        const context = {
            target: this,
            attacker: damageInfo.attacker,
            damageParts: damageInfo.damageParts || [],
            flatBonus: damageInfo.flatBonus || [],
            finalDamage: damageInfo.damage,
            isCrit: damageInfo.isCrit || 0,
            
            // Resistance tracking
            resistances: {},
            immunities: {},
            ar: this.AR || {}
        };

        // Run defensive pipeline
        this.applyModifierPipeline('onTakeDamage', context);

        for (const part of context.damageParts) {
            if (context.immunities[part.type]) {
                part.total = 0;
            }
            else if (context.resistances[part.type]) {
                part.total = Math.floor(part.total * (0.95^context.resistances[part.type])); // Example: each resistance level reduces damage by 20%
            }

            if(context.ar[part.type]) {
                part.total = Math.max(0, part.total - context.ar[part.type]);
            }
            context.finalDamage += part.total;
        }

        for (const bonus of context.flatBonus) {

            if(context.immunities[bonus.type]) {
                bonus.value = 0;
            }
            else if (context.resistances[bonus.type]) {
                bonus.value = Math.floor(bonus.value * (0.95^context.resistances[bonus.type]));
            }
            if(context.ar[bonus.type]) {
                bonus.value = Math.max(0, bonus.value - context.ar[bonus.type]);
            }
            
            context.finalDamage += (bonus.value * (context?.isCrit || 1) * context.damageParts.length);
        }




        // Apply final damage
        const actualDamage = Math.max(1, Math.floor(context.finalDamage));
        
        // First apply to temp HP
        if (this._baseHP.temp > 0) {
            const tempDamage = Math.min(actualDamage, this._baseHP.temp);
            this._baseHP.temp -= tempDamage;
            const remaining = actualDamage - tempDamage;
            this._baseHP.current = Math.max(0, this._baseHP.current - remaining);
        } else {
            this._baseHP.current = Math.max(0, this._baseHP.current - actualDamage);
        }

        if (this._baseHP.current === 0) {
            gameEvents.emitGameEvent('characterDown', {
                target: this.name
            });
        }

        gameEvents.emitGameEvent('damageTaken', {
            target: this.name,
            damage: actualDamage,
            remaining: this._baseHP.current
        });

        return context;
    }

    /**
     * Add a status effect
     */
    addStatusEffect(effect) {
        this.statusEffects.push(effect);
        this.invalidateCache();
        gameEvents.emitGameEvent('statusEffectAdded', {
            target: this.name,
            effect: effect.name
        });
    }

    /**
     * Remove a status effect
     */
    removeStatusEffect(effectName) {
        this.statusEffects = this.statusEffects.filter((effect) => effect.name !== effectName);
        this.invalidateCache();
        gameEvents.emitGameEvent('statusEffectRemoved', {
            target: this.name,
            effect: effectName
        });
    }

    /**
     * Equip an item
     */
    equipItem(item) {
        this.equippedItems.push(item);
        this.rebuildActionTree();
        this.invalidateCache();
    }

    /**
     * Unequip an item
     */
    unequipItem(itemName) {
        this.equippedItems = this.equippedItems.filter((item) => item.name !== itemName);
        this.rebuildActionTree();
        this.invalidateCache();
    }

    setAbilities(abilities = []) {
        this.abilities = Array.isArray(abilities) ? abilities : [];
        this.rebuildActionTree();
    }

    setSavedActions(actions = []) {
        this._savedActions = Array.isArray(actions) ? actions : [];
        this.rebuildActionTree();
    }
}

module.exports = CHARACTER;