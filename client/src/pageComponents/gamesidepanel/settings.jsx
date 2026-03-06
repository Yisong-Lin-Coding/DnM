// c:\Projects\client\src\pageComponents\gamesidepanel\settings.jsx
import { useNavigate } from "react-router-dom";

export default function SettingsPanel({ character }) {
  const navigate = useNavigate();
  const playerID = localStorage.getItem("player_ID");

  return (
    <div className="h-full min-h-0 overflow-y-auto scrollbar-transparent px-4 py-4">
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Settings</h3>
          <p className="text-xs text-slate-400">Player ID: {playerID}</p>
        </div>

        <div className="space-y-2">
          <button 
            onClick={() => navigate(-1)}
            className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-medium transition-colors"
          >
            Leave Game
          </button>
        </div>
      </div>
    </div>
  );
}
