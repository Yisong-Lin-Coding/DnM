import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MAP_IMAGE_OPTIONS } from "../handlers/getMapImage";

const GameContext = createContext();

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_BACKGROUND_KEY = "gray";
const MIN_Z_LEVEL            = -20;
const MAX_Z_LEVEL            = 20;
const MIN_HITBOX_SCALE       = 0.1;
const MAX_HITBOX_SCALE       = 5;
const LIGHT_AXIS_MIN         = -1;
const LIGHT_AXIS_MAX         = 1;
const LIGHT_INTENSITY_MIN    = 0;
const LIGHT_INTENSITY_MAX    = 2;
const LIGHT_BLEND_MIN        = 0;
const LIGHT_BLEND_MAX        = 1;
const LIGHT_RANGE_MIN        = 10;
const LIGHT_RANGE_MAX        = 5000;

const BACKGROUND_OPTIONS = [
    "gray",
    "calm1", "calm2", "calm3", "calm4",
    "cloud1", "cloud2", "cloud3", "cloud4",
    "night1", "night2", "night3", "night4",
    "storm1",
    "sunset1", "sunset2", "sunset3", "sunset4",
];

const DEFAULT_LIGHTING = {
    enabled:       true,
    ambient:       0.24,
    shadowEnabled: true,
    shadowStrength:0.62,
    shadowSoftness:0.55,
    shadowLength:  0.9,
    shadowBlend:   0.68,
    sources: [{
        id:        "sun",
        name:      "Sun",
        type:      "directional",
        enabled:   true,
        x:         0,
        y:         0,
        intensity: 0.8,
        blend:     0.7,
        color:     "#ffffff",
    }]
};

const DEFAULT_MAX_HP_BY_TERRAIN = { floor: 500, wall: 1200, obstacle: 700 };

const DEFAULT_FLOOR_TYPE_BY_TERRAIN = {
    floor:    "stoneFloor",
    wall:     "stoneWall",
    obstacle: "woodenCrate",
};

const DEFAULT_ELEVATION_HEIGHT_BY_TERRAIN = { floor: 0, wall: 150, obstacle: 80 };

const DEFAULT_FLOOR_TYPES = [
    {
        id: "stoneFloor", name: "Stone Floor", terrainType: "floor", floorVisualType: "base",
        description: "Solid stone tiles with stable footing.", movementCost: 1, blocksMovement: false,
        effects: [{ id: "sureFooting", trigger: "onEnter", description: "Stable movement." }],
    },
    {
        id: "mudFloor", name: "Mud Floor", terrainType: "floor", floorVisualType: "effect",
        description: "Heavy mud that slows movement.", movementCost: 2, blocksMovement: false,
        effects: [{ id: "slowed", trigger: "onEnter", description: "Movement cost increased." }],
    },
    {
        id: "spikeTrapFloor", name: "Spike Trap", terrainType: "floor", floorVisualType: "effect",
        description: "Hidden spikes can damage units that move across it.", movementCost: 1, blocksMovement: false,
        effects: [{ id: "pierceDamage", trigger: "onEnter", value: 8, description: "Take damage on contact." }],
    },
    {
        id: "stoneWall", name: "Stone Wall", terrainType: "wall",
        description: "Heavy wall that blocks movement and vision.", movementCost: 0, blocksMovement: true,
        effects: [{ id: "hardCover", trigger: "passive", description: "Provides hard cover." }],
    },
    {
        id: "woodenWall", name: "Wooden Wall", terrainType: "wall",
        description: "Breakable wooden partition.", movementCost: 0, blocksMovement: true,
        effects: [{ id: "flammable", trigger: "onElementFire", description: "Extra fire damage." }],
    },
    {
        id: "woodenCrate", name: "Wooden Crate", terrainType: "obstacle",
        description: "Low obstacle with medium durability.", movementCost: 0, blocksMovement: true,
        effects: [{ id: "halfCover", trigger: "passive", description: "Provides partial cover." }],
    },
    {
        id: "pillarObstacle", name: "Stone Pillar", terrainType: "obstacle",
        description: "Dense obstacle with high durability.", movementCost: 0, blocksMovement: true,
        effects: [{ id: "lineBlock", trigger: "passive", description: "Blocks line of sight." }],
    },
];

const DEFAULT_CHARACTERS = [
    { id: "char1", name: "Hero",  position: { x: 25,  y: 50  }, size: 50, visionDistance: 200, rotation: 45,  visionArc: 90,  team: "player" },
    { id: "char2", name: "Ally",  position: { x: 100, y: 100 }, size: 20, visionDistance: 150, rotation: 180, visionArc: 120, team: "player" },
    { id: "char3", name: "Enemy", position: { x: 400, y: 300 }, size: 30, visionDistance: 100, rotation: 270, visionArc: 90,  team: "enemy"  },
];

const DEFAULT_MAP_OBJECTS = [
    {
        id: 1, type: "rect",   terrainType: "floor",    floorTypeId: "stoneFloor",
        elevationHeight: 0,   zLevel: 0, x: 100, y: 100, z: 0,
        width: 120, height: 100, color: "#1D4ED8", maxHP: 500, hp: 500,
        hitbox: { type: "rect",   offsetX: 0, offsetY: 0, scale: 1 },
    },
    {
        id: 2, type: "rect",   terrainType: "wall",     floorTypeId: "stoneWall",
        elevationHeight: 150, zLevel: 0, x: 200, y: 150, z: 1,
        width: 50,  height: 40,  color: "#EF4444", maxHP: 1200, hp: 1200,
        hitbox: { type: "rect",   offsetX: 0, offsetY: 0, scale: 1 },
    },
    {
        id: 3, type: "circle", terrainType: "obstacle", floorTypeId: "woodenCrate",
        elevationHeight: 80,  zLevel: 1, x: 300, y: 200, z: 0,
        size: 40, color: "#10B981", maxHP: 700, hp: 700,
        hitbox: { type: "circle", offsetX: 0, offsetY: 0, scale: 1 },
    },
];

// ============================================================================
// PURE HELPERS  (no hooks, safe to call outside components)
// ============================================================================

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toOptionalNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const toPositiveNumber    = (value, fallback = 1) => Math.max(1, toNumber(value, fallback));
const toNonNegativeNumber = (value, fallback = 0) => Math.max(0, toNumber(value, fallback));

const normalizeObjectType = (value) => {
    const type = String(value || "").trim().toLowerCase();
    if (type === "circle" || type === "rect" || type === "triangle") return type;
    return "circle";
};

const normalizeHexColor = (value, fallback = "#3B82F6") => {
    const raw = String(value || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
};

const normalizeMapAssetKey  = (value)           => String(value || "").trim().toLowerCase();
const normalizeFloorVisualType = (value)         => String(value || "").trim().toLowerCase() === "effect" ? "effect" : "base";
const normalizeLightSourceType = (value)         => String(value || "").trim().toLowerCase() === "point"  ? "point"  : "directional";

const normalizeTerrainType = (value) => {
    const type = String(value || "").trim().toLowerCase();
    if (type === "floor" || type === "wall" || type === "obstacle") return type;
    return "obstacle";
};

const clampZLevel     = (value) => Math.max(MIN_Z_LEVEL,     Math.min(MAX_Z_LEVEL,     Math.round(toNumber(value, 0))));
const clampHitboxScale= (value) => Math.max(MIN_HITBOX_SCALE,Math.min(MAX_HITBOX_SCALE,toNumber(value, 1)));
const clampLightAxis  = (value) => Math.max(LIGHT_AXIS_MIN,  Math.min(LIGHT_AXIS_MAX,  toNumber(value, 0)));

const normalizeLightingDirection = (value = {}) => {
    const x         = clampLightAxis(value?.x);
    const y         = clampLightAxis(value?.y);
    const magnitude = Math.hypot(x, y);
    if (magnitude <= 1 || magnitude === 0) return { x, y };
    return { x: x / magnitude, y: y / magnitude };
};

const normalizeLightingSource = (raw = {}, fallbackIndex = 0) => {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const type   = normalizeLightSourceType(source.type);

    // Support legacy format where direction x/y was on a nested `source` property
    const sourceInput =
        source?.source && typeof source.source === "object" && !Array.isArray(source.source)
            ? source.source
            : source;

    const normalized = {
        id:        String(source.id   || `light_${fallbackIndex + 1}`).trim() || `light_${fallbackIndex + 1}`,
        name:      String(source.name || (type === "point" ? `Lamp ${fallbackIndex + 1}` : `Light ${fallbackIndex + 1}`)).trim(),
        type,
        enabled:   source.enabled !== false,
        intensity: Math.max(LIGHT_INTENSITY_MIN, Math.min(LIGHT_INTENSITY_MAX, toNumber(source.intensity, 0.8))),
        blend:     Math.max(LIGHT_BLEND_MIN,     Math.min(LIGHT_BLEND_MAX,     toNumber(source.blend,     0.7))),
        color:     normalizeHexColor(source.color, "#ffffff"),
    };

    if (type === "point") {
        normalized.worldX  = toNumber(source.worldX ?? source.position?.x, 0);
        normalized.worldY  = toNumber(source.worldY ?? source.position?.y, 0);
        normalized.range   = Math.max(LIGHT_RANGE_MIN, Math.min(LIGHT_RANGE_MAX, toNumber(source.range, 420)));
        normalized.zLevel  = clampZLevel(source.zLevel ?? 0);
    } else {
        const direction = normalizeLightingDirection({ x: sourceInput?.x, y: sourceInput?.y });
        normalized.x = direction.x;
        normalized.y = direction.y;
    }

    return normalized;
};

const normalizeLightingConfig = (value = {}) => {
    // Support legacy format where lighting properties sat on a nested `source` key
    const sourceInput =
        value?.source && typeof value.source === "object" && !Array.isArray(value.source)
            ? value.source
            : value;

    const rawSources = Array.isArray(value?.sources) ? value.sources : [];
    let sources = rawSources.map((entry, index) => normalizeLightingSource(entry, index));

    // Backward compat: if no sources array, build one from legacy flat format
    if (sources.length === 0) {
        sources = [normalizeLightingSource({ type: "directional", x: sourceInput?.x, y: sourceInput?.y, intensity: value?.intensity, blend: value?.blend }, 0)];
    }

    return {
        enabled:       value?.enabled !== false,
        ambient:       Math.max(0, Math.min(0.95, toNumber(value?.ambient,       DEFAULT_LIGHTING.ambient))),
        shadowEnabled: value?.shadowEnabled !== false,
        shadowStrength:Math.max(0, Math.min(1,    toNumber(value?.shadowStrength, DEFAULT_LIGHTING.shadowStrength))),
        shadowSoftness:Math.max(0, Math.min(1,    toNumber(value?.shadowSoftness, DEFAULT_LIGHTING.shadowSoftness))),
        shadowLength:  Math.max(0, Math.min(2,    toNumber(value?.shadowLength,   DEFAULT_LIGHTING.shadowLength))),
        shadowBlend:   Math.max(0, Math.min(1,    toNumber(value?.shadowBlend,    DEFAULT_LIGHTING.shadowBlend))),
        sources,
    };
};

const normalizeFloorTypeID = (value, terrainType = "obstacle") => {
    const candidate = String(value || "").trim();
    return candidate || DEFAULT_FLOOR_TYPE_BY_TERRAIN[terrainType] || DEFAULT_FLOOR_TYPE_BY_TERRAIN.obstacle;
};

const normalizeFloorTypeDefinition = (raw = {}, fallbackIndex = 0) => {
    const terrainType = normalizeTerrainType(raw.terrainType);
    const id          = String(raw.id || `floorType_${fallbackIndex + 1}`).trim() || `floorType_${fallbackIndex + 1}`;
    return {
        id,
        name:          String(raw.name || id).trim() || id,
        terrainType,
        floorVisualType: terrainType === "floor" ? normalizeFloorVisualType(raw.floorVisualType || raw.visualType) : "base",
        description:   String(raw.description || "").trim(),
        movementCost:  Math.max(0, toNumber(raw.movementCost, terrainType === "floor" ? 1 : 0)),
        blocksMovement: typeof raw.blocksMovement === "boolean" ? raw.blocksMovement : terrainType !== "floor",
        effects:       Array.isArray(raw.effects) ? raw.effects : [],
    };
};

const normalizeFloorTypeCollection = (list = []) => {
    const safeList = Array.isArray(list) ? list : [];
    const byID     = new Map();
    safeList.forEach((entry, index) => {
        const normalized = normalizeFloorTypeDefinition(entry, index);
        if (!byID.has(normalized.id)) byID.set(normalized.id, normalized);
    });
    return Array.from(byID.values());
};

const getMaxObjectId = (objects = []) =>
    objects.reduce((max, obj) => Math.max(max, toNumber(obj?.id, 0)), 0);

const resolveElevationInput = (raw = {}, type = "circle", terrainType = "obstacle") => {
    if (raw?.elevationHeight  != null) return raw.elevationHeight;
    if (raw?.height3D         != null) return raw.height3D;
    if (raw?.objectHeight     != null) return raw.objectHeight;
    if (raw?.shadowHeight     != null) return raw.shadowHeight;
    if (type !== "rect" && raw?.height != null) return raw.height;
    return DEFAULT_ELEVATION_HEIGHT_BY_TERRAIN[terrainType] ?? DEFAULT_ELEVATION_HEIGHT_BY_TERRAIN.obstacle;
};

const normalizeMapObject = (raw = {}, fallbackId = 1) => {
    const type          = normalizeObjectType(raw.type);
    const terrainType   = normalizeTerrainType(raw.terrainType);
    const floorTypeId   = normalizeFloorTypeID(raw.floorTypeId, terrainType);
    const defaultMaxHP  = DEFAULT_MAX_HP_BY_TERRAIN[terrainType] || DEFAULT_MAX_HP_BY_TERRAIN.obstacle;
    const isIndestructible = raw.maxHP === null || raw.maxHP === "indestructible" || raw.maxHP === "infinite";
    const maxHP         = isIndestructible ? null : Math.max(1, Math.round(toNumber(raw.maxHP, defaultMaxHP)));
    const hp            = maxHP === null ? null : Math.max(0, Math.min(maxHP, Math.round(toNumber(raw.hp, maxHP))));
    const hitboxSource  = raw.hitbox && typeof raw.hitbox === "object" && !Array.isArray(raw.hitbox) ? raw.hitbox : {};

    const normalized = {
        id:             toNumber(raw.id, fallbackId),
        type,
        x:              Math.round(toNumber(raw.x, 0)),
        y:              Math.round(toNumber(raw.y, 0)),
        z:              Math.round(toNumber(raw.z, 0)),
        zLevel:         clampZLevel(raw.zLevel),
        rotation:       toNumber(raw.rotation, 0),
        terrainType,
        floorTypeId,
        color:          normalizeHexColor(raw.color),
        mapAssetKey:    normalizeMapAssetKey(raw.mapAssetKey || raw.mapKey || raw.mapImageKey),
        elevationHeight:Math.round(toNonNegativeNumber(resolveElevationInput(raw, type, terrainType), 0)),
        maxHP,
        hp,
        hitbox: {
            type:    normalizeObjectType(hitboxSource.type || raw.hitboxType || type),
            offsetX: Math.round(toNumber(hitboxSource.offsetX, 0)),
            offsetY: Math.round(toNumber(hitboxSource.offsetY, 0)),
            scale:   clampHitboxScale(hitboxSource.scale ?? raw.hitboxScale),
        },
    };

    if (type === "rect") {
        normalized.width  = toPositiveNumber(raw.width, 50);
        normalized.height = toPositiveNumber(raw.height, 40);
    } else {
        normalized.size = toPositiveNumber(raw.size, type === "triangle" ? 40 : 30);
    }

    return normalized;
};

const normalizeCharacter = (raw = {}, fallback = {}) => {
    const source = { ...fallback, ...raw };
    const hp     = toOptionalNumber(source.hp  ?? source.HP?.current);
    const maxHP  = toOptionalNumber(source.maxHP ?? source.HP?.max);
    
    // Server is authoritative - preserve ALL fields from server data
    const normalized = {
        ...source, // Keep all server fields (statusEffects, perception, AR, resistances, etc.)
        id:             String(source.id   || fallback.id   || ""),
        name:           String(source.name || fallback.name || "Unknown"),
        position: {
            x: toNumber(source?.position?.x, 0),
            y: toNumber(source?.position?.y, 0),
        },
        size:           toPositiveNumber(source.size, 30),
        visionDistance: toPositiveNumber(source.visionDistance ?? source.vision?.distance, 150),
        rotation:       toNumber(source.rotation, 0),
        visionArc:      toPositiveNumber(source.visionArc ?? source.vision?.angle, 90),
        team:           String(source.team || fallback.team || "player"),
        movement:       toPositiveNumber(source.movement ?? source.speed, 30),
        hp,
        maxHP,
    };
    
    // Preserve HP structure if present
    if (source.HP && typeof source.HP === 'object') {
        normalized.HP = { ...source.HP };
        normalized.hp = source.HP.current;
        normalized.maxHP = source.HP.max;
    }
    
    // Preserve statusEffects array
    if (Array.isArray(source.statusEffects)) {
        normalized.statusEffects = [...source.statusEffects];
    }
    
    // Preserve perception value
    if (Number.isFinite(source.perception)) {
        normalized.perception = source.perception;
    }
    
    return normalized;
};

// ============================================================================
// WALL OVERLAP DETECTION
// ============================================================================

const getObjectBounds = (obj = {}) => {
    const type = normalizeObjectType(obj.type);
    const x    = toNumber(obj.x, 0);
    const y    = toNumber(obj.y, 0);

    if (type === "rect") {
        const hw = toPositiveNumber(obj.width,  50) / 2;
        const hh = toPositiveNumber(obj.height, 40) / 2;
        return { minX: x - hw, maxX: x + hw, minY: y - hh, maxY: y + hh };
    }

    const radius = toPositiveNumber(obj.size, type === "triangle" ? 40 : 30);
    return { minX: x - radius, maxX: x + radius, minY: y - radius, maxY: y + radius };
};

const doBoundsOverlap = (a, b) =>
    a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;

const isWallObject = (obj = {}) => normalizeTerrainType(obj.terrainType) === "wall";

const wouldWallOverlap = (candidate = {}, objects = [], ignoreId = null) => {
    if (!isWallObject(candidate)) return false;
    const candidateBounds = getObjectBounds(candidate);
    const candidateLevel  = clampZLevel(candidate.zLevel);
    const ignored         = ignoreId == null ? null : toNumber(ignoreId, -1);

    return (Array.isArray(objects) ? objects : []).some((obj) => {
        if (!isWallObject(obj))                                    return false;
        if (clampZLevel(obj.zLevel) !== candidateLevel)            return false;
        if (ignored != null && toNumber(obj.id, -1) === ignored)   return false;
        return doBoundsOverlap(candidateBounds, getObjectBounds(obj));
    });
};

const enforceWallOverlapRules = (objects = []) => {
    const accepted = [];
    (Array.isArray(objects) ? objects : []).forEach((obj) => {
        if (!wouldWallOverlap(obj, accepted)) accepted.push(obj);
    });
    return accepted;
};

// ============================================================================
// PROVIDER
// ============================================================================

export const GameProvider = ({ children }) => {

    // ── Core scene state ─────────────────────────────────────────────────────
    const [isDM,            setIsDM]           = useState(false);
    const [fogEnabled,      setFogEnabled]      = useState(true);
    const [selectedChar,    setSelectedChar]    = useState(null);
    const [characters,      setCharacters]      = useState(DEFAULT_CHARACTERS);
    const [lastMouse,       setLastMouse]       = useState({ x: 0, y: 0 });
    const camera = useRef({ x: 0, y: 0, zoom: 1, bgImage: null });

    // ── Map state ─────────────────────────────────────────────────────────────
    const [mapObjects,      setMapObjects]      = useState(DEFAULT_MAP_OBJECTS);
    const [mapGeometry,     setMapGeometry]     = useState(null);
    const [currentMapId,    setCurrentMapId]    = useState("default_map");
    const [backgroundKey,   setBackgroundKey]   = useState(DEFAULT_BACKGROUND_KEY);
    const [currentZLevel,   setCurrentZLevel]   = useState(0);
    const [floorTypes,      setFloorTypes]      = useState(DEFAULT_FLOOR_TYPES);
    const [lighting,        setLighting]        = useState(DEFAULT_LIGHTING);

    // ── Placement "arm" state — only one is active at a time ─────────────────
    // (mapObjectPlacement, lightPlacement, and characterPlacement are grouped here
    //  so their mutual exclusivity is obvious and armMapObjectPlacement can safely
    //  clear the other two without forward-reference issues.)
    const [mapObjectPlacement,  setMapObjectPlacement]  = useState(null);
    const [lightPlacement,      setLightPlacement]      = useState(null);
    const [characterPlacement,  setCharacterPlacement]  = useState(null);

    // ── ID counter ref ────────────────────────────────────────────────────────
    const nextMapObjectIdRef  = useRef(getMaxObjectId(DEFAULT_MAP_OBJECTS) + 1);
    const mapObjectsRef       = useRef(DEFAULT_MAP_OBJECTS);

    useEffect(() => {
        mapObjectsRef.current = mapObjects;
    }, [mapObjects]);

    // =========================================================================
    // ID MANAGEMENT
    // =========================================================================

    const ensureNextObjectId = useCallback((objects) => {
        const nextId = getMaxObjectId(objects) + 1;
        nextMapObjectIdRef.current = Math.max(nextMapObjectIdRef.current, nextId);
    }, []);

    // =========================================================================
    // MAP OBJECT CRUD
    // =========================================================================

    const createMapObject = useCallback((draft) => {
        const candidateId = toNumber(draft?.id, 0);
        const id          = candidateId > 0 ? candidateId : nextMapObjectIdRef.current++;
        const newObject   = normalizeMapObject(draft, id);

        // Quick pre-check to skip the state update entirely if we already know it's invalid
        if (wouldWallOverlap(newObject, mapObjectsRef.current)) return null;

        setMapObjects((prev) => {
            if (wouldWallOverlap(newObject, prev)) return prev;
            const updated = [...prev, newObject];
            ensureNextObjectId(updated);
            mapObjectsRef.current = updated;
            return updated;
        });

        return newObject;
    }, [ensureNextObjectId]);

    const addMapObject = useCallback((obj) => createMapObject(obj), [createMapObject]);

    const updateMapObject = useCallback((id, updates) => {
        const numericId = toNumber(id, -1);
        if (numericId < 0) return;

        setMapObjects((prev) => {
            const targetIndex = prev.findIndex((obj) => toNumber(obj.id, -1) === numericId);
            if (targetIndex < 0) return prev;

            const currentObject = prev[targetIndex];
            const safeUpdates   = updates && typeof updates === "object" && !Array.isArray(updates) ? updates : {};
            const merged        = { ...currentObject, ...safeUpdates };

            if (safeUpdates.hitbox && typeof safeUpdates.hitbox === "object") {
                merged.hitbox = { ...(currentObject.hitbox || {}), ...safeUpdates.hitbox };
            }

            const normalized = normalizeMapObject(merged, currentObject.id);

            const layoutSensitiveKeys = new Set(["type", "terrainType", "x", "y", "zLevel", "size", "width", "height", "hitbox"]);
            const affectsLayout       = Object.keys(safeUpdates).some((k) => layoutSensitiveKeys.has(k));
            if (affectsLayout && wouldWallOverlap(normalized, prev, currentObject.id)) return prev;

            const next = [...prev];
            next[targetIndex]     = normalized;
            mapObjectsRef.current = next;
            return next;
        });
    }, []);

    const deleteMapObject = useCallback((id) => {
        const numericId = toNumber(id, -1);
        if (numericId < 0) return;
        setMapObjects((prev) => {
            const next            = prev.filter((obj) => toNumber(obj.id, -1) !== numericId);
            mapObjectsRef.current = next;
            return next;
        });
    }, []);

    const replaceAllMapObjects = useCallback((newObjects) => {
        const safeObjects = Array.isArray(newObjects) ? newObjects : [];
        const normalized  = enforceWallOverlapRules(safeObjects.map((obj, i) => normalizeMapObject(obj, i + 1)));
        setMapObjects(normalized);
        mapObjectsRef.current = normalized;
        ensureNextObjectId(normalized);
    }, [ensureNextObjectId]);

    // =========================================================================
    // PLACEMENT — OBJECT
    // =========================================================================

    /**
     * Arm the map for object placement.
     * Clears any active light or character placement first so only one mode is active at a time.
     */
    const armMapObjectPlacement = useCallback((config = {}) => {
        // Clear competing placements (all three states are declared above)
        setLightPlacement(null);
        setCharacterPlacement(null);

        const type          = normalizeObjectType(config.type);
        const terrainType   = normalizeTerrainType(config.terrainType);
        const floorTypeId   = normalizeFloorTypeID(config.floorTypeId, terrainType);
        const defaultMaxHP  = DEFAULT_MAX_HP_BY_TERRAIN[terrainType] || DEFAULT_MAX_HP_BY_TERRAIN.obstacle;
        const defaultElevH  = DEFAULT_ELEVATION_HEIGHT_BY_TERRAIN[terrainType] ?? DEFAULT_ELEVATION_HEIGHT_BY_TERRAIN.obstacle;
        const isIndestructible = config.maxHP === null || config.maxHP === "indestructible";
        const maxHP         = isIndestructible ? null : Math.max(1, Math.round(toNumber(config.maxHP, defaultMaxHP)));
        const hp            = maxHP === null ? null : Math.max(0, Math.min(maxHP, Math.round(toNumber(config.hp, maxHP))));

        setMapObjectPlacement({
            type,
            terrainType,
            floorTypeId,
            zLevel:          clampZLevel(config.zLevel),
            color:           normalizeHexColor(config.color),
            mapAssetKey:     normalizeMapAssetKey(config.mapAssetKey || config.mapKey || config.mapImageKey),
            z:               Math.round(toNumber(config.z, 0)),
            rotation:        toNumber(config.rotation, 0),
            size:            toPositiveNumber(config.size,   type === "triangle" ? 40 : 30),
            width:           toPositiveNumber(config.width,  50),
            height:          toPositiveNumber(config.height, 40),
            elevationHeight: Math.round(toNonNegativeNumber(
                config.elevationHeight ?? config.height3D ?? config.objectHeight ?? config.shadowHeight ?? defaultElevH,
                defaultElevH
            )),
            maxHP,
            hp,
            hitbox: {
                type:    normalizeObjectType(config?.hitbox?.type || config.hitboxType || type),
                offsetX: Math.round(toNumber(config?.hitbox?.offsetX, 0)),
                offsetY: Math.round(toNumber(config?.hitbox?.offsetY, 0)),
                scale:   clampHitboxScale(config?.hitbox?.scale ?? config.hitboxScale),
            },
        });
    }, []);

    const clearMapObjectPlacement = useCallback(() => setMapObjectPlacement(null), []);

    const placePendingMapObjectAt = useCallback((x, y, overrides = {}) => {
        if (!mapObjectPlacement) return null;
        const safeOverrides = overrides && typeof overrides === "object" && !Array.isArray(overrides) ? overrides : {};
        const placed = createMapObject({
            ...mapObjectPlacement,
            ...safeOverrides,
            x: Math.round(toNumber(x, 0)),
            y: Math.round(toNumber(y, 0)),
        });
        setMapObjectPlacement(null);
        return placed;
    }, [mapObjectPlacement, createMapObject]);

    // =========================================================================
    // PLACEMENT — LIGHT
    // =========================================================================

    const armLightPlacement = useCallback((config = {}) => {
        setMapObjectPlacement(null);
        setCharacterPlacement(null);
        setLightPlacement({
            type:      "point",
            color:     String(config.color     || "#ffffff"),
            intensity: Number(config.intensity) || 0.8,
            blend:     Number(config.blend)     || 0.7,
            range:     Number(config.range)     || 420,
        });
    }, []);

    const clearLightPlacement = useCallback(() => setLightPlacement(null), []);

    const placeLightAt = useCallback((worldX, worldY) => {
        if (!lightPlacement) return;
        addLightSource({
            id:        `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name:      `Light ${(lighting?.sources?.length || 0) + 1}`,
            type:      "point",
            enabled:   true,
            worldX:    Math.round(worldX),
            worldY:    Math.round(worldY),
            color:     lightPlacement.color,
            intensity: lightPlacement.intensity,
            blend:     lightPlacement.blend,
            range:     lightPlacement.range,
        });
        clearLightPlacement();
    }, [lightPlacement, lighting, clearLightPlacement]); // addLightSource added below — fine because closures capture by ref

    // =========================================================================
    // PLACEMENT — CHARACTER & ENEMY
    // =========================================================================

    const armCharacterPlacement = useCallback((config = {}) => {
        const rawId       = config.characterId ?? config.id ?? config.characterID;
        const characterId = String(rawId || "").trim();
        if (!characterId) return;

        setMapObjectPlacement(null);
        setLightPlacement(null);
        setCharacterPlacement({
            kind: "character",
            id:   characterId,
            name: String(config.name || config.characterName || "").trim(),
            size: Number(config.size) || null,
            team: String(config.team || "").trim(),
        });
    }, []);

    const armEnemyPlacement = useCallback((config = {}) => {
        const rawId    = config.enemyId ?? config.id ?? config.enemyID;
        const enemyId  = String(rawId || "").trim();
        if (!enemyId) return;

        setMapObjectPlacement(null);
        setLightPlacement(null);
        setCharacterPlacement({
            kind: "enemy",
            id:   enemyId,
            name: String(config.name || config.enemyName || "").trim(),
            size: Number(config.size) || null,
            team: "enemy",
        });
    }, []);

    const clearCharacterPlacement = useCallback(() => setCharacterPlacement(null), []);

    // =========================================================================
    // CHARACTER MUTATIONS
    // =========================================================================

    const updateCharacter = useCallback((characterId, updates) => {
        if (!characterId) return;
        setCharacters((prev) =>
            prev.map((char) =>
                char.id === characterId
                    ? normalizeCharacter({ ...char, ...updates }, char)
                    : char
            )
        );
    }, []);

    const moveCharacter = useCallback((characterId, x, y) => {
        updateCharacter(characterId, { position: { x: toNumber(x, 0), y: toNumber(y, 0) } });
    }, [updateCharacter]);

    const selectCharacter = useCallback((characterId) => setSelectedChar(characterId), []);

    /** Placeholder for wiring character combat actions to the server. */
    const handleCharacterAction = useCallback((characterId, action) => {
        const char = characters.find((c) => c.id === characterId);
        console.log(`${char?.name ?? characterId} performs ${action}`);
        // TODO: emit via socket to server GameEngine
    }, [characters]);

    // =========================================================================
    // LIGHTING
    // =========================================================================

    const replaceLighting = useCallback((lightingConfig) => {
        setLighting(normalizeLightingConfig(lightingConfig));
    }, []);

    /** Convenience: update only the first directional light's direction. */
    const setLightingDirection = useCallback((x, y) => {
        setLighting((prev) => {
            const normalized = normalizeLightingConfig(prev);
            const sources    = [...normalized.sources];
            const firstDirIdx= sources.findIndex((s) => s.type === "directional");

            if (firstDirIdx >= 0) {
                sources[firstDirIdx] = { ...sources[firstDirIdx], ...normalizeLightingDirection({ x, y }) };
            } else {
                sources.unshift(normalizeLightingSource({ type: "directional", x, y }, 0));
            }

            return { ...normalized, sources };
        });
    }, []);

    const addLightSource = useCallback((lightSource) => {
        setLighting((prev) => {
            const normalized = normalizeLightingConfig(prev);
            const newSource  = normalizeLightingSource(lightSource, normalized.sources.length);
            return { ...normalized, sources: [...normalized.sources, newSource] };
        });
    }, []);

    const updateLightSource = useCallback((lightId, updates) => {
        setLighting((prev) => {
            const normalized = normalizeLightingConfig(prev);
            const sources    = normalized.sources.map((source) =>
                source.id === lightId
                    ? normalizeLightingSource({ ...source, ...updates }, 0)
                    : source
            );
            return { ...normalized, sources };
        });
    }, []);

    const removeLightSource = useCallback((lightId) => {
        setLighting((prev) => {
            const normalized = normalizeLightingConfig(prev);
            return { ...normalized, sources: normalized.sources.filter((s) => s.id !== lightId) };
        });
    }, []);

    // =========================================================================
    // FLOOR TYPES
    // =========================================================================

    const replaceFloorTypes = useCallback((newFloorTypes) => {
        const normalized = normalizeFloorTypeCollection(newFloorTypes);
        if (!normalized.length) return;
        setFloorTypes(normalized);
    }, []);

    // =========================================================================
    // Z-LEVEL
    // =========================================================================

    const stepZLevelUp   = useCallback(() => setCurrentZLevel((prev) => clampZLevel(prev + 1)), []);
    const stepZLevelDown = useCallback(() => setCurrentZLevel((prev) => clampZLevel(prev - 1)), []);

    // =========================================================================
    // CAMERA / COORDINATE TRANSFORMS
    // =========================================================================

    const screenToWorld = useCallback((screenX, screenY) => {
        if (!camera?.current) return { x: 0, y: 0 };
        const zoom = toNumber(camera.current.zoom, 1) || 1;
        return {
            x: (toNumber(screenX, 0) + toNumber(camera.current.x, 0)) / zoom,
            y: (toNumber(screenY, 0) + toNumber(camera.current.y, 0)) / zoom,
        };
    }, [camera]);

    const worldToScreen = useCallback((worldX, worldY) => {
        if (!camera?.current) return { x: 0, y: 0 };
        const zoom = toNumber(camera.current.zoom, 1) || 1;
        return {
            x: toNumber(worldX, 0) * zoom - toNumber(camera.current.x, 0),
            y: toNumber(worldY, 0) * zoom - toNumber(camera.current.y, 0),
        };
    }, [camera]);

    const worldMouseCoords = useMemo(() => {
        if (!camera?.current || typeof lastMouse.x !== "number" || typeof lastMouse.y !== "number") {
            return { x: 0, y: 0 };
        }
        return screenToWorld(lastMouse.x, lastMouse.y);
    }, [lastMouse, screenToWorld]);

    // =========================================================================
    // PERSISTENCE (STUBS — wire to your backend)
    // =========================================================================

    const saveMapToDatabase = useCallback(async () => {
        // TODO: emit 'map:save' via socket or call your REST endpoint
        console.log("saveMapToDatabase placeholder", { currentMapId, mapObjects, backgroundKey });
    }, [currentMapId, mapObjects, backgroundKey]);

    const loadMapFromDatabase = useCallback(async (mapId) => {
        // TODO: fetch and call loadGameSnapshot()
        console.log("loadMapFromDatabase placeholder", { mapId });
    }, []);

    const toggleFog = useCallback(() => setFogEnabled((prev) => !prev), []);

    // =========================================================================
    // SNAPSHOT LOAD
    // =========================================================================

    const loadGameSnapshot = useCallback((snapshot = {}) => {
        if (!snapshot || typeof snapshot !== "object") return;

        if (typeof snapshot.backgroundKey === "string" && snapshot.backgroundKey.trim()) {
            const candidate = snapshot.backgroundKey.trim().toLowerCase();
            if (BACKGROUND_OPTIONS.includes(candidate)) setBackgroundKey(candidate);
        }

        if (Array.isArray(snapshot.mapObjects))     replaceAllMapObjects(snapshot.mapObjects);
        if (Array.isArray(snapshot.mapGeometry))    setMapGeometry(snapshot.mapGeometry);
        if (Number.isFinite(Number(snapshot.currentZLevel))) setCurrentZLevel(clampZLevel(snapshot.currentZLevel));
        if (Array.isArray(snapshot.floorTypes))     replaceFloorTypes(snapshot.floorTypes);
        if (snapshot.lighting && typeof snapshot.lighting === "object") replaceLighting(snapshot.lighting);

        // SERVER IS AUTHORITATIVE - completely replace character array with server data
        if (Array.isArray(snapshot.characters) && snapshot.characters.length > 0) {
            console.log('[CLIENT] Loading snapshot with', snapshot.characters.length, 'characters');
            const normalizedChars = snapshot.characters.map((character, index) =>
                normalizeCharacter(character, DEFAULT_CHARACTERS[index] || {})
            );
            // Log first character for debugging
            if (normalizedChars[0]) {
                console.log('[CLIENT] First character:', normalizedChars[0].name, 
                    'HP:', normalizedChars[0].HP?.current || normalizedChars[0].hp,
                    'perception:', normalizedChars[0].perception,
                    'statusEffects:', normalizedChars[0].statusEffects?.length || 0);
            }
            setCharacters(normalizedChars);
        }
    }, [replaceAllMapObjects, replaceFloorTypes, replaceLighting]);

    // =========================================================================
    // CONTEXT VALUE
    // =========================================================================

    const value = {
        // Scene
        isDM, setIsDM,
        fogEnabled, setFogEnabled, toggleFog,
        selectedChar, setSelectedChar, selectCharacter,
        characters, setCharacters,
        lastMouse, setLastMouse,
        camera,
        worldMouseCoords,

        // Map objects
        mapObjects, setMapObjects,
        mapGeometry,
        currentMapId, setCurrentMapId,
        backgroundKey, setBackgroundKey,
        backgroundOptions: BACKGROUND_OPTIONS,
        mapImageOptions:   MAP_IMAGE_OPTIONS,
        addMapObject,
        updateMapObject,
        deleteMapObject,
        replaceAllMapObjects,

        // Placement
        mapObjectPlacement,
        lightPlacement,
        characterPlacement,
        armMapObjectPlacement,
        clearMapObjectPlacement,
        placePendingMapObjectAt,
        armLightPlacement,
        clearLightPlacement,
        placeLightAt,
        armCharacterPlacement,
        armEnemyPlacement,
        clearCharacterPlacement,

        // Z-level
        currentZLevel, setCurrentZLevel,
        stepZLevelUp,  stepZLevelDown,

        // Floor types
        floorTypes,
        replaceFloorTypes,

        // Lighting
        lighting,
        replaceLighting,
        setLightingDirection,
        addLightSource,
        updateLightSource,
        removeLightSource,

        // Characters
        updateCharacter,
        moveCharacter,
        handleCharacterAction,

        // Camera
        screenToWorld,
        worldToScreen,

        // Persistence
        saveMapToDatabase,
        loadMapFromDatabase,
        loadGameSnapshot,
    };

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

// ============================================================================
// HOOKS
// ============================================================================

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error("useGame must be used within a GameProvider");
    return context;
};