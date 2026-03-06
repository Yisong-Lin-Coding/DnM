const mongoose = require("mongoose");
const Campaign = require("../data/mongooseDataStructure/campaign");
const GameSave = require("../data/mongooseDataStructure/gameSave");
const Player = require("../data/mongooseDataStructure/player");
const Messages = require("../data/mongooseDataStructure/messages");
const Character = require("../data/mongooseDataStructure/character");
const Enemy = require("../data/mongooseDataStructure/enemy");
const CharacterBuilder = require("../worldEngine/Character/characterbuilder");
const GameEngine = require("../worldEngine/combatEngine");
const EFFECTS = require("../data/gameFiles/modifiers/effects");
const rawFloorTypes = require("../data/gameFiles/modifiers/floorTypes");
const VisionSystem = require("../worldEngine/visionSystem");
const {
    normalizeFloorTypeCollection,
    normalizeLightingConfig,
    createEngineState,
    updateEngineState,
    applyObjectHPDelta,
    removeCharacter,
} = require("../worldEngine/campaignGameEngine");
const {
    sanitizeCampaignStatePatch,
    extractCampaignStateFromCharacter,
    findCampaignCharacterState,
    upsertCampaignCharacterState,
    toObjectIdString,
} = require("../handlers/campaignCharacterState");

const MIN_ALLOWED_PLAYERS = 2;
const MAX_ALLOWED_PLAYERS = 12;
const DEFAULT_MAX_PLAYERS = 6;
const DEFAULT_CHARACTER_MOVEMENT = 30;
const MAX_AUTO_SAVE_HISTORY = 5;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 6;
const GAME_ROOM_PREFIX = "campaign_game_room";
const GAME_PLAYER_ROOM_SUFFIX = "players";
const GAME_DM_ROOM_SUFFIX = "dm";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const safeCallback = (callback) => (typeof callback === "function" ? callback : () => {});

const sanitizeText = (value, maxLength = 250) =>
    String(value || "")
        .trim()
        .slice(0, maxLength);

const sanitizeJournalTag = (value) => sanitizeText(value, 40);
const sanitizeHexColor = (value) => {
    const raw = String(value || "").trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return raw;
    return "";
};

const sanitizeCode = (value) =>
    String(value || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

const toPlainObject = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
};

const mergeSnapshotPatch = (baseSnapshot = {}, patch = {}) => {
    const base = toPlainObject(baseSnapshot);
    const safePatch = toPlainObject(patch);
    return { ...base, ...safePatch };
};

const pruneSnapshotForSave = (snapshot = {}) => {
    const safe = toPlainObject(snapshot);
    const next = { ...safe };

    if (Array.isArray(next.characters)) {
        next.characters = next.characters.map((char) => {
            if (!char || typeof char !== "object") return char;
            const { visionRays, _debugLightLevel, ...rest } = char;
            return rest;
        });
    }

    if (next.lightingPolygons) {
        delete next.lightingPolygons;
    }

    return next;
};

const cloneJournalState = (journalState = {}) => ({
    documents: Array.isArray(journalState?.documents)
        ? journalState.documents.map((doc) => ({ ...toPlainObject(doc) }))
        : [],
    groups: Array.isArray(journalState?.groups)
        ? journalState.groups.map((group) => ({ ...toPlainObject(group) }))
        : [],
});

const normalizeJournalDocInput = (doc = {}, playerID) => {
    const safeDoc = toPlainObject(doc);
    const id = String(safeDoc.id || "").trim();
    const type = safeDoc.type === "team" ? "team" : "diary";
    const createdAt = Number(safeDoc.createdAt);
    const updatedAt = Number(safeDoc.updatedAt);
    return {
        id,
        type,
        ownerId: String(safeDoc.ownerId || playerID || ""),
        title: sanitizeText(safeDoc.title || "Untitled", 120) || "Untitled",
        content: safeDoc.content != null ? String(safeDoc.content) : "",
        tags: Array.isArray(safeDoc.tags)
            ? safeDoc.tags.map((tag) => sanitizeJournalTag(tag)).filter(Boolean)
            : [],
        createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
        updatedAt: Number.isFinite(updatedAt)
            ? updatedAt
            : Number.isFinite(createdAt)
                ? createdAt
                : Date.now(),
        groupId: safeDoc.groupId != null && safeDoc.groupId !== "" ? String(safeDoc.groupId) : null,
    };
};

const normalizeJournalGroupInput = (group = {}, playerID) => {
    const safeGroup = toPlainObject(group);
    const id = String(safeGroup.id || "").trim();
    const type = safeGroup.type === "team" ? "team" : "diary";
    return {
        id,
        name: sanitizeText(safeGroup.name || "Group", 120) || "Group",
        icon: safeGroup.icon != null ? String(safeGroup.icon) : "",
        iconColor: sanitizeHexColor(safeGroup.iconColor),
        type,
        ownerId: String(safeGroup.ownerId || playerID || ""),
    };
};

const applyJournalDocUpdates = (doc = {}, updates = {}, isDM = false) => {
    const nextDoc = { ...doc };
    if (typeof updates.title === "string") {
        nextDoc.title = sanitizeText(updates.title || "Untitled", 120) || "Untitled";
    }
    if (updates.contentPatch && typeof updates.contentPatch === "object") {
        const base = String(nextDoc.content || "");
        const startRaw = Number(updates.contentPatch.start);
        const deleteRaw = Number(updates.contentPatch.deleteCount);
        const start = Number.isFinite(startRaw)
            ? Math.max(0, Math.min(base.length, Math.round(startRaw)))
            : 0;
        const deleteCount = Number.isFinite(deleteRaw)
            ? Math.max(0, Math.min(base.length - start, Math.round(deleteRaw)))
            : 0;
        const insertText = typeof updates.contentPatch.text === "string"
            ? updates.contentPatch.text
            : "";
        nextDoc.content = `${base.slice(0, start)}${insertText}${base.slice(start + deleteCount)}`;
    } else if (typeof updates.content === "string") {
        nextDoc.content = updates.content;
    }
    if (Array.isArray(updates.tags)) {
        nextDoc.tags = updates.tags.map((tag) => sanitizeJournalTag(tag)).filter(Boolean);
    }
    if (updates.groupId === null || typeof updates.groupId === "string") {
        nextDoc.groupId = updates.groupId ? String(updates.groupId) : null;
    }
    if (isDM && (updates.type === "team" || updates.type === "diary")) {
        nextDoc.type = updates.type;
    }
    if (isDM && updates.ownerId != null) {
        nextDoc.ownerId = String(updates.ownerId);
    }
    nextDoc.updatedAt = Date.now();
    return nextDoc;
};

const FLOOR_TYPES = normalizeFloorTypeCollection(rawFloorTypes);
const campaignRuntimeStateByID = new Map();
const campaignGameEngineByID = new Map();

const getOrCreateGameEngine = (campaignID) => {
    const key = String(campaignID || '');
    if (!campaignGameEngineByID.has(key)) {
        campaignGameEngineByID.set(key, new GameEngine(key));
    }
    return campaignGameEngineByID.get(key);
};


const getCampaignGameRoom = (campaignID) => `${GAME_ROOM_PREFIX}:${String(campaignID || "")}`;
const getCampaignPlayersRoom = (campaignID) =>
    `${GAME_ROOM_PREFIX}:${GAME_PLAYER_ROOM_SUFFIX}:${String(campaignID || "")}`;
const getCampaignDMRoom = (campaignID) =>
    `${GAME_ROOM_PREFIX}:${GAME_DM_ROOM_SUFFIX}:${String(campaignID || "")}`;

const cloneEngineState = (state) => ({
    campaignID: String(state?.campaignID || ""),
    revision: Number(state?.revision) || 0,
    updatedAt: Number(state?.updatedAt) || Date.now(),
    snapshot: (() => {
        try {
            return JSON.parse(JSON.stringify(toPlainObject(state?.snapshot)));
        } catch {
            return toPlainObject(state?.snapshot);
        }
    })(),
});

// ─────────────────────────────────────────────────────────────────────────────
// syncEngineCharacterToToken
//
// Reads every computed property from a live CHARACTER engine instance and
// writes it into the corresponding flat snapshot token so that clients always
// receive the fully-resolved state (modifier pipeline applied) rather than
// stale raw base values.
//
// Call this after ANY mutation to the engine character (status effects added/
// removed, resources adjusted, turn-start tick damage, action execution, etc.).
// ─────────────────────────────────────────────────────────────────────────────
const syncEngineCharacterToToken = (engineChar, token) => {
    if (!engineChar || !token) return;

    // HP / MP / STA — use the computed getter so max reflects the
    // CON/WIS formula and the onHPCalc/onMPCalc/onSTACalc pipelines.
    try {
        const hp = engineChar.HP;
        if (hp && typeof hp === "object") {
            const oldHP = token.HP?.current;
            token.HP = { max: hp.max, current: hp.current, temp: hp.temp ?? 0 };
            if (oldHP !== hp.current) {
                console.log(`[SYNC] ${engineChar.name} HP synced to token: ${oldHP} → ${hp.current}`);
            }
        }
    } catch (_) {}
    try {
        const mp = engineChar.MP;
        if (mp && typeof mp === "object") token.MP = { max: mp.max, current: mp.current, temp: mp.temp ?? 0 };
    } catch (_) {}
    try {
        const sta = engineChar.STA;
        if (sta && typeof sta === "object") token.STA = { max: sta.max, current: sta.current, temp: sta.temp ?? 0 };
    } catch (_) {}

    // Perception (INT + onPerceptionCalc pipeline)
    try {
        // DEBUG: Log statusEffects on engine char before getting perception
        if (engineChar.statusEffects && engineChar.statusEffects.length > 0) {
            const perceptionEffects = engineChar.statusEffects.filter(e => 
                e.name?.toLowerCase().includes('perception') || e.id?.toLowerCase().includes('perception')
            );
            if (perceptionEffects.length > 0) {
                console.log(`[SYNC] ${engineChar.name} has ${perceptionEffects.length} perception effects before getting perception getter`);
            }
        }
        
        const p = engineChar.perception;
        if (Number.isFinite(p)) {
            const oldP = token.perception;
            token.perception = p;
            if (oldP !== p) {
                console.log(`[SYNC] ${engineChar.name} perception synced to token: ${oldP} → ${p}`);
            }
        }
    } catch (err) {
        console.error(`[SYNC] Failed to sync perception for ${engineChar.name}:`, err.message);
    }

    // Stealth (DEX + WIS + onStealthCalc pipeline)
    try {
        const s = engineChar.stealth;
        if (Number.isFinite(s)) {
            token.stealth = s;
            console.log(`[SYNC] ${engineChar.name} stealth synced to token: ${s}`);
        }
    } catch (err) {
        console.error(`[SYNC] Failed to sync stealth for ${engineChar.name}:`, err.message);
    }

    // Vision (INT × scale + onVisionCalc pipeline)
    try {
        const v = engineChar.vision;
        if (v && typeof v === "object") {
            token.visionDistance = v.distance;
            token.visionAngle    = v.angle;
            token.visionRadius   = v.radius;
            if (token.vision && typeof token.vision === "object") {
                token.vision.distance = v.distance;
                token.vision.angle    = v.angle;
                token.vision.radius   = v.radius;
            }
        }
    } catch (_) {}

    // Movement (class base + onMovementCalc pipeline)
    try {
        const move = engineChar.movement;
        if (Number.isFinite(move)) {
            token.movement    = move;
            token.movementMax = move;
            token.speed       = move;
        }
    } catch (_) {}

    // Armor Rating
    try {
        const ar = engineChar.AR;
        if (ar && typeof ar === "object") token.AR = { ...ar };
    } catch (_) {}

    // Defenses (resistances + immunities, expanded through onDefenseCalc)
    try {
        const def = engineChar.defenses;
        if (def && typeof def === "object") {
            if (def.resistances) token.resistances = { ...def.resistances };
            if (def.immunities)  token.immunities  = { ...def.immunities };
        }
    } catch (_) {}

    // Computed stats (all 7, with race/class/subrace modifiers + onStatCalc pipeline)
    // NOTE: CHARACTER.stats returns { STR: {score, modifier}, ... } which is incompatible
    // with the flat-number format the client components expect. Do NOT sync stats here —
    // they are set once by CharacterBuilder and don't change mid-session.
    // The HP/MP/STA/perception/vision/AR getters already incorporate any stat-affecting
    // modifiers via their own pipelines, so gameplay is fully correct without this.

    // Status effects (already a plain array, but ensure snapshot is in sync)
    try {
        if (Array.isArray(engineChar.statusEffects)) {
            token.statusEffects = JSON.parse(JSON.stringify(engineChar.statusEffects));
        }
    } catch (_) {}
};

// ─────────────────────────────────────────────────────────────────────────────
// syncTokenToEngineCharacter
//
// The inverse of syncEngineCharacterToToken — copies mutable runtime state
// from the snapshot token BACK into a live CHARACTER engine instance so that
// the engine stays in sync after executeAndSyncAction (which operates on a
// throwaway CHARACTER built from DB, then writes results to the token).
// ─────────────────────────────────────────────────────────────────────────────
const syncTokenToEngineCharacter = (token, engineChar) => {
    if (!token || !engineChar) return;

    // HP / MP / STA — write the mutable _base* fields; do NOT touch max
    // (max is recomputed from the CON/WIS formula by the getters).
    if (token.HP && typeof token.HP === 'object' && engineChar._baseHP) {
        if (Number.isFinite(Number(token.HP.current))) engineChar._baseHP.current = Number(token.HP.current);
        if (Number.isFinite(Number(token.HP.temp)))    engineChar._baseHP.temp    = Number(token.HP.temp);
    }
    if (token.MP && typeof token.MP === 'object' && engineChar._baseMP) {
        if (Number.isFinite(Number(token.MP.current))) engineChar._baseMP.current = Number(token.MP.current);
        if (Number.isFinite(Number(token.MP.temp)))    engineChar._baseMP.temp    = Number(token.MP.temp);
    }
    if (token.STA && typeof token.STA === 'object' && engineChar._baseSTA) {
        if (Number.isFinite(Number(token.STA.current))) engineChar._baseSTA.current = Number(token.STA.current);
        if (Number.isFinite(Number(token.STA.temp)))    engineChar._baseSTA.temp    = Number(token.STA.temp);
    }

    // Position
    if (token.position && typeof token.position === 'object') {
        engineChar.position = { ...token.position };
    }

    // Movement remaining
    if (Number.isFinite(Number(token.movement))) {
        engineChar._baseMovement = Number(token.movement);
    }

    // Action points
    if (token.actionPoints && typeof token.actionPoints === 'object') {
        engineChar._actionPoints = JSON.parse(JSON.stringify(token.actionPoints));
    }

    // Status effects (JSON copy — functions come from EFFECTS catalog lookup in getModifiersForHook)
    if (Array.isArray(token.statusEffects)) {
        engineChar.statusEffects = JSON.parse(JSON.stringify(token.statusEffects));
    }

    if (typeof engineChar.invalidateCache === 'function') engineChar.invalidateCache();
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeAngle = (value) => {
    let angle = Number(value) || 0;
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
};

const buildVisionConfigFromToken = (token = {}) => {
    const vision = toPlainObject(token?.vision);
    const distance = toNumber(vision.distance, toNumber(token?.visionDistance, 0));
    const angle = toNumber(vision.angle, toNumber(token?.visionArc, 0));
    const radius = Math.max(
        0,
        toNumber(vision.radius, distance > 0 ? distance * 0.2 : 0)
    );

    if (!distance && !angle && !radius) return null;
    return { distance, angle, radius };
};

const ensureTokenVision = (token = {}) => {
    if (!token || typeof token !== "object") return null;
    const vision = buildVisionConfigFromToken(token);
    if (vision) {
        token.vision = vision;
        if (!Number.isFinite(Number(token.visionDistance))) token.visionDistance = vision.distance;
        if (!Number.isFinite(Number(token.visionArc))) token.visionArc = vision.angle;
    }
    return vision;
};

const recalculateVisionRaysForToken = (token, options = {}) => {
    if (!token || typeof VisionSystem.castVisionRaysServerSide !== "function") return;
    const vision = ensureTokenVision(token);
    if (!vision || !vision.distance || !vision.angle) {
        token.visionRays = [];
        return;
    }

    const snapshot = options.snapshot;
    const desiredRayCount = options.rayCount ?? snapshot?.visionRayCount ?? 256;
    const safeRayCount = clamp(Math.round(toNumber(desiredRayCount, 256)), 4, 256);

    let lightFunction = options.lightFunction || null;
    if (!lightFunction && snapshot) {
        const lightingConfig = normalizeLightingConfig(snapshot?.lighting || {});
        if (lightingConfig.enabled) {
            lightFunction = (worldX, worldY) => calculateLightAtPoint(worldX, worldY, snapshot);
        }
    }

    let occlusionSegments = Array.isArray(options.occlusionSegments) ? options.occlusionSegments : null;
    if (!occlusionSegments && snapshot) {
        occlusionSegments = buildVisionOcclusionSegments(snapshot);
    }
    const occlusionFunction =
        occlusionSegments && occlusionSegments.length > 0
            ? (worldX, worldY, rayAngle) =>
                  getNearestRayObstacleDistance(worldX, worldY, rayAngle, occlusionSegments)
            : null;

    const rays = VisionSystem.castVisionRaysServerSide({
        character: token,
        visionDistance: vision.distance,
        visionAngle: vision.angle,
        rayCount: safeRayCount,
        lightFunction,
        occlusionFunction,
    });
    token.visionRays = Array.isArray(rays) ? rays : [];

    // Debug: capture server-calculated light level at character position
    if (snapshot) {
        const sampleX = toNumber(token?.position?.x, 0);
        const sampleY = toNumber(token?.position?.y, 0);
        let debugLight = null;
        if (typeof lightFunction === "function") {
            const candidate = lightFunction(sampleX, sampleY);
            if (Number.isFinite(Number(candidate))) {
                debugLight = Number(candidate);
            }
        }
        if (debugLight == null && Number.isFinite(Number(token?.lightLevel))) {
            debugLight = Number(token.lightLevel);
        }
        token._debugLightLevel = debugLight;
    }
};

const recalculateVisionRaysForSnapshot = (runtimeState, rayCountOverride = null) => {
    if (!runtimeState?.snapshot || !Array.isArray(runtimeState.snapshot.characters)) return;
    const snapshot = runtimeState.snapshot;
    const desiredRayCount = rayCountOverride ?? snapshot.visionRayCount ?? 256;
    const safeRayCount = clamp(Math.round(toNumber(desiredRayCount, 256)), 4, 256);
    snapshot.visionRayCount = safeRayCount;

    const occlusionSegments = buildVisionOcclusionSegments(snapshot);
    snapshot.characters.forEach((token) =>
        recalculateVisionRaysForToken(token, {
            snapshot,
            rayCount: safeRayCount,
            occlusionSegments,
        })
    );
};

const normalizeTerrainType = (value) => {
    const terrain = String(value || "")
        .trim()
        .toLowerCase();
    if (terrain === "floor" || terrain === "wall" || terrain === "obstacle") {
        return terrain;
    }
    return "obstacle";
};

// ─── COLLISION SYSTEM (SAT) ──────────────────────────────────────────────────

const getCollisionShape = (entity) => {
    const isChar = !!entity.position;
    const x = isChar ? (Number(entity.position?.x) || 0) : ((Number(entity.x) || 0) + (Number(entity.hitbox?.offsetX) || 0));
    const y = isChar ? (Number(entity.position?.y) || 0) : ((Number(entity.y) || 0) + (Number(entity.hitbox?.offsetY) || 0));
    const rotation = Number(entity.rotation) || 0;
    const scale = isChar ? 1 : Math.max(0.1, Number(entity.hitbox?.scale) || 1);
    
    const type = String(entity.hitbox?.type || entity.type || "circle").toLowerCase();
    
    if (type === "circle") {
        const size = Number(entity.size) || 0;
        return {
            type: "circle",
            x, y,
            radius: Math.max(1, size * scale) / 2
        };
    }
    
    let vertices = [];
    if (type === "rect") {
        const w = Math.max(1, (Number(entity.width) || 0) * scale) / 2;
        const h = Math.max(1, (Number(entity.height) || 0) * scale) / 2;
        vertices = [{x:-w,y:-h}, {x:w,y:-h}, {x:w,y:h}, {x:-w,y:h}];
    } else if (type === "triangle") {
        const s = Math.max(1, (Number(entity.size) || 0) * scale) / 2;
        vertices = [{x:0,y:-s}, {x:-s,y:s}, {x:s,y:s}];
    } else {
        // Fallback
        const size = Number(entity.size) || 0;
        return { type: "circle", x, y, radius: Math.max(1, size * scale) / 2 };
    }
    
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    const transformed = vertices.map(v => ({
        x: x + (v.x * cos - v.y * sin),
        y: y + (v.x * sin + v.y * cos)
    }));
    
    return { type: "polygon", x, y, vertices: transformed };
};

const getAxes = (shape) => {
    const axes = [];
    if (shape.type === "polygon") {
        for (let i = 0; i < shape.vertices.length; i++) {
            const p1 = shape.vertices[i];
            const p2 = shape.vertices[(i + 1) % shape.vertices.length];
            const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
            const len = Math.hypot(edge.x, edge.y);
            if (len > 0.0001) axes.push({ x: -edge.y / len, y: edge.x / len });
        }
    }
    return axes;
};

const projectShape = (shape, axis) => {
    if (shape.type === "circle") {
        const dot = shape.x * axis.x + shape.y * axis.y;
        return { min: dot - shape.radius, max: dot + shape.radius };
    } else {
        let min = Infinity, max = -Infinity;
        for (const v of shape.vertices) {
            const dot = v.x * axis.x + v.y * axis.y;
            if (dot < min) min = dot;
            if (dot > max) max = dot;
        }
        return { min, max };
    }
};

const checkCollision = (entityA, entityB) => {
    const shapeA = getCollisionShape(entityA);
    const shapeB = getCollisionShape(entityB);
    if (!shapeA || !shapeB) return false;

    const rA = shapeA.type === "circle" ? shapeA.radius : Math.max(...shapeA.vertices.map(v => Math.hypot(v.x - shapeA.x, v.y - shapeA.y)));
    const rB = shapeB.type === "circle" ? shapeB.radius : Math.max(...shapeB.vertices.map(v => Math.hypot(v.x - shapeB.x, v.y - shapeB.y)));
    const dx = shapeA.x - shapeB.x;
    const dy = shapeA.y - shapeB.y;
    if (dx*dx + dy*dy > (rA + rB)**2) return false;

    const axes = [...getAxes(shapeA), ...getAxes(shapeB)];

    if (shapeA.type === "circle" && shapeB.type === "polygon") {
        let closestDistSq = Infinity, closestVert = null;
        for (const v of shapeB.vertices) {
            const d = (v.x - shapeA.x)**2 + (v.y - shapeA.y)**2;
            if (d < closestDistSq) { closestDistSq = d; closestVert = v; }
        }
        if (closestVert) {
            const axis = { x: closestVert.x - shapeA.x, y: closestVert.y - shapeA.y };
            const len = Math.hypot(axis.x, axis.y);
            if (len > 0.0001) axes.push({ x: axis.x / len, y: axis.y / len });
        }
    } else if (shapeB.type === "circle" && shapeA.type === "polygon") {
        let closestDistSq = Infinity, closestVert = null;
        for (const v of shapeA.vertices) {
            const d = (v.x - shapeB.x)**2 + (v.y - shapeB.y)**2;
            if (d < closestDistSq) { closestDistSq = d; closestVert = v; }
        }
        if (closestVert) {
            const axis = { x: closestVert.x - shapeB.x, y: closestVert.y - shapeB.y };
            const len = Math.hypot(axis.x, axis.y);
            if (len > 0.0001) axes.push({ x: axis.x / len, y: axis.y / len });
        }
    } else if (shapeA.type === "circle" && shapeB.type === "circle") {
        return (dx*dx + dy*dy) < (shapeA.radius + shapeB.radius)**2;
    }

    for (const axis of axes) {
        const pA = projectShape(shapeA, axis);
        const pB = projectShape(shapeB, axis);
        if (pA.max < pB.min || pB.max < pA.min) return false;
    }
    return true;
};

// ─── SERVER-SIDE LIGHTING & GEOMETRY ─────────────────────────────────────
const cross2d = (ax, ay, bx, by) => ax * by - ay * bx;

const raySegmentT = (ox, oy, dx, dy, ax, ay, bx, by) => {
    const rx = bx - ax, ry = by - ay;
    const denom = cross2d(dx, dy, rx, ry);
    if (Math.abs(denom) < 1e-10) return Infinity;
    const tx = ax - ox, ty = ay - oy;
    const t = cross2d(tx, ty, rx, ry) / denom;
    const u = cross2d(tx, ty, dx, dy) / denom;
    if (t < -1e-8 || u < -1e-8 || u > 1 + 1e-8) return Infinity;
    return Math.max(0, t);
};

const castRay = (ox, oy, dx, dy, segments, maxRange) => {
    let nearest = maxRange;
    for (const [a, b] of segments) {
        const t = raySegmentT(ox, oy, dx, dy, a.x, a.y, b.x, b.y);
        if (t < nearest) nearest = t;
    }
    return { x: ox + dx * nearest, y: oy + dy * nearest };
};

const doesRayHitCircle = (sx, sy, ex, ey, cx, cy, radius) => {
    const dx = ex - sx;
    const dy = ey - sy;
    const lenSq = dx * dx + dy * dy;
    if (!Number.isFinite(lenSq) || lenSq <= 0) {
        const distSq = (cx - sx) * (cx - sx) + (cy - sy) * (cy - sy);
        return distSq <= radius * radius;
    }
    const t = ((cx - sx) * dx + (cy - sy) * dy) / lenSq;
    const clamped = Math.max(0, Math.min(1, t));
    const px = sx + clamped * dx;
    const py = sy + clamped * dy;
    const distSq = (cx - px) * (cx - px) + (cy - py) * (cy - py);
    return distSq <= radius * radius;
};

const getObjectSegments = (obj) => {
    const shape = getCollisionShape(obj);
    const segs = [];
    
    if (shape.type === "circle") {
        // Approximate circle with polygon for lighting segments
        const segments = 12;
        const pts = [];
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            pts.push({
                x: shape.x + Math.cos(angle) * shape.radius,
                y: shape.y + Math.sin(angle) * shape.radius
            });
        }
        for (let i = 0; i < pts.length; i++) segs.push([pts[i], pts[(i + 1) % pts.length]]);
    } else {
        const pts = shape.vertices;
        for (let i = 0; i < pts.length; i++) segs.push([pts[i], pts[(i + 1) % pts.length]]);
    }
    return segs;
};

const buildVisionOcclusionSegments = (snapshot = {}) => {
    const mapObjects = Array.isArray(snapshot?.mapObjects) ? snapshot.mapObjects : [];
    const currentZLevel = Math.round(Number(snapshot?.currentZLevel) || 0);
    const obstacles = mapObjects.filter(
        (obj) =>
            normalizeTerrainType(obj?.terrainType) !== "floor" &&
            Math.round(Number(obj?.zLevel) || 0) === currentZLevel
    );
    return obstacles.flatMap(getObjectSegments);
};

const getNearestRayObstacleDistance = (ox, oy, rayAngle, segments, maxRange = Infinity) => {
    if (!Array.isArray(segments) || segments.length === 0) return Number.POSITIVE_INFINITY;
    const dx = Math.cos(rayAngle);
    const dy = Math.sin(rayAngle);
    let nearest = Number.isFinite(maxRange) ? maxRange : Infinity;
    for (const [a, b] of segments) {
        const t = raySegmentT(ox, oy, dx, dy, a.x, a.y, b.x, b.y);
        if (t < nearest) nearest = t;
    }
    return nearest;
};

const computeVisibilityPolygon = (lx, ly, segments, range) => {
    const ANGLE_EPSILON = 0.0001;
    const pad = 2;
    const bx0 = lx - range - pad, by0 = ly - range - pad;
    const bx1 = lx + range + pad, by1 = ly + range + pad;
    const boundary = [
        [{ x: bx0, y: by0 }, { x: bx1, y: by0 }],
        [{ x: bx1, y: by0 }, { x: bx1, y: by1 }],
        [{ x: bx1, y: by1 }, { x: bx0, y: by1 }],
        [{ x: bx0, y: by1 }, { x: bx0, y: by0 }],
    ];
    const allSegs = [...segments, ...boundary];
    const angles = [];

    for (const [a, b] of allSegs) {
        for (const pt of [a, b]) {
            const dx = pt.x - lx, dy = pt.y - ly;
            if (dx * dx + dy * dy > range * range * 2.1) continue;
            const base = Math.atan2(dy, dx);
            angles.push(base - ANGLE_EPSILON, base, base + ANGLE_EPSILON);
        }
    }
    angles.sort((a, b) => a - b);

    const points = [];
    for (const angle of angles) {
        const hit = castRay(lx, ly, Math.cos(angle), Math.sin(angle), allSegs, range + pad);
        points.push({ x: hit.x, y: hit.y });
    }
    return points;
};

const computeConvexHull = (points) => {
    points.sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const p of points) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }
    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }
    upper.pop();
    lower.pop();
    return [...lower, ...upper];
};

const computeDirectionalShadows = (light, obstacles, lightingConfig) => {
    const shadows = [];
    const globalShadowLength = Number(lightingConfig?.shadowLength) || 0.9;
    const lightX = Number(light.x) || 0;
    const lightY = Number(light.y) || 0;
    const lightMag = Math.hypot(lightX, lightY);
    const intensity = Number(light.intensity) || 0.8;

    // Direction vector (normalized)
    const dirX = lightMag > 0 ? lightX / lightMag : 0;
    const dirY = lightMag > 0 ? lightY / lightMag : 0;

    for (const obj of obstacles) {
        const segments = getObjectSegments(obj); // returns [[p1, p2], [p2, p3]...]
        // Extract unique vertices
        const vertices = segments.map(s => s[0]);

        // Calculate shadow reach based on object height and light tilt
        // Matches client-side logic: objectHeight * tilt^1.2 * intensityFactor * globalSetting
        const objectHeight = Math.max(0, Number(obj.elevationHeight) || 0) * 10;
        if (objectHeight <= 0) continue;

        const reach = objectHeight * Math.pow(lightMag, 1.2) * (0.5 + intensity * 0.6) * globalShadowLength;
        const dx = dirX * reach;
        const dy = dirY * reach;

        // The shadow is cast in the OPPOSITE direction of the light vector.
        const projected = vertices.map(v => ({ x: v.x - dx, y: v.y - dy }));
        shadows.push(computeConvexHull([...vertices, ...projected]));
    }
    return shadows;
};

const recalculateLighting = (state) => {
    const lighting = state.snapshot?.lighting || {};
    if (!lighting.enabled) {
        state.snapshot.lightingPolygons = {};
        return;
    }
    const mapObjects = state.snapshot?.mapObjects || [];
    const obstacles = mapObjects.filter(o => normalizeTerrainType(o.terrainType) !== "floor");
    const polygons = {};

    (lighting.sources || []).forEach((source, index) => {
        if (source.enabled === false) return;
        const zLevel = Math.round(Number(source.zLevel) || 0);
        const relevantObs = obstacles.filter(o => Math.round(Number(o.zLevel) || 0) === zLevel);
        const id = source.id || `light_${index + 1}`;

        if (source.type === "point") {
            const segments = relevantObs.flatMap(getObjectSegments);
            const lx = Number(source.worldX ?? source.position?.x) || 0;
            const ly = Number(source.worldY ?? source.position?.y) || 0;
            polygons[id] = computeVisibilityPolygon(lx, ly, segments, source.range);
        } else if (source.type === "directional") {
            // For directional, we store an array of shadow polygons
            polygons[id] = computeDirectionalShadows(source, relevantObs, lighting);
        }
    });
    state.snapshot.lightingPolygons = polygons;
};

const isPointInPolygon = (x, y, poly) => {
    if (!Array.isArray(poly) || poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

const calculateLightAtPoint = (worldX, worldY, snapshot = {}) => {
    const lighting = normalizeLightingConfig(snapshot?.lighting || {});
    if (!lighting.enabled) return 1.0;

    const lightingPolygons = snapshot?.lightingPolygons || {};
    const currentZLevel = Math.round(Number(snapshot?.currentZLevel) || 0);
    let brightness = 1 - clamp(lighting.ambient, 0, 1);

    for (const source of lighting.sources || []) {
        if (!source?.enabled || source.type !== "point") continue;
        const lightZLevel = Math.round(Number(source.zLevel) || 0);
        if (lightZLevel !== currentZLevel) continue;

        const dx = worldX - Number(source.worldX || 0);
        const dy = worldY - Number(source.worldY || 0);
        const dist = Math.hypot(dx, dy);
        if (dist > Number(source.range || 0)) continue;

        const polygon = lightingPolygons[source.id];
        if (!polygon || !isPointInPolygon(worldX, worldY, polygon)) continue;

        const t = dist / Number(source.range || 1);
        let falloff = 0;
        if (t < 0.25) falloff = 1.0 - (t / 0.25) * 0.25;
        else if (t < 0.55) falloff = 0.75 - ((t - 0.25) / 0.3) * 0.45;
        else if (t < 0.8) falloff = 0.3 - ((t - 0.55) / 0.25) * 0.22;
        else falloff = 0.08 - ((t - 0.8) / 0.2) * 0.08;

        const lightAlpha = clamp(Number(source.intensity || 0) * falloff, 0, 1);
        brightness = 1 - (1 - brightness) * (1 - lightAlpha);
    }

    for (const source of lighting.sources || []) {
        if (!source?.enabled || source.type !== "directional") continue;
        const shadows = lightingPolygons[source.id] || [];
        const inShadow = shadows.some((poly) => isPointInPolygon(worldX, worldY, poly));
        if (!inShadow) {
            const lightAlpha = clamp(Number(source.intensity || 0) * 0.8, 0, 1);
            brightness = 1 - (1 - brightness) * (1 - lightAlpha);
        }
    }

    return clamp(brightness, 0, 1);
};

const isLightBlockingObject = (obj = {}) =>
    normalizeTerrainType(obj?.terrainType) !== "floor";

const buildMapGeometry = (snapshot = {}) => {
    const mapObjects = Array.isArray(snapshot?.mapObjects) ? snapshot.mapObjects : [];
    return mapObjects.filter((obj) => isLightBlockingObject(obj));
};

const readCampaignSetting = (campaign, key) => {
    if (!campaign || !key) return undefined;
    const settings = campaign.settings;
    if (!settings) return undefined;
    if (typeof settings.get === "function") {
        return settings.get(key);
    }
    return settings[key];
};

const normalizeFovMode = (value) => {
    const normalized = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
    if (normalized === "perplayer" || normalized === "player") return "perPlayer";
    return "party";
};

const getCampaignFovMode = (campaign) =>
    normalizeFovMode(readCampaignSetting(campaign, "fovMode"));

const getAssignedCharacterIDsForPlayer = (campaign, playerID) => {
    const normalizedPlayerID = String(playerID || "");
    if (!normalizedPlayerID || !campaign) return [];
    const assignments = Array.isArray(campaign.characterAssignments)
        ? campaign.characterAssignments
        : [];
    const ids = new Set();
    assignments.forEach((assignment) => {
        if (toObjectIdString(assignment?.playerId) !== normalizedPlayerID) return;
        const characterID = toObjectIdString(assignment?.characterId);
        if (characterID) ids.add(characterID);
    });
    return Array.from(ids);
};

/**
 * Checks if a point is visible to a character using the advanced vision system
 * Returns boolean for simple FOV checks
 */
const isPointInFOV = (source = {}, point = {}) => {
    if (!source || !source.vision) return false;

    const result = VisionSystem.getPointVisibility(
        toNumber(point.x, 0),
        toNumber(point.y, 0),
        source,
        source.vision,
        {} // No special context modifiers for basic FOV
    );

    return result.visibility > 0;
};

/**
 * Advanced vision check that returns visibility details, fuel cost, and vision type
 */
const getAdvancedPointVisibility = (source = {}, point = {}, visionContext = {}) => {
    if (!source || !source.vision) {
        return { visibility: 0, visionType: 'noVision', fuelCost: 1.0, isVisible: false };
    }

    return VisionSystem.getPointVisibility(
        toNumber(point.x, 0),
        toNumber(point.y, 0),
        source,
        source.vision,
        visionContext
    );
};

/**
 * Get sample points for FOV testing - uses collision system for backward compatibility
 */
const getObjectSamplePoints = (obj = {}) => {
    // Use vision system's unified approach if the object has hitbox data
    if (obj.hitbox || obj.x !== undefined) {
        return VisionSystem.getObjectSamplePoints(obj);
    }

    // Fallback to collision-based approach for character positions
    const shape = getCollisionShape(obj);
    if (shape.type === "circle") {
        const { x, y, radius } = shape;
        return [
            { x, y },
            { x: x + radius, y },
            { x: x - radius, y },
            { x, y: y + radius },
            { x, y: y - radius },
        ];
    } else {
        // Return vertices + center
        const vertices = shape.vertices;
        const center = vertices.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }), { x: 0, y: 0 });
        center.x /= vertices.length;
        center.y /= vertices.length;
        return [center, ...vertices];
    }
};

const resolveFovSources = (characters = [], options = {}) => {
    const sources = [];
    const sourceIdSet = new Set();
    const explicitSourceIds = Array.isArray(options.sourceIds) ? options.sourceIds : null;
    if (explicitSourceIds && explicitSourceIds.length > 0) {
        explicitSourceIds.forEach((entry) => {
            const normalized = String(entry || "").trim();
            if (normalized) sourceIdSet.add(normalized);
        });
        characters.forEach((char) => {
            const charId = String(char?.id ?? "");
            if (sourceIdSet.has(charId)) sources.push(char);
        });
        return { sources, sourceIdSet };
    }

    const explicitSources = Array.isArray(options.sources) ? options.sources : null;
    if (explicitSources && explicitSources.length > 0) {
        explicitSources.forEach((char) => {
            if (!char) return;
            const charId = String(char?.id ?? "");
            if (charId) sourceIdSet.add(charId);
            sources.push(char);
        });
        return { sources, sourceIdSet };
    }

    const normalizedTeam = String(options.viewerTeam || "player").toLowerCase();
    characters.forEach((char) => {
        if (String(char?.team || "player").toLowerCase() !== normalizedTeam) return;
        sources.push(char);
        const charId = String(char?.id ?? "");
        if (charId) sourceIdSet.add(charId);
    });

    return { sources, sourceIdSet };
};

const filterSnapshotForFOV = (snapshot = {}, options = {}) => {
    const safeSnapshot = toPlainObject(snapshot);
    const characters = Array.isArray(safeSnapshot.characters) ? safeSnapshot.characters : [];
    const mapObjects = Array.isArray(safeSnapshot.mapObjects) ? safeSnapshot.mapObjects : [];
    const mapGeometry = buildMapGeometry(safeSnapshot);
    const { sources: fovSources, sourceIdSet } = resolveFovSources(characters, options);
    fovSources.forEach((source) => ensureTokenVision(source));
    if (fovSources.length === 0) {
        return {
            ...safeSnapshot,
            mapGeometry,
            characters: [],
            mapObjects: [],
        };
    }

    // Extract vision context from options (for environmental modifiers like light level)
    const visionContext = options.visionContext || {};

    const isVisiblePoint = (point) =>
        fovSources.some((source) => getAdvancedPointVisibility(source, point, visionContext).visibility > 0);

    const getRayHitVisibilityForCharacter = (targetChar) => {
        if (!targetChar) return null;
        const pos = targetChar?.position || {};
        const cx = toNumber(pos.x, 0);
        const cy = toNumber(pos.y, 0);
        const radius = Math.max(1, (toNumber(targetChar?.size, 0) || 0) / 2);

        let sawPeripheral = false;
        for (const source of fovSources) {
            const sx = toNumber(source?.position?.x, 0);
            const sy = toNumber(source?.position?.y, 0);
            if (!Array.isArray(source?.visionRays)) continue;
            for (const ray of source.visionRays) {
                let ex = toNumber(ray?.endX, NaN);
                let ey = toNumber(ray?.endY, NaN);
                if (!Number.isFinite(ex) || !Number.isFinite(ey)) {
                    const angleDeg = toNumber(ray?.angle, 0);
                    const dist = toNumber(ray?.distance, 0);
                    const angleRad = (angleDeg * Math.PI) / 180;
                    ex = sx + Math.cos(angleRad) * dist;
                    ey = sy + Math.sin(angleRad) * dist;
                }
                if (!Number.isFinite(ex) || !Number.isFinite(ey)) continue;
                if (doesRayHitCircle(sx, sy, ex, ey, cx, cy, radius)) {
                    if (!ray?.isPeripheral) {
                        return { visibility: 1.0, visionType: 'main' };
                    }
                    sawPeripheral = true;
                }
            }
        }
        if (sawPeripheral) return { visibility: 0.5, visionType: 'peripheral' };
        return null;
    };
    
    const getObjectVisibility = (obj) => {
        // Check if any vision ray hits this object (server-side ray check)
        for (const source of fovSources) {
            if (Array.isArray(source.visionRays)) {
                for (const ray of source.visionRays) {
                    if (checkCollision({ x: ray.endX, y: ray.endY, size: 2, type: 'circle' }, obj)) {
                        return { isVisible: true, visibility: 1.0, visionType: 'main' };
                    }
                }
            }
        }

        const samples = getObjectSamplePoints(obj);
        let maxVisibility = 0;
        
        for (const point of samples) {
            for (const source of fovSources) {
                const result = getAdvancedPointVisibility(source, point, visionContext);
                maxVisibility = Math.max(maxVisibility, result.visibility);
                if (maxVisibility > 0) break;
            }
            if (maxVisibility > 0) break;
        }
        
        return {
            isVisible: maxVisibility > 0,
            visibility: maxVisibility,
            visionType: maxVisibility >= 1.0 ? 'main' : (maxVisibility > 0 ? 'peripheral' : 'blocked')
        };
    };

    const isVisibleObject = (obj) => getObjectVisibility(obj).isVisible;

    const filteredMapObjects = mapObjects.filter((obj) => {
        // Objects can have optional visibility metadata
        const objVis = getObjectVisibility(obj);
        if (!objVis.isVisible) return false;
        
        // Attach vision metadata if needed
        obj._visionData = {
            visibility: objVis.visibility,
            visionType: objVis.visionType
        };
        return true;
    });

    const filteredCharacters = characters.filter((char) => {
        const charId = String(char?.id ?? "");
        // Always show yourself
        if (sourceIdSet.has(charId)) return true;

        const rayVis = getRayHitVisibilityForCharacter(char);
        if (rayVis) {
            char._visionData = {
                visibility: rayVis.visibility,
                visionType: rayVis.visionType,
            };
            return true;
        }

        const pos = char?.position || {};
        const isVisible = isVisiblePoint({ x: toNumber(pos.x, 0), y: toNumber(pos.y, 0) });

        // Attach vision metadata
        if (isVisible) {
            let maxVisibility = 0;
            let visionType = 'blocked';

            for (const source of fovSources) {
                const result = getAdvancedPointVisibility(source, pos, visionContext);
                if (result.visibility > maxVisibility) {
                    maxVisibility = result.visibility;
                    visionType = result.visionType;
                }
            }

            char._visionData = {
                visibility: maxVisibility,
                visionType: visionType
            };
        }

        return isVisible;
    });

    // SERVER-SIDE OBFUSCATION: Filter character data based on perception checks
    // Helper functions for range calculation
    const createSeededRng = (seed) => {
        let t = seed >>> 0;
        return () => {
            t += 0x6d2b79f5;
            let r = Math.imul(t ^ (t >>> 15), 1 | t);
            r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
            return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
        };
    };

    const hashString = (str) => {
        let hash = 2166136261;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    };

    const buildRangeValue = (value, errorPercent, rng) => {
        const base = Number(value) || 0;
        if (!errorPercent || errorPercent <= 0) {
            return { value: base, display: String(Math.round(base)) };
        }
        const minVal = Math.max(0, base * (1 - errorPercent));
        const maxVal = Math.max(base, base * (1 + errorPercent));
        const low = minVal + rng() * (base - minVal);
        const high = base + rng() * (maxVal - base);
        const lowRounded = Math.round(Math.min(low, high));
        const highRounded = Math.round(Math.max(low, high));
        return {
            value: base,
            low: lowRounded,
            high: highRounded,
            display: lowRounded === highRounded ? String(lowRounded) : `${lowRounded}-${highRounded}`
        };
    };

    const applyRangesToObject = (obj, errorPercent, rng, fieldsToObfuscate) => {
        if (!obj || typeof obj !== 'object') return obj;
        const result = { ...obj };
        for (const field of fieldsToObfuscate) {
            if (result[field] !== undefined && result[field] !== null) {
                const val = Number(result[field]);
                if (Number.isFinite(val)) {
                    result[field] = buildRangeValue(val, errorPercent, rng);
                }
            }
        }
        return result;
    };

    const obfuscatedCharacters = filteredCharacters.map((char) => {
        const charId = String(char?.id ?? "");
        // Don't obfuscate viewer's own characters
        if (sourceIdSet.has(charId)) return char;
        
        // Don't obfuscate if same team (allies see each other fully)
        const charTeam = String(char?.team || "player").toLowerCase();
        const isAlly = fovSources.some(src => String(src?.team || "player").toLowerCase() === charTeam);
        if (isAlly) return char;

        // Calculate perception vs stealth for each viewer
        // Both perception and stealth are computed from engine via pipelines and synced to snapshot
        let highestPerceptionRatio = 0;
        let targetStealth = toNumber(char?.stealth, 0);
        
        // Fallback if stealth wasn't synced (shouldn't happen, but be safe)
        if (targetStealth === 0) {
            const targetDex = toNumber(char?.stats?.DEX?.score ?? char?.stats?.dex?.score ?? char?.stats?.DEX ?? char?.stats?.dex, 10);
            const targetWis = toNumber(char?.stats?.WIS?.score ?? char?.stats?.wis?.score ?? char?.stats?.WIS ?? char?.stats?.wis, 10);
            targetStealth = targetDex + targetWis;
        }
        
        for (const viewer of fovSources) {
            const perception = toNumber(viewer?.perception, 0);
            console.log(`[SERVER VIEWER] ${viewer?.name || viewer?.id}: perception=${perception}`);
            const ratio = targetStealth > 0 ? perception / targetStealth : 1;
            highestPerceptionRatio = Math.max(highestPerceptionRatio, ratio);
        }

        // Apply obfuscation based on perception ratio
        const obfuscated = { ...char };
        
        // Store perception data for client (always include these)
        obfuscated._perceptionRatio = highestPerceptionRatio;
        obfuscated._stealthPassive = targetStealth;
        
        // Determine visibility error (margin of error)
        const visibilityError = (() => {
            if (highestPerceptionRatio < 0.5) return null;
            if (highestPerceptionRatio < 0.55) return 2;      // 200%
            if (highestPerceptionRatio < 0.6) return 1.75;    // 175%
            if (highestPerceptionRatio < 0.65) return 1.5;    // 150%
            if (highestPerceptionRatio < 0.7) return 1.25;    // 125%
            if (highestPerceptionRatio < 0.75) return 1;      // 100%
            if (highestPerceptionRatio < 0.8) return 0.75;    // 75%
            if (highestPerceptionRatio < 0.85) return 0.5;    // 50%
            if (highestPerceptionRatio < 0.9) return 0.25;    // 25%
            return 0;                                          // 0% (exact)
        })();
        
        obfuscated._visibilityError = visibilityError;
        
        // Create seeded RNG for consistent ranges per player-character pair
        const seed = hashString(`${char.id}:${highestPerceptionRatio.toFixed(3)}`);
        const rng = createSeededRng(seed);
        
        console.log(`[SERVER OBFUSCATE] ${char.name || char.id}: ratio=${(highestPerceptionRatio*100).toFixed(1)}%, error=${visibilityError}, stealth=${targetStealth}`);
        
        // Below 50%: Hide everything sensitive (but keep perception metadata)
        if (highestPerceptionRatio < 0.5) {
            console.log(`[SERVER OBFUSCATE] ${char.name}: <50% - Hiding everything`);
            delete obfuscated.HP;
            delete obfuscated.MP;
            delete obfuscated.STA;
            delete obfuscated.stats;
            delete obfuscated.statusEffects;
            delete obfuscated.race;
            delete obfuscated.classType;
            delete obfuscated.level;
            delete obfuscated.skills;
            delete obfuscated.AR;
            delete obfuscated.resistances;
            delete obfuscated.immunities;
            delete obfuscated.defenses;
            return obfuscated;
        }

        // Apply ranges to numeric values BEFORE filtering fields
        if (visibilityError && visibilityError > 0) {
            // Apply ranges to HP, MP, STA
            if (obfuscated.HP) {
                obfuscated.HP = {
                    current: buildRangeValue(obfuscated.HP.current, visibilityError, rng),
                    max: buildRangeValue(obfuscated.HP.max, visibilityError, rng),
                    temp: buildRangeValue(obfuscated.HP.temp || 0, visibilityError, rng)
                };
            }
            if (obfuscated.MP) {
                obfuscated.MP = {
                    current: buildRangeValue(obfuscated.MP.current, visibilityError, rng),
                    max: buildRangeValue(obfuscated.MP.max, visibilityError, rng),
                    temp: buildRangeValue(obfuscated.MP.temp || 0, visibilityError, rng)
                };
            }
            if (obfuscated.STA) {
                obfuscated.STA = {
                    current: buildRangeValue(obfuscated.STA.current, visibilityError, rng),
                    max: buildRangeValue(obfuscated.STA.max, visibilityError, rng),
                    temp: buildRangeValue(obfuscated.STA.temp || 0, visibilityError, rng)
                };
            }
            // Apply ranges to level
            if (obfuscated.level !== undefined) {
                obfuscated.level = buildRangeValue(obfuscated.level, visibilityError, rng);
            }
            // Apply ranges to AR
            if (obfuscated.AR?.physical?.total !== undefined) {
                obfuscated.AR = {
                    ...obfuscated.AR,
                    physical: {
                        ...obfuscated.AR.physical,
                        total: buildRangeValue(obfuscated.AR.physical.total, visibilityError, rng)
                    }
                };
            }
            // Apply ranges to stats
            if (obfuscated.stats) {
                const newStats = {};
                for (const [key, val] of Object.entries(obfuscated.stats)) {
                    const statValue = typeof val === 'object' ? (val.total ?? val.score ?? 0) : (val || 0);
                    newStats[key] = buildRangeValue(statValue, visibilityError, rng);
                }
                obfuscated.stats = newStats;
            }
            // Apply approximate text markers to race/class
            if (obfuscated.race) {
                obfuscated.race = { value: obfuscated.race, display: `≈ ${obfuscated.race}`, isApproximate: true };
            }
            if (obfuscated.classType) {
                obfuscated.classType = { value: obfuscated.classType, display: `≈ ${obfuscated.classType}`, isApproximate: true };
            }
        }

        // NOW delete fields based on perception thresholds

        // NOW delete fields based on perception thresholds
        // 50-55%: Only HP and status effects
        if (highestPerceptionRatio < 0.55) {
            delete obfuscated.MP;
            delete obfuscated.STA;
            delete obfuscated.race;
            delete obfuscated.classType;
            delete obfuscated.level;
            delete obfuscated.skills;
            delete obfuscated.AR;
            delete obfuscated.resistances;
            delete obfuscated.immunities;
            delete obfuscated.defenses;
            delete obfuscated.stats;
        } else if (highestPerceptionRatio < 0.6) {
            // 55-60%: + MP, STA
            delete obfuscated.race;
            delete obfuscated.classType;
            delete obfuscated.level;
            delete obfuscated.skills;
            delete obfuscated.AR;
            delete obfuscated.resistances;
            delete obfuscated.immunities;
            delete obfuscated.defenses;
            delete obfuscated.stats;
        } else if (highestPerceptionRatio < 0.65) {
            // 60-65%: + Race, Class
            delete obfuscated.level;
            delete obfuscated.skills;
            delete obfuscated.AR;
            delete obfuscated.resistances;
            delete obfuscated.immunities;
            delete obfuscated.defenses;
            delete obfuscated.stats;
        } else if (highestPerceptionRatio < 0.7) {
            // 65-70%: + Level
            delete obfuscated.skills;
            delete obfuscated.AR;
            delete obfuscated.resistances;
            delete obfuscated.immunities;
            delete obfuscated.defenses;
            delete obfuscated.stats;
        } else if (highestPerceptionRatio < 0.75) {
            // 70-75%: + Max MP, Max STA
            delete obfuscated.skills;
            delete obfuscated.AR;
            delete obfuscated.resistances;
            delete obfuscated.immunities;
            delete obfuscated.defenses;
            delete obfuscated.stats;
        } else if (highestPerceptionRatio < 0.8) {
            // 75-80%: + Passives (skills)
            delete obfuscated.AR;
            delete obfuscated.resistances;
            delete obfuscated.immunities;
            delete obfuscated.defenses;
            delete obfuscated.stats;
        } else if (highestPerceptionRatio < 0.85) {
            // 80-85%: + AR, Resistances, Immunities, Defenses
            delete obfuscated.stats;
        }
        // 85%+: Show everything including stats
        
        console.log(`[SERVER OBFUSCATE] ${char.name}: Sending fields: ${Object.keys(obfuscated).filter(k => !k.startsWith('_')).join(', ')}`);
        return obfuscated;
    });

    return {
        ...safeSnapshot,
        mapGeometry,
        characters: obfuscatedCharacters,
        mapObjects: filteredMapObjects,
    };
};

const filterSnapshotForPlayer = (snapshot = {}, campaign, playerID) => {
    const mode = getCampaignFovMode(campaign);
    const filterQuestStateForPlayer = (questState = {}) => {
        const safeQuestState = toPlainObject(questState);
        const quests = Array.isArray(safeQuestState.quests) ? safeQuestState.quests : [];
        const filteredQuests = quests
            .map((quest) => {
                const safeQuest = toPlainObject(quest);
                if (Object.keys(safeQuest).length === 0) return null;
                if (safeQuest.showToParty === false) return null;
                const checklist = Array.isArray(safeQuest.checklist) ? safeQuest.checklist : [];
                const visibleChecklist = checklist.filter((item) => {
                    const safeItem = toPlainObject(item);
                    return safeItem.checked === true;
                });
                const chapters = Array.isArray(safeQuest.chapters) ? safeQuest.chapters : [];
                const filteredChapters = chapters
                    .map((chapter) => {
                        const safeChapter = toPlainObject(chapter);
                        if (safeChapter.visibleToParty === false) return null;
                        const pages = Array.isArray(safeChapter.pages) ? safeChapter.pages : [];
                        return {
                            ...safeChapter,
                            pages,
                        };
                    })
                    .filter(Boolean);
                return {
                    ...safeQuest,
                    checklist: visibleChecklist,
                    chapters: filteredChapters,
                };
            })
            .filter(Boolean);

        return {
            ...safeQuestState,
            quests: filteredQuests,
        };
    };

    const filteredSnapshotBase =
        mode === "perPlayer"
            ? filterSnapshotForFOV(snapshot, {
                  sourceIds: getAssignedCharacterIDsForPlayer(campaign, playerID),
                  viewerTeam: "player",
              })
            : filterSnapshotForFOV(snapshot, { viewerTeam: "player" });
    const filteredSnapshot = {
        ...filteredSnapshotBase,
        fovMode: mode,
    };

    if (filteredSnapshot?.questState && typeof filteredSnapshot.questState === "object") {
        return {
            ...filteredSnapshot,
            questState: filterQuestStateForPlayer(filteredSnapshot.questState),
        };
    }

    return filteredSnapshot;
};

const buildPlayerPayload = (payload, snapshot) => ({
    ...payload,
    snapshot,
    engineState: {
        ...payload.engineState,
        snapshot,
    },
});

const buildPlayerPayloadForPlayer = (payload, campaign, playerID, options = {}) => {
    const filteredSnapshot = filterSnapshotForPlayer(
        payload?.engineState?.snapshot || {},
        campaign,
        playerID
    );
    let playerPayload = buildPlayerPayload(payload, filteredSnapshot);
    if (typeof options.transform === "function") {
        playerPayload = options.transform(playerPayload, filteredSnapshot, playerID);
    }
    return playerPayload;
};

const emitPlayerStateUpdate = async (socket, campaign, payload, options = {}) => {
    if (!socket || !campaign || !payload?.engineState) return;
    const playersRoom = getCampaignPlayersRoom(campaign._id);
    const fovMode = getCampaignFovMode(campaign);
    const baseSnapshot = payload.engineState.snapshot || {};

    const sendPayload = (clientSocket, playerID) => {
        const filteredSnapshotBase =
            fovMode === "perPlayer"
                ? filterSnapshotForPlayer(baseSnapshot, campaign, playerID)
                : filterSnapshotForFOV(baseSnapshot, { viewerTeam: "player" });
        const filteredSnapshot = {
            ...filteredSnapshotBase,
            fovMode,
        };
        let playerPayload = buildPlayerPayload(payload, filteredSnapshot);
        if (typeof options.transform === "function") {
            playerPayload = options.transform(playerPayload, filteredSnapshot, playerID);
        }
        clientSocket.emit("campaign_gameStateUpdated", playerPayload);
    };

    if (fovMode === "perPlayer" && socket.server && typeof socket.server.in === "function") {
        try {
            const sockets = await socket.server.in(playersRoom).fetchSockets();
            if (Array.isArray(sockets) && sockets.length > 0) {
                sockets.forEach((clientSocket) => {
                    if (clientSocket.id === socket.id) return;
                    sendPayload(clientSocket, clientSocket.data?.playerID);
                });
                return;
            }
        } catch (error) {
            // Fall back to party broadcast below.
        }
    }

    const filteredSnapshotBase = filterSnapshotForFOV(baseSnapshot, { viewerTeam: "player" });
    const filteredSnapshot = {
        ...filteredSnapshotBase,
        fovMode,
    };
    let playerPayload = buildPlayerPayload(payload, filteredSnapshot);
    if (typeof options.transform === "function") {
        playerPayload = options.transform(playerPayload, filteredSnapshot, null);
    }
    socket.to(playersRoom).emit("campaign_gameStateUpdated", playerPayload);
};

const getCharacterNameFromAssignment = (assignment = {}) => {
    if (assignment?.characterName) return assignment.characterName;
    if (assignment?.character?.name) return assignment.character.name;
    if (assignment?.characterId && typeof assignment.characterId === "object") {
        return assignment.characterId?.name || "";
    }
    return "";
};

const extractHPFromState = (stateEntry = {}) => {
    const hp = toPlainObject(stateEntry?.state?.HP || stateEntry?.HP || {});
    const maxHP = toNumber(hp.max, NaN);
    const currentHP = toNumber(hp.current, NaN);

    return {
        maxHP: Number.isFinite(maxHP) ? Math.max(1, Math.round(maxHP)) : null,
        hp: Number.isFinite(currentHP) ? Math.max(0, Math.round(currentHP)) : null,
    };
};

const ensureCampaignCharactersInSnapshot = async (campaign, runtimeState) => {
    if (!campaign || !runtimeState?.snapshot) return false;
    const assignments = Array.isArray(campaign.characterAssignments)
        ? campaign.characterAssignments
        : [];
    if (assignments.length === 0) return false;

    if (!Array.isArray(runtimeState.snapshot.characters)) {
        runtimeState.snapshot.characters = [];
    }

    const existingById = new Map();
    runtimeState.snapshot.characters.forEach((token, index) => {
        const tokenId = String(token?.id ?? "");
        if (!tokenId || existingById.has(tokenId)) return;
        existingById.set(tokenId, { token, index });
    });

    const missingNameIds = [];
    assignments.forEach((assignment) => {
        const characterId = toObjectIdString(assignment?.characterId);
        if (!characterId) return;
        const name = getCharacterNameFromAssignment(assignment);
        if (!name && mongoose.isValidObjectId(characterId)) {
            missingNameIds.push(characterId);
        }
    });

    const nameLookup = new Map();
    if (missingNameIds.length > 0) {
        const uniqueIds = Array.from(new Set(missingNameIds));
        const docs = await Character.find({ _id: { $in: uniqueIds } }).select("_id name");
        docs.forEach((doc) => {
            const id = toObjectIdString(doc?._id);
            if (id && doc?.name) {
                nameLookup.set(id, doc.name);
            }
        });
    }

    let changed = false;

    assignments.forEach((assignment) => {
        const characterId = toObjectIdString(assignment?.characterId);
        if (!characterId) return;

        const assignmentName =
            getCharacterNameFromAssignment(assignment) ||
            nameLookup.get(characterId) ||
            "Character";

        const stateEntry = findCampaignCharacterState(campaign, characterId);
        const { hp, maxHP } = extractHPFromState(stateEntry);

        const existing = existingById.get(characterId);
        if (existing) {
            const token = existing.token;
            let tokenChanged = false;

            if (assignmentName && token?.name !== assignmentName) {
                token.name = assignmentName;
                tokenChanged = true;
            }
            const currentTeam = String(token?.team || "").toLowerCase();
            if (!currentTeam || currentTeam === "neutral") {
                token.team = "player";
                tokenChanged = true;
            }
            if (!token?.kind) {
                token.kind = "character";
                tokenChanged = true;
            }
            if (maxHP != null && token?.maxHP !== maxHP) {
                token.maxHP = maxHP;
                tokenChanged = true;
            }
            if (hp != null && token?.hp !== hp) {
                token.hp = hp;
                tokenChanged = true;
            }
            if (!Number.isFinite(Number(token?.movement))) {
                token.movement = DEFAULT_CHARACTER_MOVEMENT;
                tokenChanged = true;
            }

            if (tokenChanged) changed = true;
            return;
        }

        const token = {
            id: characterId,
            name: assignmentName,
            position: { x: 0, y: 0 },
            size: 30,
            visionDistance: 150,
            rotation: 0,
            visionArc: 90,
            movement: DEFAULT_CHARACTER_MOVEMENT,
            team: "player",
            kind: "character",
            memory: { polygons: 0 },
        };
        if (maxHP != null) token.maxHP = maxHP;
        if (hp != null) token.hp = hp;

        runtimeState.snapshot.characters.push(token);
        changed = true;
    });

    if (changed) {
        runtimeState.revision = Number(runtimeState.revision) + 1;
        runtimeState.updatedAt = Date.now();
    }

    return changed;
};

const getOrCreateRuntimeState = (campaignID, snapshot = {}) => {
    const key = String(campaignID || "");
    if (!key) return createEngineState("", snapshot);

    if (!campaignRuntimeStateByID.has(key)) {
        const nextState = createEngineState(key, snapshot);
        recalculateLighting(nextState);
        campaignRuntimeStateByID.set(key, nextState);
    }

    return campaignRuntimeStateByID.get(key);
};

const replaceRuntimeState = (campaignID, snapshot = {}) => {
    const key = String(campaignID || "");
    const nextState = createEngineState(key, snapshot);
    recalculateLighting(nextState);
    campaignRuntimeStateByID.set(key, nextState);
    return nextState;
};

const isCampaignMember = (campaign, playerID) => {
    const normalizedPlayerID = String(playerID || "");
    if (!normalizedPlayerID || !campaign) return false;

    if (toObjectIdString(campaign.dmId) === normalizedPlayerID) return true;
    return (campaign.players || []).some(
        (memberID) => toObjectIdString(memberID) === normalizedPlayerID
    );
};

const isCampaignDM = (campaign, playerID) => {
    const normalizedPlayerID = String(playerID || "");
    if (!normalizedPlayerID || !campaign) return false;
    return toObjectIdString(campaign.dmId) === normalizedPlayerID;
};

const isCampaignBanned = (campaign, playerID) => {
    const normalizedPlayerID = String(playerID || "");
    if (!normalizedPlayerID || !campaign) return false;
    return (campaign.bannedPlayers || []).some(
        (bannedID) => toObjectIdString(bannedID) === normalizedPlayerID
    );
};

const buildCampaignMemberIDSet = (campaign) => {
    const memberIDs = new Set();
    const dmID = toObjectIdString(campaign?.dmId);
    if (dmID) memberIDs.add(dmID);

    if (Array.isArray(campaign?.players)) {
        campaign.players.forEach((member) => {
            const memberID = toObjectIdString(member);
            if (memberID) memberIDs.add(memberID);
        });
    }

    return memberIDs;
};

const isCharacterInCampaign = (campaign, characterID) => {
    const targetCharacterID = toObjectIdString(characterID);
    if (!targetCharacterID || !campaign) return false;

    const hasAssignment = Array.isArray(campaign.characterAssignments)
        ? campaign.characterAssignments.some(
              (assignment) =>
                  toObjectIdString(assignment?.characterId) === targetCharacterID
          )
        : false;
    if (hasAssignment) return true;

    return Boolean(findCampaignCharacterState(campaign, targetCharacterID));
};

const formatCharacterSummary = (characterDoc) => {
    const character = characterDoc?.toObject ? characterDoc.toObject() : characterDoc;
    if (!character) return null;

    return {
        _id: toObjectIdString(character),
        name: character.name || "Unnamed Character",
        level: Number(character.level) || 1,
        playerId: toObjectIdString(character.playerId),
    };
};

const formatCampaign = (campaignDoc) => {
    const campaign = campaignDoc?.toObject ? campaignDoc.toObject() : campaignDoc;
    if (!campaign) return null;

    const players = Array.isArray(campaign.players) ? campaign.players : [];
    const bannedPlayers = Array.isArray(campaign.bannedPlayers) ? campaign.bannedPlayers : [];
    const activeLobby = campaign.activeLobby || {};
    const memberIDs = buildCampaignMemberIDSet(campaign);
    const campaignStatesByCharacterID = new Map();
    if (Array.isArray(campaign.characterStates)) {
        campaign.characterStates.forEach((stateEntry) => {
            const characterID = toObjectIdString(stateEntry?.characterId);
            if (!characterID || campaignStatesByCharacterID.has(characterID)) return;
            campaignStatesByCharacterID.set(characterID, toPlainObject(stateEntry?.state));
        });
    }

    const characterAssignmentsArray = [];
    if (Array.isArray(campaign.characterAssignments)) {
        campaign.characterAssignments.forEach((assignment) => {
            const playerID = toObjectIdString(assignment?.playerId);
            const characterID = toObjectIdString(assignment?.characterId);
            if (!playerID || !characterID) return;
            if (memberIDs.size > 0 && !memberIDs.has(playerID)) return;

            const characterRef =
                assignment?.characterId && typeof assignment.characterId === "object"
                    ? assignment.characterId
                    : null;
            const playerRef =
                assignment?.playerId && typeof assignment.playerId === "object"
                    ? assignment.playerId
                    : null;
            const campaignState = campaignStatesByCharacterID.get(characterID);
            const campaignStateLevel = Number(campaignState?.level);

            characterAssignmentsArray.push({
                playerId: playerID,
                playerName: playerRef?.username || "",
                characterId: characterID,
                characterName: characterRef?.name || "",
                characterLevel: Number.isFinite(campaignStateLevel)
                    ? campaignStateLevel
                    : Number(characterRef?.level) || null,
                hasCampaignState: Boolean(campaignState),
                selectedBy: toObjectIdString(assignment?.selectedBy),
                selectedAt: assignment?.selectedAt || null,
            });
        });
    }

    return {
        _id: String(campaign._id),
        name: campaign.name || "Untitled Campaign",
        description: campaign.description || "",
        joinCode: campaign.joinCode || "",
        dmId: toObjectIdString(campaign.dmId),
        dmName: typeof campaign.dmId === "object" ? campaign.dmId.username || "" : "",
        maxPlayers: Number(campaign.maxPlayers) || DEFAULT_MAX_PLAYERS,
        isPrivate: Boolean(campaign.isPrivate),
        setting: campaign.setting || "",
        memberCount: players.length,
        players: players.map((player) => ({
            _id: toObjectIdString(player),
            username: typeof player === "object" ? player.username || "" : "",
        })),
        bannedPlayers: bannedPlayers.map((player) => ({
            _id: toObjectIdString(player),
            username: typeof player === "object" ? player.username || "" : "",
        })),
        gameSaves: Array.isArray(campaign.gameSaves)
            ? campaign.gameSaves.map((saveRef) => toObjectIdString(saveRef))
            : [],
        activeGameSave: toObjectIdString(campaign.activeGameSave),
        fovMode: getCampaignFovMode(campaign),
        activeLobby: {
            isActive: Boolean(activeLobby.isActive),
            lobbyCode: activeLobby.lobbyCode || "",
            startedBy: toObjectIdString(activeLobby.startedBy),
            startedAt: activeLobby.startedAt || null,
            members: Array.isArray(activeLobby.members)
                ? activeLobby.members.map((member) => toObjectIdString(member))
                : [],
        },
        characterAssignments: characterAssignmentsArray,
        createdAt: campaign.createdAt || null,
    };
};

const formatGameSave = (gameSaveDoc) => {
    const gameSave = gameSaveDoc?.toObject ? gameSaveDoc.toObject() : gameSaveDoc;
    if (!gameSave) return null;

    const metadata =
        gameSave.metadata instanceof Map
            ? Object.fromEntries(gameSave.metadata.entries())
            : toPlainObject(gameSave.metadata);

    return {
        _id: String(gameSave._id),
        campaignId: toObjectIdString(gameSave.campaignId),
        name: gameSave.name || "Untitled Save",
        description: gameSave.description || "",
        savedBy: toObjectIdString(gameSave.savedBy),
        version: Number(gameSave.version) || 1,
        isAutoSave: Boolean(gameSave.isAutoSave),
        metadata,
        createdAt: gameSave.createdAt || null,
        updatedAt: gameSave.updatedAt || null,
    };
};

const formatEnemy = (enemyDoc) => {
    const enemy = enemyDoc?.toObject ? enemyDoc.toObject() : enemyDoc;
    if (!enemy) return null;

    return {
        _id: String(enemy._id),
        campaignId: toObjectIdString(enemy.campaignId),
        name: enemy.name || "Enemy",
        kind: enemy.kind || "enemy",
        level: Number(enemy.level) || 1,
        HP: enemy.HP || { current: 0, max: 0, temp: 0 },
        MP: enemy.MP || { current: 0, max: 0, temp: 0 },
        STA: enemy.STA || { current: 0, max: 0, temp: 0 },
        size: Number(enemy.size) || 30,
        visionDistance: Number(enemy.visionDistance) || 150,
        visionArc: Number(enemy.visionArc) || 90,
        rotation: Number(enemy.rotation) || 0,
        notes: enemy.notes || "",
        createdAt: enemy.createdAt || null,
        updatedAt: enemy.updatedAt || null,
    };
};

const normalizeEnemyInput = (raw = {}) => {
    const name = sanitizeText(raw.name, 120) || "Enemy";
    const level = clamp(Math.round(toNumber(raw.level, 1)), 1, 60);
    const maxHP = clamp(Math.round(toNumber(raw.maxHP ?? raw.HP?.max, 10)), 1, 100000);
    const currentHP = clamp(Math.round(toNumber(raw.hp ?? raw.HP?.current, maxHP)), 0, maxHP);
    const tempHP = clamp(Math.round(toNumber(raw.HP?.temp, 0)), 0, maxHP);

    return {
        name,
        kind: sanitizeText(raw.kind || "enemy", 40) || "enemy",
        level,
        HP: {
            current: currentHP,
            max: maxHP,
            temp: tempHP,
        },
        MP: {
            current: clamp(Math.round(toNumber(raw.MP?.current, 0)), 0, 100000),
            max: clamp(Math.round(toNumber(raw.MP?.max, 0)), 0, 100000),
            temp: clamp(Math.round(toNumber(raw.MP?.temp, 0)), 0, 100000),
        },
        STA: {
            current: clamp(Math.round(toNumber(raw.STA?.current, 0)), 0, 100000),
            max: clamp(Math.round(toNumber(raw.STA?.max, 0)), 0, 100000),
            temp: clamp(Math.round(toNumber(raw.STA?.temp, 0)), 0, 100000),
        },
        size: clamp(Math.round(toNumber(raw.size, 30)), 8, 300),
        visionDistance: clamp(Math.round(toNumber(raw.visionDistance, 150)), 10, 5000),
        visionArc: clamp(Math.round(toNumber(raw.visionArc, 90)), 10, 360),
        rotation: toNumber(raw.rotation, 0),
        notes: sanitizeText(raw.notes, 1000),
    };
};

const generateRandomCode = (length) => {
    let output = "";
    for (let i = 0; i < length; i += 1) {
        const idx = Math.floor(Math.random() * CODE_CHARS.length);
        output += CODE_CHARS[idx];
    }
    return output;
};

const generateUniqueCode = async (existsFn, length = JOIN_CODE_LENGTH, maxAttempts = 40) => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const code = generateRandomCode(length);
        const exists = await existsFn(code);
        if (!exists) return code;
    }
    throw new Error("Unable to generate a unique code. Please try again.");
};

const readCampaignForResponse = async (campaignID) =>
    Campaign.findById(campaignID)
        .populate({ path: "dmId", select: "_id username" })
        .populate({ path: "players", select: "_id username" })
        .populate({ path: "bannedPlayers", select: "_id username" })
        .populate({ path: "characterAssignments.playerId", select: "_id username" })
        .populate({ path: "characterAssignments.characterId", select: "_id name level playerId" })
        .lean();

/**
 * Builds a complete character token to store in the game snapshot.
 * This extracts all relevant data from a CHARACTER instance so the client
 * receives complete character information without needing to do calculations.
 */
const buildCharacterTokenFromInstance = (characterInstance, overrides = {}) => {
    if (!characterInstance) return null;

    // Extract character stats/properties from CHARACTER instance
    const hp = characterInstance._baseHP || characterInstance.HP || { max: 0, current: 0 };
    const mp = characterInstance._baseMP || characterInstance.MP || { max: 0, current: 0 };
    const sta = characterInstance._baseSTA || characterInstance.STA || { max: 0, current: 0 };
    
    // Get vision from the character's vision getter (applies light level modifiers)
    const characterVision = characterInstance.vision || { distance: 150, angle: 90, radius: 50 };
    const characterMemory = characterInstance.memory || { polygons: 0 };
    
    // Get action points
    const actionPoints = characterInstance._actionPoints || characterInstance.actionPoints || {
        action: 1,
        bonusAction: 1,
        reaction: 1,
        movement: 1,
        free: 99,
    };
    const carryCapacity = characterInstance.carryCapacity || {};
    const defenses = characterInstance.defenses || {};
    const perception = Number(characterInstance.perception ?? 0) || 0;
    const movementMax = typeof characterInstance.calculateMaxMovement === "function"
        ? Number(characterInstance.calculateMaxMovement() || 0)
        : Number(characterInstance.movement || DEFAULT_CHARACTER_MOVEMENT);
    const proficiencyBonus = Number(characterInstance.proficiencyBonus ?? 0) || 0;

    const token = {
        id: String(overrides.id || characterInstance.id || ""),
        name: String(overrides.name || characterInstance.name || "Unnamed Character"),
        position: overrides.position || { x: 0, y: 0 },
        size: Number(overrides.size !== undefined ? overrides.size : characterInstance.size || 30),
        rotation: Number(overrides.rotation !== undefined ? overrides.rotation : characterInstance.rotation || 0),
        visionDistance: Number(overrides.visionDistance || characterVision.distance || 150),
        visionArc: Number(overrides.visionArc || characterVision.angle || 90),
        movement: Number(overrides.movement || characterInstance._baseMovement || characterInstance.movement || DEFAULT_CHARACTER_MOVEMENT),
        team: String(overrides.team || characterInstance.team || "player"),
        lightLevel: Number(characterInstance.lightLevel !== undefined ? characterInstance.lightLevel : 0.5),
        
        // Full character data that client receives
        level: Number(characterInstance.level || 1),
        classType: (typeof characterInstance.classType === 'object' && characterInstance.classType?.name)
            ? String(characterInstance.classType.name)
            : String(characterInstance.classType || ""),
        race: (typeof characterInstance.race === 'object' && characterInstance.race?.name)
            ? String(characterInstance.race.name)
            : String(characterInstance.race || ""),
        background: (typeof characterInstance.background === 'object' && characterInstance.background?.name)
            ? String(characterInstance.background.name)
            : String(characterInstance.background || ""),
        
        // Stats (all properties the CHARACTER class has)
        stats: characterInstance._baseStats || characterInstance.stats || {},
        
        // Resource pools - current values
        HP: {
            max: Number(hp?.max) || 0,
            current: Number(hp?.current) || Number(hp?.max) || 0,
            temp: Number(hp?.temp) || 0,
        },
        MP: {
            max: Number(mp?.max) || 0,
            current: Number(mp?.current) || Number(mp?.max) || 0,
            temp: Number(mp?.temp) || 0,
        },
        STA: {
            max: Number(sta?.max) || 0,
            current: Number(sta?.current) || Number(sta?.max) || 0,
            temp: Number(sta?.temp) || 0,
        },
        
        // Action points for this turn
        actionPoints: {
            action: Number(actionPoints.action) || 0,
            bonusAction: Number(actionPoints.bonusAction) || 0,
            reaction: Number(actionPoints.reaction) || 0,
            movement: Number(actionPoints.movement) || 0,
            free: Number(actionPoints.free) || 0,
        },

        carryCapacity: {
            unrestricted: Number(carryCapacity.unrestricted ?? carryCapacity.max ?? 0) || 0,
            restricted: Number(carryCapacity.restricted ?? carryCapacity.maxRestricted ?? 0) || 0,
        },

        perception,
        movementMax,
        proficiencyBonus,
        AR: defenses.ar || characterInstance.AR || {},
        resistances: defenses.resistances || {},
        immunities: defenses.immunities || {},
        
        // Skills and abilities
        skills: characterInstance.skills || {},
        inv: characterInstance.inv || { equipment: [], items: {} },
        effects: Array.isArray(characterInstance.effects) ? characterInstance.effects : [],
        statusEffects: Array.isArray(characterInstance.statusEffects) ? characterInstance.statusEffects : [],
        
        // Equipment and inventory
        equipment: Array.isArray(characterInstance.equipment) ? characterInstance.equipment : [],
        inventory: characterInstance.inventory || {},
        equippedItems: Array.isArray(characterInstance.equippedItems) ? characterInstance.equippedItems : [],
        
        // Class features and abilities
        abilities: Array.isArray(characterInstance.abilities) ? characterInstance.abilities : [],
        classFeatures: Array.isArray(characterInstance.classFeatures) ? characterInstance.classFeatures : [],
        raceFeatures: Array.isArray(characterInstance.raceFeatures) ? characterInstance.raceFeatures : [],
        
        // Vision system - Required for advanced vision rendering
        // Uses vision getter which returns distance, angle, radius
        vision: {
            distance: Number(characterVision.distance || 150),
            angle: Number(characterVision.angle || 90),
            radius: Number(characterVision.radius || 50), // Close-range vision
        },
        memory: {
            polygons: Math.max(0, Math.floor(Number(characterMemory?.polygons ?? characterMemory ?? 0) || 0)),
        },
    };

    // Calculate vision rays using server-side ray casting
    // This ensures DM and character views are consistent
    try {
        ensureTokenVision(token);
        recalculateVisionRaysForToken(token, {
            rayCount: overrides?.visionRayCount ?? 256,
            snapshot: overrides?.snapshot,
        });
    } catch (err) {
        console.error('[buildCharacterTokenFromInstance] Error calculating vision rays:', err.message);
        token.visionRays = [];
    }

    return token;
};

/**
 * Hydrates character tokens in a snapshot with full CHARACTER instance data.
 * This is called when loading a game to ensure characters have complete stats.
 */
const hydrateCharacterTokensInSnapshot = async (snapshot, socket) => {
    if (!snapshot || !Array.isArray(snapshot.characters)) {
        return snapshot;
    }

    console.log('[hydrateCharacterTokens] Hydrating', snapshot.characters.length, 'characters');
    
    // Build map of character IDs to hydrate
    const characterIds = snapshot.characters
        .map(char => {
            const id = String(char?.id || "");
            // Only hydrate if it looks like a MongoDB ID (player characters), not enemy tokens
            if (mongoose.isValidObjectId(id) && !id.startsWith('enemy_')) {
                return id;
            }
            return null;
        })
        .filter(Boolean);

    if (characterIds.length === 0) {
        return snapshot;
    }

    // Build CHARACTER instances for each character and get their player info
    const hydrationMap = new Map();
    const playerNameMap = new Map(); // To cache player names
    
    for (const charId of characterIds) {
        try {
            const builder = new CharacterBuilder(socket);
            const characterInstance = await builder.buildFromId(charId);
            if (characterInstance) {
                hydrationMap.set(charId, characterInstance);
                
                // Fetch player name for this character
                if (characterInstance._playerId) {
                    if (!playerNameMap.has(characterInstance._playerId)) {
                        const playerDoc = await Player.findById(characterInstance._playerId).select("username _id").lean();
                        if (playerDoc) {
                            playerNameMap.set(characterInstance._playerId, playerDoc.username || "Player");
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('[hydrateCharacterTokens] Failed to build CHARACTER for', charId, ':', error.message);
        }
    }

    // Update tokens with full data
    const hydratedCharacters = snapshot.characters.map(token => {
        const charId = String(token?.id || "");
        const characterInstance = hydrationMap.get(charId);
        
        if (characterInstance) {
            // Merge existing token properties (like position) with full CHARACTER data
            const hydratedToken = buildCharacterTokenFromInstance(characterInstance, {
                id: charId,
                position: token.position,
                team: token.team,
            });
            
            // Add player ownership information
            if (characterInstance._playerId) {
                const playerId = String(characterInstance._playerId);
                hydratedToken.ownerId = playerId;
                hydratedToken.ownerName = playerNameMap.get(playerId) || "Player";
            }
            
            console.log('[hydrateCharacterTokens] Hydrated', charId, 'with HP:', hydratedToken?.HP, 'owner:', hydratedToken?.ownerName);
            return hydratedToken;
        }
        
        // Return original token if hydration failed
        return token;
    });

    return {
        ...snapshot,
        characters: hydratedCharacters,
    };
};
    const executeAndSyncAction = async (socket, data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, characterID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({ success: false, message: "Valid playerID and campaignID are required" });
            }

            const normalizedCharacterID = String(characterID || "").trim();
            if (!normalizedCharacterID || !mongoose.isValidObjectId(normalizedCharacterID)) {
                return respond({ success: false, message: "Valid characterID is required" });
            }

            const actionRef = String(data?.actionPath || data?.actionId || data?.action || "").trim();
            if (!actionRef) {
                return respond({ success: false, message: "Action path is required" });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments characterStates settings"
            );
            if (!campaign) return respond({ success: false, message: "Campaign not found" });

            // ... (Permission checks omitted for brevity, assuming caller handles or we re-verify) ...
            // For this refactor, we assume basic ID checks passed.
            // Re-verifying critical permissions:
            if (!isCampaignMember(campaign, playerID)) {
                return respond({ success: false, message: "Only campaign members can perform actions" });
            }

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({ _id: campaign.activeGameSave, campaignId: campaign._id }).select("snapshot");
                if (saveDoc) snapshot = toPlainObject(saveDoc.snapshot);
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            if (!Array.isArray(runtimeState.snapshot.characters)) runtimeState.snapshot.characters = [];

            const characterToken = runtimeState.snapshot.characters.find(c => String(c?.id ?? "") === normalizedCharacterID);
            if (!characterToken) return respond({ success: false, message: "Character is not placed on the map yet" });

            const builder = new CharacterBuilder(socket);
            const characterInstance = await builder.buildFromId(normalizedCharacterID);
            if (!characterInstance) return respond({ success: false, message: "Failed to load character data" });

            // Sync token state to instance
            // Must synchronise ALL runtime state from the snapshot so that computed
            // getters (HP.max, perception, vision, etc.) reflect in-combat reality.
            if (characterToken?.position) characterInstance.position = { ...characterToken.position };
            if (characterToken?.HP && characterInstance._baseHP) {
                characterInstance._baseHP.current = Number(characterToken.HP.current) || 0;
                characterInstance._baseHP.temp    = Number(characterToken.HP.temp)    || 0;
                // Don't copy .max from token — the getter recomputes it from CON formula
            }
            if (characterToken?.MP && characterInstance._baseMP) {
                characterInstance._baseMP.current = Number(characterToken.MP.current) || 0;
                characterInstance._baseMP.temp    = Number(characterToken.MP.temp)    || 0;
            }
            if (characterToken?.STA) {
                if (characterInstance._baseSTA) {
                    characterInstance._baseSTA.current = Number(characterToken.STA.current) || 0;
                    characterInstance._baseSTA.max = Number(characterToken.STA.max) || 0;
                    characterInstance._baseSTA.temp = Number(characterToken.STA.temp) || 0;
                }
            }
            if (Number.isFinite(Number(characterToken?.movement))) characterInstance._baseMovement = Number(characterToken.movement);
            if (characterToken?.actionPoints) characterInstance._actionPoints = JSON.parse(JSON.stringify(characterToken.actionPoints));
            // Sync runtime status effects so modifier pipeline runs with full context
            if (Array.isArray(characterToken?.statusEffects)) {
                characterInstance.statusEffects = JSON.parse(JSON.stringify(characterToken.statusEffects));
                if (typeof characterInstance.invalidateCache === "function") characterInstance.invalidateCache();
            }

            const gameEngine = campaignGameEngineByID.get(String(campaign._id));

            if (gameEngine && gameEngine.state === 'active') {
                const isDM = isCampaignDM(campaign, playerID);
                if (!isDM) {
                    const currentChar = gameEngine.getCurrentCharacter();
                    if (currentChar && String(currentChar.id) !== normalizedCharacterID) {
                        return respond({
                            success: false,
                            message: `It is not this character's turn. ${currentChar.name} is currently acting.`,
                        });
                    }
                }
            }
            
            // Resolve target
            const allCharacterTokens = runtimeState.snapshot.characters || [];
            const targetTokenId = String(data?.params?.targetId || "").trim();
            let targetInstance = null;
            if (targetTokenId && mongoose.isValidObjectId(targetTokenId)) {
                const targetToken = allCharacterTokens.find(t => String(t?.id ?? "") === targetTokenId);
                if (targetToken) {
                    try {
                        targetInstance = await builder.buildFromId(targetTokenId);
                        if (targetInstance) {
                            if (targetToken.HP && targetInstance._baseHP) {
                                targetInstance._baseHP.current = Number(targetToken.HP.current) || 0;
                                targetInstance._baseHP.temp    = Number(targetToken.HP.temp)    || 0;
                            }
                            if (targetToken.MP && targetInstance._baseMP) {
                                targetInstance._baseMP.current = Number(targetToken.MP.current) || 0;
                                targetInstance._baseMP.temp    = Number(targetToken.MP.temp)    || 0;
                            }
                            if (targetToken.position) targetInstance.position = { ...targetToken.position };
                            if (Array.isArray(targetToken.statusEffects)) {
                                targetInstance.statusEffects = JSON.parse(JSON.stringify(targetToken.statusEffects));
                                if (typeof targetInstance.invalidateCache === "function") targetInstance.invalidateCache();
                            }
                        }
                    } catch (e) {}
                }
            }

            const params = toPlainObject(data?.params);
            if (targetInstance) params.target = targetInstance;
            if (gameEngine) params.combatEngine = gameEngine;

            let actionResult;
            try {
                actionResult = characterInstance.executeAction(actionRef, params);
            } catch (error) {
                return respond({ success: false, message: error.message || "Failed to execute action" });
            }

            // Sync back to token
            let didUpdateSnapshot = false;
            
            // Sync position first (needed before full sync so it's in the token)
            const oldPos = { ...characterToken.position };
            if (actionResult?.position) {
                characterToken.position = {
                    x: Math.round(Number(actionResult.position.x)),
                    y: Math.round(Number(actionResult.position.y)),
                    z: Number(actionResult.position.z) || 0
                };
                didUpdateSnapshot = true;
            }

            // Sync action points / movement overrides from actionResult before full sync
            // (these live on the instance, applyModifierPipeline already ran)
            if (actionResult?.movementRemaining != null) characterInstance._baseMovement = actionResult.movementRemaining;
            if (actionResult?.actionPoints) characterInstance._actionPoints = actionResult.actionPoints;

            // Full sync — reads all computed getters (HP, MP, STA, perception, vision, AR, stats, …)
            syncEngineCharacterToToken(characterInstance, characterToken);
            didUpdateSnapshot = true;

            // Sync target's full state if it was affected
            if (targetInstance && targetTokenId) {
                const targetToken = allCharacterTokens.find(t => String(t?.id ?? "") === targetTokenId);
                if (targetToken) {
                    syncEngineCharacterToToken(targetInstance, targetToken);
                    didUpdateSnapshot = true;
                }
            }

            // Keep the live engine characters in sync so that endTurn / _processTurnStart
            // operate on correct HP/MP/STA/statusEffects instead of stale combat-start values.
            if (gameEngine) {
                const actorEngineChar = gameEngine.characters?.get(normalizedCharacterID);
                if (actorEngineChar) syncTokenToEngineCharacter(characterToken, actorEngineChar);

                if (targetTokenId) {
                    const targetEngineChar = gameEngine.characters?.get(targetTokenId);
                    const targetTok = allCharacterTokens.find(t => String(t?.id ?? "") === targetTokenId);
                    if (targetEngineChar && targetTok) syncTokenToEngineCharacter(targetTok, targetEngineChar);
                }
            }

            if (didUpdateSnapshot) {
                recalculateVisionRaysForToken(characterToken, { snapshot: runtimeState.snapshot });
                runtimeState.revision++;
                runtimeState.updatedAt = Date.now();
            }

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
                characterID: normalizedCharacterID,
                actionResult: actionResult || null,
            };

            socket.join(getCampaignGameRoom(campaign._id));
            const isDM = isCampaignDM(campaign, playerID);
            if (isDM) socket.join(getCampaignDMRoom(campaign._id));
            else socket.join(getCampaignPlayersRoom(campaign._id));

            await emitPlayerStateUpdate(socket, campaign, payload);
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);

            // Broadcast Animation
            const actionType = String(actionResult.actionType || data.actionType || "").toLowerCase();
            if (actionType === "movement" || String(actionRef).includes("movement")) {
                const animPayload = {
                    type: "movement",
                    entityId: normalizedCharacterID,
                    entityType: "character",
                    duration: 300,
                    params: {
                        startX: oldPos.x, startY: oldPos.y,
                        targetX: characterToken.position.x, targetY: characterToken.position.y
                    }
                };
                socket.to(getCampaignGameRoom(campaign._id)).emit("campaign_animation", animPayload);
                socket.emit("campaign_animation", animPayload); // Send to self too for consistency
            }

            respond(isDM ? payload : buildPlayerPayloadForPlayer(payload, campaign, playerID));
        } catch (error) {
            console.error("[executeAndSyncAction] failed", error);
            respond({ success: false, message: error.message });
        }
    };

const persistGame = async (
    campaignID,
    playerID,
    name,
    description,
    snapshotInput,
    isAutoSave = false,
    makeActive = false,
    options = {}
) => {
    const campaign = await Campaign.findById(campaignID);
    if (!campaign) return { success: false, message: "Campaign not found" };

    const runtimeState = options.runtimeState ||
        campaignRuntimeStateByID.get(String(campaignID)) ||
        createEngineState(campaignID, {});
    const snapshotForSave = options.snapshotForSave ||
        (Object.keys(snapshotInput || {}).length > 0
            ? snapshotInput
            : toPlainObject(runtimeState?.snapshot));
    const snapshotForRuntime = options.snapshotForRuntime || snapshotForSave;

    const gameSave = await GameSave.create({
        campaignId: campaign._id,
        name,
        description,
        savedBy: playerID,
        snapshot: snapshotForSave,
        metadata: { source: isAutoSave ? "autosave" : "manual" },
        isAutoSave,
    });

    campaign.gameSaves.addToSet(gameSave._id);
    if (makeActive || !campaign.activeGameSave) {
        campaign.activeGameSave = gameSave._id;
    }

    let prunedAutoSaveIDs = [];
    if (isAutoSave) {
        const autoSaves = await GameSave.find({
            campaignId: campaign._id,
            isAutoSave: true,
        })
            .sort({ updatedAt: -1, _id: -1 })
            .select("_id");

        const overflowAutoSaves = autoSaves.slice(MAX_AUTO_SAVE_HISTORY);
        if (overflowAutoSaves.length > 0) {
            const pruneIDSet = new Set(overflowAutoSaves.map((d) => String(d._id)));
            prunedAutoSaveIDs = Array.from(pruneIDSet);
            campaign.gameSaves = campaign.gameSaves.filter(id => !pruneIDSet.has(String(id)));
            await GameSave.deleteMany({ _id: { $in: overflowAutoSaves.map(d => d._id) } });
        }
    }

    await campaign.save();
    const replaceRuntime = options.replaceRuntime !== false;
    const nextRuntimeState = replaceRuntime
        ? replaceRuntimeState(campaign._id, snapshotForRuntime)
        : runtimeState;
    return {
        success: true,
        gameSave: formatGameSave(gameSave),
        engineState: cloneEngineState(nextRuntimeState),
        prunedAutoSaveIDs
    };
};

module.exports = (socket) => {

    socket.on("campaign_stageAction", async (data, callback) => {
        const respond = safeCallback(callback);
        const { campaignID, characterID } = data || {};
        const gameEngine = getOrCreateGameEngine(campaignID);
        if (!gameEngine) return respond({ success: false, message: "Game engine not found" });
        
        gameEngine.stageAction(characterID, data);
        respond({ success: true, message: "Action staged" });
    });

    socket.on("campaign_commitAction", async (data, callback) => {
        const respond = safeCallback(callback);
        const { campaignID, characterID } = data || {};
        const gameEngine = getOrCreateGameEngine(campaignID);
        if (!gameEngine) return respond({ success: false, message: "Game engine not found" });

        const stagedData = gameEngine.getStagedAction(characterID);
        if (!stagedData) return respond({ success: false, message: "No staged action found" });

        // Execute the staged action using the shared logic
        await executeAndSyncAction(socket, stagedData, (result) => {
            if (result.success) {
                gameEngine.clearStagedAction(characterID);
            }
            respond(result);
        });
    });

    socket.on("campaign_cancelAction", async (data, callback) => {
        const respond = safeCallback(callback);
        const { campaignID, characterID } = data || {};
        const gameEngine = getOrCreateGameEngine(campaignID);
        if (!gameEngine) return respond({ success: false, message: "Game engine not found" });

        gameEngine.clearStagedAction(characterID);
        respond({ success: true, message: "Action cancelled" });
    });


    socket.on("campaign_getGameContext", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID)
                .populate({ path: "dmId", select: "_id username" })
                .populate({ path: "players", select: "_id username" })
                .populate({ path: "bannedPlayers", select: "_id username" })
                .populate({ path: "characterAssignments.playerId", select: "_id username" })
                .populate({ path: "characterAssignments.characterId", select: "_id name level playerId" });
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can access this game",
                });
            }

            let activeGameSave = null;
            let snapshot = {};
            if (campaign.activeGameSave && mongoose.isValidObjectId(campaign.activeGameSave)) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                });
                if (saveDoc) {
                    activeGameSave = formatGameSave(saveDoc);
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            // Hydrate character tokens with full CHARACTER data
            snapshot = await hydrateCharacterTokensInSnapshot(snapshot, socket);

            const isDM = isCampaignDM(campaign, playerID);
            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            recalculateVisionRaysForSnapshot(runtimeState);
            socket.data.playerID = String(playerID);
            socket.data.campaignID = String(campaign._id);
            socket.data.isDM = isDM;
            socket.join(getCampaignGameRoom(campaign._id));
            if (isDM) {
                socket.join(getCampaignDMRoom(campaign._id));
            } else {
                socket.join(getCampaignPlayersRoom(campaign._id));
            }

            const engineState = cloneEngineState(runtimeState);
            let filteredSnapshot = toPlainObject(engineState.snapshot);
            if (!isDM) {
                filteredSnapshot = filterSnapshotForPlayer(engineState.snapshot, campaign, playerID);
                engineState.snapshot = filteredSnapshot;
            }

            respond({
                success: true,
                campaign: formatCampaign(campaign),
                permissions: {
                    isDM,
                    canEditWorld: isDM,
                },
                activeGameSave,
                floorTypes: FLOOR_TYPES,
                engineState,
                snapshot: filteredSnapshot,
            });
        } catch (error) {
            console.error("[campaign_getGameContext] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to load game context",
            });
        }
    });

    socket.on("campaign_gameRequestState", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can access game state",
                });
            }

            let snapshot = {};
            if (campaign.activeGameSave && mongoose.isValidObjectId(campaign.activeGameSave)) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            socket.join(getCampaignGameRoom(campaign._id));
            const isDM = isCampaignDM(campaign, playerID);
            socket.data.playerID = String(playerID);
            socket.data.campaignID = String(campaign._id);
            socket.data.isDM = isDM;
            if (isDM) {
                socket.join(getCampaignDMRoom(campaign._id));
            } else {
                socket.join(getCampaignPlayersRoom(campaign._id));
            }

            const engineState = cloneEngineState(runtimeState);
            if (!isDM) {
                engineState.snapshot = filterSnapshotForPlayer(engineState.snapshot, campaign, playerID);
            }

            respond({
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
            });
        } catch (error) {
            console.error("[campaign_gameRequestState] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to load runtime game state",
            });
        }
    });

    socket.on("campaign_gameSyncWorld", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, statePatch } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can sync world state",
                });
            }

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            updateEngineState(runtimeState, statePatch);
            recalculateLighting(runtimeState);
            recalculateVisionRaysForSnapshot(runtimeState);

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
            };
            socket.join(getCampaignGameRoom(campaign._id));
            socket.join(getCampaignDMRoom(campaign._id));
            await emitPlayerStateUpdate(socket, campaign, payload);
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);
            respond(payload);
        } catch (error) {
            console.error("[campaign_gameSyncWorld] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to sync world state",
            });
        }
    });

    socket.on("campaign_journalUpdate", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, action } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can edit journals",
                });
            }

            const isDM = isCampaignDM(campaign, playerID);

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            const nextJournalState = cloneJournalState(runtimeState.snapshot?.journalState || {});

            const actionKey = String(action || "").trim();
            if (!actionKey) {
                return respond({ success: false, message: "Journal action is required" });
            }

            if (actionKey === "doc_create") {
                const incoming = normalizeJournalDocInput(data?.doc, playerID);
                if (!incoming.id) {
                    return respond({ success: false, message: "Document id is required" });
                }
                if (!isDM && incoming.type === "diary" && String(incoming.ownerId) !== String(playerID)) {
                    return respond({ success: false, message: "You can only create your own diary entries" });
                }
                const existingIndex = nextJournalState.documents.findIndex(
                    (doc) => String(doc.id) === incoming.id
                );
                if (existingIndex >= 0) {
                    nextJournalState.documents[existingIndex] = {
                        ...nextJournalState.documents[existingIndex],
                        ...incoming,
                        updatedAt: Date.now(),
                    };
                } else {
                    nextJournalState.documents.unshift({
                        ...incoming,
                        updatedAt: Date.now(),
                    });
                }
            } else if (actionKey === "doc_update") {
                const docId = String(data?.docId || "").trim();
                if (!docId) {
                    return respond({ success: false, message: "Document id is required" });
                }
                const docIndex = nextJournalState.documents.findIndex(
                    (doc) => String(doc.id) === docId
                );
                if (docIndex < 0) {
                    return respond({ success: false, message: "Document not found" });
                }
                const existing = nextJournalState.documents[docIndex];
                if (!isDM && existing.type === "diary" && String(existing.ownerId) !== String(playerID)) {
                    return respond({ success: false, message: "You cannot edit this diary entry" });
                }
                nextJournalState.documents[docIndex] = applyJournalDocUpdates(
                    existing,
                    toPlainObject(data?.updates),
                    isDM
                );
            } else if (actionKey === "doc_delete") {
                const docId = String(data?.docId || "").trim();
                if (!docId) {
                    return respond({ success: false, message: "Document id is required" });
                }
                const docIndex = nextJournalState.documents.findIndex(
                    (doc) => String(doc.id) === docId
                );
                if (docIndex < 0) {
                    return respond({ success: true, campaignID: String(campaign._id), journalState: nextJournalState });
                }
                const existing = nextJournalState.documents[docIndex];
                if (!isDM && existing.type === "diary" && String(existing.ownerId) !== String(playerID)) {
                    return respond({ success: false, message: "You cannot delete this diary entry" });
                }
                nextJournalState.documents = nextJournalState.documents.filter(
                    (doc) => String(doc.id) !== docId
                );
            } else if (actionKey === "group_create") {
                const incoming = normalizeJournalGroupInput(data?.group, playerID);
                if (!incoming.id) {
                    return respond({ success: false, message: "Group id is required" });
                }
                if (!isDM && incoming.type === "diary" && String(incoming.ownerId) !== String(playerID)) {
                    return respond({ success: false, message: "You can only create your own diary groups" });
                }
                const existingIndex = nextJournalState.groups.findIndex(
                    (group) => String(group.id) === incoming.id
                );
                if (existingIndex >= 0) {
                    nextJournalState.groups[existingIndex] = {
                        ...nextJournalState.groups[existingIndex],
                        ...incoming,
                    };
                } else {
                    nextJournalState.groups.push(incoming);
                }
            } else if (actionKey === "group_update") {
                const groupId = String(data?.groupId || "").trim();
                if (!groupId) {
                    return respond({ success: false, message: "Group id is required" });
                }
                const groupIndex = nextJournalState.groups.findIndex(
                    (group) => String(group.id) === groupId
                );
                if (groupIndex < 0) {
                    return respond({ success: false, message: "Group not found" });
                }
                const existing = nextJournalState.groups[groupIndex];
                if (!isDM && existing.type === "diary" && String(existing.ownerId) !== String(playerID)) {
                    return respond({ success: false, message: "You cannot edit this diary group" });
                }
                const updates = toPlainObject(data?.updates);
                nextJournalState.groups[groupIndex] = {
                    ...existing,
                    name: typeof updates.name === "string"
                        ? sanitizeText(updates.name || existing.name, 120) || existing.name
                        : existing.name,
                    icon: updates.icon != null ? String(updates.icon) : existing.icon,
                    iconColor: updates.iconColor != null
                        ? sanitizeHexColor(updates.iconColor) || existing.iconColor
                        : existing.iconColor,
                };
            } else if (actionKey === "group_delete") {
                const groupId = String(data?.groupId || "").trim();
                if (!groupId) {
                    return respond({ success: false, message: "Group id is required" });
                }
                const groupIndex = nextJournalState.groups.findIndex(
                    (group) => String(group.id) === groupId
                );
                if (groupIndex < 0) {
                    return respond({ success: true, campaignID: String(campaign._id), journalState: nextJournalState });
                }
                const existing = nextJournalState.groups[groupIndex];
                if (!isDM && existing.type === "diary" && String(existing.ownerId) !== String(playerID)) {
                    return respond({ success: false, message: "You cannot delete this diary group" });
                }
                nextJournalState.groups = nextJournalState.groups.filter(
                    (group) => String(group.id) !== groupId
                );
                nextJournalState.documents = nextJournalState.documents.map((doc) => {
                    if (String(doc.groupId) !== groupId) return doc;
                    return { ...doc, groupId: null, updatedAt: Date.now() };
                });
            } else {
                return respond({ success: false, message: "Unknown journal action" });
            }

            updateEngineState(runtimeState, { journalState: nextJournalState });

            const payload = {
                success: true,
                campaignID: String(campaign._id),
                journalState: runtimeState.snapshot?.journalState || nextJournalState,
            };

            socket.join(getCampaignGameRoom(campaign._id));
            socket.to(getCampaignGameRoom(campaign._id)).emit("campaign_journalStateUpdated", payload);
            respond(payload);
        } catch (error) {
            console.error("[campaign_journalUpdate] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to update journal",
            });
        }
    });

    socket.on("campaign_journalCursor", async (data = {}) => {
        try {
            const campaignID = String(data?.campaignID || socket.data?.campaignID || "");
            const playerID = String(data?.playerID || socket.data?.playerID || "");
            const docId = String(data?.docId || "").trim();
            const playerName = String(data?.playerName || "").trim();
            const position = Math.max(0, Math.round(Number(data?.position) || 0));

            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) return;
            if (!docId) return;

            if (
                String(socket.data?.campaignID || "") === campaignID &&
                String(socket.data?.playerID || "") === playerID
            ) {
                socket.join(getCampaignGameRoom(campaignID));
                socket.to(getCampaignGameRoom(campaignID)).emit("campaign_journalCursor", {
                    campaignID,
                    playerID,
                    playerName,
                    docId,
                    position,
                    timestamp: Date.now(),
                });
                return;
            }

            const campaign = await Campaign.findById(campaignID).select("_id dmId players");
            if (!campaign || !isCampaignMember(campaign, playerID)) return;

            socket.join(getCampaignGameRoom(campaignID));
            socket.to(getCampaignGameRoom(campaignID)).emit("campaign_journalCursor", {
                campaignID,
                playerID,
                playerName,
                docId,
                position,
                timestamp: Date.now(),
            });
        } catch (error) {
            console.error("[campaign_journalCursor] failed", error);
        }
    });

    socket.on("campaign_gameDamageObject", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, objectID, amount } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can modify objects",
                });
            }
            const isDM = isCampaignDM(campaign, playerID);

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            const damageAmount = Math.round(Number(amount) || 0);
            if (!Number.isFinite(damageAmount) || damageAmount === 0) {
                return respond({
                    success: false,
                    message: "Damage amount must be a non-zero number",
                });
            }

            const result = applyObjectHPDelta(runtimeState, objectID, damageAmount);
            if (!result?.success) {
                return respond({
                    success: false,
                    message: result?.message || "Failed to apply object HP update",
                });
            }
            recalculateLighting(runtimeState);
            recalculateVisionRaysForSnapshot(runtimeState);

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
                object: result.object || null,
            };
            const transformPayload = (playerPayload, filteredSnapshot) => {
                const objectIsVisible = (filteredSnapshot.mapObjects || []).some(
                    (obj) => String(obj?.id ?? "") === String(result.object?.id ?? "")
                );
                return {
                    ...playerPayload,
                    object: objectIsVisible ? result.object || null : null,
                };
            };
            socket.join(getCampaignGameRoom(campaign._id));
            if (isDM) {
                socket.join(getCampaignDMRoom(campaign._id));
            } else {
                socket.join(getCampaignPlayersRoom(campaign._id));
            }
            await emitPlayerStateUpdate(socket, campaign, payload, { transform: transformPayload });
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);
            respond(
                isDM
                    ? payload
                    : buildPlayerPayloadForPlayer(payload, campaign, playerID, {
                          transform: transformPayload,
                      })
            );
        } catch (error) {
            console.error("[campaign_gameDamageObject] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to modify object HP",
            });
        }
    });

    socket.on("campaign_moveCharacter", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, characterID } = data || {};
        const positionPatch = toPlainObject(data?.position);

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const normalizedCharacterID = String(characterID || "").trim();
            if (!normalizedCharacterID) {
                return respond({
                    success: false,
                    message: "characterID is required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments characterStates settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can move characters",
                });
            }

            const isDM = isCampaignDM(campaign, playerID);
            if (!isDM && !mongoose.isValidObjectId(normalizedCharacterID)) {
                return respond({
                    success: false,
                    message: "characterID must be a valid character id",
                });
            }

            const assignment = Array.isArray(campaign.characterAssignments)
                ? campaign.characterAssignments.find(
                      (entry) => toObjectIdString(entry?.characterId) === normalizedCharacterID
                  ) || null
                : null;
            const stateEntry = assignment
                ? findCampaignCharacterState(campaign, normalizedCharacterID)
                : null;
            const { hp, maxHP } = extractHPFromState(stateEntry);

            if (!isDM) {
                let ownerID = toObjectIdString(assignment?.playerId);
                
                // If not in assignment map, check if character exists and player is creator
                if (!ownerID && mongoose.isValidObjectId(normalizedCharacterID)) {
                    const characterDoc = await Character.findById(normalizedCharacterID).select("playerId");
                    if (characterDoc) {
                        ownerID = toObjectIdString(characterDoc.playerId);
                    }
                }
                
                if (!ownerID || ownerID !== String(playerID)) {
                    return respond({
                        success: false,
                        message: "Only the character owner or DM can move this character",
                    });
                }
            }

            const gameEngine = campaignGameEngineByID.get(String(campaign._id));
            if (!isDM && gameEngine && gameEngine.state === 'active') {
                const currentChar = gameEngine.getCurrentCharacter();
                if (currentChar && String(currentChar.id) !== normalizedCharacterID) {
                    return respond({
                        success: false,
                        message: `It is not this character's turn. ${currentChar.name} is currently acting.`,
                    });
                }
            }

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            if (!Array.isArray(runtimeState.snapshot.characters)) {
                runtimeState.snapshot.characters = [];
            }

            let characterToken = runtimeState.snapshot.characters.find(
                (char) => String(char?.id ?? "") === normalizedCharacterID
            );

            if (!characterToken) {
                // Build the full CHARACTER instance with all its data
                let characterInstance = null;
                
                if (mongoose.isValidObjectId(normalizedCharacterID)) {
                    try {
                        const builder = new CharacterBuilder(socket);
                        characterInstance = await builder.buildFromId(normalizedCharacterID);
                        console.log('[campaign_moveCharacter] Built CHARACTER instance for', normalizedCharacterID);
                    } catch (error) {
                        console.warn('[campaign_moveCharacter] Failed to build CHARACTER:', error.message);
                    }
                }
                
                const resolvedTeam = assignment ? "player" : String(data?.team || "neutral");
                
                if (characterInstance) {
                    // Use the full CHARACTER instance to populate token
                    characterToken = buildCharacterTokenFromInstance(characterInstance, {
                        id: normalizedCharacterID,
                        team: isDM ? resolvedTeam : "player",
                        position: { x: 0, y: 0 },
                    });
                    console.log('[campaign_moveCharacter] Created full character token with HP:', characterToken?.HP, 'STA:', characterToken?.STA);
                } else {
                    // Fallback to minimal token if CHARACTER build fails
                    let name = "Character";
                    if (data?.name) {
                        name = sanitizeText(data.name, 120) || name;
                    }
                    
                    characterToken = {
                        id: normalizedCharacterID,
                        name,
                        position: { x: 0, y: 0 },
                        size: 30,
                        visionDistance: 150,
                        rotation: 0,
                        visionArc: 90,
                        movement: DEFAULT_CHARACTER_MOVEMENT,
                        team: isDM ? resolvedTeam : "player",
                        HP: { max: 0, current: 0, temp: 0 },
                        MP: { max: 0, current: 0, temp: 0 },
                        STA: { max: 0, current: 0, temp: 0 },
                        actionPoints: { action: 1, bonusAction: 1, reaction: 1, movement: 1, free: 99 },
                        memory: { polygons: 0 },
                    };
                    
                    if (maxHP != null) characterToken.HP.max = maxHP;
                    if (hp != null) characterToken.HP.current = hp;
                }
                
                runtimeState.snapshot.characters.push(characterToken);
            }

            if (!Number.isFinite(Number(characterToken?.movement))) {
                characterToken.movement = DEFAULT_CHARACTER_MOVEMENT;
            }

            const hasPosX = positionPatch?.x != null || data?.x != null;
            const hasPosY = positionPatch?.y != null || data?.y != null;
            if (hasPosX || hasPosY) {
                const currentX = toNumber(characterToken?.position?.x, 0);
                const currentY = toNumber(characterToken?.position?.y, 0);
                const nextX = Math.round(toNumber(positionPatch?.x ?? data?.x, currentX));
                const nextY = Math.round(toNumber(positionPatch?.y ?? data?.y, currentY));
                characterToken.position = { x: nextX, y: nextY };
            }

            if (data?.rotation != null) {
                characterToken.rotation = toNumber(data.rotation, characterToken.rotation || 0);
            }

            recalculateVisionRaysForToken(characterToken, { snapshot: runtimeState.snapshot });

            runtimeState.revision = Number(runtimeState.revision) + 1;
            runtimeState.updatedAt = Date.now();

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
                characterID: normalizedCharacterID,
            };

            socket.join(getCampaignGameRoom(campaign._id));
            if (isDM) {
                socket.join(getCampaignDMRoom(campaign._id));
            } else {
                socket.join(getCampaignPlayersRoom(campaign._id));
            }

            await emitPlayerStateUpdate(socket, campaign, payload);
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);

            respond(
                isDM ? payload : buildPlayerPayloadForPlayer(payload, campaign, playerID)
            );
        } catch (error) {
            console.error("[campaign_moveCharacter] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to move character",
            });
        }
    });

    socket.on("campaign_adjustCharacterResource", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, characterID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can update characters",
                });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can adjust character resources",
                });
            }

            const normalizedCharacterID = String(characterID || "").trim();
            if (!normalizedCharacterID) {
                return respond({ success: false, message: "Character ID is required" });
            }

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            const targetToken = (runtimeState.snapshot.characters || []).find(
                (char) => String(char?.id ?? "") === normalizedCharacterID
            );
            if (!targetToken) {
                return respond({ success: false, message: "Character not found in snapshot" });
            }

            const resourceKey = String(data?.resource || "")
                .trim()
                .toUpperCase();
            if (!["HP", "MP", "STA"].includes(resourceKey)) {
                return respond({ success: false, message: "Resource must be HP, MP, or STA" });
            }

            const field = ["current", "max", "temp"].includes(data?.field)
                ? data.field
                : "current";
            const deltaValue = Number(data?.delta);
            const setValueRaw = data?.value ?? data?.setValue;
            const hasSetValue = Number.isFinite(Number(setValueRaw));

            if (!hasSetValue && !Number.isFinite(deltaValue)) {
                return respond({ success: false, message: "A numeric delta or value is required" });
            }

            const nextResource =
                targetToken[resourceKey] && typeof targetToken[resourceKey] === "object"
                    ? { ...targetToken[resourceKey] }
                    : { max: 0, current: 0, temp: 0 };

            const currentValue = Number(nextResource[field]) || 0;
            let nextValue = hasSetValue ? Number(setValueRaw) : currentValue + deltaValue;

            if (field === "current") {
                const max = Number(nextResource.max);
                if (Number.isFinite(max)) {
                    nextValue = clamp(nextValue, 0, max);
                } else {
                    nextValue = Math.max(0, nextValue);
                }
            } else if (field === "max") {
                nextValue = Math.max(0, nextValue);
                if (Number(nextResource.current) > nextValue) {
                    nextResource.current = nextValue;
                }
            } else if (field === "temp") {
                nextValue = Math.max(0, nextValue);
            }

            nextResource[field] = nextValue;
            targetToken[resourceKey] = nextResource;

            const gameEngine = campaignGameEngineByID.get(String(campaign._id));
            const engineChar = gameEngine?.characters?.get(normalizedCharacterID);
            if (engineChar) {
                const baseKey =
                    resourceKey === "HP"
                        ? "_baseHP"
                        : resourceKey === "MP"
                            ? "_baseMP"
                            : "_baseSTA";
                if (engineChar[baseKey] && typeof engineChar[baseKey] === "object") {
                    engineChar[baseKey][field] = nextValue;
                }
                if (typeof engineChar.invalidateCache === "function") engineChar.invalidateCache();
                // Re-read all computed properties so snapshot has correct maxes (CON/WIS formula)
                syncEngineCharacterToToken(engineChar, targetToken);
            }
            // Snapshot already has the manually-set field value from earlier;
            // syncEngineCharacterToToken may overwrite HP/MP/STA with getter values
            // which recompute max — the current field we just set is preserved because
            // it was written to _base* before the sync.

            runtimeState.revision = Number(runtimeState.revision) + 1;
            runtimeState.updatedAt = Date.now();

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
            };

            socket.join(getCampaignGameRoom(campaign._id));
            socket.join(getCampaignDMRoom(campaign._id));
            await emitPlayerStateUpdate(socket, campaign, payload);
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);
            respond(payload);
        } catch (error) {
            console.error("[campaign_adjustCharacterResource] failed", error);
            respond({ success: false, message: "Failed to update character resource" });
        }
    });

    socket.on("campaign_updateCharacterStatusEffects", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, characterID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can update characters",
                });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can modify status effects",
                });
            }

            const normalizedCharacterID = String(characterID || "").trim();
            if (!normalizedCharacterID) {
                return respond({ success: false, message: "Character ID is required" });
            }

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            const targetToken = (runtimeState.snapshot.characters || []).find(
                (char) => String(char?.id ?? "") === normalizedCharacterID
            );
            if (!targetToken) {
                return respond({ success: false, message: "Character not found in snapshot" });
            }

            const action = String(data?.action || "add").trim().toLowerCase();
            if (!["add", "remove"].includes(action)) {
                return respond({ success: false, message: "Action must be add or remove" });
            }

            const rawEffect = data?.effect ?? data?.effectName ?? "";
            if (!rawEffect) {
                return respond({ success: false, message: "Effect name is required" });
            }

            let effect = null;
            if (typeof rawEffect === "string") {
                const trimmed = rawEffect.trim();
                const found = EFFECTS.find(
                    (entry) =>
                        entry.id === trimmed ||
                        entry.name === trimmed ||
                        (EFFECTS.aliases && EFFECTS.aliases[trimmed] &&
                            entry.id === EFFECTS.aliases[trimmed])
                );
                if (!found) {
                    return respond({
                        success: false,
                        message: `Unknown effect "${trimmed}". Use the effects list to pick a valid effect.`,
                    });
                }
                effect = { ...found };
            } else if (typeof rawEffect === "object") {
                effect = { ...rawEffect };
            }

            if (!effect || !effect.id) {
                return respond({ success: false, message: "Invalid effect payload" });
            }

            // Apply requested stack count (clamp to maxStacks)
            if (Number.isFinite(Number(data?.stack)) && Number(data.stack) >= 1) {
                const maxStacks = effect.maxStacks ?? effect.maxStack ?? 1;
                effect.stack = Math.min(Number(data.stack), maxStacks);
            }

            if (Number.isFinite(Number(data?.duration))) {
                effect.duration = Number(data.duration);
            } else if (effect.duration == null) {
                effect.duration = -1;
            }

            const nextEffects = Array.isArray(targetToken.statusEffects)
                ? [...targetToken.statusEffects]
                : [];

            if (action === "add") {
                console.log(`[StatusEffects] Adding effect to ${targetToken.name}: ${effect.name} (id: ${effect.id})`);
                const exists = nextEffects.find(
                    (entry) => String(entry?.name || entry?.id || "") === String(effect.name)
                );
                if (exists) {
                    console.log(`[StatusEffects] Effect already exists, updating duration/stack`);
                    if (Number.isFinite(Number(effect.duration))) {
                        exists.duration = Number(effect.duration);
                    }
                    // Sync stack count (was missing — existing effects never had stacks updated)
                    if (Number.isFinite(Number(effect.stack)) && Number(effect.stack) >= 1) {
                        exists.stack = Number(effect.stack);
                    }
                } else {
                    console.log(`[StatusEffects] Adding new effect: ${JSON.stringify({ id: effect.id, name: effect.name, duration: effect.duration, stack: effect.stack })}`);
                    nextEffects.push(effect);
                }
            } else {
                const targetName = String(effect.name);
                console.log(`[StatusEffects] Removing effect from ${targetToken.name}: ${targetName}`);
                const filtered = nextEffects.filter(
                    (entry) => String(entry?.name || entry?.id || "") !== targetName
                );
                nextEffects.length = 0;
                nextEffects.push(...filtered);
            }

            targetToken.statusEffects = nextEffects;
            console.log(`[StatusEffects] ${targetToken.name} now has ${nextEffects.length} effects:`, nextEffects.map(e => e.name || e.id));

            const gameEngine = campaignGameEngineByID.get(String(campaign._id));
            const engineChar = gameEngine?.characters?.get(normalizedCharacterID);
            if (engineChar) {
                console.log(`[StatusEffects] Syncing to engine character`);
                engineChar.statusEffects = JSON.parse(JSON.stringify(nextEffects));
                if (typeof engineChar.invalidateCache === "function") {
                    engineChar.invalidateCache();
                }
                // Full sync — all computed properties written back to the snapshot token
                syncEngineCharacterToToken(engineChar, targetToken);
            } else {
                console.log(`[StatusEffects] No engine character found, updating temp instance`);
                // No live engine char (combat not active) — build a temporary instance
                // to recompute derived values (perception, vision, etc.) so the snapshot
                // token reflects the effect change immediately.
                targetToken.statusEffects = nextEffects;
                try {
                    const tmpBuilder = new CharacterBuilder(socket);
                    const tmpInstance = await tmpBuilder.buildFromId(normalizedCharacterID);
                    if (tmpInstance) {
                        tmpInstance.statusEffects = JSON.parse(JSON.stringify(nextEffects));
                        if (typeof tmpInstance.invalidateCache === 'function') tmpInstance.invalidateCache();
                        syncEngineCharacterToToken(tmpInstance, targetToken);
                    }
                } catch (_) {
                    // If build fails, token at least has statusEffects set above
                }
            }

            runtimeState.revision = Number(runtimeState.revision) + 1;
            runtimeState.updatedAt = Date.now();

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
            };

            socket.join(getCampaignGameRoom(campaign._id));
            socket.join(getCampaignDMRoom(campaign._id));
            await emitPlayerStateUpdate(socket, campaign, payload);
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);
            // Also emit back to the requesting DM socket so game.jsx applyLoadedSnapshot fires
            socket.emit("campaign_gameStateUpdated", payload);
            respond(payload);
        } catch (error) {
            console.error("[campaign_updateCharacterStatusEffects] failed", error);
            respond({ success: false, message: "Failed to update status effects" });
        }
    });

    // ─── Effects catalog (DM only) ──────────────────────────────────────────────
    socket.on("campaign_getEffectsList", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};
        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({ success: false, message: "Valid playerID and campaignID are required" });
            }
            const campaign = await Campaign.findById(campaignID).select("_id dmId players");
            if (!campaign) return respond({ success: false, message: "Campaign not found" });
            if (!isCampaignDM(campaign, playerID)) {
                return respond({ success: false, message: "Only the DM can access the effects catalog" });
            }
            const catalog = EFFECTS.map((e) => ({
                id: e.id,
                name: e.name,
                tier: e.tier,
                school: e.school,
                description: e.description,
                stackable: e.stackable !== false,
                maxStacks: e.maxStacks ?? e.maxStack ?? 1,
            }));
            respond({ success: true, effects: catalog });
        } catch (error) {
            console.error("[campaign_getEffectsList] failed", error);
            respond({ success: false, message: "Failed to load effects list" });
        }
    });

    socket.on("campaign_setFovMode", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId settings activeGameSave characterAssignments"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can change FOV mode",
                });
            }

            const nextMode = normalizeFovMode(data?.fovMode || data?.mode);
            if (campaign.settings && typeof campaign.settings.set === "function") {
                campaign.settings.set("fovMode", nextMode);
            } else {
                const nextSettings =
                    campaign.settings && typeof campaign.settings === "object"
                        ? { ...campaign.settings }
                        : {};
                nextSettings.fovMode = nextMode;
                campaign.settings = nextSettings;
            }

            await campaign.save();

            const runtimeKey = String(campaign._id || "");
            let runtimeState = null;
            if (campaignRuntimeStateByID.has(runtimeKey)) {
                runtimeState = getOrCreateRuntimeState(campaign._id, {});
            } else if (campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                const snapshot = saveDoc ? toPlainObject(saveDoc.snapshot) : {};
                if (saveDoc) {
                    runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
                }
            }

            if (runtimeState) {
                const payload = {
                    success: true,
                    campaignID: String(campaign._id),
                    floorTypes: FLOOR_TYPES,
                    engineState: cloneEngineState(runtimeState),
                    fovMode: nextMode,
                };
                socket.join(getCampaignGameRoom(campaign._id));
                socket.join(getCampaignDMRoom(campaign._id));
                await emitPlayerStateUpdate(socket, campaign, payload);
            }

            respond({
                success: true,
                campaignID: String(campaign._id),
                fovMode: nextMode,
            });
        } catch (error) {
            console.error("[campaign_setFovMode] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to update FOV mode",
            });
        }
    });

    socket.on("campaign_setVisionRayCount", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId activeGameSave characterAssignments settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can change the vision ray count",
                });
            }

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            const nextRayCount = clamp(Math.round(toNumber(data?.rayCount, 256)), 4, 256);
            runtimeState.snapshot.visionRayCount = nextRayCount;
            recalculateVisionRaysForSnapshot(runtimeState, nextRayCount);

            runtimeState.revision = Number(runtimeState.revision) + 1;
            runtimeState.updatedAt = Date.now();

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
                visionRayCount: nextRayCount,
            };

            socket.join(getCampaignGameRoom(campaign._id));
            socket.join(getCampaignDMRoom(campaign._id));
            await emitPlayerStateUpdate(socket, campaign, payload);
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);

            respond(payload);
        } catch (error) {
            console.error("[campaign_setVisionRayCount] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to update vision ray count",
            });
        }
    });

    socket.on("campaign_debugLightAtPoint", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, worldX, worldY } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId activeGameSave settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can run lighting debug queries",
                });
            }

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            if (!runtimeState.snapshot?.lightingPolygons) {
                recalculateLighting(runtimeState);
            }

            const sampleX = toNumber(worldX, 0);
            const sampleY = toNumber(worldY, 0);
            const lightingConfig = normalizeLightingConfig(runtimeState.snapshot?.lighting || {});
            const lightLevel = calculateLightAtPoint(sampleX, sampleY, runtimeState.snapshot);

            respond({
                success: true,
                campaignID: String(campaign._id),
                worldX: sampleX,
                worldY: sampleY,
                lightLevel,
                lightingEnabled: !!lightingConfig.enabled,
                ambient: lightingConfig.ambient,
                currentZLevel: toNumber(runtimeState.snapshot?.currentZLevel, 0),
            });
        } catch (error) {
            console.error("[campaign_debugLightAtPoint] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to debug light at point",
            });
        }
    });

    socket.on("campaign_getCharacterActions", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, characterID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const normalizedCharacterID = String(characterID || "").trim();
            if (!normalizedCharacterID || !mongoose.isValidObjectId(normalizedCharacterID)) {
                return respond({
                    success: false,
                    message: "Valid characterID is required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players characterAssignments characterStates"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can view character actions",
                });
            }

            if (!isCharacterInCampaign(campaign, normalizedCharacterID)) {
                return respond({
                    success: false,
                    message: "Character is not assigned to this campaign",
                });
            }

            const isDM = isCampaignDM(campaign, playerID);
            if (!isDM) {
                let assignment = Array.isArray(campaign.characterAssignments)
                    ? campaign.characterAssignments.find(
                          (entry) =>
                              toObjectIdString(entry?.characterId) === normalizedCharacterID
                      ) || null
                    : null;
                let ownerID = toObjectIdString(assignment?.playerId);
                
                // If not in assignment map, check if character exists and player is creator
                if (!ownerID && mongoose.isValidObjectId(normalizedCharacterID)) {
                    const characterDoc = await Character.findById(normalizedCharacterID).select("playerId");
                    if (characterDoc) {
                        ownerID = toObjectIdString(characterDoc.playerId);
                    }
                }
                
                if (!ownerID || ownerID !== String(playerID)) {
                    return respond({
                        success: false,
                        message: "Only the character owner or DM can view actions",
                    });
                }
            }

            const builder = new CharacterBuilder(socket);
            const character = await builder.buildFromId(normalizedCharacterID);
            if (!character) {
                return respond({
                    success: false,
                    message: "Failed to build character actions",
                });
            }

            const actionTree = character.getActionTree();
            console.log('[campaign_getCharacterActions] Sending for', normalizedCharacterID, 'actionTree keys:', Object.keys(actionTree || {}), 'has movement:', !!actionTree?.movement);
            if (actionTree?.movement) {
                console.log('[campaign_getCharacterActions] Movement children count:', actionTree.movement.children?.length || 0);
            }

            respond({
                success: true,
                characterID: normalizedCharacterID,
                actions: Array.isArray(character.actions) ? character.actions : [],
                actionTree: actionTree,
            });
        } catch (error) {
            console.error("[campaign_getCharacterActions] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to load character actions",
            });
        }
    });

    socket.on("campaign_executeCharacterAction", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, characterID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const normalizedCharacterID = String(characterID || "").trim();
            if (!normalizedCharacterID || !mongoose.isValidObjectId(normalizedCharacterID)) {
                return respond({
                    success: false,
                    message: "Valid characterID is required",
                });
            }

            const actionRef = String(
                data?.actionPath || data?.actionId || data?.action || ""
            ).trim();
            if (!actionRef) {
                return respond({ success: false, message: "Action path is required" });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments characterStates settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can perform actions",
                });
            }

            if (!isCharacterInCampaign(campaign, normalizedCharacterID)) {
                return respond({
                    success: false,
                    message: "Character is not assigned to this campaign",
                });
            }

            const isDM = isCampaignDM(campaign, playerID);
            if (!isDM) {
                let assignment = Array.isArray(campaign.characterAssignments)
                    ? campaign.characterAssignments.find(
                          (entry) =>
                              toObjectIdString(entry?.characterId) === normalizedCharacterID
                      ) || null
                    : null;
                let ownerID = toObjectIdString(assignment?.playerId);
                
                // If not in assignment map, check if character exists and player is creator
                if (!ownerID && mongoose.isValidObjectId(normalizedCharacterID)) {
                    const characterDoc = await Character.findById(normalizedCharacterID).select("playerId");
                    if (characterDoc) {
                        ownerID = toObjectIdString(characterDoc.playerId);
                    }
                }
                
                if (!ownerID || ownerID !== String(playerID)) {
                    return respond({
                        success: false,
                        message: "Only the character owner or DM can perform this action",
                    });
                }
            }

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            if (!Array.isArray(runtimeState.snapshot.characters)) {
                runtimeState.snapshot.characters = [];
            }

            const characterToken = runtimeState.snapshot.characters.find(
                (char) => String(char?.id ?? "") === normalizedCharacterID
            );
            if (!characterToken) {
                return respond({
                    success: false,
                    message: "Character is not placed on the map yet",
                });
            }

            const builder = new CharacterBuilder(socket);
            const characterInstance = await builder.buildFromId(normalizedCharacterID);
            if (!characterInstance) {
                return respond({
                    success: false,
                    message: "Failed to load character data",
                });
            }
            if (characterToken?.position) {
                characterInstance.position = {
                    x: toNumber(characterToken.position?.x, 0),
                    y: toNumber(characterToken.position?.y, 0),
                    z: toNumber(characterToken.position?.z, 0),
                };
            }
            if (characterToken?.STA && typeof characterToken.STA === "object") {
                const tokenSTA = characterToken.STA;
                if (characterInstance._baseSTA) {
                    if (Number.isFinite(Number(tokenSTA.current))) {
                        characterInstance._baseSTA.current = Number(tokenSTA.current);
                    }
                    if (Number.isFinite(Number(tokenSTA.max))) {
                        characterInstance._baseSTA.max = Number(tokenSTA.max);
                    }
                    if (Number.isFinite(Number(tokenSTA.temp))) {
                        characterInstance._baseSTA.temp = Number(tokenSTA.temp);
                    }
                }
            }
            if (Number.isFinite(Number(characterToken?.movement))) {
                characterInstance._baseMovement = Number(characterToken.movement);
            }
            if (characterToken?.actionPoints && typeof characterToken.actionPoints === 'object') {
                characterInstance._actionPoints = JSON.parse(JSON.stringify(characterToken.actionPoints));
            }

            // ── Enforce turn order if combat is active ───────────────────────────────
            const gameEngine = campaignGameEngineByID.get(String(campaign._id));
            if (gameEngine && gameEngine.state === 'active') {
                const currentChar = gameEngine.getCurrentCharacter();
                if (currentChar && String(currentChar.id) !== normalizedCharacterID) {
                    return respond({
                        success: false,
                        message: `It is not this character's turn. ${currentChar.name} is currently acting.`,
                    });
                }
            }

            // ── Resolve target for attack/cast actions ─────────────────────────────────
            const allCharacterTokens = runtimeState.snapshot.characters || [];
            const targetTokenId = String(data?.params?.targetId || "").trim();
            let targetInstance = null;

            if (targetTokenId && mongoose.isValidObjectId(targetTokenId)) {
                const targetToken = allCharacterTokens.find(t => String(t?.id ?? "") === targetTokenId);
                if (targetToken) {
                    try {
                        targetInstance = await builder.buildFromId(targetTokenId);
                        if (targetInstance && targetToken.HP && typeof targetToken.HP === 'object') {
                            if (Number.isFinite(Number(targetToken.HP.current))) {
                                targetInstance._baseHP.current = Number(targetToken.HP.current);
                            }
                            if (Number.isFinite(Number(targetToken.HP.max))) {
                                targetInstance._baseHP.max = Number(targetToken.HP.max);
                            }
                            if (Number.isFinite(Number(targetToken.HP.temp))) {
                                targetInstance._baseHP.temp = Number(targetToken.HP.temp);
                            }
                        }
                        if (targetToken.position) {
                            targetInstance.position = { ...targetToken.position };
                        }
                        if (Array.isArray(targetToken.statusEffects)) {
                            targetInstance.statusEffects = JSON.parse(JSON.stringify(targetToken.statusEffects));
                        }
                    } catch (err) {
                        console.error(`[campaign_executeCharacterAction] Failed to build target ${targetTokenId}:`, err);
                    }
                }
            }

            const params = toPlainObject(data?.params);
            // Inject target instance and character map for _resolveTarget
            if (targetInstance) {
                params.target = targetInstance;
            }
            if (gameEngine) {
                params.combatEngine = gameEngine;
            }
            // Also pass characters map for direct target resolution
            const charactersMap = new Map();
            for (const token of allCharacterTokens) {
                const characterId = String(token?.id ?? "");
                if (characterId && campaignGameEngineByID.get(String(campaign._id))) {
                    // Use engine's built characters if available
                    const engineChar = gameEngine?.characters?.get(characterId);
                    if (engineChar) {
                        charactersMap.set(characterId, engineChar);
                    }
                }
            }
            if (charactersMap.size > 0) {
                params.characters = charactersMap;
            }

            let actionResult;
            try {
                actionResult = characterInstance.executeAction(actionRef, params);
            } catch (error) {
                return respond({
                    success: false,
                    message: error.message || "Failed to execute action",
                });
            }

            let didUpdateSnapshot = false;
            let shouldRecalcVisionRays = false;

            if (actionResult?.STA && typeof actionResult.STA === "object") {
                const incomingSTA = actionResult.STA;
                const nextSTA =
                    characterToken.STA && typeof characterToken.STA === "object"
                        ? { ...characterToken.STA }
                        : {};
                let staChanged = false;

                if (Number.isFinite(Number(incomingSTA.max))) {
                    const value = Number(incomingSTA.max);
                    if (nextSTA.max !== value) {
                        nextSTA.max = value;
                        staChanged = true;
                    }
                }
                if (Number.isFinite(Number(incomingSTA.current))) {
                    const value = Number(incomingSTA.current);
                    if (nextSTA.current !== value) {
                        nextSTA.current = value;
                        staChanged = true;
                    }
                }
                if (Number.isFinite(Number(incomingSTA.temp))) {
                    const value = Number(incomingSTA.temp);
                    if (nextSTA.temp !== value) {
                        nextSTA.temp = value;
                        staChanged = true;
                    }
                }

                if (staChanged) {
                    characterToken.STA = nextSTA;
                    didUpdateSnapshot = true;
                }
            }

            if (actionResult?.movementRemaining != null) {
                const remaining = Number(actionResult.movementRemaining);
                if (Number.isFinite(remaining) && characterToken.movement !== remaining) {
                    characterToken.movement = remaining;
                    didUpdateSnapshot = true;
                }
            } 

            if (actionResult?.actionPoints) {
                if (JSON.stringify(characterToken.actionPoints) !== JSON.stringify(actionResult.actionPoints)) {
                    characterToken.actionPoints = actionResult.actionPoints;
                    didUpdateSnapshot = true;
                }
            }

            if (
                actionResult?.position &&
                Number.isFinite(Number(actionResult.position?.x)) &&
                Number.isFinite(Number(actionResult.position?.y))
            ) {
                characterToken.position = {
                    x: Math.round(Number(actionResult.position.x)),
                    y: Math.round(Number(actionResult.position.y)),
                    z: Number.isFinite(Number(actionResult.position?.z))
                        ? Number(actionResult.position.z)
                        : toNumber(characterToken.position?.z, 0),
                };
                didUpdateSnapshot = true;
                shouldRecalcVisionRays = true;
            }

            if (actionResult?.rotation != null) {
                const nextRotation = toNumber(actionResult.rotation, characterToken.rotation || 0);
                if (characterToken.rotation !== nextRotation) {
                    characterToken.rotation = nextRotation;
                    didUpdateSnapshot = true;
                    shouldRecalcVisionRays = true;
                }
            }

            // ── Sync HP back ──────────────────────────────────────────────────────────
            if (characterInstance._baseHP) {
                const incomingHP = characterInstance._baseHP;
                const nextHP = characterToken.HP && typeof characterToken.HP === 'object'
                    ? { ...characterToken.HP }
                    : {};
                let hpChanged = false;

                if (Number.isFinite(Number(incomingHP.max))) {
                    const value = Number(incomingHP.max);
                    if (nextHP.max !== value) {
                        nextHP.max = value;
                        hpChanged = true;
                    }
                }
                if (Number.isFinite(Number(incomingHP.current))) {
                    const value = Number(incomingHP.current);
                    if (nextHP.current !== value) {
                        nextHP.current = value;
                        hpChanged = true;
                    }
                }
                if (Number.isFinite(Number(incomingHP.temp))) {
                    const value = Number(incomingHP.temp);
                    if (nextHP.temp !== value) {
                        nextHP.temp = value;
                        hpChanged = true;
                    }
                }

                if (hpChanged) {
                    characterToken.HP = nextHP;
                    didUpdateSnapshot = true;
                }
            }

            // ── Sync status effects back ───────────────────────────────────────────────
            if (Array.isArray(characterInstance.statusEffects)) {
                const currentEffects = characterToken.statusEffects || [];
                const newEffects = Array.isArray(characterInstance.statusEffects) ? characterInstance.statusEffects : [];
                
                // Check if status effects changed by comparing serialized form
                const currentSerialized = JSON.stringify(currentEffects.map(e => ({ name: e.name, duration: e.duration })));
                const newSerialized = JSON.stringify(newEffects.map(e => ({ name: e.name, duration: e.duration })));
                
                if (currentSerialized !== newSerialized) {
                    characterToken.statusEffects = newEffects;
                    didUpdateSnapshot = true;
                }
            }

            // ── Sync target's HP and status effects back ────────────────────────────────
            if (targetInstance && targetTokenId) {
                const targetToken = allCharacterTokens.find(t => String(t?.id ?? "") === targetTokenId);
                if (targetToken) {
                    // Sync target HP
                    if (targetInstance._baseHP) {
                        const incomingHP = targetInstance._baseHP;
                        const nextHP = targetToken.HP && typeof targetToken.HP === 'object'
                            ? { ...targetToken.HP }
                            : {};
                        let hpChanged = false;

                        if (Number.isFinite(Number(incomingHP.max))) {
                            const value = Number(incomingHP.max);
                            if (nextHP.max !== value) {
                                nextHP.max = value;
                                hpChanged = true;
                            }
                        }
                        if (Number.isFinite(Number(incomingHP.current))) {
                            const value = Number(incomingHP.current);
                            if (nextHP.current !== value) {
                                nextHP.current = value;
                                hpChanged = true;
                            }
                        }
                        if (Number.isFinite(Number(incomingHP.temp))) {
                            const value = Number(incomingHP.temp);
                            if (nextHP.temp !== value) {
                                nextHP.temp = value;
                                hpChanged = true;
                            }
                        }

                        if (hpChanged) {
                            targetToken.HP = nextHP;
                            didUpdateSnapshot = true;
                        }
                    }

                    // Sync target status effects
                    if (Array.isArray(targetInstance.statusEffects)) {
                        const currentEffects = targetToken.statusEffects || [];
                        const newEffects = Array.isArray(targetInstance.statusEffects) ? targetInstance.statusEffects : [];
                        
                        const currentSerialized = JSON.stringify(currentEffects.map(e => ({ name: e.name, duration: e.duration })));
                        const newSerialized = JSON.stringify(newEffects.map(e => ({ name: e.name, duration: e.duration })));
                        
                        if (currentSerialized !== newSerialized) {
                            targetToken.statusEffects = newEffects;
                            didUpdateSnapshot = true;
                        }
                    }
                }
            }

            if (shouldRecalcVisionRays) {
                ensureTokenVision(characterToken);
                recalculateVisionRaysForToken(characterToken, { snapshot: runtimeState.snapshot });
            }

            // Keep the live engine characters in sync so that endTurn / _processTurnStart
            // operate on correct HP/MP/STA/statusEffects instead of stale combat-start values.
            if (gameEngine) {
                const actorEngineChar = gameEngine.characters?.get(normalizedCharacterID);
                if (actorEngineChar) syncTokenToEngineCharacter(characterToken, actorEngineChar);

                if (targetTokenId) {
                    const targetEngineChar = gameEngine.characters?.get(targetTokenId);
                    const targetTok = allCharacterTokens.find(t => String(t?.id ?? "") === targetTokenId);
                    if (targetEngineChar && targetTok) syncTokenToEngineCharacter(targetTok, targetEngineChar);
                }
            }

            if (didUpdateSnapshot) {
                runtimeState.revision = Number(runtimeState.revision) + 1;
                runtimeState.updatedAt = Date.now();
            }

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
                characterID: normalizedCharacterID,
                actionResult: actionResult || null,
            };

            if (didUpdateSnapshot) {
                socket.join(getCampaignGameRoom(campaign._id));
                if (isDM) {
                    socket.join(getCampaignDMRoom(campaign._id));
                } else {
                    socket.join(getCampaignPlayersRoom(campaign._id));
                }
                await emitPlayerStateUpdate(socket, campaign, payload);
                socket
                    .to(getCampaignDMRoom(campaign._id))
                    .emit("campaign_gameStateUpdated", payload);
            }

            respond(
                isDM ? payload : buildPlayerPayloadForPlayer(payload, campaign, playerID)
            );
        } catch (error) {
            console.error("[campaign_executeCharacterAction] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to execute character action",
            });
        }
    });

    /**
     * Helper function to prepare initiative roll data for client dice display.
     * Returns both player-visible rolls (excludes enemies) and all rolls (for DM).
     * @param {GameEngine} gameEngine - The combat engine instance
     * @returns {{allRolls: Array, playerRolls: Array}} Initiative roll data
     */
    function prepareInitiativeRolls(gameEngine) {
        const allRolls = [];
        
        gameEngine.characters.forEach((character) => {
            const initiativeTotal = character._initiativeRoll || 0;
            const dexModifier = character.stats?.DEX?.modifier || 0;
            
            // Reconstruct the roll (d20 + dex modifier)
            const diceValue = Math.max(1, Math.min(20, initiativeTotal - dexModifier));
            
            allRolls.push({
                characterId: character.id,
                characterName: character.name,
                description: 'Initiative Roll',
                dice: [{ type: 'd20', value: diceValue }],
                bonuses: dexModifier !== 0 ? [{ name: 'Dexterity Modifier', value: dexModifier }] : [],
                total: initiativeTotal,
                timestamp: Date.now(),
                team: character.team || 'player' // Include team for filtering
            });
        });

        // Sort by total (highest first) to match turn order
        allRolls.sort((a, b) => b.total - a.total);
        
        // Filter out enemies for player view
        const playerRolls = allRolls
            .filter(roll => String(roll.team).toLowerCase() !== 'enemy')
            .map(roll => {
                // Remove team property from player-visible data
                const { team, ...rollData } = roll;
                return rollData;
            });
        
        return { allRolls, playerRolls };
    }

    socket.on("campaign_startCombat", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can start combat",
                });
            }

            // Get or create runtime state
            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            const characterTokens = runtimeState.snapshot.characters || [];

            // Get or create game engine
            const gameEngine = getOrCreateGameEngine(campaign._id);

            // Clear and reset engine for new combat
            gameEngine.characters.clear();
            gameEngine.players.clear();
            gameEngine.turnOrder = [];
            gameEngine.currentTurnIndex = 0;
            gameEngine.roundNumber = 1;
            gameEngine.state = 'setup';
            gameEngine.combatLog = [];

            // Build CHARACTER instances and add to engine
            const builder = new CharacterBuilder(socket);
            for (const tokenChar of characterTokens) {
                if (!tokenChar?.id) continue;
                
                try {
                    const charInstance = await builder.buildFromId(String(tokenChar.id));
                    if (!charInstance) continue;

                    // Hydrate from token state
                    if (tokenChar.HP && typeof tokenChar.HP === 'object') {
                        if (Number.isFinite(Number(tokenChar.HP.current))) {
                            charInstance._baseHP.current = Number(tokenChar.HP.current);
                        }
                        if (Number.isFinite(Number(tokenChar.HP.max))) {
                            charInstance._baseHP.max = Number(tokenChar.HP.max);
                        }
                        if (Number.isFinite(Number(tokenChar.HP.temp))) {
                            charInstance._baseHP.temp = Number(tokenChar.HP.temp);
                        }
                    }
                    if (tokenChar.position) {
                        charInstance.position = { ...tokenChar.position };
                    }
                    if (Array.isArray(tokenChar.statusEffects)) {
                        charInstance.statusEffects = JSON.parse(JSON.stringify(tokenChar.statusEffects));
                    }

                    // Find which player owns this character
                    const assignment = campaign.characterAssignments?.find(
                        a => String(a.characterId) === String(tokenChar.id)
                    );
                    const playerId = String(assignment?.playerId || campaign.dmId);

                    // Add to engine
                    gameEngine.addCharacter(charInstance, playerId);
                } catch (err) {
                    console.error(`[campaign_startCombat] Failed to build character ${tokenChar.id}:`, err);
                }
            }

            if (gameEngine.characters.size === 0) {
                return respond({
                    success: false,
                    message: "No characters on the map to start combat",
                });
            }

            // Start the game and roll initiative
            gameEngine.startGame();

            // Prepare initiative roll data for client dice display
            const { allRolls, playerRolls } = prepareInitiativeRolls(gameEngine);

            // Sync computed values (perception, vision, HP max, etc.) from engine
            // instances back to snapshot tokens so the first broadcast is accurate.
            const combatRuntimeState = getOrCreateRuntimeState(campaign._id);
            gameEngine.characters.forEach((engChar, charId) => {
                if (typeof engChar.invalidateCache === 'function') engChar.invalidateCache();
                const tok = (combatRuntimeState.snapshot.characters || []).find(
                    c => String(c.id) === String(charId)
                );
                if (tok) syncEngineCharacterToToken(engChar, tok);
            });
            combatRuntimeState.revision++;
            combatRuntimeState.updatedAt = Date.now();

            // Broadcast to all players
            const gameState = gameEngine.getGameState();
            socket.join(getCampaignGameRoom(campaign._id));
            
            // Emit initiative rolls for dice display (only player rolls, enemies hidden)
            const io = socket.server;
            io.to(getCampaignGameRoom(campaign._id)).emit("game:initiativeRolls", {
                rolls: playerRolls,
                requiresAck: true
            });

            socket.to(getCampaignGameRoom(campaign._id)).emit("campaign_combatStarted", {
                success: true,
                campaignID: String(campaign._id),
                gameState,
            });

            respond({
                success: true,
                campaignID: String(campaign._id),
                gameState,
            });
        } catch (error) {
            console.error("[campaign_startCombat] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to start combat",
            });
        }
    });

    socket.on("campaign_endTurn", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            const gameEngine = campaignGameEngineByID.get(String(campaign._id));
            if (!gameEngine || gameEngine.state !== 'active') {
                return respond({
                    success: false,
                    message: "Combat is not active",
                });
            }

            // Verify it's the current character's turn or the DM
            const currentChar = gameEngine.getCurrentCharacter();
            if (!currentChar) {
                return respond({
                    success: false,
                    message: "No active character in turn order",
                });
            }

            // Check ownership (either DM or character owner)
            const isDM = isCampaignDM(campaign, playerID);
            if (!isDM) {
                // For now, any player can end turn (controlled by front-end)
                // In strict mode, could check if player owns the current character
            }

            // Store round number before ending turn to detect round transitions
            const previousRound = gameEngine.roundNumber;
            
            gameEngine.endTurn();
            const gameState = gameEngine.getGameState();
            
            // Check if a new round started (initiative was re-rolled)
            const isNewRound = gameEngine.roundNumber > previousRound;

            // FORCE SYNC ALL ENGINE CHARACTERS TO SNAPSHOT
            // Server is the authoritative source - sync ALL computed values to tokens
            // so clients always receive complete, accurate data.
            const runtimeState = getOrCreateRuntimeState(campaign._id);
            console.log(`[campaign_endTurn] Force syncing ${gameEngine.characters.size} engine characters to snapshot`);
            
            gameEngine.characters.forEach((engChar, charId) => {
                const tok = (runtimeState.snapshot.characters || []).find(
                    c => String(c.id) === String(charId)
                );
                if (tok) {
                    syncEngineCharacterToToken(engChar, tok);
                } else {
                    console.warn(`[campaign_endTurn] No token found for engine character ${charId}`);
                }
            });

            runtimeState.revision++;
            runtimeState.updatedAt = Date.now();

            // Build complete state payload with ALL synced data
            const engineState = cloneEngineState(runtimeState);
            const engineStatePayload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
                gameState,  // Include combat state (turn order, round, etc.)
                forceUpdate: true // Flag to tell client to replace local state completely
            };

            // Broadcast complete authoritative state to ALL clients
            socket.join(getCampaignGameRoom(campaign._id));
            console.log(`[campaign_endTurn] Broadcasting FULL state to all clients (round ${gameEngine.roundNumber}, revision ${runtimeState.revision})`);
            
            // Send to players (with FOV filtering)
            await emitPlayerStateUpdate(socket, campaign, engineStatePayload);
            
            // Send to DM (unfiltered)
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", engineStatePayload);
            
            // Also send to the current socket
            const fovMode = getCampaignFovMode(campaign);
            const filteredSnapshot = fovMode === "perPlayer" 
                ? filterSnapshotForPlayer(engineState.snapshot, campaign, playerID)
                : filterSnapshotForFOV(engineState.snapshot, { viewerTeam: "player" });
            
            socket.emit("campaign_gameStateUpdated", {
                ...engineStatePayload,
                engineState: {
                    ...engineState,
                    snapshot: { ...filteredSnapshot, fovMode }
                }
            });

            // Send turn ended event with complete state
            socket.to(getCampaignGameRoom(campaign._id)).emit("campaign_turnEnded", engineStatePayload);

            // If a new round started, emit new initiative rolls
            if (isNewRound) {
                console.log(`[campaign_endTurn] New round detected (Round ${gameEngine.roundNumber}), emitting initiative rolls`);
                const { allRolls, playerRolls } = prepareInitiativeRolls(gameEngine);
                const io = socket.server;
                
                // Emit player-visible rolls (enemies hidden) to all players
                io.to(getCampaignGameRoom(campaign._id)).emit("game:initiativeRolls", {
                    rolls: playerRolls,
                    requiresAck: true
                });
                
                // Note: DM receives all rolls via gameState which includes full turn order
            }

            respond({
                success: true,
                campaignID: String(campaign._id),
                gameState,
                engineState, // Include full state in response
            });

            // Auto-save AFTER broadcasting (non-blocking)
            persistGame(
                campaign._id,
                playerID,
                `Auto Save (Turn ${gameEngine.roundNumber})`,
                "End of turn auto-save",
                toPlainObject(runtimeState.snapshot),
                true,
                true
            ).catch(err => {
                if (err.name === 'VersionError') {
                    console.warn(`[campaign_endTurn] Auto-save skipped due to version conflict`);
                } else {
                    console.error("[campaign_endTurn] Auto-save failed:", err.message);
                }
            });
        } catch (error) {
            console.error("[campaign_endTurn] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to end turn",
            });
        }
    });

    socket.on("campaign_getCombatState", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select("_id");
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            // Get current engine state
            const gameEngine = campaignGameEngineByID.get(String(campaign._id));
            if (!gameEngine) {
                return respond({
                    success: true,
                    gameState: null, // No combat active
                });
            }

            const gameState = gameEngine.getGameState();
            respond({
                success: true,
                gameState,
            });
        } catch (error) {
            console.error("[campaign_getCombatState] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to get combat state",
            });
        }
    });

    socket.on("campaign_listEnemies", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select("_id dmId");
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can list enemies",
                });
            }

            const enemies = await Enemy.find({ campaignId: campaign._id }).sort({
                updatedAt: -1,
                _id: -1,
            });

            respond({
                success: true,
                enemies: enemies.map((enemy) => formatEnemy(enemy)).filter(Boolean),
            });
        } catch (error) {
            console.error("[campaign_listEnemies] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to list enemies",
            });
        }
    });

    socket.on("campaign_createEnemy", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select("_id dmId");
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can create enemies",
                });
            }

            const enemyInput = normalizeEnemyInput(data?.enemy || data || {});
            const created = await Enemy.create({
                campaignId: campaign._id,
                createdBy: playerID,
                ...enemyInput,
            });

            respond({
                success: true,
                enemy: formatEnemy(created),
            });
        } catch (error) {
            console.error("[campaign_createEnemy] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to create enemy",
            });
        }
    });

    socket.on("campaign_deleteEnemy", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};
        const enemyID = String(data?.enemyID || "").trim();

        try {
            if (
                !mongoose.isValidObjectId(playerID) ||
                !mongoose.isValidObjectId(campaignID)
            ) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            if (!enemyID) {
                return respond({ success: false, message: "enemyID is required" });
            }

            const campaign = await Campaign.findById(campaignID).select("_id dmId");
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can delete enemies",
                });
            }

            if (mongoose.isValidObjectId(enemyID)) {
                await Enemy.findOneAndDelete({
                    _id: enemyID,
                    campaignId: campaign._id,
                });
            }

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            const tokenId = `enemy_${String(enemyID)}`;
            removeCharacter(runtimeState, tokenId);

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
                enemyID: String(enemyID),
            };

            socket.join(getCampaignGameRoom(campaign._id));
            socket.join(getCampaignDMRoom(campaign._id));
            await emitPlayerStateUpdate(socket, campaign, payload);
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);

            respond(payload);
        } catch (error) {
            console.error("[campaign_deleteEnemy] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to delete enemy",
            });
        }
    });

    socket.on("campaign_removeCharacter", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, characterID } = data || {};

        try {
            if (
                !mongoose.isValidObjectId(playerID) ||
                !mongoose.isValidObjectId(campaignID)
            ) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can remove characters from the map",
                });
            }

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            removeCharacter(runtimeState, characterID);

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
                characterID: String(characterID),
            };

            socket.join(getCampaignGameRoom(campaign._id));
            socket.join(getCampaignDMRoom(campaign._id));
            await emitPlayerStateUpdate(socket, campaign, payload);
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);

            respond(payload);
        } catch (error) {
            console.error("[campaign_removeCharacter] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to remove character",
            });
        }
    });

    socket.on("campaign_spawnEnemy", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};
        const enemyID = String(data?.enemyID || "").trim();
        const position = toPlainObject(data?.position);

        try {
            if (
                !mongoose.isValidObjectId(playerID) ||
                !mongoose.isValidObjectId(campaignID) ||
                !mongoose.isValidObjectId(enemyID)
            ) {
                return respond({
                    success: false,
                    message: "Valid playerID, campaignID, and enemyID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can spawn enemies",
                });
            }

            const enemy = await Enemy.findOne({ _id: enemyID, campaignId: campaign._id });
            if (!enemy) {
                return respond({ success: false, message: "Enemy not found" });
            }

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            if (!Array.isArray(runtimeState.snapshot.characters)) {
                runtimeState.snapshot.characters = [];
            }

            const tokenId = `enemy_${String(enemy._id)}`;
            let token = runtimeState.snapshot.characters.find(
                (entry) => String(entry?.id ?? "") === tokenId
            );

            const nextX = Math.round(toNumber(position?.x ?? data?.x, 0));
            const nextY = Math.round(toNumber(position?.y ?? data?.y, 0));

            if (!token) {
                token = {
                    id: tokenId,
                    name: enemy.name || "Enemy",
                    position: { x: nextX, y: nextY },
                    size: Number(enemy.size) || 30,
                    visionDistance: Number(enemy.visionDistance) || 150,
                    visionArc: Number(enemy.visionArc) || 90,
                    rotation: Number(enemy.rotation) || 0,
                    team: "enemy",
                    kind: "enemy",
                    enemyId: String(enemy._id),
                    hp: Number(enemy?.HP?.current) || 0,
                    maxHP: Number(enemy?.HP?.max) || 0,
                };
                runtimeState.snapshot.characters.push(token);
            } else {
                token.name = enemy.name || token.name;
                token.position = { x: nextX, y: nextY };
                token.size = Number(enemy.size) || token.size;
                token.visionDistance = Number(enemy.visionDistance) || token.visionDistance;
                token.visionArc = Number(enemy.visionArc) || token.visionArc;
                token.rotation = Number(enemy.rotation) || token.rotation;
                token.team = "enemy";
                token.kind = "enemy";
                token.enemyId = String(enemy._id);
                token.hp = Number(enemy?.HP?.current) || token.hp || 0;
                token.maxHP = Number(enemy?.HP?.max) || token.maxHP || 0;
            }

            ensureTokenVision(token);
            recalculateVisionRaysForToken(token, { snapshot: runtimeState.snapshot });

            runtimeState.revision = Number(runtimeState.revision) + 1;
            runtimeState.updatedAt = Date.now();

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
                enemyID: String(enemy._id),
            };

            socket.join(getCampaignGameRoom(campaign._id));
            socket.join(getCampaignDMRoom(campaign._id));
            await emitPlayerStateUpdate(socket, campaign, payload);
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);

            respond(payload);
        } catch (error) {
            console.error("[campaign_spawnEnemy] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to spawn enemy",
            });
        }
    });

    socket.on("campaign_list", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID)) {
                return respond({ success: false, message: "Valid playerID is required" });
            }

            const campaigns = await Campaign.find({
                $or: [{ dmId: playerID }, { players: playerID }],
            })
                .sort({ createdAt: -1 })
                .populate({ path: "dmId", select: "_id username" })
                .populate({ path: "players", select: "_id username" })
                .populate({ path: "bannedPlayers", select: "_id username" })
                .populate({ path: "characterAssignments.playerId", select: "_id username" })
                .populate({ path: "characterAssignments.characterId", select: "_id name level playerId" });

            respond({
                success: true,
                campaigns: campaigns.map((campaign) => formatCampaign(campaign)).filter(Boolean),
            });
        } catch (error) {
            console.error("[campaign_list] failed", error);
            respond({ success: false, message: error.message || "Failed to load campaigns" });
        }
    });

    socket.on("campaign_create", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID)) {
                return respond({ success: false, message: "Valid playerID is required" });
            }

            const player = await Player.findById(playerID).select("_id");
            if (!player) {
                return respond({ success: false, message: "Player not found" });
            }

            const name = sanitizeText(data?.name, 80);
            if (!name) {
                return respond({ success: false, message: "Campaign name is required" });
            }

            const description = sanitizeText(data?.description, 1000);
            const setting = sanitizeText(data?.setting, 120);
            const requestedMaxPlayers = Number.parseInt(data?.maxPlayers, 10);
            const maxPlayers = Number.isFinite(requestedMaxPlayers)
                ? clamp(requestedMaxPlayers, MIN_ALLOWED_PLAYERS, MAX_ALLOWED_PLAYERS)
                : DEFAULT_MAX_PLAYERS;
            const isPrivate = Boolean(data?.isPrivate);

            const joinCode = await generateUniqueCode(async (code) =>
                Campaign.exists({ joinCode: code })
            );

            const createdCampaign = await Campaign.create({
                name,
                description,
                setting,
                joinCode,
                maxPlayers,
                isPrivate,
                dmId: player._id,
                players: [player._id],
                activeLobby: {
                    isActive: false,
                    lobbyCode: "",
                    startedBy: null,
                    startedAt: null,
                    members: [],
                },
                characterAssignments: [],
            });

            await Player.findByIdAndUpdate(player._id, {
                $addToSet: { campaigns: createdCampaign._id },
            });

            const campaignForClient = await readCampaignForResponse(createdCampaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
            });
        } catch (error) {
            console.error("[campaign_create] failed", error);
            respond({ success: false, message: error.message || "Failed to create campaign" });
        }
    });

    socket.on("campaign_join", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID)) {
                return respond({ success: false, message: "Valid playerID is required" });
            }

            const joinCode = sanitizeCode(data?.joinCode);
            if (!joinCode || joinCode.length < JOIN_CODE_LENGTH) {
                return respond({ success: false, message: "A valid campaign code is required" });
            }

            const player = await Player.findById(playerID).select("_id");
            if (!player) {
                return respond({ success: false, message: "Player not found" });
            }

            const campaign = await Campaign.findOne({ joinCode });
            if (!campaign) {
                return respond({ success: false, message: "Campaign code not found" });
            }

            if (isCampaignBanned(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "You are banned from this campaign",
                });
            }

            if (isCampaignMember(campaign, playerID)) {
                const existingCampaign = await readCampaignForResponse(campaign._id);
                return respond({
                    success: true,
                    alreadyJoined: true,
                    campaign: formatCampaign(existingCampaign),
                });
            }

            if ((campaign.players || []).length >= campaign.maxPlayers) {
                return respond({
                    success: false,
                    message: "This campaign is full",
                });
            }

            campaign.players.addToSet(player._id);
            await campaign.save();

            await Player.findByIdAndUpdate(player._id, {
                $addToSet: { campaigns: campaign._id },
            });

            const campaignForClient = await readCampaignForResponse(campaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
            });
        } catch (error) {
            console.error("[campaign_join] failed", error);
            respond({ success: false, message: error.message || "Failed to join campaign" });
        }
    });

    socket.on("campaign_startLobby", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({ success: false, message: "Valid playerID and campaignID are required" });
            }

            const campaign = await Campaign.findById(campaignID);
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can start or reset this lobby",
                });
            }

            const lobbyCode = await generateUniqueCode(async (code) =>
                Campaign.exists({ "activeLobby.isActive": true, "activeLobby.lobbyCode": code })
            );

            const defaultLobbyMembers = Array.from(
                new Set([
                    String(campaign.dmId),
                    ...(Array.isArray(campaign.players)
                        ? campaign.players.map((memberID) => String(memberID))
                        : []),
                ])
            );

            campaign.activeLobby = {
                isActive: true,
                lobbyCode,
                startedBy: playerID,
                startedAt: new Date(),
                members: defaultLobbyMembers,
            };

            await campaign.save();

            const campaignForClient = await readCampaignForResponse(campaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
                gameID: String(campaign._id),
                lobbyCode,
            });
        } catch (error) {
            console.error("[campaign_startLobby] failed", error);
            respond({ success: false, message: error.message || "Failed to start lobby" });
        }
    });

    socket.on("campaign_joinLobby", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({ success: false, message: "Valid playerID and campaignID are required" });
            }

            const campaign = await Campaign.findById(campaignID);
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can join this lobby",
                });
            }

            if (!campaign.activeLobby?.isActive || !campaign.activeLobby?.lobbyCode) {
                return respond({
                    success: false,
                    message: "This campaign does not have an active lobby",
                });
            }

            const providedLobbyCode = sanitizeCode(data?.lobbyCode);
            if (
                providedLobbyCode &&
                providedLobbyCode !== sanitizeCode(campaign.activeLobby.lobbyCode)
            ) {
                return respond({ success: false, message: "Lobby code mismatch" });
            }

            const allowedLobbyMembers = Array.isArray(campaign.activeLobby.members)
                ? campaign.activeLobby.members.map((member) => String(member))
                : [];

            if (
                allowedLobbyMembers.length > 0 &&
                !allowedLobbyMembers.includes(String(playerID))
            ) {
                return respond({
                    success: false,
                    message: "The DM has not granted this player access to the active lobby",
                });
            }

            if (!isCampaignDM(campaign, playerID)) {
                const playerAssignment = Array.isArray(campaign.characterAssignments)
                    ? campaign.characterAssignments.find(
                          (assignment) => String(assignment?.playerId) === String(playerID)
                      ) || null
                    : null;
                let hasAssignedCharacter = false;

                if (playerAssignment?.characterId && mongoose.isValidObjectId(playerAssignment.characterId)) {
                    const validCharacter = await Character.exists({
                        _id: playerAssignment.characterId,
                        playerId: playerID,
                    });
                    hasAssignedCharacter = Boolean(validCharacter);

                    if (!hasAssignedCharacter) {
                        campaign.characterAssignments = (campaign.characterAssignments || []).filter(
                            (assignment) => String(assignment?.playerId) !== String(playerID)
                        );
                        await campaign.save();
                    }
                }

                if (!hasAssignedCharacter) {
                    return respond({
                        success: false,
                        requiresCharacterSelection: true,
                        message: "Choose a character for this campaign before entering the lobby",
                    });
                }
            }

            respond({
                success: true,
                gameID: String(campaign._id),
                campaignID: String(campaign._id),
                lobbyCode: campaign.activeLobby.lobbyCode,
            });
        } catch (error) {
            console.error("[campaign_joinLobby] failed", error);
            respond({ success: false, message: error.message || "Failed to join lobby" });
        }
    });

    socket.on("campaign_getCharacterChoices", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID)
                .populate({ path: "dmId", select: "_id username" })
                .populate({ path: "players", select: "_id username" })
                .populate({ path: "characterAssignments.playerId", select: "_id username" })
                .populate({ path: "characterAssignments.characterId", select: "_id name level playerId" });

            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can view lobby character choices",
                });
            }

            let availableCharacters = await Character.find({ playerId: playerID })
                .select("_id name level playerId")
                .sort({ updatedAt: -1, createdAt: -1 });

            if (!availableCharacters.length) {
                const playerWithCharacters = await Player.findById(playerID)
                    .select("_id characters")
                    .populate({ path: "characters", select: "_id name level playerId" });

                if (playerWithCharacters && Array.isArray(playerWithCharacters.characters)) {
                    availableCharacters = playerWithCharacters.characters;
                }
            }
            const formattedCampaign = formatCampaign(campaign);

            const isDM = isCampaignDM(campaign, playerID);
            const selectedAssignment = Array.isArray(formattedCampaign?.characterAssignments)
                ? formattedCampaign.characterAssignments.find(
                      (assignment) => assignment.playerId === String(playerID)
                  ) || null
                : null;

            let allCharactersByPlayer = [];
            if (isDM) {
                allCharactersByPlayer = (formattedCampaign?.characterAssignments || [])
                    .filter(
                        (assignment) =>
                            Boolean(assignment?.playerId) && Boolean(assignment?.characterId)
                    )
                    .map((assignment) => {
                        const memberID = toObjectIdString(assignment.playerId);
                        const selectedCharacterID = toObjectIdString(assignment.characterId);

                        return {
                            playerId: memberID,
                            playerName: assignment?.playerName || "",
                            assignedCharacterId: selectedCharacterID,
                            characters: [
                                {
                                    _id: selectedCharacterID,
                                    name: assignment?.characterName || "Assigned Character",
                                    level: Number(assignment?.characterLevel) || 1,
                                    playerId: memberID,
                                    isSelected: true,
                                },
                            ],
                        };
                    });
            }

            respond({
                success: true,
                campaign: formattedCampaign,
                assignments: formattedCampaign?.characterAssignments || [],
                selectedAssignment,
                availableCharacters: availableCharacters
                    .map((character) => formatCharacterSummary(character))
                    .filter(Boolean),
                allCharactersByPlayer,
                canManageAllCharacters: isDM,
            });
        } catch (error) {
            console.error("[campaign_getCharacterChoices] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to load campaign character choices",
            });
        }
    });

    socket.on("campaign_setCharacterAssignment", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, characterID } = data || {};

        try {
            if (
                !mongoose.isValidObjectId(playerID) ||
                !mongoose.isValidObjectId(campaignID) ||
                !mongoose.isValidObjectId(characterID)
            ) {
                return respond({
                    success: false,
                    message: "Valid playerID, campaignID, and characterID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeLobby characterAssignments characterStates"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can set lobby characters",
                });
            }

            if (!campaign.activeLobby?.isActive || !campaign.activeLobby?.lobbyCode) {
                return respond({
                    success: false,
                    message: "Start the lobby before selecting a character",
                });
            }

            const allowedLobbyMembers = Array.isArray(campaign.activeLobby.members)
                ? campaign.activeLobby.members.map((member) => String(member))
                : [];
            if (
                allowedLobbyMembers.length > 0 &&
                !allowedLobbyMembers.includes(String(playerID))
            ) {
                return respond({
                    success: false,
                    message: "The DM has not granted this player access to the active lobby",
                });
            }

            const character = await Character.findById(characterID).select(
                "_id name level playerId experience HP MP STA water food stats skills inv effects actions"
            );
            if (!character) {
                return respond({ success: false, message: "Character not found" });
            }

            let characterOwnedByPlayer = String(character.playerId) === String(playerID);
            if (!characterOwnedByPlayer) {
                const linkedToPlayer = await Player.exists({
                    _id: playerID,
                    characters: character._id,
                });
                characterOwnedByPlayer = Boolean(linkedToPlayer);
            }

            if (!characterOwnedByPlayer) {
                return respond({
                    success: false,
                    message: "You can only assign your own character to this lobby",
                });
            }

            if (String(character.playerId || "") !== String(playerID)) {
                await Character.updateOne({ _id: character._id }, { $set: { playerId: playerID } });
            }

            const existingState = findCampaignCharacterState(campaign, character._id);
            if (!existingState) {
                const seededState = extractCampaignStateFromCharacter(character);
                upsertCampaignCharacterState(campaign, {
                    characterID: character._id,
                    playerID,
                    statePatch: seededState,
                    replace: true,
                });
                campaign.markModified("characterStates");
            } else if (toObjectIdString(existingState.playerId) !== String(playerID)) {
                upsertCampaignCharacterState(campaign, {
                    characterID: character._id,
                    playerID,
                    statePatch: {},
                    replace: false,
                });
                campaign.markModified("characterStates");
            }

            const nextAssignments = Array.isArray(campaign.characterAssignments)
                ? campaign.characterAssignments.filter(
                      (assignment) => String(assignment?.playerId) !== String(playerID)
                  )
                : [];
            nextAssignments.push({
                playerId: playerID,
                characterId: characterID,
                selectedBy: playerID,
                selectedAt: new Date(),
            });
            campaign.characterAssignments = nextAssignments;

            await campaign.save();

            const campaignForClient = await readCampaignForResponse(campaign._id);
            const formattedCampaign = formatCampaign(campaignForClient);
            const assignment = Array.isArray(formattedCampaign?.characterAssignments)
                ? formattedCampaign.characterAssignments.find(
                      (entry) => String(entry.playerId) === String(playerID)
                  ) || null
                : null;

            respond({
                success: true,
                campaign: formattedCampaign,
                assignment,
                character: formatCharacterSummary(character),
            });
        } catch (error) {
            console.error("[campaign_setCharacterAssignment] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to select lobby character",
            });
        }
    });

    socket.on("campaign_forceRemoveCharacterAssignment", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, targetPlayerID } = data || {};
        const characterID = String(data?.characterID || "").trim();

        try {
            if (
                !mongoose.isValidObjectId(playerID) ||
                !mongoose.isValidObjectId(campaignID) ||
                !mongoose.isValidObjectId(targetPlayerID)
            ) {
                return respond({
                    success: false,
                    message: "Valid playerID, campaignID, and targetPlayerID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id name dmId players characterAssignments"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can remove assigned characters",
                });
            }

            const assignment = Array.isArray(campaign.characterAssignments)
                ? campaign.characterAssignments.find(
                      (entry) => String(entry?.playerId) === String(targetPlayerID)
                  )
                : null;
            if (!assignment) {
                return respond({
                    success: false,
                    message: "That player does not currently have a selected character",
                });
            }

            const assignedCharacterID = toObjectIdString(assignment.characterId);
            if (characterID && characterID !== assignedCharacterID) {
                return respond({
                    success: false,
                    message: "Selected character does not match the player's current assignment",
                });
            }

            campaign.characterAssignments = (campaign.characterAssignments || []).filter(
                (entry) => String(entry?.playerId) !== String(targetPlayerID)
            );
            await campaign.save();

            const [dmPlayer, targetPlayer, removedCharacter] = await Promise.all([
                Player.findById(playerID).select("_id username"),
                Player.findById(targetPlayerID).select("_id username"),
                Character.findById(assignedCharacterID).select("_id name level"),
            ]);

            if (targetPlayer) {
                await Messages.create({
                    from: dmPlayer?._id || null,
                    to: [targetPlayer._id],
                    kind: "campaign_character_removed",
                    subject: `Character Removed: ${campaign.name || "Campaign"}`,
                    message: `${dmPlayer?.username || "DM"} removed your selected character${
                        removedCharacter?.name ? ` (${removedCharacter.name})` : ""
                    } from "${campaign.name || "this campaign"}". Choose another character before entering the lobby.`,
                    payload: {
                        campaignID: String(campaign._id),
                        campaignName: campaign.name || "Campaign",
                        removedCharacterID: assignedCharacterID,
                        removedCharacterName: removedCharacter?.name || "",
                        removedByID: String(playerID),
                    },
                    status: "sent",
                    readBy: [],
                });
            }

            const campaignForClient = await readCampaignForResponse(campaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
                removedPlayerID: String(targetPlayerID),
                removedCharacterID: assignedCharacterID,
            });
        } catch (error) {
            console.error("[campaign_forceRemoveCharacterAssignment] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to remove assigned character",
            });
        }
    });

    socket.on("campaign_saveCharacterState", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, characterID } = data || {};
        const statePatch = toPlainObject(data?.statePatch);

        try {
            if (
                !mongoose.isValidObjectId(playerID) ||
                !mongoose.isValidObjectId(campaignID) ||
                !mongoose.isValidObjectId(characterID)
            ) {
                return respond({
                    success: false,
                    message: "Valid playerID, campaignID, and characterID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players characterAssignments characterStates"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can update campaign character state",
                });
            }

            if (!isCharacterInCampaign(campaign, characterID)) {
                return respond({
                    success: false,
                    message: "Character is not assigned in this campaign",
                });
            }

            const assignment = Array.isArray(campaign.characterAssignments)
                ? campaign.characterAssignments.find(
                      (entry) => toObjectIdString(entry?.characterId) === String(characterID)
                  ) || null
                : null;
            const stateEntry = findCampaignCharacterState(campaign, characterID);
            const ownerID =
                toObjectIdString(assignment?.playerId) ||
                toObjectIdString(stateEntry?.playerId);

            if (!isCampaignDM(campaign, playerID) && ownerID && ownerID !== String(playerID)) {
                return respond({
                    success: false,
                    message: "Only the character owner or DM can update this campaign state",
                });
            }

            const cleanedPatch = sanitizeCampaignStatePatch(statePatch);
            if (Object.keys(cleanedPatch).length === 0) {
                return respond({
                    success: false,
                    message: "No supported state fields were provided",
                });
            }

            const stateExists = Boolean(stateEntry);
            let nextStatePatch = cleanedPatch;
            if (!stateExists) {
                const baseCharacter = await Character.findById(characterID).select(
                    "_id name level playerId experience HP MP STA water food stats skills inv effects actions"
                );
                const seededState = baseCharacter
                    ? extractCampaignStateFromCharacter(baseCharacter)
                    : {};
                nextStatePatch = {
                    ...seededState,
                    ...cleanedPatch,
                };
            }

            upsertCampaignCharacterState(campaign, {
                characterID,
                playerID: ownerID || playerID,
                statePatch: nextStatePatch,
                replace: !stateExists,
            });
            campaign.markModified("characterStates");

            await campaign.save();

            const updatedState = findCampaignCharacterState(campaign, characterID);
            const campaignForClient = await readCampaignForResponse(campaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
                characterID: String(characterID),
                campaignState: toPlainObject(updatedState?.state),
            });
        } catch (error) {
            console.error("[campaign_saveCharacterState] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to save campaign character state",
            });
        }
    });

    socket.on("campaign_leave", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeLobby characterAssignments characterStates"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: true,
                    alreadyLeft: true,
                    campaignID: String(campaignID),
                });
            }

            if (isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "The DM cannot leave their own campaign",
                });
            }

            const removedCharacterIDs = (campaign.characterAssignments || [])
                .filter((assignment) => String(assignment?.playerId) === String(playerID))
                .map((assignment) => toObjectIdString(assignment?.characterId))
                .filter(Boolean);

            campaign.players = (campaign.players || []).filter(
                (member) => String(member) !== String(playerID)
            );
            if (Array.isArray(campaign.activeLobby?.members)) {
                campaign.activeLobby.members = campaign.activeLobby.members.filter(
                    (member) => String(member) !== String(playerID)
                );
            }
            campaign.characterAssignments = (campaign.characterAssignments || []).filter(
                (assignment) => String(assignment?.playerId) !== String(playerID)
            );
            if (Array.isArray(campaign.characterStates)) {
                campaign.characterStates = campaign.characterStates.filter((stateEntry) => {
                    const statePlayerID = toObjectIdString(stateEntry?.playerId);
                    const stateCharacterID = toObjectIdString(stateEntry?.characterId);
                    if (statePlayerID && statePlayerID === String(playerID)) return false;
                    return !removedCharacterIDs.includes(stateCharacterID);
                });
            }

            await campaign.save();

            await Player.findByIdAndUpdate(playerID, {
                $pull: { campaigns: campaign._id },
            });

            const campaignForClient = await readCampaignForResponse(campaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
                leftCampaignID: String(campaign._id),
            });
        } catch (error) {
            console.error("[campaign_leave] failed", error);
            respond({ success: false, message: error.message || "Failed to leave campaign" });
        }
    });

    socket.on("campaign_setLobbyMembers", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({ success: false, message: "Valid playerID and campaignID are required" });
            }

            const campaign = await Campaign.findById(campaignID).select("_id dmId players activeLobby");
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can manage lobby players",
                });
            }

            if (!campaign.activeLobby?.isActive || !campaign.activeLobby?.lobbyCode) {
                return respond({
                    success: false,
                    message: "Start the lobby before managing players",
                });
            }

            const campaignMemberIDs = new Set(
                Array.isArray(campaign.players) ? campaign.players.map((member) => String(member)) : []
            );
            campaignMemberIDs.add(String(campaign.dmId));

            const requestedMemberIDs = Array.isArray(data?.memberIDs) ? data.memberIDs : [];
            const normalizedRequestedMembers = Array.from(
                new Set(
                    requestedMemberIDs
                        .map((memberID) => String(memberID || "").trim())
                        .filter((memberID) => mongoose.isValidObjectId(memberID))
                )
            );

            const filteredMembers = normalizedRequestedMembers.filter((memberID) =>
                campaignMemberIDs.has(memberID)
            );
            const nextLobbyMembers = Array.from(new Set([String(campaign.dmId), ...filteredMembers]));

            campaign.activeLobby.members = nextLobbyMembers;
            await campaign.save();

            const campaignForClient = await readCampaignForResponse(campaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
                members: nextLobbyMembers,
            });
        } catch (error) {
            console.error("[campaign_setLobbyMembers] failed", error);
            respond({ success: false, message: error.message || "Failed to update lobby players" });
        }
    });

    socket.on("campaign_managePlayer", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, targetPlayerID } = data || {};
        const action = String(data?.action || "").trim().toLowerCase();

        try {
            if (
                !mongoose.isValidObjectId(playerID) ||
                !mongoose.isValidObjectId(campaignID) ||
                !mongoose.isValidObjectId(targetPlayerID)
            ) {
                return respond({
                    success: false,
                    message: "Valid playerID, campaignID, and targetPlayerID are required",
                });
            }

            if (!["kick", "ban", "unban"].includes(action)) {
                return respond({
                    success: false,
                    message: "Action must be kick, ban, or unban",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players bannedPlayers activeLobby characterAssignments characterStates"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can manage players",
                });
            }

            if (toObjectIdString(campaign.dmId) === String(targetPlayerID)) {
                return respond({
                    success: false,
                    message: "The DM cannot be removed or banned",
                });
            }

            if (action === "unban") {
                campaign.bannedPlayers = (campaign.bannedPlayers || []).filter(
                    (member) => String(member) !== String(targetPlayerID)
                );
                await campaign.save();

                const campaignForClient = await readCampaignForResponse(campaign._id);
                return respond({
                    success: true,
                    campaign: formatCampaign(campaignForClient),
                });
            }

            const campaignPlayers = Array.isArray(campaign.players)
                ? campaign.players.map((member) => String(member))
                : [];

            if (!campaignPlayers.includes(String(targetPlayerID))) {
                return respond({
                    success: false,
                    message: "Target player is not currently in this campaign",
                });
            }

            const removedCharacterIDs = (campaign.characterAssignments || [])
                .filter((assignment) => String(assignment?.playerId) === String(targetPlayerID))
                .map((assignment) => toObjectIdString(assignment?.characterId))
                .filter(Boolean);

            campaign.players = (campaign.players || []).filter(
                (member) => String(member) !== String(targetPlayerID)
            );
            if (Array.isArray(campaign.activeLobby?.members)) {
                campaign.activeLobby.members = campaign.activeLobby.members.filter(
                    (member) => String(member) !== String(targetPlayerID)
                );
            }
            campaign.characterAssignments = (campaign.characterAssignments || []).filter(
                (assignment) => String(assignment?.playerId) !== String(targetPlayerID)
            );
            if (Array.isArray(campaign.characterStates)) {
                campaign.characterStates = campaign.characterStates.filter((stateEntry) => {
                    const statePlayerID = toObjectIdString(stateEntry?.playerId);
                    const stateCharacterID = toObjectIdString(stateEntry?.characterId);
                    if (statePlayerID && statePlayerID === String(targetPlayerID)) return false;
                    return !removedCharacterIDs.includes(stateCharacterID);
                });
            }

            if (action === "ban") {
                campaign.bannedPlayers.addToSet(targetPlayerID);
            }

            await campaign.save();
            await Player.findByIdAndUpdate(targetPlayerID, {
                $pull: { campaigns: campaign._id },
            });

            const campaignForClient = await readCampaignForResponse(campaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
            });
        } catch (error) {
            console.error("[campaign_managePlayer] failed", error);
            respond({ success: false, message: error.message || "Failed to manage player" });
        }
    });

    socket.on("campaign_invitePlayer", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};
        const username = sanitizeText(data?.username, 40);

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            if (!username) {
                return respond({
                    success: false,
                    message: "A username is required to invite a player",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id name description joinCode dmId players bannedPlayers maxPlayers"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can invite players",
                });
            }

            const [invitee, sender] = await Promise.all([
                Player.findOne({ username }).select("_id username"),
                Player.findById(playerID).select("_id username"),
            ]);
            if (!invitee) {
                return respond({
                    success: false,
                    message: "Player not found for that username",
                });
            }
            if (!sender) {
                return respond({
                    success: false,
                    message: "Inviting player not found",
                });
            }

            const inviteeID = String(invitee._id);
            if (inviteeID === toObjectIdString(campaign.dmId)) {
                return respond({
                    success: false,
                    message: "That player is already the DM of this campaign",
                });
            }

            if (isCampaignBanned(campaign, inviteeID)) {
                return respond({
                    success: false,
                    message: "That player is banned from this campaign",
                });
            }

            if (isCampaignMember(campaign, inviteeID)) {
                const existingCampaign = await readCampaignForResponse(campaign._id);
                return respond({
                    success: true,
                    alreadyMember: true,
                    campaign: formatCampaign(existingCampaign),
                    invitedPlayer: {
                        _id: inviteeID,
                        username: invitee.username || username,
                    },
                });
            }

            const pendingInvite = await Messages.findOne({
                kind: "campaign_invite",
                to: invitee._id,
                status: "pending",
                "payload.campaignID": String(campaign._id),
            }).select("_id");

            if (pendingInvite) {
                return respond({
                    success: true,
                    alreadyInvited: true,
                    invitedPlayer: {
                        _id: inviteeID,
                        username: invitee.username || username,
                    },
                    messageID: String(pendingInvite._id),
                });
            }

            const createdInvite = await Messages.create({
                from: sender._id,
                to: [invitee._id],
                kind: "campaign_invite",
                subject: `Campaign Invite: ${campaign.name || "Campaign"}`,
                message: `${sender.username || "DM"} invited you to join "${campaign.name || "a campaign"}".`,
                payload: {
                    campaignID: String(campaign._id),
                    campaignName: campaign.name || "Campaign",
                    campaignJoinCode: campaign.joinCode || "",
                    invitedByID: String(sender._id),
                    invitedByName: sender.username || "",
                },
                status: "pending",
                readBy: [],
            });

            respond({
                success: true,
                inviteSent: true,
                invitedPlayer: {
                    _id: inviteeID,
                    username: invitee.username || username,
                },
                messageID: String(createdInvite._id),
            });
        } catch (error) {
            console.error("[campaign_invitePlayer] failed", error);
            respond({ success: false, message: error.message || "Failed to invite player" });
        }
    });

    socket.on("campaign_saveGame", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({ success: false, message: "Valid playerID and campaignID are required" });
            }

            const campaign = await Campaign.findById(campaignID);
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can create saves",
                });
            }

            const now = new Date();
            const fallbackName = `Save ${now.toISOString().replace("T", " ").slice(0, 19)}`;
            const name = sanitizeText(data?.name, 120) || fallbackName;
            const description = sanitizeText(data?.description, 1000);
            const snapshotInput = toPlainObject(data?.snapshot);
            const useSnapshotPatch = Boolean(data?.snapshotPatch);
            const isAutoSave = Boolean(data?.isAutoSave);
            const runtimeState =
                campaignRuntimeStateByID.get(String(campaign._id)) || createEngineState(campaign._id, {});
            if (!campaignRuntimeStateByID.has(String(campaign._id))) {
                campaignRuntimeStateByID.set(String(campaign._id), runtimeState);
            }
            const baseSnapshot = toPlainObject(runtimeState?.snapshot);
            const mergedSnapshot = useSnapshotPatch
                ? mergeSnapshotPatch(baseSnapshot, snapshotInput)
                : (Object.keys(snapshotInput).length > 0 ? snapshotInput : baseSnapshot);
            const snapshotForSave = isAutoSave ? pruneSnapshotForSave(mergedSnapshot) : mergedSnapshot;
            const metadata = toPlainObject(data?.metadata);
            const makeActive = Boolean(data?.makeActive) || isAutoSave;

            const result = await persistGame(
                campaign._id,
                playerID,
                name,
                description,
                snapshotForSave,
                isAutoSave,
                makeActive,
                {
                    runtimeState,
                    replaceRuntime: !isAutoSave,
                }
            );

            respond({ ...result, campaignID: String(campaign._id), activeGameSave: String(campaign.activeGameSave) });
        } catch (error) {
            console.error("[campaign_saveGame] failed", error);
            respond({ success: false, message: error.message || "Failed to save campaign state" });
        }
    });

    socket.on("campaign_listGameSaves", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({ success: false, message: "Valid playerID and campaignID are required" });
            }

            const campaign = await Campaign.findById(campaignID).select("_id dmId players activeGameSave");
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can view saves",
                });
            }

            const [manualSaves, autoSaves] = await Promise.all([
                GameSave.find({
                    campaignId: campaign._id,
                    isAutoSave: false,
                }).sort({ updatedAt: -1, _id: -1 }),
                GameSave.find({
                    campaignId: campaign._id,
                    isAutoSave: true,
                })
                    .sort({ updatedAt: -1, _id: -1 })
                    .limit(MAX_AUTO_SAVE_HISTORY),
            ]);

            const formattedManualSaves = manualSaves.map((save) => formatGameSave(save)).filter(Boolean);
            const formattedAutoSaves = autoSaves.map((save) => formatGameSave(save)).filter(Boolean);
            const gameSaves = [...formattedManualSaves, ...formattedAutoSaves].sort((a, b) => {
                const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
                const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
                return bTime - aTime;
            });

            respond({
                success: true,
                gameSaves,
                manualSaves: formattedManualSaves,
                autoSaves: formattedAutoSaves,
                autoSaveLimit: MAX_AUTO_SAVE_HISTORY,
                activeGameSave: toObjectIdString(campaign.activeGameSave),
                campaignID: String(campaign._id),
            });
        } catch (error) {
            console.error("[campaign_listGameSaves] failed", error);
            respond({ success: false, message: error.message || "Failed to list campaign saves" });
        }
    });

    socket.on("campaign_loadGame", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, gameSaveID } = data || {};

        try {
            if (
                !mongoose.isValidObjectId(playerID) ||
                !mongoose.isValidObjectId(campaignID) ||
                !mongoose.isValidObjectId(gameSaveID)
            ) {
                return respond({
                    success: false,
                    message: "Valid playerID, campaignID, and gameSaveID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID);
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can load saves",
                });
            }

            const gameSave = await GameSave.findOne({
                _id: gameSaveID,
                campaignId: campaign._id,
            });
            if (!gameSave) {
                return respond({ success: false, message: "Game save not found for this campaign" });
            }

            campaign.gameSaves.addToSet(gameSave._id);
            campaign.activeGameSave = gameSave._id;
            await campaign.save();
            const runtimeState = replaceRuntimeState(campaign._id, toPlainObject(gameSave.snapshot));

            const payload = {
                success: true,
                gameSave: formatGameSave(gameSave),
                snapshot: toPlainObject(runtimeState.snapshot),
                floorTypes: FLOOR_TYPES,
                engineState: cloneEngineState(runtimeState),
                campaignID: String(campaign._id),
                gameID: String(campaign._id),
                activeGameSave: toObjectIdString(campaign.activeGameSave),
            };
            socket.join(getCampaignGameRoom(campaign._id));
            socket.join(getCampaignDMRoom(campaign._id));
            await emitPlayerStateUpdate(socket, campaign, payload);
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);

            respond(payload);
        } catch (error) {
            console.error("[campaign_loadGame] failed", error);
            respond({ success: false, message: error.message || "Failed to load game save" });
        }
    });

    // ========================================================================
    // CHAT SYSTEM
    // ========================================================================

    // Join campaign chat room
    socket.on("chat_join", async (data) => {
        const { campaignID, playerID } = data;
        if (!campaignID || !playerID) {
            console.log("[CHAT] Ignoring chat_join - missing campaignID or playerID");
            return;
        }
        
        const chatRoom = `chat:${campaignID}`;
        socket.join(chatRoom);
        console.log(`[CHAT] Player ${playerID} joined chat room: ${chatRoom}`);
        
        // Inform other players in the room
        socket.to(chatRoom).emit("chat_user_joined", {
            playerId: playerID,
            chatRoom: chatRoom
        });
    });

    // Leave campaign chat room
    socket.on("chat_leave", async (data) => {
        const { campaignID, playerID } = data;
        if (!campaignID || !playerID) return;
        
        const chatRoom = `chat:${campaignID}`;
        socket.leave(chatRoom);
        console.log(`[CHAT] Player ${playerID} left chat room: ${chatRoom}`);
    });

    // Send chat message
    socket.on("chat_send_message", async (data) => {
        try {
            const { campaignID, from, to, message, type, groupId, timestamp } = data;
            
            if (!campaignID || !from || !message) {
                console.error("[CHAT] Missing required fields");
                return;
            }

            // Get campaign and player info
            const campaign = await Campaign.findById(campaignID)
                .populate('characters.playerId', 'username')
                .lean();
            
            if (!campaign) {
                console.error("[CHAT] Campaign not found");
                return;
            }

            // Look up sender name from campaign members or characters
            let fromName = "Unknown";
            if (campaign.players && Array.isArray(campaign.players)) {
                const player = campaign.players.find(p => toObjectIdString(p._id) === toObjectIdString(from));
                if (player) fromName = player.username || "Player";
            }
            
            // Fallback: look in characters
            if (fromName === "Unknown" && campaign.characters && Array.isArray(campaign.characters)) {
                const char = campaign.characters.find(c => toObjectIdString(c.playerId) === toObjectIdString(from));
                if (char) fromName = char.ownerName || char.name || "Player";
            }

            console.log(`[CHAT] Message from ${from} (${fromName}): ${message.substring(0, 50)}...`);

            // Save message to database
            const messageDoc = await Messages.create({
                from: mongoose.Types.ObjectId(from),
                to: type === "party" ? [] : (Array.isArray(to) ? to.map(id => mongoose.Types.ObjectId(id)) : [mongoose.Types.ObjectId(to)]),
                kind: "chat",
                subject: type || "party",
                message,
                payload: { campaignID, type, groupId },
                status: "sent",
                time: timestamp ? new Date(timestamp) : new Date()
            });

            const chatRoom = `chat:${campaignID}`;
            const messageData = {
                id: String(messageDoc._id),
                from,
                fromName,
                to: type === "party" ? "all" : to,
                message,
                type,
                groupId,
                timestamp: messageDoc.time.getTime()
            };

            // Broadcast based on type
            if (type === "party") {
                // Send to entire campaign chat room
                socket.to(chatRoom).emit("chat_message", messageData);
                socket.emit("chat_message", messageData); // Echo back to sender
            } else if (type === "dm") {
                // Send to specific user(s)
                socket.to(chatRoom).emit("chat_message", messageData);
                socket.emit("chat_message", messageData); // Echo back to sender
            } else if (type === "group") {
                // Send to group members
                socket.to(chatRoom).emit("chat_message", messageData);
                socket.emit("chat_message", messageData); // Echo back to sender
            }

            console.log(`[CHAT] Message sent from ${fromName} (${from}) in ${campaignID} - type: ${type}`);
        } catch (error) {
            console.error("[CHAT] Error sending message:", error);
        }
    });

    // Get chat groups for campaign
    socket.on("chat_get_groups", async (data) => {
        try {
            const { campaignID, playerID } = data;
            
            if (!campaignID || !playerID) {
                console.log("[CHAT] Missing campaignID or playerID for get_groups");
                return;
            }

            const campaign = await Campaign.findById(campaignID)
                .select('chatGroups')
                .lean();

            if (!campaign) {
                console.log("[CHAT] Campaign not found for get_groups");
                return;
            }

            // Filter groups where player is a member
            const playerGroups = (campaign.chatGroups || []).filter(group =>
                group.members && group.members.some(memberId => 
                    toObjectIdString(memberId) === toObjectIdString(playerID)
                )
            );

            console.log(`[CHAT] Player ${playerID} has ${playerGroups.length} groups`);

            socket.emit("chat_groups_updated", {
                groups: playerGroups.map(g => ({
                    id: String(g._id),
                    name: g.name,
                    members: g.members.map(m => String(m)),
                    createdBy: String(g.createdBy)
                }))
            });
        } catch (error) {
            console.error("[CHAT] Error getting groups:", error);
        }
    });

    // Create chat group
    socket.on("chat_create_group", async (data) => {
        try {
            const { campaignID, creatorId, name, members } = data;
            
            if (!campaignID || !creatorId || !name || !members || members.length === 0) {
                console.error("[CHAT] Missing required fields for group creation");
                return;
            }

            const campaign = await Campaign.findById(campaignID);
            if (!campaign) {
                console.error("[CHAT] Campaign not found");
                return;
            }

            // Initialize chatGroups array if it doesn't exist
            if (!campaign.chatGroups) {
                campaign.chatGroups = [];
            }

            // Create new group
            const newGroup = {
                _id: new mongoose.Types.ObjectId(),
                name,
                members: members.map(id => mongoose.Types.ObjectId(id)),
                createdBy: mongoose.Types.ObjectId(creatorId),
                createdAt: new Date()
            };

            campaign.chatGroups.push(newGroup);
            await campaign.save();

            // Notify all group members
            const chatRoom = `chat:${campaignID}`;
            const groupData = {
                id: String(newGroup._id),
                name: newGroup.name,
                members: newGroup.members.map(m => String(m)),
                createdBy: String(newGroup.createdBy)
            };

            // Get all groups for each member
            members.forEach(memberId => {
                const memberGroups = campaign.chatGroups
                    .filter(g => g.members.some(m => toObjectIdString(m) === toObjectIdString(memberId)))
                    .map(g => ({
                        id: String(g._id),
                        name: g.name,
                        members: g.members.map(m => String(m)),
                        createdBy: String(g.createdBy)
                    }));

                socket.to(chatRoom).emit("chat_groups_updated", { groups: memberGroups });
            });

            // Send back to creator
            socket.emit("chat_groups_updated", {
                groups: campaign.chatGroups
                    .filter(g => g.members.some(m => toObjectIdString(m) === toObjectIdString(creatorId)))
                    .map(g => ({
                        id: String(g._id),
                        name: g.name,
                        members: g.members.map(m => String(m)),
                        createdBy: String(g.createdBy)
                    }))
            });

            console.log(`[CHAT] Group "${name}" created in campaign ${campaignID} by ${creatorId}`);
        } catch (error) {
            console.error("[CHAT] Error creating group:", error);
        }
    });
};
