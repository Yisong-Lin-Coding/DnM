import React, { useMemo, useState, useContext } from 'react';
import { Card } from '../../../pageComponents/card';
import { useGameData } from '../../../data/gameDataContext';
import { CircleUser, Shuffle } from 'lucide-react';

// Stats used for buy/roll methods (exclude Luck from automated systems)
const CORE_STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const LABELS = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
  luck: 'Luck',
};

// Standard 27-point buy cost table for scores 8..15
const POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const MIN_BUY = 8;
const MAX_BUY = 15;
const POINT_POOL = 27;

function calcPointCost(value) {
  if (value < MIN_BUY) return Infinity;
  if (value > MAX_BUY) return Infinity;
  return POINT_BUY_COST[value] ?? Infinity;
}

export function AbilityScores({ values, onChange }) {
  const { maps } = useGameData();
  const { classesById, racesById, subracesById } = maps;
  
  const stats = values?.stats || { str: '', dex: '', con: '', int: '', wis: '', cha: '', luck: '' };
  const method = values?.abilityScoreMethod || 'random';
  const selectedRaceId = values?.race || '';
  const selectedSubraceId = values?.subrace || '';
  const selectedClassId = values?.class || '';

  const emit = (partial) => { if (typeof onChange === 'function') onChange(partial); };

  // Resolve selected objects from context maps - direct lookup by ID
  const selectedRace = useMemo(() => racesById[selectedRaceId] || null, [racesById, selectedRaceId]);
  const selectedSubrace = useMemo(() => subracesById[selectedSubraceId] || null, [subracesById, selectedSubraceId]);
  const selectedClass = useMemo(() => classesById[selectedClassId] || null, [classesById, selectedClassId]);

  // Compute modified stats = base + class + race + subrace modifiers
  const modifiedStats = useMemo(() => {
    const out = { ...stats };
    const raceMods = selectedRace?.abilityScoreModifiers || {};
    const subraceMods = selectedSubrace?.abilityScoreModifiers || {};
    const classMods = selectedClass?.baseStatModifier || {};

    Object.keys(out).forEach((k) => {
      const base = parseInt(out[k], 10) || 0;
      const bonus = (raceMods[k] || 0) + (subraceMods[k] || 0) + (classMods[k] || 0);
      out[k] = base + bonus;
    });
    return out;
  }, [stats, selectedRace, selectedSubrace, selectedClass]);

  // Helpers to update base stats
  const updateStat = (key, val) => {
    const n = val === '' ? '' : Math.max(1, Math.min(30, parseInt(val, 10) || 0));
    emit({ stats: { ...stats, [key]: n } });
  };

  // Weighted random roll: average 8, each step away from 8 halves the chance
  // Distribution extends to 20 with exponentially decreasing probability
  const weightedRoll = () => {
    const distribution = [
      { value: 4, weight: 1 },
      { value: 5, weight: 2 },
      { value: 6, weight: 4 },
      { value: 7, weight: 8 },
      { value: 8, weight: 16 },
      { value: 9, weight: 8 },
      { value: 10, weight: 4 },
      { value: 11, weight: 2 },
      { value: 12, weight: 1 },
      { value: 13, weight: 0.5 },
      { value: 14, weight: 0.25 },
      { value: 15, weight: 0.125 },
      { value: 16, weight: 0.0625 },
      { value: 17, weight: 0.03125 },
      { value: 18, weight: 0.015625 },
      { value: 19, weight: 0.0078125 },
      { value: 20, weight: 0.00390625 }
    ];
    const totalWeight = distribution.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    for (const item of distribution) {
      random -= item.weight;
      if (random <= 0) return item.value;
    }
    return 4; // fallback
  };

  const rollWeightedStats = () => {
    const next = { ...stats };
    CORE_STATS.forEach((s) => {
      next[s] = weightedRoll();
    });
    emit({ stats: next });
  };

  // Method selection
  const setMethod = (m) => {
    // If switching to point-buy and stats are unset, initialize core stats to 8
    if (m === 'pointbuy') {
      const next = { ...stats };
      CORE_STATS.forEach((s) => {
        const v = parseInt(next[s], 10);
        if (!v || v < MIN_BUY || v > MAX_BUY) next[s] = MIN_BUY;
      });
      emit({ abilityScoreMethod: m, stats: next });
      return;
    }
    emit({ abilityScoreMethod: m });
  };

  // Point-buy logic
  const currentPointTotal = useMemo(() => {
    if (method !== 'pointbuy') return POINT_POOL; // Not used
    let spent = 0;
    for (const s of CORE_STATS) {
      const v = parseInt(stats[s], 10) || MIN_BUY;
      const clamped = Math.min(Math.max(v, MIN_BUY), MAX_BUY);
      spent += calcPointCost(clamped);
    }
    return POINT_POOL - spent;
  }, [method, stats]);

  const incStatBuy = (code) => {
    const current = parseInt(stats[code], 10) || MIN_BUY;
    const nextVal = Math.min(current + 1, MAX_BUY);
    if (nextVal === current) return;

    // Check point availability
    const curCost = calcPointCost(Math.min(Math.max(current, MIN_BUY), MAX_BUY));
    const nextCost = calcPointCost(nextVal);
    const delta = nextCost - curCost;
    if (currentPointTotal - delta < 0) return; // Not enough points

    emit({ stats: { ...stats, [code]: nextVal } });
  };

  const decStatBuy = (code) => {
    const current = parseInt(stats[code], 10) || MIN_BUY;
    const nextVal = Math.max(current - 1, MIN_BUY);
    if (nextVal === current) return;
    emit({ stats: { ...stats, [code]: nextVal } });
  };

  const StatPointBuyRow = ({ code }) => {
    const v = parseInt(stats[code], 10) || MIN_BUY;
    const clamped = Math.min(Math.max(v, MIN_BUY), MAX_BUY);
    return (
      <div className='flex items-center justify-between p-2 bg-website-default-900 border border-website-default-700 rounded'>
        <div className='text-website-default-100 text-sm'>{LABELS[code]}</div>
        <div className='flex items-center gap-2'>
          <button
            onClick={() => decStatBuy(code)}
            className='px-2 py-1 text-xs rounded border border-website-default-600 text-website-default-300 hover:border-website-default-400'
          >-</button>
          <div className='w-8 text-center text-white'>{clamped}</div>
          <button
            onClick={() => incStatBuy(code)}
            className='px-2 py-1 text-xs rounded border border-website-specials-600 text-white hover:border-website-specials-400'
          >+</button>
        </div>
      </div>
    );
  };

  const BaseVsModified = () => (
    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
      {CORE_STATS.map((code) => {
        const base = parseInt(stats[code], 10) || 0;
        const mod = parseInt(modifiedStats[code], 10) || 0;
        const delta = mod - base;
        const positive = delta > 0;
        const negative = delta < 0;
        return (
          <div key={code} className='p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
            <div className='flex items-center justify-between'>
              <div className='text-website-default-100 text-sm font-semibold'>{LABELS[code]}</div>
              <div className='text-sm'>
                <span className='text-website-default-300'>Base:</span> <span className='text-white font-semibold'>{base}</span>
                <span className='mx-2 text-website-default-500'>→</span>
                <span className='text-website-default-300'>Modified:</span> <span className='text-white font-semibold'>{mod}</span>
                {delta !== 0 && (
                  <span className={`ml-2 text-xs ${positive ? 'text-website-highlights-400' : 'text-website-specials-400'}`}>
                    {positive ? `+${delta}` : `${delta}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className='bg-website-default-900 min-h-screen grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr]'>
      <div className='p-4 space-y-4  md:col-start-2'>

        <div className='flex flex-row p-4 space-x-4 border-b border-website-specials-500'>
          <CircleUser size={48} />
          <div className='flex flex-col'>
            <div className='text-left text-l font-semibold'>Character Name</div>
            <input 
              type='text'
              placeholder='Name...'
              className='border-b border-website-highlights-400 bg-website-default-900 focus:outline-none focus:bg-gradient-to-t from-website-highlights-500 to-website-default-900'
              value={values.name || ''}
              onChange={(e) => emit({ name: e.target.value })}
            />
          </div>
        </div>

        <Card className='bg-website-default-800 border-website-specials-500'>
          <Card.Header>
            <Card.Title className='text-website-default-100'>Ability Scores</Card.Title>
            <Card.Description className='text-website-default-300'>Choose how to generate your base scores and see final modified totals.</Card.Description>
          </Card.Header>
          <Card.Content className='space-y-6'>
            {/* Method Selector */}
            <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
              <div className='text-website-default-300 text-sm'>Generation Method</div>
              <div className='flex items-center gap-3'>
                <label className='flex items-center gap-1 text-sm text-white'>
                  <input type='radio' name='method' value='random' checked={method === 'random'} onChange={() => setMethod('random')} /> Randomized
                </label>
                <label className='flex items-center gap-1 text-sm text-white'>
                  <input type='radio' name='method' value='pointbuy' checked={method === 'pointbuy'} onChange={() => setMethod('pointbuy')} /> Point Buy
                </label>
              </div>
            </div>

            {/* Randomized */}
            {method === 'random' && (
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='text-website-default-300 text-sm'>Weighted random (average 8), assign to core abilities</div>
                  <button onClick={rollWeightedStats} className='flex items-center gap-2 px-3 py-2 rounded border border-website-highlights-600 text-white hover:border-website-highlights-400'>
                    <Shuffle size={16} /> Roll
                  </button>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  {CORE_STATS.map((s) => (
                    <div key={s} className='flex flex-col'>
                      <label className='text-sm text-website-default-300 mb-1'>{LABELS[s]}</label>
                      <input type='number' min='1' max='30' className='rounded border border-website-specials-500 bg-website-default-900 px-3 py-2 focus:outline-none' value={stats[s] ?? ''} onChange={(e) => updateStat(s, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Point Buy */}
            {method === 'pointbuy' && (
              <div className='space-y-4'>
                <div className='flex items-center justify-between p-3 bg-website-default-900/50 border border-website-default-700 rounded'>
                  <div className='text-website-default-300 text-sm'>Point Pool</div>
                  <div className={`text-sm font-semibold ${currentPointTotal < 0 ? 'text-website-specials-400' : 'text-white'}`}>{currentPointTotal} / {POINT_POOL}</div>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                  {CORE_STATS.map((s) => (
                    <StatPointBuyRow key={s} code={s} />
                  ))}
                </div>
                <div className='text-xs text-website-default-400'>
                  Costs: 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=7, 15=9. Min 8, Max 15.
                </div>
              </div>
            )}

            {/* Base vs Modified */}
            <div className='mt-6'>
              <h4 className='text-website-default-100 font-semibold mb-2'>Base vs Modified</h4>
              <BaseVsModified />
            </div>
          </Card.Content>
        </Card>
      </div>
      <div></div>
    </div>
  );
}

export default AbilityScores;
