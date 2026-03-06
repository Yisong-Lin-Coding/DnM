/**
 * Advanced Vision System
 * Implements cone-based, fuel-driven perception with main, peripheral, and close-range detection.
 */

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

// Game rotation: 0 = up, 90 = right (client convention)
// Convert to math angle where 0 = right for atan2 comparisons.
const getFacingAngleDegrees = (rotation) => normalizeAngle(toNumber(rotation, 0) - 90);

/**
 * Vision configuration extracted from character.vision getter
 * @typedef {Object} VisionConfig
 * @property {number} distance - Maximum vision distance (fuel units)
 * @property {number} angle - Main cone angle in degrees
 * @property {number} radius - Close-range perception radius
 */

/**
 * Vision context with modifiers from environment/effects
 * @typedef {Object} VisionContext
 * @property {number} fuelCost - Fuel consumed per unit distance (default 1.0)
 * @property {number} luminosityModifier - How light/dark affects fuel (1.0 = normal, 0.5 = half cost in light)
 * @property {boolean} enabled - Whether vision is active
 */

const DEFAULT_VISION_CONTEXT = {
    fuelCost: 1.0,
    // Normal ambient light (0.5) maps to 0.65 modifier with the default formula.
    luminosityModifier: 0.65,
    enabled: true,
};

/**
 * Builds vision zones from character data
 * @param {Object} character - Character with position and rotation
 * @param {Object} visionConfig - Vision configuration from character.vision
 * @returns {Object} Vision zones with main, peripheral, and closeRange
 */
function buildVisionZones(character = {}, visionConfig = {}) {
    const pos = character.position || { x: 0, y: 0 };
    const rotation = toNumber(character.rotation, 0);
    const distance = toNumber(visionConfig.distance, 100);
    const angle = Math.max(0, Math.min(360, toNumber(visionConfig.angle, 60)));
    const radius = Math.max(0, toNumber(visionConfig.radius, 5));

    return {
        main: {
            x: toNumber(pos.x),
            y: toNumber(pos.y),
            distance,
            angle,
            rotation,
            visionType: 'main',
        },
        peripheral: {
            x: toNumber(pos.x),
            y: toNumber(pos.y),
            distance,
            angle: angle / 2, // Half angle on each side
            rotation,
            visionType: 'peripheral',
        },
        closeRange: {
            x: toNumber(pos.x),
            y: toNumber(pos.y),
            radius,
            visionType: 'closeRange',
        },
    };
}

/**
 * Calculates fuel cost to see a point
 * @param {number} distance - Distance to point
 * @param {Object} visionZone - Vision zone configuration
 * @param {Object} context - Vision context with modifiers
 * @returns {number} Fuel cost (0 if visible with full fuel, 1.0 if exhausts fuel)
 */
function calculateFuelCost(distance, visionZone, context = {}) {
    const config = { ...DEFAULT_VISION_CONTEXT, ...context };
    if (!config.enabled) return 1.0;

    const baseCost = toNumber(distance, 0) * toNumber(config.fuelCost, 1.0);
    const maxDistance = toNumber(visionZone.distance, 100);
    
    // Fuel is consumed proportionally across the distance
    // luminosityModifier reduces fuel consumption in light areas
    const adjustedCost = baseCost * config.luminosityModifier;
    return Math.min(1.0, adjustedCost / maxDistance);
}

/**
 * Checks if a point is in the close-range perception zone
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {Object} zoneCloseRange - Close-range zone config
 * @returns {number} Visibility: 1.0 (full) if inside, 0 if outside
 */
function checkCloseRangeVisibility(px, py, zoneCloseRange) {
    const dx = px - toNumber(zoneCloseRange.x);
    const dy = py - toNumber(zoneCloseRange.y);
    const distSq = dx * dx + dy * dy;
    const radiusSq = toNumber(zoneCloseRange.radius) ** 2;
    return distSq <= radiusSq ? 1.0 : 0;
}

/**
 * Calculates angle difference normalized to [-180, 180]
 */
function getAngleDifference(angleA, angleB) {
    const diff = normalizeAngle(angleA - angleB);
    return Math.abs(diff);
}

/**
 * Checks if a point is in a cone vision zone
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {Object} zoneCone - Cone zone config with x, y, distance, angle, rotation
 * @returns {number} Visibility: 1.0 (main), 0.5 (peripheral), or 0 (not visible)
 */
function checkConeVisibility(px, py, zoneCone) {
    const sourceX = toNumber(zoneCone.x);
    const sourceY = toNumber(zoneCone.y);
    const dx = px - sourceX;
    const dy = py - sourceY;
    const distToPoint = Math.hypot(dx, dy);
    const maxDistance = toNumber(zoneCone.distance, 100);

    // Beyond max distance
    if (distToPoint > maxDistance) return 0;

    // Calculate angle to point
    const angleToPoint = (Math.atan2(dy, dx) * 180) / Math.PI;
    const sourceRotation = getFacingAngleDegrees(zoneCone.rotation);
    const angleDiff = getAngleDifference(angleToPoint, sourceRotation);
    const halfAngle = toNumber(zoneCone.angle, 60) / 2;

    // Check main vision cone
    if (angleDiff <= halfAngle) {
        return 1.0; // Full visibility
    }

    return 0; // Not visible
}

/**
 * Determines overall visibility of a point based on all vision zones
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {Object} character - Character with position/rotation
 * @param {Object} visionConfig - Vision configuration from character.vision
 * @param {Object} visionContext - Modifiers (light level, effects, etc)
 * @returns {Object} { visibility: 0-1, visionType: string, fuelCost: 0-1 }
 */
function getPointVisibility(px, py, character = {}, visionConfig = {}, visionContext = {}) {
    const zones = buildVisionZones(character, visionConfig);
    const context = { ...DEFAULT_VISION_CONTEXT, ...visionContext };

    if (!context.enabled) {
        return { visibility: 0, visionType: 'disabled', fuelCost: 1.0 };
    }

    // Check close-range first (highest priority, no fuel cost)
    const closeRangeVis = checkCloseRangeVisibility(px, py, zones.closeRange);
    if (closeRangeVis > 0) {
        return { visibility: 1.0, visionType: 'closeRange', fuelCost: 0 };
    }

    // Check main vision cone
    const mainVis = checkConeVisibility(px, py, zones.main);
    if (mainVis > 0) {
        const dx = px - toNumber(character.position?.x || 0);
        const dy = py - toNumber(character.position?.y || 0);
        const distance = Math.hypot(dx, dy);
        const fuelCost = calculateFuelCost(distance, zones.main, context);
        if (fuelCost >= 1.0) {
            return { visibility: 0, visionType: 'blocked', fuelCost: 1.0 };
        }
        return {
            visibility: mainVis,
            visionType: 'main',
            fuelCost,
        };
    }

    // Check peripheral vision
    // Recompute peripheral with proper boundaries
    const sourceX = toNumber(zones.main.x);
    const sourceY = toNumber(zones.main.y);
    const dx = px - sourceX;
    const dy = py - sourceY;
    const distToPoint = Math.hypot(dx, dy);
    const angleToPoint = (Math.atan2(dy, dx) * 180) / Math.PI;
    const sourceRotation = getFacingAngleDegrees(zones.main.rotation);
    const angleDiff = getAngleDifference(angleToPoint, sourceRotation);
    const halfAngle = toNumber(zones.main.angle, 60) / 2;
    const peripheralHalfAngle = halfAngle / 2;
    const peripheralStart = halfAngle;
    const peripheralEnd = halfAngle + peripheralHalfAngle;

    if (distToPoint <= toNumber(zones.main.distance, 100) &&
        angleDiff > peripheralStart &&
        angleDiff <= peripheralEnd) {
        const fuelCost = calculateFuelCost(distToPoint, zones.main, context);
        const adjustedFuelCost = fuelCost * 1.2;
        if (adjustedFuelCost >= 1.0) {
            return { visibility: 0, visionType: 'blocked', fuelCost: 1.0 };
        }
        return {
            visibility: 0.5,
            visionType: 'peripheral',
            fuelCost: adjustedFuelCost, // Peripheral costs slightly more
        };
    }

    return { visibility: 0, visionType: 'blocked', fuelCost: 1.0 };
}

/**
 * Get vision sample points for an object to check if any part is visible
 * @param {Object} obj - Object with x, y, hitbox
 * @returns {Array<{x, y}>} Sample points to test
 */
function getObjectSamplePoints(obj = {}) {
    const x = toNumber(obj.x, 0);
    const y = toNumber(obj.y, 0);
    const hitbox = obj.hitbox || {};
    const scale = Math.max(0.1, toNumber(hitbox.scale, 1));
    const offsetX = toNumber(hitbox.offsetX, 0);
    const offsetY = toNumber(hitbox.offsetY, 0);

    // Sample at center and corners
    const points = [
        { x: x + offsetX, y: y + offsetY }, // center
    ];

    if (scale > 0) {
        const halfW = 5 * scale;
        const halfH = 5 * scale;
        points.push(
            { x: x + offsetX - halfW, y: y + offsetY - halfH },
            { x: x + offsetX + halfW, y: y + offsetY - halfH },
            { x: x + offsetX - halfW, y: y + offsetY + halfH },
            { x: x + offsetX + halfW, y: y + offsetY + halfH }
        );
    }

    return points;
}

/**
 * Advanced visibility calculation with fuel tracking
 * @param {Object} character - Viewer character with vision config
 * @param {Object} targetObject - Object to check visibility for
 * @param {Object} visionContext - Modifiers (light, effects, etc)
 * @returns {Object} { isVisible: boolean, visionType: string, coverage: 0-1, fuelUsed: 0-1 }
 */
function isObjectVisible(character = {}, targetObject = {}, visionContext = {}) {
    const visionConfig = character.vision || {};
    if (!visionConfig.distance) {
        return { isVisible: false, visionType: 'noVision', coverage: 0, fuelUsed: 1.0 };
    }

    const samples = getObjectSamplePoints(targetObject);
    let maxVisibility = 0;
    let totalFuelUsed = 0;

    for (const point of samples) {
        const result = getPointVisibility(
            point.x,
            point.y,
            character,
            visionConfig,
            visionContext
        );

        maxVisibility = Math.max(maxVisibility, result.visibility);
        totalFuelUsed = Math.max(totalFuelUsed, result.fuelCost);
    }

    const isVisible = maxVisibility > 0;
    const visionType = isVisible ? 
        (maxVisibility >= 1.0 ? 'main' : 'peripheral') : 'blocked';

    return {
        isVisible,
        visionType,
        coverage: maxVisibility,
        fuelUsed: totalFuelUsed,
    };
}

/**
 * Create a vision modifier from environmental conditions
 * @param {Object} conditions - { lightLevel, isInDarkness, hasInfravision, etc }
 * @returns {Object} Vision context modifiers
 */
function createVisionModifier(conditions = {}) {
    const modifier = { ...DEFAULT_VISION_CONTEXT };

    // Light level affects fuel consumption
    const lightLevel = toNumber(conditions.lightLevel, 0.5);
    // Bright light = 0.3, darkness = 1.0
    modifier.luminosityModifier = Math.min(1.0, 0.3 + (1 - lightLevel) * 0.7);

    // Darkness forces full fuel cost
    if (conditions.isInDarkness) {
        modifier.luminosityModifier = 1.0;
    }

    // Infravision allows seeing thermal signatures
    if (conditions.hasInfravision) {
        modifier.luminosityModifier *= 0.7; // 30% fuel reduction
    }

    // Blindness/obstruction disables vision
    if (conditions.isBlinded) {
        modifier.enabled = false;
    }

    return modifier;
}

/**
 * Get vision statistics for a character
 * @param {Object} character - Character with vision config
 * @returns {Object} Vision statistics
 */
function getVisionStats(character = {}) {
    const visionConfig = character.vision || {};
    return {
        distance: toNumber(visionConfig.distance, 0),
        mainAngle: toNumber(visionConfig.angle, 0),
        peripheralAngle: toNumber(visionConfig.angle, 0) / 2,
        closeRangeRadius: toNumber(visionConfig.radius, 0),
        fuelPool: toNumber(visionConfig.distance, 0), // Fuel = distance available
    };
}

/**
 * Cast a single ray from a character and calculate how far it reaches (server-side)
 * Takes into account light level at each point along the ray
 * @param {Object} params - {charX, charY, rayAngle, maxDistance, lightLevel, stepDistance, occlusionDistance}
 * @returns {Object} {distance: how far ray reaches, fuelUsed: total fuel}
 */
function castRayServerSide({
    charX = 0,
    charY = 0,
    rayAngle = 0,
    maxDistance = 1000,
    lightLevel = 0.5, // Character's ambient light level (0-1)
    lightFunction = null, // Optional function(worldX, worldY) -> light level 0-1
    occlusionDistance = null, // Optional hard stop from obstacle raycast
    fuelMultiplier = 1.0, // Peripheral rays cost more (1.2x)
    stepDistance = 25,
}) {
    if (maxDistance <= 0) return { distance: 0, fuelUsed: 1.0 };
    
    const cosAngle = Math.cos(rayAngle);
    const sinAngle = Math.sin(rayAngle);
    let currentDist = 0;
    let totalFuel = 0;
    const safeFuelMultiplier = Math.max(0.1, toNumber(fuelMultiplier, 1.0));
    const minLightModifier = 0.3; // Brightest possible (lowest cost)
    // Treat maxDistance as the fuel pool, not a hard cap.
    // Allow rays to extend beyond base distance in bright light.
    let maxTravel = maxDistance / (minLightModifier * safeFuelMultiplier);
    if (Number.isFinite(Number(occlusionDistance)) && Number(occlusionDistance) >= 0) {
        maxTravel = Math.min(maxTravel, Number(occlusionDistance));
    }
    
    // Cast ray step by step
    while (currentDist < maxTravel) {
        const nextDist = Math.min(currentDist + stepDistance, maxTravel);
        const segmentLength = nextDist - currentDist;
        const checkDist = (currentDist + nextDist) / 2;
        const pointX = charX + cosAngle * checkDist;
        const pointY = charY + sinAngle * checkDist;

        let localLightLevel = toNumber(lightLevel, 0.5);
        if (typeof lightFunction === "function") {
            const mapLightLevel = lightFunction(pointX, pointY);
            if (Number.isFinite(Number(mapLightLevel))) {
                localLightLevel = toNumber(mapLightLevel, localLightLevel);
            }
        }
        if (localLightLevel < 0) localLightLevel = 0;
        if (localLightLevel > 1) localLightLevel = 1;
        
        // Light increases vision range (reduces fuel cost)
        // 1.0 (bright) = 0.3x fuel cost (efficient vision)
        // 0.5 (normal) = 0.65x fuel cost
        // 0.0 (dark) = 1.0x fuel cost (full, hard to see)
        const lightModifier = 0.3 + (1 - localLightLevel) * 0.7;
        const segmentFuel = (segmentLength * lightModifier * safeFuelMultiplier) / maxDistance;
        if (segmentFuel <= 0) {
            currentDist = nextDist;
            continue;
        }

        const nextFuel = totalFuel + segmentFuel;

        // Stop if fuel exhausted
        if (nextFuel >= 1.0) {
            const excessFuel = nextFuel - 1.0;
            const distanceIntoSegment = segmentLength * (1 - excessFuel / segmentFuel);
            return {
                distance: currentDist + distanceIntoSegment,
                fuelUsed: 1.0,
            };
        }

        totalFuel = nextFuel;
        currentDist = nextDist;
    }
    
    return { distance: maxTravel, fuelUsed: Math.min(1.0, totalFuel) };
}

/**
 * Cast multiple rays to determine vision cone shape (server-side)
 * Includes main vision rays and peripheral rays for side vision zones
 * @param {Object} character - Character with position, rotation, lightLevel
 * @param {number} visionDistance - Max vision distance
 * @param {number} visionAngle - Width of main cone in degrees
 * @param {number} rayCount - How many rays to cast in main vision
 * @param {function} occlusionFunction - Optional (x,y,angleRad) -> distance to obstacle
 * @returns {Array} Ray endpoints: [{angle, distance, endX, endY, isPeripheral}, ...]
 */
function castVisionRaysServerSide({
    character = {},
    visionDistance = 1000,
    visionAngle = 60,
    rayCount = 256,
    lightFunction = null,
    occlusionFunction = null,
}) {
    const charX = toNumber(character?.position?.x, 0);
    const charY = toNumber(character?.position?.y, 0);
    const lightLevel = toNumber(character?.lightLevel, 0.5);
    const rotation = toNumber(character?.rotation, 0);
    
    // Convert to radians
    const facingRad = (rotation - 90) * (Math.PI / 180);
    const halfAngleRad = (visionAngle / 2) * (Math.PI / 180);
    const peripheralArcRad = (visionAngle / 4) * (Math.PI / 180);
    
    const rays = [];
    
    // Cast main vision rays
    for (let i = 0; i < rayCount; i++) {
        // Distribute rays across vision cone
        const t = rayCount > 1 ? i / (rayCount - 1) : 0.5;
        const rayOffsetRad = (t - 0.5) * 2 * halfAngleRad;
        const rayAngle = facingRad + rayOffsetRad;
        const occlusionDistance =
            typeof occlusionFunction === "function"
                ? occlusionFunction(charX, charY, rayAngle)
                : null;
        
        // Cast ray
        const result = castRayServerSide({
            charX,
            charY,
            rayAngle,
            maxDistance: visionDistance,
            lightLevel,
            lightFunction,
            occlusionDistance,
            fuelMultiplier: 1.0,
            stepDistance: 20,
        });
        
        // Calculate endpoint
        const endX = charX + Math.cos(rayAngle) * result.distance;
        const endY = charY + Math.sin(rayAngle) * result.distance;
        const angleDeg = (rayAngle * 180) / Math.PI;
        
        rays.push({
            angle: angleDeg,
            distance: result.distance,
            endX,
            endY,
            fuelUsed: result.fuelUsed,
            isPeripheral: false,
        });
    }
    
    // Add a few rays on each peripheral flank (reduced count for performance)
    const peripheralRayCount = Math.max(2, Math.floor(rayCount / 4));
    
    // Left peripheral rays
    for (let i = 0; i < peripheralRayCount; i++) {
        const t = peripheralRayCount > 1 ? i / (peripheralRayCount - 1) : 0.5;
        const rayOffsetRad = -halfAngleRad - (t * peripheralArcRad);
        const rayAngle = facingRad + rayOffsetRad;
        const occlusionDistance =
            typeof occlusionFunction === "function"
                ? occlusionFunction(charX, charY, rayAngle)
                : null;
        
        const result = castRayServerSide({
            charX,
            charY,
            rayAngle,
            maxDistance: visionDistance,
            lightLevel,
            lightFunction,
            occlusionDistance,
            fuelMultiplier: 1.2,
            stepDistance: 20,
        });
        
        const endX = charX + Math.cos(rayAngle) * result.distance;
        const endY = charY + Math.sin(rayAngle) * result.distance;
        const angleDeg = (rayAngle * 180) / Math.PI;
        
        rays.push({
            angle: angleDeg,
            distance: result.distance,
            endX,
            endY,
            fuelUsed: result.fuelUsed,
            isPeripheral: true,
        });
    }
    
    // Right peripheral rays
    for (let i = 0; i < peripheralRayCount; i++) {
        const t = peripheralRayCount > 1 ? i / (peripheralRayCount - 1) : 0.5;
        const rayOffsetRad = halfAngleRad + (t * peripheralArcRad);
        const rayAngle = facingRad + rayOffsetRad;
        const occlusionDistance =
            typeof occlusionFunction === "function"
                ? occlusionFunction(charX, charY, rayAngle)
                : null;
        
        const result = castRayServerSide({
            charX,
            charY,
            rayAngle,
            maxDistance: visionDistance,
            lightLevel,
            lightFunction,
            occlusionDistance,
            fuelMultiplier: 1.2,
            stepDistance: 20,
        });
        
        const endX = charX + Math.cos(rayAngle) * result.distance;
        const endY = charY + Math.sin(rayAngle) * result.distance;
        const angleDeg = (rayAngle * 180) / Math.PI;
        
        rays.push({
            angle: angleDeg,
            distance: result.distance,
            endX,
            endY,
            fuelUsed: result.fuelUsed,
            isPeripheral: true,
        });
    }
    
    return rays;
}

module.exports = {
    buildVisionZones,
    checkCloseRangeVisibility,
    checkConeVisibility,
    getPointVisibility,
    getObjectSamplePoints,
    isObjectVisible,
    createVisionModifier,
    getVisionStats,
    normalizeAngle,
    toNumber,
    calculateFuelCost,
    DEFAULT_VISION_CONTEXT,
    castRayServerSide,
    castVisionRaysServerSide,
};
