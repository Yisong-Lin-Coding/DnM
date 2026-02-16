import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createDefaultCharacter } from '../../../data/characterDefaults';
import {genderOptions}  from "../../../data/genderOptions";
import { CircleUser, Shuffle } from 'lucide-react';
import { Card } from "../../../pageComponents/card";

const DEFAULT_TAGS = {
  additionalTraits: ['scarred', 'tattooed', 'pierced', 'freckled', 'mysterious aura'],
  personality: ['brave', 'curious', 'loyal', 'sarcastic', 'patient', 'stubborn'],
  ideals: ['justice', 'freedom', 'knowledge', 'honor', 'balance', 'compassion'],
  flaws: ['greedy', 'impulsive', 'arrogant', 'secretive', 'vengeful', 'reckless']
};

const COLOR_OPTIONS = {
  hair: ['black', 'brown', 'blonde', 'red', 'gray', 'white'],
  skin: ['light', 'tan', 'brown', 'dark', 'olive'],
  eye: ['brown', 'blue', 'green', 'gray', 'hazel']
};

const toTagArray = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))];
  }
  if (typeof value === 'string') {
    return [...new Set(
      value
        .split(/[\n,]/g)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )];
  }
  return [];
};

// Controlled + Uncontrolled component:
// - If `values` and `onChange` props are provided, this component is controlled by parent.
// - Otherwise it manages its own local state for backward compatibility.
export function Customization({ values, onChange }){
  const ageInputRef = useRef(null);
  const prevBodyOverflow = useRef('');
  const [editingHeight,setIsEditingHeight] = useState(false);
  const [editingWeight,setIsEditingWeight] = useState(false);
  const [customGender, setCustomGender] = useState(false);

  const [xAlign, setXAlign] = useState(1); // 0=Lawful, 1=Neutral, 2=Chaotic
  const [yAlign, setYAlign] = useState(1); // 0=Good, 1=Neutral, 2=Evil

  const labelsX = ["Lawful", "Neutral", "Chaotic"];
  const labelsY = ["Good", "Neutral", "Evil"];

  const inputRef = useRef(null);
  const genderOptionsList = genderOptions;

  // Local state fallback if component is used uncontrolled
  const [localCharacter, setLocalCharacter] = useState(() => createDefaultCharacter());
  const character = values || localCharacter;

  const [relationships, setRelationships] = useState({"":{"name":"","relationship":"","description":""}}); // start with one input
  const [tagInputs, setTagInputs] = useState({
    additionalTraits: '',
    personality: '',
    ideals: '',
    flaws: ''
  });

  const additionalTraitTags = useMemo(
    () => toTagArray(character.customization?.additionalTraits),
    [character.customization?.additionalTraits]
  );
  const personalityTags = useMemo(
    () => toTagArray(character.stories?.personality),
    [character.stories?.personality]
  );
  const idealTags = useMemo(
    () => toTagArray(character.stories?.ideals),
    [character.stories?.ideals]
  );
  const flawTags = useMemo(
    () => toTagArray(character.stories?.flaws),
    [character.stories?.flaws]
  );

  const removeRelationship = (id) =>{
    setRelationships(prev=>{
      const updated = { ...prev };
      delete updated[id];
      relationshipFormatting(updated);
      return updated;
    });
  }

  const addRelationship = () =>{
    const id = Date.now().toString();
    setRelationships(prev=>({
      ...prev,
      [id]:{}
    }))
  }

  const changeRelationships = (id, field, value) => {
    setRelationships(prev => {
      const updated = {
        ...prev,
        [id]: {
          ...prev[id],
          [field]: value
        }
      };

      relationshipFormatting(updated);
      return updated;
    });
  };

  // Deep merge helper used in uncontrolled fallback
  const deepMerge = (target, source) => {
    if (typeof source !== 'object' || source === null) return target;
    const out = Array.isArray(target) ? [...target] : { ...target };
    for (const [k, v] of Object.entries(source)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = deepMerge(out[k] || {}, v);
      } else {
        out[k] = v;
      }
    }
    return out;
  };

  const emitPartial = (partial) => {
    if (typeof onChange === 'function') {
      onChange(partial);
    } else {
      // uncontrolled: merge into local state
      setLocalCharacter(prev => deepMerge(prev, partial));
    }
  };

  const relationshipFormatting = (relationshipsObj) => {
    const formatted = Object.entries(relationshipsObj).reduce((acc, [id, data]) => {
      const { name, ...rest } = data;
      if (name && name.length) acc[name] = rest;
      return acc;
    }, {});
    emitPartial({ stories: { ...(character.stories||{}), relationships: formatted } });
  };

  // setCharacter: supports dot-path updates and functional updates
  const setCharacter = (pathOrUpdater, value) => {
    if (typeof pathOrUpdater === 'function') {
      const next = pathOrUpdater(character);
      emitPartial(next);
      return;
    }
    const keys = Array.isArray(pathOrUpdater) ? pathOrUpdater : String(pathOrUpdater).split('.');
    const partial = {};
    let cur = partial;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      cur[k] = {};
      cur = cur[k];
    }
    cur[keys[keys.length - 1]] = value;
    emitPartial(partial);
  };

  const updateTagInput = (key, value) => {
    setTagInputs((prev) => ({ ...prev, [key]: value }));
  };

  const setCustomization = (updates) => {
    emitPartial({
      customization: {
        ...(character.customization || {}),
        ...updates
      }
    });
  };

  const addTag = (key, currentTags, setTags) => {
    const incoming = String(tagInputs[key] || '').trim();
    if (!incoming) return;

    const alreadyExists = currentTags.some(
      (tag) => String(tag).toLowerCase() === incoming.toLowerCase()
    );
    if (alreadyExists) {
      updateTagInput(key, '');
      return;
    }

    setTags([...currentTags, incoming]);
    updateTagInput(key, '');
  };

  const addSuggestedTag = (tag, currentTags, setTags) => {
    if (!tag) return;
    const alreadyExists = currentTags.some(
      (entry) => String(entry).toLowerCase() === String(tag).toLowerCase()
    );
    if (alreadyExists) return;
    setTags([...currentTags, String(tag)]);
  };

  const removeTag = (tag, currentTags, setTags) => {
    const filtered = currentTags.filter((entry) => entry !== tag);
    setTags(filtered);
  };

  const getColorSelectionValue = (field, options) => {
    const selected = String(character.customization?.[field] || '');
    if (!selected) return '';
    if (options.includes(selected)) return selected;
    return 'other';
  };

  const getCustomColorValue = (field, customField) => {
    const customValue = String(character.customization?.[customField] || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(customValue)) return customValue;

    const legacyValue = String(character.customization?.[field] || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(legacyValue)) return legacyValue;

    return '#808080';
  };

  const updateColorSelection = (field, customField, nextValue) => {
    if (nextValue === 'other') {
      const fallbackCustom = getCustomColorValue(field, customField);
      setCustomization({
        [field]: 'other',
        [customField]: fallbackCustom
      });
      return;
    }

    setCustomization({
      [field]: nextValue,
      [customField]: ''
    });
  };

  const renderTagEditor = ({
    inputKey,
    tags,
    suggestions,
    setTags,
    placeholder
  }) => (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(suggestions || []).map((tag) => {
          const selected = tags.some((entry) => String(entry).toLowerCase() === tag.toLowerCase());
          return (
            <button
              key={tag}
              type="button"
              onClick={() => addSuggestedTag(tag, tags, setTags)}
              className={`px-2 py-1 rounded text-xs border transition-colors ${
                selected
                  ? 'bg-website-specials-900/40 border-website-specials-500 text-white'
                  : 'bg-website-default-900 border-website-default-700 text-website-default-300 hover:border-website-default-500'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 min-h-10 rounded border border-website-default-700 bg-website-default-900 px-2 py-2">
        {tags.length === 0 && (
          <span className="text-xs text-website-default-400">No tags added yet.</span>
        )}
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-2 rounded border border-website-specials-500 bg-website-specials-900/30 px-2 py-1 text-xs text-white"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag, tags, setTags)}
              className="text-website-default-300 hover:text-website-default-100"
              aria-label={`Remove ${tag}`}
            >
              x
            </button>
          </span>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={tagInputs[inputKey] || ''}
          onChange={(e) => updateTagInput(inputKey, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag(inputKey, tags, setTags);
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
        />
        <button
          type="button"
          onClick={() => addTag(inputKey, tags, setTags)}
          className="rounded border border-website-specials-500 bg-website-specials-900/40 px-3 py-2 text-sm text-white hover:bg-website-specials-900/60"
        >
          Add Tag
        </button>
      </div>
    </div>
  );

  const randomizeGender = () => {
    if (!genderOptionsList.length) return;
    const idx = Math.floor(Math.random() * genderOptionsList.length);
    setCharacter('gender', genderOptionsList[idx]);
  };

  const birthYear = useMemo(() => {
    const years = parseInt(character.age?.years, 10); 
    const m = parseInt(character.age?.month, 10);
    const d = parseInt(character.age?.day, 10);
    if (Number.isNaN(years) || Number.isNaN(m) || Number.isNaN(d)) return null;
    const today = new Date();
    let year = today.getFullYear() - years;
    const hasBirthdayPassed =
      (today.getMonth() + 1 > m) || ((today.getMonth() + 1 === m) && (today.getDate() >= d));
    if (!hasBirthdayPassed) year -= 1;
    return year;
  }, [character.age?.years, character.age?.month, character.age?.day]);

  const daysInSelectedMonth = useMemo(() => {
    const m = parseInt(character.age?.month, 10);
    if (Number.isNaN(m) || m < 1 || m > 12) return 31;
    const y = birthYear ?? new Date().getFullYear();
    return new Date(y, m, 0).getDate();
  }, [character.age?.month, birthYear]);

  const BMI = ()=>{
    const heightInches = parseInt(character.model?.height, 10);
    const weightLbs = parseInt(character.model?.weight, 10);
    if (Number.isNaN(heightInches) || Number.isNaN(weightLbs) || heightInches <= 0) return 0;
    return (weightLbs / (heightInches * heightInches)) * 703;
  }

  // Clamp day when month changes
  useEffect(() => {
    const dim = daysInSelectedMonth;
    const d = parseInt(character.age?.day, 10);
    if (!Number.isNaN(d) && d > dim) {
      setCharacter('age.day', String(dim));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysInSelectedMonth, character.age?.day]);

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
        const currRaw = (prev?.age?.years);
        const curr = (currRaw === undefined || currRaw === '')
          ? 0
          : (typeof currRaw === 'string' ? parseInt(currRaw, 10) : currRaw);
        const safe = Number.isNaN(curr) ? 0 : curr;
        const next = Math.min(120, Math.max(0, safe + delta));
        return { age: { ...(prev?.age||{}), years: next } };
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener('wheel', onWheel, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editingHeight && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingHeight]);

  const dobDate = useMemo(() => {
    const y = birthYear;
    const m = parseInt(character.age?.month, 10);
    const d = parseInt(character.age?.day, 10);
    if (!y || Number.isNaN(m) || Number.isNaN(d)) return null;
    if (d > new Date(y, m, 0).getDate()) return null;
    return new Date(y, m - 1, d);
  }, [birthYear, character.age?.month, character.age?.day]);

  const dayOfWeek = useMemo(() => {
    if (!dobDate) return '';
    return dobDate.toLocaleDateString(undefined, { weekday: 'long' });
  }, [dobDate]);

  const genderSelectValue = useMemo(() => {
    if (!character.gender) return '';
    return genderOptionsList.includes(character.gender) ? character.gender : 'Custom';
  }, [character.gender, genderOptionsList])

  const formatHeight = (inches) => {
    const n = parseInt(inches, 10);
    if (Number.isNaN(n) || n <= 0) return 'Set height';
    const ft = Math.floor(n / 12);
    const inch = n % 12;
    const cm = Math.round(n * 2.54);
    return `${ft} ${ft === 1 ? "foot" : "feet"}${inch > 0 ? ` ${inch} ${inch === 1 ? "inch" : "inches"}` : ''} (${cm}cm)`;
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

  const [minHeightIn, maxHeightIn] = useMemo(() => getHeightBounds(character.model?.size), [character.model?.size]);

  return(
    <div className='bg-website-default-900 min-h-screen grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr]'>
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
              value={character.name || ''}
              onChange={(e) => setCharacter('name', e.target.value)}
            />
          </div>
        </div>

        <div className='space-y-8 flex flex-col text-left'>
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
                          value={character.age?.month || ''}
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
                          value={character.age?.day || ''}
                          onChange={(e) => setCharacter('age.day', e.target.value)}
                          className="rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                          disabled={!character.age?.month}
                        >
                          <option value="" disabled>{!character.age?.month ? 'Select month first' : 'Select day'}</option>
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
                          value={character.age?.years ?? ''}
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
                          if (val === 'Custom'){
                            setCustomGender(true)
                            setCharacter('gender', '')
                          }
                          else{
                            setCharacter('gender', val)
                            setCustomGender(false);
                          }
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
                    {customGender === true && (
                      <div className="flex flex-col">
                        <label className="text-sm text-website-default-300 mb-1">Custom</label>
                        <input
                          type="text"
                          value={character.gender || ''}
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
                        value={character.model?.size || ""} 
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
                      {character.model?.size && (
                        <div className='flex flex-col'>
                          <label className="text-website-default-300 text-sm">Height</label>
                          <div>
                            {editingHeight ? (
                              <div className="flex flex-row space-x-2 items-center">
                                <input
                                  className="rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                                  type="number"
                                  ref={inputRef}
                                  value={editingHeight ? character.model?.height : formatHeight(character.model?.height)}
                                  placeholder={formatHeight(character.model?.height)}
                                  min={minHeightIn}
                                  max={maxHeightIn}
                                  onClick={() => {
                                    setIsEditingHeight(true);
                                  }}
                                  onChange={(e) => {
                                    setCharacter('model.height', e.target.value);
                                  }}
                                  onBlur={(e)=>{
                                    let val = Number(e.target.value);
                                    if (val < minHeightIn) { val = minHeightIn }
                                    else if (val > maxHeightIn) { val = maxHeightIn }
                                    setIsEditingHeight(false);
                                    setCharacter('model.height', val);
                                  }}
                                />
                                <label className="text-website-default-300 text-s">In Inches</label>
                              </div>
                            ) : (
                              <div
                                className="rounded border border-website-specials-500 w-full bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                                onClick={() => setIsEditingHeight(true)}
                              >
                                {formatHeight(character.model?.height)}
                              </div>
                            )}
                          </div>
                        </div>
                      )}                        
                    </div>
                    <div>
                      {editingWeight ? (
                        <div className='flex flex-col'>
                          <label className="text-website-default-300 text-sm">Weight</label>
                          <input
                            className="rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                            type="number"
                            value={character.model?.weight || ''}
                            placeholder="Weight in lbs"
                            onChange={(e) => setCharacter('model.weight', e.target.value)}
                            onBlur={() => setIsEditingWeight(false)}
                          />
                        </div>
                      ) :(
                        <div className='flex flex-col'>
                          <label className="text-website-default-300 text-sm">Weight</label>
                          <div
                            className="rounded border border-website-specials-500 w-full bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                            onClick={() => setIsEditingWeight(true)}
                          >
                            {character.model?.weight ? `${character.model?.weight} lbs` : 'Set weight'}
                          </div>
                        </div>
                      )}
                    </div>
                    {["tiny", "gargantuan", "huge"].includes(character.model?.size) && (
                      <div className='text-website-default-300 col-span-2'>
                        <span className='font-bold text-website-specials-400'>WARNING!</span> You have selected a size that may make playing very difficult. Are you sure?
                      </div>
                    )}
                    {(BMI() < 10 || BMI() > 50) && (
                      <div className='text-website-default-300 col-span-2'>
                        <span className='font-bold text-website-specials-400'>WARNING!</span> Your character has an unusual BMI of {BMI().toFixed(1)}. This may impact gameplay.
                      </div>
                    )}
                  </div>
                </Card.Content>
              </Card>

              <Card className='bg-website-default-800 border-website-specials-500'>
                <Card.Header>
                  <Card.Title className='text-website-default-100'>
                    Alignment
                  </Card.Title>
                  <Card.Description className='text-website-default-300'>
                    What is your character's moral and ethical perspective?
                  </Card.Description>
                </Card.Header>
                <Card.Content>
                  <div className="flex flex-col items-center justify-center relative w-full gap-8">
                    <div className="flex flex-col items-center w-full">
                      <label className="text-website-default-300 text-sm mb-1">Lawful {'<--->'} Chaotic</label>
                      <input 
                        type="range"
                        min={0}
                        max={2}
                        className="w-full"
                        value={xAlign}
                        title={labelsX[xAlign]}
                        onChange={(e) => {
                          setXAlign(Number(e.target.value))
                          setCharacter("alignment",`${labelsX[Number(e.target.value)]} ${labelsY[yAlign]}`)
                        }}
                      /> 
                    </div>

                    <div className="flex flex-col items-center w-full">
                      <label className="text-website-default-300 text-sm mb-1">Good {'<--->'} Evil</label>
                      <input 
                        type="range"
                        min={0}
                        max={2}
                        className="w-full"
                        value={yAlign}
                        title={labelsY[yAlign]}
                        onChange={(e) => {
                          setYAlign(Number(e.target.value))
                          setCharacter("alignment",`${labelsX[xAlign]} ${labelsY[Number(e.target.value)]}`)
                        }}
                      /> 
                    </div>

                    <div className="relative aspect-square w-full grid grid-cols-3 grid-rows-3 border border-website-default-500">
                      {/* Alignment labels */}
                      {labelsY.map((y) =>
                        labelsX.map((x) => (
                          <div
                            key={`${x}-${y}`}
                            className="flex items-center justify-center text-xs text-website-default-300 border border-website-default-700"
                          >
                            {x} {y}
                          </div>
                        ))
                      )}

                      {/* Marker showing intersection */}
                      <div
                        className="absolute w-4 h-4 bg-website-specials-200 rounded-full shadow-lg transition-all duration-200"
                        style={{
                          left: `calc((${xAlign} * 2 + 1) / 6 * 100%)`,
                          top:`calc((${yAlign} * 2 + 1) / 6 * 100%)`,
                          transform: "translate(-50%, -50%)"
                        }}
                      ></div>
                    </div>
                  </div>
                </Card.Content>
              </Card>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-semibold mb-4">Additional Customization</h1>
            <div className="grid grid-cols-1 gap-6">
              <Card className='bg-website-default-800 border-website-specials-500'>
                <Card.Header className=''>
                  <Card.Title className='text-website-default-100'>
                    Character Appearance
                  </Card.Title>
                  <Card.Description className='text-website-default-300'>
                    What does your character look like?
                  </Card.Description>
                </Card.Header>
                <Card.Content>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col">
                      <label className="text-sm text-website-default-300 mb-1">Hair Color</label>
                      <select className="rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                        value={getColorSelectionValue('hairColor', COLOR_OPTIONS.hair)}
                        onChange={(e) => updateColorSelection('hairColor', 'hairColorCustom', e.target.value)}
                      >
                        <option value="" disabled>Select hair color</option>
                        {COLOR_OPTIONS.hair.map((option) => (
                          <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
                        ))}
                        <option value="other">Other (pick color)</option>
                      </select>
                      {getColorSelectionValue('hairColor', COLOR_OPTIONS.hair) === 'other' && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="color"
                            value={getCustomColorValue('hairColor', 'hairColorCustom')}
                            onChange={(e) => setCustomization({ hairColor: 'other', hairColorCustom: e.target.value })}
                            className="h-9 w-14 rounded border border-website-specials-500 bg-transparent p-1"
                          />
                          <span className="text-xs text-website-default-300">{getCustomColorValue('hairColor', 'hairColorCustom')}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <label className="text-sm text-website-default-300 mb-1">Skin Color</label>
                      <select className="rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                        value={getColorSelectionValue('skinColor', COLOR_OPTIONS.skin)}
                        onChange={(e) => updateColorSelection('skinColor', 'skinColorCustom', e.target.value)}
                      >
                        <option value="" disabled>Select skin color</option>
                        {COLOR_OPTIONS.skin.map((option) => (
                          <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
                        ))}
                        <option value="other">Other (pick color)</option>
                      </select>
                      {getColorSelectionValue('skinColor', COLOR_OPTIONS.skin) === 'other' && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="color"
                            value={getCustomColorValue('skinColor', 'skinColorCustom')}
                            onChange={(e) => setCustomization({ skinColor: 'other', skinColorCustom: e.target.value })}
                            className="h-9 w-14 rounded border border-website-specials-500 bg-transparent p-1"
                          />
                          <span className="text-xs text-website-default-300">{getCustomColorValue('skinColor', 'skinColorCustom')}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-website-default-300 mb-1">Eye Color</label>
                      <select className="rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                        value={getColorSelectionValue('eyeColor', COLOR_OPTIONS.eye)}
                        onChange={(e) => updateColorSelection('eyeColor', 'eyeColorCustom', e.target.value)}
                      >
                        <option value="" disabled>Select eye color</option>
                        {COLOR_OPTIONS.eye.map((option) => (
                          <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
                        ))}
                        <option value="other">Other (pick color)</option>
                      </select>
                      {getColorSelectionValue('eyeColor', COLOR_OPTIONS.eye) === 'other' && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="color"
                            value={getCustomColorValue('eyeColor', 'eyeColorCustom')}
                            onChange={(e) => setCustomization({ eyeColor: 'other', eyeColorCustom: e.target.value })}
                            className="h-9 w-14 rounded border border-website-specials-500 bg-transparent p-1"
                          />
                          <span className="text-xs text-website-default-300">{getCustomColorValue('eyeColor', 'eyeColorCustom')}</span>
                        </div>
                      )}
                    </div>

                  </div>
                </Card.Content>
              </Card>

              <Card className='bg-website-default-800 border-website-specials-500'>
                <Card.Header className=''>
                  <Card.Title className='text-website-default-100'>
                    Additional Traits
                  </Card.Title>
                  <Card.Description className='text-website-default-300'>
                    Add selectable or custom trait tags.
                  </Card.Description>
                </Card.Header>
                <Card.Content>
                  {renderTagEditor({
                    inputKey: 'additionalTraits',
                    tags: additionalTraitTags,
                    suggestions: DEFAULT_TAGS.additionalTraits,
                    setTags: (tags) => setCharacter('customization.additionalTraits', tags),
                    placeholder: 'Add a custom trait tag...'
                  })}
                </Card.Content>
              </Card>

            </div>
          </div>

          <div>
            <h1 className="text-2xl font-semibold mb-4">Long Story Short</h1>
            <div className="grid grid-cols-1 gap-6">

              <Card className='bg-website-default-800 border-website-specials-500'>
                <Card.Header className=''>
                  <Card.Title className='text-website-default-100'>
                    Personality Traits
                  </Card.Title>
                  <Card.Description className='text-website-default-300'>
                    Default and custom personality tags in one editable bar.
                  </Card.Description>
                </Card.Header>
                <Card.Content>
                  {renderTagEditor({
                    inputKey: 'personality',
                    tags: personalityTags,
                    suggestions: DEFAULT_TAGS.personality,
                    setTags: (tags) => setCharacter('stories.personality', tags),
                    placeholder: 'Add a custom personality tag...'
                  })}
                </Card.Content>
              </Card>

              <Card className='bg-website-default-800 border-website-specials-500'>
                <Card.Header className=''>
                  <Card.Title className='text-website-default-100'>
                    Ideals
                  </Card.Title>
                  <Card.Description className='text-website-default-300'>
                    Add ideals as tags so they work like personality traits.
                  </Card.Description>
                </Card.Header>
                <Card.Content>
                  {renderTagEditor({
                    inputKey: 'ideals',
                    tags: idealTags,
                    suggestions: DEFAULT_TAGS.ideals,
                    setTags: (tags) => setCharacter('stories.ideals', tags),
                    placeholder: 'Add a custom ideal tag...'
                  })}
                </Card.Content>
              </Card>

              <Card className='bg-website-default-800 border-website-specials-500'>
                <Card.Header className=''>
                  <Card.Title className='text-website-default-100'>
                    Flaws
                  </Card.Title>
                  <Card.Description className='text-website-default-300'>
                    Add flaws as tags so they work like personality traits.
                  </Card.Description>
                </Card.Header>
                <Card.Content>
                  {renderTagEditor({
                    inputKey: 'flaws',
                    tags: flawTags,
                    suggestions: DEFAULT_TAGS.flaws,
                    setTags: (tags) => setCharacter('stories.flaws', tags),
                    placeholder: 'Add a custom flaw tag...'
                  })}
                </Card.Content>
              </Card>

              <Card className='bg-website-default-800 border-website-specials-500'>
                <Card.Header className=''>
                  <Card.Title className='text-website-default-100'>
                    Relationships
                  </Card.Title>
                  <Card.Description className='text-website-default-300'>
                    Describe your character's relationships.
                  </Card.Description>
                </Card.Header>
                <Card.Content>
                  <div className="space-y-2 w-full flex flex-col justify-center">
                    {Object.entries(relationships).map(([key, value],id) => (
                      <div className="grid grid-cols-[1fr_auto] gap-4 pb-4" key={key}>
                        <div key={id} className="grid grid-rows-[auto_1fr] grid-cols-1 md:grid-cols-2 items-center gap-x-4">
                          <div className="flex flex-col">
                            <label className="text-sm text-website-default-300 mb-1">Relationship Name</label>
                            <input
                              className="flex-1 px-3 py-2 border border-website-specials-500 rounded bg-website-default-900 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                              value={value.name || ''}
                              onChange={(e)=>{
                                changeRelationships(key, 'name', e.target.value)
                              }}
                              placeholder="Bob..."
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="text-sm text-website-default-300 mb-1">Relationship Type</label>
                            <input 
                              className="w-full flex-1 px-3 py-2 border border-website-specials-500 rounded bg-website-default-900 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                              value={value.relationship || ''}
                              placeholder="Friend, Sibling, Rival..."
                              onChange={(e)=>{
                                changeRelationships(key, 'relationship', e.target.value)
                              }}
                            />
                          </div>
                          <div className="flex flex-col col-span-1 md:col-span-2 h-full">
                            <label className="text-sm text-website-default-300 mb-1">Description</label>
                            <textarea 
                              className="flex-1 px-3 py-2 h-full border border-website-specials-500 rounded bg-website-default-900 focus:outline-none focus:ring-2 focus:ring-website-highlights-400"
                              value={value.description || ''}
                              placeholder="He works at the local tavern as a bartender..."
                              onChange={(e)=>{
                                changeRelationships(key, 'description', e.target.value)
                              }}
                            />
                          </div>
                        </div>
                        { Object.keys(relationships).length > 1 &&( 
                          <button
                            onClick={()=>{
                              removeRelationship(key)
                            }}
                            className="mt-8 px-2 py-1 text-white bg-website-default-500 rounded hover:bg-website-specials-500 transition"
                          >
                            X
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      className="mt-8 px-2 py-1 text-white bg-website-specials-500 rounded hover:bg-website-specials-700 transition"
                      onClick={()=>{
                        addRelationship()
                      }}
                    >
                      Add Relationship
                    </button>  
                  </div>
                </Card.Content>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <div></div>
    </div>
  )
}
