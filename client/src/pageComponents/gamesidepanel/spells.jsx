// c:\Projects\client\src\pageComponents\gamesidepanel\spells.jsx
import { Sparkles } from "lucide-react";

export default function SpellsPanel({ character }) {
  if (!character) return <div className="p-6 text-center text-slate-400 text-sm">No character selected.</div>;

  const spells = character.spells || [];

  return (
    <div className="h-full min-h-0 overflow-y-auto scrollbar-transparent px-4 py-4">
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 min-h-[200px]">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Sparkles size={18} /> Spellbook
        </h3>
        
        {spells.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 text-center italic">No spells known.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {spells.map((spell, idx) => (
              <div key={idx} className="bg-slate-800/50 p-2 rounded border border-slate-700">
                <div className="text-sm font-medium text-purple-300">{spell.name || spell}</div>
                {spell.level && <div className="text-[10px] text-slate-400">Level {spell.level}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
