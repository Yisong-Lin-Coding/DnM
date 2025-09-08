import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Form, Link } from 'react-router-dom'
import { Tabs } from './tabs'
import { CircleUser, Shuffle } from 'lucide-react';
import { Card } from "./card"

export default function CC_Header(){

  const [ageYears, setAgeYears] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const ageInputRef = useRef(null);
  const prevBodyOverflow = useRef('');
  const [gender, setGender] = useState('');
  const [customGender, setCustomGender] = useState('');
  const genderOptions = useMemo(() => ([
    'Male',
    'Female',
    'Non-binary',
    'Agender',
    'Genderfluid',
    'Femboy',
    'Filipino',
    'Stickman',
    "Fruit tart",
    'Fucked up Rubik cube',
    'Prefer not to say'
  ]), []);
  const randomizeGender = () => {
    if (!genderOptions.length) return;
    const idx = Math.floor(Math.random() * genderOptions.length);
    setGender(genderOptions[idx]);
    setCustomGender('');
    updateCharacter('gender', genderOptions[idx]);
  };

  const [character, setCharacter] = useState({
    name: '',
    age: { years: '', month: '', day: '' , weekday: ''},
    gender:'',
    model: {size:'', height:'', weight:''},
    alignment: '',
    skinColor: '',  
    eyeColor: '',
    hairColor: '',
    race: '',
    class: '',
    background: '',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    equipment: [],
    spells: [],
    level: 1
  });

  const updateCharacter = (field, value) => {
    setCharacter(prev => ({ ...prev, [field]: value }));
  };

  
  const birthYear = useMemo(() => {
    const years = parseInt(ageYears, 10); 
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (Number.isNaN(years) || Number.isNaN(m) || Number.isNaN(d)) return null;
    const today = new Date();
    let year = today.getFullYear() - years;
    const hasBirthdayPassed =
      (today.getMonth() + 1 > m) || ((today.getMonth() + 1 === m) && (today.getDate() >= d));
    if (!hasBirthdayPassed) year -= 1;
    return year;
  }, [ageYears, month, day]);

  const daysInSelectedMonth = useMemo(() => {
    const m = parseInt(month, 10);
    if (Number.isNaN(m) || m < 1 || m > 12) return 31;
    const y = birthYear ?? new Date().getFullYear();
    return new Date(y, m, 0).getDate();
  }, [month, birthYear]);

  useEffect(() => {
    const dim = daysInSelectedMonth;
    const d = parseInt(day, 10);
    if (!Number.isNaN(d) && d > dim) {
      setDay(String(dim));
    }
  }, [daysInSelectedMonth]);

  // Element-level wheel handler to adjust age and prevent page scroll
  useEffect(() => {
    const el = ageInputRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      const delta = e.deltaY < 0 ? 1 : -1; // scroll up = +1, down = -1
      setAgeYears((prev) => {
        const curr = (prev === undefined || prev === '')
          ? 0
          : (typeof prev === 'string' ? parseInt(prev, 10) : prev);
        const safe = Number.isNaN(curr) ? 0 : curr;
        const next = safe + delta;
        return Math.min(120, Math.max(0, next));
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, []);

  const dobDate = useMemo(() => {
    const y = birthYear;
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (!y || Number.isNaN(m) || Number.isNaN(d)) return null;
    if (d > new Date(y, m, 0).getDate()) return null;
    return new Date(y, m - 1, d);
  }, [birthYear, month, day]);

  const dayOfWeek = useMemo(() => {
    if (!dobDate) return '';
    return dobDate.toLocaleDateString(undefined, { weekday: 'long' });
  }, [dobDate]);

  
    return(
       <div className="bg-website-default-900 text-center p-4 shadow-lg text-website-default-100 flex flex-row items-center justify-center space-x-8">
        
        <Tabs defaultTab={0}>
           <Tabs.Nav className='flex flex-row justify-center items-center'>
            <div className='p-r p-4'>Charcter Name</div>
            <Tabs.Tab index={0} >
              Customization
            </Tabs.Tab>
            <Tabs.Tab index={1}>
              Class
            </Tabs.Tab>
            <Tabs.Tab index={2}>
              Background
            </Tabs.Tab>
            <Tabs.Tab index={3}>
              Race
            </Tabs.Tab>
            <Tabs.Tab index={4}>
              Ablity Score
            </Tabs.Tab>
            <Tabs.Tab index={5}>
              Equipment
            </Tabs.Tab>
            <Tabs.Tab index={6}>
              Summary
            </Tabs.Tab>
          </Tabs.Nav>

          <Tabs.Panels>
            <Tabs.Panel index={0} className='bg-website-default-900 min-h-screen grid grid-cols-[1fr_2fr_1fr]'>
              <div></div>
              <div className='p-4 border-b border-website-specials-500 space-y-4'>
              <div className='flex flex-row p-4 space-x-4 border-b border-website-specials-500'>
                <CircleUser size={48} />
                <div className='flex flex-col'>
                  <div className='text-left text-l font-semibold'>Character Name</div>
                  <input 
                  type="text"
                  placeholder='Name...'
                  className='border-b border-website-highlights-400 bg-website-default-900 focus:outline-none focus:bg-gradient-to-t from-website-highlights-500 to-website-default-900' 
                  onChange={(e) => updateCharacter('name', e.target.value)}
                  />
                </div>
              </div>
              <div className='space-y-8 text-left'>
                <div>
                  <h1 className="text-2xl font-semibold mb-4">Basic Information </h1>
                  <div className="grid grid-cols-1 gap-6">

                  <Card className='bg-website-default-800 border-website-specials-500'>
                    <Card.Header className=''>
                      <Card.Title className='text-website-default-100'>
                        Age
                      </Card.Title>
                      <Card.Description className='text-website-default-300'>
                        How old is your character?
                      </Card.Description>
                    </Card.Header>
                    <Card.Content>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex flex-col">
                            <label className="text-sm text-website-default-300 mb-1">Month</label>
                            <select
                              value={month}
                              onChange={(e) => {
                                setMonth(e.target.value)
                                updateCharacter('age', { ...character.age, month: e.target.value });
                              }}
                              className="rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                            >
                              <option value="" disabled>Select month</option>
                              <option value="1">January</option>
                              <option value="2">February</option>
                              <option value="3">March</option>
                              <option value="4">April</option>
                              <option value="5">May</option>
                              <option value="6">June</option>
                              <option value="7">July</option>
                              <option value="8">August</option>
                              <option value="9">September</option>
                              <option value="10">October</option>
                              <option value="11">November</option>
                              <option value="12">December</option>
                            </select>
                          </div>
                          <div className="flex flex-col">
                            <label className="text-sm text-website-default-300 mb-1">Day</label>
                            <select
                              value={day}
                              onChange={(e) => {
                                setDay(e.target.value)
                                updateCharacter('age', { ...character.age, day: e.target.value });
                              }}
                              className="rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                              disabled={!month}
                            >
                              <option value="" disabled>{!month ? 'Select month first' : 'Select day'}</option>
                              {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col">
                            <label className="text-sm text-website-default-300 mb-1">Age</label>
                            <input
                              ref={ageInputRef}
                              type="number"
                              min="0"
                              max="120"
                              step="1"
                              value={ageYears ?? ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val)) {
                                  setAgeYears(val)
                                  updateCharacter('age', { ...character.age, years: val });
                                  }
                                else setAgeYears(undefined); 
                              }}
                              onMouseEnter={() => {
                                prevBodyOverflow.current = document.body.style.overflow;
                                document.body.style.overflow = 'hidden';
                              }}
                              onMouseLeave={() => {
                                document.body.style.overflow = prevBodyOverflow.current || '';
                              }}
                              className="rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400 overscroll-contain"
                              placeholder="Years"
                            />
                          </div>
                        </div>

                        {dobDate && (
                          <div className="text-sm text-website-default-300">
                            <div className="mt-2">
                              <span className="text-website-default-100">Born on: </span>
                              <span>{dayOfWeek}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card.Content>
                    </Card>   

                   <Card className='bg-website-default-800 border-website-specials-500'>
                    <Card.Header className=''>
                      <Card.Title className='text-website-default-100'>
                        Gender
                      </Card.Title>
                      <Card.Description className='text-website-default-300'>
                        What does your character identify as?
                      </Card.Description>
                    </Card.Header>
                    <Card.Content>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="flex flex-col">
                          <label className="text-sm text-website-default-300 mb-1">Gender</label>
                          <select
                            value={gender === 'Custom' ? 'Custom' : (gender || '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGender(val);
                              updateCharacter('gender',e.target.value);
                              if (val !== 'Custom') setCustomGender('');
                            }}
                            className="rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                          >
                            <option value="" disabled>Select gender</option>
                            {genderOptions.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                            <option value="Custom">Custom</option>
                          </select>
                        </div>
                        {gender === 'Custom' && (
                          <div className="flex flex-col">
                            <label className="text-sm text-website-default-300 mb-1">Custom</label>
                            <input
                              type="text"
                              value={customGender}
                              onChange={(e) => {
                                setCustomGender(e.target.value)
                                updateCharacter('gender',e.target.value);
                              }}
                              className="rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                              placeholder="Enter custom gender"
                            />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={randomizeGender}
                            className="inline-flex items-center justify-center rounded border border-website-specials-500 bg-website-default-800 px-3 py-2 hover:bg-website-highlights-500/10 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                            title="Randomize gender"
                          >
                            <Shuffle className="w-4 h-4 mr-2" />
                            Randomize
                          </button>
                        </div>
                      </div>
                    </Card.Content>
                  </Card>
                  
                  <Card className='bg-website-default-800 border-website-specials-500'>
                    <Card.Header>
                      <Card.Title className='text-website-default-100'>
                        Size
                        </Card.Title>
                      <Card.Description className='text-website-default-300'>
                        How big/small is your character?
                      </Card.Description>
                    </Card.Header>
                    <Card.Content>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className='flex flex-col'>
                          <label className="text-website-default-300 text-sm">Size Scale</label>
                        <select 
                        name="Size" 
                        id="size" 
                        onChange={(e) => updateCharacter('model', { ...character.model, size: e.target.value })
                                  }
                        className='rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400'>
                          <option value="" disabled>Select size</option>
                          <option value="tiny">Tiny (1ft-2ft)</option>
                          <option value="small">Small (2ft-4ft)</option>
                          <option value="medium">Medium (4ft-8ft)</option>
                          <option value="large">Large (8ft-16ft)</option>
                          <option value="huge">Huge (16ft-32ft)</option>
                          <option value="gargantuan">Gargantuan (32ft-64ft)</option>
                        </select>
                        </div>
                        <div className='flex flex-row'>
                          {character.model.size && (
                            <div>
                              <input
                                type="number"
                                name="Height"
                                id='height'
                                onChange={(e) => updateCharacter('model', { ...character.model, height: e.target.value })}
                                onMouseEnter={() => {
                                prevBodyOverflow.current = document.body.style.overflow;
                                document.body.style.overflow = 'hidden';
                              }}
                              onMouseLeave={() => {
                                document.body.style.overflow = prevBodyOverflow.current || '';
                              }}
                              />
                            </div>
                          )}                        
                        </div>
                        {["tiny", "gargantuan", "huge"].includes(character.model.size) && (
                            <div className='text-website-default-300 col-span-2'>
                              <span className='font-bold text-website-specials-400'>WARNING!</span> You have selected a size that may make playing very difficult. Are you sure?</div>
                          )}
                      </div>
                    </Card.Content>
                  </Card>


                  <div>Size</div>
                  <div>Weight</div>
                  <div>Alignment</div>
                  </div>
                <div>
                  <h1>Additional Customization</h1>
                  <div>Skin Color</div>
                  <div>Eye Color</div>
                  <div>Hair Color</div>
                  <div>Addtional Traits</div>
                </div>
                <div>
                  <h1>Long Story Short</h1>
                  <div>Personality traits</div>
                  <div>Ideals</div>
                  <div>Flaws</div>
                  <div>Relationships</div>
                </div>
                </div>
              </div>
              </div>
              <div></div>
            </Tabs.Panel>
            <Tabs.Panel index={1} className='bg-website-default-900 min-h-screen grid grid-cols-[1fr_3fr_1fr]'>
              <div className=''>
                <select name="Class" id="Class">
                  <option value="barb">Barb</option>
                </select>
              </div>
            </Tabs.Panel>
            <Tabs.Panel index={2} className='bg-website-default-900 min-h-screen grid grid-cols-[1fr_3fr_1fr]'>

            </Tabs.Panel>
            <Tabs.Panel index={3} className='bg-website-default-900 min-h-screen grid grid-cols-[1fr_3fr_1fr]'>

            </Tabs.Panel>
            <Tabs.Panel index={4} className='bg-website-default-900 min-h-screen grid grid-cols-[1fr_3fr_1fr]'>

            </Tabs.Panel>
            <Tabs.Panel index={5} className='bg-website-default-900 min-h-screen grid grid-cols-[1fr_3fr_1fr]'>

            </Tabs.Panel>
            <Tabs.Panel index={6} className='bg-website-default-900 min-h-screen grid grid-cols-[1fr_3fr_1fr]'>

            </Tabs.Panel>
          </Tabs.Panels>
        </Tabs>

        </div>
    )


}