# Delta Updates Implementation Guide

## Core Concept
Instead of sending the entire game state snapshot on every update, only send the fields that changed.

### Example: Movement Update
```javascript
// Current (inefficient): ~500KB for full snapshot
{
  success: true,
  engineState: {
    revision: 45,
    snapshot: {
      characters: [ // 6 characters × 100+ fields each
        { id, name, position, HP, MP, STA, stats, vision, visionRays, ... },
        // ... 5 more characters
      ],
      mapObjects: [ // 20+ objects
        { id, terrainType, x, y, hitbox, ... },
        // ...
      ],
      lighting: { sources, enabled, ... },
      lightingPolygons: { ... }, // Large geometry data
      // ... etc
    }
  }
}

// Optimized (efficient): ~10KB for delta patch
{
  success: true,
  type: 'delta',
  campaignID: 'abc123',
  revision: 45,
  patch: {
    characters: {
      'char-id-1': {
        position: { x: 150, y: 200 }
        // Only the changed fields
      }
    }
  }
}
```

## Implementation Steps

### 1. Create State Tracking System
Track the last known state per client to compute deltas.

```javascript
// Track last broadcast state
const clientStateCache = {
  'socket-id-1': {
    lastRevision: 44,
    lastSnapshot: {...},
    lastBroadcast: Date.now()
  }
}
```

### 2. Implement Diff Algorithm
Compare previous state with current state to find changes.

```javascript
function computeStatePatch(previousSnapshot, currentSnapshot) {
  const patch = {
    characters: {},
    mapObjects: {},
    // other sections...
  };
  
  // Characters
  const prevChars = new Map(previousSnapshot.characters.map(c => [c.id, c]));
  for (const currentChar of currentSnapshot.characters) {
    const prevChar = prevChars.get(currentChar.id);
    if (!prevChar) {
      patch.characters[currentChar.id] = currentChar; // New character
    } else {
      const charPatch = diffObjects(prevChar, currentChar);
      if (Object.keys(charPatch).length > 0) {
        patch.characters[currentChar.id] = charPatch;
      }
    }
  }
  
  return patch;
}

function diffObjects(prev, current) {
  const patch = {};
  for (const key in current) {
    if (JSON.stringify(prev[key]) !== JSON.stringify(current[key])) {
      patch[key] = current[key];
    }
  }
  return patch;
}
```

### 3. Send Delta Updates
Modify all broadcast calls to use deltas instead of full snapshots.

```javascript
async function emitPlayerStateUpdate(socket, campaign, payload) {
  const baseSnapshot = payload.engineState.snapshot;
  
  // Send full snapshot on first load or version mismatch
  if (needsFullSnapshot(socket)) {
    socket.emit('campaign_gameStateUpdated', {
      ...payload,
      type: 'full',
      snapshot: baseSnapshot
    });
    cacheBaselineState(socket, baseSnapshot);
    return;
  }
  
  // Compute and send delta
  const previousSnapshot = getClientBaseline(socket);
  const patch = computeStatePatch(previousSnapshot, baseSnapshot);
  
  socket.emit('campaign_gameStateUpdated', {
    success: true,
    type: 'delta',
    campaignID: payload.campaignID,
    revision: payload.engineState.revision,
    patch: patch,
    timestamp: Date.now()
  });
  
  cacheBaselineState(socket, baseSnapshot);
}
```

### 4. Client-Side Patching
Client applies patches to maintain state without full reloads.

```typescript
// Client code (React/JS)
let localSnapshot = null;

socket.on('campaign_gameStateUpdated', (payload) => {
  if (payload.type === 'full') {
    // Full snapshot - reset state
    localSnapshot = payload.snapshot;
    applyLoadedSnapshot(localSnapshot);
  } else if (payload.type === 'delta') {
    // Apply patch to existing state
    applyStatePatch(localSnapshot, payload.patch);
    updateUIFromSnapshot();
  }
});

function applyStatePatch(snapshot, patch) {
  // Apply character patches
  if (patch.characters) {
    for (const charId in patch.characters) {
      const charIdx = snapshot.characters.findIndex(c => c.id === charId);
      if (charIdx >= 0) {
        Object.assign(snapshot.characters[charIdx], patch.characters[charId]);
      } else {
        snapshot.characters.push(patch.characters[charId]);
      }
    }
  }
  
  // Apply map object patches
  if (patch.mapObjects) {
    for (const objId in patch.mapObjects) {
      const objIdx = snapshot.mapObjects.findIndex(o => o.id === objId);
      if (objIdx >= 0) {
        Object.assign(snapshot.mapObjects[objIdx], patch.mapObjects[objId]);
      } else {
        snapshot.mapObjects.push(patch.mapObjects[objId]);
      }
    }
  }
  
  // Update other fields if present
  if (patch.lighting) Object.assign(snapshot.lighting, patch.lighting);
  if (patch.journalState) snapshot.journalState = patch.journalState;
}
```

## Fallback Mechanism
If client state gets out of sync:
- Client detects inconsistency (bad data, missing fields)
- Requests full snapshot: `socket.emit('campaign_requestFullState')`
- Server responds with complete state marked as `type: 'full'`
- Client resets and continues with deltas

## Expected Improvements
- **Movement update**: ~500KB → ~5KB (100x reduction)
- **Resource change**: ~500KB → ~2KB (250x reduction)
- **Status effect**: ~500KB → ~3KB (167x reduction)
- **Chat/journal**: ~500KB → ~200B (2500x reduction)

## Testing Strategy
1. Add logging to track patch sizes vs full snapshot sizes
2. Monitor client state consistency
3. Validate patches apply correctly
4. Test fallback to full state requests
