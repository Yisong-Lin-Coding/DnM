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
    return classes.find(c => c._id === selected);
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
                <Card className='bg-website-default-800 border-website-specials-500 border'>
  <Card.Header className="border-b border-website-default-700 pb-4">
    <Card.Title className='text-website-default-100 flex items-center gap-2'>
      <span className="text-website-specials-500">◈</span> Class Modifiers
    </Card.Title>
    <Card.Description className='text-website-default-300 italic'>
      Innate bonuses and resource scaling for the {selectedClass.name} class.
    </Card.Description>
  </Card.Header>
  
  <Card.Content className="pt-6">
    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
      
      {/* Stat Increases Section */}
      <div className="bg-website-default-900/50 border border-website-default-700 p-4 rounded-lg">
        <h4 className="text-website-specials-400 font-fantasy uppercase text-xs tracking-widest mb-3 border-b border-website-default-700 pb-1">
          Stat Increases
        </h4>
        <ul className='space-y-2'>
          {Object.entries(selectedClass.baseStatModifier).map(([stat, value]) => (
            <li key={stat} className="flex justify-between items-center text-website-default-200">
              <span className="font-bold text-website-default-100">{stat}</span>
              <span className="text-website-specials-500 font-mono">+{value}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Resource Multipliers Section */}
      <div className="bg-website-default-900/50 border border-website-default-700 p-4 rounded-lg">
        <h4 className="text-website-highlights-400 font-fantasy uppercase text-xs tracking-widest mb-3 border-b border-website-default-700 pb-1">
          Resource Multipliers
        </h4>
        <ul className='space-y-2'>
          {Object.entries(selectedClass.resourcePoolModifier).map(([res, value]) => (
            <li key={res} className="flex justify-between items-center text-website-default-200">
              <span className="font-bold text-website-default-100">{res}</span>
              <span className="text-website-highlights-500 font-mono">x{value.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  </Card.Content>
</Card>
              )}

              {selectedClass && (
                <Card className='bg-website-default-800 border-website-specials-500' defaultOpen={true}>
  <Card.Header className="border-b border-website-default-700/50">
    <Card.Title className='text-website-default-100 flex items-center gap-2'>
      <span className="text-website-specials-500">⚔</span> Class Proficiencies
    </Card.Title>
    <Card.Description className='text-website-default-300'>
      Proficiencies granted by the {selectedClass?.name ?? 'selected'} class.
    </Card.Description>
  </Card.Header>

  <Card.Content>
    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
      
      {/* 1. Base Proficiencies Breakdown */}
      {selectedClass?.baseProficiencies ? (
        Object.entries(selectedClass.baseProficiencies).map(([category, items]) => (
          Array.isArray(items) && items.length > 0 && (
            <div key={category} className="bg-website-default-900/50 border border-website-default-700 p-3 rounded-lg shadow-inner">
              <h4 className="text-website-highlights-400 font-fantasy uppercase text-[10px] tracking-widest mb-2 border-b border-website-default-700/30 pb-1">
                {category.replace(/([A-Z])/g, ' $1')}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => (
                  <span 
                    key={item} 
                    className="px-2 py-0.5 bg-website-default-800 text-website-default-200 text-[10px] rounded border border-website-default-600 capitalize"
                  >
                    {item.replace(/([A-Z])/g, ' $1')}
                  </span>
                ))}
              </div>
            </div>
          )
        ))
      ) : (
        <div className="text-website-default-400 text-xs italic p-2">Loading proficiency data...</div>
      )}

      {/* 2. Skill Selection Choices */}
      {selectedClass?.choices?.proficiencies?.skills && (
        <div className="bg-website-default-900/50 border border-website-specials-900/40 p-3 rounded-lg md:col-span-2">
          <div className="flex justify-between items-end mb-2 border-b border-website-default-700/30 pb-1">
            <h4 className="text-website-specials-400 font-fantasy uppercase text-[10px] tracking-widest">
              Skill Selections
            </h4>
            <span className="text-website-default-400 text-[9px] uppercase font-bold bg-website-default-700 px-1.5 py-0.5 rounded">
              Pick {selectedClass.choices.proficiencies.skills.amount}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
            {selectedClass.choices.proficiencies.skills.options?.map((skill) => (
              <span 
                key={skill} 
                className="text-[11px] text-website-default-300 flex items-center gap-1 hover:text-website-specials-300 transition-colors"
              >
                <span className="text-website-specials-500/50">•</span>
                {skill.replace(/([A-Z])/g, ' $1')}
              </span>
            ))}
          </div>
        </div>
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