import React from 'react';

export default function AppearanceCard({ character }) {
  if (!character) return null;

  const { gender, alignment, customization, model, age } = character;

  return (
    <div className="bg-website-default-800/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      
      {/* Header */}
      <div className="p-4 bg-black/40 border-b border-white/5 flex justify-between items-center">
        <h3 className="text-xs font-black text-red-600 uppercase italic tracking-widest underline decoration-red-900/50 underline-offset-4">
          Appearance
        </h3>
        <span className="text-[10px] text-gray-600 font-black uppercase tracking-tighter">
          {model?.size || "Medium"} Size
        </span>
      </div>

      {/* Attributes List */}
      <div className="p-4 space-y-3">
        
        {/* Row 1: Gender & Alignment */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col text-left">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">Gender</span>
            <span className="text-sm font-bold text-gray-200">{gender}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">Alignment</span>
            <span className="text-sm font-bold text-emerald-500 italic uppercase tracking-tighter">{alignment}</span>
          </div>
        </div>

        <div className="h-px bg-white/5 w-full" />

        {/* Physical Customization Grid (Skin, Eyes, Hair) */}
        <div className="grid grid-cols-3 gap-2 py-1">
          <div className="bg-black/20 p-2 rounded border border-white/5 text-center group hover:border-red-900/30 transition-colors">
            <span className="block text-[8px] font-black text-gray-500 uppercase">Skin</span>
            <span className="text-xs font-bold text-gray-300 capitalize">{customization?.skinColor}</span>
          </div>
          <div className="bg-black/20 p-2 rounded border border-white/5 text-center group hover:border-red-900/30 transition-colors">
            <span className="block text-[8px] font-black text-gray-500 uppercase">Eyes</span>
            <span className="text-xs font-bold text-gray-300 capitalize">{customization?.eyeColor}</span>
          </div>
          <div className="bg-black/20 p-2 rounded border border-white/5 text-center group hover:border-red-900/30 transition-colors">
            <span className="block text-[8px] font-black text-gray-500 uppercase">Hair</span>
            <span className="text-xs font-bold text-gray-300 capitalize">{customization?.hairColor}</span>
          </div>
        </div>

        <div className="h-px bg-white/5 w-full" />

        {/* Row 3: Physical Metrics (Age, Height, Weight) */}
        <div className="bg-black/40 p-3 rounded-lg border border-red-900/20 shadow-inner">
          <div className="grid grid-cols-3 gap-2">
            {/* Age Column */}
            <div className="flex flex-col text-left border-r border-white/5">
              <span className="text-[8px] font-black text-gray-600 uppercase">Age</span>
              <span className="text-xs font-bold text-white tracking-tight">
                {age?.years} Years
              </span>
            </div>
            {/* Height Column */}
            <div className="flex flex-col text-center border-r border-white/5">
              <span className="text-[8px] font-black text-gray-600 uppercase">Height</span>
              <span className="text-xs font-bold text-white">{model?.height}"</span>
            </div>
            {/* Weight Column */}
            <div className="flex flex-col text-right">
              <span className="text-[8px] font-black text-gray-600 uppercase">Weight</span>
              <span className="text-xs font-bold text-white">{model?.weight} lbs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Bottom Accent */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-red-900/50 to-transparent" />
    </div>
  );
}