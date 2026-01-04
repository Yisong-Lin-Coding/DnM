import React from 'react';
import { Card } from '../../../pageComponents/card';
import { useContext, useEffect, useState, useMemo } from "react";
import { CircleUser, Shuffle } from 'lucide-react';
import { SocketContext } from "../../../socket.io/context";

export function Class({ values, onChange }) {
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
          console.log(response.data);
        }
      }
    );
  }, [socket]);

  const selected = values?.class || '';
  const emit = (partial) => { if (typeof onChange === 'function') onChange(partial); };

  // Memoize the selected class to avoid multiple find() calls
  const selectedClass = useMemo(() => {
    return classes.find(c => c.classID === selected);
  }, [classes, selected]);

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

        <div className='space-y-8 flex flex-col text-left'>
          <div>
            <h1 className="text-2xl font-semibold mb-4">Base Class</h1>

            <div className="grid grid-cols-1 gap-6">
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
                      {classes.map(c => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>

                    {selectedClass && (
                      <div className='mt-4 p-4 border border-website-specials-500 rounded bg-website-default-800'>
                        <div className='text-website-default-300'>
                          {selectedClass.description || 'No description available.'}
                        </div>
                      </div>
                    )}
                  </div>
                </Card.Content>
              </Card>

              {selectedClass && (
                <Card className='bg-website-default-800 border-website-specials-500'>
                  <Card.Header>
                    <Card.Title className='text-website-default-100'>Class modifiers</Card.Title>
                    <Card.Description className='text-website-default-300'>Modifiers applied by selecting this class.</Card.Description>
                  </Card.Header>
                  <Card.Content>
                    <div className='grid grid-cols-1 gap-8 text-left text-website-default-200 '>
                      <div className="border-website-specials-500 border p-4 rounded">
                        <span className='text-website-default-100'>Modifier:</span> 
                        {
                          <ul className='list-disc list-inside'>
                            {Object.entries(selectedClass.baseStatModifier).map(([stat, value]) => (
                              <li key={stat} className="text-website-default-300">
                                <strong>{stat}:</strong> {value}
                              </li>
                            ))}
                            
                            {Object.entries(selectedClass.resourcePoolModifier).map(([stat, value]) => (
                              <li key={stat} className="text-website-default-300">
                                <strong>{stat}:</strong> {value}
                              </li>
                              
                            ))}
                            
                          </ul>
                        }
                        </div>

                      </div>

                  </Card.Content>
                </Card>
              )}

              {selectedClass && (
                <Card className='bg-website-default-800 border-website-specials-500'>
                  <Card.Header>
                    <Card.Title className='text-website-default-100'>Class Proficiencies</Card.Title>
                    <Card.Description className='text-website-default-300'>Proficiencies granted by this class.</Card.Description>
                  </Card.Header>
                  <Card.Content>
                    <div className='text-website-default-300'>
                      {selectedClass.baseProficiencies && selectedClass.baseProficiencies.length > 0 ? (
                        <ul className='list-disc list-inside'>
                          {selectedClass.baseProficiencies.map((prof) => (
                            <li key={prof}>{prof}</li>
                          ))}
                        </ul>
                      ) : (
                        <div>No proficiencies available.</div>
                      )}
                    </div>
                  </Card.Content>
                  </Card>
                  )}

                  {selectedClass && (
                    <Card className='bg-website-default-800 border-website-specials-500'>
                      <Card.Header>
                        <Card.Title className='text-website-default-100'>Class Proficiencies</Card.Title>
                        <Card.Description className='text-website-default-300'>Proficiencies granted by this class.</Card.Description>
                      </Card.Header>
                      <Card.Content>
                        <div className='text-website-default-300'>
                          {selectedClass.baseProficiencies && selectedClass.baseProficiencies.length > 0 ? (
                            <ul className='list-disc list-inside'>
                              {selectedClass.baseProficiencies.map((prof) => (
                                <li key={prof}>{prof}</li>
                              ))}
                            </ul>
                          ) : (
                            <div>No proficiencies available.</div>
                          )}
                        </div>
                      </Card.Content>
                    </Card>
                  )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Class;