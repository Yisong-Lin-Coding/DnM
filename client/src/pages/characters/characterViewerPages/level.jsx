import React from 'react';


export default function ProfileCard({ character, raceName, className }) {
  if (!character) return null;

  const { experience, level, alignment, age, model, subclass } = character;
  
  // Experience Progress Calculation
  const currentXP = experience?.current || 0;
  const goalXP = experience?.nextLevel || 1000;
  const xpPercentage = Math.min((currentXP / goalXP) * 100, 100);

  return (
    <div className="bg-website-default-800/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      
      {/* HEADER SECTION: Identity & Level Badge */}
      <div className="p-4 bg-black/40 border-b border-white/5 flex justify-between items-center">
        <div className="flex flex-col text-left">
          <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">Identity</span>
          <div className="flex gap-2 items-center">
            <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">
              {raceName || "Race"} 
            </h2>
            <span className="text-gray-600 text-sm font-bold">/</span>
            <h2 className="text-xl font-black text-red-500 italic uppercase tracking-tighter">
              {className || "Class"}
            </h2>
          </div>
          {subclass && (
            <span className="text-[10px] text-gray-500 font-bold uppercase italic tracking-widest mt-0.5">
              {subclass}
            </span>
          )}
        </div>
        
        {/* Level Hexagon-style Badge */}
        <div className="bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border-2 border-red-900 shadow-[0_0_10px_rgba(153,27,27,0.3)] px-3 py-1 rounded-md flex flex-col items-center justify-center min-w-[55px]">
          <span className="text-[8px] font-black text-red-500 uppercase leading-none mb-1">Level</span>
          <span className="text-2xl font-black text-white leading-none">{level}</span>
        </div>
      </div>

      {/* CENTER SECTION: Experience & Alignment */}
      <div className="p-4 space-y-5">
        

        {/* Experience Tracker */}
        <div className="space-y-2">
          <div className="flex justify-between items-end px-1">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">Progression</span>
            <span className="text-[10px] font-bold text-gray-200">
              {currentXP.toLocaleString()} <span className="text-gray-500">/ {goalXP.toLocaleString()} XP</span>
            </span>
          </div>
          
          {/* Main Progress Bar */}
          <div className="relative w-full h-3.5 bg-black rounded-full border border-white/10 overflow-hidden shadow-inner">
            <div 
              className="absolute h-full bg-gradient-to-r from-red-950 via-red-600 to-red-400 shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all duration-1000 ease-out"
              style={{ width: `${xpPercentage}%` }}
            />
            
            {/* Aesthetic Grid Overlay */}
            <div className="absolute inset-0 flex justify-around opacity-20 pointer-events-none">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="w-[1px] h-full bg-white/30" />
              ))}
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-[8px] text-gray-600 font-bold uppercase tracking-tighter">
              {xpPercentage.toFixed(1)}% to next level
            </span>
            <span className="text-[9px] text-red-900 font-black uppercase italic">
              {goalXP - currentXP} XP REMAINING
            </span>
          </div>
        </div>
      </div>

    
    </div>
  );
}