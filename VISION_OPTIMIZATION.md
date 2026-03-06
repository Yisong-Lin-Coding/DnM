# Vision System Optimization

## Current Problem
Each character broadcasts 256 vision rays on every update.

```javascript
// Current: 256 rays × 15 properties × 6 characters = ~36KB just for vision
character.visionRays = [
  { angle: 0, distance: 150, endX: 250, endY: 150, isPeripheral: false, ... },
  { angle: 1.4, distance: 150, endX: 248.9, endY: 152.1, isPeripheral: false, ... },
  // ... 254 more rays
]
```

## Optimization: Vision Digest

Instead of sending all rays, send only the essential visibility polygon outline and parameters.

### Solution Architecture

```javascript
// NEW: Send compact vision digest instead
character.visionDigest = {
  distance: 150,
  angle: 90,
  radius: 30,
  hasObstacles: true,
  // That's it! ~100 bytes instead of ~36KB
}

// Client-side ray casting
// Client has VisionSystem and can recompute rays from digest
// Only recompute when digest changes (character moved, obstacles changed)
```

### Implementation

#### Server-side Changes

```javascript
// In campaign_manager.js, replace full ray arrays with digest

const buildVisionDigest = (token) => {
  if (!token?.vision) return null;
  
  const hasVisionRays = Array.isArray(token.visionRays) && token.visionRays.length > 0;
  
  return {
    distance: Number(token.vision?.distance || token.visionDistance || 150),
    angle: Number(token.vision?.angle || token.visionArc || 90),
    radius: Number(token.vision?.radius || 30),
    hasObstacles: hasVisionRays,
    centerX: Math.round(Number(token.position?.x || 0)),
    centerY: Math.round(Number(token.position?.y || 0))
  };
};

// Before broadcasting, replace vision rays with digest
const sanitizeStateForBroadcast = (snapshot) => {
  const sanitized = JSON.parse(JSON.stringify(snapshot));
  
  // Characters: remove transient data
  if (Array.isArray(sanitized.characters)) {
    for (const char of sanitized.characters) {
      // Remove full ray arrays - client will compute
      delete char.visionRays;
      delete char._debugLightLevel;
      
      // Keep vision digest for efficient recalc
      char.visionDigest = buildVisionDigest(char);
    }
  }
  
  // Remove lighting polygons - recalculate on client or on-demand
  delete sanitized.lightingPolygons;
  
  return sanitized;
};

// Use in emitPlayerStateUpdate
const payload = {
  success: true,
  engineState: {
    ...cloneEngineState(runtimeState),
    snapshot: sanitizeStateForBroadcast(runtimeState.snapshot)
  }
};
```

#### Client-side Changes

```typescript
// Client/src/utils/visionUtils.ts

export function recomputeCharacterVision(character: Character, snapshot: GameSnapshot) {
  if (!character.visionDigest) {
    character.visionRays = [];
    return;
  }
  
  const { distance, angle, radius, centerX, centerY } = character.visionDigest;
  
  // Recompute rays only when needed (character moved, map changed)
  const rays = VisionSystem.castVisionRaysClientSide({
    character: { position: { x: centerX, y: centerY }, size: 30 },
    visionDistance: distance,
    visionAngle: angle,
    rayCount: 128, // Can reduce from 256 on client
    snapshot: snapshot
  });
  
  character.visionRays = rays;
}

// In game component: recompute vision when map updates
useEffect(() => {
  if (snapshot?.characters) {
    for (const char of snapshot.characters) {
      recomputeCharacterVision(char, snapshot);
    }
  }
}, [snapshot?.currentZLevel, snapshot?.mapObjects?.length]);
```

### Radical Optimization: Lazy Vision Calculation

Don't even send vision digests on every update. Only on:
1. Initial state load
2. Character movement
3. Player explicitly requests
4. Map terrain changes

```javascript
// Server-side
function shouldIncludeVisionData(character, previousCharacter) {
  // Only include if position changed
  if (!previousCharacter) return true; // New character
  
  const moved = 
    previousCharacter.position?.x !== character.position?.x ||
    previousCharacter.position?.y !== character.position?.y;
  
  const rotated = 
    previousCharacter.rotation !== character.rotation;
  
  return moved || rotated;
}

// In computeStatePatch:
const charPatch = diffObjects(prevChar, currentChar);
if (!shouldIncludeVisionData(currentChar, prevChar)) {
  delete charPatch.visionDigest;
  delete charPatch.vision;
}
```

## Expected Improvements
- **Per-character overhead**: 36KB → 100 bytes (360x reduction)
- **6 characters**: 216KB → 600 bytes vision data
- **Total update**: 500KB → 50-150KB (3-10x reduction)
- **Latency**: Minimal - vision computation offloaded to client

## Visibility Polygon Optimization

Also optimize the lighting visibility polygons:

```javascript
// Current: Send all computed lighting polygons
lightingPolygons: {
  light_1: [ { x, y }, { x, y }, ... 100+ points ],
  light_2: [ { x, y }, { x, y }, ... 100+ points ]
}

// Optimized: Send only on changes, compress with algorithm
// OR: Send light source configs, client recalculates
lightingSources: [
  { id: 'light_1', x: 100, y: 100, range: 300, intensity: 0.8, enabled: true },
  { id: 'light_2', x: 400, y: 200, range: 200, intensity: 0.6, enabled: true }
]
```

The client can recalculate lighting polygons using the same algorithm as the server.
