import React from 'react';

export default function StoryBox({ character }) {
  if (!character) return null;

  const { stories } = character;

  // Helper to render lists (Personality, Ideals, Flaws)
  const StorySection = ({ title, items }) => (
    <div className="flex flex-col text-left">
      <span className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">
        {title}
      </span>
      <div className="flex flex-wrap gap-1">
        {items && items.length > 0 ? (
          items.map((item, idx) => (
            <span key={idx} className="text-[11px] bg-black/40 border border-white/5 px-2 py-0.5 rounded text-gray-300 italic">
              {item}
            </span>
          ))
        ) : (
          <span className="text-[10px] text-gray-600 italic">None set</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-website-default-800/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md flex flex-col min-h-[400px]">
      
      {/* Header */}
      <div className="p-4 bg-black/40 border-b border-white/5 flex justify-between items-center">
        <h3 className="text-xs font-black text-red-600 uppercase italic tracking-widest">
          Character Story & Persona
        </h3>
        <div className="flex gap-1">
           <div className="w-2 h-2 rounded-full bg-red-900/50" />
           <div className="w-2 h-2 rounded-full bg-red-600/50" />
        </div>
      </div>

      {/* Traits Grid */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/20 border-b border-white/5">
        <StorySection title="Personality" items={stories?.personality} />
        <StorySection title="Ideals" items={stories?.ideals} />
        <StorySection title="Flaws" items={stories?.flaws} />
      </div>

      {/* Main Long Story Area */}
      <div className="relative p-6 flex-1">
        {/* The Vertical Red Glow Line */}
        <div className="absolute left-0 top-6 bottom-6 w-1 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)] rounded-r" />
        
        <div className="pl-4 text-left">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-3">
            Biography
          </span>
          <p className="text-sm text-gray-300 leading-relaxed italic font-serif">
            {stories?.longStory || "This adventurer's past remains shrouded in mystery. No written history has been recorded in the archives yet..."}
          </p>
        </div>
      </div>

      {/* Footer Decoration */}
      <div className="p-3 bg-black/40 border-t border-white/5 flex justify-between items-center px-6">
         <span className="text-[9px] text-gray-600 font-bold uppercase italic">
            Character ID: {character._id?.$oid?.substring(0, 8)}...
         </span>
         <div className="flex gap-2 opacity-20">
            <div className="w-1 h-1 rounded-full bg-white" />
            <div className="w-1 h-1 rounded-full bg-white" />
            <div className="w-1 h-1 rounded-full bg-white" />
         </div>
      </div>
    </div>
  );
}