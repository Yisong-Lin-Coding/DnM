const DEFAULT_BACKGROUND_KEY = "calm1";
const MIN_Z_LEVEL = -20;
const MAX_Z_LEVEL = 20;
const MIN_HITBOX_SCALE = 0.1;
const MAX_HITBOX_SCALE = 5;

const DEFAULT_MAX_HP_BY_TERRAIN = {
    floor: 500,
    wall: 1200,
    obstacle: 700,
};

const DEFAULT_FLOOR_TYPE_BY_TERRAIN = {
    floor: "stoneFloor",
    wall: "stoneWall",
    obstacle: "woodenCrate",
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toPlainObject = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
};

const normalizeObjectType = (value) => {
    const type = String(value || "").trim().toLowerCase();
    if (type === "circle" || type === "rect" || type === "triangle") return type;
    return "circle";
};

const normalizeTerrainType = (value) => {
    const terrainType = String(value || "").trim().toLowerCase();
    if (terrainType === "floor" || terrainType === "wall" || terrainType === "obstacle") {
        return terrainType;
    }
    return "obstacle";
};

const clampZLevel = (value) =>
    Math.max(MIN_Z_LEVEL, Math.min(MAX_Z_LEVEL, Math.round(toNumber(value, 0))));

const clampHitboxScale = (value) =>
    Math.max(MIN_HITBOX_SCALE, Math.min(MAX_HITBOX_SCALE, toNumber(value, 1)));

const normalizeHexColor = (value, fallback = "#3B82F6") => {
    const raw = String(value || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
};

const normalizeFloorTypeID = (value, terrainType = "obstacle") => {
    const candidate = String(value || "").trim();
    if (candidate) return candidate;
    return DEFAULT_FLOOR_TYPE_BY_TERRAIN[terrainType] || DEFAULT_FLOOR_TYPE_BY_TERRAIN.obstacle;
};

const normalizeFloorTypeDefinition = (raw = {}, fallbackIndex = 0) => {
    const terrainType = normalizeTerrainType(raw.terrainType);
    const id = String(raw.id || `floorType_${fallbackIndex + 1}`).trim() || `floorType_${fallbackIndex + 1}`;
    return {
        id,
        name: String(raw.name || id).trim() || id,
        terrainType,
        description: String(raw.description || "").trim(),
        movementCost: Math.max(0, toNumber(raw.movementCost, terrainType === "floor" ? 1 : 0)),
        blocksMovement:
            typeof raw.blocksMovement === "boolean" ? raw.blocksMovement : terrainType !== "floor",
        effects: Array.isArray(raw.effects) ? raw.effects : [],
    };
};

const normalizeFloorTypeCollection = (input = []) => {
    const byID = new Map();
    (Array.isArray(input) ? input : []).forEach((entry, index) => {
        const normalized = normalizeFloorTypeDefinition(entry, index);
        if (!byID.has(normalized.id)) {
            byID.set(normalized.id, normalized);
        }
    });
    return Array.from(byID.values());
};

const getMaxObjectId = (objects = []) =>
    objects.reduce((max, obj) => Math.max(max, Math.round(toNumber(obj?.id, 0))), 0);

const normalizeMapObject = (raw = {}, fallbackId = 1) => {
    const type = normalizeObjectType(raw.type);
    const terrainType = normalizeTerrainType(raw.terrainType);
    const floorTypeId = normalizeFloorTypeID(raw.floorTypeId, terrainType);
    const defaultMaxHP = DEFAULT_MAX_HP_BY_TERRAIN[terrainType] || DEFAULT_MAX_HP_BY_TERRAIN.obstacle;
    const hasExplicitIndestructible =
        raw.maxHP === null ||
        raw.maxHP === "indestructible" ||
        raw.maxHP === "infinite";
    const maxHP = hasExplicitIndestructible
        ? null
        : Math.max(1, Math.round(toNumber(raw.maxHP, defaultMaxHP)));
    const hp =
        maxHP === null
            ? null
            : Math.max(0, Math.min(maxHP, Math.round(toNumber(raw.hp, maxHP))));
    const hitboxSource =
        raw.hitbox && typeof raw.hitbox === "object" && !Array.isArray(raw.hitbox)
            ? raw.hitbox
            : {};

    const normalized = {
        id: Math.max(1, Math.round(toNumber(raw.id, fallbackId))),
        type,
        terrainType,
        floorTypeId,
        zLevel: clampZLevel(raw.zLevel),
        x: Math.round(toNumber(raw.x, 0)),
        y: Math.round(toNumber(raw.y, 0)),
        z: Math.round(toNumber(raw.z, 0)),
        color: normalizeHexColor(raw.color),
        maxHP,
        hp,
        hitbox: {
            type: normalizeObjectType(hitboxSource.type || raw.hitboxType || type),
            offsetX: Math.round(toNumber(hitboxSource.offsetX, 0)),
            offsetY: Math.round(toNumber(hitboxSource.offsetY, 0)),
            scale: clampHitboxScale(hitboxSource.scale ?? raw.hitboxScale),
        },
    };

    if (type === "rect") {
        normalized.width = Math.max(1, toNumber(raw.width, 50));
        normalized.height = Math.max(1, toNumber(raw.height, 40));
    } else {
        normalized.size = Math.max(1, toNumber(raw.size, type === "triangle" ? 40 : 30));
    }

    return normalized;
};

const normalizeMapObjects = (input = []) => {
    const safeList = Array.isArray(input) ? input : [];
    return safeList.map((entry, index) => normalizeMapObject(entry, index + 1));
};

const normalizeSnapshot = (snapshot = {}) => {
    const safeSnapshot = toPlainObject(snapshot);
    const normalized = {
        backgroundKey: String(safeSnapshot.backgroundKey || DEFAULT_BACKGROUND_KEY).toLowerCase(),
        mapObjects: normalizeMapObjects(safeSnapshot.mapObjects || []),
        characters: Array.isArray(safeSnapshot.characters) ? safeSnapshot.characters : [],
        currentZLevel: clampZLevel(safeSnapshot.currentZLevel),
    };

    if (normalized.mapObjects.length === 0) {
        normalized.mapObjects = normalizeMapObjects([
            {
                id: 1,
                type: "rect",
                terrainType: "floor",
                floorTypeId: "stoneFloor",
                x: 100,
                y: 100,
                width: 100,
                height: 80,
                color: "#1D4ED8",
            },
        ]);
    }

    return normalized;
};

const createEngineState = (campaignID, snapshot = {}) => ({
    campaignID: String(campaignID || ""),
    revision: 1,
    updatedAt: Date.now(),
    snapshot: normalizeSnapshot(snapshot),
});

const updateEngineState = (state, statePatch = {}) => {
    const patch = toPlainObject(statePatch);
    if (!state || !state.snapshot) return state;

    const nextSnapshot = { ...state.snapshot };

    if (typeof patch.backgroundKey === "string" && patch.backgroundKey.trim()) {
        nextSnapshot.backgroundKey = patch.backgroundKey.trim().toLowerCase();
    }

    if (Array.isArray(patch.mapObjects)) {
        nextSnapshot.mapObjects = normalizeMapObjects(patch.mapObjects);
    }

    if (Array.isArray(patch.characters)) {
        nextSnapshot.characters = patch.characters;
    }

    if (Number.isFinite(Number(patch.currentZLevel))) {
        nextSnapshot.currentZLevel = clampZLevel(patch.currentZLevel);
    }

    state.snapshot = nextSnapshot;
    state.revision = Number(state.revision) + 1;
    state.updatedAt = Date.now();
    return state;
};

const findMapObject = (state, objectID) => {
    if (!state?.snapshot?.mapObjects) return null;
    const targetID = String(objectID || "");
    if (!targetID) return null;
    return state.snapshot.mapObjects.find((obj) => String(obj?.id) === targetID) || null;
};

const applyObjectHPDelta = (state, objectID, amount) => {
    const object = findMapObject(state, objectID);
    if (!object) {
        return { success: false, message: "Object not found" };
    }

    if (object.maxHP === null) {
        return { success: false, message: "Object is indestructible" };
    }

    const maxHP = Math.max(1, Math.round(toNumber(object.maxHP, 1)));
    const hp = Math.max(0, Math.min(maxHP, Math.round(toNumber(object.hp, maxHP))));
    const signedAmount = Math.round(toNumber(amount, 0));
    const nextHP = Math.max(0, Math.min(maxHP, hp - signedAmount));
    object.maxHP = maxHP;
    object.hp = nextHP;

    state.revision = Number(state.revision) + 1;
    state.updatedAt = Date.now();
    return {
        success: true,
        object,
    };
};

module.exports = {
    normalizeFloorTypeCollection,
    createEngineState,
    updateEngineState,
    applyObjectHPDelta,
    normalizeSnapshot,
    getMaxObjectId,
};
