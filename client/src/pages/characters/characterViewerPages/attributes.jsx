import React from 'react';

export default function AttributesCard({ stats }) {
  if (!stats) return null;

  const getModifier = (score) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : mod;
  };

  // Separate LUCK from the other stats
  const statEntries = Object.entries(stats).filter(([key, value]) => 
    key !== "_id" && key !== "LUCK" && typeof value === 'object'
  );
  const luckStat = stats.LUCK;

  // Reusable Stat Block Component
  const StatBlock = ({ name, data, fullWidth = false }) => (
    <div className={`relative group bg-black/40 p-3 rounded-lg border border-white/5 hover:border-red-900/40 hover:bg-red-900/5 transition-all duration-300 text-center shadow-inner ${fullWidth ? 'col-span-2' : ''}`}>
      <span className="block text-[10px] text-gray-500 font-black tracking-widest uppercase mb-1 group-hover:text-red-500 transition-colors">
        {name}
      </span>
      <div className="flex flex-col items-center justify-center">
        <span className={`${fullWidth ? 'text-5xl' : 'text-4xl'} font-black text-white leading-none tracking-tighter`}>
          {data.total}
        </span>
        <div className="mt-1 px-2 py-0.5 bg-white/5 rounded border border-white/10 text-[10px] font-black text-gray-300 group-hover:border-red-900/50 group-hover:text-white transition-all">
          {getModifier(data.total)}
        </div>
      </div>
      <div className="text-[9px] text-gray-600 font-bold mt-2 uppercase tracking-tighter">
        Base: <span className="text-gray-400">{data.permMods?.base || 0}</span>
      </div>
    </div>
  );

  return (
    <div className="bg-website-default-800/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="p-4 bg-black/40 border-b border-white/5 flex justify-between items-center">
        <h3 className="text-xs font-black text-red-600 uppercase italic tracking-widest underline decoration-red-900/50 underline-offset-4">
          Attributes
        </h3>
        <span className="text-[10px] text-gray-600 font-black uppercase tracking-tighter">Core Stats</span>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3">
        {/* Render standard 2-column stats */}
        {statEntries.map(([key, value]) => (
          <StatBlock key={key} name={key} data={value} />
        ))}

        {/* Render LUCK centered at the bottom */}
        {luckStat && (
          <div className="col-span-2 mt-2 pt-2 border-t border-white/5">
             <StatBlock name="LUCK" data={luckStat} fullWidth={true} />
          </div>
        )}
      </div>

      <div className="h-1 w-full bg-gradient-to-r from-transparent via-red-950 to-transparent opacity-30" />
    </div>
  );
}