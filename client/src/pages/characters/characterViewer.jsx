import Body from "../../pageComponents/bodySkeleton";
import { SocketContext } from "../../socket.io/context";
import { useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const { characterID } = useParams();
  const playerID = localStorage.getItem("player_ID");
  const [character, setCharacter] = useState(null);
  const [viewContexts, setViewContexts] = useState([]);
  const [selectedContextKey, setSelectedContextKey] = useState("");
  const [activeContext, setActiveContext] = useState(null);
  const [contextsLoaded, setContextsLoaded] = useState(false);
  const [canEditBase, setCanEditBase] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!socket || !characterID || !playerID) {
      setLoading(false);
      setContextsLoaded(false);
      return;
    }

    let cancelled = false;
    setContextsLoaded(false);
    setLoading(true);
    setError(null);

    socket.emit(
      "character_getViewContexts",
      { playerID, characterID },
      (response) => {
        if (cancelled) return;

        if (!response?.success) {
          setCharacter(null);
          setViewContexts([]);
          setSelectedContextKey("");
          setCanEditBase(false);
          setError(response?.message || "Failed to load character contexts");
          setLoading(false);
          setContextsLoaded(false);
          return;
        }

        const contexts = Array.isArray(response.contexts) ? response.contexts : [];
        const fallbackContextKey = contexts[0]?.key || "";
        const defaultKey = response.defaultContextKey || fallbackContextKey;

        setViewContexts(contexts);
        setCanEditBase(Boolean(response.canEditBase));
        setSelectedContextKey(defaultKey);
        setError(null);
        setContextsLoaded(true);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [socket, characterID, playerID]);

  useEffect(() => {
    if (!socket || !characterID || !playerID || !contextsLoaded || !selectedContextKey) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const requestedCampaignID = selectedContextKey.startsWith("campaign:")
      ? selectedContextKey.slice("campaign:".length)
      : "";

    socket.emit(
      "character_getViewData",
      {
        playerID,
        characterID,
        contextKey: selectedContextKey,
        campaignID: requestedCampaignID,
      },
      (response) => {
        if (cancelled) return;

        if (!response?.success) {
          setCharacter(null);
          setActiveContext(null);
          setError(response?.message || "Failed to load character");
          setLoading(false);
          return;
        }

        const merged = mergeCharacterForViewer(
          response.rawCharacter || {},
          response.builtCharacter || {}
        );
        setCharacter(merged);
        setActiveContext(response.context || null);
        setCanEditBase(Boolean(response.canEditBase));
        setError(null);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [socket, characterID, playerID, contextsLoaded, selectedContextKey]);

  const selectedContext = useMemo(() => {
    return (
      viewContexts.find((context) => context.key === selectedContextKey) ||
      activeContext ||
      null
    );
  }, [viewContexts, selectedContextKey, activeContext]);

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
  const characterId = toIdString(character?._id || character?.id || characterID);
  const safeSessionID = sessionStorage.getItem("session_ID") || "default";
  const isBaseContext = selectedContextKey === "base";
  const contextLabel =
    selectedContext?.type === "campaign"
      ? selectedContext?.campaignName || "Campaign"
      : "Base Character";

  return (
    <Body className="bg-website-default-900">
      <Body.Header title={character.name || "Character"} />

      <Body.Center className="p-6 text-left">
        <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
          <div className="text-xs uppercase tracking-widest text-website-default-400">
            Viewing: {contextLabel}
          </div>
          <select
            value={selectedContextKey}
            onChange={(event) => setSelectedContextKey(String(event.target.value || ""))}
            className="rounded-md border border-website-default-600 bg-website-default-800 px-3 py-2 text-sm text-website-default-100"
          >
            {viewContexts.map((context) => (
              <option key={context.key} value={context.key}>
                {context.type === "base"
                  ? "Base Character"
                  : `Campaign: ${context.campaignName || "Campaign"}`}
              </option>
            ))}
          </select>
          {canEditBase && isBaseContext && (
            <button
              type="button"
              onClick={() => navigate(`/ISK/${safeSessionID}/character/edit/${characterId}`)}
              className="rounded-md border border-website-highlights-500 bg-website-highlights-600/20 px-3 py-2 text-sm text-website-highlights-200 hover:bg-website-highlights-600/30"
            >
              Edit Character
            </button>
          )}
        </div>

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
