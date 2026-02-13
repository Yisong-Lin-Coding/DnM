import React, { useMemo } from 'react';
import { Card } from '../../../pageComponents/card';
import { CircleUser } from 'lucide-react';

const LABELS = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

export function Summary({ values, onChange, onSave, classes = [], subclasses = [], races = [], subraces = [], backgrounds = [] }) {
  const character = values || {};
  const emit = (partial) => { if (typeof onChange === 'function') onChange(partial); };

  const selectedClass = useMemo(() => classes.find((c) => c._id === character.class), [classes, character.class]);
  const selectedSubclass = useMemo(() => subclasses.find((sc) => sc._id === character.subclass), [subclasses, character.subclass]);
  const selectedRace = useMemo(() => races.find((r) => r._id === character.race), [races, character.race]);
  const selectedSubrace = useMemo(() => subraces.find((sr) => sr._id === character.subrace), [subraces, character.subrace]);
  const selectedBackground = useMemo(() => backgrounds.find((b) => b._id === character.background), [backgrounds, character.background]);

  // Compute modified stats
  const baseStats = character.stats || {};
  const modifiedStats = useMemo(() => {
    const raceMods = selectedRace?.abilityScoreModifiers || {};
    const subraceMods = selectedSubrace?.abilityScoreModifiers || {};
    const classMods = selectedClass?.baseStatModifier || {};
    const out = {};
    Object.keys(LABELS).forEach((k) => {
      const base = parseInt(baseStats[k], 10) || 0;
      const bonus = (raceMods[k] || 0) + (subraceMods[k] || 0) + (classMods[k] || 0);
      out[k] = base + bonus;
    });
    return out;
  }, [baseStats, selectedRace, selectedSubrace, selectedClass]);

  // Proficiencies and languages
  const proficiencies = character?.skills?.proficiencies || {};
  const languages = selectedSubrace?.languages?.length ? selectedSubrace.languages : selectedRace?.languages || [];

  // Simple inventory summary
  const gp = character?.inv?.gp ?? 0;
  const itemCount = character?.inv?.items ? Object.keys(character.inv.items).length : 0;

  const SectionHeader = ({ title, description }) => (
    <div className='mb-3'>
      <h3 className='text-website-default-100 text-lg font-semibold'>{title}</h3>
      {description && <div className='text-website-default-300 text-sm'>{description}</div>}
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
          <span className='mx-2 text-website-default-500'>→</span>
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
                <div className='text-white font-semibold text-lg'>{character.name || '—'}</div>
              </div>
              <div className='text-right'>
                <div className='text-website-default-300 text-sm'>Level</div>
                <div className='text-white font-semibold text-lg'>{character.level ?? 1}</div>
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                <div className='text-website-default-300 text-xs'>Race</div>
                <div className='text-white font-semibold'>{selectedRace?.name || '—'}</div>
                {selectedRace?.description && (
                  <div className='text-website-default-400 text-xs mt-1'>{selectedRace.description}</div>
                )}
              </div>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                <div className='text-website-default-300 text-xs'>Subrace</div>
                <div className='text-white font-semibold'>{selectedSubrace?.name || '—'}</div>
                {selectedSubrace?.description && (
                  <div className='text-website-default-400 text-xs mt-1'>{selectedSubrace.description}</div>
                )}
              </div>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                <div className='text-website-default-300 text-xs'>Class</div>
                <div className='text-white font-semibold'>{selectedClass?.name || '—'}</div>
                {selectedClass?.description && (
                  <div className='text-website-default-400 text-xs mt-1'>{selectedClass.description}</div>
                )}
              </div>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                <div className='text-website-default-300 text-xs'>Subclass</div>
                <div className='text-white font-semibold'>{selectedSubclass?.name || '—'}</div>
                {selectedSubclass?.description && (
                  <div className='text-website-default-400 text-xs mt-1'>{selectedSubclass.description}</div>
                )}
              </div>
              <div className='p-3 bg-website-default-900/50 border border-website-default-700 rounded md:col-span-2'>
                <div className='text-website-default-300 text-xs'>Background</div>
                <div className='text-white font-semibold'>{selectedBackground?.name || '—'}</div>
                {selectedBackground?.description && (
                  <div className='text-website-default-400 text-xs mt-1'>{selectedBackground.description}</div>
                )}
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* Ability Scores */}
        <Card className='bg-website-default-800 border-website-specials-500'>
          <Card.Header>
            <Card.Title className='text-website-default-100'>Ability Scores</Card.Title>
            <Card.Description className='text-website-default-300'>Base vs final (after class/race/subrace modifiers).</Card.Description>
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
                  {name} 
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
                  {lang}
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
                  HP {character.HP?.current ?? 0}/{character.HP?.max ?? 0} ·
                  {' '}STA {character.STA?.current ?? 0}/{character.STA?.max ?? 0} ·
                  {' '}MP {character.MP?.current ?? 0}/{character.MP?.max ?? 0}
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* Save */}
        <div className='flex justify-end'>
          <button
            className='px-4 py-2 bg-website-specials-500 text-white rounded hover:bg-website-specials-600'
            onClick={onSave}
          >
            Save Character
          </button>
        </div>
      </div>
      <div></div>
    </div>
  );
}

export default Summary;
