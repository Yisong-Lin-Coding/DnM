import { useGame } from "../../data/gameContext";

function Admin() {
  // Destructure with safe defaults
  const {
    selectedChar,
    characters = [],
    fogEnabled = true,
    toggleFog = () => {},
    lastMouse = { x: 0, y: 0 },
    worldMouseCoords = { x: 0, y: 0 },
    camera,
    handleCharacterAction = () => {},
  } = useGame() || {}; // Extra safety: default to empty object if context is undefined

  // Additional safety check for worldMouseCoords
  const safeWorldCoords = worldMouseCoords || { x: 0, y: 0 };

  return (
    <div className="p-4 text-white">
      <h3 className="text-lg font-bold mb-4">Admin Tools</h3>
      
      <div className="text-sm space-y-2">
        <p className="font-semibold">Mouse Position:</p>
        {/* Safe access with optional chaining */}
        <p>
          Screen: X:{Math.round(lastMouse?.x || 0)} Y:{Math.round(lastMouse?.y || 0)}
        </p>
        <p>
          World: X:{Math.round(safeWorldCoords.x)} Y:{Math.round(safeWorldCoords.y)}
        </p>
      </div>

      <div className="text-sm space-y-2 mt-4">
        <p className="font-semibold">Camera:</p>
        <p>X: {Math.round(camera?.current?.x || 0)}</p>
        <p>Y: {Math.round(camera?.current?.y || 0)}</p>
        <p>Zoom: {camera?.current?.zoom?.toFixed(2) || 1}</p>
      </div>

      <div className="text-sm space-y-2 mt-4">
        <p className="font-semibold">All Characters:</p>
        {characters.length > 0 ? (
          characters.map((char) => (
            <div key={char.id} className="p-2 bg-gray-600 rounded">
              <p>{char.name} ({char.team})</p>
              <p className="text-xs">ID: {char.id}</p>
            </div>
          ))
        ) : (
          <p className="text-gray-400">No characters</p>
        )}
      </div>
    </div>
  );
}

export default Admin;