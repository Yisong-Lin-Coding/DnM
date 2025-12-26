import React from 'react';
import { Card } from '../../../pageComponents/card';

// Summary tab with Equipment merged here (barebones preview)
export function Summary({ values, onChange, onSave }) {
  const character = values || {};
  const emit = (partial) => { if (typeof onChange === 'function') onChange(partial); };

  return (
    <div className='bg-website-default-900 min-h-screen grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr]'>
      <div></div>
      <div className='p-4 space-y-4'>
        <Card className='bg-website-default-800 border-website-specials-500'>
          <Card.Header>
            <Card.Title className='text-website-default-100'>Summary</Card.Title>
            <Card.Description className='text-website-default-300'>
              Review your selections before saving.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div className='grid grid-cols-1 gap-2 text-left text-website-default-200'>
              <div><span className='text-website-default-400'>Name:</span> {character.name || '—'}</div>
              <div><span className='text-website-default-400'>Race:</span> {character.race || '—'}</div>
              <div><span className='text-website-default-400'>Class:</span> {character.class || '—'}</div>
              <div><span className='text-website-default-400'>Background:</span> {character.background || '—'}</div>
              <div><span className='text-website-default-400'>STR/DEX/CON/INT/WIS/CHA/LUCK:</span> {['str','dex','con','int','wis','cha','luck'].map(k => character.stats?.[k] ?? '—').join(' / ')}</div>
            </div>
          </Card.Content>
        </Card>

        <Card className='bg-website-default-800 border-website-specials-500'>
          <Card.Header>
            <Card.Title className='text-website-default-100'>Equipment (merged)</Card.Title>
            <Card.Description className='text-website-default-300'>
              Minimal equipment preview; extend as needed.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div className='text-left text-website-default-300'>
              GP: {character.inv?.gp ?? 0}
            </div>
          </Card.Content>
        </Card>

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
