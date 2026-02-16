import React, { useMemo } from 'react';
import { Card } from '../../../pageComponents/card';
import { useGameData } from '../../../data/gameDataContext';
import { CircleUser } from 'lucide-react';
import {
  normalizeAbilityKey,
  parseAbilityScoreChoiceConfig,
  sanitizeChoiceMap
} from '../utils/abilityScoreModifiers';

const ABILITY_LABELS = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
};

const toTitleCase = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
};

const sizeMap = {
  tiny: 'T',
  small: 'S',
  medium: 'M',
  large: 'L',
  huge: 'H',
  gargantuan: 'G'
};

export function Race({ values, onChange }) {
  const { maps } = useGameData();
  const { racesById, subracesById } = maps;

  const selectedRace = values?.race || '';
  const selectedSubrace = values?.subrace || '';
  const selectedSize = values?.model?.size || '';
  const abilityScoreChoices = values?.abilityScoreChoices || {};

  const emit = (partial) => {
    if (typeof onChange === 'function') onChange(partial);
  };

  const selectedRaceObj = useMemo(() => {
    return racesById[selectedRace] || null;
  }, [racesById, selectedRace]);

  const filteredRaces = useMemo(() => {
    if (!selectedSize) return [];
    const normalizedSize = sizeMap[String(selectedSize).toLowerCase()] || String(selectedSize).toUpperCase();
    return Object.values(racesById).filter((race) => race && race.size === normalizedSize);
  }, [racesById, selectedSize]);

  const availableSubraces = useMemo(() => {
    if (!selectedRaceObj) return [];
    const subracesForRace = selectedRaceObj.subraces || [];
    return Object.values(subracesById).filter((subrace) => (
      subrace && subracesForRace.some((sub) => sub.subraceID === subrace.subraceID)
    ));
  }, [selectedRaceObj, subracesById]);

  const selectedSubraceObj = useMemo(() => {
    return subracesById[selectedSubrace] || null;
  }, [subracesById, selectedSubrace]);

  const raceChoiceConfig = useMemo(() => {
    return parseAbilityScoreChoiceConfig(selectedRaceObj);
  }, [selectedRaceObj]);

  const subraceChoiceConfig = useMemo(() => {
    return parseAbilityScoreChoiceConfig(selectedSubraceObj);
  }, [selectedSubraceObj]);

  const raceChoiceMap = useMemo(() => {
    return sanitizeChoiceMap(abilityScoreChoices?.race, raceChoiceConfig);
  }, [abilityScoreChoices?.race, raceChoiceConfig]);

  const subraceChoiceMap = useMemo(() => {
    return sanitizeChoiceMap(abilityScoreChoices?.subrace, subraceChoiceConfig);
  }, [abilityScoreChoices?.subrace, subraceChoiceConfig]);

  const raceDisplayModifiers = useMemo(() => {
    return Object.entries(selectedRaceObj?.abilityScoreModifiers || {})
      .filter(([ability]) => Boolean(normalizeAbilityKey(ability)));
  }, [selectedRaceObj]);

  const subraceDisplayModifiers = useMemo(() => {
    return Object.entries(selectedSubraceObj?.abilityScoreModifiers || {})
      .filter(([ability]) => Boolean(normalizeAbilityKey(ability)));
  }, [selectedSubraceObj]);

  const updateAbilityChoice = (scope, ability, config) => {
    if (!config || !scope || !ability) return;
    const normalizedAbility = normalizeAbilityKey(ability);
    if (!normalizedAbility) return;

    const currentChoices = sanitizeChoiceMap(abilityScoreChoices?.[scope], config);
    const nextChoices = { ...currentChoices };

    if (nextChoices[normalizedAbility]) {
      delete nextChoices[normalizedAbility];
    } else if (Object.keys(nextChoices).length < config.chooseCount) {
      nextChoices[normalizedAbility] = config.amount;
    } else {
      return;
    }

    emit({
      abilityScoreChoices: {
        ...abilityScoreChoices,
        [scope]: nextChoices
      }
    });
  };

  const handleRaceChange = (raceId) => {
    emit({
      race: raceId,
      subrace: '',
      abilityScoreChoices: {
        ...abilityScoreChoices,
        race: {},
        subrace: {}
      }
    });
  };

  const handleSubraceChange = (subraceId) => {
    emit({
      subrace: subraceId,
      abilityScoreChoices: {
        ...abilityScoreChoices,
        subrace: {}
      }
    });
  };

  const renderChoiceCard = (scope, config, choiceMap, accentClass) => {
    if (!config) return null;

    const selectedCount = Object.keys(choiceMap).length;
    const atLimit = selectedCount >= config.chooseCount;

    return (
      <Card className={`bg-website-default-800 ${accentClass}`}>
        <Card.Header className='border-b border-website-default-700 pb-4'>
          <Card.Title className='text-website-default-100'>Ability Score Choices</Card.Title>
          <Card.Description className='text-website-default-300'>
            Choose {config.chooseCount} ability score{config.chooseCount > 1 ? 's' : ''} to gain +{config.amount}.
          </Card.Description>
        </Card.Header>
        <Card.Content className='pt-6 space-y-3'>
          <div className='text-sm text-website-default-300'>
            Selected {selectedCount} / {config.chooseCount}
          </div>
          <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
            {config.options.map((ability) => {
              const isActive = Boolean(choiceMap[ability]);
              const disabled = !isActive && atLimit;
              return (
                <button
                  key={ability}
                  type='button'
                  disabled={disabled}
                  onClick={() => updateAbilityChoice(scope, ability, config)}
                  className={`p-3 rounded border text-sm transition-colors ${isActive ? 'bg-website-specials-900/40 border-website-specials-500 text-white' : 'bg-website-default-900 border-website-default-700 text-website-default-200 hover:border-website-default-500'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {ABILITY_LABELS[ability] || toTitleCase(ability)} (+{config.amount})
                </button>
              );
            })}
          </div>
        </Card.Content>
      </Card>
    );
  };

  return (
    <div className='bg-website-default-900 min-h-screen grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr]'>
      <div className='p-4 space-y-4 md:col-start-2'>
        <div className='flex flex-row p-4 space-x-4 border-b border-website-specials-500'>
          <CircleUser size={48} />
          <div className='flex flex-col'>
            <div className='text-left text-l font-semibold'>Character Name</div>
            <input
              type='text'
              placeholder='Name...'
              className='border-b border-website-highlights-400 bg-website-default-900 focus:outline-none focus:bg-gradient-to-t from-website-highlights-500 to-website-default-900'
              value={values.name || ''}
              onChange={(e) => emit({ name: e.target.value })}
            />
          </div>
        </div>

        <div className='space-y-8 flex flex-col text-left'>
          <div>
            <h1 className='text-2xl font-semibold mb-4 text-white'>Race</h1>
            <div className='grid grid-cols-1 gap-6'>
              <Card className={selectedSize ? 'bg-website-highlights-900/20 border-website-highlights-500' : 'bg-website-specials-900/20 border-website-specials-500'}>
                <Card.Content className='pt-6 pb-6'>
                  <div className={`flex items-center gap-3 ${selectedSize ? 'text-website-highlights-300' : 'text-website-specials-300'}`}>
                    {selectedSize ? (
                      <span className='text-sm'>Showing races matching your selected size: <span className='font-semibold text-website-highlights-400'>{selectedSize.charAt(0).toUpperCase() + selectedSize.slice(1)}</span></span>
                    ) : (
                      <span className='text-sm'><span className='font-semibold'>Tip:</span> Select a size in Customization to filter available races by size.</span>
                    )}
                  </div>
                </Card.Content>
              </Card>

              <Card className='bg-website-default-800 border-website-specials-500'>
                <Card.Header>
                  <Card.Title className='text-website-default-100'>Race</Card.Title>
                  <Card.Description className='text-website-default-300'>Choose your character&apos;s race.</Card.Description>
                </Card.Header>
                <Card.Content>
                  <div className='flex flex-col'>
                    <select
                      className='rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 text-white focus:outline-none'
                      value={selectedRace}
                      onChange={(e) => handleRaceChange(e.target.value)}
                    >
                      <option value='' disabled>Select race</option>
                      {filteredRaces.length > 0 ? (
                        filteredRaces.map((race) => (
                          <option key={race._id} value={race._id}>{race.name}</option>
                        ))
                      ) : (
                        <option disabled>No races match this size</option>
                      )}
                    </select>
                    {selectedRaceObj && (
                      <div className='mt-4 p-4 border border-website-specials-500 rounded bg-website-default-900/50'>
                        <div className='text-website-default-300 text-sm'>{selectedRaceObj.description}</div>
                      </div>
                    )}
                  </div>
                </Card.Content>
              </Card>

              {raceDisplayModifiers.length > 0 && (
                <Card className='bg-website-default-800 border-website-specials-500'>
                  <Card.Header className='border-b border-website-default-700 pb-4'>
                    <Card.Title className='text-website-default-100'>Ability Score Modifiers</Card.Title>
                  </Card.Header>
                  <Card.Content className='pt-6'>
                    <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
                      {raceDisplayModifiers.map(([ability, modifier]) => (
                        <div key={ability} className='bg-website-default-900/50 p-4 rounded-lg border border-website-default-700 text-center'>
                          <h4 className='text-website-specials-400 text-xs tracking-widest mb-2 uppercase'>{ABILITY_LABELS[normalizeAbilityKey(ability)] || toTitleCase(ability)}</h4>
                          <p className='text-website-specials-500 font-bold text-lg'>+{modifier}</p>
                        </div>
                      ))}
                    </div>
                  </Card.Content>
                </Card>
              )}

              {renderChoiceCard('race', raceChoiceConfig, raceChoiceMap, 'border-website-specials-500')}

              {selectedRaceObj?.traits && selectedRaceObj.traits.length > 0 && (
                <Card className='bg-website-default-800 border-website-specials-500'>
                  <Card.Header className='border-b border-website-default-700/50'>
                    <Card.Title className='text-website-default-100'>Racial Traits</Card.Title>
                  </Card.Header>
                  <Card.Content className='pt-6 space-y-2'>
                    {selectedRaceObj.traits.map((trait, idx) => (
                      <div key={`${trait}_${idx}`} className='p-3 bg-website-default-900/50 border border-website-default-700 rounded-lg'>
                        <div className='flex items-start gap-2'>
                          <span className='text-website-specials-400 font-bold'>*</span>
                          <span className='text-website-default-100'>{toTitleCase(trait)}</span>
                        </div>
                      </div>
                    ))}
                  </Card.Content>
                </Card>
              )}

              {selectedRaceObj?.languages && selectedRaceObj.languages.length > 0 && (
                <Card className='bg-website-default-800 border-website-specials-500'>
                  <Card.Header className='border-b border-website-default-700/50'>
                    <Card.Title className='text-website-default-100'>Languages</Card.Title>
                  </Card.Header>
                  <Card.Content className='pt-6'>
                    <div className='flex flex-wrap gap-2'>
                      {selectedRaceObj.languages.map((lang, idx) => (
                        <span key={`${lang}_${idx}`} className='px-3 py-2 bg-website-default-900 border border-website-default-700 rounded-lg text-sm text-website-default-100'>
                          {toTitleCase(lang)}
                        </span>
                      ))}
                    </div>
                  </Card.Content>
                </Card>
              )}

              {selectedRaceObj && (
                <Card className='bg-website-default-800 border-website-specials-500'>
                  <Card.Header className='border-b border-website-default-700/50'>
                    <Card.Title className='text-website-default-100'>Physical Traits</Card.Title>
                  </Card.Header>
                  <Card.Content className='pt-6 grid grid-cols-2 gap-4'>
                    <div className='bg-website-default-900/50 p-4 rounded-lg border border-website-default-700'>
                      <h4 className='text-website-highlights-400 text-xs tracking-widest mb-2 uppercase'>Size</h4>
                      <p className='text-website-default-100 font-semibold'>{selectedRaceObj.size === 'M' ? 'Medium' : toTitleCase(selectedRaceObj.size)}</p>
                    </div>
                    <div className='bg-website-default-900/50 p-4 rounded-lg border border-website-default-700'>
                      <h4 className='text-website-highlights-400 text-xs tracking-widest mb-2 uppercase'>Speed</h4>
                      <p className='text-website-default-100 font-semibold'>{selectedRaceObj.speed} ft.</p>
                    </div>
                  </Card.Content>
                </Card>
              )}
            </div>
          </div>

          {selectedRaceObj && availableSubraces.length > 0 && (
            <div>
              <h1 className='text-2xl font-semibold mb-4 text-white'>Subrace</h1>
              <div className='grid grid-cols-1 gap-6'>
                <Card className='bg-website-default-800 border-website-highlights-500'>
                  <Card.Header>
                    <Card.Title className='text-website-default-100'>Subrace</Card.Title>
                    <Card.Description className='text-website-default-300'>Choose your subrace specialization (optional).</Card.Description>
                  </Card.Header>
                  <Card.Content>
                    <div className='flex flex-col space-y-4'>
                      <select
                        className='rounded border border-website-highlights-500 bg-website-default-900 px-3 py-2 text-white focus:outline-none'
                        value={selectedSubrace}
                        onChange={(e) => handleSubraceChange(e.target.value)}
                      >
                        <option value=''>None (Optional)</option>
                        {availableSubraces.map((subrace) => (
                          <option key={subrace._id} value={subrace._id}>{subrace.name}</option>
                        ))}
                      </select>
                      {selectedSubraceObj && (
                        <div className='p-4 border border-website-highlights-500 rounded bg-website-default-900/50'>
                          <div className='text-website-default-300 text-sm'>{selectedSubraceObj.description}</div>
                        </div>
                      )}
                    </div>
                  </Card.Content>
                </Card>

                {subraceDisplayModifiers.length > 0 && (
                  <Card className='bg-website-default-800 border-website-highlights-500'>
                    <Card.Header className='border-b border-website-default-700 pb-4'>
                      <Card.Title className='text-website-default-100'>Ability Score Modifiers</Card.Title>
                    </Card.Header>
                    <Card.Content className='pt-6'>
                      <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
                        {subraceDisplayModifiers.map(([ability, modifier]) => (
                          <div key={ability} className='bg-website-default-900/50 p-4 rounded-lg border border-website-default-700 text-center'>
                            <h4 className='text-website-highlights-400 text-xs tracking-widest mb-2 uppercase'>{ABILITY_LABELS[normalizeAbilityKey(ability)] || toTitleCase(ability)}</h4>
                            <p className='text-website-highlights-500 font-bold text-lg'>+{modifier}</p>
                          </div>
                        ))}
                      </div>
                    </Card.Content>
                  </Card>
                )}

                {renderChoiceCard('subrace', subraceChoiceConfig, subraceChoiceMap, 'border-website-highlights-500')}

                {selectedSubraceObj?.traits && selectedSubraceObj.traits.length > 0 && (
                  <Card className='bg-website-default-800 border-website-highlights-500'>
                    <Card.Header className='border-b border-website-default-700/50'>
                      <Card.Title className='text-website-default-100'>Subrace Traits</Card.Title>
                    </Card.Header>
                    <Card.Content className='pt-6 space-y-2'>
                      {selectedSubraceObj.traits.map((trait, idx) => (
                        <div key={`${trait}_${idx}`} className='p-3 bg-website-default-900/50 border border-website-default-700 rounded-lg'>
                          <div className='flex items-start gap-2'>
                            <span className='text-website-highlights-400 font-bold'>*</span>
                            <span className='text-website-default-100'>{toTitleCase(trait)}</span>
                          </div>
                        </div>
                      ))}
                    </Card.Content>
                  </Card>
                )}

                {selectedSubraceObj?.languages && selectedSubraceObj.languages.length > 0 && (
                  <Card className='bg-website-default-800 border-website-highlights-500'>
                    <Card.Header className='border-b border-website-default-700/50'>
                      <Card.Title className='text-website-default-100'>Languages</Card.Title>
                    </Card.Header>
                    <Card.Content className='pt-6'>
                      <div className='flex flex-wrap gap-2'>
                        {selectedSubraceObj.languages.map((lang, idx) => (
                          <span key={`${lang}_${idx}`} className='px-3 py-2 bg-website-default-900 border border-website-default-700 rounded-lg text-sm text-website-default-100'>
                            {toTitleCase(lang)}
                          </span>
                        ))}
                      </div>
                    </Card.Content>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Race;
