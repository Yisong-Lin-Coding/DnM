import React from 'react';
import { Card } from '../../../pageComponents/card';
import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../../../socket.io/context";
// Minimal, controlled Race selection component
// Props:
// - values: the parent-held character draft object
// - onChange: function(partial) to merge updates into the parent draft
export function Race({ values, onChange }) {



  const socket = useContext(SocketContext);
  const [classes, setClasses] = useState([]);

useEffect(() => {
  socket.emit(
    'database_query',
    {
      collection: 'classes',
      operation: 'findAll',
    },
    (response) => {
      if (response.success) {
        setClasses(response.data);
      }
    }
  );
}, []);

  const selectedRace = values?.race || '';
  const emit = (partial) => {
    if (typeof onChange === 'function') onChange(partial);
  };

  return (
    <div className='bg-website-default-900 min-h-screen grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr]'>
      <div></div>
      <div className='p-4 space-y-4'>
        <Card className='bg-website-default-800 border-website-specials-500'>
          <Card.Header>
            <Card.Title className='text-website-default-100'>Race</Card.Title>
            <Card.Description className='text-website-default-300'>
              Choose your character's race.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div className='grid grid-cols-1 gap-4 items-end'>
              <div className='flex flex-col'>
                <label className='text-sm text-website-default-300 mb-1'>Race</label>
                <select
                  className='rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400'
                  value={selectedRace}
                  onChange={(e) => emit({ race: e.target.value })}
                >
                  <option value='' disabled>Select race</option>
                  {RACES.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card.Content>
        </Card>

        {selectedRace && (
          <Card className='bg-website-default-800 border-website-specials-500'>
            <Card.Header>
              <Card.Title className='text-website-default-100'>Race details</Card.Title>
              <Card.Description className='text-website-default-300'>
                Placeholder for traits, subrace, and languages.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <div className='text-website-default-300'>
                Selected: {RACES.find(r => r.id === selectedRace)?.name}
              </div>
            </Card.Content>
          </Card>
        )}
      </div>
      <div></div>
    </div>
  );
}

export default Race;
