import React from 'react';
import { Card } from '../../../pageComponents/card';
import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../../../socket.io/context";
import { CircleUser, Shuffle } from 'lucide-react';

export function Background({ values, onChange }) {




    const socket = useContext(SocketContext);
    const [background, setBackground] = useState([]);
  
  useEffect(() => {
    socket.emit(
      'database_query',
      {
        collection: 'backgrounds',
        operation: 'findAll',
      },
      (response) => {
        if (response.success) {
          setBackground(response.data);
        }
      }
    );
  }, []);
  

  const selected = values?.background || '';
  const emit = (partial) => { if (typeof onChange === 'function') onChange(partial); };

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
                {background.map(b => (
                  <option key={b._id} value={b._id}>{b.name}</option>
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
