import Body from "../../pageComponents/bodySkeleton";
import { SocketContext } from "../../socket.io/context";
import { useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Equipment from "./characterViewerPages/equipment";
import InventoryBox from "./characterViewerPages/inventory";
import EffectsTab from "./characterViewerPages/effects";
import ActionsTab from "./characterViewerPages/actions";
import ProfileCard from "./characterViewerPages/level";
import StoryBox from "./characterViewerPages/storyBox";
import AppearanceCard from "./characterViewerPages/appearance";
import AttributesCard from "./characterViewerPages/attributes";
import VitalsCard from "./characterViewerPages/vitals";

const STAT_KEYS = ["STR", "DEX", "CON", "INT", "WIS", "CHA", "LUCK"];
const EMPTY_RESOURCE = { current: 0, max: 0, temp: 0 };
const EMPTY_SURVIVAL_RESOURCE = { current: 0, max: 0 };

const EQUIPMENT_SLOT_ALIASES = {
  head: ["head", "innerhead", "outerhead"],
  body: ["body", "innerbody", "outerbody"],
  back: ["back"],
  arms: ["arms"],
  hands: ["hands"],
  legs: ["legs", "innerlegs", "outerlegs"],
  feet: ["feet", "innerfeet", "outerfeet"],
  weapon: ["weapon"],
  fists: ["fists"],
  neck: ["neck"],
  waist: ["waist"],
  fingers: ["fingers"],
  trinkets: ["trinkets"],
  face: ["face"],
  eyes: ["eyes"],
};

const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (value.$oid) return String(value.$oid);
    if (value._id?.$oid) return String(value._id.$oid);
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
    if (typeof value.toString === "function") return value.toString();
  }
  return String(value);
};

const normalizeResource = (rawResource, builtResource, builtBaseResource) => {
  const source = builtResource || builtBaseResource || rawResource || EMPTY_RESOURCE;
  return {
    current: toFiniteNumber(source.current, 0),
    max: toFiniteNumber(source.max, 0),
    temp: toFiniteNumber(source.temp, 0),
  };
};

const normalizeStats = (rawStats = {}, builtStats = {}, builtBaseStats = {}) => {
  const normalized = {};

  STAT_KEYS.forEach((key) => {
    const rawValue = rawStats?.[key];
    const builtValue = builtStats?.[key];

    const totalFromBuilt =
      typeof builtValue === "object"
        ? builtValue?.total ?? builtValue?.score ?? builtValue?.value
        : builtValue;
    const totalFromRaw =
      typeof rawValue === "object"
        ? rawValue?.total ?? rawValue?.score ?? rawValue?.value
        : rawValue;
    const total = toFiniteNumber(totalFromBuilt, toFiniteNumber(totalFromRaw, 0));

    const base = toFiniteNumber(
      builtValue?.permMods?.base ??
        builtBaseStats?.[key] ??
        rawValue?.permMods?.base ??
        total,
      total
    );

    normalized[key] = {
      ...(typeof rawValue === "object" ? rawValue : {}),
      ...(typeof builtValue === "object" ? builtValue : {}),
      total,
      permMods: {
        ...(rawValue?.permMods || {}),
        ...(builtValue?.permMods || {}),
        base,
      },
    };
  });

  return normalized;
};

const normalizeEquipment = (rawEquipment = {}, builtEquippedItems = []) => {
  const itemById = new Map();
  (builtEquippedItems || []).forEach((item) => {
    const itemId = toIdString(item?._id || item?.id);
    if (itemId) itemById.set(itemId, item);
  });

  const normalized = {};
  Object.entries(EQUIPMENT_SLOT_ALIASES).forEach(([slot, sourceSlots]) => {
    const slotItems = sourceSlots.flatMap((sourceSlot) => rawEquipment?.[sourceSlot] || []);
    normalized[slot] = slotItems
      .map((itemRef) => {
        const itemId = toIdString(itemRef);
        const resolved = itemById.get(itemId);
        if (resolved) return resolved;
        if (!itemId) return null;
        return {
          id: itemId,
          _id: itemId,
          name: `Item ${itemId.slice(0, 8)}`,
        };
      })
      .filter(Boolean);
  });

  return normalized;
};

const normalizeActionType = (rawType) => {
  const normalized = String(rawType || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  switch (normalized) {
    case "bonus":
    case "bonusaction":
      return "bonusAction";
    case "reaction":
      return "reaction";
    case "move":
    case "movement":
      return "movement";
    case "free":
    case "freeaction":
      return "free";
    case "passive":
      return "passive";
    case "special":
      return "special";
    default:
      return "action";
  }
};

const toActionId = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeActionEntries = (input) => {
  if (Array.isArray(input)) return input;
  if (typeof input === "string") return [input];
  if (input && typeof input === "object") {
    return Object.entries(input).map(([name, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return { ...value, name: value.name || name };
      }
      if (typeof value === "string") {
        return { name, description: value };
      }
      return { name };
    });
  }
  return [];
};

const normalizeActions = (rawActions, builtActions) => {
  const merged = [
    ...normalizeActionEntries(rawActions),
    ...normalizeActionEntries(builtActions),
  ];

  const dedupe = new Set();
  const normalized = [];

  merged.forEach((action, index) => {
    const source =
      typeof action === "string"
        ? { name: action, source: "custom" }
        : action && typeof action === "object"
          ? action
          : null;
    if (!source) return;

    const name = String(source.name || source.label || source.title || "").trim();
    if (!name) return;

    const normalizedAction = {
      id: String(source.id || toActionId(name) || `action_${index + 1}`),
      name,
      actionType: normalizeActionType(source.actionType || source.type),
      source: String(source.source || source.sourceType || "custom"),
      sourceId: String(source.sourceId || ""),
      description: String(source.description || ""),
      cost: String(source.cost || ""),
      requirements: Array.isArray(source.requirements)
        ? source.requirements.map((entry) => String(entry).trim()).filter(Boolean)
        : [],
      enabled: source.enabled !== false,
    };

    const dedupeKey = `${normalizedAction.id}|${normalizedAction.actionType}|${normalizedAction.source}`.toLowerCase();
    if (dedupe.has(dedupeKey)) return;

    dedupe.add(dedupeKey);
    normalized.push(normalizedAction);
  });

  return normalized;
};

const mergeCharacterForViewer = (rawCharacter, builtCharacter) => {
  const raw = rawCharacter || {};
  const built = builtCharacter || {};
  const rawInventory = raw.inv || {};

  return {
    ...raw,
    ...built,
    _id: raw._id || built._id || built.id,
    id: String(built.id || raw.id || raw._id || ""),
    race: built.race || raw.race,
    classType: built.classType || raw.classType,
    subclass: built.subclassType?.name || raw.subclass,
    stats: normalizeStats(raw.stats, built.stats, built._baseStats),
    HP: normalizeResource(raw.HP, built.HP, built._baseHP),
    MP: normalizeResource(raw.MP, built.MP, built._baseMP),
    STA: normalizeResource(raw.STA, built.STA, built._baseSTA),
    water: raw.water || EMPTY_SURVIVAL_RESOURCE,
    food: raw.food || EMPTY_SURVIVAL_RESOURCE,
    effects: raw.effects || built.statusEffects || [],
    actions: normalizeActions(raw.actions, built.actions),
    inv: {
      ...rawInventory,
      gp: toFiniteNumber(rawInventory.gp, 0),
      items: rawInventory.items || {},
      equipment: normalizeEquipment(rawInventory.equipment || {}, built.equippedItems || []),
    },
  };
};

export default function CharacterViewer() {
  const socket = useContext(SocketContext);
  const { characterID } = useParams();
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!socket || !characterID) {
      setLoading(false);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError(null);

    const fetchBuiltCharacter = () =>
      new Promise((resolve) => {
        socket.emit("character_builder", { characterID }, resolve);
      });

    const fetchRawCharacter = () =>
      new Promise((resolve) => {
        socket.emit(
          "database_query",
          {
            collection: "characters",
            operation: "findById",
            filter: { _id: characterID },
          },
          resolve
        );
      });

    (async () => {
      try {
        const [builtResponse, rawResponse] = await Promise.all([
          fetchBuiltCharacter(),
          fetchRawCharacter(),
        ]);

        const builtCharacter = builtResponse?.success ? builtResponse.character : null;
        const rawCharacter = rawResponse?.success ? rawResponse.data : null;

        if (!builtCharacter && !rawCharacter) {
          throw new Error(
            builtResponse?.message ||
              rawResponse?.message ||
              "Failed to load character"
          );
        }

        if (!isCancelled) {
          setCharacter(mergeCharacterForViewer(rawCharacter, builtCharacter));
          setError(null);
        }
      } catch (err) {
        if (!isCancelled) {
          setCharacter(null);
          setError(err.message || "Failed to load character");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [socket, characterID]);

  if (loading) return <div className="text-white p-10">Loading...</div>;
  if (error) return <div className="text-red-400 p-10">Error: {error}</div>;
  if (!character) return <div className="text-white p-10">Character not found.</div>;

  const raceName =
    character?.race?.name ||
    character?.raceName ||
    (typeof character?.race === "string" ? character.race : undefined);
  const className =
    character?.classType?.name ||
    character?.className ||
    (typeof character?.classType === "string" ? character.classType : undefined);
  const characterId =
    character?._id?.$oid || character?._id || character?.id || characterID;

  return (
    <Body className="bg-website-default-900">
      {/* 1. Use the static Header sub-component provided by your Body skeleton */}
      <Body.Header title={character.name || "Character"} />

      {/* 2. Wrap main content in Center to use the '5fr' column */}
      <Body.Center className="p-6 text-left">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-6">
          
          {/* LEFT COLUMN: Vitals & XP */}
          <div className="space-y-4">

            <div>
                <ProfileCard
                    character = {character}
                    raceName = {raceName}
                    className = {className}
                />
            </div>

            <div className="bg-website-default-800/50 p-4 rounded-xl border border-white/5 shadow-xl">
                <VitalsCard
                    character = {character}
                />

              
            </div>

             <div>
                <EffectsTab 
                effects={character?.effects}
                
                />
              </div>

              <div>
                <ActionsTab actions={character?.actions} />
              </div>

             
           </div>

          {/* MIDDLE COLUMN: Attributes */}
          <div className="space-y-4">
          <div className="bg-website-default-800/50 p-4 rounded-xl border border-white/5 shadow-xl">
            <AttributesCard
                stats ={character.stats}
            />
            
          </div>

          <div className="col-span-3">
            {/* Passing character?.inv?.equipment ensures we don't pass undefined to the component */}
            <Equipment 
                equipment={character?.inv?.equipment} 
                gp={character?.inv?.gp} 
            />
            </div>

          </div>

          {/* RIGHT COLUMN: Details */}
          <div className="space-y-4">
            <div className="bg-website-default-800/50 p-4 rounded-xl border border-white/5 shadow-xl">
             <AppearanceCard
                character ={character}
             />
            </div>
            <div>

                <InventoryBox
                    inventory={character?.inv}
                    characterWeight={character?.weight}
                />
            </div>
             <div className="bg-website-default-800/50 p-4 rounded-xl border border-white/5 shadow-xl">
             <StoryBox 
                character = {character}
             />
              
            </div>
          </div>

        </div>
      </Body.Center>

      <Body.Footer>
        <div className="text-[10px] text-gray-600 uppercase tracking-widest">
          Character ID: {characterId}
        </div>
      </Body.Footer>
    </Body>
  );
}
