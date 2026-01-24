import React, { useState, useEffect, useContext, useMemo } from 'react';
import { CircleUser, X, Shield, Sword, Box, Info } from 'lucide-react';
import { SocketContext } from "../../../socket.io/context";

export default function InventoryBox({ inventory, characterWeight = 0 }) {
    const socket = useContext(SocketContext);
    const [searchTerm, setSearchTerm] = useState("");
    const [filter, setFilter] = useState("All");
    const [dbItems, setDbItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null); // State for the pop-up

    useEffect(() => {
        if (!socket) return;
        socket.emit('database_query', {
            collection: 'items',
            operation: 'findAll',
        }, (response) => {
            if (response.success) {
                setDbItems(response.data);
            }
        });
    }, [socket]);

    const allItems = useMemo(() => {
        const invItemsMap = inventory?.inv?.items || inventory?.items || {};
        const keys = Object.keys(invItemsMap);

        return keys.map(key => {
            const instance = invItemsMap[key];
            const charItemID = (instance.ItemID?.$oid || instance.ItemID || "").toString();

            const template = dbItems.find(dbItem => 
                (dbItem._id?.$oid || dbItem._id || "").toString() === charItemID || dbItem.itemId === charItemID
            );

            return {
                instanceId: (instance._id?.$oid || instance._id || key).toString(),
                equipped: instance.equipped,
                name: template?.name || "Unknown Item",
                description: template?.description || "No description provided.",
                // Correctly parsing nested properties
                type: template?.properties?.type || template?.attributes?.[0] || "Misc",
                weight: template?.weight || 0,
                rarity: template?.rarity || "common",
                properties: template?.properties || {}, // Pass raw properties for the modal
                icon: template?.properties?.type === "Weapon" ? "⚔️" : "📦"
            };
        });
    }, [inventory, dbItems]);

    const filteredItems = allItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === "All" || 
            (filter === "Weapons" && item.type.toLowerCase() === "weapon") || 
            (filter === "Misc" && item.type.toLowerCase() !== "weapon");
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="relative bg-website-default-800/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md flex flex-col h-[500px]">
            {/* Header & Search */}
            <div className="p-4 bg-black/40 border-b border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-red-600 uppercase italic tracking-widest">Carried Items</h3>
                    <span className="text-[10px] text-gray-500 font-bold">Slots: {allItems.length}</span>
                </div>
                <input 
                    type="text"
                    placeholder="Search..."
                    className="w-full bg-black/60 border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-red-500/50"
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Filter Tabs */}
            <div className="flex border-b border-white/5 bg-black/20">
                {["All", "Weapons", "Misc"].map((cat) => (
                    <button key={cat} onClick={() => setFilter(cat)} className={`px-4 py-2 text-[9px] font-black uppercase transition-colors ${filter === cat ? 'text-red-500 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-300'}`}>
                        {cat}
                    </button>
                ))}
            </div>

            {/* Item List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredItems.map((item) => (
                    <div 
                        key={item.instanceId} 
                        onClick={() => setSelectedItem(item)}
                        className="flex items-center justify-between p-2 bg-black/20 border border-white/5 rounded cursor-pointer hover:bg-white/5 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-black/40 border border-white/10 rounded flex items-center justify-center group-hover:border-red-500/50">{item.icon}</div>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-200">{item.name}</span>
                                <span className="text-[9px] text-gray-500 uppercase">{item.type}</span>
                            </div>
                        </div>
                        <div className="text-[10px] text-gray-600 font-bold">{item.weight} lbs</div>
                    </div>
                ))}
            </div>

            {/* ITEM DETAIL POPUP (MODAL) */}
            {selectedItem && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-xs bg-website-default-900 border border-red-900/50 rounded-lg shadow-2xl flex flex-col max-h-[90%]">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-3 border-b border-white/10 bg-black/40">
                            <h4 className="text-[10px] font-black text-red-500 uppercase italic">Item Inspection</h4>
                            <button onClick={() => setSelectedItem(null)} className="text-gray-500 hover:text-white"><X size={14} /></button>
                        </div>

                        <div className="p-4 overflow-y-auto space-y-4">
                            {/* Item Title */}
                            <div className="text-center">
                                <div className="text-2xl mb-2">{selectedItem.icon}</div>
                                <h2 className="text-sm font-bold text-white uppercase tracking-tight">{selectedItem.name}</h2>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${selectedItem.rarity === 'rare' ? 'bg-blue-900/40 text-blue-400' : 'bg-gray-800 text-gray-400'}`}>
                                    {selectedItem.rarity}
                                </span>
                            </div>

                            {/* Description */}
                            <p className="text-[11px] text-gray-400 leading-relaxed bg-black/20 p-2 rounded border border-white/5 italic">
                                "{selectedItem.description}"
                            </p>

                            {/* Dynamic Properties (Damage, etc.) */}
                            {selectedItem.properties?.damage && (
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(selectedItem.properties.damage).map(([key, val]) => (
                                        <div key={key} className="bg-black/40 p-2 rounded border border-white/5 text-center">
                                            <div className="text-[8px] uppercase text-gray-500">{key}</div>
                                            <div className="text-xs font-bold text-red-400">{val}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* USE BUTTONS */}
                            {/* USE BUTTONS */}
<div className="space-y-2">
    <span className="text-[9px] font-black text-gray-500 uppercase">Actions</span>
    <div className="grid grid-cols-1 gap-1.5">
        {Array.isArray(selectedItem.properties?.uses) ? (
            // If it's an array, map it
            selectedItem.properties.uses.map((use) => (
                <button 
                    key={use}
                    className="w-full py-2 bg-red-900/20 border border-red-700/50 rounded text-[10px] font-black text-red-400 uppercase hover:bg-red-700 hover:text-white transition-all"
                    onClick={() => console.log(`Action: ${use} on ${selectedItem.name}`)}
                >
                    {use}
                </button>
            ))
        ) : selectedItem.properties?.uses && typeof selectedItem.properties.uses === 'string' ? (
            // If it's just a single string, show one button
            <button 
                className="w-full py-2 bg-red-900/20 border border-red-700/50 rounded text-[10px] font-black text-red-400 uppercase hover:bg-red-700 hover:text-white transition-all"
                onClick={() => console.log(`Action: ${selectedItem.properties.uses}`)}
            >
                {selectedItem.properties.uses}
            </button>
        ) : (
            // Fallback if it's missing or an invalid type
            <div className="text-[10px] text-gray-600 italic py-2 text-center border border-dashed border-white/10 rounded">
                No special actions
            </div>
        )}
    </div>
</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}