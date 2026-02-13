import Skeleton from "../../pageComponents/skeleton"
import React, { useContext, useState, useEffect } from 'react';
import { createDefaultCharacter } from '../../data/characterDefaults';
import { GameDataProvider } from '../../data/gameDataContext';
import { Tabs } from '../../pageComponents/tabs'
import { CircleUser, ArrowBigLeftDash, ArrowBigRightDash  } from 'lucide-react';
import { Card } from "../../pageComponents/card";
import { SocketContext } from "../../socket.io/context";
import { Customization } from "../characters/characterCreationPages/Customization"
import { Race } from "../characters/characterCreationPages/Race"
import { Class } from "../characters/characterCreationPages/Class"
import { Background } from "../characters/characterCreationPages/Background"
import { AbilityScores } from "../characters/characterCreationPages/AbilityScores"
import { Summary } from "../characters/characterCreationPages/Summary"

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
    const collections = ['classes', 'subclasses', 'races', 'subraces', 'backgrounds', 'items'];
    const results = {};
    let loadedCount = 0;

    console.log('Starting data load...');

    collections.forEach(collection => {
      socket.emit(
        'database_query',
        {
          collection: collection,
          operation: 'findAll',
        },
        (response) => {
          console.log(`Loaded ${collection}:`, response.success ? `${response.data.length} items` : response.message);
          if (response.success) {
            results[collection] = response.data;
            loadedCount += 1;
            console.log(`Progress: ${loadedCount}/${collections.length}`);
            // Update state when we have all collections
            if (loadedCount === collections.length) {
              console.log('All data loaded, updating state');
              setGameData({
                classes: results.classes || [],
                subclasses: results.subclasses || [],
                races: results.races || [],
                subraces: results.subraces || [],
                backgrounds: results.backgrounds || [],
                items: results.items || []
              });
            }
          } else {
            console.error(`Failed to load ${collection}:`, response.message);
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

  // Update function passed to children to merge partial updates
const updateDraft = React.useCallback((partial) => {
    setCharacterDraft(prev => {
      // Special handling for skills - complete replacement to handle deletions
      // but also merge in all other properties
      if (partial.skills) {
        const updated = deepMerge(prev, partial);
        // Override skills with the complete replacement
        updated.skills = partial.skills;
        return updated;
      }
      return deepMerge(prev, partial);
    });
}, []);

  // Dot-path setter for use inside this parent
  const setCharacter = (path, value) => {
    const keys = Array.isArray(path) ? path : String(path).split('.');
    const partial = {};
    let cur = partial;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      cur[k] = {};
      cur = cur[k];
    }
    cur[keys[keys.length - 1]] = value;
    updateDraft(partial);
  };

  const playerID = localStorage.getItem("player_ID")

  // Compute final stats, features, and resources before saving
  const characterCreation = () => {
    const getById = (arr, id) => (arr || []).find(x => x && x._id === id);

    const level = parseInt(characterDraft.level, 10) || 1;
    const cls = getById(gameData.classes, characterDraft.class);
    const subcls = getById(gameData.subclasses, characterDraft.subclass);
    const race = getById(gameData.races, characterDraft.race);
    const subrace = getById(gameData.subraces, characterDraft.subrace);

    const baseStats = characterDraft.stats || {};
    const classMods = (cls && cls.baseStatModifier) || {};
    const raceMods = (race && race.abilityScoreModifiers) || {};
    const subraceMods = (subrace && subrace.abilityScoreModifiers) || {};

    // Calculate final stats (Luck excluded from pipeline, but kept if present)
    const STAT_KEYS = ['str','dex','con','int','wis','cha'];
    const finalStats = {};
    for (const k of STAT_KEYS) {
      const base = parseInt(baseStats[k], 10) || 0;
      finalStats[k] = base + (classMods[k] || 0) + (raceMods[k] || 0) + (subraceMods[k] || 0);
    }
    // Preserve any additional stats (e.g., luck) as-is
    Object.keys(baseStats || {}).forEach(k => {
      if (!STAT_KEYS.includes(k)) finalStats[k] = parseInt(baseStats[k], 10) || 0;
    });

    // Collect abilities/passives
    const collectFeaturesUpToLevel = (featuresByLevel) => {
      if (!featuresByLevel) return [];
      return Object.entries(featuresByLevel)
        .map(([lvlKey, feats]) => {
          const n = parseInt(String(lvlKey).replace(/[^0-9]/g, ''), 10) || 0;
          return n <= level ? (feats || []) : [];
        })
        .flat();
    };

    const classFeatures = collectFeaturesUpToLevel(cls?.featuresByLevel);
    const subclassFeatures = collectFeaturesUpToLevel(subcls?.featuresByLevel);
    const racialTraits = Array.isArray(race?.traits) ? race.traits : [];
    const subracialTraits = Array.isArray(subrace?.traits) ? subrace.traits : [];

    // Prepare abilities structure (kept descriptive for clarity and engine alignment)
    const abilities = {
      class: classFeatures,
      subclass: subclassFeatures,
      racial: racialTraits,
      subracial: subracialTraits,
    };

    // Resource computation parameters (base and per-level increments may be provided by mods outside classes)
    const resourceBase = (cls && cls.resourceBase) || { HP: 0, MP: 0, STA: 0 };
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

    // Transform proficiencies to server schema arrays
    const profOut = {
      armor: Array.isArray(cls?.baseProficiencies?.armor) ? cls.baseProficiencies.armor : [],
      weapons: Array.isArray(cls?.baseProficiencies?.weapons) ? cls.baseProficiencies.weapons : [],
      tools: Array.isArray(cls?.baseProficiencies?.tools) ? cls.baseProficiencies.tools : [],
      abilityScore: Array.isArray(cls?.baseProficiencies?.abilityScore) ? cls.baseProficiencies.abilityScore : [],
      skills: [],
    };
    const chosenMap = characterDraft.skills?.proficiencies || {};
    const skillOptions = cls?.choices?.proficiencies?.skills?.options || [];
    profOut.skills = Object.keys(chosenMap).filter(k => skillOptions.includes(k));

    // Build languages map from race/subrace
    const langsArr = [
      ...(Array.isArray(race?.languages) ? race.languages : []),
      ...(Array.isArray(subrace?.languages) ? subrace.languages : []),
    ];
    const langsMap = {};
    langsArr.forEach(l => { langsMap[l] = 'native'; });

    // Prepare payload aligned with server schema
    const payload = {
      ...characterDraft,
      // Note: keep base stats as entered by user
      HP: { ...(characterDraft.HP || {}), max: maxHP, current: Math.max(0, Math.min(characterDraft.HP?.current ?? maxHP, maxHP)) },
      MP: { ...(characterDraft.MP || {}), max: maxMP, current: Math.max(0, Math.min(characterDraft.MP?.current ?? maxMP, maxMP)) },
      STA: { ...(characterDraft.STA || {}), max: maxSTA, current: Math.max(0, Math.min(characterDraft.STA?.current ?? maxSTA, maxSTA)) },
      // Conform skills schema
      skills: {
        active: characterDraft.skills?.active || {},
        passive: characterDraft.skills?.passive || {},
        proficiencies: profOut,
        languages: langsMap,
      },
    };

    console.log({ character: payload, playerID });
    socket.emit('playerData_saveCharacter', { character: payload, playerID }, (response) => {
      if (!response) {
        console.log('no response :(');
      }
      console.log(response.message);
      console.log(response);
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
          <Tabs.Next max={6} className="fixed right-20 top-1/2 -translate-y-1/2 z-50">
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