import Skeleton from "../../pageComponents/skeleton"
import React, { useContext, useState, useEffect } from 'react';
import { createDefaultCharacter } from '../../data/characterDefaults';
import { GameDataProvider } from '../../data/gameDataContext';
import { Tabs } from '../../pageComponents/tabs'
import { ArrowBigLeftDash, ArrowBigRightDash  } from 'lucide-react';
import { SocketContext } from "../../socket.io/context";
import { Customization } from "../characters/characterCreationPages/Customization"
import { Race } from "../characters/characterCreationPages/Race"
import { Class } from "../characters/characterCreationPages/Class"
import { Background } from "../characters/characterCreationPages/Background"
import { AbilityScores } from "../characters/characterCreationPages/AbilityScores"
import { Summary } from "../characters/characterCreationPages/Summary"
import {
  getChoiceBonus,
  getModifierValue,
  parseAbilityScoreChoiceConfig,
  sanitizeChoiceMap
} from "./utils/abilityScoreModifiers"

export default function Test2(){
  const socket = useContext(SocketContext)

  // Single source of truth for the entire character draft
  const [characterDraft, setCharacterDraft] = useState(() => createDefaultCharacter());

  // Load all game data on component mount
  const [gameData, setGameData] = useState({
    classes: [],
    subclasses: [],
    races: [],
    subraces: [],
    backgrounds: [],
    items: []
  });

  useEffect(() => {
    if (!socket) return;

    const collections = ['classes', 'subclasses', 'races', 'subraces', 'backgrounds', 'items'];
    const results = {};
    let completedCount = 0;

    console.log('Starting data load...');

    collections.forEach(collection => {
      socket.emit(
        'database_query',
        {
          collection: collection,
          operation: 'findAll',
        },
        (response) => {
          const success = !!response?.success;
          console.log(`Loaded ${collection}:`, success ? `${response.data.length} items` : response?.message);

          if (success) {
            results[collection] = response.data || [];
          } else {
            results[collection] = [];
            console.error(`Failed to load ${collection}:`, response?.message);
          }

          completedCount += 1;
          console.log(`Progress: ${completedCount}/${collections.length}`);

          // Update state when all collections complete (success or failure)
          if (completedCount === collections.length) {
            console.log('All data requests completed, updating state');
            setGameData({
              classes: results.classes || [],
              subclasses: results.subclasses || [],
              races: results.races || [],
              subraces: results.subraces || [],
              backgrounds: results.backgrounds || [],
              items: results.items || []
            });
          }
        }
      );
    });
  }, [socket]);

  // Deep-merge helper to apply partial patches from child pages
const deepMerge = (t, s) => {
    if (!s || typeof s !== 'object') return t;
    const out = Array.isArray(t) ? [...t] : { ...t };
    for (const [k, v] of Object.entries(s)) {
      // Special case: completely replace proficiencies object
      if (k === 'proficiencies') {
        out[k] = v;
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = deepMerge(out[k] || {}, v);
      } else {
        out[k] = v;
      }
    }
    return out;
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const getPathValue = (obj, path) => path.reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);

const hasPath = (obj, path) => {
  let current = obj;
  for (const key of path) {
    if (!hasOwn(current, key)) return false;
    current = current[key];
  }
  return true;
};

const setPathValue = (obj, path, value) => {
  if (!path.length) return;
  let current = obj;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[path[path.length - 1]] = value;
};

const REPLACE_PATHS = [
  ['skills'],
  ['abilityScoreChoices'],
  ['proficiencyChoices'],
  ['classEquipmentChoices'],
  ['classAnyItemSelections'],
  ['backgroundEquipmentChoices'],
  ['backgroundAnyItemSelections'],
  ['inv', 'items'],
  ['inv', 'equipment']
];

  // Update function passed to children to merge partial updates
const updateDraft = React.useCallback((partial) => {
    setCharacterDraft(prev => {
      const updated = deepMerge(prev, partial);
      REPLACE_PATHS.forEach((path) => {
        if (!hasPath(partial, path)) return;
        setPathValue(updated, path, getPathValue(partial, path));
      });
      return updated;
    });
}, []);

  // Dot-path setter for use inside this parent
  const playerID = localStorage.getItem("player_ID")

  // Compute final stats, features, and resources before saving
  const characterCreation = () => {
    const getById = (arr, id) => (arr || []).find(x => x && x._id === id);

    const level = parseInt(characterDraft.level, 10) || 1;
    const cls = getById(gameData.classes, characterDraft.class);
    const race = getById(gameData.races, characterDraft.race);
    const subrace = getById(gameData.subraces, characterDraft.subrace);

    const baseStats = characterDraft.stats || {};
    const classMods = (cls && cls.baseStatModifier) || {};
    const raceMods = (race && race.abilityScoreModifiers) || {};
    const subraceMods = (subrace && subrace.abilityScoreModifiers) || {};
    const raceChoiceConfig = parseAbilityScoreChoiceConfig(race);
    const subraceChoiceConfig = parseAbilityScoreChoiceConfig(subrace);
    const raceChoiceMap = sanitizeChoiceMap(characterDraft?.abilityScoreChoices?.race, raceChoiceConfig);
    const subraceChoiceMap = sanitizeChoiceMap(characterDraft?.abilityScoreChoices?.subrace, subraceChoiceConfig);

    // Calculate final stats (Luck excluded from pipeline, but kept if present)
    const STAT_KEYS = ['str','dex','con','int','wis','cha'];
    const finalStats = {};
    const baseStatsWithChoice = {};
    for (const k of STAT_KEYS) {
      const base = parseInt(baseStats[k], 10) || 0;
      const choiceBonus = getChoiceBonus(raceChoiceMap, k) + getChoiceBonus(subraceChoiceMap, k);
      baseStatsWithChoice[k] = base + choiceBonus;
      finalStats[k] =
        baseStatsWithChoice[k] +
        getModifierValue(classMods, k) +
        getModifierValue(raceMods, k) +
        getModifierValue(subraceMods, k);
    }
    // Preserve any additional stats (e.g., luck) as-is
    Object.keys(baseStats || {}).forEach(k => {
      if (!STAT_KEYS.includes(k)) {
        const parsed = parseInt(baseStats[k], 10) || 0;
        finalStats[k] = parsed;
        baseStatsWithChoice[k] = parsed;
      }
    });

    // Resource computation parameters (base and per-level increments may be provided by mods outside classes)
    const resourceBase = (cls && (cls.resourceBase || cls.resourcePoolModifier)) || { HP: 0, MP: 0, STA: 0 };
    const resourceLevelUp = (cls && cls.resourceLevelUp) || { HP: 0, MP: 0, STA: 0 };

    const DEX = finalStats.dex || 0;
    const WIS = finalStats.wis || 0;
    const CON = finalStats.con || 0;

    // max STA = 2 * DEX * (1 + Base STA + (level / 2 * STA level up))
    const maxSTA = Math.floor(2 * DEX * (1 + (resourceBase.STA || 0) + ((level / 2) * (resourceLevelUp.STA || 0))));
    // max MP = WIS * (1 + Base MP + (level / 2 * MP level up))
    const maxMP = Math.floor(WIS * (1 + (resourceBase.MP || 0) + ((level / 2) * (resourceLevelUp.MP || 0))));
    // max HP = CON * (1 + Base HP + (level / 2 * HP level up))
    const maxHP = Math.floor(CON * (1 + (resourceBase.HP || 0) + ((level / 2) * (resourceLevelUp.HP || 0))));

    // Merge explicit language choices with race/subrace grants
    const langsArr = [
      ...(Array.isArray(race?.languages) ? race.languages : []),
      ...(Array.isArray(subrace?.languages) ? subrace.languages : []),
    ];
    const langsMap = { ...(characterDraft.skills?.languages || {}) };
    langsArr.forEach(l => {
      if (!langsMap[l]) langsMap[l] = 'native';
    });

    // Prepare payload aligned with server schema
    const payload = {
      ...characterDraft,
      abilityScoreChoices: {
        ...(characterDraft.abilityScoreChoices || {}),
        race: raceChoiceMap,
        subrace: subraceChoiceMap
      },
      // Submit base stats with choice bonuses folded in.
      stats: baseStatsWithChoice,
      abilityScoreChoicesAppliedToBase: true,
      HP: { ...(characterDraft.HP || {}), max: maxHP, current: Math.max(0, Math.min(characterDraft.HP?.current ?? maxHP, maxHP)) },
      MP: { ...(characterDraft.MP || {}), max: maxMP, current: Math.max(0, Math.min(characterDraft.MP?.current ?? maxMP, maxMP)) },
      STA: { ...(characterDraft.STA || {}), max: maxSTA, current: Math.max(0, Math.min(characterDraft.STA?.current ?? maxSTA, maxSTA)) },
      // Conform skills schema
      skills: {
        active: characterDraft.skills?.active || {},
        passive: characterDraft.skills?.passive || {},
        proficiencies: characterDraft.skills?.proficiencies || {},
        languages: langsMap,
      },
    };

    if (!socket) {
      return Promise.resolve({ success: false, message: 'Socket unavailable' });
    }
    if (!playerID) {
      return Promise.resolve({ success: false, message: 'Missing player ID' });
    }

    return new Promise((resolve) => {
      console.log({ character: payload, playerID });
      socket.emit('playerData_saveCharacter', { character: payload, playerID }, (response) => {
        if (!response) {
          const noResponse = { success: false, message: 'No server response' };
          console.error(noResponse.message);
          resolve(noResponse);
          return;
        }

        if (!response.success) {
          console.error('Character save failed:', response.message);
        } else {
          console.log('Character save success');
        }
        resolve(response);
      });
    });
  };

  return (
    <Skeleton>
      <div className="bg-website-default-900 text-center p-4 shadow-lg text-website-default-100 flex flex-row items-center justify-center space-x-8">
        <GameDataProvider gameData={gameData}>
          <Tabs defaultTab={0}>
          <Tabs.Prev className="fixed left-20 top-1/2 -translate-y-1/2 z-50">
            <ArrowBigLeftDash />
          </Tabs.Prev>
          <Tabs.Next max={5} className="fixed right-20 top-1/2 -translate-y-1/2 z-50">
            <ArrowBigRightDash  />
          </Tabs.Next>
          <Tabs.Nav className='flex flex-row justify-center items-center'>
            <Tabs.Tab index={0}>Customization</Tabs.Tab>
            <Tabs.Tab index={1}>Class</Tabs.Tab>
            <Tabs.Tab index={2}>Background</Tabs.Tab>
            <Tabs.Tab index={3}>Race</Tabs.Tab>
            <Tabs.Tab index={4}>Ability Score</Tabs.Tab>
            <Tabs.Tab index={5}>Summary</Tabs.Tab>
          </Tabs.Nav>

          <Tabs.Panels>
            <Tabs.Panel index={0} >
              <Customization values={characterDraft} onChange={updateDraft} />
            </Tabs.Panel>

            <Tabs.Panel index={1}>
              <Class values={characterDraft} onChange={updateDraft} classes={gameData.classes} subclasses={gameData.subclasses} />
            </Tabs.Panel>

            <Tabs.Panel index={2}>
              <Background 
                values={characterDraft} 
                onChange={updateDraft} 
                backgrounds={gameData.backgrounds} 
                items={gameData.items}
                classes={gameData.classes}  // Add this line
            />
            </Tabs.Panel>

            <Tabs.Panel index={3}>
              <Race values={characterDraft} onChange={updateDraft} />
            </Tabs.Panel>

            <Tabs.Panel index={4}>
              <AbilityScores values={characterDraft} onChange={updateDraft} />
            </Tabs.Panel>

            
            <Tabs.Panel index={5}>
              <Summary values={characterDraft} onChange={updateDraft} onSave={characterCreation} classes={gameData.classes} subclasses={gameData.subclasses} races={gameData.races} subraces={gameData.subraces} backgrounds={gameData.backgrounds} />
            </Tabs.Panel>
          </Tabs.Panels>
        </Tabs>
        </GameDataProvider>
      </div>
    </Skeleton>
  )
}
