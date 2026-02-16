const Character = require('../data/mongooseDataStructure/character');
const Player = require('../data/mongooseDataStructure/player');
const ClassModel = require('../data/mongooseDataStructure/class');
const SubclassModel = require('../data/mongooseDataStructure/subclass');
const RaceModel = require('../data/mongooseDataStructure/race');
const SubraceModel = require('../data/mongooseDataStructure/subrace');
const mongoose = require('mongoose');

const CORE_STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ALL_ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha', 'luck'];
const SKILL_NAMES = [
    'acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history',
    'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception',
    'performance', 'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival'
];
const ACTION_TYPE_ALIASES = {
    action: 'action',
    standard: 'action',
    main: 'action',
    bonus: 'bonusAction',
    bonusaction: 'bonusAction',
    reaction: 'reaction',
    move: 'movement',
    movement: 'movement',
    free: 'free',
    freeaction: 'free',
    passive: 'passive',
    special: 'special'
};

const toUniqueArray = (arr) => [...new Set((arr || []).filter(Boolean).map((v) => String(v)))];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const asObject = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value;
};

const toStringArray = (value) => {
    if (Array.isArray(value)) {
        return value.map((v) => String(v).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        return value
            .split(/[\n,]/g)
            .map((v) => v.trim())
            .filter(Boolean);
    }
    return [];
};

const toActionId = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeActionType = (rawType) => {
    const normalized = String(rawType || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '');
    return ACTION_TYPE_ALIASES[normalized] || 'action';
};

const normalizeCharacterActions = (rawActions) => {
    let entries = [];

    if (Array.isArray(rawActions)) {
        entries = rawActions;
    } else if (typeof rawActions === 'string') {
        entries = [rawActions];
    } else if (rawActions && typeof rawActions === 'object') {
        entries = Object.entries(rawActions).map(([name, value]) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                return { ...value, name: value.name || name };
            }
            if (typeof value === 'string') {
                return { name, description: value };
            }
            return { name };
        });
    }

    const dedupe = new Set();
    const actions = [];

    entries.forEach((entry, index) => {
        const source = typeof entry === 'string'
            ? { name: entry }
            : (entry && typeof entry === 'object' ? entry : null);
        if (!source) return;

        const name = String(source.name || source.label || source.title || '').trim();
        if (!name) return;

        const normalized = {
            id: String(source.id || toActionId(name) || `action_${index + 1}`),
            name,
            actionType: normalizeActionType(source.actionType || source.type || source.kind),
            source: String(source.source || source.sourceType || 'custom'),
            sourceId: String(source.sourceId || source.sourceKey || ''),
            description: String(source.description || ''),
            cost: String(source.cost || ''),
            requirements: toStringArray(source.requirements),
            enabled: source.enabled !== false
        };

        const dedupeKey = `${normalized.id}|${normalized.actionType}|${normalized.source}`.toLowerCase();
        if (dedupe.has(dedupeKey)) return;
        dedupe.add(dedupeKey);
        actions.push(normalized);
    });

    return actions;
};

const buildStatRef = (baseValue, totalValue) => ({
    total: totalValue,
    permMods: { base: baseValue },
    tempMods: {}
});

const getBaseStatValue = (stats, lowerKey, upperKey) => {
    const lower = stats?.[lowerKey];
    if (lower !== undefined && lower !== null && lower !== '') {
        const parsed = Number.parseInt(lower, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    const upper = stats?.[upperKey];
    if (upper && typeof upper === 'object') {
        const parsed = Number.parseInt(upper?.permMods?.base ?? upper?.total, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    const fallback = Number.parseInt(upper, 10);
    return Number.isNaN(fallback) ? 0 : fallback;
};

const ABILITY_ALIASES = {
    str: 'str',
    strength: 'str',
    dex: 'dex',
    dexterity: 'dex',
    con: 'con',
    constitution: 'con',
    int: 'int',
    intelligence: 'int',
    wis: 'wis',
    wisdom: 'wis',
    cha: 'cha',
    charisma: 'cha',
    luck: 'luck'
};

const normalizeAbilityKey = (rawKey) => {
    if (!rawKey) return '';
    const key = String(rawKey).trim().toLowerCase();
    return ABILITY_ALIASES[key] || '';
};

const getModifierValue = (modifiers, abilityKey) => {
    const target = normalizeAbilityKey(abilityKey);
    if (!target || !modifiers || typeof modifiers !== 'object') return 0;

    for (const [rawKey, rawValue] of Object.entries(modifiers)) {
        if (normalizeAbilityKey(rawKey) !== target) continue;
        const parsed = Number(rawValue);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const parseAbilityScoreChoiceConfig = (entity) => {
    if (!entity || typeof entity !== 'object') return null;

    const choices = asObject(entity.choices);
    const rawAbilityChoice =
        choices.abilityScores ||
        choices.abilityScore ||
        choices.abilityScoreModifiers ||
        null;

    let chooseCount = 0;
    let amount = 1;
    let options = [...CORE_STAT_KEYS];

    if (typeof rawAbilityChoice === 'string') {
        const chooseMatch = rawAbilityChoice.match(/choose\s+(\d+)/i);
        const amountMatch = rawAbilityChoice.match(/choose\s+\d+\s+(\d+)/i);
        chooseCount = chooseMatch ? Number(chooseMatch[1]) : 0;
        amount = amountMatch ? Number(amountMatch[1]) : 1;
    } else if (rawAbilityChoice && typeof rawAbilityChoice === 'object') {
        chooseCount = Number(
            rawAbilityChoice.choose ??
            rawAbilityChoice.count ??
            rawAbilityChoice.amount ??
            0
        );
        amount = Number(
            rawAbilityChoice.value ??
            rawAbilityChoice.modifier ??
            rawAbilityChoice.points ??
            1
        );

        if (Array.isArray(rawAbilityChoice.options) && rawAbilityChoice.options.length > 0) {
            options = rawAbilityChoice.options
                .map(normalizeAbilityKey)
                .filter(Boolean);
        }
    }

    if (chooseCount <= 0) {
        const chooseFromBase = Number(entity?.abilityScoreModifiers?.choose || 0);
        chooseCount = Number.isFinite(chooseFromBase) ? chooseFromBase : 0;
    }

    if (chooseCount <= 0) return null;

    const fixedKeys = Object.keys(entity.abilityScoreModifiers || {})
        .map(normalizeAbilityKey)
        .filter((k) => k && k !== 'choose');

    const uniqueOptions = [...new Set(options)];
    const filteredOptions = uniqueOptions.filter((opt) => !fixedKeys.includes(opt));
    const finalOptions = filteredOptions.length > 0 ? filteredOptions : uniqueOptions;
    const finalChooseCount = Math.min(chooseCount, finalOptions.length);
    const finalAmount = Number.isFinite(amount) && amount > 0 ? amount : 1;

    if (finalChooseCount <= 0 || finalOptions.length === 0) return null;

    return {
        chooseCount: finalChooseCount,
        amount: finalAmount,
        options: finalOptions
    };
};

const sanitizeChoiceMap = (rawChoiceMap, config) => {
    if (!config || typeof config !== 'object') return {};
    const source = asObject(rawChoiceMap);

    const amount = Number(config.amount);
    const chooseCount = Number(config.chooseCount);
    const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 1;
    const maxChoices = Number.isFinite(chooseCount) && chooseCount > 0 ? chooseCount : 0;
    if (maxChoices <= 0) return {};

    const allowedOptions = new Set(
        (config.options || [])
            .map(normalizeAbilityKey)
            .filter(Boolean)
    );
    if (allowedOptions.size === 0) return {};

    const out = {};
    let picked = 0;
    for (const [rawKey, rawValue] of Object.entries(source)) {
        const key = normalizeAbilityKey(rawKey);
        if (!key || !allowedOptions.has(key)) continue;

        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue) || numericValue <= 0) continue;

        out[key] = safeAmount;
        picked += 1;
        if (picked >= maxChoices) break;
    }

    return out;
};

const getChoiceBonus = (choiceMap, abilityKey) => {
    const key = normalizeAbilityKey(abilityKey);
    if (!key) return 0;
    return Number(choiceMap?.[key] || 0);
};

const normalizeHexColor = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : '';
};

const normalizeCustomization = (customization = {}) => {
    const source = asObject(customization);
    const normalizeColorSelection = (baseValue, customValue) => {
        const base = String(baseValue || '').trim();
        const custom = normalizeHexColor(customValue);
        const baseAsHex = normalizeHexColor(base);

        if (baseAsHex) {
            return {
                value: 'other',
                custom: custom || baseAsHex
            };
        }

        if (base === 'other') {
            return {
                value: 'other',
                custom
            };
        }

        return {
            value: base,
            custom: ''
        };
    };

    const skin = normalizeColorSelection(source.skinColor, source.skinColorCustom);
    const eye = normalizeColorSelection(source.eyeColor, source.eyeColorCustom);
    const hair = normalizeColorSelection(source.hairColor, source.hairColorCustom);

    return {
        skinColor: skin.value,
        skinColorCustom: skin.custom,
        eyeColor: eye.value,
        eyeColorCustom: eye.custom,
        hairColor: hair.value,
        hairColorCustom: hair.custom,
        additionalTraits: toStringArray(source.additionalTraits)
    };
};

const normalizeStories = (stories = {}) => {
    const relationshipsInput = asObject(stories.relationships);
    const relationships = Object.entries(relationshipsInput).reduce((acc, [name, value]) => {
        if (!name || !String(name).trim()) return acc;
        const rel = asObject(value);
        acc[String(name).trim()] = {
            relationship: String(rel.relationship || 'Friend'),
            description: String(rel.description || '')
        };
        return acc;
    }, {});

    return {
        longStory: String(stories.longStory || ''),
        personality: toStringArray(stories.personality),
        ideals: toStringArray(stories.ideals),
        flaws: toStringArray(stories.flaws),
        relationships
    };
};

const normalizeLanguages = (rawLanguages, race, subrace) => {
    const map = {};

    if (Array.isArray(rawLanguages)) {
        rawLanguages.forEach((lang) => {
            if (lang) map[String(lang)] = 'proficient';
        });
    } else {
        Object.entries(asObject(rawLanguages)).forEach(([lang, level]) => {
            if (!lang) return;
            map[String(lang)] = String(level || 'proficient');
        });
    }

    const granted = [
        ...(Array.isArray(race?.languages) ? race.languages : []),
        ...(Array.isArray(subrace?.languages) ? subrace.languages : []),
    ];
    granted.forEach((lang) => {
        if (!lang) return;
        if (!map[lang]) map[lang] = 'native';
    });

    return map;
};

const normalizeProficiencies = (rawProficiencies, cls) => {
    const output = {
        armor: [],
        weapons: [],
        tools: [],
        abilityScore: [],
        skills: []
    };
    const add = (category, value) => {
        if (!value) return;
        output[category].push(String(value));
    };

    const base = cls?.baseProficiencies || {};
    const baseArmor = toUniqueArray(base.armor);
    const baseWeapons = toUniqueArray(base.weapons);
    const baseTools = toUniqueArray(base.tools);
    const baseAbility = toUniqueArray(base.abilityScore);

    baseArmor.forEach((v) => add('armor', v));
    baseWeapons.forEach((v) => add('weapons', v));
    baseTools.forEach((v) => add('tools', v));
    baseAbility.forEach((v) => add('abilityScore', v));

    const incoming = asObject(rawProficiencies);
    const structuredKeys = ['armor', 'weapons', 'tools', 'abilityScore', 'skills'];
    const hasStructuredShape = structuredKeys.some((key) => Array.isArray(incoming[key]));

    if (hasStructuredShape) {
        structuredKeys.forEach((key) => {
            (incoming[key] || []).forEach((v) => add(key, v));
        });
    } else {
        const classSkillOptions = new Set((cls?.choices?.proficiencies?.skills?.options || []).map((s) => String(s).toLowerCase()));
        const baseArmorSet = new Set(baseArmor.map((s) => s.toLowerCase()));
        const baseWeaponSet = new Set(baseWeapons.map((s) => s.toLowerCase()));
        const baseToolSet = new Set(baseTools.map((s) => s.toLowerCase()));
        const baseAbilitySet = new Set(baseAbility.map((s) => s.toLowerCase()));
        const skillNameSet = new Set(SKILL_NAMES.map((s) => s.toLowerCase()));
        const abilityKeySet = new Set(ALL_ABILITY_KEYS);

        Object.entries(incoming).forEach(([key, value]) => {
            if (!value) return;
            const lower = String(key).toLowerCase();

            if (abilityKeySet.has(lower) || baseAbilitySet.has(lower)) {
                add('abilityScore', key);
                return;
            }
            if (classSkillOptions.has(lower) || skillNameSet.has(lower)) {
                add('skills', key);
                return;
            }
            if (baseArmorSet.has(lower) || lower.includes('armor') || lower.includes('shield')) {
                add('armor', key);
                return;
            }
            if (baseToolSet.has(lower) || /(tool|kit|supplies|instrument|set)\b/.test(lower)) {
                add('tools', key);
                return;
            }
            if (
                baseWeaponSet.has(lower) ||
                /(weapon|sword|axe|bow|crossbow|mace|staff|dagger|spear|hammer|flail|pike|whip|club|trident|rapier|scimitar)/.test(lower)
            ) {
                add('weapons', key);
                return;
            }

            // Fallback category so user selections are not lost.
            add('skills', key);
        });
    }

    return {
        armor: toUniqueArray(output.armor),
        weapons: toUniqueArray(output.weapons),
        tools: toUniqueArray(output.tools),
        abilityScore: toUniqueArray(output.abilityScore),
        skills: toUniqueArray(output.skills)
    };
};

module.exports = (socket) => {
    socket.on('playerData_saveCharacter', async (data, callback) => {
        const { character, playerID } = data || {};

        try {
            if (!character || typeof character !== 'object') {
                return callback({ success: false, message: 'Character payload is required' });
            }
            if (!playerID) {
                return callback({ success: false, message: 'playerID is required' });
            }

            const player = await Player.findById(playerID);
            if (!player) {
                return callback({ success: false, message: 'Player not found' });
            }

            const getDoc = async (Model, id) => {
                if (!id || !mongoose.isValidObjectId(id)) return null;
                try {
                    return await Model.findById(id).lean();
                } catch {
                    return null;
                }
            };

            const level = Number.parseInt(character.level, 10) || 1;
            const cls = await getDoc(ClassModel, character.class);
            await getDoc(SubclassModel, character.subclass);
            const race = await getDoc(RaceModel, character.race);
            const subrace = await getDoc(SubraceModel, character.subrace);

            const sourceStats = asObject(character.stats);
            const baseStats = {
                str: getBaseStatValue(sourceStats, 'str', 'STR'),
                dex: getBaseStatValue(sourceStats, 'dex', 'DEX'),
                con: getBaseStatValue(sourceStats, 'con', 'CON'),
                int: getBaseStatValue(sourceStats, 'int', 'INT'),
                wis: getBaseStatValue(sourceStats, 'wis', 'WIS'),
                cha: getBaseStatValue(sourceStats, 'cha', 'CHA'),
                luck: getBaseStatValue(sourceStats, 'luck', 'LUCK')
            };

            const classMods = asObject(cls?.baseStatModifier);
            const raceMods = asObject(race?.abilityScoreModifiers);
            const subraceMods = asObject(subrace?.abilityScoreModifiers);
            const raceChoiceConfig = parseAbilityScoreChoiceConfig(race);
            const subraceChoiceConfig = parseAbilityScoreChoiceConfig(subrace);
            const raceChoiceMap = sanitizeChoiceMap(character?.abilityScoreChoices?.race, raceChoiceConfig);
            const subraceChoiceMap = sanitizeChoiceMap(character?.abilityScoreChoices?.subrace, subraceChoiceConfig);
            const choiceAppliedToBase = Boolean(character?.abilityScoreChoicesAppliedToBase);

            const finalStats = {};
            CORE_STAT_KEYS.forEach((key) => {
                const choiceBonus = choiceAppliedToBase
                    ? 0
                    : getChoiceBonus(raceChoiceMap, key) + getChoiceBonus(subraceChoiceMap, key);
                const computed =
                    baseStats[key] +
                    getModifierValue(classMods, key) +
                    getModifierValue(raceMods, key) +
                    getModifierValue(subraceMods, key) +
                    choiceBonus;
                finalStats[key] = clamp(computed, 1, 30);
            });

            character.stats = {
                STR: buildStatRef(clamp(baseStats.str, 1, 30), finalStats.str),
                DEX: buildStatRef(clamp(baseStats.dex, 1, 30), finalStats.dex),
                CON: buildStatRef(clamp(baseStats.con, 1, 30), finalStats.con),
                INT: buildStatRef(clamp(baseStats.int, 1, 30), finalStats.int),
                WIS: buildStatRef(clamp(baseStats.wis, 1, 30), finalStats.wis),
                CHA: buildStatRef(clamp(baseStats.cha, 1, 30), finalStats.cha),
                LUCK: buildStatRef(clamp(baseStats.luck, 0, 30), clamp(baseStats.luck, 0, 30))
            };
            character.abilityScoreChoices = {
                race: raceChoiceMap,
                subrace: subraceChoiceMap
            };

            const resourceBase = (cls && (cls.resourceBase || cls.resourcePoolModifier)) || { HP: 0, MP: 0, STA: 0 };
            const resourceLevelUp = (cls && cls.resourceLevelUp) || { HP: 0, MP: 0, STA: 0 };
            const DEX = finalStats.dex || 0;
            const WIS = finalStats.wis || 0;
            const CON = finalStats.con || 0;
            const maxSTA = Math.floor(2 * DEX * (1 + (resourceBase.STA || 0) + ((level / 2) * (resourceLevelUp.STA || 0))));
            const maxMP = Math.floor(WIS * (1 + (resourceBase.MP || 0) + ((level / 2) * (resourceLevelUp.MP || 0))));
            const maxHP = Math.floor(CON * (1 + (resourceBase.HP || 0) + ((level / 2) * (resourceLevelUp.HP || 0))));

            character.playerId = playerID;
            character.HP = {
                current: Math.max(0, Math.min(character.HP?.current ?? maxHP, maxHP)),
                max: maxHP,
                temp: character.HP?.temp || 0
            };
            character.MP = {
                current: Math.max(0, Math.min(character.MP?.current ?? maxMP, maxMP)),
                max: maxMP,
                temp: character.MP?.temp || 0
            };
            character.STA = {
                current: Math.max(0, Math.min(character.STA?.current ?? maxSTA, maxSTA)),
                max: maxSTA,
                temp: character.STA?.temp || 0
            };

            character.skills = {
                active: asObject(character.skills?.active),
                passive: asObject(character.skills?.passive),
                proficiencies: normalizeProficiencies(character.skills?.proficiencies, cls),
                languages: normalizeLanguages(character.skills?.languages, race, subrace)
            };
            character.actions = normalizeCharacterActions(character.actions);
            character.customization = normalizeCustomization(character.customization);
            character.stories = normalizeStories(character.stories);
            delete character.abilityScoreChoicesAppliedToBase;

            const PRESERVE_EMPTY_ARRAY_PATHS = new Set([
                'stories.personality',
                'stories.ideals',
                'stories.flaws',
                'customization.additionalTraits',
                'actions'
            ]);
            const PRESERVE_EMPTY_OBJECT_PATHS = new Set([
                'abilityScoreChoices',
                'abilityScoreChoices.race',
                'abilityScoreChoices.subrace',
                'stories.relationships'
            ]);

            const characterCleaner = (obj, path = '') => {
                if (Array.isArray(obj)) {
                    const cleanedArray = obj
                        .map((attribute, index) => characterCleaner(attribute, `${path}[${index}]`))
                        .filter((attribute) => attribute !== null);
                    if (cleanedArray.length === 0 && PRESERVE_EMPTY_ARRAY_PATHS.has(path)) {
                        return [];
                    }
                    return cleanedArray;
                }
                if (obj !== null && typeof obj === 'object') {
                    const result = {};
                    for (const key in obj) {
                        const childPath = path ? `${path}.${key}` : key;
                        const value = characterCleaner(obj[key], childPath);

                        if (value === '') continue;
                        if (Array.isArray(value) && value.length === 0 && !PRESERVE_EMPTY_ARRAY_PATHS.has(childPath)) continue;
                        if (
                            typeof value === 'object' &&
                            value !== null &&
                            Object.keys(value).length === 0 &&
                            !PRESERVE_EMPTY_OBJECT_PATHS.has(childPath)
                        ) {
                            continue;
                        }

                        result[key] = value;
                    }
                    if (Object.keys(result).length === 0 && PRESERVE_EMPTY_OBJECT_PATHS.has(path)) {
                        return {};
                    }
                    return result;
                }
                return obj;
            };

            const cleanedCharacter = characterCleaner(character);

            let savedCharacter;
            if (character._id && mongoose.isValidObjectId(character._id)) {
                savedCharacter = await Character.findOneAndUpdate(
                    { _id: character._id },
                    { $set: cleanedCharacter },
                    { new: true, upsert: true, runValidators: true }
                );
            } else {
                savedCharacter = await Character.create(cleanedCharacter);
            }

            try {
                await Player.findByIdAndUpdate(
                    playerID,
                    { $addToSet: { characters: savedCharacter._id } }
                );
            } catch (err) {
                console.error('ERROR SAVING PLAYER CHARACTER DATA:', err);
                return callback({ success: false, message: err.message || 'Server error' });
            }

            callback({ success: true, character: savedCharacter });
        } catch (err) {
            console.error('ERROR saving character:', err);
            callback({ success: false, message: err.message || 'Server error' });
        }
    });
};
