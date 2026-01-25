import Skeleton from "../../pageComponents/skeleton"
import React, { useContext, useState, useEffect } from 'react';
import { createDefaultCharacter } from '../../data/characterDefaults';
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
      out[k] = (v && typeof v === 'object' && !Array.isArray(v))
        ? deepMerge(out[k] || {}, v)
        : v;
    }
    return out;
  };

  // Update function passed to children to merge partial updates
  const updateDraft = React.useCallback((partial) => {
    setCharacterDraft(prev => deepMerge(prev, partial));
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

  const characterCreation = ()=>{
    console.log({character: characterDraft, playerID})
    socket.emit("playerData_saveCharacter",{character: characterDraft, playerID}, (response) =>{
        if(!response){
            console.log("no response :(")
        }
        console.log(response.message)
        console.log(response)
    })
  }

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
              <Background values={characterDraft} onChange={updateDraft} backgrounds={gameData.backgrounds} items={gameData.items} />
            </Tabs.Panel>

            <Tabs.Panel index={3}>
              <Race values={characterDraft} onChange={updateDraft} races={gameData.races} subraces={gameData.subraces} />
            </Tabs.Panel>

            <Tabs.Panel index={4}>
              <AbilityScores values={characterDraft} onChange={updateDraft} />
            </Tabs.Panel>

            
            <Tabs.Panel index={5}>
              <Summary values={characterDraft} onChange={updateDraft} onSave={characterCreation} />
            </Tabs.Panel>
          </Tabs.Panels>
        </Tabs>
      </div>
    </Skeleton>
  )
}