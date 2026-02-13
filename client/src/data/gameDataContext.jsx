import React, { createContext, useContext, useMemo } from 'react';

const GameDataContext = createContext(null);

/**
 * GameDataProvider: Wraps character creation pages and provides memoized game data
 * Converts raw arrays into indexed maps and exposes selectors for efficient lookups
 */
export function GameDataProvider({ 
  children, 
  gameData = {
    classes: [],
    subclasses: [],
    races: [],
    subraces: [],
    backgrounds: [],
    items: []
  }
}) {
  // Memoize id maps for O(1) lookups instead of array.find()
  const maps = useMemo(() => {
    const classesById = {};
    const subclassesById = {};
    const racesById = {};
    const subracesById = {};
    const backgroundsById = {};
    const itemsByItemId = {};
    const itemsByMongoId = {};

    // Build id maps
    (gameData.classes || []).forEach(c => {
      if (c && c._id) classesById[c._id] = c;
    });

    (gameData.subclasses || []).forEach(sc => {
      if (sc && sc._id) subclassesById[sc._id] = sc;
    });

    (gameData.races || []).forEach(r => {
      if (r && r._id) racesById[r._id] = r;
    });

    (gameData.subraces || []).forEach(sr => {
      if (sr && sr._id) subracesById[sr._id] = sr;
    });

    (gameData.backgrounds || []).forEach(b => {
      if (b && b._id) backgroundsById[b._id] = b;
    });

    (gameData.items || []).forEach(item => {
      if (item && item._id) {
        itemsByMongoId[item._id] = item;
        // Also map by itemId if it exists (for quick lookups during inventory setup)
        if (item.itemId) {
          itemsByItemId[item.itemId] = item;
        }
      }
    });

    return {
      classesById,
      subclassesById,
      racesById,
      subracesById,
      backgroundsById,
      itemsByItemId,
      itemsByMongoId
    };
  }, [gameData]);

  // Memoize arrays so they don't trigger unnecessary re-renders
  const arrays = useMemo(() => ({
    classes: gameData.classes || [],
    subclasses: gameData.subclasses || [],
    races: gameData.races || [],
    subraces: gameData.subraces || [],
    backgrounds: gameData.backgrounds || [],
    items: gameData.items || []
  }), [gameData]);

  // Selector functions
  const selectors = useMemo(() => ({
    getClassById: (id) => maps.classesById[id] || null,
    getSubclassById: (id) => maps.subclassesById[id] || null,
    getRaceById: (id) => maps.racesById[id] || null,
    getSubraceById: (id) => maps.subracesById[id] || null,
    getBackgroundById: (id) => maps.backgroundsById[id] || null,
    getItemByMongoId: (id) => maps.itemsByMongoId[id] || null,
    getItemByItemId: (id) => maps.itemsByItemId[id] || null,
    
    // Filter subclasses by parent class name
    getSubclassesForClass: (className) => {
      return arrays.subclasses.filter(sc => sc.parentClass === className);
    },

    // Filter races by size (optional utility)
    getRacesBySize: (size) => {
      return arrays.races.filter(r => r.size === size);
    }
  }), [maps, arrays]);

  const value = useMemo(() => ({
    maps,
    arrays,
    selectors
  }), [maps, arrays, selectors]);

  return (
    <GameDataContext.Provider value={value}>
      {children}
    </GameDataContext.Provider>
  );
}

/**
 * Hook to consume GameDataContext
 * Throws if used outside of GameDataProvider
 */
export function useGameData() {
  const context = useContext(GameDataContext);
  if (!context) {
    throw new Error('useGameData must be used within a GameDataProvider');
  }
  return context;
}
