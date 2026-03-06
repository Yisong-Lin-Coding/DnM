const gameEvents = require('../../handlers/gameEventEmitter');
const EFFECTS = require('../../data/gameFiles/modifiers/effects');
const { flat } = require('../../data/gameFiles/modifiers/enchantments');

const DEFAULT_WORLD_UNITS_PER_FOOT = 10;

const MOVEMENT_MODE_CONFIG = {
    walk:   { name: 'Walk',   speedMultiplier: 1, staPer10Ft: 1,   description: 'Move your position normally.' },
    jog:    { name: 'Jog',    speedMultiplier: 2, staPer10Ft: 5,   description: 'Move at a brisk pace.' },
    run:    { name: 'Run',    speedMultiplier: 3, staPer10Ft: 25,  description: 'Move quickly (high effort).' },
    sprint: { name: 'Sprint', speedMultiplier: 4, staPer10Ft: 125, description: 'All-out burst of speed.' },
    jump:   { name: 'Jump',   speedMultiplier: 1, staPer10Ft: 1,   description: 'Move with vertical displacement.' }
}; 

const getMovementModeConfig = (mode) => {
    const key = String(mode || '').trim().toLowerCase();
    return MOVEMENT_MODE_CONFIG[key] || null;
};

const formatMovementCost = (config) => {
    if (!config) return '';
    const staCost = Number(config.staPer10Ft) || 0;
    const speed   = Number(config.speedMultiplier) || 1;
    const parts   = [];
    if (staCost > 0) parts.push(`${staCost} STA per 10 ft`);
    if (speed   > 0) parts.push(`${speed}x speed`);
    return parts.length > 0 ? `Cost: ${parts.join(', ')}.` : '';
};

class CHARACTER {
    constructor(data) {
        this._baseStats = { ...data.stats };

        this.name        = data.name;
        this.id          = data.id;
        this.level       = data.level || 1;
        this.classType   = data.classType;
        this.subclassType= data.subclassType || null;
        this.race        = data.race;
        this.subrace     = data.subrace || null;
        this.background  = data.background || null;

        this._baseHP  = data.HP  || { max: 0, current: 0, temp: 0 };
        this._baseMP  = data.MP  || { max: 0, current: 0, temp: 0 };
        this._baseSTA = data.STA || { max: 0, current: 0, temp: 0 };
        this._baseMovement = data.movement || null; // Can be overridden from runtime state

        this._actionPoints = null; // Can be overridden from runtime state

        this.position  = data.position || { x: 0, y: 0, z: 0 };
        this.lightLevel = data.lightLevel !== undefined ? Math.max(0, Math.min(1, data.lightLevel)) : 0.5; // 0-1, affects vision distance

        this.abilities      = data.abilities      || [];
        this.equipment      = data.equipment      || [];
        this.inventory      = data.inventory      || [];
        this.statusEffects  = data.statusEffects  || [];
        this.equippedItems  = data.equippedItems  || [];
        this.classFeatures  = data.classFeatures  || [];
        this.raceFeatures   = data.raceFeatures   || [];
        this.skills         = data.skillIds || data.skills || { active: {}, passive: {} };
        this.effects        = data.effects        || [];
        this.inv            = data.inv            || { equipment: [], items: {} };
        this._savedActions  = Array.isArray(data.actions) ? data.actions : [];
        this._baseModifiers = data.modifiers      || [];

        // Cached initiative roll — call rollInitiative() to generate
        this._initiativeRoll = null;

        // Performance cache
        this._cache   = {};
        this._isDirty = true;

        // Dynamic action system
        this._actionDefinitions = [];
        this._actionById   = new Map();
        this._actionByPath = new Map();
        this.actionTree = {};
        this.action     = {};
        this.actions    = [];
        this.rebuildActionTree();
    }

    // =========================================================================
    // CACHE
    // =========================================================================

    invalidateCache() {
        this._isDirty = true;
        this._cache   = {};
    }

    // =========================================================================
    // UTILITY HELPERS
    // =========================================================================

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
        return parts.map((part, i) => {
            const token = part.toLowerCase();
            return i === 0 ? token : token.charAt(0).toUpperCase() + token.slice(1);
        }).join('');
    }

    _toDisplayName(value) {
        return String(value || '')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    _readProperty(properties, key) {
        if (!properties) return undefined;
        if (typeof properties.get === 'function') return properties.get(key);
        return properties[key];
    }

    _toStringArray(value) {
        if (Array.isArray(value)) return value.map((e) => String(e).trim()).filter(Boolean);
        if (typeof value === 'string') return value.split(/[\n,]/g).map((e) => e.trim()).filter(Boolean);
        return [];
    }

    _normalizeActionType(actionType) {
        const normalized = String(actionType || '').trim().toLowerCase().replace(/\s+/g, '');
        switch (normalized) {
            case 'move': case 'movement':               return 'movement';
            case 'bonus': case 'bonusaction':           return 'bonusAction';
            case 'reaction':                            return 'reaction';
            case 'free': case 'freeaction':             return 'free';
            case 'passive':                             return 'passive';
            case 'special':                             return 'special';
            default:                                    return 'action';
        }
    }

    _tabFromActionType(actionType) {
        switch (this._normalizeActionType(actionType)) {
            case 'movement':   return 'movement';
            case 'bonusAction':return 'bonus';
            case 'reaction':   return 'reaction';
            case 'free':       return 'free';
            case 'passive':    return 'passive';
            default:           return 'main';
        }
    }

    _toLookupId(value) {
        if (!value) return '';
        if (typeof value === 'string' || typeof value === 'number') return String(value);
        if (typeof value === 'object') {
            if (value.$oid)          return String(value.$oid);
            if (value._id?.$oid)     return String(value._id.$oid);
            if (value._id)           return String(value._id);
            if (value.id)            return String(value.id);
            if (value.itemId)        return String(value.itemId);
        }
        return String(value);
    }

    _cloneActionMeta(def) {
        return {
            id:           def.id,
            path:         def.path,
            pathSegments: [...def.pathSegments],
            tab:          def.tab,
            actionType:   def.actionType,
            name:         def.name,
            source:       def.source,
            sourceId:     def.sourceId,
            description:  def.description,
            cost:         def.cost,
            requirements: [...(def.requirements || [])],
            enabled:      def.enabled !== false
        };
    }

    // =========================================================================
    // ACTION TREE
    // =========================================================================

    _registerAction(definition) {
        if (!definition || definition.enabled === false) return;

        const actionType   = this._normalizeActionType(definition.actionType);
        const tab          = this._tabFromActionType(actionType);
        const rawPath      = Array.isArray(definition.path) && definition.path.length > 0
            ? definition.path
            : [tab, definition.id || definition.name];
        const pathSegments = rawPath.map((s) => this._toPathKey(s)).filter(Boolean);

        if (pathSegments.length === 0) pathSegments.push(tab, `action${this._actionDefinitions.length + 1}`);
        if (pathSegments[0] !== tab)   pathSegments.unshift(tab);

        let id = this._toIdKey(definition.id || pathSegments.join('_'), `action_${this._actionDefinitions.length + 1}`);
        let idCounter = 2;
        while (this._actionById.has(id)) { id = `${id}_${idCounter}`; idCounter++; }

        let path = pathSegments.join('.');
        let pathCounter = 2;
        while (this._actionByPath.has(path)) {
            const next = [...pathSegments];
            next[next.length - 1] = `${next[next.length - 1]}${pathCounter}`;
            path = next.join('.');
            pathCounter++;
        }

        const normalized = {
            id,
            path,
            pathSegments:  path.split('.'),
            tab,
            actionType,
            name:          String(definition.name || this._toDisplayName(id)),
            source:        String(definition.source  || 'core'),
            sourceId:      String(definition.sourceId || ''),
            description:   String(definition.description || ''),
            cost:          String(definition.cost || ''),
            requirements:  this._toStringArray(definition.requirements),
            enabled:       definition.enabled !== false,
            execute: typeof definition.execute === 'function'
                ? definition.execute
                : ((params = {}) => ({ success: true, actionId: id, actionPath: path, params }))
        };

        this._actionDefinitions.push(normalized);
        this._actionById.set(id, normalized);
        this._actionByPath.set(path, normalized);
    }

    _buildActionTrie() {
        const root = { key: 'root', path: '', children: new Map(), action: null };
        this._actionDefinitions.forEach((def) => {
            let cursor = root;
            def.pathSegments.forEach((segment, index) => {
                if (!cursor.children.has(segment)) {
                    cursor.children.set(segment, {
                        key:      segment,
                        path:     def.pathSegments.slice(0, index + 1).join('.'),
                        children: new Map(),
                        action:   null
                    });
                }
                cursor = cursor.children.get(segment);
            });
            cursor.action = def;
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
                const out = [];
                node.children.forEach((childNode) => {
                    if (childNode.action) out.push(this._cloneActionMeta(childNode.action));
                });
                return out;
            };
        }
        return base;
    }

    _trieNodeToTree(node) {
        const children = [];
        node.children.forEach((childNode) => children.push(this._trieNodeToTree(childNode)));
        const out = { key: node.key, path: node.path, label: this._toDisplayName(node.key), children };
        if (node.action) out.action = this._cloneActionMeta(node.action);
        return out;
    }

    // =========================================================================
    // ITEM / SPELL / ABILITY HELPERS
    // =========================================================================

    _isWeaponItem(item) {
        const typeValue = String(item?.type || this._readProperty(item?.properties, 'type') || '').toLowerCase();
        if (typeValue.includes('weapon')) return true;
        const attributes = Array.isArray(item?.attributes) ? item.attributes : [];
        return attributes.some((e) => String(e || '').toLowerCase().includes('weapon'));
    }

    _inventoryItemsAsArray() {
        if (Array.isArray(this.inventory)) return this.inventory;
        if (this.inventory && typeof this.inventory === 'object') return Object.values(this.inventory);
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
        return (this.abilities || []).find((a) => {
            const aId = this._toLookupId(a?.id || a?.abilityId || a?.name).toLowerCase();
            return aId === requestedId;
        }) || null;
    }

    _resolveTarget(params = {}) {
        if (params.target && typeof params.target === 'object') return params.target;
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
        const raw = candidates.find((e) => e !== undefined && e !== null);
        if (!raw) return [];

        const normalizeSpell = (spell, index) => {
            if (!spell) return null;
            if (typeof spell === 'string') {
                return { id: this._toIdKey(spell, `spell_${index + 1}`), name: this._toDisplayName(spell), description: '', actionType: 'action', mpCost: 0 };
            }
            if (typeof spell === 'object') {
                const name = String(spell.name || spell.id || `Spell ${index + 1}`);
                return {
                    id:          this._toIdKey(spell.id || name, `spell_${index + 1}`),
                    name:        this._toDisplayName(name),
                    description: String(spell.description || ''),
                    actionType:  this._normalizeActionType(spell.actionType || spell.type || 'action'),
                    mpCost:      Number(spell.mpCost || spell.cost?.mp || 0) || 0,
                    effectType:  spell.effectType,
                    damage:      spell.damage,
                    damageType:  spell.damageType,
                    healing:     spell.healing,
                    effect:      spell.effect
                };
            }
            return null;
        };

        if (Array.isArray(raw)) return raw.map(normalizeSpell).filter(Boolean);
        if (typeof raw === 'string') {
            return raw.split(/[\n,]/g).map((e) => e.trim()).filter(Boolean).map(normalizeSpell).filter(Boolean);
        }
        if (typeof raw === 'object') {
            return Object.entries(raw).map(([key, value], index) => {
                if (typeof value === 'string') return normalizeSpell({ id: key, name: key, description: value }, index);
                if (value && typeof value === 'object') return normalizeSpell({ ...value, id: value.id || key, name: value.name || key }, index);
                return normalizeSpell({ id: key, name: key }, index);
            }).filter(Boolean);
        }
        return [];
    }

    _extractItemUses(item) {
        const uses = this._readProperty(item?.properties, 'uses');
        if (!uses) return [];
        if (Array.isArray(uses)) {
            return uses.map((entry, index) => {
                if (typeof entry === 'string') return { id: this._toIdKey(entry, `use_${index + 1}`), name: this._toDisplayName(entry), description: '' };
                if (entry && typeof entry === 'object') {
                    const name = String(entry.name || entry.id || `Use ${index + 1}`);
                    return { id: this._toIdKey(entry.id || name, `use_${index + 1}`), name: this._toDisplayName(name), description: String(entry.description || ''), actionType: this._normalizeActionType(entry.actionType || entry.type || 'action'), effect: entry.effect };
                }
                return null;
            }).filter(Boolean);
        }
        if (typeof uses === 'string') return [{ id: this._toIdKey(uses, 'use_1'), name: this._toDisplayName(uses), description: '' }];
        return [];
    }

    // =========================================================================
    // ACTION DEFINITION BUILDERS
    // =========================================================================

    _normalizeSavedAction(entry, index) {
        const source = typeof entry === 'string' ? { name: entry } : (entry && typeof entry === 'object' ? entry : null);
        if (!source) return null;
        const name = String(source.name || source.label || source.title || '').trim();
        if (!name) return null;

        const actionType = this._normalizeActionType(source.actionType || source.type || source.kind || 'action');
        const tab        = this._tabFromActionType(actionType);
        const baseKey    = this._toPathKey(source.id || name, `customAction${index + 1}`);
        let pathSegments;

        if (Array.isArray(source.path) && source.path.length > 0) {
            pathSegments = source.path.map((s) => this._toPathKey(s)).filter(Boolean);
        } else if (typeof source.path === 'string' && source.path.trim()) {
            pathSegments = source.path.split('.').map((s) => this._toPathKey(s)).filter(Boolean);
        } else if (source.group) {
            pathSegments = [tab, this._toPathKey(source.group), baseKey];
        } else {
            pathSegments = [tab, baseKey];
        }

        return {
            id:           this._toIdKey(source.id || name, `custom_action_${index + 1}`),
            name,
            path:         pathSegments,
            tab,
            actionType,
            source:       String(source.source || 'custom'),
            sourceId:     String(source.sourceId || ''),
            description:  String(source.description || ''),
            cost:         String(source.cost || ''),
            requirements: this._toStringArray(source.requirements),
            enabled:      source.enabled !== false,
            hook:         source.hook || '',
            payload:      source.payload
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
        if (text.includes('reaction'))     return 'reaction';
        if (text.includes('move') || text.includes('movement')) return 'movement';
        if (text.includes('free action'))  return 'free';
        return 'action';
    }

    _buildCoreActionDefinitions() {
        const movementDefs = ['walk', 'jog', 'run', 'sprint', 'jump'].map((mode) => {
            const config = getMovementModeConfig(mode);
            if (!config) return null;
            const cost  = formatMovementCost(config);
            const description = [config.description, cost ? `${cost}.` : ''].filter(Boolean).join(' ').trim();
            return {
                id:          `movement_${mode}`,
                name:        config.name,
                path:        ['movement', mode],
                actionType:  'movement',
                source:      'core',
                description,
                cost,
                execute: (params = {}) => this._executeMovementMode(mode, params)
            };
        }).filter(Boolean);

        return [
            ...movementDefs,
            { id: 'main_attack',   name: 'Attack',   path: ['main', 'attack'],   actionType: 'action', source: 'core', description: 'Perform a weapon or unarmed attack.',  execute: (p = {}) => this._executeAttackAction(p) },
            { id: 'main_cast',     name: 'Cast',     path: ['main', 'cast'],     actionType: 'action', source: 'core', description: 'Cast a known ability or spell.',       execute: (p = {}) => this._executeCastAction(p) },
            { id: 'main_use_item', name: 'Use Item', path: ['main', 'useItem'],  actionType: 'action', source: 'core', description: 'Use an inventory or equipped item.',    execute: (p = {}) => this._executeUseItemAction(p) }
        ];
    }

    _buildAttackDefinitions() {
        const weapons = (this.equippedItems || []).filter((item) => this._isWeaponItem(item));
        if (weapons.length === 0) {
            return [{
                id:          'attack_unarmed',
                name:        'Unarmed Strike',
                path:        ['main', 'attack', 'with', 'unarmedStrike'],
                actionType:  'action',
                source:      'core',
                description: 'Attack without a weapon.',
                execute: (p = {}) => this._executeAttackAction(p)
            }];
        }
        return weapons.map((weapon, index) => {
            const weaponId  = this._toLookupId(weapon?.id || weapon?._id || weapon?.itemId) || `weapon_${index + 1}`;
            const weaponKey = this._toPathKey(weapon?.name || weaponId, `weapon${index + 1}`);
            return {
                id:          `attack_weapon_${this._toIdKey(weaponId, `weapon_${index + 1}`)}`,
                name:        this._toDisplayName(weapon?.name || `Weapon ${index + 1}`),
                path:        ['main', 'attack', 'with', weaponKey],
                actionType:  'action',
                source:      'item',
                sourceId:    weaponId,
                description: `Attack using ${weapon?.name || 'equipped weapon'}.`,
                execute: (p = {}) => this._executeAttackAction({ ...p, weapon, weaponId })
            };
        });
    }

    _buildCastDefinitions() {
        const definitions = [];
        (this.abilities || []).forEach((ability, index) => {
            const abilityId  = this._toLookupId(ability?.id || ability?.abilityId || ability?.name) || `ability_${index + 1}`;
            const abilityKey = this._toPathKey(ability?.name || abilityId, `spell${index + 1}`);
            definitions.push({
                id:          `cast_ability_${this._toIdKey(abilityId, `ability_${index + 1}`)}`,
                name:        this._toDisplayName(ability?.name || abilityId),
                path:        ['main', 'cast', 'spells', abilityKey],
                actionType:  ability?.actionType || 'action',
                source:      'ability',
                sourceId:    abilityId,
                description: String(ability?.description || ''),
                execute: (p = {}) => this._executeCastAction({ ...p, ability, abilityId })
            });
        });

        (this.equippedItems || []).forEach((item, itemIndex) => {
            const itemId  = this._toLookupId(item?.id || item?._id || item?.itemId) || `item_${itemIndex + 1}`;
            const itemKey = this._toPathKey(item?.name || itemId, `item${itemIndex + 1}`);
            this._extractItemSpells(item).forEach((spell, spellIndex) => {
                const spellId  = this._toLookupId(spell?.id || spell?.name) || `spell_${spellIndex + 1}`;
                const spellKey = this._toPathKey(spell?.name || spellId, `spell${spellIndex + 1}`);
                definitions.push({
                    id:          `cast_book_${this._toIdKey(itemId)}_${this._toIdKey(spellId, `spell_${spellIndex + 1}`)}`,
                    name:        this._toDisplayName(spell?.name || spellId),
                    path:        ['main', 'cast', 'books', itemKey, spellKey],
                    actionType:  spell?.actionType || 'action',
                    source:      'itemSpellbook',
                    sourceId:    itemId,
                    description: String(spell?.description || `Cast from ${item?.name || 'equipped spellbook'}.`),
                    execute: (p = {}) => this._executeCastAction({
                        ...p,
                        ability: {
                            id:          spellId,
                            name:        spell?.name || spellId,
                            description: spell?.description || '',
                            mpCost:      spell?.mpCost || 0,
                            effectType:  spell?.effectType,
                            damage:      spell?.damage,
                            damageType:  spell?.damageType,
                            healing:     spell?.healing,
                            effect:      spell?.effect
                        },
                        abilityId,
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
            const itemId  = this._toLookupId(item?.id || item?._id || item?.itemId) || `item_${itemIndex + 1}`;
            const itemKey = this._toPathKey(item?.name || itemId, `item${itemIndex + 1}`);
            this._extractItemUses(item).forEach((useEntry, useIndex) => {
                const useId  = this._toIdKey(useEntry?.id || useEntry?.name, `use_${useIndex + 1}`);
                const useKey = this._toPathKey(useEntry?.name || useId, `use${useIndex + 1}`);
                definitions.push({
                    id:          `item_use_${this._toIdKey(itemId)}_${useId}`,
                    name:        this._toDisplayName(useEntry?.name || useId),
                    path:        ['main', 'useItem', 'items', itemKey, useKey],
                    actionType:  useEntry?.actionType || 'action',
                    source:      'item',
                    sourceId:    itemId,
                    description: String(useEntry?.description || ''),
                    execute: (p = {}) => this._executeUseItemAction({ ...p, item, itemId, use: useEntry })
                });
            });
        });
        return definitions;
    }

    _buildSavedDefinitions() {
        return (this._savedActions || []).map((entry, index) => {
            const normalized = this._normalizeSavedAction(entry, index);
            if (!normalized) return null;
            return {
                id:           normalized.id,
                name:         normalized.name,
                path:         normalized.path,
                actionType:   normalized.actionType,
                source:       normalized.source,
                sourceId:     normalized.sourceId,
                description:  normalized.description,
                cost:         normalized.cost,
                requirements: normalized.requirements,
                enabled:      normalized.enabled,
                execute: (p = {}) => this._runSavedAction(normalized, p)
            };
        }).filter(Boolean);
    }

    _buildFeatureDefinitions() {
        const definitions = [];
        const buckets = [
            ...(Array.isArray(this.classFeatures) ? this.classFeatures : []),
            ...(Array.isArray(this.raceFeatures)  ? this.raceFeatures  : [])
        ];
        buckets.forEach((feature, index) => {
            if (!feature || typeof feature !== 'object') return;
            const name = String(feature.name || feature.id || '').trim();
            if (!name) return;
            if (!this._isActionableDescription(feature.description)) return;

            const actionType  = this._inferActionTypeFromText(feature.description);
            const tab         = this._tabFromActionType(actionType);
            const featureId   = this._toIdKey(feature.id || name, `feature_${index + 1}`);
            const featureKey  = this._toPathKey(name, `feature${index + 1}`);

            definitions.push({
                id:          `feature_action_${featureId}`,
                name:        this._toDisplayName(name),
                path:        [tab, 'features', featureKey],
                actionType,
                source:      'feature',
                sourceId:    featureId,
                description: String(feature.description || ''),
                execute: (p = {}) => {
                    const context = {
                        character: this,
                        feature,
                        params: p,
                        result: { success: true, actionId: `feature_action_${featureId}`, actionPath: [tab, 'features', featureKey].join('.'), source: 'feature' }
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
        const definitions   = [];
        const activeSkills  = this.skills?.active;
        if (!activeSkills || typeof activeSkills !== 'object') return definitions;

        Object.entries(activeSkills).forEach(([skillId, rawSkill], index) => {
            const skill = typeof rawSkill === 'string' ? { name: skillId, description: rawSkill } : (rawSkill && typeof rawSkill === 'object' ? rawSkill : { name: skillId });
            const name  = String(skill.name || skillId || '').trim();
            if (!name) return;

            const actionType       = this._normalizeActionType(skill.actionType || skill.type || this._inferActionTypeFromText(skill.description));
            const tab              = this._tabFromActionType(actionType);
            const normalizedSkillId= this._toIdKey(skill.id || skillId || name, `skill_${index + 1}`);
            const skillKey         = this._toPathKey(name, `skill${index + 1}`);

            definitions.push({
                id:          `skill_action_${normalizedSkillId}`,
                name:        this._toDisplayName(name),
                path:        [tab, 'skills', skillKey],
                actionType,
                source:      'skill',
                sourceId:    normalizedSkillId,
                description: String(skill.description || ''),
                execute: (p = {}) => {
                    const context = {
                        character: this,
                        skill,
                        params: p,
                        result: { success: true, actionId: `skill_action_${normalizedSkillId}`, actionPath: [tab, 'skills', skillKey].join('.'), source: 'skill' }
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
        this._actionById   = new Map();
        this._actionByPath = new Map();

        [
            this._buildCoreActionDefinitions(),
            this._buildAttackDefinitions(),
            this._buildCastDefinitions(),
            this._buildItemDefinitions(),
            this._buildFeatureDefinitions(),
            this._buildSkillDefinitions(),
            this._buildSavedDefinitions()
        ].flat().forEach((def) => this._registerAction(def));

        const trie      = this._buildActionTrie();
        const actionApi = {};
        const tree      = {};

        trie.children.forEach((childNode, key) => {
            actionApi[key] = this._trieNodeToActionApi(childNode);
            tree[key]      = this._trieNodeToTree(childNode);
        });

        // NOTE: `this.action` holds the navigable API object (e.g. character.action.main.attack())
        // It is NOT a method. Use character.executeAction() or character.getAvailableActions() for programmatic access.
        this.action     = actionApi;
        this.actionTree = tree;
        this.actions    = this._actionDefinitions.map((def) => this._cloneActionMeta(def));

        return this.actionTree;
    }

    // =========================================================================
    // EXECUTE ACTIONS
    // =========================================================================

    executeAction(actionRef, params = {}) {
        const aliasMap = { attack: 'main.attack', cast: 'main.cast', useitem: 'main.useItem', move: 'movement.walk', walk: 'movement.walk', jog: 'movement.jog', run: 'movement.run', sprint: 'movement.sprint', dash: 'movement.sprint', movement_dash: 'movement.sprint', jump: 'movement.jump' };
        const requested = String(params.actionPath || params.actionId || actionRef || '').trim();
        if (!requested) throw new Error('Action reference is required.');
        const directById = this._actionById.get(this._toIdKey(requested));
        const directByPath = this._actionByPath.get(requested);
        const normalizedPath = requested.split('.').map((s) => this._toPathKey(s)).filter(Boolean).join('.');
        const normalizedByPath = this._actionByPath.get(normalizedPath);
        const aliasedPath = aliasMap[this._toIdKey(requested)];
        const byAlias = aliasedPath ? this._actionByPath.get(aliasedPath) : null;
        const resolved = directByPath || normalizedByPath || directById || byAlias;
        if (!resolved) throw new Error(`Unknown action: ${requested}`);

        // Consume Action Point
        const actionType = this._normalizeActionType(resolved.actionType);
        // Removed 'movement' from cost types so moving only consumes distance, not an action point
        const apCostTypes = ['action', 'bonusAction', 'reaction'];
        if (apCostTypes.includes(actionType)) {
            if (!this._actionPoints || typeof this._actionPoints !== 'object') {
                this._actionPoints = this.actionPoints; // Hydrate if missing
            }

            if (this._actionPoints[actionType] > 0) {
                this._actionPoints[actionType]--;
            } else {
                throw new Error(`No ${resolved.actionType} points remaining.`);
            }
        }

        const result = resolved.execute({ ...params, actionId: resolved.id, actionPath: resolved.path });

        // Attach updated action points to result for syncing
        result.actionPoints = this._actionPoints;

        return result;
    }

    getAvailableActions() {
        return (this.actions || []).filter((entry) => entry?.enabled !== false);
    }

    getActionTree() {
        return this.actionTree;
    }

    _runSavedAction(savedAction, params = {}) {
        const hookId  = savedAction.hook || `onAction_${this._toIdKey(savedAction.id || savedAction.name)}`;
        const context = {
            character: this,
            action:    savedAction,
            params,
            result: {
                success:    true,
                actionId:   savedAction.id,
                actionPath: Array.isArray(savedAction.path) ? savedAction.path.join('.') : '',
                source:     savedAction.source
            }
        };
        this.applyModifierPipeline(hookId, context);
        this.applyModifierPipeline('onActionCustom', context);
        return context.result;
    }

    // =========================================================================
    // MOVEMENT
    // =========================================================================

    _executeMovementMode(mode, params = {}) {
        const movementMode = String(mode || '').trim().toLowerCase();
        const config       = getMovementModeConfig(movementMode);
        if (!config) throw new Error(`Unknown movement mode: ${mode}`);

        // Ensure _baseMovement is initialized if it hasn't been set yet
        if (this._baseMovement == null) this._baseMovement = this.movement;

        const previousPosition = { ...(this.position || { x: 0, y: 0, z: 0 }) };
        const nextPosition     = { ...previousPosition };
        const rawUnitsPerFoot  = Number(params.unitsPerFoot || params.worldUnitsPerFoot || DEFAULT_WORLD_UNITS_PER_FOOT);

        const context = {
            character:          this,
            mode:               movementMode,
            params,
            previousPosition,
            nextPosition,
            distanceMultiplier: Number(config.speedMultiplier) || 1,
            staPer10Ft:         Number(config.staPer10Ft)      || 0,
            unitsPerFoot:       Number.isFinite(rawUnitsPerFoot) && rawUnitsPerFoot > 0 ? rawUnitsPerFoot : DEFAULT_WORLD_UNITS_PER_FOOT,
            heightDelta:        Number(params.height || 0)
        };

        this.applyModifierPipeline('onMovementAction', context);
        this.applyModifierPipeline(`onMovement_${movementMode}`, context);

        let hasPositionUpdate = false;

        if (params.position && typeof params.position === 'object') {
            if (Number.isFinite(Number(params.position.x))) { context.nextPosition.x = Number(params.position.x); hasPositionUpdate = true; }
            if (Number.isFinite(Number(params.position.y))) { context.nextPosition.y = Number(params.position.y); hasPositionUpdate = true; }
            if (Number.isFinite(Number(params.position.z))) { context.nextPosition.z = Number(params.position.z); hasPositionUpdate = true; }
        } else {
            if (Number.isFinite(Number(params.x))) { context.nextPosition.x = Number(params.x); hasPositionUpdate = true; }
            if (Number.isFinite(Number(params.y))) { context.nextPosition.y = Number(params.y); hasPositionUpdate = true; }
            if (Number.isFinite(Number(params.z))) { context.nextPosition.z = Number(params.z); hasPositionUpdate = true; }
        }

        if (movementMode === 'jump' && Number.isFinite(context.heightDelta)) {
            context.nextPosition.z = (context.nextPosition.z || 0) + context.heightDelta;
            hasPositionUpdate = true;
        }

        if (!hasPositionUpdate) throw new Error('Movement requires a target position.');

        const dx           = (Number(context.nextPosition.x) || 0) - (Number(previousPosition.x) || 0);
        const dy           = (Number(context.nextPosition.y) || 0) - (Number(previousPosition.y) || 0);
        const distanceWorld= Math.hypot(dx, dy);
        const unitsPerFoot = Number(context.unitsPerFoot) || DEFAULT_WORLD_UNITS_PER_FOOT;
        const distanceFt   = distanceWorld / unitsPerFoot;

        const currentMovementFt = Math.max(0, (Number(this.movement) || 0));
        const maxDistanceFt  = currentMovementFt * (Number(context.distanceMultiplier) || 1);
        if (distanceFt > maxDistanceFt + 1e-6) throw new Error(`Target is too far for ${config.name}. Max ${maxDistanceFt.toFixed(1)} ft available.`);

        const staPer10Ft = Math.max(0, Number(context.staPer10Ft) || 0);
        const staCost    = staPer10Ft > 0 ? Math.ceil(distanceFt / 10) * staPer10Ft : 0;
        const currentSta = Number(this._baseSTA?.current ?? this.STA?.current ?? 0);

        if (staCost > currentSta) throw new Error(`Not enough STA (${staCost} required, ${currentSta} available).`);
        
        this._baseMovement = Math.max(0, this._baseMovement - distanceFt);
        
        if (staCost > 0 && this._baseSTA) this._baseSTA.current = Math.max(0, currentSta - staCost);

        this.position = context.nextPosition;

        const result = {
            success:            true,
            mode:               movementMode,
            previousPosition,
            position:           { ...this.position },
            distanceMultiplier: Number(context.distanceMultiplier) || 1,
            distanceFt,
            maxDistanceFt,
            staCost,
            staRemaining:       this._baseSTA?.current ?? currentSta,
            STA: this._baseSTA ? { max: this.STA.max, current: this._baseSTA.current, temp: this._baseSTA.temp } : undefined,
            movementRemaining: this._baseMovement,
        };

        gameEvents.emitGameEvent('movementAction', { characterId: this.id, characterName: this.name, ...result });
        return result;
    }

    // =========================================================================
    // ATTACK, CAST, USE ITEM (high-level wrappers used by action tree)
    // =========================================================================

    _executeAttackAction(params = {}) {
        const target = this._resolveTarget(params);
        if (!target) return { success: false, message: 'Target is required for attack actions.' };

        const weapon = this._resolveWeapon(params.weapon || params.weaponId) || {
            name:       'Unarmed Strike',
            damage:     '1d1',
            damageType: 'bludgeoning'
        };

        return this.attack({ ...params, target, weapon });
    }

    _executeCastAction(params = {}) {
        const ability = this._resolveAbility(params.ability || params.abilityId || params.spellId) || params.ability;
        if (!ability) return { success: false, message: 'No ability or spell was provided.' };

        const mpCost = Number(ability.mpCost || ability.cost?.mp || 0);
        if (mpCost > 0 && this._baseMP.current < mpCost) return { success: false, message: 'Not enough MP.' };
        if (mpCost > 0) this._baseMP.current -= mpCost;

        const target     = this._resolveTarget(params) || this;
        const effectType = String(ability.effectType || '').toLowerCase();

        const result = {
            success:     true,
            abilityId:   this._toLookupId(ability.id || ability.abilityId || ability.name),
            abilityName: ability.name || 'Unknown Spell',
            mpCost,
            remainingMP: this._baseMP.current,
            targetId:    this._toLookupId(target.id || target._id)
        };

        if (effectType === 'heal' && target?._baseHP) {
            const healing = this._rollDice({ dice: ability.healing || '1d4', advantage: 0 });
            target._baseHP.current = Math.min(target.HP.max, target.HP.current + healing);
            result.healing  = healing;
            result.targetHP = target._baseHP.current;
        } else if (effectType === 'damage' && typeof target?.takeDamage === 'function') {
            const damage = this._rollDice({ dice: ability.damage || '1d4', advantage: 0 });
            target.takeDamage({ damage, damageParts: [{ dice: ability.damage || '1d4', total: damage, type: ability.damageType || 'force', source: ability.name || 'spell' }], attacker: this });
            result.damage = damage;
        } else if (ability.effect && typeof target?.addStatusEffect === 'function') {
            target.addStatusEffect(ability.effect);
            result.effectApplied = ability.effect.name || 'effect';
        }

        this.applyModifierPipeline('onCastAction', { character: this, target, ability, params, result });
        gameEvents.emitGameEvent('castAction', { characterId: this.id, characterName: this.name, ...result });
        return result;
    }

    _executeUseItemAction(params = {}) {
        const item = this._resolveItem(params.item || params.itemId);
        if (!item) return { success: false, message: 'Item not found.' };

        const use    = params.use || null;
        const result = {
            success:  true,
            itemId:   this._toLookupId(item.id || item._id || item.itemId),
            itemName: item.name || 'Unknown Item',
            useId:    use ? this._toIdKey(use.id || use.name, 'use') : '',
            useName:  use?.name || ''
        };

        const useLabel = String(use?.name || item?.effect || '').toLowerCase();
        if (useLabel.includes('heal') || item?.effect === 'heal') {
            const healing = this._rollDice({ dice: use?.healing || item?.healing || '1d4', advantage: 0 });
            this._baseHP.current = Math.min(this.HP.max, this.HP.current + healing);
            result.healing = healing;
            result.hp      = this._baseHP.current;
        }

        this.applyModifierPipeline('onUseItemAction', { character: this, item, use, params, result });
        gameEvents.emitGameEvent('itemAction', { characterId: this.id, characterName: this.name, ...result });
        return result;
    }

    // =========================================================================
    // MODIFIER PIPELINE
    // =========================================================================

    _toExecutableModifierAction(actionValue, modifierName = 'Unknown Modifier') {
        if (typeof actionValue === 'function') return actionValue;
        if (typeof actionValue !== 'string')   return null;

        const actionCode = actionValue.trim();
        if (!actionCode) return null;

        try {
            const compiled = new Function(`"use strict"; return (${actionCode});`)();
            if (typeof compiled === 'function') return compiled;
        } catch (_) { /* fall through */ }

        try {
            return new Function('context', actionCode);
        } catch (error) {
            console.warn(`Modifier "${modifierName}" has invalid action code: ${error.message}`);
            return null;
        }
    }

    getModifiersForHook(hookName) {
        const equippedItemSources  = Array.isArray(this.equippedItems) ? this.equippedItems : [];
        const legacyEquipmentSources = Array.isArray(this.inv?.equipment)
            ? this.inv.equipment
            : Object.values(this.inv?.equipment || {});
        const equipmentSources  = [...equippedItemSources, ...legacyEquipmentSources];
        const effectSources     = Array.isArray(this.effects) ? this.effects : Object.values(this.effects || {});
        const passiveSkillSources = Array.isArray(this.skills?.passive) ? this.skills.passive : Object.values(this.skills?.passive || {});
        const classFeatureSources = Array.isArray(this.classFeatures) ? this.classFeatures : Object.values(this.classType?.classFeatures || {});
        const raceTraitSources    = Array.isArray(this.raceFeatures)  ? this.raceFeatures  : Object.values(this.race?.traits || {});

        // Wrap each statusEffect's modifiers so ctx.effectStack / ctx.effect are available.
        // Always look up canonical modifiers from the EFFECTS catalog — stored statusEffect
        // objects may have been JSON-serialized (which strips functions), so we cannot rely\n        // on effect.modifiers having live action functions.
        const statusEffectSources = this.statusEffects.map((effect) => {
            const catalogEntry = EFFECTS.find(
                (e) => e.id === effect.id || e.id === effect.name || e.name === effect.name
            );
            if (!catalogEntry && (effect.name || effect.id)) {
                console.warn(
                    `[CHARACTER] Could not find effect in EFFECTS catalog: id="${effect.id}", name="${effect.name}". Available effects: ${EFFECTS.map(e => e.id).join(', ')}`
                );
            }
            const mods = (catalogEntry || effect).modifiers || [];
            return {
                modifiers: mods.map((mod) => ({
                    hook:     mod.hook,
                    priority: mod.priority,
                    name:     mod.name,
                    action:   (context) => {
                        // Add effectStack and effect to the SAME context object, don't create a copy
                        context.effectStack = effect.stack ?? effect.stacks ?? 1;
                        context.effect = effect;
                        return mod.action(context);
                    }
                }))
            };
        });

        /**
         * TODO: Add subclass sources once subclass data is normalised in CharacterBuilder.
         * All sources must expose a `modifiers` array of { hook, priority, action } objects.
         * Currently race traits, passive skills, and effects are stored as flat strings —
         * they need to be converted to the modifier object format in CharacterBuilder before being used here.
         */
        const allSources = [
            { modifiers: this._baseModifiers },
            ...equipmentSources,
            ...effectSources,
            ...statusEffectSources,
            ...passiveSkillSources,
            ...classFeatureSources,
            ...raceTraitSources
        ];

        return allSources
            .flatMap((source) => source.modifiers || [])
            .filter((mod) => mod.hook === hookName)
            .sort((a, b) => (a.priority || 100) - (b.priority || 100));
    }

    applyModifierPipeline(hookName, context) {
        const modifiers = this.getModifiersForHook(hookName);
        if (hookName === 'onTurnStart' && modifiers.length > 0) {
            console.log(`[CHARACTER.applyModifierPipeline] ${this.name}: Found ${modifiers.length} modifiers for hook "${hookName}"`);
            modifiers.forEach(m => console.log(`  - ${m.name} (priority: ${m.priority})`));
        }
        if (hookName === 'onPerceptionCalc') {
            console.log(`[CHARACTER.applyModifierPipeline] ${this.name}: Found ${modifiers.length} modifiers for hook "onPerceptionCalc"`);
            if (modifiers.length > 0) {
                modifiers.forEach(m => console.log(`  - ${m.name} (priority: ${m.priority})`));
            }
        }
        modifiers.forEach((modifier) => {
            try {
                let executableAction = modifier.action;
                if (typeof executableAction !== 'function') {
                    executableAction = this._toExecutableModifierAction(modifier.action, modifier.name);
                    if (executableAction) modifier.action = executableAction;
                }
                if (typeof executableAction === 'function') {
                    if (modifier.name.includes('Bleed') || modifier.name.includes('Perception')) {
                        console.log(`[CHARACTER.applyModifierPipeline] Executing: ${modifier.name}`);
                    }
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

    // =========================================================================
    // STAT CALCULATIONS
    // =========================================================================

    _calculateStat(statName) {
        const context = {
            stat:      statName,
            value:     this._baseStats[statName] || 10,
            character: this
        };

        if (this.race?.abilityScoreModifiers?.[statName]) context.value += this.race.abilityScoreModifiers[statName];
        if (this.subrace?.abilityScoreModifiers?.[statName]) context.value += this.subrace.abilityScoreModifiers[statName];
        if (this.classType?.baseStatModifier?.[statName])  context.value += this.classType.baseStatModifier[statName];

        this.applyModifierPipeline(`onStatCalc_${statName}`, context);

        return {
            score:    Math.max(1, Math.min(30, context.value)),
            modifier: Math.floor((context.value - 10) / 2)
        };
    }

    get stats() {
        if (!this._isDirty && this._cache.stats) return this._cache.stats;

        const calculated = {};
        for (const statName of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA', 'LUCK']) {
            calculated[statName] = this._calculateStat(statName);
        }

        this._cache.stats = calculated;
        this._isDirty     = false; // FIX: actually mark cache as valid
        return calculated;
    }

    get proficiencyBonus() {
        return Math.ceil(this.level / 4) + 1;
    }

    get AR() {
        if (!this._isDirty && this._cache.AR !== undefined) return this._cache.AR;

        const context = {
            baseAR:    {},
            character: this,
            armor:     this.equippedItems.find((item) => item.type === 'armor'),
            shield:    this.equippedItems.find((item) => item.type === 'shield')
        };

        // FIX: use Object.entries() — `for...of` does not work on plain objects
        if (context.armor?.AR) {
            for (const [part, value] of Object.entries(context.armor.AR)) {
                context.baseAR[part] = value;
            }
        }

        if (context.shield?.AR) {
            for (const [part, value] of Object.entries(context.shield.AR)) {
                context.baseAR[part] = (context.baseAR[part] || 0) + value;
            }
        }

        this.applyModifierPipeline('onARCalc', context);

        // If no modifier explicitly set context.AR, fall back to baseAR
        const finalAR    = context.AR ?? context.baseAR;
        this._cache.AR   = finalAR;
        this._isDirty    = false;
        return finalAR;
    }

    /**
     * Roll initiative once and store it. Call this at combat start.
     * Reading character.initiative later returns the stored value — no dice roll inside a getter.
     */
    rollInitiative() {
        const dexScore   = this.stats?.DEX?.score ?? 10;
        const context    = {
            base:      Math.floor((dexScore - 10) / 2),
            character: this,
            roll: [{ dice: '1d20', context: 'initiative roll' }]
        };
        this.applyModifierPipeline('onInitiativeCalc', context);
        for (const roll of context.roll) {
            context.base += this._rollDice({ dice: roll.dice, advantage: 0 });
        }
        this._initiativeRoll = context.base;
        return this._initiativeRoll;
    }

    /**
     * Returns the last rolled initiative. Returns 0 if rollInitiative() has not been called.
     */
    get initiative() {
        return this._initiativeRoll ?? 0;
    }

    get HP() {
        const conScore     = this.stats?.CON?.score ?? 10;
        const classHPBonus = this.classType?.resourcePoolModifier?.HP || 0;
        const context      = { baseMax: this._baseHP.max, character: this, level: this.level, con: conScore, baseHPBonus: 0, classHPBonus };

        this.applyModifierPipeline('onPreHPCalc', context);
        context.baseMax = context.con * (1 + context.baseHPBonus + ((context.level / 2) * context.classHPBonus));
        this.applyModifierPipeline('onHPCalc', context);

        return { max: context.baseMax, current: this._baseHP.current, temp: this._baseHP.temp };
    }

    get MP() {
        const wisModifier  = this.stats?.WIS?.modifier ?? Math.floor(((this.stats?.WIS?.score ?? 10) - 10) / 2);
        const classMPBonus = this.classType?.resourcePoolModifier?.MP || 0;
        const context      = { baseMax: this._baseMP.max, character: this, level: this.level, wis: wisModifier, baseMPBonus: 0, classMPBonus };

        this.applyModifierPipeline('onPreMPCalc', context);
        context.baseMax = context.wis * (1 + context.baseMPBonus + ((context.level / 2) * context.classMPBonus));
        this.applyModifierPipeline('onMPCalc', context);

        return { max: context.baseMax, current: this._baseMP.current, temp: this._baseMP.temp };
    }

    get STA() {
        const conScore      = this.stats?.CON?.score ?? 10;
        const classSTABonus = this.classType?.resourcePoolModifier?.STA || 0;
        const context       = { baseMax: this._baseSTA.max, character: this, level: this.level, con: conScore, baseSTABonus: 0, classSTABonus };

        this.applyModifierPipeline('onPreSTACalc', context);
        context.baseMax = 2 * context.con * (1 + context.baseSTABonus + ((context.level / 2) * context.classSTABonus));
        this.applyModifierPipeline('onSTACalc', context);

        return { max: context.baseMax, current: this._baseSTA.current, temp: this._baseSTA.temp };
    }

    calculateMaxMovement() {
        const baseSpeed    = this.classType?.baseSpeed || 30;
        const context      = {
             base: baseSpeed,
             character: this,
             finalSpeed: baseSpeed
             };
        this.applyModifierPipeline('onMovementCalc', context);
        return Math.max(0, context.finalSpeed);
    }

    startTurn() {
        const maxMovement = this.calculateMaxMovement();
        this._baseMovement = maxMovement;
        this._actionPoints = null; // Reset to get fresh points

        // NOTE: Do NOT fire 'onTurnStart' here — the engine's _processTurnStart()
        // already fires that pipeline (handling bleed/poison tick damage, etc.).
        // Firing it again would double-apply tick effects.
        // Instead, just set up the default action points and apply any
        // movement/AP-specific modifiers via a dedicated hook.
        const context = {
            character: this,
            movement: maxMovement,
            actionPoints: { 
                    action:1,
                    bonusAction:1,
                    movement:1
            }
        };

        this.applyModifierPipeline('onTurnReset', context);

        if (context.movement !== maxMovement) {
            this._baseMovement = context.movement;
        }

        this._actionPoints = context.actionPoints;

        return {
            movement: this._baseMovement,
            actionPoints: context.actionPoints
        };
    }

    get movement(){
        // Use override if set (from runtime state), otherwise calculate from class
        if (this._baseMovement != null && Number.isFinite(this._baseMovement)) {
            return Math.max(0, this._baseMovement);
        }
        return this.calculateMaxMovement();
    }

    get actionPoints(){
        if (this._actionPoints && typeof this._actionPoints === 'object') {
            return this._actionPoints;
        }
        const actionPoints = {
            'action': 1,
            'bonusAction': 1,
            'movement': 1,
        }
        const context      = { base: actionPoints, character: this };
        this.applyModifierPipeline('onActionPointsCalc', context);
        return context.base;
    }

    get memory() {
        const wisScore = Number(this.stats?.WIS?.score ?? 0) || 0;
        // Base memory: WIS / 2 polygons (rounded down).
        const baseMemory = {
            polygons: Math.max(0, Math.floor(wisScore / 2)),
        };
        const context = { base: baseMemory, character: this };
        this.applyModifierPipeline('onMemoryCalc', context);
        return context.base;
    }

    get carryCapacity() {
        const strScoreRaw = this.stats?.STR?.score ?? this._baseStats?.STR ?? this.stats?.STR ?? 10;
        const strScore    = Number.isFinite(Number(strScoreRaw)) ? Number(strScoreRaw) : 10;

        const baseMax = Math.max(0, strScore * 25);
        const context = { baseMax, max: baseMax, str: strScore, character: this };
        this.applyModifierPipeline('onCarryCapacityCalc', context);
        const unrestricted = Math.max(0, Number(context.max ?? context.baseMax ?? baseMax) || 0);

        const restrictedBaseMax = Math.max(0, strScore * 50);
        const restrictedContext = { baseMax: restrictedBaseMax, max: restrictedBaseMax, str: strScore, character: this };
        this.applyModifierPipeline('onCarryCapacityRestrictedCalc', restrictedContext);
        const restricted = Math.max(0, Number(restrictedContext.max ?? restrictedContext.baseMax ?? restrictedBaseMax) || 0);

        return { unrestricted, restricted, str: strScore };
    }

    get perception() {
        const intScoreRaw = this.stats?.INT?.score;
        const intScore    = Number.isFinite(Number(intScoreRaw)) ? Number(intScoreRaw) : 0;
        
        // DEBUG: Log statusEffects before calculating perception
        if (this.statusEffects && this.statusEffects.length > 0) {
            const perceptionEffects = this.statusEffects.filter(e => 
                e.name?.toLowerCase().includes('perception') || e.id?.toLowerCase().includes('perception')
            );
            if (perceptionEffects.length > 0) {
                console.log(`[PERCEPTION] ${this.name} has perception-related effects:`, perceptionEffects.map(e => `${e.name}(${e.id})`));
            }
        }
        
        const context     = { base: intScore, value: intScore, character: this };
        this.applyModifierPipeline('onPerceptionCalc', context);
        if (context.value !== intScore) {
            console.log(`[PERCEPTION] ${this.name}: base ${intScore} → modified ${context.value}`);
        }
        return Number.isFinite(Number(context.value)) ? Number(context.value) : 0;
    }

    get stealth() {
        const dexScoreRaw = this.stats?.DEX?.score;
        const wisScoreRaw = this.stats?.WIS?.score;
        const dexScore = Number.isFinite(Number(dexScoreRaw)) ? Number(dexScoreRaw) : 10;
        const wisScore = Number.isFinite(Number(wisScoreRaw)) ? Number(wisScoreRaw) : 10;
        const baseValue = dexScore + wisScore;
        
        const context = { base: baseValue, value: baseValue, dex: dexScore, wis: wisScore, character: this };
        this.applyModifierPipeline('onStealthCalc', context);
        return Math.max(0, Number(context.value ?? context.base ?? baseValue) || 0);
    }

    get defenses() {
        const context = {
            character: this,
            ar: { ...(this.AR || {}) },
            resistances: {},
            immunities: {},
        };

        this.applyModifierPipeline('onDefenseCalc', context);

        if (context.resistances.magical) {
            context.resistances.cold = (context.resistances.cold || 0) + context.resistances.magical;
            context.resistances.fire = (context.resistances.fire || 0) + context.resistances.magical;
            context.resistances.lightning = (context.resistances.lightning || 0) + context.resistances.magical;
            context.resistances.thunder = (context.resistances.thunder || 0) + context.resistances.magical;
            context.resistances.poison = (context.resistances.poison || 0) + context.resistances.magical;
            context.resistances.acid = (context.resistances.acid || 0) + context.resistances.magical;
            context.resistances.necrotic = (context.resistances.necrotic || 0) + context.resistances.magical;
            context.resistances.radiant = (context.resistances.radiant || 0) + context.resistances.magical;
            context.resistances.force = (context.resistances.force || 0) + context.resistances.magical;
            context.resistances.psychic = (context.resistances.psychic || 0) + context.resistances.magical;
        }

        if (context.immunities.magical) {
            context.immunities.cold = context.immunities.magical;
            context.immunities.fire = context.immunities.magical;
            context.immunities.lightning = context.immunities.magical;
            context.immunities.thunder = context.immunities.magical;
            context.immunities.poison = context.immunities.magical;
            context.immunities.acid = context.immunities.magical;
            context.immunities.necrotic = context.immunities.magical;
            context.immunities.radiant = context.immunities.magical;
            context.immunities.force = context.immunities.magical;
            context.immunities.psychic = context.immunities.magical;
        }

        if (context.immunities.physical) {
            context.immunities.slashing = context.immunities.physical;
            context.immunities.piercing = context.immunities.physical;
            context.immunities.bludgeoning = context.immunities.physical;
        }

        if (context.resistances.physical) {
            context.resistances.slashing = (context.resistances.slashing || 0) + context.resistances.physical;
            context.resistances.piercing = (context.resistances.piercing || 0) + context.resistances.physical;
            context.resistances.bludgeoning = (context.resistances.bludgeoning || 0) + context.resistances.physical;
        }

        if (context.ar.magical) {
            context.ar.cold = (context.ar.cold || 0) + context.ar.magical;
            context.ar.fire = (context.ar.fire || 0) + context.ar.magical;
            context.ar.lightning = (context.ar.lightning || 0) + context.ar.magical;
            context.ar.thunder = (context.ar.thunder || 0) + context.ar.magical;
            context.ar.poison = (context.ar.poison || 0) + context.ar.magical;
            context.ar.acid = (context.ar.acid || 0) + context.ar.magical;
            context.ar.necrotic = (context.ar.necrotic || 0) + context.ar.magical;
            context.ar.radiant = (context.ar.radiant || 0) + context.ar.magical;
            context.ar.force = (context.ar.force || 0) + context.ar.magical;
            context.ar.psychic = (context.ar.psychic || 0) + context.ar.magical;
        }

        if (context.ar.physical) {
            context.ar.slashing = (context.ar.slashing || 0) + context.ar.physical;
            context.ar.piercing = (context.ar.piercing || 0) + context.ar.physical;
            context.ar.bludgeoning = (context.ar.bludgeoning || 0) + context.ar.physical;
        }

        return {
            ar: context.ar,
            resistances: context.resistances,
            immunities: context.immunities,
        };
    }

    get vision() {
        const base = this.perception ?? 0; 
        // Base vision is not modified by light - light affects fuel cost in ray-casting.
        // Follow the documented defaults: distance = INT × 100, angle = INT × 5, radius = INT × 5.
        const baseVision = {
            distance: Math.max(0, base * 100),
            angle: Math.max(0, base * 5),
            radius: Math.max(0, base * 5)
        };
        const context    = { base: baseVision, character: this };
        this.applyModifierPipeline('onVisionCalc', context);
        return context.base;
    }

    // =========================================================================
    // DICE
    // =========================================================================

    /**
     * Roll dice.
     * @param {object} context - { dice: '2d6', advantage: 0 }
     *   advantage > 0 = roll extra dice, keep highest
     *   advantage < 0 = roll extra dice, keep lowest
     *   advantage = 0 = normal roll
     */
    _rollDice(context) {
        const [countStr, sidesStr] = String(context.dice || '1d20').toLowerCase().split('d');
        const count  = Math.max(1, Number(countStr) || 1);
        const sides  = Math.max(2, Number(sidesStr) || 20);
        let total    = 0;

        for (let i = 0; i < count; i++) {
            const numToRoll   = Math.abs(context.advantage || 0) + 1;
            const currentRolls= [];
            for (let j = 0; j < numToRoll; j++) {
                currentRolls.push(Math.floor(Math.random() * sides) + 1);
            }
            if      (context.advantage > 0) total += Math.max(...currentRolls);
            else if (context.advantage < 0) total += Math.min(...currentRolls);
            else                            total += currentRolls[0];
        }

        return total;
    }

    // =========================================================================
    // COMBAT METHODS
    // =========================================================================

    /**
     * Determines whether this character is hit by an incoming attack.
     * Called by the attacker inside attack() — override or add modifiers via onReaction hook.
     * @param {object} params - { attackContext }
     * @returns {boolean} true = attack hits, false = attack misses
     */
    reaction(params = {}) {
        const attackTotal = params.attackContext?.AC || 0;
        const ar          = this.AR || {};

        // Build a total defensive value from all AR parts.
        // The attacker's AC must meet or beat this to land a hit.
        const totalAR = Object.values(ar).reduce((sum, val) => sum + (Number(val) || 0), 0);

        const context = {
            character:    this,
            attackContext:params.attackContext,
            attackTotal,
            totalAR,
            blocked:      attackTotal < totalAR   // default: miss if AC < AR
        };

        this.applyModifierPipeline('onReaction', context);

        return !context.blocked; // true = hit
    }

    /**
     * Perform a skill check or ability check.
     * @param {object} params - { checkType, DC, advantage }
     */
    check(params = {}) {
        const context = {
            character: this,
            checkType: params.checkType || 'ability',
            baseValue: 0,
            roll:      [{ dice: '1d20', context: 'check roll' }],
            advantage: params.advantage || 0,
            DC:        params.DC || 10,
            success:   false
        };

        this.applyModifierPipeline(`onCheck_${context.checkType}`, context);
        this.applyModifierPipeline('onCheck', context);

        for (const roll of context.roll) {
            roll.roll   = this._rollDice({ dice: roll.dice, advantage: context.advantage });
            roll.natural= roll.roll;
        }

        const rollTotal   = context.roll.reduce((sum, r) => sum + (r.roll || 0), 0);
        context.total     = rollTotal + context.baseValue;
        context.success   = context.total >= context.DC;

        this.applyModifierPipeline('onCheckResult', context);

        return {
            success:   context.success,
            total:     context.total,
            roll:      rollTotal,
            bonus:     context.baseValue,
            DC:        context.DC,
            checkType: context.checkType
        };
    }

    /**
     * Full attack resolution.
     * @param {object} params - { target, weapon, damageParts, ... }
     */
    attack(params) {
        const context = {
            attacker: this,
            target:   params.target,
            weapon:   params.weapon || { name: 'Unarmed Strike', damage: '1d1', damageType: 'bludgeoning' },

            // Attack Roll
            attackRoll:    [{ dice: '1d20', context: 'attack roll' }],
            baseAC:        0,
            AC:            0,
            attackBonus:   0,
            advantage:     0,

            // Damage
            // FIX: spread params.damageParts safely — it may be undefined
            damageParts: [
                ...(params.damageParts || []),
                {
                    dice:   params.weapon?.damage     || '1d1',
                    type:   params.weapon?.damageType || 'bludgeoning',
                    source: 'weapon'
                }
            ],
            // FIX: start as empty array — an object {  } caused NaN in reduce
            flatBonus:      [],
            damageAdvantage:0,
            isCrit:         0,
            hits:           false
        };

        gameEvents.emitGameEvent('preAttack', { attacker: this.name, target: params.target.name });
        this.applyModifierPipeline('onAttackRoll', context);

        // Roll attack dice
        for (const roll of context.attackRoll) {
            roll.roll    = this._rollDice({ dice: roll.dice, advantage: context.advantage });
            roll.natural = roll.roll;
        }

        // Natural 20 → crit
        if (context.attackRoll.find((r) => r.context === 'attack roll')?.natural === 20) {
            context.isCrit += 1;
        }

        this.applyModifierPipeline('onACCalc', context);

        for (const roll of context.attackRoll) context.baseAC += roll.roll;
        context.AC = context.baseAC + context.attackBonus;

        // Ask the target whether the attack lands (their reaction / defense)
        context.hits = params.target.reaction({ attackContext: context });

        if (context.hits) {
            this.applyModifierPipeline('onDamageCalc', context);

            for (const part of context.damageParts) {
                part.total = this._rollDice({ dice: part.dice, advantage: context.damageAdvantage });
                for (let i = 0; i < context.isCrit; i++) {
                    // Extra crit dice, always with best-of-two (advantage: 1 simulates "max" feel)
                    part.total += this._rollDice({ dice: part.dice, advantage: 1 });
                }
            }

            params.target.takeDamage({
                damageParts: context.damageParts,
                flatBonus:   context.flatBonus,
                attacker:    this,
                isCrit:      context.isCrit
            });

            const totalDamage = context.damageParts.reduce((sum, p) => sum + (p.total || 0), 0)
                              + context.flatBonus.reduce((sum,  b) => sum + (b.value || 0), 0);
            context.totalDamage = totalDamage;

            gameEvents.emitGameEvent('attack', { attacker: this.name, target: params.target.name, damage: totalDamage, isCrit: context.isCrit });
        } else {
            context.totalDamage = 0;
            gameEvents.emitGameEvent('attackMiss', { attacker: this.name, target: params.target.name });
        }

        return context;
    }

    /**
     * Take damage. Called by the attacker after a successful hit.
     */
    takeDamage(damageInfo) {
        const context = {
            target:      this,
            attacker:    damageInfo.attacker,
            damageParts: damageInfo.damageParts || [],
            flatBonus:   damageInfo.flatBonus   || [],
            // FIX: default to 0, not undefined
            finalDamage: damageInfo.damage || 0,
            isCrit:      damageInfo.isCrit || 0,
            resistances: {},
            immunities:  {},
            ar:          this.AR || {}
        };

        this.applyModifierPipeline('onTakeDamage', context);

        if(context.resistances.magical){
            context.resistances.cold = (context.resistances.cold || 0) + context.resistances.magical;
            context.resistances.fire = (context.resistances.fire || 0) + context.resistances.magical;
            context.resistances.lightning = (context.resistances.lightning || 0) + context.resistances.magical;
            context.resistances.thunder = (context.resistances.thunder || 0) + context.resistances.magical;
            context.resistances.poison = (context.resistances.poison || 0) + context.resistances.magical;
            context.resistances.acid = (context.resistances.acid || 0) + context.resistances.magical;
            context.resistances.necrotic = (context.resistances.necrotic || 0) + context.resistances.magical;
            context.resistances.radiant = (context.resistances.radiant || 0) + context.resistances.magical;
            context.resistances.force = (context.resistances.force || 0) + context.resistances.magical;
            context.resistances.psychic = (context.resistances.psychic || 0) + context.resistances.magical;
        }

        if(context.immunities.magical){
            context.immunities.cold = context.immunities.magical;
            context.immunities.fire = context.immunities.magical;
            context.immunities.lightning = context.immunities.magical;
            context.immunities.thunder = context.immunities.magical;
            context.immunities.poison = context.immunities.magical;
            context.immunities.acid = context.immunities.magical;
            context.immunities.necrotic = context.immunities.magical;
            context.immunities.radiant = context.immunities.magical;
            context.immunities.force = context.immunities.magical;
            context.immunities.psychic = context.immunities.magical;
        }

        if(context.immunities.physical){
            context.immunities.slashing = context.immunities.physical;
            context.immunities.piercing = context.immunities.physical;
            context.immunities.bludgeoning = context.immunities.physical;
        }

        if(context.resistances.physical){
            context.resistances.slashing = (context.resistances.slashing || 0) + context.resistances.physical;
            context.resistances.piercing = (context.resistances.piercing || 0) + context.resistances.physical;
            context.resistances.bludgeoning = (context.resistances.bludgeoning || 0) + context.resistances.physical;
        }
        
        if (context.ar.magical){
            context.ar.cold = (context.ar.cold || 0) + context.ar.magical;;
            context.ar.fire = (context.ar.fire || 0) + context.ar.magical;
            context.ar.lightning = (context.ar.lightning || 0) + context.ar.magical;
            context.ar.thunder = (context.ar.thunder || 0) + context.ar.magical;
            context.ar.poison = (context.ar.poison || 0) + context.ar.magical;
            context.ar.acid = (context.ar.acid || 0) + context.ar.magical;
            context.ar.necrotic = (context.ar.necrotic || 0) + context.ar.magical;
            context.ar.radiant = (context.ar.radiant || 0) + context.ar.magical;
            context.ar.force = (context.ar.force || 0) + context.ar.magical;
            context.ar.psychic = (context.ar.psychic || 0) + context.ar.magical;
        }

        if (context.ar.physical){
            context.ar.slashing = (context.ar.slashing || 0) + context.ar.physical;
            context.ar.piercing = (context.ar.piercing || 0) + context.ar.physical;
            context.ar.bludgeoning = (context.ar.bludgeoning || 0) + context.ar.physical;
        }

        for (const part of context.damageParts) {
            if (!part.total) continue;

            if (context.immunities[part.type]) {
                part.total = 0;
            } else if (context.resistances[part.type]) {
                // FIX: use ** (exponentiation), not ^ (bitwise XOR)
                // Each resistance level reduces damage by ~5%: 0.95^1=0.95, 0.95^2=0.9025, etc.
                part.total = Math.floor(part.total * (0.95 ** context.resistances[part.type]));
            }

            if (context.ar[part.type]) {
                part.total = Math.max(0, part.total - context.ar[part.type]);
            }

            context.finalDamage += part.total;
        }

        for (const bonus of context.flatBonus) {
            if (!bonus.value) continue;

            if (context.immunities[bonus.type]) {
                bonus.value = 0;
            } else if (context.resistances[bonus.type]) {
                // FIX: ** not ^
                bonus.value = Math.floor(bonus.value * (0.95 ** context.resistances[bonus.type]));
            }

            if (context.ar[bonus.type]) {
                bonus.value = Math.max(0, bonus.value - context.ar[bonus.type]);
            }

            context.finalDamage += bonus.value * (context.isCrit || 1) * context.damageParts.length;
        }

        const actualDamage = Math.max(1, Math.floor(context.finalDamage));

        const oldHP = this._baseHP.current;
        if (this._baseHP.temp > 0) {
            const tempDamage = Math.min(actualDamage, this._baseHP.temp);
            this._baseHP.temp    -= tempDamage;
            this._baseHP.current  = Math.max(0, this._baseHP.current - (actualDamage - tempDamage));
        } else {
            this._baseHP.current = Math.max(0, this._baseHP.current - actualDamage);
        }
        console.log(`[DAMAGE] ${this.name} took ${actualDamage} damage: ${oldHP} → ${this._baseHP.current} HP`);

        if (this._baseHP.current === 0) {
            gameEvents.emitGameEvent('characterDown', { target: this.name });
        }

        gameEvents.emitGameEvent('damageTaken', { target: this.name, damage: actualDamage, remaining: this._baseHP.current });

        return context;
    }


    heal(healingInfo) {
        const context = {
            target:  this,
            healingParts: healingInfo.healingParts || [{

            }],
            flatBonus:   healingInfo.flatBonus || [{}],
            source:  healingInfo.source || 'unknown',
            finalHealing: 0
        };

        this.applyModifierPipeline('onPreHeal', context);

        for(const t of context.healingParts) {
            t.total = Math.max(0, this._rollDice(t.dice));
            context.finalHealing += t.total;
        }
        for(const b of context.flatBonus) {
            b.value = Math.max(0, Number(b.value) || 0);
            context.finalHealing += b.value;
        }

        this.applyModifierPipeline('onHeal', context);
        
        const actualHealing = Math.max(0, Math.floor(context.finalHealing));
        this._baseHP.current = Math.min(this.HP.max, this._baseHP.current + actualHealing);


        gameEvents.emitGameEvent('healed', { target: this.name, healing: actualHealing, hp: this._baseHP.current });

        return context;
    }

    // =========================================================================
    // STATUS EFFECTS & INVENTORY
    // =========================================================================

    addStatusEffect(effectInput) {
        const normalizeKey = (value) => String(value || '').trim();
        const toSnake = (value) => normalizeKey(value)
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            .replace(/[^a-zA-Z0-9]+/g, '_')
            .toLowerCase();

        const findEffect = (value) => {
            const key = normalizeKey(value);
            if (!key) return null;
            const keyLower = key.toLowerCase();

            // Check aliases first if available
            const aliases = EFFECTS.aliases || {};
            const aliasedId = aliases[key] || aliases[keyLower] || aliases[toSnake(key)];
            if (aliasedId) {
                const aliasLower = aliasedId.toLowerCase();
                const found = EFFECTS.find((e) => {
                    const id = String(e?.id || '').toLowerCase();
                    return id === aliasLower;
                });
                if (found) return found;
            }

            // Direct id/name match
            let found = EFFECTS.find((e) => {
                const id = String(e?.id || '').toLowerCase();
                const name = String(e?.name || '').toLowerCase();
                return id === keyLower || name === keyLower;
            });
            if (found) return found;

            // Snake_case conversion match
            const snake = toSnake(key);
            if (snake && snake !== keyLower) {
                const snakeLower = snake.toLowerCase();
                found = EFFECTS.find((e) => {
                    const id = String(e?.id || '').toLowerCase();
                    const name = String(e?.name || '').toLowerCase();
                    return id === snakeLower || name === snakeLower;
                });
                if (found) return found;
            }

            // Check effect aliases array
            found = EFFECTS.find((e) => {
                const effectAliases = Array.isArray(e?.aliases) ? e.aliases : [];
                return effectAliases.includes(keyLower) || effectAliases.includes(snake);
            });
            if (found) return found;

            // Display name match
            const display = this._toDisplayName(key);
            if (display && display.toLowerCase() !== keyLower) {
                const displayLower = display.toLowerCase();
                found = EFFECTS.find((e) => {
                    const id = String(e?.id || '').toLowerCase();
                    const name = String(e?.name || '').toLowerCase();
                    return id === displayLower || name === displayLower;
                });
                if (found) return found;
            }

            return null;
        };

        let effect = null;

        if (typeof effectInput === 'string') {
            const base = findEffect(effectInput);
            effect = base ? { ...base } : { id: effectInput, name: this._toDisplayName(effectInput) };
        } else if (effectInput && typeof effectInput === 'object') {
            const lookupKey = effectInput.id || effectInput.name;
            const base = lookupKey ? findEffect(lookupKey) : null;
            effect = base ? { ...base, ...effectInput } : { ...effectInput };

            if (!effect.name && (effect.id || lookupKey)) {
                effect.name = this._toDisplayName(effect.id || lookupKey);
            }
        }

        if (!effect || typeof effect !== 'object') {
            console.warn('Status effect is invalid or missing.');
            return;
        }

        if (!effect.name) {
            console.warn('Status effect is missing a name.', effect);
            return;
        }

        if (!effect.id && effect.name) {
            effect.id = this._toIdKey(effect.name, 'effect');
        }

        const isStackable = effect.isStackable !== undefined ? effect.isStackable : effect.stackable !== false;
        const maxStack = Number.isFinite(Number(effect.maxStack))
            ? Number(effect.maxStack)
            : (Number.isFinite(Number(effect.maxStacks)) ? Number(effect.maxStacks) : 100);
        const stackValue = Number.isFinite(Number(effect.stack))
            ? Number(effect.stack)
            : (Number.isFinite(Number(effect.stacks)) ? Number(effect.stacks) : 1);

        effect.isStackable = isStackable;
        effect.maxStack = maxStack;
        effect.stack = stackValue;

        const existing = this.statusEffects.find((e) => e.name === effect.name);

        if (!existing) {
            this.statusEffects.push(effect);
        } else {
            if (effect.duration === -1) {
                // Infinite duration - do not modify existing duration
                existing.duration = -1;
            } else if (Number.isFinite(Number(effect.duration))) {
                const baseDuration = Number.isFinite(Number(existing.duration)) ? Number(existing.duration) : 0;
                existing.duration = baseDuration + (effect.duration || 1);
            } else if (Number.isFinite(Number(existing.duration))) {
                existing.duration = Number(existing.duration) + 1;
            }

            if (isStackable === false) {
                existing.stack = 1;
            } else {
                const currentStack = Number.isFinite(Number(existing.stack)) ? Number(existing.stack) : 1;
                const addStack = Number.isFinite(Number(effect.stack)) ? Number(effect.stack) : 1;
                existing.stack = Math.min(maxStack || 100, currentStack + addStack);
            }

            if (effect.modifiers && !existing.modifiers) {
                existing.modifiers = effect.modifiers;
            }
        }

        this.invalidateCache();
        gameEvents.emitGameEvent('statusEffectAdded', { target: this.name, effect: effect.name });
    }


    removeStatusEffect(effectName) {
        this.statusEffects = this.statusEffects.filter((e) => e.name !== effectName);
        this.invalidateCache();
        gameEvents.emitGameEvent('statusEffectRemoved', { target: this.name, effect: effectName });
    }

    equipItem(item) {
        this.equippedItems.push(item);
        this.rebuildActionTree();
        this.invalidateCache();
    }

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
