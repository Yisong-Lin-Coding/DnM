import React from 'react';

export default function EffectsTab({ effects }) {
  // If your database uses IDs for effects, you might later map these to a lookup table
  const hasEffects = effects && effects.length > 0;

  return (
    <div className="bg-website-default-800/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md flex flex-col min-h-[400px]">
      {/* Header */}
      <div className="p-4 bg-black/40 border-b border-white/5 flex justify-between items-center">
        <h3 className="text-xs font-black text-red-600 uppercase italic tracking-widest">
          Active Conditions & Effects
        </h3>
        <span className="bg-red-900/20 text-red-500 text-[10px] font-black px-2 py-0.5 rounded border border-red-900/50">
          {effects?.length || 0} ACTIVE
        </span>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
        {hasEffects ? (
          effects.map((effect, idx) => (
            <div 
              key={idx} 
              className="relative overflow-hidden bg-black/40 border border-white/5 rounded-lg p-4 group hover:border-red-900/40 transition-all"
            >
              {/* Decorative side-bar for the effect card */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]" />
              
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <h4 className="text-sm font-black text-white uppercase tracking-tight">
                    {effect.name || "Unknown Effect"}
                  </h4>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mb-2">
                    Source: {effect.source || "Environmental"}
                  </p>
                </div>
                
                {/* Duration Badge */}
                <div className="text-[9px] font-black bg-white/5 px-2 py-1 rounded text-gray-400 border border-white/5">
                  {effect.duration || "Permanent"}
                </div>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed italic">
                {effect.description || "No description provided for this effect."}
              </p>

              {/* Tag system for mechanical changes */}
              {effect.modifiers && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(effect.modifiers).map(([stat, value]) => (
                    <span key={stat} className="text-[9px] font-black px-2 py-0.5 bg-red-900/20 text-red-400 rounded border border-red-900/30 uppercase">
                      {stat} {value >= 0 ? `+${value}` : value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center py-20 opacity-20">
            <div className="w-16 h-16 border-4 border-dashed border-gray-500 rounded-full flex items-center justify-center mb-4 text-2xl">
              ✨
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-center">
              No active conditions or <br /> magical effects
            </p>
          </div>
        )}
      </div>

      {/* Quick Info Footer */}
      <div className="p-3 bg-black/20 border-t border-white/5">
        <p className="text-[9px] text-gray-600 italic leading-tight">
          Effects are automatically calculated into your total Ability Scores and Vitals.
        </p>
      </div>
    </div>
  );
}