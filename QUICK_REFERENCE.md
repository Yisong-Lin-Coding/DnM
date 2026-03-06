# Quick Reference: Server-Client Optimization

## Problem → Solution Mapping

| Problem | Solution | File | Impact |
|---------|----------|------|--------|
| 500KB full snapshot every update | Send only changed fields (delta) | deltaUpdateManager.js | 90% reduction |
| 256 vision rays per character (36KB each) | Send compact digest, compute on client | stateOptimization.js | 99.7% per char |
| Lighting geometry always sent | Remove from broadcast | stateOptimization.js | 100KB saving |
| All clients get same data | FOV filter (already done) | campaign_manager.js | 50% reduction |
| 200-500ms latency | Reduced payload size | All optimizations | 75% improvement |

## Core Algorithm

```
Server: On every update → Full snapshot computed
        Check: Has client baseline?
        NO  → Send full snapshot (500KB), save as baseline
        YES → Compute delta from baseline (10-50KB)
            → Send delta with type: 'delta'
            → Track new baseline

Client: Receive payload
        If type === 'full' → Replace entire state
        If type === 'delta' → Apply patch to existing state
        Recalculate vision rays (client-side)
```

## 3-Function Implementation

### 1. Server: Create Optimized Payload
```javascript
const payload = createOptimizedPayload(engineState, {
  previousSnapshot: clientBaseline?.snapshot,
  shouldSendFull: needsFullSnapshot,
  excludeVisionRays: true
});
socket.emit("campaign_gameStateUpdated", payload);
```

### 2. Server: Store Baseline
```javascript
deltaManager.setClientBaseline(
  socketId,
  sanitizedSnapshot,
  revision
);
```

### 3. Client: Apply Patch
```javascript
const newSnapshot = statePatching.processIncomingPayload(
  payload,
  currentSnapshot,
  { visionSystem: VisionSystem }
);
```

## Data Size Comparison

```
Character Movement Update:
  Before: 500KB (full snapshot)
  After:  5KB   (just position change)
  Savings: 495KB (99%)

Resource Change (HP damage):
  Before: 500KB (full snapshot)
  After:  2KB   (just HP value)
  Savings: 498KB (99.6%)

Combat Turn:
  Before: Server computes 256 rays per char × 6 chars = 1536 ray objects
  After:  Client computes on demand, network sees only params
  
Vision Ray Network Data:
  Before: 36KB per character (256 objects × 140 bytes each)
  After:  100 bytes per character (digest only)
  Savings: 35.9KB per character (99.7%)
```

## File Checklist

**Create New:**
- ✅ `server/utils/deltaUpdateManager.js` (200 lines)
- ✅ `server/utils/stateOptimization.js` (300 lines)
- ✅ `client/src/utils/statePatching.ts` (400 lines)

**Modify:**
- [ ] `server/api/campaign_manager.js` - Update `emitPlayerStateUpdate()`
- [ ] `server/api/campaign_manager.js` - Add `campaign_requestFullState` handler
- [ ] `server/api/campaign_manager.js` - Add disconnect cleanup
- [ ] Client game component - Wire up patch handler

**Document:**
- ✅ OPTIMIZATION_ROADMAP.md
- ✅ DELTA_UPDATES_IMPLEMENTATION.md
- ✅ VISION_OPTIMIZATION.md
- ✅ INTEGRATION_GUIDE.md
- ✅ OPTIMIZATION_COMPLETE_SUMMARY.md

## Server Changes: Before → After

### BEFORE (campaign_manager.js)
```javascript
async function emitPlayerStateUpdate(socket, campaign, payload, options = {}) {
    // ... code ...
    const engineState = cloneEngineState(runtimeState);
    socket.to(playersRoom).emit("campaign_gameStateUpdated", {
        success: true,
        engineState,
        snapshot: baseSnapshot  // Full 500KB snapshot every time!
    });
}
```

### AFTER (campaign_manager.js)
```javascript
async function emitPlayerStateUpdate(socket, campaign, payload, options = {}) {
    // ... code ...
    const sanitized = sanitizeSnapshotForBroadcast(filtered Snapshot);
    const clientPayload = createOptimizedPayload(
        { ...payload.engineState, snapshot: sanitized },
        {
            previousSnapshot: baseline?.snapshot,
            shouldSendFull: shouldSendFullSnapshot(socket.id, baseline?.revision, revision)
        }
    );
    deltaManager.setClientBaseline(socket.id, sanitized, revision);
    socket.to(playersRoom).emit("campaign_gameStateUpdated", clientPayload);
}
```

## Client Changes: Hook Into Patch Handler

```typescript
// In game component or socket handler
import statePatching from '@/utils/statePatching';

socket.on('campaign_gameStateUpdated', (payload) => {
  const newSnapshot = statePatching.processIncomingPayload(
    payload,
    snapshot,
    { visionSystem: VisionSystem }
  );
  setSnapshot(newSnapshot);
});
```

## Metrics to Monitor

### During Testing
```javascript
console.log({
  payloadType: 'delta' | 'full',
  payloadSizeKB: payload._sizeKB,
  compressionRatio: before / after,
  revisionDelta: current - previous,
  charactersModified: Object.keys(patch.characters).length
});
```

### Expected Results
| Metric | Before | After | Goal |
|--------|--------|-------|------|
| Avg payload | 500KB | 25KB | ✅ 95% reduction |
| 95th percentile | 600KB | 50KB | ✅ 92% reduction |
| Latency | 300ms | 75ms | ✅ 75% reduction |
| Bandwidth/hour | 5MB | 500KB | ✅ 90% reduction |
| CPU (serialization) | Medium | Low | ✅ Reduced |

## Common Issues & Fixes

**Issue**: "visionRays is undefined on client"
- **Fix**: Clients compute on demand from visionDigest
- **Test**: Move character, check visionRays recalculates

**Issue**: "Patch application leaves state inconsistent"
- **Fix**: Client validates state, requests full on error
- **Test**: Intentionally break patch, verify fallback works

**Issue**: "Lighting is wrong on client"
- **Fix**: Client recalculates from snapshot.lighting config
- **Test**: Enable/disable lights, verify client updates

**Issue**: "Old clients get broken delta format"
- **Fix**: Delta is backward compatible (ignore patch field)
- **Test**: Old client sees full snapshots, works fine

## Debugging Checklist

1. **Enable logging** in both deltaUpdateManager and campaign_manager
2. **Monitor socket** - Check baseline is being stored/updated
3. **Track patches** - Count delta vs full ratio (goal: 80%+ delta)
4. **Validate data** - Ensure patches apply correctly
5. **Measure latency** - Use browser DevTools network tab
6. **Test movement** - Most critical operation
7. **Test combat** - HP changes must sync correctly
8. **Test edges** - Check character count scaling

## Rollback (If Needed)
```javascript
// In stateOptimization.js, one-line revert:
shouldSendFull = true;  // Force full snapshots
// This instantly disables optimizations while you debug
```

## Success Criteria

✅ **Data reduction**: Achieve <50KB average payload
✅ **Latency**: Achieve <100ms round-trip
✅ **Stability**: Zero desync errors in logs
✅ **Compatibility**: Old clients still work
✅ **Scaling**: Works with 6+ players
✅ **Smooth gameplay**: No lag in combat/movement

---

**Status**: Ready to implement | **Estimated effort**: 2-3 hours | **Expected result**: 75% latency improvement
