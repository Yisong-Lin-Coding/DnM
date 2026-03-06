/**
 * Client-Side State Patching and Vision Recomputation
 * 
 * These utilities run on the client to:
 * 1. Apply state patches to maintain local snapshot
 * 2. Recompute vision rays when needed
 * 3. Interpolate smooth animations
 * 
 * TypeScript implementation for React components
 */

import type { 
  GameSnapshot, 
  Character, 
  MapObject, 
  StatePatch,
  StatePayload 
} from '@/types/game';

/**
 * Apply a delta patch to the current snapshot
 * Modifies snapshot in-place for efficiency
 */
export function applyStatePatch(
  snapshot: GameSnapshot,
  patch: StatePatch
): GameSnapshot {
  if (!patch || typeof patch !== 'object') return snapshot;

  // Apply character patches
  if (patch.characters && typeof patch.characters === 'object') {
    if (!snapshot.characters) snapshot.characters = [];
    
    const charMap = new Map(snapshot.characters.map(c => [c.id, c]));
    
    for (const [charId, charPatch] of Object.entries(patch.characters)) {
      if (charPatch === null) {
        // Tombstone - character deleted
        snapshot.characters = snapshot.characters.filter(c => c.id !== charId);
        charMap.delete(charId);
      } else if (charMap.has(charId)) {
        // Existing character - apply patch
        const existing = charMap.get(charId)!;
        applyObjectPatch(existing, charPatch as any);
      } else {
        // New character - add full data
        snapshot.characters.push(charPatch as Character);
        charMap.set(charId, charPatch as Character);
      }
    }
  }

  // Apply map object patches
  if (patch.mapObjects && typeof patch.mapObjects === 'object') {
    if (!snapshot.mapObjects) snapshot.mapObjects = [];
    
    for (const [objId, objPatch] of Object.entries(patch.mapObjects)) {
      const objIndex = snapshot.mapObjects.findIndex(o => o.id === objId);
      
      if (objPatch === null) {
        // Tombstone - object deleted
        if (objIndex >= 0) {
          snapshot.mapObjects.splice(objIndex, 1);
        }
      } else if (objIndex >= 0) {
        // Existing - apply patch
        applyObjectPatch(snapshot.mapObjects[objIndex], objPatch as any);
      } else {
        // New - add full data
        snapshot.mapObjects.push(objPatch as MapObject);
      }
    }
  }

  // Apply field patches for other sections
  const patchableFields = ['lighting', 'journalState', 'questState', 'visionRayCount', 'currentZLevel', 'fovMode'];
  for (const field of patchableFields) {
    if (field in patch && patch[field as keyof StatePatch] !== undefined) {
      (snapshot as any)[field] = (patch as any)[field];
    }
  }

  return snapshot;
}

/**
 * Apply a patch to a single object, merging fields
 */
function applyObjectPatch(target: any, patch: any): void {
  if (!target || typeof patch !== 'object') return;

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      // Delete field
      delete target[key];
    } else if (
      value !== null && 
      typeof value === 'object' && 
      !Array.isArray(value) && 
      target[key] !== null && 
      typeof target[key] === 'object'
    ) {
      // Merge nested objects (like position, HP, etc.)
      Object.assign(target[key], value);
    } else {
      // Replace field
      target[key] = value;
    }
  }
}

/**
 * Detect if a character moved based on patch
 */
export function didCharacterMove(charPatch: any): boolean {
  return charPatch?.position !== undefined;
}

/**
 * Recompute vision rays for a character
 * Call when character moves or map changes
 */
export function recomputeCharacterVision(
  character: Character,
  snapshot: GameSnapshot,
  visionSystem: any // VisionSystem reference
): void {
  if (!character.visionDigest || !visionSystem) {
    character.visionRays = [];
    return;
  }

  const { distance, angle, radius } = character.visionDigest;
  
  try {
    // Client-side ray casting (reuse server's VisionSystem if available)
    const rays = visionSystem.castVisionRaysClientSide?.({
      character: {
        position: character.position,
        size: character.size || 30
      },
      visionDistance: distance,
      visionAngle: angle,
      rayCount: 128, // Reduce from server's 256 for client
      snapshot: snapshot
    }) || [];
    
    character.visionRays = rays;
  } catch (err) {
    console.error('[Vision] Failed to recompute rays:', err);
    character.visionRays = [];
  }
}

/**
 * Smart vision update - only recompute when needed
 */
export function updateCharacterVisionIfNeeded(
  character: Character,
  snapshot: GameSnapshot,
  visionSystem: any,
  previousPosition?: { x: number; y: number }
): void {
  // Recompute if:
  // 1. Character moved
  // 2. Vision digest changed
  // 3. No vision rays yet
  
  if (!character.visionDigest) return;

  const moved = previousPosition && (
    Math.abs(previousPosition.x - (character.position?.x || 0)) > 5 ||
    Math.abs(previousPosition.y - (character.position?.y || 0)) > 5
  );

  const needsRecompute = !character.visionRays || 
                        character.visionRays.length === 0 || 
                        moved;

  if (needsRecompute) {
    recomputeCharacterVision(character, snapshot, visionSystem);
  }
}

/**
 * Batch recompute vision for all characters
 * Call after map updates
 */
export function recomputeAllCharacterVision(
  snapshot: GameSnapshot,
  visionSystem: any
): void {
  if (!snapshot.characters || !visionSystem) return;

  for (const character of snapshot.characters) {
    recomputeCharacterVision(character, snapshot, visionSystem);
  }
}

/**
 * Create smooth interpolation for movement
 * Returns interpolated position between start and end
 */
export interface MovementAnimation {
  startPos: { x: number; y: number };
  endPos: { x: number; y: number };
  startTime: number;
  duration: number; // ms
}

export function interpolatePosition(
  animation: MovementAnimation,
  currentTime: number
): { x: number; y: number } {
  const elapsed = Math.min(currentTime - animation.startTime, animation.duration);
  const progress = animation.duration > 0 ? elapsed / animation.duration : 1;
  
  // Easing: ease-out cubic for snappier feel
  const easeProgress = 1 - Math.pow(1 - progress, 3);

  return {
    x: animation.startPos.x + (animation.endPos.x - animation.startPos.x) * easeProgress,
    y: animation.startPos.y + (animation.endPos.y - animation.startPos.y) * easeProgress
  };
}

/**
 * Process incoming payload and update local state
 */
export interface PayloadProcessOptions {
  visionSystem?: any;
  enableAnimations?: boolean;
  validateState?: boolean;
}

export function processIncomingPayload(
  payload: StatePayload,
  currentSnapshot: GameSnapshot | null,
  options: PayloadProcessOptions = {}
): GameSnapshot {
  const {
    visionSystem,
    enableAnimations = true,
    validateState = true
  } = options;

  let snapshot: GameSnapshot;

  if (payload.type === 'full' && payload.snapshot) {
    // Full state snapshot
    snapshot = JSON.parse(JSON.stringify(payload.snapshot));
    console.log(`[State] Received full snapshot (revision ${payload.revision})`);
  } else if (payload.type === 'delta' && payload.patch && currentSnapshot) {
    // Apply delta patch
    snapshot = JSON.parse(JSON.stringify(currentSnapshot));
    applyStatePatch(snapshot, payload.patch);
    console.log(`[State] Applied delta patch (revision ${payload.revision})`);
  } else {
    console.warn('[State] Invalid payload format:', payload);
    return currentSnapshot || {};
  }

  // Recompute vision rays for moved characters
  if (visionSystem && snapshot.characters) {
    for (const character of snapshot.characters) {
      if (character.visionDigest) {
        recomputeCharacterVision(character, snapshot, visionSystem);
      }
    }
  }

  // Validate state integrity
  if (validateState) {
    validateSnapshotState(snapshot);
  }

  // Log size for monitoring
  const bytes = JSON.stringify(snapshot).length;
  console.log(`[State] Snapshot size: ${(bytes / 1024).toFixed(1)}KB`);

  return snapshot;
}

/**
 * Validate snapshot to catch desync errors early
 */
function validateSnapshotState(snapshot: GameSnapshot): void {
  // Check character consistency
  if (snapshot.characters) {
    const ids = new Set();
    for (const char of snapshot.characters) {
      if (!char.id) {
        console.warn('[Validation] Character missing ID');
      } else if (ids.has(char.id)) {
        console.warn(`[Validation] Duplicate character ID: ${char.id}`);
      } else {
        ids.add(char.id);
      }

      // Check HP validity
      if (char.HP && typeof char.HP === 'object') {
        if (char.HP.current > char.HP.max) {
          console.warn(`[Validation] Character ${char.name} HP overflow: ${char.HP.current}/${char.HP.max}`);
        }
        if (char.HP.current < 0) {
          console.warn(`[Validation] Character ${char.name} negative HP: ${char.HP.current}`);
        }
      }
    }
  }
}

/**
 * Request full state from server (on-demand)
 * Call if patch application fails or state out of sync
 */
export function requestFullGameState(socket: any, campaignID: string): Promise<GameSnapshot> {
  return new Promise((resolve, reject) => {
    socket.emit('campaign_requestFullState', { campaignID }, (response: any) => {
      if (response?.success && response?.snapshot) {
        resolve(response.snapshot);
      } else {
        reject(new Error('Failed to fetch full state'));
      }
    });
  });
}

export default {
  applyStatePatch,
  recomputeCharacterVision,
  recomputeAllCharacterVision,
  updateCharacterVisionIfNeeded,
  interpolatePosition,
  processIncomingPayload,
  requestFullGameState
};
