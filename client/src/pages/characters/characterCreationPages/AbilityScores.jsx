import React from 'react';
import { Card } from '../../../pageComponents/card';
import { CircleUser, Shuffle } from 'lucide-react';

export function AbilityScores({ values, onChange }) {
  const stats = values?.stats || { str: '', dex: '', con: '', int: '', wis: '', cha: '', luck: '' };
  const emit = (partial) => { if (typeof onChange === 'function') onChange(partial); };

  const updateStat = (key, val) => {
    const n = val === '' ? '' : Math.max(1, Math.min(30, parseInt(val, 10) || 0));
    emit({ stats: { ...stats, [key]: n } });
  };

  const StatInput = ({ code, label }) => (
    <div className='flex flex-col'>
      <label className='text-sm text-website-default-300 mb-1'>{label}</label>
      <input
        type='number'
        min='1'
        max='30'
        className='rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400'
        value={stats[code] ?? ''}
        onChange={(e) => updateStat(code, e.target.value)}
      />
    </div>
  );

  return (
    <div className='bg-website-default-900 min-h-screen grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr]'>
      <div className='p-4 space-y-4  md:col-start-2'>

        <div className='flex flex-row p-4 space-x-4 border-b border-website-specials-500'>
          <CircleUser size={48} />
          <div className='flex flex-col'>
            <div className='text-left text-l font-semibold'>Character Name</div>
            <input 
              type="text"
              placeholder='Name...'
              className='border-b border-website-highlights-400 bg-website-default-900 focus:outline-none focus:bg-gradient-to-t from-website-highlights-500 to-website-default-900' 
              value={values.name || ''}
              onChange={(e) => emit({ name: e.target.value })}
            />
          </div>
        </div>


        <Card className='bg-website-default-800 border-website-specials-500'>
          <Card.Header>
            <Card.Title className='text-website-default-100'>Ability Scores</Card.Title>
            <Card.Description className='text-website-default-300'>Set your base ability scores.</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
              <StatInput code='str' label='Strength' />
              <StatInput code='dex' label='Dexterity' />
              <StatInput code='con' label='Constitution' />
              <StatInput code='int' label='Intelligence' />
              <StatInput code='wis' label='Wisdom' />
              <StatInput code='cha' label='Charisma' />
              <StatInput code='luck' label='Luck' />
            </div>
          </Card.Content>
        </Card>
      </div>
      <div></div>
    </div>
  );
}

export default AbilityScores;
