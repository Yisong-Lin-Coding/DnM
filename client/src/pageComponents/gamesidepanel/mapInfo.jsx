// c:\Projects\client\src\pageComponents\gamesidepanel\mapInfo.jsx
import { useGame } from "../../data/gameContext";
import { Map as MapIcon } from "lucide-react";

export default function MapInfoPanel() {
  const { currentMapId, mapObjects, currentZLevel } = useGame();
  
  const objectCount = (mapObjects || []).length;
  const floorCount = (mapObjects || []).filter(o => o.terrainType === 'floor').length;
  const wallCount = (mapObjects || []).filter(o => o.terrainType === 'wall').length;

  return (
    <div className="h-full min-h-0 overflow-y-auto scrollbar-transparent px-4 py-4">
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <MapIcon size={18} /> Map Details
        </h3>
        
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex justify-between border-b border-slate-700 pb-2">
            <span>Map ID</span>
            <span className="font-mono text-slate-100">{currentMapId || "Unknown"}</span>
          </div>
          <div className="flex justify-between border-b border-slate-700 pb-2">
            <span>Current Level</span>
            <span className="font-mono text-slate-100">Z-{currentZLevel}</span>
          </div>
          <div className="flex justify-between border-b border-slate-700 pb-2">
            <span>Total Objects</span>
            <span className="font-mono text-slate-100">{objectCount}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="bg-slate-800 p-2 rounded text-center">
              <div className="text-xs text-slate-500 uppercase">Floors</div>
              <div className="font-bold text-slate-200">{floorCount}</div>
            </div>
            <div className="bg-slate-800 p-2 rounded text-center">
              <div className="text-xs text-slate-500 uppercase">Walls</div>
              <div className="font-bold text-slate-200">{wallCount}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
