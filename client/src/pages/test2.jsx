import Skeleton from "../pageComponents/skeleton"
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createDefaultCharacter } from '../data/characterDefaults';
import { genderOptions } from "../data/genderOptions";
import { Tabs } from '../pageComponents/tabs'
import { CircleUser, Shuffle, ArrowBigLeftDash, ArrowBigRightDash  } from 'lucide-react';
import { Card } from "../pageComponents/card";

export default function Test2(){
  const ageInputRef = useRef(null);
  const prevBodyOverflow = useRef('');
  const heightInputRef = useRef(null);
  const [isEditingHeight, setIsEditingHeight] = useState(false);
  const [heightDraft, setHeightDraft] = useState('');

  const genderOptionsList = genderOptions;

  const [character, setCharacterState] = useState(() => createDefaultCharacter());

  const setCharacter = (pathOrUpdater, value) => {
    if (typeof pathOrUpdater === 'function') {
      setCharacterState(prev => pathOrUpdater(prev));
      return;
    }
    setCharacterState(prev => {
      const keys = Array.isArray(pathOrUpdater) ? pathOrUpdater : String(pathOrUpdater).split('.');
      const next = { ...prev };
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        cur[k] = typeof cur[k] === 'object' && cur[k] !== null ? { ...cur[k] } : {};
        cur = cur[k];
      }
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const randomizeGender = () => {
    if (!genderOptionsList.length) return;
    const idx = Math.floor(Math.random() * genderOptionsList.length);
    setCharacter('gender', genderOptionsList[idx]);
  };

  const birthYear = useMemo(() => {
    const years = parseInt(character.age.years, 10); 
    const m = parseInt(character.age.month, 10);
    const d = parseInt(character.age.day, 10);
    if (Number.isNaN(years) || Number.isNaN(m) || Number.isNaN(d)) return null;
    const today = new Date();
    let year = today.getFullYear() - years;
    const hasBirthdayPassed =
      (today.getMonth() + 1 > m) || ((today.getMonth() + 1 === m) && (today.getDate() >= d));
    if (!hasBirthdayPassed) year -= 1;
    return year;
  }, [character.age.years, character.age.month, character.age.day]);

  const daysInSelectedMonth = useMemo(() => {
    const m = parseInt(character.age.month, 10);
    if (Number.isNaN(m) || m < 1 || m > 12) return 31;
    const y = birthYear ?? new Date().getFullYear();
    return new Date(y, m, 0).getDate();
  }, [character.age.month, birthYear]);

  // Clamp day when month changes
  useEffect(() => {
    const dim = daysInSelectedMonth;
    const d = parseInt(character.age.day, 10);
    if (!Number.isNaN(d) && d > dim) {
      setCharacter('age.day', String(dim));
    }
  }, [daysInSelectedMonth, character.age.day]);

  // Element-level wheel handler to adjust age and prevent page scroll
  useEffect(() => {
    const el = ageInputRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      const delta = e.deltaY < 0 ? 1 : -1; // scroll up = +1, down = -1
      setCharacter(prev => {
        const currRaw = prev.age.years;
        const curr = (currRaw === undefined || currRaw === '')
          ? 0
          : (typeof currRaw === 'string' ? parseInt(currRaw, 10) : currRaw);
        const safe = Number.isNaN(curr) ? 0 : curr;
        const next = Math.min(120, Math.max(0, safe + delta));
        return { ...prev, age: { ...prev.age, years: next } };
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, []);

  const dobDate = useMemo(() => {
    const y = birthYear;
    const m = parseInt(character.age.month, 10);
    const d = parseInt(character.age.day, 10);
    if (!y || Number.isNaN(m) || Number.isNaN(d)) return null;
    if (d > new Date(y, m, 0).getDate()) return null;
    return new Date(y, m - 1, d);
  }, [birthYear, character.age.month, character.age.day]);

  const dayOfWeek = useMemo(() => {
    if (!dobDate) return '';
    return dobDate.toLocaleDateString(undefined, { weekday: 'long' });
  }, [dobDate]);

  const genderSelectValue = () => {
    if (!character.gender) return '';
    return genderOptionsList.includes(character.gender) ? character.gender : 'Custom';
  }, [character.gender]; 

  const formatHeight = (inches) => {
    const n = parseInt(inches, 10);
    if (Number.isNaN(n) || n <= 0) return 'Set height';
    const ft = Math.floor(n / 12);
    const inch = n % 12;
    return `${ft}'${inch}`;
  };

  const getHeightBounds = (size) => {
    switch (size) {
      case 'tiny': return [12, 24];
      case 'small': return [24, 48];
      case 'medium': return [48, 96];
      case 'large': return [96, 192];
      case 'huge': return [192, 384];
      case 'gargantuan': return [384, 768];
      default: return [0, 768];
    }
  };

  const [minHeightIn, maxHeightIn] = useMemo(() => getHeightBounds(character.model.size), [character.model.size]);

  // When size changes, auto-adjust height to that size's minimum
  useEffect(() => {
    if (!character.model.size) return;
    if (character.model.height !== minHeightIn) {
      setCharacter('model.height', minHeightIn);
    }
  }, [character.model.size, minHeightIn]);

  return (
    <Skeleton>
      <div className="bg-website-default-900 text-center p-4 shadow-lg text-website-default-100 flex flex-row items-center justify-center space-x-8">
        

        
        <Tabs defaultTab={0}>
          <Tabs.Prev className="fixed left-20 top-1/2 -translate-y-1/2 z-50">
            <ArrowBigLeftDash />
          </Tabs.Prev>
          <Tabs.Next max={6} className="fixed right-20 top-1/2 -translate-y-1/2 z-50">
            <ArrowBigRightDash  />
          </Tabs.Next>
          <Tabs.Nav className='flex flex-row justify-center items-center'>
            
            <Tabs.Tab index={0}>
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
              Ability Score
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
                      value={character.name}
                      onChange={(e) => setCharacter('name', e.target.value)}
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
                                  value={character.age.month}
                                  onChange={(e) => setCharacter('age.month', e.target.value)}
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
                                  value={character.age.day}
                                  onChange={(e) => setCharacter('age.day', e.target.value)}
                                  className="rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                                  disabled={!character.age.month}
                                >
                                  <option value="" disabled>{!character.age.month ? 'Select month first' : 'Select day'}</option>
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
                                  value={character.age.years ?? ''}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val)) setCharacter('age.years', val);
                                    else setCharacter('age.years', '');
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
                                value={genderSelectValue}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === 'Custom') setCharacter('gender', '');
                                  else setCharacter('gender', val);
                                }}
                                className="rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                              >
                                <option value="" disabled>Select gender</option>
                                {genderOptionsList.map((g) => (
                                  <option key={g} value={g}>{g}</option>
                                ))}
                                <option value="Custom">Custom</option>
                              </select>
                            </div>
                            {genderSelectValue === 'Custom' && (
                              <div className="flex flex-col">
                                <label className="text-sm text-website-default-300 mb-1">Custom</label>
                                <input
                                  type="text"
                                  value={character.gender}
                                  onChange={(e) => setCharacter('gender', e.target.value)}
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
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className='flex flex-col'>
                              <label className="text-website-default-300 text-sm">Size Scale</label>
                              <select 
                                name="Size" 
                                id="size" 
                                value={character.model.size || ""} 
                                onChange={(e) => setCharacter('model.size', e.target.value)}
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
                                  {isEditingHeight ? (
                                    <input
                                      ref={heightInputRef}
                                      type="number"
                                      name="Height"
                                      id='height'
                                      min={minHeightIn}
                                      max={maxHeightIn}
                                      value={character.model.height === '' ? '' : Number(character.model.height)}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        // Allow only digits or empty during editing
                                        if (/^\d*$/.test(raw)) {
                                          setHeightDraft(raw);
                                        }
                                      }}
                                      onBlur={() => {
                                        let n = parseInt(heightDraft, 10);
                                        if (Number.isNaN(n)) n = minHeightIn;
                                        if (n < minHeightIn) n = minHeightIn;
                                        if (n > maxHeightIn) n = maxHeightIn;
                                        setCharacter('model.height', n);
                                        setIsEditingHeight(false);
                                      }}
                                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                      className='rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400'
                                      placeholder='Height (inches)'
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setHeightDraft(character.model.height === '' ? '' : String(character.model.height));
                                        setIsEditingHeight(true);
                                        setTimeout(() => heightInputRef.current?.focus(), 0);
                                      }}
                                      className='rounded border border-website-specials-500 bg-website-default-800 px-3 py-2 text-website-default-100 hover:bg-website-default-700'
                                      title='Click to edit height'
                                    >
                                      {formatHeight(character.model.height)}
                                    </button>
                                  )}
                                </div>
                              )}                        
                            </div>
                            {["tiny", "gargantuan", "huge"].includes(character.model.size) && (
                              <div className='text-website-default-300 col-span-2'>
                                <span className='font-bold text-website-specials-400'>WARNING!</span> You have selected a size that may make playing very difficult. Are you sure?
                              </div>
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
            <Tabs.Panel index={1} className='bg-website-default-900 min-h-screen grid grid-cols-[1fr_2fr_1fr]'>
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
                      value={character.name}
                      onChange={(e) => setCharacter('name', e.target.value)}
                    />
                  </div>
                </div>
                </div>
            </Tabs.Panel>
            <Tabs.Panel index={2} className='bg-website-default-900 min-h-screen grid grid-cols-[1fr_2fr_1fr]'>
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
                      value={character.name}
                      onChange={(e) => setCharacter('name', e.target.value)}
                    />
                  </div>
                </div>

                </div>
            </Tabs.Panel>
            <Tabs.Panel index={3} className='bg-website-default-900 min-h-screen grid grid-cols-[1fr_2fr_1fr]'>
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
                      value={character.name}
                      onChange={(e) => setCharacter('name', e.target.value)}
                    />
                  </div>
                </div>
                </div>
            </Tabs.Panel>
            <Tabs.Panel index={4} className='bg-website-default-900 min-h-screen grid grid-cols-[1fr_2fr_1fr]'>
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
                      value={character.name}
                      onChange={(e) => setCharacter('name', e.target.value)}
                    />
                  </div>
                </div>
                </div>
            </Tabs.Panel>
            <Tabs.Panel index={5} className='bg-website-default-900 min-h-screen grid grid-cols-[1fr_2fr_1fr]'>
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
                      value={character.name}
                      onChange={(e) => setCharacter('name', e.target.value)}
                    />
                  </div>
                </div>
                </div>
            </Tabs.Panel>
            <Tabs.Panel index={6} className='bg-website-default-900 min-h-screen grid grid-cols-[1fr_2fr_1fr]'>
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
                      value={character.name}
                      onChange={(e) => setCharacter('name', e.target.value)}
                    />
                  </div>
                </div>
                </div>
            </Tabs.Panel>
          </Tabs.Panels>
        </Tabs>
      </div>
    </Skeleton>
  )
}