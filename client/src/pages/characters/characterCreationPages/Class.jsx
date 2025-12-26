import React from 'react';
import { Card } from '../../../pageComponents/card';

export function Class({ values, onChange }) {
  const CLASSES = [
    { id: 'fighter', name: 'Fighter' },
    { id: 'wizard', name: 'Wizard' },
    { id: 'rogue', name: 'Rogue' },
    { id: 'cleric', name: 'Cleric' },
  ];

  const selected = values?.class || '';
  const emit = (partial) => { if (typeof onChange === 'function') onChange(partial); };

  return (
    <div className='bg-website-default-900 min-h-screen grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr]'>
      <div></div>
      <div className='p-4 space-y-4'>
        <Card className='bg-website-default-800 border-website-specials-500'>
          <Card.Header>
            <Card.Title className='text-website-default-100'>Class</Card.Title>
            <Card.Description className='text-website-default-300'>Choose your base class.</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className='flex flex-col'>
              <label className='text-sm text-website-default-300 mb-1'>Class</label>
              <select
                className='rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400'
                value={selected}
                onChange={(e) => emit({ class: e.target.value })}
              >
                <option value='' disabled>Select class</option>
                {CLASSES.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </Card.Content>
        </Card>
      </div>
      <div></div>
    </div>
  );
}

export default Class;
