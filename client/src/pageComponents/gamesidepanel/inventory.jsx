// c:\Projects\client\src\pageComponents\gamesidepanel\inventory.jsx
import { Fragment, useContext, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Coins,
  Package,
  Search,
  Weight,
} from "lucide-react";
import { SocketContext } from "../../socket.io/context";

const FILTERS = ["All", "Weapons", "Armor", "Consumables", "Tools", "Misc"];

const SLOT_LIMITS = {
  innerhead: 1,
  outerhead: 2,
  face: 1,
  eyes: 2,
  innerbody: 2,
  outerbody: 1,
  innerlegs: 2,
  outerlegs: 1,
  innerfeet: 2,
  outerfeet: 2,
  arms: 2,
  hands: 2,
  fists: 2,
  wrist: 8,
  waist: 1,
  weapon: 10,
  fingers: 10,
  neck: 3,
  trinkets: 5,
  back: 1,
};

const SLOT_LABELS = {
  innerhead: "Inner Head",
  outerhead: "Outer Head",
  face: "Face",
  eyes: "Eyes",
  innerbody: "Inner Body",
  outerbody: "Outer Body",
  innerlegs: "Inner Legs",
  outerlegs: "Outer Legs",
  innerfeet: "Inner Feet",
  outerfeet: "Outer Feet",
  arms: "Arms",
  hands: "Hands",
  fists: "Fists",
  wrist: "Wrist",
  waist: "Waist",
  weapon: "Weapon",
  fingers: "Fingers",
  neck: "Neck",
  trinkets: "Trinkets",
  back: "Back",
};

const EQUIP_GROUPS = [
  { id: "head", label: "Head", slots: ["innerhead", "outerhead", "face", "eyes"] },
  { id: "torso", label: "Body", slots: ["innerbody", "outerbody", "neck", "back", "waist"] },
  { id: "arms", label: "Arms", slots: ["arms", "hands", "fists", "wrist"] },
  { id: "legs", label: "Legs", slots: ["innerlegs", "outerlegs"] },
  { id: "feet", label: "Feet", slots: ["innerfeet", "outerfeet"] },
];

const SORT_OPTIONS = [
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
  { value: "weight-desc", label: "Weight (High)" },
  { value: "weight-asc", label: "Weight (Low)" },
  { value: "rarity-desc", label: "Rarity (High)" },
  { value: "rarity-asc", label: "Rarity (Low)" },
];

const RARITY_RANK = {
  common: 1,
  uncommon: 2,
  rare: 3,
  "very rare": 4,
  legendary: 5,
  artifact: 6,
};

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value.$oid) return String(value.$oid);
  if (value._id) return toIdString(value._id);
  if (value.id) return String(value.id);
  return String(value);
};

const toTitleCase = (value) => {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const getItemTypeLabel = (item) => {
  const raw =
    item?.properties?.type ||
    item?.type ||
    item?.attributes?.[0] ||
    item?.category ||
    "Misc";
  return String(raw || "Misc");
};

const classifyType = (typeLabel) => {
  const type = String(typeLabel || "").toLowerCase();
  if (type.includes("weapon")) return "Weapons";
  if (type.includes("armor") || type.includes("shield")) return "Armor";
  if (type.includes("potion") || type.includes("scroll") || type.includes("consumable")) {
    return "Consumables";
  }
  if (type.includes("tool") || type.includes("kit") || type.includes("instrument")) return "Tools";
  return "Misc";
};

const formatPropertyValue = (value) => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, val]) => `${key}: ${val}`)
      .join(", ");
  }
  return String(value);
};

const getRarityRank = (value) => {
  const key = String(value || "common").toLowerCase();
  return RARITY_RANK[key] || 0;
};

export default function InventoryPanel({ character }) {
  const socket = useContext(SocketContext);
  const [dbItems, setDbItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortKey, setSortKey] = useState("name-asc");
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [equipTab, setEquipTab] = useState("overview");
  const [activeEquipGroup, setActiveEquipGroup] = useState("head");

  useEffect(() => {
    if (!socket) return;
    socket.emit(
      "database_query",
      { collection: "items", operation: "findAll" },
      (response) => {
        if (response?.success) {
          setDbItems(response.data || []);
        }
      }
    );
  }, [socket]);

  const itemLookup = useMemo(() => {
    const map = new Map();
    (dbItems || []).forEach((item) => {
      const mongoId = toIdString(item?._id);
      if (mongoId) map.set(mongoId, item);
      if (item?.itemId) map.set(String(item.itemId), item);
    });
    return map;
  }, [dbItems]);

  const equippedLookup = useMemo(() => {
    const map = new Map();
    (character?.equippedItems || []).forEach((item) => {
      const itemId = toIdString(item?._id || item?.id);
      if (itemId) map.set(itemId, item);
    });
    return map;
  }, [character]);

  const resolveEquipmentItem = useMemo(() => {
    return (ref) => {
      if (!ref) return null;
      if (typeof ref === "object") {
        const refId = toIdString(ref?._id || ref?.id);
        if (refId && itemLookup.has(refId)) return itemLookup.get(refId);
        if (refId && equippedLookup.has(refId)) return equippedLookup.get(refId);
        return ref;
      }
      const id = toIdString(ref);
      if (!id) return null;
      return itemLookup.get(id) || equippedLookup.get(id) || { _id: id, name: `Item ${id.slice(0, 6)}` };
    };
  }, [equippedLookup, itemLookup]);

  const hasInventoryMap = useMemo(() => {
    return Object.keys(character?.inv?.items || {}).length > 0;
  }, [character]);

  const equippedItems = useMemo(() => {
    if (Array.isArray(character?.equippedItems) && character.equippedItems.length > 0) {
      return character.equippedItems;
    }
    const equipment = character?.inv?.equipment;
    if (!equipment || typeof equipment !== "object") return [];
    const ids = Array.isArray(equipment)
      ? equipment
      : Object.values(equipment).flatMap((entry) => entry || []);

    return ids
      .map((id) => resolveEquipmentItem(id))
      .filter(Boolean);
  }, [character, resolveEquipmentItem]);

  const equipmentBySlot = useMemo(() => {
    const equipment = character?.inv?.equipment || {};
    const resolved = {};
    Object.keys(SLOT_LIMITS).forEach((slot) => {
      const raw = equipment?.[slot];
      const list = Array.isArray(raw)
        ? raw
        : raw
          ? [raw]
          : [];
      resolved[slot] = list.map((entry) => resolveEquipmentItem(entry)).filter(Boolean);
    });
    return resolved;
  }, [character, resolveEquipmentItem]);

  const inventoryItems = useMemo(() => {
    const items = [];
    const invItemsMap = character?.inv?.items || {};
    const entries = Object.entries(invItemsMap);

    if (entries.length > 0) {
      entries.forEach(([key, instance]) => {
        const itemId = toIdString(instance?.ItemID || instance?.itemId || instance?._id || instance?.id);
        const template = itemLookup.get(itemId);
        const typeLabel = getItemTypeLabel(template || instance);
        items.push({
          instanceId: toIdString(instance?._id) || String(key),
          itemId,
          name: template?.name || instance?.name || "Unknown Item",
          description: template?.description || instance?.description || "No description provided.",
          typeLabel,
          group: classifyType(typeLabel),
          rarity: template?.rarity || instance?.rarity || "common",
          weight: Number(template?.weight ?? instance?.weight ?? 0) || 0,
          quantity: Number(instance?.quantity ?? instance?.qty ?? 1) || 1,
          equipped: Boolean(instance?.equipped),
          properties: template?.properties || instance?.properties || {},
        });
      });
      return items;
    }

    const fallbackArray = Array.isArray(character?.inventory)
      ? character.inventory
      : Array.isArray(character?.equipment)
        ? character.equipment
        : [];

    fallbackArray.forEach((entry, index) => {
      const typeLabel = getItemTypeLabel(entry);
      items.push({
        instanceId: toIdString(entry?._id) || `fallback_${index + 1}`,
        itemId: toIdString(entry?._id || entry?.id),
        name: entry?.name || "Unknown Item",
        description: entry?.description || "No description provided.",
        typeLabel,
        group: classifyType(typeLabel),
        rarity: entry?.rarity || "common",
        weight: Number(entry?.weight ?? 0) || 0,
        quantity: Number(entry?.quantity ?? entry?.qty ?? 1) || 1,
        equipped: Boolean(entry?.equipped),
        properties: entry?.properties || {},
      });
    });

    return items;
  }, [character, itemLookup]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = inventoryItems.filter((item) => {
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.typeLabel.toLowerCase().includes(term) ||
        item.rarity.toLowerCase().includes(term);
      const matchesFilter = filter === "All" || item.group === filter;
      return matchesSearch && matchesFilter;
    });

    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "weight-desc":
          return b.weight - a.weight;
        case "weight-asc":
          return a.weight - b.weight;
        case "rarity-desc":
          return getRarityRank(b.rarity) - getRarityRank(a.rarity);
        case "rarity-asc":
          return getRarityRank(a.rarity) - getRarityRank(b.rarity);
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return list;
  }, [inventoryItems, searchTerm, filter, sortKey]);

  useEffect(() => {
    if (!expandedItemId) return;
    const stillVisible = filteredItems.some((item) => item.instanceId === expandedItemId);
    if (!stillVisible) setExpandedItemId(null);
  }, [expandedItemId, filteredItems]);

  const selectedIndex = expandedItemId
    ? filteredItems.findIndex((item) => item.instanceId === expandedItemId)
    : -1;

  const gridRows = [];
  const columns = 3;
  for (let i = 0; i < filteredItems.length; i += columns) {
    const rowItems = filteredItems.slice(i, i + columns);
    const rowHasSelected = selectedIndex >= i && selectedIndex < i + columns;
    gridRows.push({ start: i, items: rowItems, expanded: rowHasSelected });
  }

  const inventoryWeight = useMemo(() => {
    return inventoryItems.reduce((sum, item) => sum + item.weight * item.quantity, 0);
  }, [inventoryItems]);

  const equippedWeight = useMemo(() => {
    if (hasInventoryMap) return 0;
    return equippedItems.reduce((sum, item) => sum + (Number(item?.weight) || 0), 0);
  }, [equippedItems, hasInventoryMap]);

  const currentWeight = inventoryWeight + equippedWeight;

  const carryCapacity = character?.carryCapacity || {};
  const strScoreFallback = Number(
    character?.stats?.STR?.score ??
      character?.stats?.STR ??
      character?.stats?.str ??
      10
  );
  const baseFromStats = Math.max(0, (Number.isFinite(strScoreFallback) ? strScoreFallback : 10) * 25);
  const restrictedFromStats = Math.max(0, (Number.isFinite(strScoreFallback) ? strScoreFallback : 10) * 50);

  const rawUnrestricted = Number(carryCapacity.unrestricted ?? carryCapacity.max ?? 0);
  const rawRestricted = Number(carryCapacity.restricted ?? carryCapacity.maxRestricted ?? 0);
  const maxUnrestricted = rawUnrestricted > 0 ? rawUnrestricted : baseFromStats;
  const maxRestricted =
    rawRestricted > 0 ? rawRestricted : Math.max(maxUnrestricted, restrictedFromStats);

  const ratio = maxUnrestricted > 0 ? currentWeight / maxUnrestricted : 0;
  const weightTone =
    ratio >= 0.9
      ? "text-red-200 border-red-500/40 bg-red-500/10"
      : ratio >= 0.75
        ? "text-orange-200 border-orange-500/40 bg-orange-500/10"
        : "text-yellow-200 border-yellow-500/40 bg-yellow-500/10";
  const barTone =
    ratio >= 0.9 ? "bg-red-500" : ratio >= 0.75 ? "bg-orange-500" : "bg-yellow-500";

  const gold = Number(character?.inv?.gp ?? character?.gold ?? 0) || 0;

  const renderSlotTiles = (slots) => {
    return slots.map((slotKey) => {
      const items = equipmentBySlot?.[slotKey] || [];
      const totalSlots = Math.max(SLOT_LIMITS[slotKey] || 1, items.length);
      return (
        <div key={slotKey} className="rounded-lg border border-slate-700/80 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase text-slate-400 font-semibold">
              {SLOT_LABELS[slotKey] || toTitleCase(slotKey)}
            </div>
            <div className="text-[10px] text-slate-500">
              {items.length}/{totalSlots}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {Array.from({ length: totalSlots }).map((_, index) => {
              const item = items[index];
              return (
                <div
                  key={`${slotKey}_${index}`}
                  className={`rounded-md border px-2 py-1 text-[10px] ${
                    item
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                      : "border-slate-700 bg-slate-950/40 text-slate-500"
                  }`}
                  title={item?.name || "Empty"}
                >
                  {item?.name ? item.name : "Empty"}
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  };

  const renderGroupButton = (group) => {
    if (!group) return null;
    const filled = group.slots.reduce(
      (sum, slot) => sum + (equipmentBySlot?.[slot]?.length || 0),
      0
    );
    const total = group.slots.reduce((sum, slot) => sum + (SLOT_LIMITS[slot] || 0), 0);
    const isActive = activeEquipGroup === group.id;
    return (
      <button
        type="button"
        onClick={() => setActiveEquipGroup(group.id)}
        className={`w-full rounded-md border-2 px-2 py-3 text-left ${
          isActive
            ? "border-slate-300 bg-slate-700/70"
            : "border-slate-700 bg-slate-900/70"
        }`}
      >
        <div className="text-[10px] uppercase text-slate-300">{group.label}</div>
        <div className="text-[10px] text-slate-400">
          {filled}/{total}
        </div>
      </button>
    );
  };

  if (!character) {
    return <div className="p-6 text-center text-slate-400 text-sm">No character selected.</div>;
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto scrollbar-transparent px-4 py-4 space-y-4">
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Package size={18} /> Inventory
          </h3>
          <div className="text-[10px] text-slate-400 uppercase">
            Slots: {filteredItems.length}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-700/80 bg-slate-800/60 p-3">
            <div className="text-[10px] uppercase text-slate-400 font-semibold">Gold</div>
            <div className="mt-2 flex items-center gap-2 text-yellow-200">
              <Coins size={16} />
              <span className="text-sm font-semibold">{gold} gp</span>
            </div>
          </div>
          <div className="col-span-2 rounded-lg border border-slate-700/80 bg-slate-800/60 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Carry Weight</div>
              <div className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${weightTone}`}>
                {currentWeight.toFixed(1)} / {maxUnrestricted.toFixed(0)} lb
              </div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-700 overflow-hidden">
              <div
                className={`h-full ${barTone}`}
                style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
              />
            </div>
            <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-2">
              <Weight size={12} /> Restricted max: {maxRestricted.toFixed(0)} lb
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-700/80 bg-slate-800/60 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] uppercase text-slate-400 font-semibold">Equipped</div>
            <div className="flex items-center gap-2 text-[10px]">
              {["overview", "trinkets", "weapons"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setEquipTab(tab)}
                  className={`rounded-full border px-2 py-1 font-semibold uppercase ${
                    equipTab === tab
                      ? "border-slate-500 bg-slate-700/70 text-white"
                      : "border-slate-700 bg-slate-900/60 text-slate-400"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {equipTab === "overview" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr]">
              <div className="rounded-lg border border-slate-700/80 bg-slate-950/40 p-3">
                <div className="grid grid-cols-3 grid-rows-4 gap-2 place-items-center">
                  <div className="col-start-2 row-start-1 w-full">
                    {renderGroupButton(EQUIP_GROUPS.find((entry) => entry.id === "head"))}
                  </div>
                  <div className="col-start-1 row-start-2 w-full">
                    {renderGroupButton(EQUIP_GROUPS.find((entry) => entry.id === "arms"))}
                  </div>
                  <div className="col-start-2 row-start-2 w-full">
                    {renderGroupButton(EQUIP_GROUPS.find((entry) => entry.id === "torso"))}
                  </div>
                  <div className="col-start-2 row-start-3 w-full">
                    {renderGroupButton(EQUIP_GROUPS.find((entry) => entry.id === "legs"))}
                  </div>
                  <div className="col-start-2 row-start-4 w-full">
                    {renderGroupButton(EQUIP_GROUPS.find((entry) => entry.id === "feet"))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] uppercase text-slate-400 font-semibold">
                  {toTitleCase(activeEquipGroup)} Slots
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {renderSlotTiles(
                    (EQUIP_GROUPS.find((entry) => entry.id === activeEquipGroup)?.slots || [])
                  )}
                </div>
              </div>
            </div>
          )}

          {equipTab === "trinkets" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {renderSlotTiles(["trinkets", "fingers"])}
            </div>
          )}

          {equipTab === "weapons" && (
            <div className="grid grid-cols-1 gap-3">
              {renderSlotTiles(["weapon"])}
            </div>
          )}

          {equippedItems.length === 0 && equipTab === "overview" && (
            <div className="text-xs text-slate-500 italic">Nothing equipped.</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-slate-500"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2">
            <ArrowUpDown size={14} className="text-slate-400" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="bg-transparent text-[11px] text-slate-200 outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-slate-900">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setFilter(label)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                filter === label
                  ? "border-slate-500 bg-slate-700/60 text-white"
                  : "border-slate-700 bg-slate-900/40 text-slate-400 hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filteredItems.length === 0 ? (
          <p className="text-sm text-slate-500 text-center italic">Backpack is empty.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {gridRows.map((row) => {
              const expandedItem = row.expanded
                ? row.items.find((item) => item.instanceId === expandedItemId)
                : null;
              return (
                <Fragment key={`row_${row.start}`}>
                  {row.items.map((item) => (
                    <button
                      key={item.instanceId}
                      type="button"
                      onClick={() =>
                        setExpandedItemId((prev) =>
                          prev === item.instanceId ? null : item.instanceId
                        )
                      }
                      className={`text-left rounded-lg border p-3 transition ${
                        expandedItemId === item.instanceId
                          ? "border-slate-500 bg-slate-800/80"
                          : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {item.name}
                          </div>
                          <div className="text-[10px] uppercase text-slate-400">
                            {item.typeLabel}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.weight} lb
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                          {item.rarity}
                        </span>
                        {item.equipped && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                            Equipped
                          </span>
                        )}
                        {item.quantity > 1 && (
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                            x{item.quantity}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                  {row.expanded && expandedItem && (
                    <div className="col-span-3 rounded-lg border border-slate-700 bg-slate-900/70 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-base font-semibold text-white">
                            {expandedItem.name}
                          </div>
                          <div className="text-[11px] uppercase text-slate-400">
                            {expandedItem.typeLabel} - {expandedItem.rarity}
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {expandedItem.weight} lb
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">
                        {expandedItem.description}
                      </p>
                      {Object.keys(expandedItem.properties || {}).length > 0 ? (
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          {Object.entries(expandedItem.properties || {})
                            .map(([key, value]) => [key, formatPropertyValue(value)])
                            .filter(([, value]) => value)
                            .slice(0, 9)
                            .map(([key, value]) => (
                              <div
                                key={key}
                                className="rounded-lg border border-slate-700 bg-slate-800/60 p-2"
                              >
                                <div className="text-[9px] uppercase text-slate-400">
                                  {key}
                                </div>
                                <div className="text-[11px] text-slate-200">{value}</div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-xs text-slate-500 italic">
                          No additional properties listed.
                        </div>
                      )}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
