export const CORE_ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

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

export function normalizeAbilityKey(rawKey) {
  if (!rawKey) return '';
  const key = String(rawKey).trim().toLowerCase();
  return ABILITY_ALIASES[key] || '';
}

export function getModifierValue(modifiers, abilityKey) {
  const target = normalizeAbilityKey(abilityKey);
  if (!target || !modifiers || typeof modifiers !== 'object') return 0;

  for (const [rawKey, rawValue] of Object.entries(modifiers)) {
    if (normalizeAbilityKey(rawKey) !== target) continue;
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function normalizeChoiceMap(rawChoiceMap) {
  if (!rawChoiceMap || typeof rawChoiceMap !== 'object') return {};
  const out = {};

  Object.entries(rawChoiceMap).forEach(([rawKey, rawValue]) => {
    const key = normalizeAbilityKey(rawKey);
    if (!key) return;
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value === 0) return;
    out[key] = value;
  });

  return out;
}

export function getChoiceBonus(choiceMap, abilityKey) {
  const target = normalizeAbilityKey(abilityKey);
  if (!target) return 0;
  const normalized = normalizeChoiceMap(choiceMap);
  return Number(normalized[target] || 0);
}

export function sanitizeChoiceMap(rawChoiceMap, config) {
  const normalized = normalizeChoiceMap(rawChoiceMap);
  if (!config || typeof config !== 'object') return {};

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
  for (const [key] of Object.entries(normalized)) {
    if (!allowedOptions.has(key)) continue;
    out[key] = safeAmount;
    picked += 1;
    if (picked >= maxChoices) break;
  }
  return out;
}

export function parseAbilityScoreChoiceConfig(entity) {
  if (!entity || typeof entity !== 'object') return null;

  const choices = entity.choices || {};
  const rawAbilityChoice =
    choices.abilityScores ||
    choices.abilityScore ||
    choices.abilityScoreModifiers ||
    null;

  let chooseCount = 0;
  let amount = 1;
  let options = [...CORE_ABILITY_KEYS];

  // Common string format in your data: "Choose 2 1", "Cha 2 Choose 2 1"
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
    const chooseFromBase = Number(entity.abilityScoreModifiers?.choose || 0);
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
}
