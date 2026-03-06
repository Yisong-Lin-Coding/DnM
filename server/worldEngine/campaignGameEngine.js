const DEFAULT_BACKGROUND_KEY = "gray";
const MIN_Z_LEVEL = -20;
const MAX_Z_LEVEL = 20;
const MIN_HITBOX_SCALE = 0.1;
const MAX_HITBOX_SCALE = 5;
const LIGHT_AXIS_MIN = -1;
const LIGHT_AXIS_MAX = 1;
const LIGHT_INTENSITY_MIN = 0;
const LIGHT_INTENSITY_MAX = 2;
const LIGHT_BLEND_MIN = 0;
const LIGHT_BLEND_MAX = 1;
const LIGHT_RANGE_MIN = 10;
const LIGHT_RANGE_MAX = 5000;

const DEFAULT_LIGHTING = {
    enabled: true,
    ambient: 0.24,
    shadowEnabled: true,
    shadowStrength: 0.62,
    shadowSoftness: 0.55,
    shadowLength: 0.9,
    shadowBlend: 0.68,
    sources: [
        {
            id: "sun",
            name: "Sun",
            type: "directional",
            enabled: true,
            x: 0,
            y: 0,
            intensity: 0.8,
            blend: 0.7,
            color: "#ffffff",
        }
    ]
};

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

const DEFAULT_ELEVATION_HEIGHT_BY_TERRAIN = {
    floor: 0,
    wall: 150,
    obstacle: 80,
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toNonNegativeNumber = (value, fallback = 0) =>
    Math.max(0, toNumber(value, fallback));

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

const clampLightAxis = (value) =>
    Math.max(LIGHT_AXIS_MIN, Math.min(LIGHT_AXIS_MAX, toNumber(value, 0)));

const normalizeFloorVisualType = (value) =>
    String(value || "").trim().toLowerCase() === "effect" ? "effect" : "base";

const normalizeHexColor = (value, fallback = "#3B82F6") => {
    const raw = String(value || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
};

const normalizeMapAssetKey = (value) => String(value || "").trim().toLowerCase();

const normalizeLightingDirection = (value = {}) => {
    const x = clampLightAxis(value?.x);
    const y = clampLightAxis(value?.y);
    const magnitude = Math.hypot(x, y);
    if (magnitude <= 1 || magnitude === 0) {
        return { x, y };
    }
    return {
        x: x / magnitude,
        y: y / magnitude,
    };
};

const normalizeLightSourceType = (value) =>
    String(value || "").trim().toLowerCase() === "point" ? "point" : "directional";

const normalizeLightingSource = (raw = {}, fallbackIndex = 0) => {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const type = normalizeLightSourceType(source.type);
    const sourceInput =
        source?.source && typeof source.source === "object" && !Array.isArray(source.source)
            ? source.source
            : source;

    const normalized = {
        id: String(source.id || `light_${fallbackIndex + 1}`).trim() || `light_${fallbackIndex + 1}`,
        name:
            String(source.name || (type === "point" ? `Lamp ${fallbackIndex + 1}` : `Light ${fallbackIndex + 1}`))
                .trim() || (type === "point" ? `Lamp ${fallbackIndex + 1}` : `Light ${fallbackIndex + 1}`),
        type,
        enabled: source.enabled !== false,
        intensity: Math.max(LIGHT_INTENSITY_MIN, Math.min(LIGHT_INTENSITY_MAX, toNumber(source.intensity, 0.8))),
        blend: Math.max(LIGHT_BLEND_MIN, Math.min(LIGHT_BLEND_MAX, toNumber(source.blend, 0.7))),
        color: normalizeHexColor(source.color, "#ffffff"),
    };

    if (type === "point") {
        normalized.worldX = toNumber(source.worldX ?? source.position?.x, 0);
        normalized.worldY = toNumber(source.worldY ?? source.position?.y, 0);
        normalized.range = Math.max(LIGHT_RANGE_MIN, Math.min(LIGHT_RANGE_MAX, toNumber(source.range, 420)));
    } else {
        const direction = normalizeLightingDirection({
            x: sourceInput?.x,
            y: sourceInput?.y,
        });
        normalized.x = direction.x;
        normalized.y = direction.y;
    }

    return normalized;
};

const normalizeLightingConfig = (value = {}) => {
    const sourceInput =
        value?.source && typeof value.source === "object" && !Array.isArray(value.source)
            ? value.source
            : value;
    
    const rawSources = Array.isArray(value?.sources) ? value.sources : [];
    let sources = rawSources.map((entry, index) => normalizeLightingSource(entry, index));
    
    // Backward compatibility: if no sources array, create one from legacy format
    if (sources.length === 0) {
        sources = [
            normalizeLightingSource(
                {
                    type: "directional",
                    x: sourceInput?.x,
                    y: sourceInput?.y,
                    intensity: value?.intensity,
                    blend: value?.blend,
                },
                0
            ),
        ];
    }

    return {
        enabled: value?.enabled !== false,
        ambient: Math.max(0, Math.min(0.95, toNumber(value?.ambient, DEFAULT_LIGHTING.ambient))),
        shadowEnabled: value?.shadowEnabled !== false,
        shadowStrength: Math.max(0, Math.min(1, toNumber(value?.shadowStrength, DEFAULT_LIGHTING.shadowStrength))),
        shadowSoftness: Math.max(0, Math.min(1, toNumber(value?.shadowSoftness, DEFAULT_LIGHTING.shadowSoftness))),
        shadowLength: Math.max(0, Math.min(2, toNumber(value?.shadowLength, DEFAULT_LIGHTING.shadowLength))),
        shadowBlend: Math.max(0, Math.min(1, toNumber(value?.shadowBlend, DEFAULT_LIGHTING.shadowBlend))),
        sources,
    };
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
        floorVisualType:
            terrainType === "floor"
                ? normalizeFloorVisualType(raw.floorVisualType || raw.visualType)
                : "base",
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

const resolveElevationInput = (raw = {}, type = "circle", terrainType = "obstacle") => {
    if (raw?.elevationHeight != null) return raw.elevationHeight;
    if (raw?.height3D != null) return raw.height3D;
    if (raw?.objectHeight != null) return raw.objectHeight;
    if (raw?.shadowHeight != null) return raw.shadowHeight;
    if (type !== "rect" && raw?.height != null) return raw.height;
    return (
        DEFAULT_ELEVATION_HEIGHT_BY_TERRAIN[terrainType] ??
        DEFAULT_ELEVATION_HEIGHT_BY_TERRAIN.obstacle
    );
};

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
        mapAssetKey: normalizeMapAssetKey(raw.mapAssetKey || raw.mapKey || raw.mapImageKey),
        elevationHeight: Math.round(
            toNonNegativeNumber(resolveElevationInput(raw, type, terrainType), 0)
        ),
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

const getObjectBounds = (obj = {}) => {
    const type = normalizeObjectType(obj.hitbox?.type || obj.type);
    const scale = clampHitboxScale(obj.hitbox?.scale ?? 1);
    const offsetX = toNumber(obj.hitbox?.offsetX, 0);
    const offsetY = toNumber(obj.hitbox?.offsetY, 0);
    const x = toNumber(obj.x, 0) + offsetX;
    const y = toNumber(obj.y, 0) + offsetY;

    if (type === "rect") {
        const halfWidth = Math.max(1, toNumber(obj.width, 50)) * scale / 2;
        const halfHeight = Math.max(1, toNumber(obj.height, 40)) * scale / 2;
        return {
            minX: x - halfWidth,
            maxX: x + halfWidth,
            minY: y - halfHeight,
            maxY: y + halfHeight,
        };
    }

    const radius = Math.max(1, toNumber(obj.size, type === "triangle" ? 40 : 30)) * scale;
    return {
        minX: x - radius,
        maxX: x + radius,
        minY: y - radius,
        maxY: y + radius,
    };
};

const doBoundsOverlap = (a, b) =>
    a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;

const getCorners = (obj) => {
    const type = normalizeObjectType(obj.hitbox?.type || obj.type);
    const scale = clampHitboxScale(obj.hitbox?.scale ?? 1);
    const offsetX = toNumber(obj.hitbox?.offsetX, 0);
    const offsetY = toNumber(obj.hitbox?.offsetY, 0);
    const x = toNumber(obj.x, 0) + offsetX;
    const y = toNumber(obj.y, 0) + offsetY;
    const rotation = toNumber(obj.rotation, 0);
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    let localCorners = [];
    if (type === "rect") {
        const w = Math.max(1, toNumber(obj.width, 50)) * scale / 2;
        const h = Math.max(1, toNumber(obj.height, 40)) * scale / 2;
        localCorners = [{x:-w,y:-h}, {x:w,y:-h}, {x:w,y:h}, {x:-w,y:h}];
    } else if (type === "triangle") {
        const s = Math.max(1, toNumber(obj.size, 40)) * scale;
        localCorners = [{x:0,y:-s}, {x:-s,y:s}, {x:s,y:s}];
    } else {
        return null;
    }

    return localCorners.map(p => ({
        x: x + (p.x * cos - p.y * sin),
        y: y + (p.x * sin + p.y * cos)
    }));
};

const projectPolygon = (axis, corners) => {
    let min = Infinity;
    let max = -Infinity;
    for (const p of corners) {
        const dot = p.x * axis.x + p.y * axis.y;
        if (dot < min) min = dot;
        if (dot > max) max = dot;
    }
    return { min, max };
};

const checkPolygonsCollide = (cornersA, cornersB) => {
    const polygons = [cornersA, cornersB];
    for (const polygon of polygons) {
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];
            const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
            const axis = { x: -edge.y, y: edge.x };
            const projA = projectPolygon(axis, cornersA);
            const projB = projectPolygon(axis, cornersB);
            if (projA.max < projB.min || projB.max < projA.min) return false;
        }
    }
    return true;
};

const checkCircleRectCollision = (cx, cy, cr, rx, ry, rw, rh, rot) => {
    const rad = (-rot * Math.PI) / 180;
    const dx = cx - rx;
    const dy = cy - ry;
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
    const closestX = Math.max(-rw / 2, Math.min(localX, rw / 2));
    const closestY = Math.max(-rh / 2, Math.min(localY, rh / 2));
    const distX = localX - closestX;
    const distY = localY - closestY;
    return (distX * distX + distY * distY) < (cr * cr);
};

const checkCircleTriangleCollision = (cx, cy, cr, tx, ty, size, rot) => {
    const rad = (-rot * Math.PI) / 180;
    const dx = cx - tx;
    const dy = cy - ty;
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
    
    const p0 = { x: 0, y: -size };
    const p1 = { x: -size, y: size };
    const p2 = { x: size, y: size };

    const area = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const p = { x: localX, y: localY };
    const s1 = area(p, p0, p1);
    const s2 = area(p, p1, p2);
    const s3 = area(p, p2, p0);
    const hasNeg = s1 < 0 || s2 < 0 || s3 < 0;
    const hasPos = s1 > 0 || s2 > 0 || s3 > 0;
    if (!(hasNeg && hasPos)) return true;

    const distSq = (px, py, x1, y1, x2, y2) => {
        const l2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
        if (l2 === 0) return (px - x1) ** 2 + (py - y1) ** 2;
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return (px - (x1 + t * (x2 - x1))) ** 2 + (py - (y1 + t * (y2 - y1))) ** 2;
    };

    const r2 = cr * cr;
    if (distSq(localX, localY, 0, -size, -size, size) < r2) return true;
    if (distSq(localX, localY, -size, size, size, size) < r2) return true;
    if (distSq(localX, localY, size, size, 0, -size) < r2) return true;
    return false;
};

const doPreciseOverlap = (objA, objB) => {
    const getGeo = (obj) => {
        const type = normalizeObjectType(obj.type);
        const scale = clampHitboxScale(obj.hitbox?.scale ?? 1);
        const x = toNumber(obj.x, 0) + toNumber(obj.hitbox?.offsetX, 0);
        const y = toNumber(obj.y, 0) + toNumber(obj.hitbox?.offsetY, 0);
        const rotation = toNumber(obj.rotation, 0);
        const size = Math.max(1, toNumber(obj.size, 30)) * scale;
        const width = Math.max(1, toNumber(obj.width, 50)) * scale;
        const height = Math.max(1, toNumber(obj.height, 40)) * scale;
        return { x, y, rotation, size, width, height, type };
    };

    const a = getGeo(objA);
    const b = getGeo(objB);

    if (a.type === "circle" && b.type === "circle") {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const rSum = a.size + b.size;
        return (dx * dx + dy * dy) < (rSum * rSum);
    }

    if (a.type === "circle" && b.type === "rect") return checkCircleRectCollision(a.x, a.y, a.size, b.x, b.y, b.width, b.height, b.rotation);
    if (a.type === "rect" && b.type === "circle") return checkCircleRectCollision(b.x, b.y, b.size, a.x, a.y, a.width, a.height, a.rotation);
    
    if (a.type === "circle" && b.type === "triangle") return checkCircleTriangleCollision(a.x, a.y, a.size, b.x, b.y, b.size, b.rotation);
    if (a.type === "triangle" && b.type === "circle") return checkCircleTriangleCollision(b.x, b.y, b.size, a.x, a.y, a.size, a.rotation);

    const cornersA = getCorners(objA);
    const cornersB = getCorners(objB);
    if (cornersA && cornersB) {
        return checkPolygonsCollide(cornersA, cornersB);
    }
    return true;
};

const isWallObject = (obj = {}) => normalizeTerrainType(obj.terrainType) === "wall";

const wouldWallOverlap = (candidate = {}, objects = [], ignoreId = null) => {
    if (!isWallObject(candidate)) return false;
    const candidateBounds = getObjectBounds(candidate);
    const candidateLevel = clampZLevel(candidate.zLevel);
    const ignoredValue = toNumber(ignoreId, NaN);
    const ignored =
        Number.isFinite(ignoredValue) && ignoredValue > 0 ? Math.round(ignoredValue) : null;

    return (Array.isArray(objects) ? objects : []).some((obj) => {
        if (!isWallObject(obj)) return false;
        if (clampZLevel(obj.zLevel) !== candidateLevel) return false;
        if (ignored != null && Math.round(toNumber(obj.id, -1)) === ignored) return false;
        if (!doBoundsOverlap(candidateBounds, getObjectBounds(obj))) return false;
        return doPreciseOverlap(candidate, obj);
    });
};

const enforceWallOverlapRules = (objects = []) => {
    const accepted = [];
    (Array.isArray(objects) ? objects : []).forEach((obj) => {
        if (wouldWallOverlap(obj, accepted)) {
            return;
        }
        accepted.push(obj);
    });
    return accepted;
};

const normalizeMapObjects = (input = []) => {
    const safeList = Array.isArray(input) ? input : [];
    const normalized = safeList.map((entry, index) => normalizeMapObject(entry, index + 1));
    return enforceWallOverlapRules(normalized);
};

const normalizeJournalState = (raw = {}) => {
    const safe = toPlainObject(raw);
    const documents = Array.isArray(safe.documents)
        ? safe.documents
              .map((doc) => {
                  const safeDoc = toPlainObject(doc);
                  const id = String(safeDoc.id || "").trim();
                  if (!id) return null;
                  const createdAt = Number(safeDoc.createdAt);
                  const updatedAt = Number(safeDoc.updatedAt);
                  const type = safeDoc.type === "team" ? "team" : "diary";
                  return {
                      id,
                      type,
                      ownerId: safeDoc.ownerId != null ? String(safeDoc.ownerId) : "",
                      title: String(safeDoc.title || "Untitled").trim() || "Untitled",
                      content: safeDoc.content != null ? String(safeDoc.content) : "",
                      tags: Array.isArray(safeDoc.tags)
                          ? safeDoc.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
                          : [],
                      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
                      updatedAt: Number.isFinite(updatedAt)
                          ? updatedAt
                          : Number.isFinite(createdAt)
                              ? createdAt
                              : Date.now(),
                      groupId: safeDoc.groupId != null && safeDoc.groupId !== ""
                          ? String(safeDoc.groupId)
                          : null,
                  };
              })
              .filter(Boolean)
        : [];
    const groups = Array.isArray(safe.groups)
        ? safe.groups
              .map((group) => {
                  const safeGroup = toPlainObject(group);
                  const id = String(safeGroup.id || "").trim();
                  if (!id) return null;
                  return {
                      id,
                      name: String(safeGroup.name || "Group").trim() || "Group",
                      icon: safeGroup.icon != null ? String(safeGroup.icon) : "",
                      iconColor: safeGroup.iconColor != null ? String(safeGroup.iconColor) : "",
                      type: safeGroup.type === "team" ? "team" : "diary",
                      ownerId: safeGroup.ownerId != null ? String(safeGroup.ownerId) : "",
                  };
              })
              .filter(Boolean)
        : [];
    return { documents, groups };
};

const normalizeQuestState = (raw = {}) => {
    const safe = toPlainObject(raw);
    const quests = Array.isArray(safe.quests)
        ? safe.quests
              .map((quest) => {
                  const safeQuest = toPlainObject(quest);
                  return Object.keys(safeQuest).length > 0 ? { ...safeQuest } : null;
              })
              .filter(Boolean)
        : [];
    return {
        ...safe,
        quests,
    };
};

const normalizeSnapshot = (snapshot = {}) => {
    const safeSnapshot = toPlainObject(snapshot);
    const normalized = {
        backgroundKey: String(safeSnapshot.backgroundKey || DEFAULT_BACKGROUND_KEY).toLowerCase(),
        mapObjects: normalizeMapObjects(safeSnapshot.mapObjects || []),
        characters: Array.isArray(safeSnapshot.characters) ? safeSnapshot.characters : [],
        currentZLevel: clampZLevel(safeSnapshot.currentZLevel),
        lighting: normalizeLightingConfig(safeSnapshot.lighting || DEFAULT_LIGHTING),
        journalState: normalizeJournalState(safeSnapshot.journalState),
        questState: normalizeQuestState(safeSnapshot.questState),
    };

    if (normalized.mapObjects.length === 0) {
        normalized.mapObjects = normalizeMapObjects([
            {
                id: 1,
                type: "rect",
                terrainType: "floor",
                floorTypeId: "stoneFloor",
                elevationHeight: 0,
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

    if (patch.lighting && typeof patch.lighting === "object") {
        nextSnapshot.lighting = normalizeLightingConfig(patch.lighting);
    }

    if (patch.journalState && typeof patch.journalState === "object") {
        nextSnapshot.journalState = normalizeJournalState(patch.journalState);
    }

    if (patch.questState && typeof patch.questState === "object") {
        nextSnapshot.questState = normalizeQuestState(patch.questState);
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

const removeCharacter = (state, characterID) => {
    if (!state?.snapshot?.characters) return { success: false, message: "No characters found" };
    const targetID = String(characterID || "");
    const initialLength = state.snapshot.characters.length;
    state.snapshot.characters = state.snapshot.characters.filter((c) => String(c.id) !== targetID);

    if (state.snapshot.characters.length === initialLength) {
        return { success: false, message: "Character not found" };
    }

    state.revision = Number(state.revision) + 1;
    state.updatedAt = Date.now();
    return { success: true };
};

module.exports = {
    normalizeFloorTypeCollection,
    normalizeLightingConfig,
    normalizeLightingSource,
    createEngineState,
    updateEngineState,
    applyObjectHPDelta,
    removeCharacter,
    normalizeSnapshot,
    getMaxObjectId,
};
