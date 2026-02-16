import React, { useMemo, useState } from 'react';
import { Card } from '../../../pageComponents/card';
import { useNavigate } from 'react-router-dom';
import {
  getChoiceBonus,
  getModifierValue,
  parseAbilityScoreChoiceConfig,
  sanitizeChoiceMap
} from '../utils/abilityScoreModifiers';

const LABELS = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

const toTagArray = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))];
  }
  if (typeof value === 'string') {
    return [...new Set(
      value
        .split(/[\n,]/g)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )];
  }
  return [];
};

const toTitleCase = (value) => {
  if (!value) return '';
  return String(value)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
};

export function Summary({ values, onSave, classes = [], subclasses = [], races = [], subraces = [], backgrounds = [] }) {
  const character = values || {};
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const navigate = useNavigate();

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    setSaveError('');
    try {
      const response = (typeof onSave === 'function')
        ? await onSave()
        : { success: false, message: 'Save handler unavailable' };

      if (!response?.success) {
        setSaveError(response?.message || 'Failed to save character');
        return;
      }

      navigate(`/ISK/${sessionStorage.getItem("session_ID")}/character`);
    } catch (error) {
      setSaveError(error?.message || 'Failed to save character');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedClass = useMemo(() => classes.find((c) => c._id === character.class), [classes, character.class]);
  const selectedSubclass = useMemo(() => subclasses.find((sc) => sc._id === character.subclass), [subclasses, character.subclass]);
  const selectedRace = useMemo(() => races.find((r) => r._id === character.race), [races, character.race]);
  const selectedSubrace = useMemo(() => subraces.find((sr) => sr._id === character.subrace), [subraces, character.subrace]);
  const selectedBackground = useMemo(() => backgrounds.find((b) => b._id === character.background), [backgrounds, character.background]);
  const raceChoiceConfig = useMemo(() => parseAbilityScoreChoiceConfig(selectedRace), [selectedRace]);
  const subraceChoiceConfig = useMemo(() => parseAbilityScoreChoiceConfig(selectedSubrace), [selectedSubrace]);
  const raceChoiceMap = useMemo(() => sanitizeChoiceMap(character?.abilityScoreChoices?.race, raceChoiceConfig), [character?.abilityScoreChoices?.race, raceChoiceConfig]);
  const subraceChoiceMap = useMemo(() => sanitizeChoiceMap(character?.abilityScoreChoices?.subrace, subraceChoiceConfig), [character?.abilityScoreChoices?.subrace, subraceChoiceConfig]);

  // Compute modified stats
  const baseStats = character.stats || {};
  const modifiedStats = useMemo(() => {
    const raceMods = selectedRace?.abilityScoreModifiers || {};
    const subraceMods = selectedSubrace?.abilityScoreModifiers || {};
    const classMods = selectedClass?.baseStatModifier || {};
    const out = {};
    Object.keys(LABELS).forEach((k) => {
      const base = parseInt(baseStats[k], 10) || 0;
      const bonus =
        getModifierValue(raceMods, k) +
        getModifierValue(subraceMods, k) +
        getModifierValue(classMods, k) +
        getChoiceBonus(raceChoiceMap, k) +
        getChoiceBonus(subraceChoiceMap, k);
      out[k] = base + bonus;
    });
    return out;
  }, [baseStats, selectedRace, selectedSubrace, selectedClass, raceChoiceMap, subraceChoiceMap]);

  // Proficiencies and languages
  const proficiencies = character?.skills?.proficiencies || {};
  const selectedLanguages = Object.keys(character?.skills?.languages || {});
  const languages = selectedLanguages.length > 0
    ? selectedLanguages
    : (selectedSubrace?.languages?.length ? selectedSubrace.languages : selectedRace?.languages || []);

  // Simple inventory summary
  const gp = character?.inv?.gp ?? 0;
  const itemCount = character?.inv?.items ? Object.keys(character.inv.items).length : 0;
  const customization = character?.customization || {};
  const stories = character?.stories || {};
  const additionalTraitTags = toTagArray(customization.additionalTraits);
  const personalityTags = toTagArray(stories.personality);
  const idealTags = toTagArray(stories.ideals);
  const flawTags = toTagArray(stories.flaws);
  const saveLabel = character?._id ? 'Save Changes' : 'Save Character';
  const currentClassChoices = Object.values(character?.classEquipmentChoices || {}).map((choice) => choice?.optionKey).filter(Boolean);
  const currentBackgroundChoices = Object.values(character?.backgroundEquipmentChoices || {}).map((choice) => choice?.optionKey).filter(Boolean);

  const requiredChecklist = [
    { label: 'Name', complete: Boolean(character.name) },
    { label: 'Class', complete: Boolean(character.class) },
    { label: 'Race', complete: Boolean(character.race) },
    { label: 'Background', complete: Boolean(character.background) },
    {
      label: 'Ability Scores',
      complete: Object.keys(LABELS).every((code) => Number.isFinite(parseInt(baseStats[code], 10)))
    }
  ];
  const completeCount = requiredChecklist.filter((item) => item.complete).length;
  const completionPercent = Math.round((completeCount / requiredChecklist.length) * 100);

  const resolveColorValue = (baseKey, customKey) => {
    const baseValue = String(customization?.[baseKey] || '').trim();
    const customValue = String(customization?.[customKey] || '').trim();
    if (!baseValue) return '';
    if (baseValue === 'other' && customValue) return customValue;
    return baseValue;
  };

  const appearanceColors = {
    skin: resolveColorValue('skinColor', 'skinColorCustom'),
    eyes: resolveColorValue('eyeColor', 'eyeColorCustom'),
    hair: resolveColorValue('hairColor', 'hairColorCustom')
  };

  const renderTagGroup = (label, tags) => (
    <div className='space-y-2'>
      <div className='text-website-default-300 text-xs uppercase tracking-wider'>{label}</div>
      <div className='flex flex-wrap gap-2'>
        {tags.length === 0 && (
          <span className='text-website-default-400 text-xs'>None</span>
        )}
        {tags.map((tag) => (
          <span key={`${label}_${tag}`} className='px-2 py-1 bg-website-default-900 border border-website-default-700 rounded text-xs text-white'>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );

  const StatRow = ({ code }) => {
    const base = parseInt(baseStats[code], 10) || 0;
    const mod = parseInt(modifiedStats[code], 10) || 0;
    const delta = mod - base;
    return (
      <div className='flex items-center justify-between p-2 bg-website-default-900/50 border border-website-default-700 rounded'>
        <div className='text-website-default-100 text-sm'>{LABELS[code]}</div>
        <div className='text-sm'>
          <span className='text-website-default-300'>Base:</span> <span className='text-white font-semibold'>{base}</span>
          <span className='mx-2 text-website-default-500'>-&gt;</span>
          <span className='text-website-default-300'>Final:</span> <span className='text-white font-semibold'>{mod}</span>
          {delta !== 0 && (
            <span className={`ml-2 text-xs ${delta > 0 ? 'text-website-highlights-400' : 'text-website-specials-400'}`}>{delta > 0 ? `+${delta}` : `${delta}`}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className='bg-website-default-900 min-h-screen grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr]'>
      <div className='p-4 space-y-4 md:col-start-2'>
        {/* Identity */}
        <Card className='bg-website-default-800 border-website-specials-500'>
          <Card.Header>
            <Card.Title className='text-website-default-100'>Character Summary</Card.Title>
            <Card.Description className='text-website-default-300'>Review your character before saving.</Card.Description>
          </Card.Header>
          <Card.Content className='space-y-6'>
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
              <div>
                <div className='text-website-default-300 text-sm'>Name</div>
                <div className='text-white font-semibold text-lg'>{character.name || '-'}</div>
              </div>
              <div className='text-right'>
                <div className='text-website-default-300 text-sm'>Level</div>
                <div className='text-white font-semibold text-lg'>{character.level ?? 1}</div>
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                <div className='text-website-default-300 text-xs'>Race</div>
                <div className='text-white font-semibold'>{selectedRace?.name || '-'}</div>
                {selectedRace?.description && (
                  <div className='text-website-default-400 text-xs mt-1'>{selectedRace.description}</div>
                )}
              </div>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                <div className='text-website-default-300 text-xs'>Subrace</div>
                <div className='text-white font-semibold'>{selectedSubrace?.name || '-'}</div>
                {selectedSubrace?.description && (
                  <div className='text-website-default-400 text-xs mt-1'>{selectedSubrace.description}</div>
                )}
              </div>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                <div className='text-website-default-300 text-xs'>Class</div>
                <div className='text-white font-semibold'>{selectedClass?.name || '-'}</div>
                {selectedClass?.description && (
                  <div className='text-website-default-400 text-xs mt-1'>{selectedClass.description}</div>
                )}
              </div>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                <div className='text-website-default-300 text-xs'>Subclass</div>
                <div className='text-white font-semibold'>{selectedSubclass?.name || '-'}</div>
                {selectedSubclass?.description && (
                  <div className='text-website-default-400 text-xs mt-1'>{selectedSubclass.description}</div>
                )}
              </div>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded md:col-span-2'>
                <div className='text-website-default-300 text-xs'>Background</div>
                <div className='text-white font-semibold'>{selectedBackground?.name || '-'}</div>
                {selectedBackground?.description && (
                  <div className='text-website-default-400 text-xs mt-1'>{selectedBackground.description}</div>
                )}
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* Completion */}
        <Card className='bg-website-default-800 border-website-specials-500'>
          <Card.Header>
            <Card.Title className='text-website-default-100'>Creation Readiness</Card.Title>
            <Card.Description className='text-website-default-300'>Quick completion check before save.</Card.Description>
          </Card.Header>
          <Card.Content className='space-y-4'>
            <div className='flex items-center justify-between text-sm'>
              <span className='text-website-default-300'>Completion</span>
              <span className='text-white font-semibold'>{completionPercent}%</span>
            </div>
            <div className='h-2 rounded bg-website-default-900 overflow-hidden'>
              <div
                className='h-full bg-website-highlights-500 transition-all duration-300'
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
              {requiredChecklist.map((item) => (
                <div key={item.label} className='flex items-center justify-between rounded border border-website-default-700 bg-website-default-900/50 px-3 py-2 text-xs'>
                  <span className='text-website-default-200'>{item.label}</span>
                  <span className={item.complete ? 'text-website-highlights-400' : 'text-website-specials-400'}>
                    {item.complete ? 'Ready' : 'Missing'}
                  </span>
                </div>
              ))}
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-website-default-300'>
              <div className='rounded border border-website-default-700 bg-website-default-900/50 px-3 py-2'>
                Class Equipment Choices: {currentClassChoices.length > 0 ? currentClassChoices.join(', ') : 'None'}
              </div>
              <div className='rounded border border-website-default-700 bg-website-default-900/50 px-3 py-2'>
                Background Equipment Choices: {currentBackgroundChoices.length > 0 ? currentBackgroundChoices.join(', ') : 'None'}
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* Appearance & Story */}
        <Card className='bg-website-default-800 border-website-specials-500'>
          <Card.Header>
            <Card.Title className='text-website-default-100'>Appearance & Persona</Card.Title>
            <Card.Description className='text-website-default-300'>Color choices and story tags.</Card.Description>
          </Card.Header>
          <Card.Content className='space-y-4'>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                <div className='text-website-default-300 text-xs'>Gender</div>
                <div className='text-white text-sm font-semibold'>{character?.gender || '-'}</div>
              </div>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                <div className='text-website-default-300 text-xs'>Alignment</div>
                <div className='text-white text-sm font-semibold'>{character?.alignment || '-'}</div>
              </div>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                <div className='text-website-default-300 text-xs'>Age</div>
                <div className='text-white text-sm font-semibold'>{character?.age?.years || '-'}</div>
              </div>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                <div className='text-website-default-300 text-xs'>Size</div>
                <div className='text-white text-sm font-semibold'>{toTitleCase(character?.model?.size) || '-'}</div>
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
              {Object.entries(appearanceColors).map(([key, value]) => {
                const isHex = /^#[0-9a-fA-F]{6}$/.test(value || '');
                const label = key.charAt(0).toUpperCase() + key.slice(1);
                return (
                  <div key={key} className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                    <div className='text-website-default-300 text-xs'>{label} Color</div>
                    <div className='mt-1 flex items-center gap-2'>
                      {value && (
                        <span
                          className='inline-block h-3 w-3 rounded-full border border-website-default-500'
                          style={isHex ? { backgroundColor: value } : undefined}
                        />
                      )}
                      <span className='text-white text-sm font-semibold'>
                        {value ? (isHex ? value : toTitleCase(value)) : '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {renderTagGroup('Additional Traits', additionalTraitTags)}
              {renderTagGroup('Personality', personalityTags)}
              {renderTagGroup('Ideals', idealTags)}
              {renderTagGroup('Flaws', flawTags)}
            </div>
          </Card.Content>
        </Card>

        {/* Ability Scores */}
        <Card className='bg-website-default-800 border-website-specials-500'>
          <Card.Header>
            <Card.Title className='text-website-default-100'>Ability Scores</Card.Title>
            <Card.Description className='text-website-default-300'>Base vs final (after class, race, and subrace bonuses).</Card.Description>
          </Card.Header>
          <Card.Content className='grid grid-cols-1 md:grid-cols-2 gap-3'>
            {Object.keys(LABELS).map((code) => (
              <StatRow key={code} code={code} />
            ))}
          </Card.Content>
        </Card>

        {/* Skills & Proficiencies */}
        <Card className='bg-website-default-800 border-website-specials-500'>
          <Card.Header>
            <Card.Title className='text-website-default-100'>Skills & Proficiencies</Card.Title>
            <Card.Description className='text-website-default-300'>Selected and granted proficiencies.</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className='flex flex-wrap gap-2'>
              {Object.keys(proficiencies).length === 0 && (
                <span className='text-website-default-400 text-sm'>None</span>
              )}
              {Object.entries(proficiencies).map(([name, level]) => (
                <span key={name} className='px-2 py-1 bg-website-default-900 border border-website-default-700 rounded text-sm text-white'>
                  {toTitleCase(name)}
                  {typeof level === 'string' ? ` (${level})` : ''}
                </span>
              ))}
            </div>
          </Card.Content>
        </Card>

        {/* Languages */}
        <Card className='bg-website-default-800 border-website-specials-500'>
          <Card.Header>
            <Card.Title className='text-website-default-100'>Languages</Card.Title>
            <Card.Description className='text-website-default-300'>Languages from race/subrace.</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className='flex flex-wrap gap-2'>
              {(languages || []).length === 0 && (
                <span className='text-website-default-400 text-sm'>None</span>
              )}
              {(languages || []).map((lang) => (
                <span key={lang} className='px-2 py-1 bg-website-default-900 border border-website-default-700 rounded text-sm text-white'>
                  {toTitleCase(lang)}
                </span>
              ))}
            </div>
          </Card.Content>
        </Card>

        {/* Inventory & Resources */}
        <Card className='bg-website-default-800 border-website-specials-500'>
          <Card.Header>
            <Card.Title className='text-website-default-100'>Inventory & Resources</Card.Title>
            <Card.Description className='text-website-default-300'>Currency and quick inventory count.</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                <div className='text-website-default-300 text-xs'>Gold</div>
                <div className='text-white font-semibold'>{gp}</div>
              </div>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                <div className='text-website-default-300 text-xs'>Item Count</div>
                <div className='text-white font-semibold'>{itemCount}</div>
              </div>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                <div className='text-website-default-300 text-xs'>Resources</div>
                <div className='text-white text-sm'>
                  HP {character.HP?.current ?? 0}/{character.HP?.max ?? 0} |
                  {' '}STA {character.STA?.current ?? 0}/{character.STA?.max ?? 0} |
                  {' '}MP {character.MP?.current ?? 0}/{character.MP?.max ?? 0}
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* Save */}
        <div className='flex justify-end'>
          {saveError && (
            <div className='mr-4 text-sm text-red-400 self-center'>{saveError}</div>
          )}
          <button
            className='px-4 py-2 bg-website-specials-500 text-white rounded hover:bg-website-specials-600 disabled:opacity-60 disabled:cursor-not-allowed'
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : saveLabel}
          </button>
        </div>
      </div>
      <div></div>
    </div>
  );
}

export default Summary;

