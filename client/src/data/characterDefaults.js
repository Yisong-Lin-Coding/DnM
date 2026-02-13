export const defaultCharacter = {
  name: '',
  age: { years: '', month: '', day: '' },
  gender: '',
  model: { size: '', height: '', weight: '' },
  alignment: '',
  customization: {
    skinColor: '',
    eyeColor: '',
    hairColor: '',
    additionalTraits: '',
  },
  stories: { longStory: '', personality: [], ideals: [], flaws: [], relationships: {} },
  race: '',
  class: '',
  subclass: '',
  subrace: '',
  background: '',
  stats: { str: '', dex: '', con: '', int: '', wis: '', cha: '', luck: '' },
  abilityScoreMethod: 'manual',
  inv: {
    gp: 0,
    items: {},
    equipment: {
      head: [],
      body: [],
      legs: [],
      feet: [],
      arms: [],
      hands: [],
      weapon: [],
      fingers: [],
      neck: [],
      trinkets: [],
    },
  },
  skills: {
    active: {},
    passive: {},
    proficiencies: {},
    expertise: {},
    mastary: {},
    languages: {},
  },
  effects: {},
  level: 1,
  editing:"true",
  // Equipment and item choices state
  classEquipmentChoices: {},
  classAnyItemSelections: {},
  backgroundEquipmentChoices: {},
  backgroundAnyItemSelections: {},
  proficiencyChoices: {}
};

export function createDefaultCharacter() {
  // Return a deep clone so callers can mutate the result safely
  // Use structuredClone when available, else fall back to JSON
  if (typeof structuredClone === 'function') return structuredClone(defaultCharacter);
  return JSON.parse(JSON.stringify(defaultCharacter));
}
