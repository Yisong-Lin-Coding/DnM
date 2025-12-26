class ClassInstance {
  constructor(data = {}) {
    this.id = data.id || data.name || null;
    this.name = data.name || 'Unnamed Class';
    this.description = data.description || '';
    this.data = data;
    this.features = data.features || {};
    this.proficiencies = {
      base: data.baseProficiencies || [],
      choices: data.choiceProficiencies || []
    };
  }

  applyFeature(level, target, createEffect) {
    const feat = this.features[`level${level}`];
    if (!feat) return;
    // simple convention: feature can contain `effects` array
    if (Array.isArray(feat.effects)) {
      feat.effects.forEach(e => target.addEffect && target.addEffect(createEffect(e)));
    }
    // arbitrary helper hook
    if (typeof feat.applyFn === 'function') feat.applyFn(target);
  }

  applyToCharacter(level, target, createEffect) {
    for (let l = 1; l <= level; l++) this.applyFeature(l, target, createEffect);
  }
}

module.exports = ClassInstance;
