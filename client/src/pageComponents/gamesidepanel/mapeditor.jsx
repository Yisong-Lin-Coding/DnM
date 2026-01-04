
import { useState } from 'react';
import { useGame } from '../../data/gameContext';

function MapEditor() {
  const {
    worldMouseCoords,
    camera,
    mapObjects,
    addMapObject,
    updateMapObject,
    deleteMapObject,
    replaceAllMapObjects,
    saveMapToDatabase,
    currentMapId,
  } = useGame();
  
  const [selectedObject, setSelectedObject] = useState(null);
  const [nextId, setNextId] = useState(
    mapObjects.length > 0 ? Math.max(...mapObjects.map(o => o.id)) + 1 : 1
  );
  
  const [creationMode, setCreationMode] = useState(null);
  const [objectColor, setObjectColor] = useState('#3B82F6');
  const [objectZ, setObjectZ] = useState(0);

  const addObject = (type) => {
    const newObject = {
      id: nextId,
      type,
      x: Math.round(worldMouseCoords?.x || 0),
      y: Math.round(worldMouseCoords?.y || 0),
      z: objectZ,
      color: objectColor,
    };

    if (type === 'circle') {
      newObject.size = 30;
    } else if (type === 'rect') {
      newObject.width = 50;
      newObject.height = 40;
    } else if (type === 'triangle') {
      newObject.size = 40;
    }

    addMapObject(newObject);
    setNextId(nextId + 1);
    setCreationMode(null);
  };

  const exportMap = () => {
    const json = JSON.stringify(mapObjects, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `map_${currentMapId}.json`;
    a.click();
  };

  const importMap = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          replaceAllMapObjects(data);
          setNextId(Math.max(...data.map(obj => obj.id)) + 1);
        } catch (err) {
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  };

  const sortedObjects = [...mapObjects].sort((a, b) => a.z - b.z);

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold mb-4">Map Editor</h2>
        
        <div className="text-sm mb-4 bg-gray-800 p-2 rounded">
          <p>Map ID: {currentMapId}</p>
          <p>World Coords: ({Math.round(worldMouseCoords?.x || 0)}, {Math.round(worldMouseCoords?.y || 0)})</p>
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-sm">Create Object:</p>
          <div className="flex gap-2">
            <button
              onClick={() => setCreationMode('circle')}
              className={`px-3 py-2 rounded ${creationMode === 'circle' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              ⭕ Circle
            </button>
            <button
              onClick={() => setCreationMode('rect')}
              className={`px-3 py-2 rounded ${creationMode === 'rect' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              ▭ Rectangle
            </button>
            <button
              onClick={() => setCreationMode('triangle')}
              className={`px-3 py-2 rounded ${creationMode === 'triangle' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              △ Triangle
            </button>
          </div>

          {creationMode && (
            <div className="bg-gray-800 p-3 rounded">
              <div className="flex gap-2 items-center mb-2">
                <label className="text-sm">Color:</label>
                <input
                  type="color"
                  value={objectColor}
                  onChange={(e) => setObjectColor(e.target.value)}
                  className="w-12 h-8 rounded cursor-pointer"
                />
              </div>

              <div className="flex gap-2 items-center mb-2">
                <label className="text-sm">Z-Index:</label>
                <input
                  type="number"
                  value={objectZ}
                  onChange={(e) => setObjectZ(Number(e.target.value))}
                  className="w-20 bg-gray-700 px-2 py-1 rounded"
                />
              </div>

              <button
                onClick={() => addObject(creationMode)}
                className="w-full bg-green-600 hover:bg-green-700 px-3 py-2 rounded"
              >
                Place at ({Math.round(worldMouseCoords?.x || 0)}, {Math.round(worldMouseCoords?.y || 0)})
              </button>
              
              <button
                onClick={() => setCreationMode(null)}
                className="w-full bg-red-600 hover:bg-red-700 px-3 py-2 rounded mt-2"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="font-semibold">Objects ({mapObjects.length})</p>
          <div className="flex gap-2">
            <button
              onClick={saveMapToDatabase}
              className="text-xs bg-green-600 hover:bg-green-700 px-2 py-1 rounded"
            >
              Save to DB
            </button>
            <button
              onClick={exportMap}
              className="text-xs bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded"
            >
              Export
            </button>
            <label className="text-xs bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded cursor-pointer">
              Import
              <input type="file" accept=".json" onChange={importMap} className="hidden" />
            </label>
          </div>
        </div>

        <div className="space-y-2">
          {sortedObjects.map((obj) => (
            <div
              key={obj.id}
              className={`p-3 rounded cursor-pointer ${
                selectedObject === obj.id ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
              }`}
              onClick={() => setSelectedObject(obj.id)}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-semibold">
                    {obj.type === 'circle' && '⭕'}
                    {obj.type === 'rect' && '▭'}
                    {obj.type === 'triangle' && '△'}
                    {' '}ID: {obj.id}
                  </span>
                  <p className="text-xs text-gray-400">
                    Pos: ({obj.x}, {obj.y}) Z: {obj.z}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMapObject(obj.id);
                  }}
                  className="text-red-400 hover:text-red-300 text-xl"
                >
                  ×
                </button>
              </div>

              {selectedObject === obj.id && (
                <div className="mt-2 space-y-2 border-t border-gray-700 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs">X:</label>
                      <input
                        type="number"
                        value={obj.x}
                        onChange={(e) => updateMapObject(obj.id, { x: Number(e.target.value) })}
                        className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs">Y:</label>
                      <input
                        type="number"
                        value={obj.y}
                        onChange={(e) => updateMapObject(obj.id, { y: Number(e.target.value) })}
                        className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs">Z-Index:</label>
                    <input
                      type="number"
                      value={obj.z}
                      onChange={(e) => updateMapObject(obj.id, { z: Number(e.target.value) })}
                      className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                    />
                  </div>

                  {obj.type === 'circle' && (
                    <div>
                      <label className="text-xs">Size:</label>
                      <input
                        type="number"
                        value={obj.size}
                        onChange={(e) => updateMapObject(obj.id, { size: Number(e.target.value) })}
                        className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                      />
                    </div>
                  )}

                  {obj.type === 'rect' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs">Width:</label>
                        <input
                          type="number"
                          value={obj.width}
                          onChange={(e) => updateMapObject(obj.id, { width: Number(e.target.value) })}
                          className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs">Height:</label>
                        <input
                          type="number"
                          value={obj.height}
                          onChange={(e) => updateMapObject(obj.id, { height: Number(e.target.value) })}
                          className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {obj.type === 'triangle' && (
                    <div>
                      <label className="text-xs">Size:</label>
                      <input
                        type="number"
                        value={obj.size}
                        onChange={(e) => updateMapObject(obj.id, { size: Number(e.target.value) })}
                        className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs">Color:</label>
                    <input
                      type="color"
                      value={obj.color}
                      onChange={(e) => updateMapObject(obj.id, { color: e.target.value })}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MapEditor;