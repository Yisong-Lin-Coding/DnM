import React from 'react';

export default function VitalsCard({ character }) {
  if (!character) return null;

  const { HP, MP, STA, water, food } = character;

  const VitalsBar = ({ label, current, max, temp = 0, color, glow }) => {
    const percentage = Math.min((current / max) * 100, 100);
    const tempPercentage = temp > 0 ? Math.min((temp / max) * 100, 100) : 0;

    return (
      <div className="space-y-1.5 mb-4">
        <div className="flex justify-between items-end px-1">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
          <div className="text-[11px] font-bold text-white">
            {temp > 0 && <span className="text-yellow-500">+{temp} </span>}
            {current} <span className="text-gray-500">/ {max}</span>
          </div>
        </div>
        <div className="relative h-3 bg-black rounded-full border border-white/10 overflow-hidden shadow-inner">
          {/* Main Bar */}
          <div 
            className={`absolute h-full ${color} ${glow} transition-all duration-500 ease-out`}
            style={{ width: `${percentage}%` }}
          />
          {/* Temp HP overlay (striped) */}
          {temp > 0 && (
            <div 
              className="absolute h-full bg-yellow-500/30 border-r border-yellow-400 opacity-50"
              style={{ width: `${tempPercentage}%`, left: `${percentage}%` }}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-website-default-800/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      
      {/* Header */}
      <div className="p-4 bg-black/40 border-b border-white/5 flex justify-between items-center">
        <h3 className="text-xs font-black text-red-600 uppercase italic tracking-widest underline decoration-red-900/50 underline-offset-4">
          Vitals
        </h3>
        <div className="flex gap-1.5">
           <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
           <span className="text-[9px] text-gray-500 font-black uppercase">Live Status</span>
        </div>
      </div>

      <div className="p-4 pb-2">
        {/* Resource Bars */}
        <VitalsBar 
          label="Health" 
          current={HP.current} 
          max={HP.max} 
          temp={HP.temp}
          color="bg-red-600" 
          glow="shadow-[0_0_12px_rgba(220,38,38,0.5)]" 
        />
        <VitalsBar 
          label="Mana" 
          current={MP.current} 
          max={MP.max} 
          color="bg-blue-600" 
          glow="shadow-[0_0_12px_rgba(37,99,235,0.5)]" 
        />
        <VitalsBar 
          label="Stamina" 
          current={STA.current} 
          max={STA.max} 
          color="bg-emerald-600" 
          glow="shadow-[0_0_12px_rgba(5,150,105,0.5)]" 
        />
      </div>

      {/* Survival Stats (Food/Water) */}
      <div className="grid grid-cols-2 gap-px bg-white/5 border-t border-white/5">
        <div className="bg-black/40 p-3 text-center group hover:bg-blue-900/10 transition-colors">
          <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Hydration</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-blue-400 text-sm">💧</span>
            <p className="text-md font-black text-white italic">
              {water.current} <span className="text-gray-600 text-[10px]">/ {water.max}</span>
            </p>
          </div>
        </div>
        <div className="bg-black/40 p-3 text-center group hover:bg-orange-900/10 transition-colors">
          <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Nutrition</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-orange-400 text-sm">🍖</span>
            <p className="text-md font-black text-white italic">
              {food.current} <span className="text-gray-600 text-[10px]">/ {food.max}</span>
            </p>
          </div>
        </div>
      </div>
      
      {/* Visual Footer */}
      <div className="h-1 w-full bg-gradient-to-r from-red-600/0 via-red-600/20 to-red-600/0" />
    </div>
  );
}