// c:\Projects\client\src\pages\game\gameUtils.js
import { checkCollision, getCollisionShape } from "./collisionSystem";
import { 
    HEIGHT_HANDLE_OFFSET_PX, 
    RESIZE_HANDLE_HIT_RADIUS_PX, 
    MIN_RECT_WORLD_SIZE, 
    MIN_SHAPE_WORLD_SIZE,
    DEFAULT_MAX_HP_BY_TERRAIN
} from "./gameConstants";
import { HEIGHT_UNITS_PER_ZLEVEL } from "./Map Layers/mapLayerShared";

export function normalizeAngleDegrees(value) {
    const raw = Number(value) || 0;
    const normalized = raw % 360;
    return normalized < 0 ? normalized + 360 : normalized;
}

export function getFacingAngle(rotation) {
    return (Number(rotation) || 0) - 90;
}

export function getObjectVisibilityRadius(obj) {
    if (!obj) return 8;
    const type = String(obj?.type || "circle").toLowerCase();
    if (type === "rect") {
        const halfW = Math.max(1, Number(obj?.width) || 0) / 2;
        const halfH = Math.max(1, Number(obj?.height) || 0) / 2;
        return Math.max(8, Math.hypot(halfW, halfH));
    }
    return Math.max(8, (Number(obj?.size) || 0) / 2);
}

export function isPointInsideMapObject(worldX, worldY, obj, probeSize = 0.1) {
    if (!obj) return false;
    return checkCollision({ x: worldX, y: worldY, size: probeSize, type: "circle" }, obj);
}

export function findTopMapObjectAt(worldX, worldY, mapObjects = []) {
    const terrainPriority = (terrainType) => {
        const terrain = String(terrainType || "").toLowerCase();
        if (terrain === "obstacle") return 3;
        if (terrain === "wall") return 2;
        if (terrain === "floor") return 1;
        return 0;
    };
    const sorted = [...mapObjects].sort((a, b) => {
        const zDiff = (Number(b?.z) || 0) - (Number(a?.z) || 0);
        if (zDiff !== 0) return zDiff;
        return terrainPriority(b?.terrainType) - terrainPriority(a?.terrainType);
    });
    return sorted.find((obj) => isPointInsideMapObject(worldX, worldY, obj)) || null;
}

export function toEntityID(value) {
    return String(value ?? "").trim();
}

export function wouldCharacterCollideWithObstacles(charX, charY, charRadius, mapObjects = [], excludeObjIds = []) {
    const charEntity = { x: charX, y: charY, size: charRadius * 2, type: "circle" };
    for (const obj of mapObjects) {
        if (excludeObjIds.includes(toEntityID(obj?.id))) continue;
        const terrainType = String(obj?.terrainType || "").toLowerCase();
        if (terrainType === "floor") continue; 
        
        if (checkCollision(charEntity, obj)) return true;
    }
    return false;
}

export function getClosestBlockingCharacter(charX, charY, charRadius, characters = [], excludeCharId = null) {
    let closest = null;
    let minDist = Infinity;
    
    for (const otherChar of characters) {
        if (excludeCharId && toEntityID(otherChar?.id) === toEntityID(excludeCharId)) continue;
        
        const otherX = Number(otherChar?.position?.x) || 0;
        const otherY = Number(otherChar?.position?.y) || 0;
        const otherRadius = Math.max(1, (Number(otherChar?.size) || 0) / 2);
        
        const dx = charX - otherX;
        const dy = charY - otherY;
        const dist = Math.hypot(dx, dy);
        
        if (dist < charRadius + otherRadius) {
            if (dist < minDist) {
                minDist = dist;
                closest = { char: otherChar, dx, dy, dist };
            }
        }
    }
    return closest;
}

export function adjustPositionBeforeCollision(charX, charY, charRadius, blocker) {
    if (!blocker) return { x: charX, y: charY };
    
    const otherX = Number(blocker.char?.position?.x) || 0;
    const otherY = Number(blocker.char?.position?.y) || 0;
    const otherRadius = Math.max(1, (Number(blocker.char?.size) || 0) / 2);
    
    const dx = blocker.dx;
    const dy = blocker.dy;
    const currentDist = Math.hypot(dx, dy);
    
    const minDist = charRadius + otherRadius + 1; 
    
    if (currentDist < 0.001) {
        return { x: otherX + minDist, y: otherY };
    }

    const ratio = minDist / currentDist;
    const adjX = otherX + dx * ratio;
    const adjY = otherY + dy * ratio;
    
    return { x: adjX, y: adjY };
}

export function getCharacterTokenId(token) {
    return (
        toEntityID(token?.id) ||
        toEntityID(token?._id) ||
        toEntityID(token?.characterId) ||
        toEntityID(token?.characterID)
    );
}

export function getCharacterOwnerId(token) {
    return (
        toEntityID(token?.playerId) ||
        toEntityID(token?.playerID) ||
        toEntityID(token?.ownerId) ||
        toEntityID(token?.ownerID) ||
        toEntityID(token?.owner?._id) ||
        toEntityID(token?.owner?.id) ||
        toEntityID(token?.player?._id) ||
        toEntityID(token?.player?.id)
    );
}

export function extractOwnedCharacterIdsFromSnapshot(snapshot, playerID) {
    const ownerId = toEntityID(playerID);
    if (!ownerId) return [];
    const chars = Array.isArray(snapshot?.characters) ? snapshot.characters : [];
    const owned = new Set();
    chars.forEach((char) => {
        const charOwner = getCharacterOwnerId(char);
        if (!charOwner || charOwner !== ownerId) return;
        const charId = getCharacterTokenId(char);
        if (charId) owned.add(charId);
    });
    return Array.from(owned);
}

export function extractOwnedCharacterIdsFromOwnershipMap(ownershipMap, playerID) {
    const ownerId = toEntityID(playerID);
    if (!ownerId || !ownershipMap || typeof ownershipMap !== "object") return [];
    const raw =
        ownershipMap[ownerId] ||
        ownershipMap[playerID] ||
        ownershipMap[String(ownerId)];
    if (!Array.isArray(raw)) return [];
    return raw.map((id) => toEntityID(id)).filter(Boolean);
}

export function mergeUniqueIds(...lists) {
    const merged = new Set();
    lists.forEach((list) => {
        (Array.isArray(list) ? list : []).forEach((id) => {
            const normalized = toEntityID(id);
            if (normalized) merged.add(normalized);
        });
    });
    return Array.from(merged);
}

export function isSameEntity(a, b) {
    if (!a || !b) return false;
    return String(a.type || "") === String(b.type || "") && toEntityID(a.id) === toEntityID(b.id);
}

export function getObjectZLevel(obj) {
    return Math.round(Number(obj?.zLevel) || 0);
}

export function getMapObjectBounds(obj) {
    const shape = getCollisionShape(obj);
    if (!shape) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    
    if (shape.type === "circle") {
        return {
            minX: shape.x - shape.radius,
            maxX: shape.x + shape.radius,
            minY: shape.y - shape.radius,
            maxY: shape.y + shape.radius
        };
    } else {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const v of shape.vertices) {
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
        }
        return { minX, maxX, minY, maxY };
    }
}

export function doBoundsOverlap(a, b) {
    return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

export function isSolidObject(obj) {
    const terrain = String(obj?.terrainType || "").trim().toLowerCase();
    return terrain === "wall" || terrain === "obstacle";
}

export function doPreciseOverlap(objA, objB) {
    return checkCollision(objA, objB);
}

export function wouldObjectOverlapAtPosition(candidate, objects = [], ignoreId = null) {
    if (!isSolidObject(candidate)) return false;

    const candidateBounds = getMapObjectBounds(candidate);
    const candidateLevel = getObjectZLevel(candidate);
    const ignoreKey = ignoreId == null ? "" : toEntityID(ignoreId);

    return (Array.isArray(objects) ? objects : []).some((obj) => {
        if (!isSolidObject(obj)) return false;
        
        const objLevel = getObjectZLevel(obj);
        let isRelevant = objLevel === candidateLevel;
        
        if (!isRelevant && objLevel < candidateLevel) {
             const elevHeight = Math.max(0, Number(obj?.elevationHeight) || 0);
             const topZLevel = objLevel + Math.floor(elevHeight / HEIGHT_UNITS_PER_ZLEVEL);
             if (topZLevel >= candidateLevel) isRelevant = true;
        }
        
        if (!isRelevant) return false;
        if (ignoreKey && toEntityID(obj?.id) === ignoreKey) return false;
        
        if (!doBoundsOverlap(candidateBounds, getMapObjectBounds(obj))) return false;
        return doPreciseOverlap(candidate, obj);
    });
}

export function worldToScreenWithCamera(cameraSnapshot, worldX, worldY) {
    return {
        x: worldX * cameraSnapshot.zoom - cameraSnapshot.x,
        y: worldY * cameraSnapshot.zoom - cameraSnapshot.y,
    };
}

export function buildResizeHandlesForObject(obj, cameraSnapshot) {
    if (!obj || !cameraSnapshot) return [];
    const bounds = getMapObjectBounds(obj);
    const topLeft = worldToScreenWithCamera(cameraSnapshot, bounds.minX, bounds.minY);
    const topRight = worldToScreenWithCamera(cameraSnapshot, bounds.maxX, bounds.minY);
    const bottomRight = worldToScreenWithCamera(cameraSnapshot, bounds.maxX, bounds.maxY);
    const bottomLeft = worldToScreenWithCamera(cameraSnapshot, bounds.minX, bounds.maxY);
    const topCenter = worldToScreenWithCamera(
        cameraSnapshot,
        (bounds.minX + bounds.maxX) / 2,
        bounds.minY
    );

    return [
        { id: "nw", x: topLeft.x, y: topLeft.y },
        { id: "ne", x: topRight.x, y: topRight.y },
        { id: "se", x: bottomRight.x, y: bottomRight.y },
        { id: "sw", x: bottomLeft.x, y: bottomLeft.y },
        { id: "height", x: topCenter.x, y: topCenter.y - HEIGHT_HANDLE_OFFSET_PX },
    ];
}

export function findResizeHandleAtScreenPoint(screenX, screenY, handles = []) {
    return handles.find((handle) => {
        const dx = screenX - handle.x;
        const dy = screenY - handle.y;
        return dx * dx + dy * dy <= RESIZE_HANDLE_HIT_RADIUS_PX * RESIZE_HANDLE_HIT_RADIUS_PX;
    }) || null;
}

export function getResizeAnchorForHandle(handleID, bounds) {
    if (!bounds) return null;
    if (handleID === "nw") return { x: bounds.maxX, y: bounds.maxY };
    if (handleID === "ne") return { x: bounds.minX, y: bounds.maxY };
    if (handleID === "se") return { x: bounds.minX, y: bounds.minY };
    if (handleID === "sw") return { x: bounds.maxX, y: bounds.minY };
    return null;
}

export function isTypingTarget(target) {
    if (!target || typeof target !== "object") return false;
    const tag = String(target.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return Boolean(target.isContentEditable);
}

export function resolveDMPermission(response, playerID) {
    const explicitPermission = response?.permissions?.isDM;
    if (typeof explicitPermission === "boolean") return explicitPermission;
    if (typeof explicitPermission === "string") {
        const normalized = explicitPermission.trim().toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
    }

    const dmID = String(response?.campaign?.dmId || "").trim();
    const normalizedPlayerID = String(playerID || "").trim();
    return Boolean(dmID && normalizedPlayerID && dmID === normalizedPlayerID);
}

export function buildPlacementFromDrag(placementConfig, startWorld, endWorld) {
    const type = String(placementConfig?.type || "circle").toLowerCase();
    const centerX = (startWorld.x + endWorld.x) / 2;
    const centerY = (startWorld.y + endWorld.y) / 2;
    const deltaX = Math.abs(endWorld.x - startWorld.x);
    const deltaY = Math.abs(endWorld.y - startWorld.y);

    if (type === "rect") {
        return {
            x: Math.round(centerX),
            y: Math.round(centerY),
            overrides: {
                width: Math.max(MIN_RECT_WORLD_SIZE, Math.round(deltaX)),
                height: Math.max(MIN_RECT_WORLD_SIZE, Math.round(deltaY)),
            },
        };
    }

    const size = Math.max(MIN_SHAPE_WORLD_SIZE, Math.round(Math.max(deltaX, deltaY)));
    return {
        x: Math.round(centerX),
        y: Math.round(centerY),
        overrides: { size },
    };
}
