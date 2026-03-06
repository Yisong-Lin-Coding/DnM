/**
 * Vision and State Sanitization
 * 
 * Removes transient computed data before broadcasting to reduce payload size.
 * Clients can recompute expensive calculations when needed.
 */

/**
 * Create a compact vision digest from a character token
 * Replaces 256+ ray objects (~36KB) with essential params (~100 bytes)
 */
function buildVisionDigest(token) {
  if (!token || !token.vision) {
    return null;
  }

  const hasObstacles = Array.isArray(token.visionRays) && token.visionRays.length > 0;
  
  return {
    // Essential parameters for client-side ray casting
    distance: Number(token.vision?.distance || token.visionDistance || 150),
    angle: Number(token.vision?.angle || token.visionArc || 90),
    radius: Number(token.vision?.radius || 30),
    
    // Metadata
    hasObstacles, // Indicates if obstacles are nearby
    
    // Position (helps client optimize)
    centerX: Math.round(Number(token.position?.x || 0)),
    centerY: Math.round(Number(token.position?.y || 0))
  };
}

/**
 * Remove all transient/computed data from snapshot
 * Significantly reduces payload size while maintaining functionality
 */
function sanitizeSnapshotForBroadcast(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return snapshot;
  }

  // Deep copy to avoid modifying original
  // (But we'll minimize this if snapshot is already in memory)
  const sanitized = {
    currentZLevel: snapshot.currentZLevel,
    visionRayCount: snapshot.visionRayCount,
    fovMode: snapshot.fovMode,
    lighting: snapshot.lighting ? { ...snapshot.lighting } : undefined,
    characters: [],
    mapObjects: snapshot.mapObjects ? 
      snapshot.mapObjects.map(obj => ({
        ...obj,
        // Remove computed vision data from map objects
        _visionData: undefined
      })) 
      : undefined,
    journalState: snapshot.journalState,
  };

  // Sanitize characters - only keep essential networked data
  if (Array.isArray(snapshot.characters)) {
    sanitized.characters = snapshot.characters.map(char => {
      const sanitized = {
        id: char.id,
        name: char.name,
        position: char.position,
        size: char.size,
        rotation: char.rotation,
        team: char.team,
        kind: char.kind,
        
        // Resource pools (essential for gameplay)
        HP: char.HP,
        MP: char.MP,
        STA: char.STA,
        
        // Gameplay stats
        level: char.level,
        classType: char.classType,
        race: char.race,
        background: char.background,
        stats: char.stats,
        perception: char.perception,
        stealth: char.stealth,
        
        // Movement
        movement: char.movement,
        movementMax: char.movementMax,
        
        // Combat
        actionPoints: char.actionPoints,
        AR: char.AR,
        resistances: char.resistances,
        immunities: char.immunities,
        defenses: char.defenses,
        
        // Skills and effects
        skills: char.skills,
        statusEffects: char.statusEffects,
        
        // Vision (use compact digest instead of 256+ rays)
        // Omit raw visionRays and _debugLightLevel
        visionDigest: buildVisionDigest(char),
        
        // Equipment
        inv: char.inv,
        equipment: char.equipment,
        equippedItems: char.equippedItems,
        
        // Abilities
        abilities: char.abilities,
        classFeatures: char.classFeatures,
        raceFeatures: char.raceFeatures,
        
        // Perception data for obfuscation
        _perceptionRatio: char._perceptionRatio,
        _stealthPassive: char._stealthPassive,
        _visibilityError: char._visibilityError,
        _visionData: char._visionData,
      };
      
      // Remove undefined fields to save space
      Object.keys(sanitized).forEach(key => {
        if (sanitized[key] === undefined) {
          delete sanitized[key];
        }
      });
      
      return sanitized;
    });
  }

  return sanitized;
}

/**
 * Compute size of a snapshot/patch for logging
 */
function estimatePayloadSize(data) {
  if (!data) return 0;
  try {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  } catch {
    return 0;
  }
}

/**
 * Create a broadcast payload with optimization
 * Decides between full snapshot vs delta patch based on context
 */
function createOptimizedPayload(engineState, options = {}) {
  const {
    previousSnapshot = null,
    shouldSendFull = false,
    excludeVisionRays = true,
    excludeLightingPolygons = true
  } = options;

  // Sanitize the snapshot
  const sanitized = excludeVisionRays || excludeLightingPolygons
    ? sanitizeSnapshotForBroadcast(engineState.snapshot)
    : engineState.snapshot;

  const payload = {
    success: true,
    campaignID: engineState.campaignID,
    revision: engineState.revision,
    timestamp: Date.now(),
    
    // Include payload type for client awareness
    type: shouldSendFull ? 'full' : 'delta',
  };

  if (shouldSendFull) {
    // Send complete state
    payload.snapshot = sanitized;
    payload.floorTypes = {} // Include if available
  } else if (previousSnapshot) {
    // Send delta patch
    const patch = computeStatePatch(previousSnapshot, sanitized);
    payload.patch = patch;
  } else {
    // Fallback to full if no previous
    payload.snapshot = sanitized;
    payload.type = 'full';
  }

  // Log for debugging
  const size = estimatePayloadSize(payload);
  payload._sizeBytes = size;
  payload._sizeKB = Math.round(size / 1024 * 100) / 100;

  return payload;
}

/**
 * Quick utility to log payload optimization
 */
function logPayloadOptimization(payloadBefore, payloadAfter) {
  const sizeBefore = estimatePayloadSize(payloadBefore) / 1024;
  const sizeAfter = estimatePayloadSize(payloadAfter) / 1024;
  const reduction = Math.round((1 - sizeAfter / sizeBefore) * 100);
  
  console.log(
    `[PAYLOAD] ${sizeBefore.toFixed(1)}KB → ${sizeAfter.toFixed(1)}KB (${reduction}% reduction)`
  );
}

/**
 * Simple diff calculator for patches
 */
function computeStatePatch(previousSnapshot, currentSnapshot) {
  // This is a simplified version - could use the DeltaUpdateManager for full implementation
  const patch = {};

  // Characters
  if (previousSnapshot?.characters && currentSnapshot?.characters) {
    const prevMap = new Map(previousSnapshot.characters.map(c => [c.id, c]));
    patch.characters = {};
    
    for (const currChar of currentSnapshot.characters) {
      const prevChar = prevMap.get(currChar.id);
      if (!prevChar) {
        patch.characters[currChar.id] = currChar;
      } else {
        const charPatch = {};
        for (const key in currChar) {
          if (JSON.stringify(prevChar[key]) !== JSON.stringify(currChar[key])) {
            charPatch[key] = currChar[key];
          }
        }
        if (Object.keys(charPatch).length > 0) {
          patch.characters[currChar.id] = charPatch;
        }
      }
    }
  }

  return patch;
}

module.exports = {
  buildVisionDigest,
  sanitizeSnapshotForBroadcast,
  estimatePayloadSize,
  createOptimizedPayload,
  logPayloadOptimization,
  computeStatePatch
};
