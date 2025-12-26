import React from 'react';
import { Card } from '../../../pageComponents/card';

export function Background({ values, onChange }) {
  const BACKGROUNDS = [
    { id: 'bg:acolyte', name: 'Acolyte' },
    { id: 'bg:soldier', name: 'Soldier' },
    { id: 'bg:outlander', name: 'Outlander' },
    { id: 'bg:sage', name: 'Sage' },
  ];

  const selected = values?.background || '';
  const emit = (partial) => { if (typeof onChange === 'function') onChange(partial); };

  return (
    <div className='bg-website-default-900 min-h-screen grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr]'>
      <div></div>
      <div className='p-4 space-y-4'>
        <Card className='bg-website-default-800 border-website-specials-500'>
          <Card.Header>
            <Card.Title className='text-website-default-100'>Background</Card.Title>
            <Card.Description className='text-website-default-300'>Pick a background.</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className='flex flex-col'>
              <label className='text-sm text-website-default-300 mb-1'>Background</label>
              <select
                className='rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400'
                value={selected}
                onChange={(e) => emit({ background: e.target.value })}
              >
                <option value='' disabled>Select background</option>
                {BACKGROUNDS.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
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

export default Background;
