import React from 'react';

const toTagArray = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))];
  }
  if (typeof value === 'string') {
    return [...new Set(
      value
        .split(/[\n,]/g)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )];
  }
  return [];
};

const toTitleCase = (value) => {
  if (!value) return '';
  return String(value)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
};

const resolveColorValue = (customization, baseKey, customKey) => {
  const baseValue = String(customization?.[baseKey] || '').trim();
  const customValue = String(customization?.[customKey] || '').trim();

  if (!baseValue) return '';
  if (baseValue === 'other' && customValue) return customValue;
  return baseValue;
};

export default function AppearanceCard({ character }) {
  if (!character) return null;

  const { gender, alignment, customization, model, age } = character;
  const additionalTraits = toTagArray(customization?.additionalTraits);
  const colorEntries = [
    { key: 'skin', label: 'Skin', value: resolveColorValue(customization, 'skinColor', 'skinColorCustom') },
    { key: 'eyes', label: 'Eyes', value: resolveColorValue(customization, 'eyeColor', 'eyeColorCustom') },
    { key: 'hair', label: 'Hair', value: resolveColorValue(customization, 'hairColor', 'hairColorCustom') }
  ];

  return (
    <div className="bg-website-default-800/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      <div className="p-4 bg-black/40 border-b border-white/5 flex justify-between items-center">
        <h3 className="text-xs font-black text-red-600 uppercase italic tracking-widest underline decoration-red-900/50 underline-offset-4">
          Appearance
        </h3>
        <span className="text-[10px] text-gray-600 font-black uppercase tracking-tighter">
          {model?.size || 'Medium'} Size
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col text-left">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">Gender</span>
            <span className="text-sm font-bold text-gray-200">{gender || '-'}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">Alignment</span>
            <span className="text-sm font-bold text-emerald-500 italic uppercase tracking-tighter">{alignment || '-'}</span>
          </div>
        </div>

        <div className="h-px bg-white/5 w-full" />

        <div className="grid grid-cols-3 gap-2 py-1">
          {colorEntries.map(({ key, label, value }) => {
            const isHex = /^#[0-9a-fA-F]{6}$/.test(value || '');
            return (
              <div key={key} className="bg-black/20 p-2 rounded border border-white/5 text-center group hover:border-red-900/30 transition-colors">
                <span className="block text-[8px] font-black text-gray-500 uppercase">{label}</span>
                <div className="flex items-center justify-center gap-1 mt-1">
                  {value && (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full border border-white/20"
                      style={isHex ? { backgroundColor: value } : undefined}
                    />
                  )}
                  <span className="text-xs font-bold text-gray-300 capitalize">
                    {value ? (isHex ? value : toTitleCase(value)) : '-'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-px bg-white/5 w-full" />

        <div className="bg-black/40 p-3 rounded-lg border border-red-900/20 shadow-inner">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col text-left border-r border-white/5">
              <span className="text-[8px] font-black text-gray-600 uppercase">Age</span>
              <span className="text-xs font-bold text-white tracking-tight">
                {age?.years || '-'} Years
              </span>
            </div>
            <div className="flex flex-col text-center border-r border-white/5">
              <span className="text-[8px] font-black text-gray-600 uppercase">Height</span>
              <span className="text-xs font-bold text-white">{model?.height || '-'}"</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[8px] font-black text-gray-600 uppercase">Weight</span>
              <span className="text-xs font-bold text-white">{model?.weight || '-'} lbs</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-white/5 w-full" />

        <div className="space-y-2">
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">Additional Traits</span>
          <div className="flex flex-wrap gap-1">
            {additionalTraits.length === 0 && (
              <span className="text-[10px] text-gray-600 italic">None set</span>
            )}
            {additionalTraits.map((tag) => (
              <span key={tag} className="text-[11px] bg-black/40 border border-white/5 px-2 py-0.5 rounded text-gray-300 italic">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="h-1 w-full bg-gradient-to-r from-transparent via-red-900/50 to-transparent" />
    </div>
  );
}
