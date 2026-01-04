import { createContext, useContext, useState, useRef, useMemo } from 'react';

const GameContext = createContext();

export const GameProvider = ({ children }) => {
  const [selectedChar, setSelectedChar] = useState(null);
  const [fogEnabled, setFogEnabled] = useState(true);
  const [characters, setCharacters] = useState([
    {
      id: "char1",
      name: "Hero",
      position: { x: 25, y: 50 },
      size: 50,
      visionDistance: 200,
      rotation: 45,
      visionArc: 90,
      team: "player",
    },
    {
      id: "char2",
      name: "Ally",
      position: { x: 100, y: 100 },
      size: 20,
      visionDistance: 150,
      rotation: 180,
      visionArc: 120,
      team: "player",
    },
    {
      id: "char3",
      name: "Enemy",
      position: { x: 400, y: 300 },
      size: 30,
      visionDistance: 100,
      rotation: 270,
      visionArc: 90,
      team: "enemy",
    },
  ]);
  
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const camera = useRef({ x: 0, y: 0, zoom: 1, bgImage: null });

  // ✨ NEW: Map Objects State
  const [mapObjects, setMapObjects] = useState([
    { id: 1, type: 'circle', x: 100, y: 100, z: 0, size: 30, color: '#3B82F6' },
    { id: 2, type: 'rect', x: 200, y: 150, z: 1, width: 50, height: 40, color: '#EF4444' },
    { id: 3, type: 'triangle', x: 300, y: 200, z: 0, size: 40, color: '#10B981' },
  ]);

  // ✨ NEW: Current Map ID (for database later)
  const [currentMapId, setCurrentMapId] = useState('default_map');

  // Helper functions
  const updateCharacter = (characterId, updates) => {
    setCharacters(prev => prev.map(char => 
      char.id === characterId ? { ...char, ...updates } : char
    ));
  };

  const selectCharacter = (characterId) => {
    setSelectedChar(characterId);
  };

  const toggleFog = () => {
    setFogEnabled(prev => !prev);
  };

  const handleCharacterAction = (characterId, action) => {
    const char = characters.find(c => c.id === characterId);
    console.log(`${char?.name} performs ${action}`);
  };

  // ✨ NEW: Map Object Management
  const addMapObject = (obj) => {
    setMapObjects(prev => [...prev, obj]);
  };

  const updateMapObject = (id, updates) => {
    setMapObjects(prev => prev.map(obj => 
      obj.id === id ? { ...obj, ...updates } : obj
    ));
  };

  const deleteMapObject = (id) => {
    setMapObjects(prev => prev.filter(obj => obj.id !== id));
  };

  const replaceAllMapObjects = (newObjects) => {
    setMapObjects(newObjects);
  };

  // ✨ NEW: Database-ready functions (implement later)
  const saveMapToDatabase = async () => {
    // TODO: Implement database save
    console.log('Saving map to database:', currentMapId, mapObjects);
    // Example:
    // await fetch('/api/maps', {
    //   method: 'POST',
    //   body: JSON.stringify({ mapId: currentMapId, objects: mapObjects })
    // });
  };

  const loadMapFromDatabase = async (mapId) => {
    // TODO: Implement database load
    console.log('Loading map from database:', mapId);
    // Example:
    // const response = await fetch(`/api/maps/${mapId}`);
    // const data = await response.json();
    // setMapObjects(data.objects);
    // setCurrentMapId(mapId);
  };

  // Coordinate conversion utilities
  const screenToWorld = (screenX, screenY) => {
    if (!camera?.current) return { x: 0, y: 0 };
    const zoom = camera.current.zoom || 1;
    const camX = camera.current.x || 0;
    const camY = camera.current.y || 0;
    return {
      x: (screenX + camX) / zoom,
      y: (screenY + camY) / zoom,
    };
  };

  const worldToScreen = (worldX, worldY) => {
    if (!camera?.current) return { x: 0, y: 0 };
    const zoom = camera.current.zoom || 1;
    const camX = camera.current.x || 0;
    const camY = camera.current.y || 0;
    return {
      x: worldX * zoom - camX,
      y: worldY * zoom - camY,
    };
  };

  const worldMouseCoords = useMemo(() => {
    if (!camera?.current || !lastMouse) return { x: 0, y: 0 };
    if (typeof lastMouse.x !== 'number' || typeof lastMouse.y !== 'number') {
      return { x: 0, y: 0 };
    }
    return screenToWorld(lastMouse.x, lastMouse.y);
  }, [lastMouse]);

  const value = {
    // Existing state
    selectedChar,
    setSelectedChar,
    fogEnabled,
    setFogEnabled,
    characters,
    setCharacters,
    lastMouse,
    setLastMouse,
    camera,
    worldMouseCoords,
    
    // Map objects
    mapObjects,
    setMapObjects,
    currentMapId,
    setCurrentMapId,
    
    // Helper functions
    updateCharacter,
    selectCharacter,
    toggleFog,
    handleCharacterAction,
    screenToWorld,
    worldToScreen,
    
    // Map management
    addMapObject,
    updateMapObject,
    deleteMapObject,
    replaceAllMapObjects,
    saveMapToDatabase,
    loadMapFromDatabase,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};