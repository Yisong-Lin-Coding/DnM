import React, { useState } from 'react';

export default function EquipmentViewer({ equipment, gp }) {
  const [activeTab, setActiveTab] = useState('armor');
  const [expandedSlot, setExpandedSlot] = useState(null);

  const equipmentGroups = {
    armor: [
      { key: "head", label: "Head" },
      { key: "body", label: "Chest" },
      { key: "back", label: "Back" },
      { key: "arms", label: "Arms" },
      { key: "hands", label: "Hands" },
      { key: "legs", label: "Legs" },
      { key: "feet", label: "Feet" },
    ],
    weapons: [
      { key: "weapon", label: "Main Hand" },
      { key: "fists", label: "Off-Hand" },
    ],
    accessories: [
      { key: "neck", label: "Neck" },
      { key: "waist", label: "Waist" },
      { key: "fingers", label: "Rings" },
      { key: "trinkets", label: "Trinkets" },
      { key: "face", label: "Face" },
      { key: "eyes", label: "Eyes" },
    ]
  };

  const Slot = ({ slotKey, label }) => {
    const items = equipment?.[slotKey] || [];
    const hasItems = items.length > 0;
    const isExpanded = expandedSlot === slotKey;

    return (
      <div className="flex flex-col items-center relative">
        {/* Main Slot Button */}
        <button 
          onClick={() => setExpandedSlot(isExpanded ? null : slotKey)}
          className={`w-14 h-14 rounded-lg border-2 flex flex-col items-center justify-center transition-all relative
            ${hasItems 
              ? 'bg-red-900/30 border-red-600 shadow-[0_0_10px_rgba(220,38,38,0.3)]' 
              : 'bg-black/40 border-white/10 hover:border-white/30'}`}
        >
          {hasItems ? (
            <>
              <span className="text-[9px] text-white font-black truncate px-1 w-full leading-tight">
                {items[0].name}
              </span>
              {items.length > 1 && (
                <div className="absolute -top-1 -right-1 bg-red-600 text-[8px] font-bold px-1 rounded-sm border border-white/20">
                  +{items.length - 1}
                </div>
              )}
            </>
          ) : (
            <span className="text-[8px] text-gray-700 font-black uppercase tracking-tighter">Empty</span>
          )}
        </button>
        <span className="text-[9px] mt-1 text-gray-500 font-bold uppercase tracking-tighter">{label}</span>

        {/* Expanded Items Overlay */}
        {isExpanded && (
          <div className="absolute top-16 z-50 bg-[#1a1a1a] border border-red-900 rounded-md shadow-2xl p-2 min-w-[120px] max-h-[200px] overflow-y-auto ring-4 ring-black/50">
            <div className="text-[8px] text-red-500 font-black uppercase mb-2 border-b border-red-900/30">Equipped {label}</div>
            {hasItems ? (
              <div className="space-y-1">
                {items.map((item, idx) => (
                  <div key={idx} className="text-[10px] text-gray-200 bg-black/40 p-1.5 rounded border border-white/5 hover:bg-red-950/30 transition-colors">
                    {item.name || "Unknown Item"}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-gray-600 italic">No {label} equipped.</div>
            )}
            <button 
              onClick={() => setExpandedSlot(null)}
              className="w-full mt-2 text-[8px] text-gray-500 hover:text-white uppercase font-bold py-1 border-t border-white/5"
            >
              Close
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-website-default-800/90 p-4 rounded-xl border border-white/10 shadow-2xl backdrop-blur-md">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xs font-black text-red-600 uppercase italic tracking-widest underline decoration-red-900/50 underline-offset-4">Equipment</h3>
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-black/60 rounded-full border border-amber-900/50">
            <span className="text-amber-500 text-xs font-bold tracking-tighter">{gp || 0} GP</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="grid grid-cols-3 gap-1 mb-8 bg-black/60 p-1 rounded-lg border border-white/5">
        {Object.keys(equipmentGroups).map((group) => (
          <button
            key={group}
            onClick={() => { setActiveTab(group); setExpandedSlot(null); }}
            className={`py-1.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-md
              ${activeTab === group ? 'bg-red-900 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {group}
          </button>
        ))}
      </div>

      <div className="min-h-[380px] flex items-center justify-center">
        {activeTab === 'armor' && (
          <div className="grid grid-cols-3 gap-y-6 gap-x-12 place-items-center">
            <div className="col-start-2"><Slot slotKey="head" label="Head" /></div>
            <div className="col-start-1 row-start-2"><Slot slotKey="back" label="Back" /></div>
            <div className="col-start-2 row-start-2"><Slot slotKey="body" label="Chest" /></div>
            <div className="col-start-3 row-start-2"><Slot slotKey="arms" label="Arms" /></div>
            <div className="col-start-1 row-start-3"><Slot slotKey="hands" label="Hands" /></div>
            <div className="col-start-2 row-start-3"><Slot slotKey="legs" label="Legs" /></div>
            <div className="col-start-3 row-start-3"><Slot slotKey="feet" label="Feet" /></div>
          </div>
        )}

        {activeTab === 'weapons' && (
          <div className="flex gap-12">
            <Slot slotKey="weapon" label="Main Hand" />
            <Slot slotKey="fists" label="Off-Hand" />
          </div>
        )}

        {activeTab === 'accessories' && (
          <div className="grid grid-cols-2 gap-y-8 gap-x-16">
            <Slot slotKey="neck" label="Necklace" />
            <Slot slotKey="waist" label="Belt" />
            <Slot slotKey="fingers" label="Rings" />
            <Slot slotKey="trinkets" label="Trinkets" />
            <Slot slotKey="face" label="Face" />
            <Slot slotKey="eyes" label="Eyes" />
          </div>
        )}
      </div>
    </div>
  );
}