/**
 * Client-side Vision System Rendering v3
 * Implements ray-casting vision with fuel-based distance calculation
 * Integrates with light system to calculate actual vision reach per ray
 * 
 * Features:
 * - Multiple rays shot from character position
 * - Each ray calculates fuel cost based on light level
 * - Vision cone endpoints determined by fuel exhaustion
 * - Configurable ray count via slider
 */

const degToRad = (deg) => (deg * Math.PI) / 180;
const radToDeg = (rad) => (rad * 180) / Math.PI;

const normalizeAngle = (angle) => {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
};

/**
 * Get facing angle in canvas radians (adjusted for game rotation convention)
 * Game convention: rotation=0 faces UP, rotation=90 faces RIGHT
 * Canvas convention: angle=0 faces RIGHT, angle=π/2 faces DOWN
 * Solution: canvasAngle = (rotation - 90) * π/180
 */
const getFacingAngleRad = (rotation) => {
    return degToRad(Number(rotation || 0) - 90);
};

/**
 * Calculate fuel cost for a given distance based on light level
 * Formula: (distance * lightModifier) / maxDistance
 * @param {number} distance - Distance in world units
 * @param {number} maxDistance - Maximum vision distance (full fuel pool)
 * @param {number} lightLevel - Light level 0-1 (affects fuel consumption)
 * @returns {number} Fuel cost 0-1 (1.0 = exhausted, beyond vision)
 */
function calculateFuelCostAtDistance(distance, maxDistance, lightLevel = 0.5) {
    if (distance <= 0) return 0;
    if (maxDistance <= 0) return 1.0;
    
    // Light level affects fuel consumption:
    // brightness 1.0 = 30% fuel cost (efficient vision)
    // brightness 0.5 = 65% fuel cost (normal)
    // brightness 0.0 = 100% fuel cost (full cost, hard to see)
    const lightModifier = 0.3 + (1 - lightLevel) * 0.7;
    
    const fuelCost = (distance * lightModifier) / maxDistance;
    return Math.min(1.0, fuelCost);
}

/**
 * Cast a single ray and calculate how far it can see
 * Each ray step checks light level and accumulates fuel cost
 * @param {Object} params - {charX, charY, rayAngle, maxDistance, lightFunction, characterLightLevel, stepDistance}
 * @returns {Object} {distance: how far this ray can reach, fuelUsed: total fuel consumed}
 */
function castRay({
    charX = 0,
    charY = 0,
    rayAngle = 0,
    maxDistance = 1000,
    lightFunction = null,
    characterLightLevel = 0.5,
    fuelMultiplier = 1.0,
    stepDistance = 25, // Check light every 25 units
}) {
    if (maxDistance <= 0) return { distance: 0, fuelUsed: 1.0 };
    
    const cosAngle = Math.cos(rayAngle);
    const sinAngle = Math.sin(rayAngle);
    let currentDist = 0;
    let totalFuel = 0;
    const safeFuelMultiplier = Math.max(0.1, Number(fuelMultiplier) || 1.0);
    const minLightModifier = 0.3;
    const maxTravel = maxDistance / (minLightModifier * safeFuelMultiplier);
    
    // Cast ray step by step, accumulating fuel cost
    while (currentDist < maxTravel) {
        const nextDist = Math.min(currentDist + stepDistance, maxTravel);
        const checkDist = (currentDist + nextDist) / 2;
        
        // Calculate point along ray
        const pointX = charX + cosAngle * checkDist;
        const pointY = charY + sinAngle * checkDist;
        
        // Get light level at this point and blend with character's ambient light
        let lightLevel = Number.isFinite(Number(characterLightLevel))
            ? Number(characterLightLevel)
            : 0.5;
        if (typeof lightFunction === 'function') {
            const mapLightLevel = lightFunction(pointX, pointY);
            if (Number.isFinite(Number(mapLightLevel))) {
                lightLevel = Number(mapLightLevel);
            }
        }
        if (lightLevel < 0) lightLevel = 0;
        if (lightLevel > 1) lightLevel = 1;
        
        // Calculate fuel cost for this segment
        const segmentLength = nextDist - currentDist;
        const lightModifier = 0.3 + (1 - lightLevel) * 0.7;
        const segmentFuel = (segmentLength * lightModifier * safeFuelMultiplier) / maxDistance;
        if (segmentFuel <= 0) {
            currentDist = nextDist;
            continue;
        }
        
        const nextFuel = totalFuel + segmentFuel;
        
        // Stop if fuel exhausted (cost = 1.0)
        if (nextFuel >= 1.0) {
            // Interpolate to find exact stopping point
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
 * Cast multiple rays around character to determine vision cone shape
 * @param {Object} character - Character with position, rotation, lightLevel 
 * @param {number} visionDistance - Max vision distance
 * @param {number} visionAngle - Width of main vision cone in degrees
 * @param {number} rayCount - How many rays to cast
 * @param {function} lightFunction - Function that returns light level at (x,y)
 * @returns {Array} Array of ray results: [{angle, distance, endX, endY}, ...]
 */
function castVisionRays({
    character = {},
    visionDistance = 1000,
    visionAngle = 60,
    rayCount = 256,
    lightFunction = null,
}) {
    const charX = Number(character?.position?.x) || 0;
    const charY = Number(character?.position?.y) || 0;
    const facingRad = getFacingAngleRad(character.rotation);
    const halfAngleRad = degToRad(visionAngle / 2);
    const characterLightLevel = Number(character?.lightLevel) || 0.5;
    
    const rays = [];
    
    for (let i = 0; i < rayCount; i++) {
        // Distribute rays across the vision cone
        const t = rayCount > 1 ? i / (rayCount - 1) : 0.5;
        const rayOffsetRad = (t - 0.5) * 2 * halfAngleRad;
        const rayAngle = facingRad + rayOffsetRad;
        
        // Cast this ray
        const result = castRay({
            charX,
            charY,
            rayAngle,
            maxDistance: visionDistance,
            lightFunction,
            characterLightLevel,
            stepDistance: 20,
        });
        
        // Calculate endpoint
        const endX = charX + Math.cos(rayAngle) * result.distance;
        const endY = charY + Math.sin(rayAngle) * result.distance;
        
        rays.push({
            angle: radToDeg(rayAngle),
            angleRad: rayAngle,
            distance: result.distance,
            fuelUsed: result.fuelUsed,
            endX,
            endY,
        });
    }
    
    return rays;
}

/**
 * Build a ray set for a character using the same fuel-based ray casting as the client
 * @param {Object} character - Character with position, rotation, vision, lightLevel
 * @param {number} rayCount - Total number of main rays (peripheral derived from this)
 * @returns {{main: Array, peripheral: Array}}
 */
function buildRaySetForCharacter(character = {}, rayCount = 256, lightFunction = null) {
    const vision = character?.vision;
    if (!vision) return { main: [], peripheral: [] };

    const distance = Number(vision.distance) || 0;
    const angle = Number(vision.angle) || 0;
    if (distance <= 0 || angle <= 0) return { main: [], peripheral: [] };

    const charX = Number(character?.position?.x) || 0;
    const charY = Number(character?.position?.y) || 0;
    const lightLevel = Number(character?.lightLevel) || 0.5;

    const facingRad = getFacingAngleRad(character.rotation);
    const halfAngleRad = degToRad(angle / 2);
    const peripheralArcRad = degToRad(angle / 4);

    const mainRayCount = Math.max(2, Math.round(Number(rayCount) || 0));
    const peripheralRayCount = Math.max(2, Math.floor(mainRayCount / 4));

    const main = [];
    const peripheral = [];

    for (let i = 0; i < mainRayCount; i++) {
        const t = mainRayCount > 1 ? i / (mainRayCount - 1) : 0.5;
        const rayOffsetRad = (t - 0.5) * 2 * halfAngleRad;
        const rayAngle = facingRad + rayOffsetRad;
        const result = castRay({
            charX,
            charY,
            rayAngle,
            maxDistance: distance,
            lightFunction,
            characterLightLevel: lightLevel,
            fuelMultiplier: 1.0,
            stepDistance: 20,
        });
        const endX = charX + Math.cos(rayAngle) * result.distance;
        const endY = charY + Math.sin(rayAngle) * result.distance;
        main.push({
            angle: radToDeg(rayAngle),
            angleRad: rayAngle,
            distance: result.distance,
            fuelUsed: result.fuelUsed,
            endX,
            endY,
            isPeripheral: false,
        });
    }

    for (let i = 0; i < peripheralRayCount; i++) {
        const t = peripheralRayCount > 1 ? i / (peripheralRayCount - 1) : 0.5;

        const leftOffset = -halfAngleRad - (t * peripheralArcRad);
        const leftAngle = facingRad + leftOffset;
        const leftResult = castRay({
            charX,
            charY,
            rayAngle: leftAngle,
            maxDistance: distance,
            lightFunction,
            characterLightLevel: lightLevel,
            fuelMultiplier: 1.2,
            stepDistance: 20,
        });
        peripheral.push({
            angle: radToDeg(leftAngle),
            angleRad: leftAngle,
            distance: leftResult.distance,
            fuelUsed: leftResult.fuelUsed,
            endX: charX + Math.cos(leftAngle) * leftResult.distance,
            endY: charY + Math.sin(leftAngle) * leftResult.distance,
            isPeripheral: true,
        });

        const rightOffset = halfAngleRad + (t * peripheralArcRad);
        const rightAngle = facingRad + rightOffset;
        const rightResult = castRay({
            charX,
            charY,
            rayAngle: rightAngle,
            maxDistance: distance,
            lightFunction,
            characterLightLevel: lightLevel,
            fuelMultiplier: 1.2,
            stepDistance: 20,
        });
        peripheral.push({
            angle: radToDeg(rightAngle),
            angleRad: rightAngle,
            distance: rightResult.distance,
            fuelUsed: rightResult.fuelUsed,
            endX: charX + Math.cos(rightAngle) * rightResult.distance,
            endY: charY + Math.sin(rightAngle) * rightResult.distance,
            isPeripheral: true,
        });
    }

    return { main, peripheral };
}

/**
 * Render close-range omnidirectional perception circle
 * Always visible around character regardless of facing
 */
/**
 * Render close-range vision zone (omnidirectional circle around character)
 * Represents immediate surroundings that are visible regardless of facing direction
 */
function renderCloseRangeVision(ctx, character, radius, camera) {
    // Use provided radius, or fall back to calculating from vision distance
    let effectiveRadius = Number(radius) || 0;
    
    if (!effectiveRadius && character?.vision?.radius) {
        effectiveRadius = Number(character.vision.radius) || 0;
    }
    
    if (!effectiveRadius || effectiveRadius <= 0 || !camera) return;

    const charX = Number(character?.position?.x) || 0;
    const charY = Number(character?.position?.y) || 0;
    
    // World to screen: screenPos = worldPos * zoom - cameraOffset
    const screenX = charX * camera.zoom - camera.x;
    const screenY = charY * camera.zoom - camera.y;
    const screenRadius = effectiveRadius * camera.zoom;

    ctx.save();
    ctx.fillStyle = 'rgba(100, 200, 255, 0.12)';
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

/**
 * Render ray-based vision cone with fuel-accurate vision range
 * Uses multiple test rays to show where vision actually reaches based on light/fuel
 */
function renderRayBasedVisionCone(ctx, character, distance, angle, camera, rays = []) {
    if (!rays || rays.length === 0 || !camera) {
        // Server-authoritative rays required for fuel-based vision
        return;
    }

    const charX = Number(character?.position?.x) || 0;
    const charY = Number(character?.position?.y) || 0;
    const screenX = charX * camera.zoom - camera.x;
    const screenY = charY * camera.zoom - camera.y;
    const facingRad = getFacingAngleRad(character?.rotation);
    const normalizeRad = (rad) => {
        let value = rad;
        while (value > Math.PI) value -= Math.PI * 2;
        while (value < -Math.PI) value += Math.PI * 2;
        return value;
    };
    const sortedRays = [...rays]
        .map((ray) => {
            const angleRad = Number.isFinite(Number(ray?.angleRad))
                ? Number(ray.angleRad)
                : (Number.isFinite(Number(ray?.angle))
                    ? degToRad(Number(ray.angle))
                    : Math.atan2((ray?.endY ?? 0) - charY, (ray?.endX ?? 0) - charX));
            return {
                ...ray,
                _angleRad: angleRad,
                _relAngle: normalizeRad(angleRad - facingRad),
            };
        })
        .sort((a, b) => a._relAngle - b._relAngle);

    // Draw vision cone from ray endpoints
    ctx.save();
    ctx.fillStyle = 'rgba(100, 255, 100, 0.18)';
    ctx.strokeStyle = 'rgba(100, 255, 100, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    
    // Connect to first ray's endpoint
    if (sortedRays.length > 0) {
        const firstRay = sortedRays[0];
        const firstScreenX = firstRay.endX * camera.zoom - camera.x;
        const firstScreenY = firstRay.endY * camera.zoom - camera.y;
        ctx.lineTo(firstScreenX, firstScreenY);
        
        // Draw arc through ray endpoints
        for (let i = 1; i < sortedRays.length; i++) {
            const ray = sortedRays[i];
            const screenRayX = ray.endX * camera.zoom - camera.x;
            const screenRayY = ray.endY * camera.zoom - camera.y;
            ctx.lineTo(screenRayX, screenRayY);
        }
    }
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    
    // Optional: Render ray lines for debugging
    if (true) { // Set to false to hide ray debug lines
        ctx.save();
        ctx.strokeStyle = 'rgba(100, 255, 100, 0.2)';
        ctx.lineWidth = 0.5;
        for (const ray of sortedRays) {
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            const endScreenX = ray.endX * camera.zoom - camera.x;
            const endScreenY = ray.endY * camera.zoom - camera.y;
            ctx.lineTo(endScreenX, endScreenY);
            ctx.stroke();
        }
        ctx.restore();
    }
}

/**
 * Render peripheral vision rays
 * Shows reduced visibility flanks using ray-casting data
 */
function renderPeripheralRaysCone(ctx, character, camera, rays = []) {
    if (!rays || rays.length === 0 || !camera) return;

    const charX = Number(character?.position?.x) || 0;
    const charY = Number(character?.position?.y) || 0;
    const screenX = charX * camera.zoom - camera.x;
    const screenY = charY * camera.zoom - camera.y;

    if (rays.length < 2) return;

    // Draw peripheral vision from peripheral rays
    ctx.save();
    ctx.fillStyle = 'rgba(50, 50, 50, 0.4)';
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.5)';
    ctx.lineWidth = 1.5;
    
    const normalizeRad = (rad) => {
        let value = rad;
        while (value > Math.PI) value -= Math.PI * 2;
        while (value < -Math.PI) value += Math.PI * 2;
        return value;
    };
    const facingRad = getFacingAngleRad(character?.rotation);
    const leftRays = [];
    const rightRays = [];

    for (const ray of rays) {
        const angle = Math.atan2((ray?.endY ?? 0) - charY, (ray?.endX ?? 0) - charX);
        const diff = normalizeRad(angle - facingRad);
        const entry = { ...ray, _angle: angle };
        if (diff < 0) {
            leftRays.push(entry);
        } else {
            rightRays.push(entry);
        }
    }

    leftRays.sort((a, b) => a._angle - b._angle);
    rightRays.sort((a, b) => a._angle - b._angle);

    const drawWedge = (wedgeRays) => {
        if (wedgeRays.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        for (const ray of wedgeRays) {
            const rayScreenX = ray.endX * camera.zoom - camera.x;
            const rayScreenY = ray.endY * camera.zoom - camera.y;
            ctx.lineTo(rayScreenX, rayScreenY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    };

    drawWedge(leftRays);
    drawWedge(rightRays);
    
    // Draw faint ray lines
    ctx.strokeStyle = 'rgba(80, 80, 80, 0.3)';
    ctx.lineWidth = 0.5;
    for (const ray of rays) {
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        const endScreenX = ray.endX * camera.zoom - camera.x;
        const endScreenY = ray.endY * camera.zoom - camera.y;
        ctx.lineTo(endScreenX, endScreenY);
        ctx.stroke();
    }
    
    ctx.restore();
}

/**
 * Render main vision cone (green)
 * Full visibility in this direction-focused cone
 */
function renderMainVisionCone(ctx, character, distance, angle, camera) {
    if (distance <= 0 || angle <= 0 || !camera) return;

    const charX = Number(character?.position?.x) || 0;
    const charY = Number(character?.position?.y) || 0;
    
    // World to screen conversion
    const screenX = charX * camera.zoom - camera.x;
    const screenY = charY * camera.zoom - camera.y;
    const screenRadius = distance * camera.zoom;
    
    // Get proper facing angle (rotation - 90 degrees)
    const facingRad = getFacingAngleRad(character.rotation);
    const arcHalf = degToRad(angle / 2);

    ctx.save();
    ctx.fillStyle = 'rgba(100, 255, 100, 0.18)';
    ctx.strokeStyle = 'rgba(100, 255, 100, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.arc(screenX, screenY, screenRadius, facingRad - arcHalf, facingRad + arcHalf);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

/**
 * Render peripheral vision zones (grey)
 * Reduced visibility on flanks - two 45° zones
 */
function renderPeripheralVisionCones(ctx, character, distance, angle, camera) {
    if (distance <= 0 || angle <= 0 || !camera) return;

    const charX = Number(character?.position?.x) || 0;
    const charY = Number(character?.position?.y) || 0;
    
    // World to screen conversion
    const screenX = charX * camera.zoom - camera.x;
    const screenY = charY * camera.zoom - camera.y;
    const screenRadius = distance * camera.zoom;
    
    // Get facing angle and calculate peripheral zones
    const facingRad = getFacingAngleRad(character.rotation);
    const mainArcHalf = degToRad(angle / 2);
    const peripheralArcWidth = degToRad(angle / 4);

    // Left peripheral: from (facing - angle/2 - angle/4) to (facing - angle/2)
    const leftStart = facingRad - mainArcHalf - peripheralArcWidth;
    const leftEnd = facingRad - mainArcHalf;
    
    // Right peripheral: from (facing + angle/2) to (facing + angle/2 + angle/4)
    const rightStart = facingRad + mainArcHalf;
    const rightEnd = facingRad + mainArcHalf + peripheralArcWidth;

    ctx.save();
    ctx.fillStyle = 'rgba(50, 50, 50, 0.4)';
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.5)';
    ctx.lineWidth = 1.5;
    
    // Draw left peripheral cone
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.arc(screenX, screenY, screenRadius, leftStart, leftEnd);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Draw right peripheral cone
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.arc(screenX, screenY, screenRadius, rightStart, rightEnd);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
}

/**
 * Render facing direction indicator (small dot)
 */
function renderFacingDirection(ctx, character, distance, camera) {
    if (distance <= 0 || !camera) return;

    const charX = Number(character?.position?.x) || 0;
    const charY = Number(character?.position?.y) || 0;
    
    // World to screen conversion
    const screenX = charX * camera.zoom - camera.x;
    const screenY = charY * camera.zoom - camera.y;
    
    // Calculate indicator position
    const facingRad = getFacingAngleRad(character.rotation);
    const indicatorWorldDist = distance / 3;
    const indicatorScreenDist = indicatorWorldDist * camera.zoom;
    const indicatorX = screenX + Math.cos(facingRad) * indicatorScreenDist;
    const indicatorY = screenY + Math.sin(facingRad) * indicatorScreenDist;

    ctx.save();
    ctx.fillStyle = 'rgba(100, 200, 100, 0.9)';
    ctx.strokeStyle = 'rgba(50, 150, 50, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

/**
 * Render debug information for selected character
 */
function renderVisionDebugInfo(ctx, character, screenX, screenY) {
    if (!character || !character.vision) return;

    const vision = character.vision;
    const debugInfo = {
        'Name': character.name || 'Unknown',
        'Distance': `${Math.round(vision.distance)} units`,
        'Main Angle': `${Math.round(vision.angle)}°`,
        'Peripheral': `${Math.round(vision.angle / 4)}° each side`,
        'Close Range': `${Math.round(vision.radius)} units`,
        'Rotation': `${Math.round(character.rotation || 0)}°`,
    };

    ctx.save();
    const fontSize = 12;
    const lineHeight = 16;
    const paddingX = 6;
    const paddingY = 4;
    ctx.font = `${fontSize}px "Cascadia Mono", "Consolas", "Menlo", monospace`;
    ctx.fillStyle = 'rgba(230, 230, 230, 0.95)';
    ctx.strokeStyle = 'rgba(50, 50, 50, 0.8)';
    ctx.lineWidth = 0.5;
    
    let offsetY = 0;
    for (const [key, value] of Object.entries(debugInfo)) {
        const text = `${key}: ${value}`;
        const metrics = ctx.measureText(text);
        const width = metrics.width + paddingX * 2;
        const height = lineHeight;
        
        // Background
        ctx.fillStyle = 'rgba(15, 15, 20, 0.78)';
        ctx.fillRect(screenX, screenY + offsetY - (fontSize - paddingY), width, height);
        
        // Text
        ctx.fillStyle = 'rgba(230, 230, 230, 0.98)';
        ctx.fillText(text, screenX + paddingX, screenY + offsetY);
        
        offsetY += lineHeight;
    }
    
    ctx.restore();
}

/**
 * Master render function - draws all vision zones
 * Properly handles camera transformations
 */
function renderVisionZones(ctx, character, camera, options = {}) {
    if (!character || !character.vision || !camera) return;

    const {
        showCloseRange = true,
        showMainCone = true,
        showPeripheral = true,
        showFacingIndicator = true,
        alpha = 0.35,
    } = options;

    const { distance, angle, radius } = character.vision;

    ctx.globalAlpha = alpha;

    if (showCloseRange) {
        renderCloseRangeVision(ctx, character, radius, camera);
    }

    if (showMainCone) {
        renderMainVisionCone(ctx, character, distance, angle, camera);
    }

    if (showPeripheral) {
        renderPeripheralVisionCones(ctx, character, distance, angle, camera);
    }

    if (showFacingIndicator) {
        renderFacingDirection(ctx, character, distance, camera);
    }

    ctx.globalAlpha = 1.0;
}

export default {
    renderVisionZones,
    renderCloseRangeVision,
    renderRayBasedVisionCone,
    renderMainVisionCone,
    renderPeripheralVisionCones,
    renderPeripheralRaysCone,
    renderFacingDirection,
    renderVisionDebugInfo,
    castVisionRays,
    castRay,
    buildRaySetForCharacter,
    calculateFuelCostAtDistance,
    normalizeAngle,
    degToRad,
    radToDeg,
    getFacingAngleRad,
};
