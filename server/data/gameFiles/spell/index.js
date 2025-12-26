const { Spell, createSpell } = require('./Spell');
const spellData = require('./spells.json');

/**
 * Load all spells from spells.json
 */
const spellRegistry = {};
spellData.spells.forEach(spell => {
  spellRegistry[spell.id] = createSpell(spell);
});

/**
 * Get a spell by ID
 */
function getSpell(spellId) {
  return spellRegistry[spellId] || null;
}

/**
 * Get spells by level
 */
function getSpellsByLevel(level) {
  return Object.values(spellRegistry).filter(spell => spell.level === level);
}

/**
 * Get spells by school
 */
function getSpellsBySchool(school) {
  return Object.values(spellRegistry).filter(spell => spell.school === school);
}

/**
 * Get all cantrips
 */
function getCantrips() {
  return getSpellsByLevel(0);
}

module.exports = {
  Spell,
  createSpell,
  getSpell,
  getSpellsByLevel,
  getSpellsBySchool,
  getCantrips,
  spellRegistry
};
