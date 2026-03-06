import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { michelangeloEngine } from "./michelangeloEngine";
import { GAME_LAYER_REGISTRY, bindLayerCanvases } from "./Map Layers/layerRegistry";
import getImage from "../../handlers/getImage";
import GameSidePanel from "../../pageComponents/game_sidepanel";
import InfoWindows from "./infoWindows";
import { useGame } from "../../data/gameContext";
import { SocketContext } from "../../socket.io/context";
import { emitWithAck } from "../campaign/socketEmit";
import { useGameActions } from "../../hooks/useGameActions";
import DiceRollGallery from "../../pageComponents/DiceRollGallery";
import { HEIGHT_UNITS_PER_ZLEVEL } from "./Map Layers/mapLayerShared";
import { calculateLightAtPoint } from "./Map Layers/7lighting";
import { MAP_VIEWS, getActiveMapView } from "./mapFilters";
import {
    MIN_SIDE_WIDTH,
    MAX_SIDE_WIDTH,
    ZOOM_FACTOR,
    MIN_ZOOM,
    MAX_ZOOM,
    MAX_CANVAS_DPR,
    PAN_SPEED,
    CLICK_DRAG_THRESHOLD_PX,
    MIN_RECT_WORLD_SIZE,
    MIN_SHAPE_WORLD_SIZE,
    AUTO_SAVE_DEBOUNCE_MS,
    INFO_PANEL_WIDTH,
    INFO_PANEL_MIN_LEFT,
    INFO_PANEL_MIN_TOP,
    INFO_PANEL_MAX_BOTTOM_PADDING,
    RESIZE_HANDLE_HIT_RADIUS_PX,
    HEIGHT_HANDLE_OFFSET_PX,
    FACE_DOT_OFFSET_PX,
    FACE_DOT_RADIUS_PX,
    FACE_DOT_HIT_RADIUS_PX,
    WORLD_UNITS_PER_FOOT,
    TEAM_PREVIEW_COLORS,
    DEFAULT_MAX_HP_BY_TERRAIN
} from "./gameConstants";
 

import { ANIMATION_REGISTRY } from "./animationRegistry";
import {
    normalizeAngleDegrees,
    getFacingAngle,
    getObjectVisibilityRadius,
    isPointInsideMapObject,
    findTopMapObjectAt,
    wouldCharacterCollideWithObstacles,
    getClosestBlockingCharacter,
    adjustPositionBeforeCollision,
    toEntityID,
    getCharacterTokenId,
    getCharacterOwnerId,
    extractOwnedCharacterIdsFromSnapshot,
    extractOwnedCharacterIdsFromOwnershipMap,
    mergeUniqueIds,
    isSameEntity,
    getObjectZLevel,
    getMapObjectBounds,
    doBoundsOverlap,
    isSolidObject,
    doPreciseOverlap,
    wouldObjectOverlapAtPosition,
    worldToScreenWithCamera,
    buildResizeHandlesForObject,
    findResizeHandleAtScreenPoint,
    getResizeAnchorForHandle,
    isTypingTarget,
    resolveDMPermission,
    buildPlacementFromDrag
} from "./gameUtils";
import {
    groupActionsByTab,
    buildContextActionMenu,
    getContextActionItems
} from "./gameActions";

const MOVEMENT_MULTIPLIERS = {
    walk: 1,
    jog: 2,
    run: 3,
    sprint: 4,
    jump: 1,
};

const VISION_MAP_MIN_MOVE = WORLD_UNITS_PER_FOOT;
const VISION_MAP_MIN_ROT = 8;

const makeVisionEntityKey = (type, id) =>
    `${String(type || "unknown")}:${toEntityID(id)}`;

const normalizeVisionMapsFromSnapshot = (snapshot = {}) => {
    const rawMaps =
        snapshot?.visionMaps && typeof snapshot.visionMaps === "object" && !Array.isArray(snapshot.visionMaps)
            ? snapshot.visionMaps
            : null;

    const normalizeLastSeen = (raw = {}) => {
        const output = {};
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return output;
        Object.entries(raw).forEach(([key, value]) => {
            if (!value || typeof value !== "object") return;
            const snapshotValue =
                value.snapshot ||
                value.obj ||
                value.entity ||
                ((value.position || value.x != null) ? value : null);
            if (!snapshotValue) return;
            const keyParts = String(key || "").split(":");
            const keyType = keyParts.length > 1 ? keyParts[0] : "";
            const keyId = keyParts.length > 1 ? keyParts.slice(1).join(":") : "";
            const inferredType =
                value.entityType ||
                keyType ||
                (snapshotValue?.position ? "character" : "mapObject");
            const entityId = toEntityID(snapshotValue?.id || value.id || keyId || key);
            if (!entityId) return;
            const visibilityRaw = Number(value.visibility);
            const visibility =
                Number.isFinite(visibilityRaw) ? visibilityRaw : (value.visionType === "peripheral" ? 0.5 : 1);
            const visionType =
                value.visionType ||
                (visibility > 0 && visibility < 1 ? "peripheral" : visibility >= 1 ? "main" : "blocked");
            const entityKey = makeVisionEntityKey(inferredType, entityId);
            output[entityKey] = {
                ts: Number(value.ts) || Date.now(),
                snapshot: snapshotValue,
                entityType: inferredType,
                visibility,
                visionType,
            };
        });
        return output;
    };

    if (rawMaps) {
        const output = {};
        Object.entries(rawMaps).forEach(([charId, map]) => {
            const normalizedId = toEntityID(charId);
            if (!normalizedId) return;
            const exploredAreas = Array.isArray(map?.exploredAreas) ? map.exploredAreas : [];
            const lastSeenEntities = normalizeLastSeen(map?.lastSeenEntities || map?.lastSeen || {});
            const visibleEntities =
                map?.visibleEntities && typeof map.visibleEntities === "object" && !Array.isArray(map.visibleEntities)
                    ? map.visibleEntities
                    : {};
            output[normalizedId] = {
                exploredAreas,
                lastSeenEntities,
                visibleEntities,
            };
        });
        return output;
    }

    const legacyExplored = Array.isArray(snapshot?.exploredAreas) ? snapshot.exploredAreas : [];
    const legacyLastSeen = normalizeLastSeen(snapshot?.lastSeenEntities || {});
    if (legacyExplored.length === 0 && Object.keys(legacyLastSeen).length === 0) {
        return {};
    }

    const output = {};
    const legacyCharacters = Array.isArray(snapshot?.characters) ? snapshot.characters : [];
    legacyCharacters.forEach((char) => {
        const id = toEntityID(char?.id);
        if (!id) return;
        output[id] = {
            exploredAreas: legacyExplored.slice(),
            lastSeenEntities: JSON.parse(JSON.stringify(legacyLastSeen)),
            visibleEntities: {},
        };
    });
    return output;
};

const getWisScoreFromStats = (stats = {}) => {
    if (!stats || typeof stats !== "object") return 0;
    const wis = stats.WIS ?? stats.wis ?? {};
    const rawScore = typeof wis === "object" ? (wis.score ?? wis.value ?? 0) : wis;
    const score = Number(rawScore);
    return Number.isFinite(score) ? score : 0;
};

const getMemoryLimitForChar = (char) => {
    const explicit = Number(char?.memory?.polygons);
    if (Number.isFinite(explicit)) {
        return Math.max(0, Math.floor(explicit));
    }
    const wisScore = getWisScoreFromStats(char?.stats);
    if (!Number.isFinite(wisScore)) return 0;
    return Math.max(0, Math.floor(wisScore / 2));
};

const trimExploredAreasForMemory = (areas, sampleLimit) => {
    if (!Array.isArray(areas)) return [];
    const safeLimit = Math.max(0, Math.floor(Number(sampleLimit) || 0));
    if (safeLimit <= 0) return [];

    const entries = areas.map((shape, idx) => ({
        shape,
        ts: Number(shape?.ts) || 0,
        idx,
    }));
    const uniqueTs = Array.from(new Set(entries.map((entry) => entry.ts))).sort((a, b) => a - b);
    if (uniqueTs.length <= safeLimit) return areas;

    const keepTs = new Set(uniqueTs.slice(uniqueTs.length - safeLimit));
    return entries.filter((entry) => keepTs.has(entry.ts)).map((entry) => entry.shape);
};

const trimVisionMapsForCharacters = (visionMaps, characters) => {
    if (!visionMaps || typeof visionMaps !== "object") return {};
    const output = { ...visionMaps };
    const charMap = new Map();
    (Array.isArray(characters) ? characters : []).forEach((char) => {
        const id = toEntityID(char?.id);
        if (id) charMap.set(id, char);
    });
    Object.entries(output).forEach(([charId, map]) => {
        const normalizedId = toEntityID(charId);
        const char = charMap.get(normalizedId);
        if (!char) return;
        const limit = getMemoryLimitForChar(char);
        const exploredAreas = trimExploredAreasForMemory(
            Array.isArray(map?.exploredAreas) ? map.exploredAreas : [],
            limit
        );
        output[normalizedId] = {
            ...map,
            exploredAreas,
        };
    });
    return output;
};

const resolveVisionSources = (characters = [], ownedIds = [], fovMode = "party") => {
    const list = Array.isArray(characters) ? characters : [];
    const playerChars = list.filter(
        (char) => String(char?.team || "").toLowerCase() === "player"
    );
    if (String(fovMode || "").toLowerCase() !== "perplayer") {
        return playerChars;
    }
    const ownedSet = new Set((ownedIds || []).map((id) => toEntityID(id)));
    const ownedSources = playerChars.filter((char) => ownedSet.has(toEntityID(char?.id)));
    return ownedSources.length > 0 ? ownedSources : playerChars;
};

const normalizeRad = (rad) => {
    let value = rad;
    while (value > Math.PI) value -= Math.PI * 2;
    while (value < -Math.PI) value += Math.PI * 2;
    return value;
};

const splitVisionRays = (rays = []) => {
    if (!Array.isArray(rays) || rays.length === 0) return { main: [], peripheral: [] };
    const hasPeripheralFlag = rays.some((ray) => ray?.isPeripheral != null);
    if (!hasPeripheralFlag) return { main: rays, peripheral: [] };
    return {
        main: rays.filter((ray) => !ray?.isPeripheral),
        peripheral: rays.filter((ray) => ray?.isPeripheral),
    };
};

const splitPeripheralRaysBySide = (rays = [], charX, charY, facingRad) => {
    const left = [];
    const right = [];
    if (!Array.isArray(rays) || rays.length === 0) return { left, right };
    rays.forEach((ray) => {
        const angleRad = Math.atan2((ray?.endY ?? 0) - charY, (ray?.endX ?? 0) - charX);
        const rel = normalizeRad(angleRad - facingRad);
        if (rel < 0) {
            left.push(ray);
        } else {
            right.push(ray);
        }
    });
    return { left, right };
};

const buildRayFan = (rays, charX, charY, facingRad) => {
    if (!Array.isArray(rays) || rays.length === 0) return [];
    const sorted = rays
        .map((ray) => {
            const angleRad = Math.atan2((ray?.endY ?? 0) - charY, (ray?.endX ?? 0) - charX);
            return {
                angle: normalizeRad(angleRad - facingRad),
                distance: Number(ray?.distance) || 0,
            };
        })
        .sort((a, b) => a.angle - b.angle);

    const deduped = [];
    const EPS = 1e-4;
    for (const ray of sorted) {
        const last = deduped[deduped.length - 1];
        if (last && Math.abs(ray.angle - last.angle) < EPS) {
            if (ray.distance > last.distance) {
                deduped[deduped.length - 1] = ray;
            }
            continue;
        }
        deduped.push(ray);
    }
    return deduped;
};

const sortRaysForPolygon = (rays, charX, charY, facingRad) => {
    if (!Array.isArray(rays) || rays.length === 0) return [];
    const sorted = rays
        .map((ray) => {
            const endX = Number(ray?.endX) || 0;
            const endY = Number(ray?.endY) || 0;
            const angleRad = Math.atan2(endY - charY, endX - charX);
            const relAngle = normalizeRad(angleRad - facingRad);
            const distance = Number(ray?.distance) || Math.hypot(endX - charX, endY - charY);
            return {
                endX,
                endY,
                relAngle,
                distance,
            };
        })
        .sort((a, b) => a.relAngle - b.relAngle);

    const deduped = [];
    const EPS = 1e-4;
    for (const ray of sorted) {
        const last = deduped[deduped.length - 1];
        if (last && Math.abs(ray.relAngle - last.relAngle) < EPS) {
            if (ray.distance > last.distance) {
                deduped[deduped.length - 1] = ray;
            }
            continue;
        }
        deduped.push(ray);
    }
    return deduped;
};

const buildPolygonFromRays = (rays, charX, charY, facingRad) => {
    const sorted = sortRaysForPolygon(rays, charX, charY, facingRad);
    if (sorted.length < 2) return null;
    const points = [{ x: charX, y: charY }];
    sorted.forEach((ray) => {
        points.push({ x: ray.endX, y: ray.endY });
    });
    return {
        type: "polygon",
        points,
    };
};

const isPointInRayFan = (relAngle, dist, fan) => {
    if (!Array.isArray(fan) || fan.length === 0) return false;
    if (fan.length === 1) return dist <= fan[0].distance;
    if (relAngle < fan[0].angle || relAngle > fan[fan.length - 1].angle) return false;
    for (let i = 0; i < fan.length - 1; i += 1) {
        const a1 = fan[i].angle;
        const a2 = fan[i + 1].angle;
        if (relAngle >= a1 && relAngle <= a2) {
            const span = a2 - a1;
            if (Math.abs(span) < 1e-6) {
                return dist <= Math.max(fan[i].distance, fan[i + 1].distance);
            }
            const t = (relAngle - a1) / span;
            const maxDist = fan[i].distance * (1 - t) + fan[i + 1].distance * t;
            return dist <= maxDist;
        }
    }
    return false;
};

const getCloseRangeRadiusForChar = (char, fallbackDistance = 0) => {
    const radius = Number(char?.vision?.radius);
    if (Number.isFinite(radius) && radius > 0) return radius;
    const distance = Number(char?.visionDistance) || Number(char?.vision?.distance) || fallbackDistance;
    return distance > 0 ? distance * 0.2 : 0;
};

const buildVisionInfoForChar = (char) => {
    if (!char) return null;
    const x = Number(char?.position?.x) || 0;
    const y = Number(char?.position?.y) || 0;
    const rotation = Number(char?.rotation) || 0;
    const distance = Number(char?.visionDistance) || Number(char?.vision?.distance) || 0;
    const angle = Number(char?.visionArc) || Number(char?.vision?.angle) || 0;
    const closeRadius = getCloseRangeRadiusForChar(char, distance);
    const rawRays = Array.isArray(char?.visionRays) ? char.visionRays : [];
    const rays = splitVisionRays(rawRays);
    const facingRad = (rotation - 90) * (Math.PI / 180);
    const peripheralSplit = splitPeripheralRaysBySide(rays.peripheral, x, y, facingRad);
    return {
        x,
        y,
        rotation,
        distance,
        angle,
        closeRadius,
        facingRad,
        rays: rawRays,
        mainFan: buildRayFan(rays.main, x, y, facingRad),
        peripheralLeftFan: buildRayFan(peripheralSplit.left, x, y, facingRad),
        peripheralRightFan: buildRayFan(peripheralSplit.right, x, y, facingRad),
    };
};

const getVisibilityForPoint = (px, py, info) => {
    if (!info) return { visibility: 0, visionType: "blocked" };
    const dx = px - info.x;
    const dy = py - info.y;
    const dist = Math.hypot(dx, dy);
    if (info.closeRadius > 0 && dist <= info.closeRadius) {
        return { visibility: 1, visionType: "closeRange" };
    }
    const relAngle = normalizeRad(Math.atan2(dy, dx) - info.facingRad);
    if (info.mainFan?.length && isPointInRayFan(relAngle, dist, info.mainFan)) {
        return { visibility: 1, visionType: "main" };
    }
    if (info.peripheralLeftFan?.length && isPointInRayFan(relAngle, dist, info.peripheralLeftFan)) {
        return { visibility: 0.5, visionType: "peripheral" };
    }
    if (info.peripheralRightFan?.length && isPointInRayFan(relAngle, dist, info.peripheralRightFan)) {
        return { visibility: 0.5, visionType: "peripheral" };
    }
    if (info.distance > 0 && dist <= info.distance) {
        const arc = info.angle > 0 ? info.angle : 360;
        const halfAngle = arc / 2;
        const angleToPoint = (Math.atan2(dy, dx) * 180) / Math.PI;
        let diff = angleToPoint - (info.rotation - 90);
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        if (Math.abs(diff) <= halfAngle) {
            return { visibility: 1, visionType: "main" };
        }
        const peripheralHalf = halfAngle / 2;
        if (Math.abs(diff) > halfAngle && Math.abs(diff) <= halfAngle + peripheralHalf) {
            return { visibility: 0.5, visionType: "peripheral" };
        }
    }
    return { visibility: 0, visionType: "blocked" };
};

const getEntityPosition = (entity) => {
    if (!entity || typeof entity !== "object") return null;
    const pos = entity.position;
    if (pos && typeof pos === "object") {
        return {
            x: Number(pos.x) || 0,
            y: Number(pos.y) || 0,
        };
    }
    if (entity.x != null || entity.y != null) {
        return {
            x: Number(entity.x) || 0,
            y: Number(entity.y) || 0,
        };
    }
    return null;
};

const getEntitySamplePoints = (entry) => {
    if (!entry || !entry.obj) return [];
    if (entry.type === "character") {
        const pos = getEntityPosition(entry.obj);
        return pos ? [pos] : [];
    }
    if (entry.type === "mapObject") {
        const bounds = getMapObjectBounds(entry.obj);
        const centerX = (Number(bounds.minX) + Number(bounds.maxX)) / 2;
        const centerY = (Number(bounds.minY) + Number(bounds.maxY)) / 2;
        const points = [
            { x: centerX, y: centerY },
            { x: Number(bounds.minX) || centerX, y: Number(bounds.minY) || centerY },
            { x: Number(bounds.minX) || centerX, y: Number(bounds.maxY) || centerY },
            { x: Number(bounds.maxX) || centerX, y: Number(bounds.minY) || centerY },
            { x: Number(bounds.maxX) || centerX, y: Number(bounds.maxY) || centerY },
        ];
        return points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    }
    const fallback = getEntityPosition(entry.obj);
    return fallback ? [fallback] : [];
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

const getRayHitVisibilityForCharacter = (entry, info) => {
    if (!entry?.obj || !info) return null;
    const rays = Array.isArray(info?.rays) ? info.rays : [];
    if (rays.length === 0) return null;
    const pos = getEntityPosition(entry.obj);
    if (!pos) return null;
    const radius = Math.max(1, (Number(entry.obj?.size) || 0) / 2);

    let sawPeripheral = false;
    for (const ray of rays) {
        const endX = Number(ray?.endX);
        const endY = Number(ray?.endY);
        let ex = endX;
        let ey = endY;
        if (!Number.isFinite(ex) || !Number.isFinite(ey)) {
            const angleDeg = Number(ray?.angle) || 0;
            const dist = Number(ray?.distance) || 0;
            const angleRad = (angleDeg * Math.PI) / 180;
            ex = info.x + Math.cos(angleRad) * dist;
            ey = info.y + Math.sin(angleRad) * dist;
        }
        if (!Number.isFinite(ex) || !Number.isFinite(ey)) continue;
        if (doesRayHitCircle(info.x, info.y, ex, ey, pos.x, pos.y, radius)) {
            if (!ray?.isPeripheral) {
                return { visibility: 1, visionType: "main" };
            }
            sawPeripheral = true;
        }
    }
    if (sawPeripheral) return { visibility: 0.5, visionType: "peripheral" };
    return null;
};

const getVisibilityForEntity = (entry, info) => {
    if (entry?.type === "character") {
        const rayHit = getRayHitVisibilityForCharacter(entry, info);
        if (rayHit) return rayHit;
    }
    const points = getEntitySamplePoints(entry);
    if (!points.length) return { visibility: 0, visionType: "blocked" };
    let best = { visibility: 0, visionType: "blocked" };
    for (const point of points) {
        const result = getVisibilityForPoint(point.x, point.y, info);
        if (result.visibility > best.visibility) {
            best = result;
            if (best.visibility >= 1) break;
        }
    }
    return best;
};

function GameComponent() {
    const socket = useContext(SocketContext);
    const navigate = useNavigate();
    const { gameID, sessionID } = useParams();
    const playerID = localStorage.getItem("player_ID");

    const safeSessionID = sessionID || sessionStorage.getItem("session_ID") || "default";

    const {
    selectedChar,
    selectCharacter,
    fogEnabled,
    characters,
    lastMouse,
    setLastMouse,
    camera,
    worldMouseCoords,
    mapObjects,
    mapGeometry,
    addMapObject,
    updateMapObject,
    deleteMapObject,
    updateCharacter,
    moveCharacter,
    isDM,
    setIsDM,
    backgroundKey,
    floorTypes,
    replaceFloorTypes,
    lighting,
    currentZLevel,
    stepZLevelUp,
    stepZLevelDown,
    mapObjectPlacement,
    clearMapObjectPlacement,
    placePendingMapObjectAt,
    characterPlacement,
    clearCharacterPlacement,
    lightPlacement,
    placeLightAt,
    clearLightPlacement,
    loadGameSnapshot,
    } = useGame();

    // Helper that wraps loadGameSnapshot to also restore fog explored/last-seen data
    const applyLoadedSnapshot = useCallback((snapshot)  => {
        try {
            if (snapshot && typeof snapshot === 'object') {
                const hasVisionPayload =
                    Object.prototype.hasOwnProperty.call(snapshot, "visionMaps") ||
                    Object.prototype.hasOwnProperty.call(snapshot, "exploredAreas") ||
                    Object.prototype.hasOwnProperty.call(snapshot, "lastSeenEntities");

                if (hasVisionPayload) {
                    if (Array.isArray(snapshot.exploredAreas)) {
                        exploredAreasRef.current = snapshot.exploredAreas;
                    } else {
                        exploredAreasRef.current = [];
                    }
                    if (snapshot.lastSeenEntities && typeof snapshot.lastSeenEntities === 'object') {
                        lastSeenRef.current = snapshot.lastSeenEntities;
                    } else {
                        lastSeenRef.current = {};
                    }
                    let normalizedMaps = normalizeVisionMapsFromSnapshot(snapshot);
                    if (Array.isArray(snapshot.characters)) {
                        normalizedMaps = trimVisionMapsForCharacters(normalizedMaps, snapshot.characters);
                    }
                    visionMapsRef.current = normalizedMaps;
                }

                const nextFovMode = String(snapshot?.fovMode || "").trim();
                if (nextFovMode) {
                    setFovMode(nextFovMode);
                }
                const snapshotRayCount = Number(snapshot?.visionRayCount);
                if (Number.isFinite(snapshotRayCount)) {
                    setVisionRayCount((prev) => (prev === snapshotRayCount ? prev : snapshotRayCount));
                }
                if (snapshot.journalState) {
                    setJournalState(snapshot.journalState);
                }
                if (snapshot.questState && typeof snapshot.questState === "object") {
                    setQuestState(snapshot.questState);
                }
            }
        } catch (e) {
            // ignore
        }
        loadGameSnapshot(snapshot);
    }, [loadGameSnapshot]);

    const [sideWidth, setSideWidth] = useState(320);
    const [dragging, setDragging] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const contextMenuRef = useRef(null);
    const [contextTabTrails, setContextTabTrails] = useState({});
    const [activeContextTab, setActiveContextTab] = useState("action");
    const [characterActionCache, setCharacterActionCache] = useState({});
    const [loadingActionCharacterId, setLoadingActionCharacterId] = useState("");
    const [selectedEntity, setSelectedEntity] = useState(null);
    const [dragTarget, setDragTarget] = useState(null);
    const [rotationDrag, setRotationDrag] = useState(null);
    const [gameContextError, setGameContextError] = useState("");
    const [loadingGameContext, setLoadingGameContext] = useState(true);
    const [placementDrag, setPlacementDrag] = useState(null);
    const [autoSaveStatus, setAutoSaveStatus] = useState("");
    const [turnNumber, setTurnNumber] = useState(1);
    const [infoPanels, setInfoPanels] = useState({});       // key: "type:id" → { x, y, type, id }
    const [showStatusPanel, setShowStatusPanel] = useState(false);
    const [contextMenuPos, setContextMenuPos] = useState(null);
    const [stagedAction, setStagedAction] = useState(null);
    const [journalState, setJournalState] = useState({ documents: [], groups: [] });
    const [questState, setQuestState] = useState({ quests: [] });

    // Top info bar position & drag state (DM can reposition)
    const [topBarPos, setTopBarPos] = useState({ x: 12, y: 12 });
    const [activeTopBarDrag, setActiveTopBarDrag] = useState(null);

    const handleStageAction = useCallback(async (characterId, actionMeta, contextWorld) => {
        if (!socket || !playerID || !gameID) return;
        
        const payload = {
            playerID,
            campaignID: gameID,
            characterID: characterId,
            actionPath: actionMeta.path || actionMeta.actionPath,
            actionId: actionMeta.id,
            actionType: actionMeta.actionType || actionMeta.tab,
            params: {
                position: contextWorld ? { x: Math.round(contextWorld.x), y: Math.round(contextWorld.y) } : undefined,
                targetId: contextWorld?.targetId
            }
        };

        const response = await emitWithAck(socket, "campaign_stageAction", payload);
        if (response?.success) {
            setStagedAction({ characterId, description: actionMeta.name || "Action" });
        }
    }, [socket, playerID, gameID]);

    const handleCommitAction = useCallback(async () => {
        if (!stagedAction || !socket) return;
        const response = await emitWithAck(socket, "campaign_commitAction", {
            campaignID: gameID, characterID: stagedAction.characterId
        });

        if (response?.success) {
            const snapshot = response?.engineState?.snapshot;
            if (snapshot) {
                if (snapshot.lightingPolygons) {
                    latestSnapshotRef.current.lightingPolygons = snapshot.lightingPolygons;
                }
                applyingServerStateRef.current = true;
                skipNextAutoSaveRef.current = true;
                applyLoadedSnapshot(snapshot);
            }
        } else if (response?.message) {
            setGameContextError(response.message);
        }

        setStagedAction(null);
        setMovementPreview(null);
    }, [stagedAction, socket, gameID, applyLoadedSnapshot]);

    const handleCancelAction = useCallback(async () => {
        if (!stagedAction || !socket) return;
        await emitWithAck(socket, "campaign_cancelAction", {
            campaignID: gameID, characterID: stagedAction.characterId
        });
        setStagedAction(null);
        setMovementPreview(null);
    }, [stagedAction, socket, gameID]);

    
    useEffect(() => {
        if (!activeTopBarDrag) return undefined;
        const onMove = (e) => {
            const x = e.clientX - activeTopBarDrag.offsetX;
            const y = e.clientY - activeTopBarDrag.offsetY;
            const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
            const maxX = Math.max(8, window.innerWidth - 160);
            const maxY = Math.max(8, window.innerHeight - 40);
            setTopBarPos({ x: clamp(x, 8, maxX), y: clamp(y, 8, maxY) });
        };
        const onUp = () => setActiveTopBarDrag(null);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [activeTopBarDrag]);
    // Status & Combat panel positions and drag state
    const [statusPanelPos, setStatusPanelPos] = useState({ x: 12, y: 48 });
    const [combatPanelPos, setCombatPanelPos] = useState({ x: 12, y: 120 });
    const [activeStatusDrag, setActiveStatusDrag] = useState(null);
    const [activeCombatDrag, setActiveCombatDrag] = useState(null);

    // Load saved positions
    useEffect(() => {
        try {
            const s = localStorage.getItem("cc_statusPanelPos");
            const c = localStorage.getItem("cc_combatPanelPos");
            if (s) setStatusPanelPos(JSON.parse(s));
            if (c) setCombatPanelPos(JSON.parse(c));
        } catch (e) {
            // ignore
        }
    }, []);

    // Drag handlers for status panel
    useEffect(() => {
        if (!activeStatusDrag) return undefined;
        const onMove = (e) => {
            const x = e.clientX - activeStatusDrag.offsetX;
            const y = e.clientY - activeStatusDrag.offsetY;
            const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
            const maxX = Math.max(8, window.innerWidth - 200);
            const maxY = Math.max(8, window.innerHeight - 80);
            setStatusPanelPos({ x: clamp(x, 8, maxX), y: clamp(y, 8, maxY) });
        };
        const onUp = () => setActiveStatusDrag(null);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [activeStatusDrag]);

    // Drag handlers for combat panel
    useEffect(() => {
        if (!activeCombatDrag) return undefined;
        const onMove = (e) => {
            const x = e.clientX - activeCombatDrag.offsetX;
            const y = e.clientY - activeCombatDrag.offsetY;
            const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
            const maxX = Math.max(8, window.innerWidth - 220);
            const maxY = Math.max(8, window.innerHeight - 120);
            setCombatPanelPos({ x: clamp(x, 8, maxX), y: clamp(y, 8, maxY) });
        };
        const onUp = () => setActiveCombatDrag(null);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [activeCombatDrag]);

    // Persist positions
    useEffect(() => {
        try {
            localStorage.setItem("cc_statusPanelPos", JSON.stringify(statusPanelPos));
            localStorage.setItem("cc_combatPanelPos", JSON.stringify(combatPanelPos));
        } catch (e) {
            // ignore
        }
    }, [statusPanelPos, combatPanelPos]);
    const [contextMenuDragOffset, setContextMenuDragOffset] = useState(null);
    const [blockedMovePreview, setBlockedMovePreview] = useState(null);
    const [activeDragObject, setActiveDragObject] = useState(null);
    const [resizeTarget, setResizeTarget] = useState(null);
    const [controlledCharacterIDs, setControlledCharacterIDs] = useState([]);
    const [characterAssignments, setCharacterAssignments] = useState([]);
    const [fps, setFps] = useState(0);
    const [movementPreview, setMovementPreview] = useState(null); // { characterId, ghostX, ghostY, walkableRadius }
	    const activeAnimationsRef = useRef({});
	    const exploredAreasRef = useRef([]);
	    const lastSeenRef = useRef({});
	    const visionMapsRef = useRef({});

    const handleExportSave = useCallback(() => {
        if (!latestSnapshotRef.current) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(latestSnapshotRef.current, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `campaign_save_${new Date().toISOString()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }, []);

    const handleImportSave = useCallback(async (event) => {
        const file = event.target.files[0];
        if (!file || !socket || !playerID || !gameID) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const snapshot = JSON.parse(e.target.result);
                const response = await emitWithAck(socket, "campaign_saveGame", {
                    playerID,
                    campaignID: gameID,
                    name: `Imported Save ${new Date().toLocaleString()}`,
                    description: "Imported from file",
                    snapshot,
                    makeActive: true
                });
                
                if (response?.success) {
                    const newSnapshot = response.engineState?.snapshot || snapshot;
                    if (newSnapshot.lightingPolygons) {
                        latestSnapshotRef.current.lightingPolygons = newSnapshot.lightingPolygons;
                    }
                    applyingServerStateRef.current = true;
                    skipNextAutoSaveRef.current = true;
                    applyLoadedSnapshot(newSnapshot);
                }
            } catch (err) {
                console.error("Import failed", err);
                setGameContextError("Failed to import save file");
            }
        };
        reader.readAsText(file);
    }, [socket, playerID, gameID]);


    


    const [cursorLightLevel, setCursorLightLevel] = useState(1);
    const [selectionBox, setSelectionBox] = useState(null); // { startX, startY, currentX, currentY }
    const [multiSelectedIds, setMultiSelectedIds] = useState(new Set());
    const [activeViewId, setActiveViewId] = useState("default");
    const [viewMenuOpen, setViewMenuOpen] = useState(false);
    const [lastServerUpdate, setLastServerUpdate] = useState(null);
    const [visionRayCount, setVisionRayCount] = useState(256); // Number of test rays for vision cone
    const [fovMode, setFovMode] = useState("party");
    const [debugLightSample, setDebugLightSample] = useState(null);
    const [visionDebug, setVisionDebug] = useState(null);

    const lastClickRef = useRef({ time: 0, id: null });
    const activeDragObjectRef = useRef(null);
    // Combat state
    const [combatActive, setCombatActive] = useState(false);
    const [combatTurnOrder, setCombatTurnOrder] = useState([]);
    const [currentCombatCharacterId, setCurrentCombatCharacterId] = useState(null);
    const [combatRound, setCombatRound] = useState(1);
    const [pendingAction, setPendingAction] = useState(null); // { characterId, action, sourceWorld } for targeting mode

    const isPanning = useRef(false);
    const layerRefs = useRef({});
    const layerBindingsRef = useRef([]);
    const prevStateRef = useRef(null);
    const lightingCacheRef = useRef({});
    const fpsRef = useRef({ frames: 0, lastSampleTime: 0, value: 0 });
    const applyingServerStateRef = useRef(false);
    const skipNextAutoSaveRef = useRef(false);
    const syncingWorldRef = useRef(false);
    const autoSavingRef = useRef(false);
    const autoSaveTimerRef = useRef(null);
    const hasAutoSaveBaselineRef = useRef(false);
    const lastVisionDebugUpdateRef = useRef(0);
    const lastExploreSampleRef = useRef({});
    const pendingMoveRef = useRef(null);
    const moveSyncTimerRef = useRef(null);
    const syncingMoveRef = useRef(false);
    const pendingVisionRayCountRef = useRef(null);
    const visionRaySyncTimerRef = useRef(null);
    const latestSnapshotRef = useRef({
        mapObjects: [],
        backgroundKey: "",
        characters: [],
        floorTypes: [],
        currentZLevel: 0,
        lighting: null,
        visionMaps: {},
        fovMode: "party",
        visionRayCount: 256,
        questState: { quests: [] },
    });
    const keysPressed = useRef({
        KeyW: false,
        KeyA: false,
        KeyS: false,
        KeyD: false,
        KeyQ: false,
        KeyE: false,
    });
    const characterOwnershipById = useMemo(() => {
        const byId = new Map();
        (Array.isArray(characterAssignments) ? characterAssignments : []).forEach(
            (assignment) => {
                const characterId = toEntityID(
                    assignment?.characterId || assignment?.characterID
                );
                if (!characterId || byId.has(characterId)) return;
                byId.set(characterId, assignment);
            }
        );
        return byId;
    }, [characterAssignments]);

    // Owned = characters the player controls (assigned to them)
    const ownedCharacterIds = useMemo(() => {
        const ids = new Set();
        (controlledCharacterIDs || []).forEach((id) => {
            const normalized = toEntityID(id);
            if (normalized) ids.add(normalized);
        });
        const playerKey = toEntityID(playerID);
        if (playerKey) {
            (Array.isArray(characterAssignments) ? characterAssignments : []).forEach(
                (assignment) => {
                    if (
                        toEntityID(assignment?.playerId || assignment?.playerID) !== playerKey
                    ) {
                        return;
                    }
                    const charId = toEntityID(
                        assignment?.characterId || assignment?.characterID
                    );
                    if (charId) ids.add(charId);
                }
            );
            extractOwnedCharacterIdsFromSnapshot({ characters }, playerID).forEach((id) => {
                const normalized = toEntityID(id);
                if (normalized) ids.add(normalized);
            });
        }
        return Array.from(ids);
    }, [controlledCharacterIDs, characterAssignments, characters, playerID]);

    // Get first owned character for game actions (initiative rolls, dice, etc.)
    const primaryCharacterId = ownedCharacterIds?.[0] || null;

    // Dice roll system for combat
    const { diceRolls, showDiceGallery, closeDiceGallery } = useGameActions(
        gameID, 
        primaryCharacterId, 
        playerID
    );

    // Viewable = characters the player can see (owns + teammates)
    const viewableCharacterIds = useMemo(() => {
        const ids = new Set(ownedCharacterIds);
        // Add teammate characters - characters on the same team as player's own characters
        if (Array.isArray(characters)) {
            const playerCharacterTeams = new Set();
            ownedCharacterIds.forEach((ownedId) => {
                const ownedChar = characters.find((c) => toEntityID(c?.id) === ownedId);
                if (ownedChar?.team) {
                    playerCharacterTeams.add(String(ownedChar.team).toLowerCase());
                }
            });
            // Add all characters on same teams
            if (playerCharacterTeams.size > 0) {
                characters.forEach((char) => {
                    if (char?.team && playerCharacterTeams.has(String(char.team).toLowerCase())) {
                        ids.add(toEntityID(char.id));
                    }
                });
            }
        }
        return ids;
    }, [ownedCharacterIds, characters]);

    const controlledCharacterIdSet = useMemo(
        () => new Set((ownedCharacterIds || []).map((id) => toEntityID(id))),
        [ownedCharacterIds]
    );
    const canControlCharacterId = useCallback(
        (characterId) => isDM || controlledCharacterIdSet.has(toEntityID(characterId)),
        [isDM, controlledCharacterIdSet]
    );

    const canViewCharacterId = useCallback(
        (characterId) => isDM || viewableCharacterIds.has(toEntityID(characterId)),
        [isDM, viewableCharacterIds]
    );

    const visionSources = useMemo(
        () => resolveVisionSources(characters, ownedCharacterIds, fovMode),
        [characters, ownedCharacterIds, fovMode]
    );

    const runAutoSave = useCallback(
        async (trigger = "map_change") => {
            if (!socket || !playerID || !gameID || !isDM || loadingGameContext) return;
            if (autoSavingRef.current) return;

            autoSavingRef.current = true;
            const now = new Date();
            const snapshotSource = latestSnapshotRef.current || {};
            const triggerLabel = trigger === "turn_done" ? "turn end" : "map change";

            const response = await emitWithAck(socket, "campaign_saveGame", {
                playerID,
                campaignID: gameID,
                name: `Auto Save ${now.toLocaleString()}`,
                description: "Automatic save from active game session",
                snapshotPatch: true,
                snapshot: {
                    exploredAreas: Array.isArray(snapshotSource.exploredAreas)
                        ? snapshotSource.exploredAreas
                        : [],
                    lastSeenEntities: snapshotSource.lastSeenEntities && typeof snapshotSource.lastSeenEntities === 'object'
                        ? snapshotSource.lastSeenEntities
                        : {},
                    visionMaps: snapshotSource.visionMaps && typeof snapshotSource.visionMaps === "object"
                        ? snapshotSource.visionMaps
                        : {},
                },
                metadata: {
                    source: "autosave",
                    trigger,
                },
                makeActive: true,
                isAutoSave: true,
            });

            autoSavingRef.current = false;

            if (!response?.success) {
                setAutoSaveStatus(`Autosave failed: ${response?.message || "Unknown error"}`);
                return;
            }

            setAutoSaveStatus(`Autosaved (${triggerLabel}) ${now.toLocaleTimeString()}`);
        },
        [socket, playerID, gameID, isDM, loadingGameContext, visionRayCount]
    );

    const scheduleAutoSave = useCallback(
        (trigger = "map_change", options = {}) => {
            const immediate = Boolean(options?.immediate);
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }

            if (immediate) {
                runAutoSave(trigger);
                return;
            }

            setAutoSaveStatus("Autosave queued...");
            autoSaveTimerRef.current = setTimeout(() => {
                autoSaveTimerRef.current = null;
                runAutoSave(trigger);
            }, AUTO_SAVE_DEBOUNCE_MS);
        },
        [runAutoSave]
    );

    const handleTurnDone = useCallback(() => {
        if (!isDM) return;
        setTurnNumber((prev) => prev + 1);
        scheduleAutoSave("turn_done", { immediate: true });
    }, [isDM, scheduleAutoSave]);

    const handleStartCombat = useCallback(async () => {
        if (!isDM || !socket || !gameID || !playerID) return;

        try {
            const response = await emitWithAck(socket, "campaign_startCombat", {
                playerID,
                campaignID: gameID,
            });

            if (response?.success) {
                const gameState = response.gameState || {};
                setCombatActive(true);
                setCombatTurnOrder(gameState.turnOrder || []);
                setCurrentCombatCharacterId(gameState.currentCharacterId || null);
                setCombatRound(gameState.round || 1);
            } else if (response?.message) {
                setGameContextError((prev) => prev || response.message);
            }
        } catch (error) {
            console.error("Error starting combat:", error);
            setGameContextError((prev) => prev || "Failed to start combat");
        }
    }, [isDM, socket, gameID, playerID]);

    const handleEndTurn = useCallback(async () => {
        if (!combatActive || !socket || !gameID || !playerID) return;

        try {
            const response = await emitWithAck(socket, "campaign_endTurn", {
                playerID,
                campaignID: gameID,
            });

            if (response?.success) {
                const gameState = response.gameState || {};
                setCombatTurnOrder(gameState.turnOrder || []);
                setCurrentCombatCharacterId(gameState.currentCharacterId || null);
                setCombatRound(gameState.round || 1);
            } else if (response?.message) {
                setGameContextError((prev) => prev || response.message);
            }
        } catch (error) {
            console.error("Error ending turn:", error);
            setGameContextError((prev) => prev || "Failed to end turn");
        }
    }, [combatActive, socket, gameID, playerID]);

    const handleGetCombatState = useCallback(async () => {
        if (!socket || !gameID || !playerID) return;

        try {
            const response = await emitWithAck(socket, "campaign_getCombatState", {
                playerID,
                campaignID: gameID,
            });

            if (response?.success && response?.gameState) {
                const gameState = response.gameState;
                setCombatActive(gameState.state === "active");
                setCombatTurnOrder(gameState.turnOrder || []);
                setCurrentCombatCharacterId(gameState.currentCharacterId || null);
                setCombatRound(gameState.round || 1);
            }
        } catch (error) {
            console.error("Error getting combat state:", error);
        }
    }, [socket, gameID, playerID]);

    // Sync combat state on load
    useEffect(() => {
        if (socket && gameID && playerID) {
            handleGetCombatState();
        }
    }, [socket, gameID, playerID, handleGetCombatState]);

    useEffect(() => {
        if (!socket) return;
        const handleRemoteAnimation = (payload) => {
            const id = `net_anim_${Date.now()}_${Math.random()}`;
            activeAnimationsRef.current[id] = {
                ...payload,
                startTime: performance.now(),
                duration: payload.duration || 300,
                entityType: payload.entityType || 'character'
            };
        };
        socket.on("campaign_animation", handleRemoteAnimation);
        return () => socket.off("campaign_animation", handleRemoteAnimation);
    }, [socket]);

    useEffect(
        () => () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
            if (moveSyncTimerRef.current) {
                clearTimeout(moveSyncTimerRef.current);
                moveSyncTimerRef.current = null;
            }
        },
        []
    );

    useEffect(() => {
        const selectedBackgroundKey = String(backgroundKey || "gray").toLowerCase();
        const backgroundImage = getImage(selectedBackgroundKey);
        if (!backgroundImage) {
            camera.current.bgImage = null;
            return;
        }

        const img = new Image();
        img.src = backgroundImage;
        img.onload = () => {
            camera.current.bgImage = img;
        };
    }, [backgroundKey, camera]);

    useEffect(() => {
        let cancelled = false;

        async function bootstrapGameContext() {
            if (!socket || !playerID || !gameID) {
                if (!cancelled) {
                    setLoadingGameContext(false);
                    setGameContextError("Missing game context. Rejoin from lobby.");
                }
                return;
            }

            const response = await emitWithAck(socket, "campaign_getGameContext", {
                playerID,
                campaignID: gameID,
            });

            if (cancelled) return;

            if (!response?.success) {
                setLoadingGameContext(false);
                setIsDM(false);
                setGameContextError(response?.message || "Failed to load campaign permissions");
                return;
            }

            setLastServerUpdate(new Date());
            const canEdit = resolveDMPermission(response, playerID);
            setIsDM(canEdit);
            setGameContextError("");
            setLoadingGameContext(false);

            const assignments = Array.isArray(response?.campaign?.characterAssignments)
                ? response.campaign.characterAssignments
                : [];
            setCharacterAssignments(assignments);

            if (Array.isArray(response?.floorTypes)) {
                replaceFloorTypes(response.floorTypes);
            }

            const initialSnapshot =
                response?.engineState?.snapshot && typeof response.engineState.snapshot === "object"
                    ? response.engineState.snapshot
                    : response?.snapshot || {};
            if (initialSnapshot.lightingPolygons) {
                latestSnapshotRef.current.lightingPolygons = initialSnapshot.lightingPolygons;
            }
            if (initialSnapshot.journalState) {
                setJournalState(initialSnapshot.journalState);
            }
            if (initialSnapshot.questState && typeof initialSnapshot.questState === "object") {
                setQuestState(initialSnapshot.questState);
            }
            const assignedIds = assignments
                .filter(
                    (assignment) =>
                        toEntityID(assignment?.playerId || assignment?.playerID) ===
                        toEntityID(playerID)
                )
                .map((assignment) =>
                    toEntityID(assignment?.characterId || assignment?.characterID)
                )
                .filter(Boolean);
            const ownershipMap =
                response?.engineState?.playerOwnership ||
                response?.engineState?.snapshot?.playerOwnership;
            const ownedFromOwnership = extractOwnedCharacterIdsFromOwnershipMap(
                ownershipMap,
                playerID
            );
            const ownedFromSnapshot = extractOwnedCharacterIdsFromSnapshot(
                initialSnapshot,
                playerID
            );
            setControlledCharacterIDs(
                mergeUniqueIds(assignedIds, ownedFromOwnership, ownedFromSnapshot)
            );
            applyingServerStateRef.current = true;
            skipNextAutoSaveRef.current = true;
            applyLoadedSnapshot(initialSnapshot);
        }

        bootstrapGameContext();

        return () => {
            cancelled = true;
        };
    }, [socket, playerID, gameID, setIsDM, loadGameSnapshot, replaceFloorTypes]);

    useEffect(() => {
        if (!socket || !gameID) return undefined;

        const handleServerWorldUpdate = (payload = {}) => {
            if (String(payload?.campaignID || "") !== String(gameID)) return;
            const snapshot =
                payload?.engineState?.snapshot && typeof payload.engineState.snapshot === "object"
                    ? payload.engineState.snapshot
                    : null;
            if (!snapshot) return;

            console.log('[CLIENT] Received server state update (revision:', payload?.engineState?.revision, ')');
            setLastServerUpdate(new Date());

            const ownershipMap =
                payload?.engineState?.playerOwnership ||
                payload?.engineState?.snapshot?.playerOwnership;
            const ownedFromOwnership = extractOwnedCharacterIdsFromOwnershipMap(
                ownershipMap,
                playerID
            );
            const ownedFromSnapshot = extractOwnedCharacterIdsFromSnapshot(
                snapshot,
                playerID
            );
            if (ownedFromOwnership.length || ownedFromSnapshot.length) {
                setControlledCharacterIDs((prev) =>
                    mergeUniqueIds(prev, ownedFromOwnership, ownedFromSnapshot)
                );
            }

            if (Array.isArray(payload?.floorTypes)) {
                replaceFloorTypes(payload.floorTypes);
            }
            if (snapshot.lightingPolygons) {
                latestSnapshotRef.current.lightingPolygons = snapshot.lightingPolygons;
            }
            
            // Force client to use server data as authoritative source
            applyingServerStateRef.current = true;
            skipNextAutoSaveRef.current = true;
            
            // Apply server snapshot - this replaces all client state with server data
            applyLoadedSnapshot(snapshot);
            
            console.log('[CLIENT] Applied server snapshot - characters:', snapshot.characters?.length);
        };

        socket.on("campaign_gameStateUpdated", handleServerWorldUpdate);
        return () => {
            socket.off("campaign_gameStateUpdated", handleServerWorldUpdate);
        };
    }, [socket, gameID, playerID, loadGameSnapshot, replaceFloorTypes]);

    useEffect(() => {
        if (!socket || !gameID) return undefined;

        const handleJournalUpdate = (payload = {}) => {
            if (String(payload?.campaignID || "") !== String(gameID)) return;
            if (payload?.journalState && typeof payload.journalState === "object") {
                setJournalState(payload.journalState);
            }
        };

        socket.on("campaign_journalStateUpdated", handleJournalUpdate);
        return () => {
            socket.off("campaign_journalStateUpdated", handleJournalUpdate);
        };
    }, [socket, gameID]);

    useEffect(() => {
        if (!socket || !playerID || !gameID || !isDM || loadingGameContext) return undefined;
        if (applyingServerStateRef.current) {
            applyingServerStateRef.current = false;
            return undefined;
        }

        const timer = setTimeout(async () => {
            if (syncingWorldRef.current) return;
            syncingWorldRef.current = true;

            const response = await emitWithAck(socket, "campaign_gameSyncWorld", {
                playerID,
                campaignID: gameID,
                statePatch: {
                    mapObjects,
                    backgroundKey,
                    characters,
                    floorTypes,
                    lighting,
                    journalState,
                    questState,
                },
            });
            syncingWorldRef.current = false;

            if (!response?.success) {
                if (response?.message) {
                    setGameContextError((prev) => prev || response.message);
                }
                return;
            }

            const snapshot =
                response?.engineState?.snapshot && typeof response.engineState.snapshot === "object"
                    ? response.engineState.snapshot
                    : null;
            if (!snapshot) return;

            setGameContextError("");

            if (Array.isArray(response?.floorTypes)) {
                replaceFloorTypes(response.floorTypes);
            }
            if (snapshot.lightingPolygons) {
                latestSnapshotRef.current.lightingPolygons = snapshot.lightingPolygons;
            }
            applyingServerStateRef.current = true;
            skipNextAutoSaveRef.current = true;
            applyLoadedSnapshot(snapshot);
        }, 160);

        return () => clearTimeout(timer);
    }, [
        socket,
        playerID,
        gameID,
        isDM,
        loadingGameContext,
        mapObjects,
        backgroundKey,
        characters,
        floorTypes,
        lighting,
        questState,
        journalState,
        loadGameSnapshot,
        replaceFloorTypes,
    ]);

    useEffect(() => {
        if (!socket || !playerID || !gameID || !isDM || loadingGameContext) return;

        if (skipNextAutoSaveRef.current) {
            skipNextAutoSaveRef.current = false;
            hasAutoSaveBaselineRef.current = true;
            return;
        }

        if (!hasAutoSaveBaselineRef.current) {
            hasAutoSaveBaselineRef.current = true;
            return;
        }

        scheduleAutoSave("map_change");
    }, [
        socket,
        playerID,
        gameID,
        isDM,
        loadingGameContext,
        mapObjects,
        backgroundKey,
        characters,
        floorTypes,
        lighting,
        currentZLevel,
        journalState,
        questState,
        scheduleAutoSave,
    ]);

    const formatCanvas = (canvas) => {
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR);
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return ctx;
    };

    useEffect(() => {
        const resizeAllCanvases = () => {
            Object.values(layerRefs.current).forEach((canvas) => {
                if (canvas) formatCanvas(canvas);
            });
        };

        resizeAllCanvases();
        window.addEventListener("resize", resizeAllCanvases);
        return () => window.removeEventListener("resize", resizeAllCanvases);
    }, []);

    const worldToScreen = (worldX, worldY) => ({
        x: worldX * camera.current.zoom - camera.current.x,
        y: worldY * camera.current.zoom - camera.current.y,
    });

    const screenToWorld = (screenX, screenY) => ({
        x: (screenX + camera.current.x) / camera.current.zoom,
        y: (screenY + camera.current.y) / camera.current.zoom,
    });

    const getWorldFromMouseEvent = (event) => {
        const canvas = layerRefs.current.background;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        return screenToWorld(screenX, screenY);
    };

    const getScreenFromMouseEvent = (event) => {
        const canvas = layerRefs.current.background;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    };

    const isVisible = (x, y) => {
        if (!fogEnabled) return true;
        if (!Array.isArray(visionSources) || visionSources.length === 0) return false;

        for (const char of visionSources) {
            const info = buildVisionInfoForChar(char);
            if (!info) continue;
            const result = getVisibilityForPoint(Number(x) || 0, Number(y) || 0, info);
            if (result.visibility > 0) return true;
        }

        return false;
    };

    const visibleMapObjects = useMemo(() => {
        if (!fogEnabled || isDM) return mapObjects;
        const sources = Array.isArray(visionSources) ? visionSources : [];
        if (!sources.length) return [];

        return mapObjects.filter((obj) => {
            // Trust server visibility if available (handles complex occlusion/lighting)
            if (obj._visionData?.isVisible || (obj._visionData?.visibility || 0) > 0) return true;

            // Check if object is hit by any vision ray from any player character
            const hitByRay = sources.some((char) =>
                (char.visionRays || []).some((ray) => 
                    isPointInsideMapObject(ray.endX, ray.endY, obj, 10)
                )
            );
            if (hitByRay) return true;

            const objX = Number(obj?.x) || 0;
            const objY = Number(obj?.y) || 0;
            const objRadius = getObjectVisibilityRadius(obj);

            return sources.some((char) => {
                const cx = Number(char?.position?.x) || 0;
                const cy = Number(char?.position?.y) || 0;
                const dx = objX - cx;
                const dy = objY - cy;
                const dist = Math.hypot(dx, dy);
                const visionDistance = Number(char?.visionDistance) || 150;
                if (dist > visionDistance + objRadius) return false;

                const angleToPoint = (Math.atan2(dy, dx) * 180) / Math.PI;
                let angleDiff = angleToPoint - getFacingAngle(char.rotation);
                while (angleDiff > 180) angleDiff -= 360;
                while (angleDiff < -180) angleDiff += 360;

                const arc = Math.max(0, Number(char?.visionArc) || 0);
                const peripheralArc = arc / 4;
                const arcPadding =
                    dist > 0
                        ? (Math.asin(Math.min(objRadius / dist, 1)) * 180) / Math.PI
                        : 180;
                return Math.abs(angleDiff) <= arc / 2 + peripheralArc + arcPadding;
            });
        });
    }, [mapObjects, visionSources, fogEnabled, isDM]);

    const geometryObjects = useMemo(() => {
        if (isDM) return mapObjects;
        if (Array.isArray(mapGeometry)) return mapGeometry;
        return mapObjects;
    }, [isDM, mapObjects, mapGeometry]);

    const findCharacterAt = (worldX, worldY, includeHidden = false) => {
        const controlledIds = new Set((ownedCharacterIds || []).map((id) => toEntityID(id)));
        
        const list = includeHidden 
            ? characters 
            : characters.filter((char) => {
                // DMs can always select everything
                if (isDM) return true;
                
                // Players can always select their own characters (allows placement and control)
                if (controlledIds.has(toEntityID(char.id))) return true;
                
                // On initial load (no owned characters yet), allow selecting any character
                // This prevents players from being stuck unable to place their first character
                if (controlledIds.size === 0 && characters.length > 0) return true;
                
                // For other cases, check fog of war visibility
                return isVisible(char.position.x, char.position.y);
            });
        
        for (let i = list.length - 1; i >= 0; i -= 1) {
            const char = list[i];
            const dx = worldX - char.position.x;
            const dy = worldY - char.position.y;
            const radius = Math.max(1, Number(char.size) || 0) / 2;
            if (dx * dx + dy * dy <= radius * radius) {
                return char;
            }
        }
        return null;
    };

    const findFacingHandleAtScreenPoint = useCallback(
        (screenX, screenY) => {
            if (!camera?.current) return null;
            const zoom = Number(camera.current.zoom) || 1;
            for (let i = characters.length - 1; i >= 0; i -= 1) {
                const char = characters[i];
                const charX = Number(char?.position?.x) || 0;
                const charY = Number(char?.position?.y) || 0;
                const center = worldToScreen(charX, charY);
                const radius = Math.max(4, ((Number(char?.size) || 30) / 2) * zoom);
                const facingRad = (getFacingAngle(char?.rotation) * Math.PI) / 180;
                const dotDistance = radius + FACE_DOT_OFFSET_PX;
                const dotX = center.x + Math.cos(facingRad) * dotDistance;
                const dotY = center.y + Math.sin(facingRad) * dotDistance;
                const dx = screenX - dotX;
                const dy = screenY - dotY;
                if (dx * dx + dy * dy <= FACE_DOT_HIT_RADIUS_PX * FACE_DOT_HIT_RADIUS_PX) {
                    return char;
                }
            }
            return null;
        },
        [camera, characters]
    );

    const activeMapObjects = useMemo(
        () => visibleMapObjects.filter((obj) => getObjectZLevel(obj) === currentZLevel),
        [visibleMapObjects, currentZLevel]
    );

    const collisionObjects = useMemo(() => {
        return mapObjects.filter((obj) => {
            const terrainType = String(obj?.terrainType || "").toLowerCase();
            if (terrainType === "floor") return false;

            const level = getObjectZLevel(obj);
            // Objects on current level block
            if (level === currentZLevel) return true;

            // Objects from below block if they are tall enough
            if (level < currentZLevel) {
                const elevHeight = Math.max(0, Number(obj?.elevationHeight) || 0);
                const topZLevel = level + Math.floor(elevHeight / HEIGHT_UNITS_PER_ZLEVEL);
                return topZLevel >= currentZLevel;
            }

            return false;
        });
    }, [mapObjects, currentZLevel]);

const tallSolidsFromBelow = useMemo(() => {
    return visibleMapObjects.filter((obj) => {
      const level       = getObjectZLevel(obj);
      if (level >= currentZLevel) return false;
      const terrainType = String(obj?.terrainType || "").toLowerCase();
      if (terrainType === "floor") return false;
      const elevHeight  = Math.max(0, Number(obj?.elevationHeight) || 0);
      const topZLevel   = level + Math.floor(elevHeight / HEIGHT_UNITS_PER_ZLEVEL);
      return topZLevel >= currentZLevel;
    });
  }, [visibleMapObjects, currentZLevel]);


    const floorTypesByID = useMemo(() => {
        const byID = new Map();
        (Array.isArray(floorTypes) ? floorTypes : []).forEach((entry) => {
            const id = String(entry?.id || "").trim();
            if (!id || byID.has(id)) return;
            byID.set(id, entry);
        });
        return byID;
    }, [floorTypes]);

const findInteractionTargetAt = (worldX, worldY, includeHiddenCharacters = false) => {
    const characterTarget = findCharacterAt(worldX, worldY, includeHiddenCharacters);
    if (characterTarget) {
      return { type: "character", id: characterTarget.id };
    }

    // Search active-level objects first, then tall objects poking up from below.
    const mapObjectTarget = findTopMapObjectAt(
      worldX, worldY, [...activeMapObjects, ...tallSolidsFromBelow]
    );
    if (mapObjectTarget) {
      return { type: "mapObject", id: mapObjectTarget.id };
    }

    return null;
  };


    const selectedEntityData = useMemo(() => {
        if (!selectedEntity?.type) return null;

        if (selectedEntity.type === "character") {
            const character = characters.find(
                (char) => toEntityID(char?.id) === toEntityID(selectedEntity.id)
            );
            if (!character) return null;
            return {
                type: "character",
                id: character.id,
                entity: character,
            };
        }

        if (selectedEntity.type === "mapObject") {
            const object = mapObjects.find(
                (obj) => toEntityID(obj?.id) === toEntityID(selectedEntity.id)
            );
            if (!object) return null;
            const floorType = floorTypesByID.get(String(object?.floorTypeId || "").trim()) || null;
            return {
                type: "mapObject",
                id: object.id,
                entity: object,
                floorType,
            };
        }

        return null;
    }, [selectedEntity, characters, mapObjects, floorTypesByID]);

    const hiddenMapObjectIds = useMemo(() => new Set(), []);

    useEffect(() => {
        latestSnapshotRef.current = {
            mapObjects,
            backgroundKey,
            characters,
            floorTypes,
            currentZLevel,
            lightingPolygons: latestSnapshotRef.current.lightingPolygons,
            lighting,
            exploredAreas: exploredAreasRef.current,
            lastSeenEntities: lastSeenRef.current,
            visionMaps: visionMapsRef.current,
            fovMode,
            visionRayCount,
            journalState,
            questState,
        };
    }, [mapObjects, backgroundKey, characters, floorTypes, currentZLevel, lighting, journalState, questState, fovMode, visionRayCount]);

    useEffect(() => {
        if (!selectedEntity) return;
        if (selectedEntityData) return;
        setSelectedEntity(null);
    }, [selectedEntity, selectedEntityData]);

    const clampInfoPanelPosition = useCallback(
        (x, y) => {
            const maxX = Math.max(
                INFO_PANEL_MIN_LEFT,
                window.innerWidth - sideWidth - INFO_PANEL_WIDTH - INFO_PANEL_MIN_LEFT
            );
            const maxY = Math.max(
                INFO_PANEL_MIN_TOP,
                window.innerHeight - INFO_PANEL_MAX_BOTTOM_PADDING
            );
            return {
                x: Math.max(INFO_PANEL_MIN_LEFT, Math.min(Math.round(x), Math.round(maxX))),
                y: Math.max(INFO_PANEL_MIN_TOP, Math.min(Math.round(y), Math.round(maxY))),
            };
        },
        [sideWidth]
    );


// Sync position when context menu first opens
useEffect(() => {
    if (!contextMenu) { setContextMenuPos(null); return; }
    setContextMenuPos({ x: contextMenu.x, y: contextMenu.y });
}, [contextMenu]);

// Context menu dragging
useEffect(() => {
    if (!contextMenuDragOffset) return undefined;
    const onMouseMove = (e) => {
        setContextMenuPos({
            x: e.clientX - contextMenuDragOffset.x,
            y: e.clientY - contextMenuDragOffset.y,
        });
    };
    const onMouseUp = () => setContextMenuDragOffset(null);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
    };
}, [contextMenuDragOffset]);

    // Update light level when scene changes (even if mouse is static)
    useEffect(() => {
        if (!lastMouse || (lastMouse.x === 0 && lastMouse.y === 0)) return;
        if (!layerRefs.current.background) return;

        const world = getWorldFromMouseEvent({ clientX: lastMouse.x, clientY: lastMouse.y });
        if (world) {
            const lightVal = calculateLightAtPoint(world.x, world.y, {
                lighting,
                currentZLevel,
                lightingPolygons: latestSnapshotRef.current.lightingPolygons
            });
            setCursorLightLevel(lightVal);
        }
    }, [lighting, currentZLevel, mapObjects, lastMouse]);

    useEffect(() => {
        let raf;

        const loop = () => {
            const now =
                typeof performance !== "undefined" && typeof performance.now === "function"
                    ? performance.now()
                    : Date.now();
            const fpsState = fpsRef.current;
            if (!fpsState.lastSampleTime) fpsState.lastSampleTime = now;
            fpsState.frames += 1;
            const elapsed = now - fpsState.lastSampleTime;
            if (elapsed >= 500) {
                const nextFps = Math.round((fpsState.frames * 1000) / elapsed);
                if (nextFps !== fpsState.value) {
                    fpsState.value = nextFps;
                    setFps(nextFps);
                }
                fpsState.frames = 0;
                fpsState.lastSampleTime = now;
            }

            const missingCanvas = GAME_LAYER_REGISTRY.some((entry) => !layerRefs.current[entry.name]);
            if (missingCanvas) {
                raf = requestAnimationFrame(loop);
                return;
            }

            if (!camera?.current) {
                raf = requestAnimationFrame(loop);
                return;
            }

            const needsRebind =
                layerBindingsRef.current.length !== GAME_LAYER_REGISTRY.length ||
                GAME_LAYER_REGISTRY.some((entry, index) => {
                    const binding = layerBindingsRef.current[index];
                    const canvas = layerRefs.current[entry.name];
                    return !binding || binding.canvas !== canvas || !binding.ctx;
                });

            if (needsRebind) {
                layerBindingsRef.current = bindLayerCanvases(
                    GAME_LAYER_REGISTRY,
                    layerRefs.current
                );
            }

            const layers = layerBindingsRef.current;

            const cameraSnapshot = {
                x: Number(camera.current.x) || 0,
                y: Number(camera.current.y) || 0,
                zoom: Number(camera.current.zoom) || 1,
                bgImage: camera.current.bgImage || null,
            };
            const selectedMapObjectID =
                selectedEntity?.type === "mapObject" ? toEntityID(selectedEntity.id) : "";

            const currentState = {
                bgImage: cameraSnapshot.bgImage,
                backgroundKey,
                camera: cameraSnapshot,
                mapObjects,
                mapGeometry: geometryObjects,
                visibleMapObjects,
                characters,
                selectedChar,
                selectedCharacterIds: multiSelectedIds,
                fogEnabled,
                isDM,
                controlledCharacterIDs: ownedCharacterIds,
                floorTypes,
                currentZLevel,
                selectedMapObjectID,
                blockedMovePreview: null, // Rendered via SVG instead of canvas
                activeDragObject,
                hiddenMapObjectIds,
                lightingPolygons: latestSnapshotRef.current.lightingPolygons,
                lighting,
                lightingCache: lightingCacheRef.current,
                showResizeHandles: isDM,
                visionRayCount,
                debugLightSample,
            };

            let animatedCharacters = currentState.characters;
            const activeAnims = activeAnimationsRef.current;
            const animKeys = Object.keys(activeAnims);

            if (animKeys.length > 0) {
                const charMap = new Map(animatedCharacters.map(c => [toEntityID(c.id), c]));
                
                animKeys.forEach(key => {
                    const anim = activeAnims[key];
                    const elapsed = now - anim.startTime;
                    const progress = Math.min(1, elapsed / (anim.duration || 300));
                    
                    if (anim.entityType === 'character') {
                        const char = charMap.get(toEntityID(anim.entityId));
                        if (char) {
                            const handler = ANIMATION_REGISTRY[anim.type] || ANIMATION_REGISTRY.movement;
                            const updatedChar = handler(char, progress, anim.params || {});
                            charMap.set(toEntityID(anim.entityId), updatedChar);
                        }
                    }
                    
                    if (progress >= 1) {
                        delete activeAnims[key];
                    }
                });
                
                animatedCharacters = Array.from(charMap.values());
            }

            let activeVisionSources = [];
            let activeVisionVisibility = {};
            let ghostCharacters = [];
            let ghostMapObjects = [];

            // Update per-character vision maps and combine for current view
            try {
                const allCharacters = Array.isArray(animatedCharacters) ? animatedCharacters : [];
                const allMapObjects = Array.isArray(mapObjects) ? mapObjects : [];
                const allEntities = [];
                allCharacters.forEach((char) => {
                    const id = toEntityID(char?.id);
                    if (!id) return;
                    allEntities.push({
                        type: "character",
                        id,
                        key: makeVisionEntityKey("character", id),
                        obj: char,
                    });
                });
                allMapObjects.forEach((obj) => {
                    const id = toEntityID(obj?.id);
                    if (!id) return;
                    allEntities.push({
                        type: "mapObject",
                        id,
                        key: makeVisionEntityKey("mapObject", id),
                        obj,
                    });
                });

                const visionMaps =
                    visionMapsRef.current && typeof visionMapsRef.current === "object"
                        ? visionMapsRef.current
                        : {};
                const nowTs = Date.now();
                const visionInfoCache = new Map();

                const getVisionInfo = (char) => {
                    const charId = toEntityID(char?.id);
                    if (!charId) return null;
                    if (visionInfoCache.has(charId)) return visionInfoCache.get(charId);
                    const info = buildVisionInfoForChar(char);
                    visionInfoCache.set(charId, info);
                    return info;
                };

                allCharacters.forEach((char) => {
                    const charId = toEntityID(char?.id);
                    if (!charId) return;
                    const info = getVisionInfo(char);
                    if (!info) return;
                    const memoryLimit = getMemoryLimitForChar(char);

                    const map =
                        visionMaps[charId] && typeof visionMaps[charId] === "object"
                            ? visionMaps[charId]
                            : {};
                    if (!Array.isArray(map.exploredAreas)) map.exploredAreas = [];
                    if (!map.lastSeenEntities || typeof map.lastSeenEntities !== "object") map.lastSeenEntities = {};

                    const exploredArc = info.angle > 0 ? info.angle : 360;
                    if (info.distance > 0 && exploredArc > 0) {
                        const lastSample = lastExploreSampleRef.current[charId];
                        const dx = info.x - (Number.isFinite(lastSample?.x) ? lastSample.x : info.x);
                        const dy = info.y - (Number.isFinite(lastSample?.y) ? lastSample.y : info.y);
                        const distMoved = Math.hypot(dx, dy);
                        const rawRotDelta = Math.abs(
                            normalizeAngleDegrees(info.rotation - (Number.isFinite(lastSample?.rotation) ? lastSample.rotation : info.rotation))
                        );
                        const rotDelta = Math.min(rawRotDelta, 360 - rawRotDelta);
                        const shouldSample =
                            !lastSample || distMoved >= VISION_MAP_MIN_MOVE || rotDelta >= VISION_MAP_MIN_ROT;

                        if (shouldSample) {
                            const rays = Array.isArray(char?.visionRays) ? char.visionRays : [];
                            const { main, peripheral } = splitVisionRays(rays);
                            const peripheralSplit = splitPeripheralRaysBySide(
                                peripheral,
                                info.x,
                                info.y,
                                info.facingRad
                            );

                            const mainPoly = buildPolygonFromRays(main, info.x, info.y, info.facingRad);
                            if (mainPoly) {
                                map.exploredAreas.push({ ...mainPoly, ts: nowTs });
                            } else {
                                map.exploredAreas.push({
                                    x: info.x,
                                    y: info.y,
                                    r: info.distance,
                                    rot: info.rotation,
                                    arc: exploredArc,
                                    ts: nowTs,
                                });
                            }

                            const leftPoly = buildPolygonFromRays(
                                peripheralSplit.left,
                                info.x,
                                info.y,
                                info.facingRad
                            );
                            if (leftPoly) map.exploredAreas.push({ ...leftPoly, ts: nowTs });
                            const rightPoly = buildPolygonFromRays(
                                peripheralSplit.right,
                                info.x,
                                info.y,
                                info.facingRad
                            );
                            if (rightPoly) map.exploredAreas.push({ ...rightPoly, ts: nowTs });

                            if (info.closeRadius > 0) {
                                map.exploredAreas.push({
                                    type: "circle",
                                    x: info.x,
                                    y: info.y,
                                    r: info.closeRadius,
                                    ts: nowTs,
                                });
                            }

                            lastExploreSampleRef.current[charId] = {
                                x: info.x,
                                y: info.y,
                                rotation: info.rotation,
                                ts: nowTs,
                            };
                        }
                    }

                    // Memory limit is applied per sample (all shapes with the same ts count as one).
                    map.exploredAreas = trimExploredAreasForMemory(map.exploredAreas, memoryLimit);

                    const visibleEntities = {};
                    allEntities.forEach((entry) => {
                        const result = getVisibilityForEntity(entry, info);
                        if (result.visibility > 0) {
                            visibleEntities[entry.key] = {
                                ...result,
                                ts: nowTs,
                            };
                            map.lastSeenEntities[entry.key] = {
                                ts: nowTs,
                                snapshot: JSON.parse(JSON.stringify(entry.obj)),
                                entityType: entry.type,
                                visibility: result.visibility,
                                visionType: result.visionType,
                            };
                        }
                    });
                    map.visibleEntities = visibleEntities;
                    visionMaps[charId] = map;
                });

                visionMapsRef.current = visionMaps;

                activeVisionSources = resolveVisionSources(allCharacters, ownedCharacterIds, fovMode);
                const combinedExplored = [];
                const combinedLastSeen = {};
                const combinedVisibility = {};

                activeVisionSources.forEach((char) => {
                    const charId = toEntityID(char?.id);
                    if (!charId) return;
                    const map = visionMaps[charId];
                    if (!map) return;
                    if (Array.isArray(map.exploredAreas)) {
                        combinedExplored.push(...map.exploredAreas);
                    }
                    if (map.lastSeenEntities && typeof map.lastSeenEntities === "object") {
                        Object.entries(map.lastSeenEntities).forEach(([key, entry]) => {
                            if (!entry) return;
                            const existing = combinedLastSeen[key];
                            if (!existing || Number(entry.ts) > Number(existing.ts)) {
                                combinedLastSeen[key] = entry;
                            }
                        });
                    }
                    if (map.visibleEntities && typeof map.visibleEntities === "object") {
                        Object.entries(map.visibleEntities).forEach(([key, entry]) => {
                            if (!entry) return;
                            const existing = combinedVisibility[key];
                            if (!existing || (entry.visibility || 0) > (existing.visibility || 0)) {
                                combinedVisibility[key] = entry;
                            }
                        });
                    }
                });

                exploredAreasRef.current = combinedExplored;
                lastSeenRef.current = combinedLastSeen;
                activeVisionVisibility = combinedVisibility;

                if (fogEnabled && !isDM) {
                    const visibleKeys = new Set(
                        Object.keys(combinedVisibility).filter(
                            (key) => (combinedVisibility[key]?.visibility || 0) > 0
                        )
                    );

                    Object.entries(combinedLastSeen).forEach(([key, entry]) => {
                        if (!entry || !entry.snapshot) return;
                        if (visibleKeys.has(key)) return;
                        const type =
                            entry.entityType || (entry.snapshot?.position ? "character" : "mapObject");
                        if (type === "character") {
                            const team = String(entry.snapshot?.team || "").toLowerCase();
                            if (team !== "enemy") return;
                            ghostCharacters.push({
                                ...entry.snapshot,
                                _visionGhost: true,
                                _visionData: {
                                    visibility: entry.visibility,
                                    visionType: entry.visionType,
                                },
                            });
                        } else {
                            ghostMapObjects.push({
                                ...entry.snapshot,
                                _visionGhost: true,
                                _visionData: {
                                    visibility: entry.visibility,
                                    visionType: entry.visionType,
                                },
                            });
                        }
                    });
                }

                if (isDM) {
                    const nowStamp =
                        typeof performance !== "undefined" && typeof performance.now === "function"
                            ? performance.now()
                            : Date.now();
                    if (nowStamp - lastVisionDebugUpdateRef.current > 500) {
                        lastVisionDebugUpdateRef.current = nowStamp;
                        const perCharacter = allCharacters.map((char) => {
                            const charId = toEntityID(char?.id);
                            const map = charId ? visionMaps[charId] : null;
                            const exploredCount = Array.isArray(map?.exploredAreas)
                                ? map.exploredAreas.length
                                : 0;
                            const lastSeenCount =
                                map?.lastSeenEntities && typeof map.lastSeenEntities === "object"
                                    ? Object.keys(map.lastSeenEntities).length
                                    : 0;
                            const visibleCount =
                                map?.visibleEntities && typeof map.visibleEntities === "object"
                                    ? Object.keys(map.visibleEntities).length
                                    : 0;
                            return {
                                id: charId,
                                name: String(char?.name || charId || "Unknown"),
                                explored: exploredCount,
                                lastSeen: lastSeenCount,
                                visible: visibleCount,
                            };
                        });
                        setVisionDebug({
                            updatedAt: Date.now(),
                            characterCount: allCharacters.length,
                            sourceCount: activeVisionSources.length,
                            combinedExplored: combinedExplored.length,
                            combinedLastSeen: Object.keys(combinedLastSeen).length,
                            combinedVisible: Object.keys(combinedVisibility).length,
                            perCharacter,
                        });
                    }
                }
            } catch (e) {
                // ignore
            }

            const renderState = {
                ...currentState,
                characters: animatedCharacters,
                exploredAreas: exploredAreasRef.current,
                lastSeenEntities: lastSeenRef.current,
                visionVisibility: activeVisionVisibility,
                visionSources: activeVisionSources,
                ghostCharacters,
                ghostMapObjects,
                fovMode,
            };

            const view = getActiveMapView(activeViewId);
            const filteredState = view.apply(renderState);

            michelangeloEngine({
                layers,
                frame: {
                    state: filteredState,
                    prevState: prevStateRef.current,
                    cache: {},
                },
            });

            prevStateRef.current = filteredState;
            raf = requestAnimationFrame(loop);
        };

        loop();
        return () => cancelAnimationFrame(raf);
    }, [
        camera,
        mapObjects,
        geometryObjects,
        characters,
        selectedChar,
        fogEnabled,
        ownedCharacterIds,
        floorTypes,
        currentZLevel,
        selectedEntity,
        blockedMovePreview,
        activeDragObject,
        hiddenMapObjectIds,
        lighting,
        backgroundKey,
        isDM,
        activeViewId,
        visionRayCount,
        debugLightSample,
        fovMode,
    ]);

    useEffect(() => {
        const onMouseMove = (event) => {
            if (dragging) {
                const newWidth = window.innerWidth - event.clientX;
                setSideWidth(Math.max(MIN_SIDE_WIDTH, Math.min(newWidth, MAX_SIDE_WIDTH)));
            }
        };

        const onMouseUp = () => {
            setDragging(false);
        };

        if (dragging) {
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [dragging]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (isTypingTarget(event.target)) return;
            if (keysPressed.current.hasOwnProperty(event.code)) {
                keysPressed.current[event.code] = true;
                event.preventDefault();
            }
        };

        const onKeyUp = (event) => {
            if (isTypingTarget(event.target)) return;
            if (keysPressed.current.hasOwnProperty(event.code)) {
                keysPressed.current[event.code] = false;
                event.preventDefault();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (isTypingTarget(event.target)) return;

            if (event.code === "Space") {
                event.preventDefault();
                stepZLevelUp();
                return;
            }

            if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
                event.preventDefault();
                stepZLevelDown();
                return;
            }

            const dx = PAN_SPEED;
            const dy = PAN_SPEED;

            if (keysPressed.current.KeyW) camera.current.y -= dy;
            if (keysPressed.current.KeyS) camera.current.y += dy;
            if (keysPressed.current.KeyA) camera.current.x -= dx;
            if (keysPressed.current.KeyD) camera.current.x += dx;

            if (keysPressed.current.KeyQ) {
                camera.current.zoom *= 1 / ZOOM_FACTOR;
                camera.current.zoom = Math.max(MIN_ZOOM, Math.min(camera.current.zoom, MAX_ZOOM));
            }
            if (keysPressed.current.KeyE) {
                camera.current.zoom *= ZOOM_FACTOR;
                camera.current.zoom = Math.max(MIN_ZOOM, Math.min(camera.current.zoom, MAX_ZOOM));
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [camera, stepZLevelDown, stepZLevelUp]);

const openInfoPanel = useCallback((type, id, spawnX, spawnY) => {
    const key = `${type}:${id}`;
    setInfoPanels(prev => {
        if (prev[key]) return prev;
        const clamped = clampInfoPanelPosition(spawnX ?? INFO_PANEL_MIN_LEFT, spawnY ?? INFO_PANEL_MIN_TOP);
        return { ...prev, [key]: { ...clamped, type, id } };
    });
}, [clampInfoPanelPosition]);

    useEffect(() => {
        const onEscape = (event) => {
            if (event.key !== "Escape") return;
            setContextMenu(null);
            setContextMenuPos(null);
            setInfoPanels({});
            setDragTarget(null);
            setResizeTarget(null);
            setPlacementDrag(null);
            setRotationDrag(null);
            setBlockedMovePreview(null);
            setActiveDragObject(null);
            setMovementPreview(null);
            setSelectedEntity(null);
            setSelectionBox(null);
            setPendingAction(null);
            selectCharacter(null);
            clearMapObjectPlacement();
            clearLightPlacement();
            clearCharacterPlacement();
        };

        window.addEventListener("keydown", onEscape);
        return () => window.removeEventListener("keydown", onEscape);
    }, [clearMapObjectPlacement, clearLightPlacement, clearCharacterPlacement, selectCharacter]);

    useEffect(() => {
        if (!mapObjectPlacement) {
            setPlacementDrag(null);
        }
    }, [mapObjectPlacement]);

    const selectEntity = useCallback(
    (target) => {
        if (!target?.type) {
            setSelectedEntity(null);
            selectCharacter(null);
            return;
        }
        const next = { type: target.type, id: target.id };
            setSelectedEntity((prev) => (isSameEntity(prev, next) ? prev : next));
            if (target.type === "character") {
                setMultiSelectedIds(new Set([toEntityID(target.id)]));
                selectCharacter(target.id);

            } else {
                selectCharacter(null);
            }

    },
    [selectCharacter, openInfoPanel]
);






const closeInfoPanel = useCallback((key) => {
    setInfoPanels(prev => { const n = { ...prev }; delete n[key]; return n; });
}, []);

const handleMouseDown = async (event) => {
        const world = getWorldFromMouseEvent(event);
        if (!world) return;
        setBlockedMovePreview(null);
        setContextMenu(null);
        setActiveDragObject(null);
        setMovementPreview(null);

        // --- RIGHT CLICK (Context Menu) ---
        if (event.button === 2) {
            event.preventDefault();
            
            if (pendingAction) {
                setPendingAction(null);
                setMovementPreview(null);
                return;
            }

            const target =
                findInteractionTargetAt(world.x, world.y, isDM) ||
                (selectedEntity?.type ? selectedEntity : null);

            // If right-clicking on empty space, show a context menu for the selected character if one exists
            if (!target && selectedEntityData?.type === 'character') {
                setContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    world: { x: world.x, y: world.y },
                    target: {
                        type: selectedEntityData.type,
                        id: selectedEntityData.id,
                    },
                });
            } else if (target) {
                setContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    world: { x: world.x, y: world.y },
                    target: {
                        type: target.type,
                        id: target.id,
                    },
                });
            } else {
                setContextMenu(null);
            }
            return;
        }

        // --- MIDDLE CLICK (Panning) ---
        if (event.button === 1) {
            event.preventDefault();
            isPanning.current = true;
            return;
        }

        // --- LEFT CLICK ---
        if (event.button === 0) {
            event.preventDefault();

            // Debug: Alt + Shift + Click to sample server lighting at cursor
            if (isDM && event.altKey && event.ctrlKey) {
                if (socket && playerID && gameID) {
                    const payload = {
                        playerID,
                        campaignID: gameID,
                        worldX: Math.round(Number(world.x) || 0),
                        worldY: Math.round(Number(world.y) || 0),
                    };
                    try {
                        const response = await emitWithAck(socket, "campaign_debugLightAtPoint", payload);
                        if (response?.success) {
                            setDebugLightSample({
                                worldX: response.worldX,
                                worldY: response.worldY,
                                lightLevel: response.lightLevel,
                                lightingEnabled: response.lightingEnabled,
                                ambient: response.ambient,
                                currentZLevel: response.currentZLevel,
                                timestamp: Date.now(),
                            });
                        } else {
                            setDebugLightSample({
                                worldX: payload.worldX,
                                worldY: payload.worldY,
                                error: response?.message || "Debug light query failed",
                                timestamp: Date.now(),
                            });
                        }
                    } catch (error) {
                        setDebugLightSample({
                            worldX: payload.worldX,
                            worldY: payload.worldY,
                            error: error?.message || "Debug light query failed",
                            timestamp: Date.now(),
                        });
                    }
                }
                return;
            }

            // 1. Handle pending actions (e.g., from context menu)
            if (pendingAction) {
                const actionType = String(pendingAction.actionMeta?.actionType || pendingAction.actionMeta?.tab || "").toLowerCase();
                const isMovement = actionType === "movement" || String(pendingAction.actionMeta?.path || "").startsWith("movement.");
                if (isMovement) {
                event.stopPropagation();
                    executeCharacterAction(pendingAction.characterId, pendingAction.actionMeta, { x: world.x, y: world.y });
                    setPendingAction(null);
                    setMovementPreview(null);
                    return;
                }
            }

            // 2. Handle DM placement modes
            if (isDM) {
                if (characterPlacement) {
                    placeCharacterFromPlacement(world);
                    return;
                }
                if (mapObjectPlacement) {
                    setPlacementDrag({
                        startWorld: { x: world.x, y: world.y },
                        currentWorld: { x: world.x, y: world.y },
                        startClient: { x: event.clientX, y: event.clientY },
                    });
                    return;
                }
                if (lightPlacement) {
                    placeLightAt(world.x, world.y);
                    return;
                }
            }

            // 3. Handle DM special interactions (resize, rotate)
            if (isDM) {
                const screen = getScreenFromMouseEvent(event);
                if (screen) {
                    const facingTarget = findFacingHandleAtScreenPoint(screen.x, screen.y);
                    if (facingTarget) {
                        setRotationDrag({ characterId: facingTarget.id });
                        selectEntity({ type: "character", id: facingTarget.id });
                        return;
                    }
                }
                if (selectedEntityData?.type === "mapObject") {
                    const selectedObject = selectedEntityData.entity;
                    if (selectedObject && getObjectZLevel(selectedObject) === currentZLevel) {
                        const cameraSnapshot = {
                            x: Number(camera.current?.x) || 0,
                            y: Number(camera.current?.y) || 0,
                            zoom: Number(camera.current?.zoom) || 1,
                        };
                        const handles = buildResizeHandlesForObject(selectedObject, cameraSnapshot);
                        const hitHandle = screen ? findResizeHandleAtScreenPoint(screen.x, screen.y, handles) : null;
                        if (hitHandle) {
                            setDragTarget(null);
                            if (hitHandle.id === "height") {
                                setResizeTarget({
                                    type: "height",
                                    id: selectedObject.id,
                                    startClientY: event.clientY,
                                    startHeight: Math.round(Number(selectedObject?.elevationHeight) || 0),
                                });
                            } else {
                                const bounds = getMapObjectBounds(selectedObject);
                                const anchor = getResizeAnchorForHandle(hitHandle.id, bounds);
                                if (anchor) {
                                    setResizeTarget({
                                        type: "shape",
                                        id: selectedObject.id,
                                        handle: hitHandle.id,
                                        anchorX: anchor.x,
                                        anchorY: anchor.y,
                                    });
                                }
                            }
                            return;
                        }
                    }
                }
            }

            // 4. Find what was clicked on
            const target = findInteractionTargetAt(world.x, world.y, isDM);

            // 5. Handle double-click to open info panel
            const now = Date.now();
            if (isSameEntity(target, selectedEntity) && lastClickRef.current.id === target?.id && now - lastClickRef.current.time < 300) {
                openInfoPanel(target.type, target.id, event.clientX, event.clientY);
                // Fall through to start drag
            }
            lastClickRef.current = { time: now, id: target?.id };

            // 6. Select or deselect entity
            if (target) {
                selectEntity(target);
                setMultiSelectedIds(new Set([toEntityID(target.id)]));
            } else {
                if (!isPanning.current && !placementDrag && !mapObjectPlacement && !lightPlacement && !characterPlacement) {
                    const screen = getScreenFromMouseEvent(event);
                    if (screen) {
                        setSelectionBox({ startX: screen.x, startY: screen.y, currentX: screen.x, currentY: screen.y });
                        selectEntity(null);
                        setMultiSelectedIds(new Set());
                    }
                }
                return; // Clicked on empty space, do nothing else
            }

            // 7. Start drag operation for the selected target
            if (target.type === "character") {
                const characterTarget = characters.find(c => toEntityID(c?.id) === toEntityID(target.id));
                if (characterTarget && canControlCharacterId(characterTarget.id)) {
                    setDragTarget({
                        type: "character",
                        id: characterTarget.id,
                        offsetX: world.x - (Number(characterTarget?.position?.x) || 0),
                        offsetY: world.y - (Number(characterTarget?.position?.y) || 0),
                    });
                }
            } else if (target.type === "mapObject" && isDM) {
                const objectTarget = activeMapObjects.find(obj => toEntityID(obj?.id) === toEntityID(target.id));
                if (objectTarget) {
                    setDragTarget({
                        type: "mapObject",
                        id: objectTarget.id,
                        offsetX: world.x - (Number(objectTarget.x) || 0),
                        offsetY: world.y - (Number(objectTarget.y) || 0),
                        originalX: Number(objectTarget.x) || 0,
                        originalY: Number(objectTarget.y) || 0,
                    });
                }
            }
        }
    };

    const handleMouseMove = (event) => {
        setLastMouse({ x: event.clientX, y: event.clientY });

        if (selectionBox) {
            const screen = getScreenFromMouseEvent(event);
            if (screen) {
                setSelectionBox(prev => ({ ...prev, currentX: screen.x, currentY: screen.y }));
            }
        }

        // Calculate light level at cursor
        const world = getWorldFromMouseEvent(event);
        if (world) {
            const lightVal = calculateLightAtPoint(world.x, world.y, {
                lighting,
                currentZLevel,
                lightingPolygons: latestSnapshotRef.current.lightingPolygons
            });
            setCursorLightLevel(lightVal);
        }

        // ── Movement targeting mode: show ghost at cursor with range circle ──────
        if (pendingAction) {
            const pendingType = String(pendingAction.actionMeta?.actionType || "").toLowerCase();
            const pendingPath = String(pendingAction.actionMeta?.path || "");
            const isPendingMovement = pendingType === "movement" || pendingPath.startsWith("movement.");
            if (isPendingMovement) {
                if (world) {
                    const movingChar = characters.find(
                        (c) => toEntityID(c?.id) === toEntityID(pendingAction.characterId)
                    );
                    if (movingChar) {
                        const charRadius = Math.max(1, (Number(movingChar?.size) || 0) / 2);
                        const startX = Number(movingChar.position.x) || 0;
                        const startY = Number(movingChar.position.y) || 0;
                        const actionPath = String(pendingAction.actionMeta?.path || "");
                        const mode = actionPath.split('.')[1] || "walk";
                        const multiplier = MOVEMENT_MULTIPLIERS[mode] || 1;
                        const maxMove = (Number(movingChar.movement) || 0) * WORLD_UNITS_PER_FOOT * multiplier;
                        
                        const dist = Math.hypot(world.x - startX, world.y - startY);
                        const outOfRange = maxMove > 0 && dist > maxMove;
                        const collides = wouldCharacterCollideWithObstacles(
                            world.x, world.y, charRadius, collisionObjects, []
                        );
                        setMovementPreview({
                            characterId: movingChar.id,
                            ghostX: world.x,
                            ghostY: world.y,
                            walkableRadius: charRadius,
                            maxMoveRadius: maxMove,
                            blocked: outOfRange || collides,
                            isTargeting: true,
                        });
                    }
                }
                return; // don't run drag/pan logic during targeting
            }
        }

        if (rotationDrag && isDM) {
            const world = getWorldFromMouseEvent(event);
            if (!world) return;
            const targetChar = characters.find(
                (char) => toEntityID(char?.id) === toEntityID(rotationDrag.characterId)
            );
            if (!targetChar) {
                setRotationDrag(null);
                return;
            }
            const dx = world.x - (Number(targetChar?.position?.x) || 0);
            const dy = world.y - (Number(targetChar?.position?.y) || 0);
            if (dx === 0 && dy === 0) return;
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            const nextRotation = normalizeAngleDegrees(angle + 90);
            updateCharacter(targetChar.id, { rotation: nextRotation });
            return;
        }

        if (resizeTarget && isDM) {
            const objectTarget = mapObjects.find(
                (obj) => toEntityID(obj?.id) === toEntityID(resizeTarget.id)
            );
            if (!objectTarget) return;

            setBlockedMovePreview(null);

            if (resizeTarget.type === "height") {
                const zoom = Number(camera.current?.zoom) || 1;
                const deltaHeight = (resizeTarget.startClientY - event.clientY) / Math.max(0.1, zoom);
                const nextHeight = Math.max(
                    0,
                    Math.round((Number(resizeTarget.startHeight) || 0) + deltaHeight)
                );
                updateMapObject(resizeTarget.id, {
                    elevationHeight: nextHeight,
                });
                return;
            }

            const world = getWorldFromMouseEvent(event);
            if (!world) return;

            const anchorX = Number(resizeTarget.anchorX);
            const anchorY = Number(resizeTarget.anchorY);
            const minX = Math.min(anchorX, world.x);
            const maxX = Math.max(anchorX, world.x);
            const minY = Math.min(anchorY, world.y);
            const maxY = Math.max(anchorY, world.y);
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const objectType = String(objectTarget?.type || "circle").toLowerCase();

            if (objectType === "rect") {
                const rad = -(Number(objectTarget.rotation) || 0) * Math.PI / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const dx = world.x - anchorX;
                const dy = world.y - anchorY;
                const localWidth = Math.abs(dx * cos - dy * sin);
                const localHeight = Math.abs(dx * sin + dy * cos);

                updateMapObject(resizeTarget.id, {
                    x: Math.round(centerX),
                    y: Math.round(centerY),
                    width: Math.max(MIN_RECT_WORLD_SIZE, Math.round(localWidth)),
                    height: Math.max(MIN_RECT_WORLD_SIZE, Math.round(localHeight)),
                });
                return;
            }

            updateMapObject(resizeTarget.id, {
                x: Math.round(centerX),
                y: Math.round(centerY),
                size: Math.max(
                    MIN_SHAPE_WORLD_SIZE,
                    Math.round(Math.max(maxX - minX, maxY - minY))
                ),
            });
            return;
        }

        if (placementDrag && isDM && mapObjectPlacement) {
            const world = getWorldFromMouseEvent(event);
            if (!world) return;

            setPlacementDrag((prev) =>
                prev
                    ? {
                          ...prev,
                          currentWorld: { x: world.x, y: world.y },
                      }
                    : prev
            );
            return;
        }

        if (dragTarget) {
            const world = getWorldFromMouseEvent(event);
            if (!world) return;
            const targetX = world.x - dragTarget.offsetX;
            const targetY = world.y - dragTarget.offsetY;

            if (dragTarget.type === "mapObject") {
                if (!isDM) return;
                const objectTarget = mapObjects.find(
                    (obj) => toEntityID(obj?.id) === toEntityID(dragTarget.id)
                );
                if (!objectTarget) {
                    setBlockedMovePreview(null);
                    setActiveDragObject(null);
                    activeDragObjectRef.current = null;
                    return;
                }
                const candidate = {
                    ...objectTarget,
                    x: Math.round(targetX),
                    y: Math.round(targetY),
                };

                setDragTarget(prev => ({
                    ...prev,
                    currentWorld: { x: candidate.x, y: candidate.y }
                }));

                const isBlocked = wouldObjectOverlapAtPosition(candidate, mapObjects, objectTarget.id);
                const nextDragObj = { ...candidate, _blocked: isBlocked };
                activeDragObjectRef.current = nextDragObj;
                setActiveDragObject(nextDragObj);
                setBlockedMovePreview(null);
                return;
            }

            if (dragTarget.type === "character") {
                if (!canControlCharacterId(dragTarget.id)) return;
                
                const draggingChar = characters.find(
                    (char) => toEntityID(char?.id) === toEntityID(dragTarget.id)
                );
                if (!draggingChar) return;
                
                const charRadius = Math.max(1, (Number(draggingChar?.size) || 0) / 2);
                let finalX = Math.round(targetX);
                let finalY = Math.round(targetY);

                // Clamp to max movement distance
                const startX = Number(draggingChar.position.x) || 0;
                const startY = Number(draggingChar.position.y) || 0;
                const maxMove = (Number(draggingChar.movement) || 0) * WORLD_UNITS_PER_FOOT;
                const distRaw = Math.hypot(finalX - startX, finalY - startY);

                const hasMovementAction = isDM || (draggingChar.actionPoints?.movement ?? 1) > 0;

                if (!isDM && (maxMove <= 0 || !hasMovementAction)) {
                    setMovementPreview({
                        characterId: dragTarget.id,
                        ghostX: draggingChar.position.x,
                        ghostY: draggingChar.position.y,
                        walkableRadius: charRadius,
                        blocked: true,
                    });
                    return;
                }

                if (!isDM && distRaw > maxMove) {
                    const ratio = maxMove / distRaw;
                    finalX = startX + (finalX - startX) * ratio;
                    finalY = startY + (finalY - startY) * ratio;
                }
                
                // Check collision with obstacles
                if (wouldCharacterCollideWithObstacles(finalX, finalY, charRadius, collisionObjects, [])) {
                    // Position would collide with obstacle - don't move to colliding position
                    // Show movement preview but don't actually move
                    setMovementPreview({
                        characterId: dragTarget.id,
                        ghostX: finalX,
                        ghostY: finalY,
                        walkableRadius: charRadius,
                        blocked: true,
                    });
                    return;
                }
                
                // Check collision with other characters
                const blocker = getClosestBlockingCharacter(finalX, finalY, charRadius, characters, dragTarget.id);
                if (blocker) {
                    // Adjust to be just before the blocking character
                    const adjusted = adjustPositionBeforeCollision(finalX, finalY, charRadius, blocker);
                    finalX = Math.round(adjusted.x);
                    finalY = Math.round(adjusted.y);
                }
                
                // Show movement preview with ghost character
                setMovementPreview({
                    characterId: dragTarget.id,
                    ghostX: finalX,
                    ghostY: finalY,
                    walkableRadius: charRadius,
                    blocked: false,
                });
                return;
            }
        }

        if (isPanning.current) {
            const dx = event.clientX - lastMouse.x;
            const dy = event.clientY - lastMouse.y;
            camera.current.x -= dx;
            camera.current.y -= dy;
        }
    };

    const handleMouseUp = async (event) => {
        if (selectionBox) {
            const x1 = Math.min(selectionBox.startX, selectionBox.currentX);
            const x2 = Math.max(selectionBox.startX, selectionBox.currentX);
            const y1 = Math.min(selectionBox.startY, selectionBox.currentY);
            const y2 = Math.max(selectionBox.startY, selectionBox.currentY);
            
            if (Math.abs(x2 - x1) > 2 || Math.abs(y2 - y1) > 2) {
                const newSelection = new Set();
                characters.forEach(char => {
                    if (!isVisible(char.position.x, char.position.y) && !isDM) return;
                    const screen = worldToScreen(char.position.x, char.position.y);
                    if (screen.x >= x1 && screen.x <= x2 && screen.y >= y1 && screen.y <= y2) {
                        newSelection.add(toEntityID(char.id));
                    }
                });
                
                setMultiSelectedIds(newSelection);
                if (newSelection.size > 0) {
                    const firstId = newSelection.values().next().value;
                    setSelectedEntity({ type: 'character', id: firstId });
                    selectCharacter(firstId);
                }
            }
            setSelectionBox(null);
            return;
        }

        if (rotationDrag) {
            const rotationTargetId = rotationDrag.characterId;
            setRotationDrag(null);
            setBlockedMovePreview(null);

            if (isDM && socket && playerID && gameID && rotationTargetId) {
                const targetChar = characters.find(
                    (char) => toEntityID(char?.id) === toEntityID(rotationTargetId)
                );
                if (targetChar) {
                    const response = await emitWithAck(socket, "campaign_moveCharacter", {
                        playerID,
                        campaignID: gameID,
                        characterID: rotationTargetId,
                        rotation: Number(targetChar.rotation) || 0,
                    });

                    if (!response?.success) {
                        if (response?.message) {
                            setGameContextError((prev) => prev || response.message);
                        }
                        return;
                    }

                    const snapshot =
                        response?.engineState?.snapshot && typeof response.engineState.snapshot === "object"
                            ? response.engineState.snapshot
                            : null;
                    if (snapshot) {
                        if (snapshot.lightingPolygons) {
                            latestSnapshotRef.current.lightingPolygons = snapshot.lightingPolygons;
                        }
                        applyingServerStateRef.current = true;
                        skipNextAutoSaveRef.current = true;
                        applyLoadedSnapshot(snapshot);
                        setGameContextError("");
                    }
                }
            }

            return;
        }

        if (dragTarget?.type === "mapObject" && isDM) {
            const dragSnapshot = activeDragObjectRef.current;
            if (dragSnapshot && !dragSnapshot._blocked) {
                const original = mapObjects.find((obj) => toEntityID(obj.id) === toEntityID(dragTarget.id));
                if (!original || original.x !== dragSnapshot.x || original.y !== dragSnapshot.y) {
                    updateMapObject(dragTarget.id, { x: dragSnapshot.x, y: dragSnapshot.y });
                }
            }
            setActiveDragObject(null);
            activeDragObjectRef.current = null;
            setBlockedMovePreview(null);
        }

        if (dragTarget?.type === 'character' && movementPreview) {
            if (!movementPreview.blocked) {
                if (isDM) {
                    queueCharacterMove(dragTarget.id, movementPreview.ghostX, movementPreview.ghostY);
                } else {
                    // Stage action instead of executing immediately
                    await handleStageAction(dragTarget.id, {
                        path: "movement.walk",
                        actionType: "movement",
                        name: "Move"
                    }, {
                        x: movementPreview.ghostX,
                        y: movementPreview.ghostY,
                    });
                }
            } else if (!isDM) {
                const char = characters.find(c => toEntityID(c.id) === toEntityID(dragTarget.id));
                const maxMove = (Number(char?.movement) || 0);
                if (maxMove <= 0) {
                    setGameContextError("No movement remaining.");
                    setTimeout(() => setGameContextError(""), 2000);
                }
            }
        }

        if (placementDrag && isDM && mapObjectPlacement) {
            const fallbackWorld = placementDrag.currentWorld || placementDrag.startWorld;
            const releaseWorld = getWorldFromMouseEvent(event) || fallbackWorld;
            const endClientX =
                typeof event?.clientX === "number" ? event.clientX : placementDrag.startClient.x;
            const endClientY =
                typeof event?.clientY === "number" ? event.clientY : placementDrag.startClient.y;
            const dragDistancePx = Math.hypot(
                endClientX - placementDrag.startClient.x,
                endClientY - placementDrag.startClient.y
            );

            if (dragDistancePx <= CLICK_DRAG_THRESHOLD_PX) {
                placePendingMapObjectAt(placementDrag.startWorld.x, placementDrag.startWorld.y, {
                    zLevel: currentZLevel,
                });
            } else {
                const draggedPlacement = buildPlacementFromDrag(
                    mapObjectPlacement,
                    placementDrag.startWorld,
                    releaseWorld
                );
                placePendingMapObjectAt(
                    draggedPlacement.x,
                    draggedPlacement.y,
                    {
                        ...draggedPlacement.overrides,
                        zLevel: currentZLevel,
                    }
                );
            }

            setPlacementDrag(null);
        }

        isPanning.current = false;
        setDragTarget(null);
        setResizeTarget(null);
        setBlockedMovePreview(null);
        setActiveDragObject(null);
        setMovementPreview(null);
    };

    const handleResizerMouseDown = (event) => {
        event.stopPropagation();
        setDragging(true);
    };

    const handleWheel = (event) => {
        event.preventDefault();
        setContextMenu(null);

        const worldX = (event.clientX + camera.current.x) / camera.current.zoom;
        const worldY = (event.clientY + camera.current.y) / camera.current.zoom;

        camera.current.zoom *= event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
        camera.current.zoom = Math.max(MIN_ZOOM, Math.min(camera.current.zoom, MAX_ZOOM));

        camera.current.x = worldX * camera.current.zoom - event.clientX;
        camera.current.y = worldY * camera.current.zoom - event.clientY;
    };

    const applyObjectHPDelta = async (objectID, amount) => {
        if (!socket || !playerID || !gameID) return;

        const response = await emitWithAck(socket, "campaign_gameDamageObject", {
            playerID,
            campaignID: gameID,
            objectID,
            amount,
        });

        if (!response?.success) {
            if (response?.message) {
                setGameContextError((prev) => prev || response.message);
            }
            return;
        }

        const snapshot =
            response?.engineState?.snapshot && typeof response.engineState.snapshot === "object"
                ? response.engineState.snapshot
                : null;
        if (!snapshot) return;
        if (snapshot.lightingPolygons) {
            latestSnapshotRef.current.lightingPolygons = snapshot.lightingPolygons;
        }
        applyingServerStateRef.current = true;
        skipNextAutoSaveRef.current = true;
        applyLoadedSnapshot(snapshot);
        setGameContextError("");
    };

    const flushPendingMove = useCallback(async () => {
        if (!socket || !playerID || !gameID) return;
        if (syncingMoveRef.current) return;
        const pending = pendingMoveRef.current;
        if (!pending) return;

        syncingMoveRef.current = true;
        pendingMoveRef.current = null;
        const response = await emitWithAck(socket, "campaign_moveCharacter", {
            playerID,
            campaignID: gameID,
            characterID: pending.characterId,
            position: {
                x: pending.x,
                y: pending.y,
            },
        });
        syncingMoveRef.current = false;
        moveSyncTimerRef.current = null;

        if (!response?.success) {
            if (response?.message) {
                setGameContextError((prev) => prev || response.message);
            }
            return;
        }

        const snapshot =
            response?.engineState?.snapshot && typeof response.engineState.snapshot === "object"
                ? response.engineState.snapshot
                : null;
        if (snapshot) {
            if (snapshot.lightingPolygons) {
                latestSnapshotRef.current.lightingPolygons = snapshot.lightingPolygons;
            }
            if (snapshot.journalState) {
                setJournalState(snapshot.journalState);
            }
            applyingServerStateRef.current = true;
            skipNextAutoSaveRef.current = true;
            applyLoadedSnapshot(snapshot);
            setGameContextError("");
            if (isDM) {
                scheduleAutoSave("move_character");
            }
        }

        if (pendingMoveRef.current) {
            moveSyncTimerRef.current = setTimeout(() => {
                flushPendingMove();
            }, 60);
        }
    }, [socket, playerID, gameID, loadGameSnapshot]);

    
    const queueCharacterMove = useCallback(
        (characterId, x, y) => {
            moveCharacter(characterId, x, y);
            if (!socket || !playerID || !gameID) return;

            pendingMoveRef.current = { characterId, x, y };
            if (moveSyncTimerRef.current) return;

            moveSyncTimerRef.current = setTimeout(() => {
                flushPendingMove();
            }, 120);
        },
        [moveCharacter, socket, playerID, gameID, flushPendingMove]
    );

    const flushVisionRayCount = useCallback(async () => {
        if (!socket || !playerID || !gameID || !isDM) return;
        const pending = pendingVisionRayCountRef.current;
        if (pending == null) return;

        pendingVisionRayCountRef.current = null;
        const response = await emitWithAck(socket, "campaign_setVisionRayCount", {
            playerID,
            campaignID: gameID,
            rayCount: pending,
        });

        visionRaySyncTimerRef.current = null;

        if (!response?.success) {
            if (response?.message) {
                setGameContextError((prev) => prev || response.message);
            }
            return;
        }

        const snapshot =
            response?.engineState?.snapshot && typeof response.engineState.snapshot === "object"
                ? response.engineState.snapshot
                : null;
        if (snapshot) {
            if (snapshot.lightingPolygons) {
                latestSnapshotRef.current.lightingPolygons = snapshot.lightingPolygons;
            }
            if (snapshot.journalState) {
                setJournalState(snapshot.journalState);
            }
            applyingServerStateRef.current = true;
            skipNextAutoSaveRef.current = true;
            applyLoadedSnapshot(snapshot);
            setGameContextError("");
        }
    }, [socket, playerID, gameID, isDM]);

    const queueVisionRayCount = useCallback(
        (nextCount) => {
            if (!isDM) return;
            pendingVisionRayCountRef.current = nextCount;
            if (visionRaySyncTimerRef.current) return;
            visionRaySyncTimerRef.current = setTimeout(() => {
                flushVisionRayCount();
            }, 120);
        },
        [flushVisionRayCount, isDM]
    );

    const handleVisionRayCountChange = useCallback(
        (nextCount) => {
            setVisionRayCount(nextCount);
            queueVisionRayCount(nextCount);
        },
        [queueVisionRayCount]
    );

    const handleForceVisionRerender = useCallback(() => {
        // Re-run server raycasting with the current ray count (no local state mutation).
        queueVisionRayCount(visionRayCount);
    }, [queueVisionRayCount, visionRayCount]);

    const placeCharacterFromPlacement = useCallback(
        async (worldPosition) => {
            if (!isDM || !characterPlacement) return;
            if (!socket || !playerID || !gameID) return;
            if (!worldPosition) return;

            const payloadPosition = {
                x: Math.round(Number(worldPosition.x) || 0),
                y: Math.round(Number(worldPosition.y) || 0),
            };
            const placementId = String(characterPlacement.id || "").trim();
            if (!placementId) return;
            const placementKind = String(characterPlacement.kind || "character").toLowerCase();

            const response =
                placementKind === "enemy"
                    ? await emitWithAck(socket, "campaign_spawnEnemy", {
                          playerID,
                          campaignID: gameID,
                          enemyID: placementId,
                          position: payloadPosition,
                      })
                    : await emitWithAck(socket, "campaign_moveCharacter", {
                          playerID,
                          campaignID: gameID,
                          characterID: placementId,
                          position: payloadPosition,
                      });

            if (!response?.success) {
                if (response?.message) {
                    setGameContextError((prev) => prev || response.message);
                }
                return;
            }

            const snapshot =
                response?.engineState?.snapshot && typeof response.engineState.snapshot === "object"
                    ? response.engineState.snapshot
                    : null;
            if (snapshot) {
            if (snapshot.lightingPolygons) {
                latestSnapshotRef.current.lightingPolygons = snapshot.lightingPolygons;
            }
                applyingServerStateRef.current = true;
                skipNextAutoSaveRef.current = true;
                applyLoadedSnapshot(snapshot);
            }
            setGameContextError("");
            clearCharacterPlacement();
        },
        [
            isDM,
            characterPlacement,
            socket,
            playerID,
            gameID,
            loadGameSnapshot,
            clearCharacterPlacement,
            setGameContextError,
        ]
    );

    const fetchCharacterActions = useCallback(
        async (characterId, options = {}) => {
            const safeId = toEntityID(characterId);
            if (!safeId || !socket || !playerID || !gameID) return null;
            if (!options.force && characterActionCache[safeId]) {
                return characterActionCache[safeId];
            }
            if (loadingActionCharacterId === safeId) return null;

            setLoadingActionCharacterId(safeId);
            const response = await emitWithAck(socket, "campaign_getCharacterActions", {
                playerID,
                campaignID: gameID,
                characterID: safeId,
            });
            setLoadingActionCharacterId("");

            if (!response?.success) {
                if (response?.message) {
                    setGameContextError((prev) => prev || response.message);
                }
                return null;
            }

            const payload = {
                actions: Array.isArray(response?.actions) ? response.actions : [],
                actionTree: response?.actionTree || null,
            };
            setCharacterActionCache((prev) => ({
                ...prev,
                [safeId]: payload,
            }));
            return payload;
        },
        [
            socket,
            playerID,
            gameID,
            characterActionCache,
            loadingActionCharacterId,
            setGameContextError,
        ]
    );

    useEffect(() => {
        if (!contextMenu) return;
        setContextTabTrails({});
        setActiveContextTab("action");
        console.log("[ContextMenuDebug] Menu opened for target:", contextMenu?.target);
}, [contextMenu]);

    useEffect(() => {
        if (!contextMenu || contextMenu?.target?.type !== "character") return;
        const targetId = toEntityID(contextMenu.target.id);
        if (!targetId) return;
        if (!isDM && !canControlCharacterId(targetId)) return;
        if (characterActionCache[targetId]) {
            console.log("[ContextMenuDebug] Using cached actions for", targetId, characterActionCache[targetId]);
            return;
        }
        console.log("[ContextMenuDebug] Fetching actions for character", targetId);
        fetchCharacterActions(targetId);
    }, [
        contextMenu,
        isDM,
        canControlCharacterId,
        characterActionCache,
        fetchCharacterActions,
    ]);

    useEffect(() => {
    if (!contextMenu) return undefined;

    const onPointerDown = (event) => {
        if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
            setContextMenu(null);
        }
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
}, [contextMenu]);


    const executeCharacterAction = useCallback(
        async (characterId, actionMeta, contextWorld) => {
            const safeId = toEntityID(characterId);
            if (!safeId || !actionMeta || !socket || !playerID || !gameID) return;

            const actionPath = String(actionMeta?.path || actionMeta?.actionPath || "").trim();
            const actionId = String(actionMeta?.id || actionMeta?.actionId || "").trim();
            const actionRef = actionPath || actionId;
            if (!actionRef) return;

            const actionType = String(actionMeta?.actionType || actionMeta?.tab || "").toLowerCase();
            const actionPathHint = String(actionMeta?.path || "");
            
            // Check if this is an attack or cast action that needs target selection
            const isAttack = String(actionRef).startsWith("main.attack") || actionType === "action";
            const isCast = String(actionRef).startsWith("main.cast") || actionType === "action";
            
            if ((isAttack || isCast) && !contextWorld?.targetId) {
                // Enter targeting mode
                setPendingAction({
                    characterId: safeId,
                    actionMeta,
                    sourceWorld: contextWorld,
                });
                return;
            }

            const params = {};
            if ((actionType === "movement" || actionPathHint.startsWith("movement.")) && contextWorld) {
                params.position = {
                    x: Math.round(contextWorld.x),
                    y: Math.round(contextWorld.y),
                };
            }
            
            // Add target ID if in targeting mode
            if (contextWorld?.targetId) {
                params.targetId = contextWorld.targetId;
            }

            if (!isDM) {
                await handleStageAction(safeId, actionMeta, contextWorld);
                setPendingAction(null);
                return;
            }

            const response = await emitWithAck(socket, "campaign_executeCharacterAction", {
                playerID,
                campaignID: gameID,
                characterID: safeId,
                actionPath: actionRef,
                actionId,
                params,
            });

            if (!response?.success) {
                if (response?.message) {
                    setGameContextError((prev) => prev || response.message);
                }
                return;
            }

            const snapshot = response?.engineState?.snapshot;
            if (snapshot) {
                const oldChars = new Map();
                if (snapshot.lightingPolygons) {
                    latestSnapshotRef.current.lightingPolygons = snapshot.lightingPolygons;
                }
                (latestSnapshotRef.current.characters || []).forEach(c => oldChars.set(toEntityID(c.id), c));
                const snapshotForLoad = JSON.parse(JSON.stringify(snapshot));

                const actionIsMovement = response.actionResult?.mode && response.actionResult?.distanceFt > 0;

                if (actionIsMovement) {
                    const charId = toEntityID(characterId);
                    const oldChar = oldChars.get(charId);
                    const newCharInSnapshot = (snapshotForLoad.characters || []).find(c => toEntityID(c.id) === charId);

                    if (oldChar && newCharInSnapshot) {
                        const oldPos = oldChar.position || { x: 0, y: 0 };
                        const newPos = newCharInSnapshot.position || { x: 0, y: 0 };
                        
                        const animId = `move_${charId}_${Date.now()}`;
                        activeAnimationsRef.current[animId] = {
                            type: "movement",
                            entityId: charId,
                            entityType: "character",
                            startTime: performance.now(),
                            duration: 300, // ms
                            params: { startX: oldPos.x, startY: oldPos.y, targetX: newPos.x, targetY: newPos.y }
                        };
                    }
                }

                applyingServerStateRef.current = true;
                skipNextAutoSaveRef.current = true;
                applyLoadedSnapshot(snapshotForLoad);
            }
            setGameContextError("");
            setPendingAction(null); // Clear targeting mode after execution
        }, [socket, playerID, gameID, isDM, handleStageAction, applyLoadedSnapshot]
    );

    const handleDeleteEntity = useCallback(
        async (target) => {
            if (!isDM || !target) return;

            if (target.type === "mapObject") {
                deleteMapObject(target.id);
                setSelectedEntity(null);
                setMultiSelectedIds(new Set());
                return;
            }

            if (target.type === "character") {
                const char = characters.find(
                    (c) => toEntityID(c?.id) === toEntityID(target.id)
                );
                if (!char) {
                    setSelectedEntity(null);
                    setMultiSelectedIds(new Set());
                    return;
                }

                const isEnemy = String(char.team || "").toLowerCase() === "enemy";
                // Use deleteEnemy for enemies (permanent delete), removeCharacter for players (unplace)
                const eventName = isEnemy ? "campaign_deleteEnemy" : "campaign_removeCharacter";
                
                let idToSend = target.id;
                if (isEnemy) {
                    if (char.enemyId) {
                        idToSend = char.enemyId;
                    } else if (String(target.id).startsWith("enemy_")) {
                        idToSend = String(target.id).replace("enemy_", "");
                    }
                }

                const idParam = isEnemy ? { enemyID: idToSend } : { characterID: target.id };

                const response = await emitWithAck(socket, eventName, {
                    playerID,
                    campaignID: gameID,
                    ...idParam,
                });

                if (response?.success) {
                    const snapshot = response?.engineState?.snapshot;
                    if (snapshot) {
                        if (snapshot.lightingPolygons) {
                            latestSnapshotRef.current.lightingPolygons =
                                snapshot.lightingPolygons;
                        }
                        applyingServerStateRef.current = true;
                        skipNextAutoSaveRef.current = true;
                        applyLoadedSnapshot(snapshot);
                    }
                    setSelectedEntity(null);
                    setMultiSelectedIds(new Set());
                } else if (response?.message) {
                    setGameContextError(response.message);
                }
            }
        },
        [
            isDM,
            deleteMapObject,
            socket,
            playerID,
            gameID,
            characters,
            loadGameSnapshot,
            setGameContextError,
        ]
    );

    const handleContextAction = async (action) => {
        console.log("[HandleContextAction] Called with action:", action);
        const target = contextMenu?.target;
        const contextWorld =
            contextMenu?.world &&
            Number.isFinite(Number(contextMenu.world.x)) &&
            Number.isFinite(Number(contextMenu.world.y))
                ? {
                      x: Number(contextMenu.world.x),
                      y: Number(contextMenu.world.y),
                  }
                : null;
        if (!target?.type) return;
        
        // Handle targeting mode for attacks/casts
        if (pendingAction && target.type === "character") {
            const targetCharacter = characters.find(
                (char) => toEntityID(char?.id) === toEntityID(target.id)
            );
            if (targetCharacter) {
                setContextMenu(null);
                // Execute pending action with target
                await executeCharacterAction(
                    pendingAction.characterId,
                    pendingAction.actionMeta,
                    {
                        ...pendingAction.sourceWorld,
                        targetId: targetCharacter.id,
                    }
                );
                return;
            }
        }
        
        setContextMenu(null);

        if (target.type === "character") {
            const character = characters.find(
                (char) => toEntityID(char?.id) === toEntityID(target.id)
            );
            if (!character) return;

            const actionMeta =
                action && typeof action === "object" && (action.path || action.id)
                    ? action
                    : null;
            if (actionMeta) {
                if (!isDM && !canControlCharacterId(character.id)) return;

                const actionType = String(actionMeta?.actionType || actionMeta?.tab || "").toLowerCase();
                const isMovement = actionType === "movement" || String(actionMeta?.path || "").startsWith("movement.");
                
                console.log("[HandleContextAction] Movement action check:", { actionType, isMovement, actionPath: actionMeta?.path });

                if (isMovement) {
                    console.log("[HandleContextAction] Entering movement targeting mode for action:", actionMeta);
                    setContextMenu(null);
                    setPendingAction({
                        characterId: character.id,
                        actionMeta,
                        sourceWorld: null,
                    });
                    selectEntity({ type: "character", id: character.id });
                    return;
                }

                await executeCharacterAction(character.id, actionMeta, contextWorld);
                return;
            }

            if (action === "info") {
                selectEntity(target);
                openInfoPanel(target.type, target.id, contextMenu?.x, contextMenu?.y);
                return;
            }

            if (action === "viewSheet") {
                const ownerEntry =
                    characterOwnershipById.get(toEntityID(character.id)) || null;
                const isFriendly =
                    Boolean(ownerEntry) ||
                    String(character?.team || "").toLowerCase() === "player";
                if (!(isDM || canViewCharacterId(character.id) || isFriendly)) return;
                navigate(`/ISK/${safeSessionID}/character/view/${character.id}`);
                return;
            }

            if (action === "center") {
                const zoom = Number(camera.current?.zoom) || 1;
                camera.current.x = (Number(character?.position?.x) || 0) * zoom - window.innerWidth / 2;
                camera.current.y = (Number(character?.position?.y) || 0) * zoom - window.innerHeight / 2;
                return;
            }

            if (action === "placeHere") {
                if (!canControlCharacterId(character.id)) return;
                setContextMenu(null);
                // Enter targeting mode
                setPendingAction({
                    characterId: character.id,
                    actionMeta: {
                        path: "movement.walk",
                        actionPath: "movement.walk",
                        actionType: "movement",
                    },
                    sourceWorld: null,
                });
                selectEntity({ type: "character", id: character.id });
                return;
            }

            if (action === "toggleTeam" && isDM) {
                const nextTeam = String(character?.team || "player").toLowerCase() === "enemy"
                    ? "player"
                    : "enemy";
                updateCharacter(character.id, { team: nextTeam });
                selectEntity({ type: "character", id: character.id });
                return;
            }

            if (action === "endTurn" && isDM) {
                handleTurnDone();
                return;
            }

            if (action === "delete" && isDM) {
                handleDeleteEntity(target);
                return;
            }
            return;
        }

        if (target.type === "mapObject") {
            const object = mapObjects.find((obj) => toEntityID(obj?.id) === toEntityID(target.id));
            if (!object) return;

            if (action === "inspect") {
                selectEntity(target);
                openInfoPanel(target.type, target.id, contextMenu?.x, contextMenu?.y);
                return;
            }

            if (action === "center") {
                const zoom = Number(camera.current?.zoom) || 1;
                camera.current.x = (Number(object?.x) || 0) * zoom - window.innerWidth / 2;
                camera.current.y = (Number(object?.y) || 0) * zoom - window.innerHeight / 2;
                return;
            }

            if (action === "damage10") {
                await applyObjectHPDelta(object.id, 10);
                return;
            }
            if (action === "heal10") {
                await applyObjectHPDelta(object.id, -10);
                return;
            }
            if (action === "delete" && isDM) {
                deleteMapObject(object.id);
                setSelectedEntity((prev) => (isSameEntity(prev, target) ? null : prev));
                return;
            }
            if (action === "duplicate" && isDM) {
                const clone = { ...object };
                delete clone.id;
                addMapObject({
                    ...clone,
                    x: Math.round(Number(object?.x) || 0) + 24,
                    y: Math.round(Number(object?.y) || 0) + 24,
                });
                return;
            }
            if (action === "bringForward" && isDM) {
                updateMapObject(object.id, {
                    z: Math.round(Number(object?.z) || 0) + 1,
                });
                return;
            }
            if (action === "sendBackward" && isDM) {
                updateMapObject(object.id, {
                    z: Math.round(Number(object?.z) || 0) - 1,
                });
                return;
            }
            if (action === "toggleIndestructible" && isDM) {
                if (object?.maxHP == null) {
                    const terrain = String(object?.terrainType || "obstacle").toLowerCase();
                    const restoredHP =
                        DEFAULT_MAX_HP_BY_TERRAIN[terrain] || DEFAULT_MAX_HP_BY_TERRAIN.obstacle;
                    updateMapObject(object.id, {
                        maxHP: restoredHP,
                        hp: restoredHP,
                    });
                } else {
                    updateMapObject(object.id, {
                        maxHP: null,
                        hp: null,
                    });
                }
            }
        }
    };

    useEffect(() => {
        const onKeyDown = (event) => {
            if (isTypingTarget(event.target)) return;
            if ((event.key === "Backspace" || event.key === "Delete") && isDM) {
                if (selectedEntity) {
                    event.preventDefault();
                    handleDeleteEntity(selectedEntity);
                }
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isDM, selectedEntity, handleDeleteEntity]);

/*
const renderInfoPanels = () => Object.entries(infoPanels).map(([key, panel]) => {
    // This function has been moved to the InfoWindows component in infoWindows.jsx
});
*/

    const mapPlacementPreview = (() => {
        if (!isDM || !mapObjectPlacement) return null;
        const previewWorld =
            placementDrag?.currentWorld || placementDrag?.startWorld || worldMouseCoords;
        if (
            !previewWorld ||
            !Number.isFinite(Number(previewWorld.x)) ||
            !Number.isFinite(Number(previewWorld.y))
        ) {
            return null;
        }
        const placement = placementDrag
            ? buildPlacementFromDrag(
                  mapObjectPlacement,
                  placementDrag.startWorld,
                  previewWorld
              )
            : {
                  x: Math.round(Number(previewWorld.x) || 0),
                  y: Math.round(Number(previewWorld.y) || 0),
                  overrides: {},
              };
        const center = worldToScreen(placement.x, placement.y);
        const zoom = Number(camera.current.zoom) || 1;
        const type = String(mapObjectPlacement.type || "circle").toLowerCase();
        const color = String(mapObjectPlacement.color || "#3B82F6");
        const rotation = Number(mapObjectPlacement.rotation || 0);

        if (type === "rect") {
            const widthWorld =
                Number(placement.overrides.width ?? mapObjectPlacement.width) ||
                MIN_RECT_WORLD_SIZE;
            const heightWorld =
                Number(placement.overrides.height ?? mapObjectPlacement.height) ||
                MIN_RECT_WORLD_SIZE;
            return {
                type,
                color,
                rotation,
                x: center.x,
                y: center.y,
                width: widthWorld * zoom,
                height: heightWorld * zoom,
            };
        }

        const sizeWorld =
            Number(placement.overrides.size ?? mapObjectPlacement.size) ||
            MIN_SHAPE_WORLD_SIZE;
        const size = (sizeWorld / 2) * zoom;
        if (type === "triangle") {
            return {
                type,
                color,
                rotation,
                x: center.x,
                y: center.y,
                points: `${center.x},${center.y - size} ${center.x - size},${center.y + size} ${center.x + size},${center.y + size}`,
            };
        }

        return {
            type: "circle",
            color,
            x: center.x,
            y: center.y,
            radius: size,
        };
    })();

    const characterPlacementPreview = (() => {
        if (!isDM || !characterPlacement || !worldMouseCoords) return null;
        const center = worldToScreen(
            Number(worldMouseCoords.x) || 0,
            Number(worldMouseCoords.y) || 0
        );
        const zoom = Number(camera.current.zoom) || 1;
        const placementChar = characters.find(
            (char) => toEntityID(char?.id) === toEntityID(characterPlacement.id)
        );
        const size =
            Number(characterPlacement.size) ||
            Number(placementChar?.size) ||
            30;
        const radius = Math.max(6, (size / 2) * zoom);
        const team = String(
            characterPlacement.team ||
                placementChar?.team ||
                (characterPlacement.kind === "enemy" ? "enemy" : "player")
        ).toLowerCase();
        const color = TEAM_PREVIEW_COLORS[team] || TEAM_PREVIEW_COLORS.neutral;
        const rotation = Number(placementChar?.rotation || 0);

        return {
            name: characterPlacement.name || placementChar?.name || "",
            color,
            rotation,
            radius,
            x: center.x,
            y: center.y,
        };
    })();

    const lightPlacementPreview = (() => {
        if (!isDM || !lightPlacement || !worldMouseCoords) return null;
        const center = worldToScreen(
            Number(worldMouseCoords.x) || 0,
            Number(worldMouseCoords.y) || 0
        );
        const zoom = Number(camera.current.zoom) || 1;
        const range = Math.max(10, Number(lightPlacement.range) || 0) * zoom;
        return {
            x: center.x,
            y: center.y,
            range,
            color: String(lightPlacement.color || "#ffffff"),
        };
    })();

    const characterPlacementFacing = characterPlacementPreview
        ? (() => {
              const facingRad =
                  (getFacingAngle(characterPlacementPreview.rotation) * Math.PI) /
                  180;
              const dotDistance =
                  characterPlacementPreview.radius + FACE_DOT_OFFSET_PX;
              return {
                  x:
                      characterPlacementPreview.x +
                      Math.cos(facingRad) * dotDistance,
                  y:
                      characterPlacementPreview.y +
                      Math.sin(facingRad) * dotDistance,
              };
          })()
        : null;

    const contextCharacterId =
        contextMenu?.target?.type === "character" ? toEntityID(contextMenu.target.id) : "";
    const contextCharacter = contextCharacterId
        ? characters.find((char) => toEntityID(char?.id) === toEntityID(contextCharacterId))
        : null;
    const contextOwnerEntry = contextCharacterId
        ? characterOwnershipById.get(contextCharacterId) || null
        : null;
    const isContextTeammate = Boolean(contextOwnerEntry);
    const canViewCharacterSheet = Boolean(
        contextCharacter &&
            (isDM ||
                canControlCharacterId(contextCharacter.id) ||
                isContextTeammate ||
                String(contextCharacter?.team || "").toLowerCase() === "player")
    );
    const contextActionData = contextCharacterId
        ? characterActionCache[contextCharacterId]
        : null;
    const contextActionMenu = (() => {
        const tree = contextActionData?.actionTree;
        if (!tree && contextCharacterId) {
            console.log("[ContextMenuDebug] No actionTree for charId:", contextCharacterId, "contextActionData:", contextActionData);
        } else if (tree && contextCharacterId) {
            console.log("[ContextMenuDebug] ActionTree keys:", Object.keys(tree), "movement branch:", tree.movement);
        }
        return buildContextActionMenu(tree);
    })();
    const CONTEXT_TABS = [
    { key: "action", label: "Action" },
    { key: "bonus", label: "Bonus" },
    { key: "movement", label: "Movement" },
];

const getTabRootNode = (tabKey) => {
    if (!contextActionMenu) return null;
    return contextActionMenu.children?.find((c) => c.key === tabKey) || null;
};

const getActiveTabNode = (tabKey) => {
    const trail = contextTabTrails[tabKey] || [];
    if (trail.length === 0) return getTabRootNode(tabKey);
    return trail[trail.length - 1];
};

const pushTabTrail = (tabKey, node) => {
    setContextTabTrails((prev) => ({
        ...prev,
        [tabKey]: [...(prev[tabKey] || []), node],
    }));
};

const popTabTrail = (tabKey) => {
    setContextTabTrails((prev) => {
        const trail = prev[tabKey] || [];
        return { ...prev, [tabKey]: trail.slice(0, -1) };
    });
};

const activeTabNode = getActiveTabNode(activeContextTab);
const activeTabItems = activeTabNode
    ? getContextActionItems(activeTabNode, { includeEmpty: activeTabNode.key === activeContextTab })
    : [];
const contextActionGroups = !contextActionMenu
    ? groupActionsByTab(contextActionData?.actions || [])
    : [];

    useEffect(() => {
        if (!contextActionData) return;
        setContextTabTrails({});
    }, [contextActionData]);

    return (
        <div className="h-screen overflow-hidden">
            <div
                className="w-full h-full relative overflow-hidden"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onContextMenu={(event) => event.preventDefault()}
            >
                {/* Top Info Bar - Compact, Hierarchical & Draggable */}
                <div
                    className="absolute z-[130] flex items-center gap-2 max-w-[calc(100vw-2rem)] flex-wrap"
                    style={{ left: topBarPos.x, top: topBarPos.y }}
                >
                    {/* Drag handle */}
                    <div
                        className="cursor-move p-1 mr-1 text-website-default-500 select-none"
                        onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            e.preventDefault();
                            setActiveTopBarDrag({ offsetX: e.clientX - (topBarPos.x || 0), offsetY: e.clientY - (topBarPos.y || 0) });
                        }}
                        title="Drag to move"
                    >
                        |||
                    </div>
                    {/* Navigation Group */}
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => navigate(`/ISK/${safeSessionID}/lobby`)}
                            className="bg-gradient-to-b from-website-default-900/90 to-website-default-800/80 border border-website-default-700 text-website-default-100 text-[11px] px-2.5 py-1 rounded-md hover:border-website-highlights-400/70 hover:text-website-highlights-200 hover:bg-website-default-800/90 transition-colors whitespace-nowrap shadow-sm"
                        >
                            Lobby
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/ISK/${safeSessionID}/home`)}
                            className="bg-gradient-to-b from-website-default-900/90 to-website-default-800/80 border border-website-default-700 text-website-default-100 text-[11px] px-2.5 py-1 rounded-md hover:border-website-highlights-400/70 hover:text-website-highlights-200 hover:bg-website-default-800/90 transition-colors whitespace-nowrap shadow-sm"
                        >
                            Home
                        </button>
                    </div>

                    {/* Mode & Level Indicator */}
                    <span
                        className={`text-[11px] px-2.5 py-1 rounded-md border font-semibold whitespace-nowrap shadow-sm ${
                            isDM
                                ? "bg-website-highlights-500/15 border-website-highlights-400/70 text-website-highlights-200"
                                : "bg-website-default-900/70 border-website-default-700 text-website-default-300"
                        }`}
                    >
                        {isDM ? "DM" : "Player"} - L{currentZLevel}
                    </span>
                    {combatActive && (
                        <span className="text-[11px] px-2.5 py-1 rounded-md border bg-website-specials-500/15 border-website-specials-400 text-website-specials-200 uppercase tracking-[0.2em] shadow-sm">
                            Combat
                        </span>
                    )}

                    {/* DM Combat Controls */}
                    {isDM && (
                        <div className="flex items-center gap-1">
                            {!combatActive && (
                                <button
                                    type="button"
                                    onClick={handleStartCombat}
                                    className="text-[11px] px-2.5 py-1 rounded-md border bg-website-specials-500/20 border-website-specials-400 text-website-specials-200 hover:bg-website-specials-500/30 font-semibold whitespace-nowrap transition-colors shadow-sm ring-1 ring-website-specials-500/25"
                                >
                                    Combat
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={combatActive ? handleEndTurn : handleTurnDone}
                                className={`text-[11px] px-2.5 py-1 rounded-md border whitespace-nowrap font-semibold transition-colors shadow-sm ${
                                    combatActive
                                        ? "bg-website-highlights-500/20 border-website-highlights-400 text-website-highlights-200 hover:bg-website-highlights-500/30 ring-1 ring-website-highlights-500/25"
                                        : "bg-website-default-800/70 border-website-default-700 text-website-default-200 hover:bg-website-default-800 ring-1 ring-website-default-700/40"
                                }`}
                            >
                                {combatActive ? "End Turn" : "Turn"}
                            </button>
                            {(combatActive || turnNumber > 1) && (
                                <span className="text-[11px] px-2.5 py-1 rounded-md border bg-website-default-900/70 border-website-default-700 text-website-default-300 whitespace-nowrap shadow-sm ring-1 ring-website-highlights-500/15">
                                    {combatActive ? `R${combatRound}` : `T${turnNumber}`}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Placement Mode Indicators */}
                    {(mapObjectPlacement || characterPlacement || lightPlacement) && (
                        <div className="flex items-center gap-1">
                            {mapObjectPlacement && (
                                <span className="text-[11px] px-2.5 py-1 rounded-md border bg-website-highlights-500/15 border-website-highlights-400 text-website-highlights-200 whitespace-nowrap">
                                    📦 {mapObjectPlacement.type}
                                </span>
                            )}
                            {characterPlacement && (
                                <span className="text-[11px] px-2.5 py-1 rounded-md border bg-website-default-800/70 border-website-default-700 text-website-default-200 whitespace-nowrap">
                                    👤 {characterPlacement.name || "Char"}
                                </span>
                            )}
                            {lightPlacement && (
                                <span className="text-[11px] px-2.5 py-1 rounded-md border bg-website-highlights-500/15 border-website-highlights-400 text-website-highlights-200 whitespace-nowrap">
                                    💡 Light
                                </span>
                            )}
                        </div>
                    )}

                    {/* Status Panel Toggle */}
                    {(loadingGameContext || gameContextError || (isDM && (autoSaveStatus || lastServerUpdate))) && (
                        <button
                            type="button"
                            onClick={() => setShowStatusPanel(!showStatusPanel)}
                            className={`text-[11px] px-2.5 py-1 rounded-md border whitespace-nowrap transition-colors ${
                                gameContextError
                                    ? "bg-website-specials-500/20 border-website-specials-400 text-website-specials-200 animate-pulse ring-1 ring-website-specials-500/30 shadow-sm"
                                    : "bg-website-default-900/70 border-website-default-700 text-website-default-300 hover:bg-website-default-800/80 ring-1 ring-website-highlights-500/15 shadow-sm"
                            }`}
                        >
                            {gameContextError ? "⚠️ Error" : "ⓘ Status"}
                        </button>
                    )}

                    {isDM && (
                        <div className="flex items-center gap-1 ml-2 border-l border-website-default-700/60 pl-2">
                            <button
                                type="button"
                                onClick={handleExportSave}
                                className="text-[11px] px-2.5 py-1 rounded-md border bg-website-default-900/70 border-website-default-700 text-website-default-200 hover:bg-website-default-800 transition-colors"
                                title="Export Save"
                            >
                                ⬇️
                            </button>
                            <label className="text-[11px] px-2.5 py-1 rounded-md border bg-website-default-900/70 border-website-default-700 text-website-default-200 hover:bg-website-default-800 transition-colors cursor-pointer" title="Import Save">
                                ⬆️
                                <input
                                    type="file"
                                    accept=".json"
                                    className="hidden"
                                    onChange={handleImportSave}
                                />
                            </label>
                        </div>
                    )}
                </div>

                {/* Staged Action Confirmation UI */}
                {stagedAction && (
                    <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-[140] bg-website-default-900/95 border border-website-default-700/80 rounded-xl p-4 shadow-2xl backdrop-blur-md flex flex-col items-center gap-3">
                        <div className="text-website-default-100 font-semibold">Confirm {stagedAction.description}?</div>
                        <div className="flex gap-3">
                            <button onClick={handleCommitAction} className="bg-website-highlights-500 hover:bg-website-highlights-400 text-website-default-100 px-4 py-1.5 rounded-md font-semibold transition-colors">
                                Confirm
                            </button>
                            <button onClick={handleCancelAction} className="bg-website-specials-500 hover:bg-website-specials-400 text-website-default-100 px-4 py-1.5 rounded-md font-semibold transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Collapsible Status Panel (draggable) */}
                {showStatusPanel && (isDM || gameContextError || loadingGameContext) && (
                    <div
                        className="absolute z-[130] bg-gradient-to-br from-website-default-900/90 to-website-default-800/80 border border-website-default-700/70 rounded-xl p-0 text-website-default-100 min-w-[260px] shadow-2xl backdrop-blur-md overflow-hidden"
                        style={{ left: statusPanelPos.x, top: statusPanelPos.y }}
                    >
                        <div className="flex items-center justify-between px-3 py-2 bg-website-default-900/70 border-b border-website-default-700/60">
                            <div
                                className="flex items-center gap-2 cursor-move"
                                onMouseDown={(e) => {
                                    if (e.button !== 0) return;
                                    e.preventDefault();
                                    setActiveStatusDrag({ offsetX: e.clientX - (statusPanelPos.x || 0), offsetY: e.clientY - (statusPanelPos.y || 0) });
                                }}
                                title="Drag to move"
                            >
                                <div className="w-6 h-6 flex items-center justify-center rounded bg-website-default-800/60 text-website-default-300">|||</div>
                                <div className="text-[12px] font-semibold text-website-default-100">Status</div>
                            </div>
                            <div className="flex items-center gap-2">
                                {gameContextError ? (
                                <div className="text-sm text-website-specials-300 font-semibold">⚠️</div>
                                ) : loadingGameContext ? (
                                <div className="text-sm text-website-default-300">⟳</div>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => setShowStatusPanel(false)}
                                    className="text-[11px] text-website-default-300 hover:text-website-default-100 px-2 py-1 rounded hover:bg-website-default-800/60"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                        <div className="p-3 text-xs space-y-2">
                            {loadingGameContext && (
                                <div className="text-website-default-300">⟳ Loading game context...</div>
                            )}
                            {gameContextError && (
                                <div className="text-website-specials-300">⚠️ {gameContextError}</div>
                            )}
                            {isDM && autoSaveStatus && (
                                <div className="text-website-highlights-300">💾 {autoSaveStatus}</div>
                            )}
                            {isDM && lastServerUpdate && (
                                <div className="text-website-highlights-200">🔄 Synced: {lastServerUpdate.toLocaleTimeString()}</div>
                            )}
                        </div>
                    </div>
                )}

                <div className="absolute bottom-3 left-3 z-[130] text-xs px-2 py-1 rounded bg-slate-900/70 border border-slate-600 text-slate-100 pointer-events-none">
                    FPS: {Number.isFinite(fps) ? fps : 0}
                </div>
                {isDM && (
                    <div className="absolute bottom-3 left-24 z-[130] text-xs px-2 py-1 rounded bg-slate-900/70 border border-slate-600 text-slate-100 pointer-events-none">
                        Light: {Math.round(cursorLightLevel * 100)}%
                    </div>
                )}

                {/* Combat Turn Order Overlay */}
                {combatActive && combatTurnOrder.length > 0 && (
                    <div
                        className="absolute z-[130] bg-gradient-to-tr from-slate-900/95 to-slate-800/85 border border-slate-700 rounded p-2 text-white min-w-[280px] shadow-2xl backdrop-blur-md"
                        style={{ left: combatPanelPos.x, top: combatPanelPos.y }}
                    >
                        <div className="flex items-center justify-between mb-2 px-1">
                            <div
                                className="flex items-center gap-2 cursor-move select-none"
                                onMouseDown={(e) => {
                                    if (e.button !== 0) return;
                                    e.preventDefault();
                                    setActiveCombatDrag({ offsetX: e.clientX - (combatPanelPos.x || 0), offsetY: e.clientY - (combatPanelPos.y || 0) });
                                }}
                                title="Drag to move"
                            >
                                <div className="w-7 h-7 flex items-center justify-center rounded bg-red-700/30 text-red-200 font-bold">⚔</div>
                                <div className="text-sm font-bold text-red-300 uppercase tracking-wide">Combat Active</div>
                            </div>
                            <div className="text-xs text-slate-300">{combatTurnOrder.length} in order</div>
                        </div>
                        <div className="space-y-1 max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                            {combatTurnOrder.map((charId, idx) => {
                                const char = characters.find(c => toEntityID(c.id) === toEntityID(charId));
                                const isCurrent = toEntityID(charId) === toEntityID(currentCombatCharacterId);
                                return (
                                    <div
                                        key={charId}
                                        className={`text-xs flex items-center justify-between px-2 py-1 rounded ${isCurrent ? "bg-yellow-900/40 text-yellow-200 border border-yellow-700/50" : "text-slate-300 hover:bg-slate-800/40"}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-6 h-6 rounded-full ${isCurrent ? "bg-yellow-500" : "bg-slate-700/40"} flex items-center justify-center text-[10px] font-semibold`}>{idx + 1}</div>
                                            <span className="truncate max-w-[120px]">{char?.name || "Unknown"}</span>
                                        </div>
                                        {isCurrent && <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {GAME_LAYER_REGISTRY.map((layer) => (
                    <canvas
                        key={layer.name}
                        ref={(el) => (layerRefs.current[layer.name] = el)}
                        className="absolute inset-0 w-full h-full"
                        style={{
                            zIndex: layer.zIndex,
                            backgroundColor: layer.name === "background" ? "#1f2937" : "transparent",
                        }}
                    />
                ))}

                {(mapPlacementPreview ||
                    characterPlacementPreview ||
                    lightPlacementPreview ||
                    movementPreview ||
                    selectionBox ||
                    (activeDragObject && dragTarget?.type === "mapObject")) && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-[100]">
                        {mapPlacementPreview && (
                            <g
                                transform={
                                    mapPlacementPreview.rotation
                                        ? `rotate(${mapPlacementPreview.rotation}, ${mapPlacementPreview.x}, ${mapPlacementPreview.y})`
                                        : undefined
                                }
                            >
                                {mapPlacementPreview.type === "rect" && (
                                    <rect
                                        x={
                                            mapPlacementPreview.x -
                                            mapPlacementPreview.width / 2
                                        }
                                        y={
                                            mapPlacementPreview.y -
                                            mapPlacementPreview.height / 2
                                        }
                                        width={mapPlacementPreview.width}
                                        height={mapPlacementPreview.height}
                                        fill={mapPlacementPreview.color}
                                        fillOpacity="0.22"
                                        stroke={mapPlacementPreview.color}
                                        strokeWidth="2"
                                        strokeDasharray="7 5"
                                    />
                                )}
                                {mapPlacementPreview.type === "circle" && (
                                    <circle
                                        cx={mapPlacementPreview.x}
                                        cy={mapPlacementPreview.y}
                                        r={mapPlacementPreview.radius}
                                        fill={mapPlacementPreview.color}
                                        fillOpacity="0.22"
                                        stroke={mapPlacementPreview.color}
                                        strokeWidth="2"
                                        strokeDasharray="7 5"
                                    />
                                )}
                                {mapPlacementPreview.type === "triangle" && (
                                    <polygon
                                        points={mapPlacementPreview.points}
                                        fill={mapPlacementPreview.color}
                                        fillOpacity="0.22"
                                        stroke={mapPlacementPreview.color}
                                        strokeWidth="2"
                                        strokeDasharray="7 5"
                                    />
                                )}
                            </g>
                        )}

                        {lightPlacementPreview && (
                            <>
                                <circle
                                    cx={lightPlacementPreview.x}
                                    cy={lightPlacementPreview.y}
                                    r={lightPlacementPreview.range}
                                    fill="none"
                                    stroke={lightPlacementPreview.color}
                                    strokeOpacity="0.2"
                                    strokeDasharray="10 8"
                                    strokeWidth="2"
                                />
                                <circle
                                    cx={lightPlacementPreview.x}
                                    cy={lightPlacementPreview.y}
                                    r="6"
                                    fill={lightPlacementPreview.color}
                                    fillOpacity="0.6"
                                    stroke="#ffffff"
                                    strokeOpacity="0.5"
                                    strokeWidth="1"
                                />
                            </>
                        )}

                        {characterPlacementPreview && (
                            <>
                                <circle
                                    cx={characterPlacementPreview.x}
                                    cy={characterPlacementPreview.y}
                                    r={characterPlacementPreview.radius}
                                    fill={characterPlacementPreview.color}
                                    fillOpacity="0.22"
                                    stroke={characterPlacementPreview.color}
                                    strokeOpacity="0.8"
                                    strokeWidth="2"
                                    strokeDasharray="5 4"
                                />
                                {characterPlacementFacing && (
                                    <>
                                        <line
                                            x1={characterPlacementPreview.x}
                                            y1={characterPlacementPreview.y}
                                            x2={characterPlacementFacing.x}
                                            y2={characterPlacementFacing.y}
                                            stroke="#ffffff"
                                            strokeOpacity="0.6"
                                            strokeWidth="2"
                                        />
                                        <circle
                                            cx={characterPlacementFacing.x}
                                            cy={characterPlacementFacing.y}
                                            r={FACE_DOT_RADIUS_PX}
                                            fill="#ffffff"
                                            fillOpacity="0.9"
                                            stroke="#111827"
                                            strokeWidth="1"
                                        />
                                    </>
                                )}
                                {characterPlacementPreview.name && (
                                    <text
                                        x={characterPlacementPreview.x}
                                        y={
                                            characterPlacementPreview.y -
                                            characterPlacementPreview.radius -
                                            8
                                        }
                                        fill="#e2e8f0"
                                        fontSize="12"
                                        textAnchor="middle"
                                    >
                                        {characterPlacementPreview.name}
                                    </text>
                                )}
                            </>
                        )}

                        {activeDragObject && dragTarget?.type === 'mapObject' && (() => {
                            const ghostCenter = worldToScreen(activeDragObject.x, activeDragObject.y);
                            const startScreen = worldToScreen(dragTarget.originalX, dragTarget.originalY);
                            const zoom = Number(camera.current?.zoom) || 1;
                            
                            const type = String(activeDragObject.hitbox?.type || activeDragObject.type || "circle").toLowerCase();
                            const scale = Math.max(0.1, Number(activeDragObject.hitbox?.scale) || 1);
                            const rotation = Number(activeDragObject.rotation) || 0;
                            const isBlocked = activeDragObject._blocked;
                            
                            const color = isBlocked ? "#EF4444" : "#3B82F6";
                            const fill = color;
                            const fillOpacity = isBlocked ? "0.1" : "0.15";
                            const stroke = color;
                            const strokeOpacity = isBlocked ? "0.6" : "0.5";
                            const strokeWidth = "2";
                            const outlineStrokeOpacity = "0.3";

                            let shapeElement = null;
                            let outlineElement = null;

                            if (type === 'rect') {
                                const width = Math.max(1, (Number(activeDragObject.width) || 0) * scale) * zoom;
                                const height = Math.max(1, (Number(activeDragObject.height) || 0) * scale) * zoom;
                                const x = ghostCenter.x - width / 2;
                                const y = ghostCenter.y - height / 2;
                                const transform = rotation ? `rotate(${rotation}, ${ghostCenter.x}, ${ghostCenter.y})` : undefined;

                                shapeElement = <rect x={x} y={y} width={width} height={height} transform={transform} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth="2" />;
                                outlineElement = <rect x={x} y={y} width={width} height={height} transform={transform} fill="none" stroke={stroke} strokeOpacity={outlineStrokeOpacity} strokeWidth="2" strokeDasharray="4 4" />;
                            } else if (type === 'triangle') {
                                const size = Math.max(1, (Number(activeDragObject.size) || 0) * scale) * zoom;
                                const s = size / 2;
                                const p1 = { x: 0, y: -s };
                                const p2 = { x: -s, y: s };
                                const p3 = { x: s, y: s };
                                const points = `${ghostCenter.x + p1.x},${ghostCenter.y + p1.y} ${ghostCenter.x + p2.x},${ghostCenter.y + p2.y} ${ghostCenter.x + p3.x},${ghostCenter.y + p3.y}`;
                                const transform = rotation ? `rotate(${rotation}, ${ghostCenter.x}, ${ghostCenter.y})` : undefined;

                                shapeElement = <polygon points={points} transform={transform} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth="2" />;
                                outlineElement = <polygon points={points} transform={transform} fill="none" stroke={stroke} strokeOpacity={outlineStrokeOpacity} strokeWidth="2" strokeDasharray="4 4" />;
                            } else {
                                const radius = Math.max(1, (Number(activeDragObject.size) || 0) * scale / 2) * zoom;
                                shapeElement = <circle cx={ghostCenter.x} cy={ghostCenter.y} r={radius} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth="2" />;
                                outlineElement = <circle cx={ghostCenter.x} cy={ghostCenter.y} r={radius} fill="none" stroke={stroke} strokeOpacity={outlineStrokeOpacity} strokeWidth="2" strokeDasharray="4 4" />;
                            }

                            return (
                                <>
                                    {startScreen && (
                                        <line
                                            x1={startScreen.x}
                                            y1={startScreen.y}
                                            x2={ghostCenter.x}
                                            y2={ghostCenter.y}
                                            stroke={color}
                                            strokeOpacity="0.5"
                                            strokeWidth="2"
                                            strokeDasharray="6 4"
                                        />
                                    )}
                                    {outlineElement}
                                    {shapeElement}
                                </>
                            );
                        })()}

                        {movementPreview && (() => {
                            const ghostCenter = worldToScreen(movementPreview.ghostX, movementPreview.ghostY);
                            const zoom = Number(camera.current?.zoom) || 1;
                            const draggingChar = characters.find(
                                (char) => toEntityID(char?.id) === toEntityID(movementPreview.characterId)
                            );
                            
                            if (!draggingChar) return null;

                            const team = String(draggingChar?.team || "player").toLowerCase();
                            const color = TEAM_PREVIEW_COLORS[team] || TEAM_PREVIEW_COLORS.neutral;
                            const startScreen = worldToScreen(draggingChar.position.x, draggingChar.position.y);
                            
                            const type = String(draggingChar.hitbox?.type || draggingChar.type || "circle").toLowerCase();
                            const scale = Math.max(0.1, Number(draggingChar.hitbox?.scale) || 1);
                            const rotation = Number(draggingChar.rotation) || 0;

                            let shapeElement = null;
                            let outlineElement = null;
                            let approxRadius = 0;

                            const fill = color;
                            const fillOpacity = movementPreview.blocked ? "0.1" : "0.15";
                            const stroke = movementPreview.blocked ? "#ef4444" : color;
                            const strokeOpacity = movementPreview.blocked ? "0.6" : "0.5";
                            const outlineStrokeOpacity = "0.3";

                            if (type === 'rect') {
                                const width = Math.max(1, (Number(draggingChar.width) || 0) * scale) * zoom;
                                const height = Math.max(1, (Number(draggingChar.height) || 0) * scale) * zoom;
                                const x = ghostCenter.x - width / 2;
                                const y = ghostCenter.y - height / 2;
                                const transform = rotation ? `rotate(${rotation}, ${ghostCenter.x}, ${ghostCenter.y})` : undefined;
                                approxRadius = Math.max(width, height) / 2;

                                shapeElement = <rect x={x} y={y} width={width} height={height} transform={transform} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth="2" />;
                                outlineElement = <rect x={x} y={y} width={width} height={height} transform={transform} fill="none" stroke={stroke} strokeOpacity={outlineStrokeOpacity} strokeWidth="2" strokeDasharray="4 4" />;
                            } else if (type === 'triangle') {
                                const size = Math.max(1, (Number(draggingChar.size) || 0) * scale) * zoom;
                                const s = size / 2;
                                const p1 = { x: 0, y: -s };
                                const p2 = { x: -s, y: s };
                                const p3 = { x: s, y: s };
                                const points = `${ghostCenter.x + p1.x},${ghostCenter.y + p1.y} ${ghostCenter.x + p2.x},${ghostCenter.y + p2.y} ${ghostCenter.x + p3.x},${ghostCenter.y + p3.y}`;
                                const transform = rotation ? `rotate(${rotation}, ${ghostCenter.x}, ${ghostCenter.y})` : undefined;
                                approxRadius = s;

                                shapeElement = <polygon points={points} transform={transform} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth="2" />;
                                outlineElement = <polygon points={points} transform={transform} fill="none" stroke={stroke} strokeOpacity={outlineStrokeOpacity} strokeWidth="2" strokeDasharray="4 4" />;
                            } else {
                                const radius = Math.max(4, movementPreview.walkableRadius * zoom);
                                approxRadius = radius;
                                shapeElement = <circle cx={ghostCenter.x} cy={ghostCenter.y} r={radius} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth="2" />;
                                outlineElement = <circle cx={ghostCenter.x} cy={ghostCenter.y} r={radius} fill="none" stroke={stroke} strokeOpacity={outlineStrokeOpacity} strokeWidth="2" strokeDasharray="4 4" />;
                            }
                            
                            return (
                                <>
                                    {startScreen && (
                                        <line
                                            x1={startScreen.x}
                                            y1={startScreen.y}
                                            x2={ghostCenter.x}
                                            y2={ghostCenter.y}
                                            stroke={movementPreview.blocked ? "#ef4444" : color}
                                            strokeOpacity="0.5"
                                            strokeWidth="2"
                                            strokeDasharray="6 4"
                                        />
                                    )}
                                    {outlineElement}
                                    {shapeElement}
                                    {(() => {
                                        const facingRad = (getFacingAngle(draggingChar.rotation) * Math.PI) / 180;
                                        const dotDistance = approxRadius + 8;
                                        return (
                                            <>
                                                <line
                                                    x1={ghostCenter.x}
                                                    y1={ghostCenter.y}
                                                    x2={ghostCenter.x + Math.cos(facingRad) * dotDistance}
                                                    y2={ghostCenter.y + Math.sin(facingRad) * dotDistance}
                                                    stroke={movementPreview.blocked ? "#fca5a5" : "#e0e7ff"}
                                                    strokeOpacity={movementPreview.blocked ? "0.4" : "0.5"}
                                                    strokeWidth="1.5"
                                                />
                                                <circle
                                                    cx={ghostCenter.x + Math.cos(facingRad) * dotDistance}
                                                    cy={ghostCenter.y + Math.sin(facingRad) * dotDistance}
                                                    r={3}
                                                    fill={movementPreview.blocked ? "#fca5a5" : "#e0e7ff"}
                                                    fillOpacity={movementPreview.blocked ? "0.6" : "0.7"}
                                                />
                                            </>
                                        );
                                    })()}
                                </>
                            );
                        })()}

                        {/* Range circle shown while targeting a movement destination */}
                        {movementPreview?.isTargeting && (() => {
                            const movingChar = characters.find(
                                (c) => toEntityID(c?.id) === toEntityID(movementPreview.characterId)
                            );
                            if (!movingChar) return null;
                            const origin = worldToScreen(
                                Number(movingChar.position.x) || 0,
                                Number(movingChar.position.y) || 0
                            );
                            const zoom = Number(camera.current?.zoom) || 1;
                            const rangeR = (movementPreview.maxMoveRadius || 0) * zoom;
                            const team = String(movingChar?.team || "player").toLowerCase();
                            const color = TEAM_PREVIEW_COLORS[team] || TEAM_PREVIEW_COLORS.neutral;
                            return (
                                <>
                                    <circle
                                        cx={origin.x} cy={origin.y} r={rangeR}
                                        fill={color} fillOpacity="0.06"
                                        stroke={color} strokeOpacity="0.35"
                                        strokeWidth="1.5" strokeDasharray="8 5"
                                    />
                                    {(() => {
                                        const ghost = worldToScreen(movementPreview.ghostX, movementPreview.ghostY);
                                        const blocked = movementPreview.blocked;
                                        return <circle cx={ghost.x} cy={ghost.y} r={4} fill={blocked ? "#ef4444" : color} />;
                                    })()}
                                </>
                            );
                        })()}

                        {selectionBox && (() => {
                            const x = Math.min(selectionBox.startX, selectionBox.currentX);
                            const y = Math.min(selectionBox.startY, selectionBox.currentY);
                            const w = Math.abs(selectionBox.currentX - selectionBox.startX);
                            const h = Math.abs(selectionBox.currentY - selectionBox.startY);
                            return (
                                <rect
                                    x={x} y={y} width={w} height={h}
                                    fill="rgba(59, 130, 246, 0.1)"
                                    stroke="rgba(59, 130, 246, 0.6)"
                                    strokeWidth="1"
                                />
                            );
                        })()}
                    </svg>
                )}

                <div
                    className="absolute bottom-4 z-[132] flex items-center gap-2"
                    style={{ right: Math.max(12, sideWidth + 12) }}
                >
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setViewMenuOpen(!viewMenuOpen)}
                            className="h-9 px-3 rounded-md bg-gradient-to-b from-website-default-900/90 to-website-default-800/80 border border-website-default-700 text-website-default-200 text-[11px] flex items-center gap-2 hover:border-website-highlights-400/70 hover:text-website-highlights-200 hover:bg-website-default-800/90 transition-colors shadow-sm focus:outline-none"
                        >
                            <span>{MAP_VIEWS[activeViewId]?.label || "View"}</span>
                            <svg className="w-3 h-3 text-website-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        
                        {viewMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-[140]" onClick={() => setViewMenuOpen(false)} />
                                <div className="absolute bottom-full right-0 mb-2 w-40 bg-website-default-900/95 border border-website-highlights-500/20 rounded-lg shadow-[0_12px_30px_rgba(15,52,96,0.35)] overflow-hidden z-[150]">
                                    {Object.values(MAP_VIEWS).map((view) => (
                                        <button
                                            key={view.id}
                                            type="button"
                                            onClick={() => {
                                                setActiveViewId(view.id);
                                                setViewMenuOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-[11px] hover:bg-website-highlights-500/10 ${activeViewId === view.id ? "text-website-highlights-300 font-semibold" : "text-website-default-200"}`}
                                        >
                                            {view.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={stepZLevelDown}
                        className="h-9 min-w-9 px-2 rounded-md bg-gradient-to-b from-website-default-900/90 to-website-default-800/80 border border-website-default-700 text-website-default-100 text-[11px] hover:border-website-highlights-400/70 hover:bg-website-default-800/90 transition-colors shadow-sm"
                        title="Go down one z-level (Shift)"
                    >
                        Z-
                    </button>
                    <span className="h-9 px-3 flex items-center rounded-md bg-website-default-900/70 border border-website-highlights-500/20 text-website-default-300 text-[11px]">
                        Level {currentZLevel}
                    </span>
                    <button
                        type="button"
                        onClick={stepZLevelUp}
                        className="h-9 min-w-9 px-2 rounded-md bg-gradient-to-b from-website-default-900/90 to-website-default-800/80 border border-website-default-700 text-website-default-100 text-[11px] hover:border-website-highlights-400/70 hover:bg-website-default-800/90 transition-colors shadow-sm"
                        title="Go up one z-level (Space)"
                    >
                        Z+
                    </button>
                </div>

                {contextMenu && contextMenuPos && (
    <div
        ref={contextMenuRef}
        className="absolute z-50 min-w-[200px] max-w-[260px] resize overflow-auto rounded-xl border border-website-highlights-500/30 bg-website-default-900/95 text-website-default-100 shadow-[0_16px_40px_rgba(15,52,96,0.35)] ring-1 ring-website-default-700/60 backdrop-blur-md font-body text-[12px]"
        style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
        onContextMenu={(event) => event.preventDefault()}
        onMouseDown={(e) => e.stopPropagation()}
    >
        <div
            className="px-3 py-2 border-b border-website-highlights-500/30 flex items-center justify-between gap-2 cursor-move select-none bg-gradient-to-r from-website-default-900/95 via-website-default-900/85 to-website-highlights-500/15"
            onMouseDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                setContextMenuDragOffset({ x: e.clientX - contextMenuPos.x, y: e.clientY - contextMenuPos.y });
            }}
        >
            <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[10px] uppercase tracking-[0.22em] text-website-highlights-300">
                    {contextMenu?.target?.type === "character"
                        ? "Character Actions"
                        : "Object Actions"}
                </span>
                {contextMenu?.target?.type === "character" && contextCharacter?.name && (
                    <span className="text-[11px] font-semibold text-website-default-100 truncate max-w-[180px]">
                        {contextCharacter.name}
                    </span>
                )}
            </div>
            <button
                type="button"
                aria-label="Close"
                onClick={() => setContextMenu(null)}
                className="text-website-default-300 hover:text-website-default-100 hover:bg-website-highlights-500/10 rounded-md text-[11px] font-semibold leading-none"
            >
                X
            </button>
        </div>
        <div className="py-1">
            {contextMenu?.target?.type === "character" && (
                <>
                    {(isDM || canControlCharacterId(contextMenu?.target?.id)) && contextActionMenu && (
                        <>
                            {/* Tabs */}
                            <div className="flex border-b border-website-highlights-500/20 mb-1 bg-website-default-900/60">
                                {CONTEXT_TABS.map((tab) => {
                                    if (tab.key === "movement" && contextActionMenu) {
                                        console.log("[ContextMenuDebug] Rendering movement tab");
                                    }
                                    return (
                                    <button
                                        key={tab.key}
                                        onClick={() => {
                                            setActiveContextTab(tab.key);
                                            setContextTabTrails((prev) => ({ ...prev, [tab.key]: [] }));
                                        }}
                                        className={`flex-1 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] rounded-t transition-colors ${
                                            activeContextTab === tab.key
                                                ? "text-website-highlights-200 border-b-2 border-website-highlights-400 bg-website-highlights-500/20"
                                                : "text-website-default-400 hover:text-website-highlights-200 hover:bg-website-highlights-500/10"
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                    );
                                })}
                            </div>

                            
                                {(contextTabTrails[activeContextTab] || []).length > 0 && activeTabNode?.label && (
                                <div className="px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-website-highlights-300 bg-website-default-800/40 rounded-md mx-2 mt-1">
                                    {activeTabNode.label}
                                </div>
                            )}
                            
                            {/* Tab items */}
                            {(() => {
                                if (activeContextTab === "movement" && contextActionMenu) {
                                    console.log("[ContextMenuDebug] Movement tab - items:", activeTabItems.map(i => ({ label: i.label, type: i.type, actionId: i.action?.id })));
                                }
                                return null;
                            })()}
                            {loadingActionCharacterId === contextCharacterId && (
                                <div className="px-3 py-2 text-[11px] text-website-default-300 bg-website-default-800/40 rounded-md mx-2">Loading actions...</div>
                            )}
                            {activeTabItems.length === 0 && loadingActionCharacterId !== contextCharacterId && (
                                <div className="px-3 py-2 text-[11px] text-website-default-400 bg-website-default-800/40 rounded-md mx-2">No actions available.</div>
                            )}
                            {activeTabItems.map((item) => {
                                if (item.type === "folder") {
                                    return (
                                        <button
                                            key={item.node?.path || item.node?.key}
                                            onClick={() => pushTabTrail(activeContextTab, item.node)}
                                            disabled={item.disabled}
                                            className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-default-100 hover:bg-website-highlights-500/10 disabled:text-website-default-500 flex items-center justify-between border-l-2 border-transparent hover:border-website-highlights-400 transition-colors"
                                        >
                                            <span>{item.label}</span>
                                            <span className="text-website-highlights-300">{">"}</span>
                                        </button>
                                    );
                                }
                                return (
                                    <button
                                        key={item.action?.path || item.action?.id}
                                        onClick={() => handleContextAction(item.action)}
                                        disabled={item.action?.enabled === false}
                                        title={item.action?.description || ""}
                                        className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-default-100 hover:bg-website-highlights-500/10 disabled:text-website-default-500 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors"
                                    >
                                        {item.label}
                                    </button>
                                );
                            })}

                            {contextActionData && (
                                <button
                                    onClick={() => fetchCharacterActions(contextCharacterId, { force: true })}
                                className="w-full px-3 py-1.5 text-left text-[11px] text-website-highlights-300 hover:text-website-highlights-200 hover:bg-website-highlights-500/10 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors"
                                >
                                    Refresh Actions
                                </button>
                            )}
                            {/* Breadcrumb back button */}
                            {(contextTabTrails[activeContextTab] || []).length > 0 && (
                                <button
                                    onClick={() => popTabTrail(activeContextTab)}
                                    className="w-full px-3 py-1.5 text-left text-[11px] text-website-default-300 hover:text-website-highlights-200 hover:bg-website-highlights-500/10 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors"
                                >
                                    {"< Back"}
                                </button>
                            )}
                            
                                                <div className="border-t border-website-highlights-500/20 my-1" />

                            
                        </>
                    )}

                    {/* Fallback: no action tree yet */}
                    {(isDM || canControlCharacterId(contextMenu?.target?.id)) && !contextActionMenu && (
                        <>
                            {loadingActionCharacterId === contextCharacterId && (
                                <div className="px-3 py-2 text-[11px] text-website-default-300 bg-website-default-800/40 rounded-md mx-2">Loading actions...</div>
                            )}
                            {loadingActionCharacterId !== contextCharacterId && !contextActionData && (
                                <button
                                    onClick={() => fetchCharacterActions(contextCharacterId, { force: true })}
                                    className="w-full px-3 py-1.5 text-left text-[12px] font-semibold text-website-highlights-300 bg-website-highlights-500/10 hover:bg-website-highlights-500/20 border-l-2 border-website-highlights-400 transition-colors"
                                >
                                    Load Actions
                                </button>
                            )}
                            {contextActionGroups.map((group, groupIndex) => (
                                <div key={group.key} className="py-1">
                                    <div className="px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-website-highlights-300 bg-website-default-800/40 rounded-md mx-2">{group.label}</div>
                                    {group.actions.map((action) => (
                                        <button
                                            key={action.path || action.id}
                                            onClick={() => handleContextAction(action)}
                                            disabled={action.enabled === false}
                                            className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-default-100 hover:bg-website-highlights-500/10 disabled:text-website-default-500 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors"
                                        >
                                            {action.name || action.path}
                                        </button>
                                    ))}
                                    {groupIndex < contextActionGroups.length - 1 && (
                                                <div className="border-t border-website-highlights-500/20 my-1" />
                                    )}
                                </div>
                            ))}
                                            <div className="border-t border-website-highlights-500/20 my-1" />
                        </>
                    )}

                    <button onClick={() => handleContextAction("center")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-default-100 hover:bg-website-highlights-500/10 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors">Center Camera</button>
                    <button onClick={() => handleContextAction("info")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-default-100 hover:bg-website-highlights-500/10 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors">Inspect</button>
                    {canViewCharacterSheet && (
                        <button onClick={() => handleContextAction("viewSheet")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-default-200 hover:bg-website-highlights-500/10 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors">View Sheet</button>
                    )}
                    {(isDM || canControlCharacterId(contextMenu?.target?.id)) && (
                        <>
                            <div className="border-t border-website-highlights-500/20 my-1" />
                            <button onClick={() => handleContextAction("placeHere")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-highlights-300 hover:bg-website-highlights-500/20 border-l-2 border-website-highlights-400 transition-colors">Place Character Here</button>
                        </>
                    )}
                    {isDM && (
                        <>
                            <button onClick={() => handleContextAction("toggleTeam")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-default-100 hover:bg-website-highlights-500/10 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors">Toggle Team</button>
                            <button onClick={() => handleContextAction("endTurn")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-highlights-200 hover:bg-website-highlights-500/20 border-l-2 border-website-highlights-400 transition-colors">End Turn + Autosave</button>
                            <button onClick={() => handleContextAction("delete")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-specials-400 hover:bg-website-specials-500/15 border-l-2 border-website-specials-400 transition-colors">Delete Character</button>
                        </>
                    )}
                </>
            )}

            {contextMenu?.target?.type === "mapObject" && (
                <>
                    <button onClick={() => handleContextAction("inspect")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-default-100 hover:bg-website-highlights-500/10 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors">Inspect</button>
                    <button onClick={() => handleContextAction("center")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-default-100 hover:bg-website-highlights-500/10 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors">Center Camera</button>
                    {isDM && (
                        <>
                            <div className="border-t border-website-highlights-500/20 my-1" />
                            <button onClick={() => handleContextAction("damage10")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-default-100 hover:bg-website-highlights-500/10 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors">Damage 10</button>
                            <button onClick={() => handleContextAction("heal10")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-default-100 hover:bg-website-highlights-500/10 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors">Heal 10</button>
                            <button onClick={() => handleContextAction("delete")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-specials-400 hover:bg-website-specials-500/15 border-l-2 border-website-specials-400 transition-colors">Delete Object</button>
                            <button onClick={() => handleContextAction("duplicate")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-default-100 hover:bg-website-highlights-500/10 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors">Duplicate</button>
                            <button onClick={() => handleContextAction("bringForward")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-default-100 hover:bg-website-highlights-500/10 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors">Bring Forward (Z+)</button>
                            <button onClick={() => handleContextAction("sendBackward")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-default-100 hover:bg-website-highlights-500/10 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors">Send Backward (Z-)</button>
                            <button onClick={() => handleContextAction("toggleIndestructible")} className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-website-default-100 hover:bg-website-highlights-500/10 border-l-2 border-transparent hover:border-website-highlights-400 transition-colors">Toggle Indestructible</button>
                        </>
                    )}
                </>
            )}
        </div>
    </div>
)}
                <InfoWindows
                    infoPanels={infoPanels}
                    setInfoPanels={setInfoPanels}
                    clampInfoPanelPosition={clampInfoPanelPosition}
                    closeInfoPanel={closeInfoPanel}
                    characters={characters}
                    mapObjects={mapObjects}
                    floorTypesByID={floorTypesByID}
                    isDM={isDM}
                    updateMapObject={updateMapObject}
                    updateCharacter={updateCharacter}
                    minRectWorldSize={MIN_RECT_WORLD_SIZE}
                    minShapeWorldSize={MIN_SHAPE_WORLD_SIZE}
                    characterOwnershipById={characterOwnershipById}
                    playerID={playerID}
                    selectedCharacterId={selectedChar}
                />
            </div>

            <div
                className="grid h-full min-h-0 overflow-hidden bg-gray-800 absolute top-0 right-0"
                style={{ gridTemplateColumns: `1fr 6px ${sideWidth}px`, zIndex: 120 }}
            >
                <div
                    className="bg-gray-700 cursor-col-resize hover:bg-gray-500 col-start-2"
                    onMouseDown={handleResizerMouseDown}
                />
                <GameSidePanel 
                    ownedCharacterIds={ownedCharacterIds}
                    visionRayCount={visionRayCount}
                    onVisionRayCountChange={handleVisionRayCountChange}
                    onForceVisionRerender={handleForceVisionRerender}
                    visionDebug={visionDebug}
                    journalState={journalState}
                    onUpdateJournalState={setJournalState}
                    questState={questState}
                    onUpdateQuestState={setQuestState}
                    playerID={playerID}
                    campaignID={gameID}
                />
            </div>

            {/* Dice Roll Gallery for combat initiative and actions */}
            {showDiceGallery && diceRolls.length > 0 && (
                <DiceRollGallery
                    rolls={diceRolls}
                    onClose={closeDiceGallery}
                    playerCharacterId={primaryCharacterId}
                />
            )}
        </div>
    );
}

export default GameComponent;
