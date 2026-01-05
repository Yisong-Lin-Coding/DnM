import React, { useState } from 'react';

export default function InventoryBox({ inventory, characterWeight = 0 }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("All");

  // In your schema, 'inv' contains gp and equipment. 
  // Assuming 'items' or 'misc' exists for non-equipped loot.
  // If your schema adds an 'items' array later, this maps to it.
  const allItems = inventory?.items || []; 

  const filteredItems = allItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === "All" || item.type === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="bg-website-default-800/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md flex flex-col h-[500px]">
      {/* Header with Search */}
      <div className="p-4 bg-black/40 border-b border-white/5 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-black text-red-600 uppercase italic tracking-widest">Carried Items</h3>
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
            Weight: <span className="text-gray-300">{characterWeight} / 150 lbs</span>
          </span>
        </div>
        
        <div className="relative">
          <input 
            type="text"
            placeholder="Search inventory..."
            className="w-full bg-black/60 border border-white/10 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-900 transition-colors"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute right-3 top-1.5 opacity-30 text-xs">🔍</span>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex border-b border-white/5 bg-black/20 overflow-x-auto no-scrollbar">
        {["All", "Consumables", "Tools", "Materials", "Quest"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-colors
              ${filter === cat ? 'text-red-500 border-b-2 border-red-600 bg-red-900/10' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Item List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {filteredItems.length > 0 ? (
          filteredItems.map((item, idx) => (
            <div 
              key={idx} 
              className="group flex items-center justify-between p-2 bg-black/20 border border-white/5 rounded hover:bg-red-900/10 hover:border-red-900/30 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black/40 border border-white/10 rounded flex items-center justify-center text-lg">
                  {/* Icon logic based on type */}
                  {item.type === "Consumable" ? "🧪" : "📦"}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-200 group-hover:text-white">{item.name}</span>
                  <span className="text-[9px] text-gray-500 uppercase font-black tracking-tighter">{item.type}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {item.quantity > 1 && (
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-gray-400 font-bold">
                    x{item.quantity}
                  </span>
                )}
                <span className="text-[10px] text-gray-600 font-bold w-12 text-right">
                  {item.weight} lbs
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
            <span className="text-4xl mb-2">🎒</span>
            <p className="text-[10px] font-black uppercase tracking-widest">Inventory is Empty</p>
          </div>
        )}
      </div>

      {/* Footer / Quick Actions */}
      <div className="p-2 bg-black/40 border-t border-white/5 flex justify-end gap-2">
         <button className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-400">
           Sort By
         </button>
         <button className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50">
           Manage
         </button>
      </div>
    </div>
  );
}