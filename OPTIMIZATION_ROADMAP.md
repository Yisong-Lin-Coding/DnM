# Server-Client Communication Optimization Roadmap

## Current Issues
- **Full state broadcasts**: Every action sends entire game snapshot (characters, objects, lighting polygons, vision rays)
- **Vision ray overhead**: 256 rays per character × 6+ characters = 1500+ ray objects per update
- **No delta updates**: Duplicate unchanged data sent repeatedly
- **Inefficient lighting**: Complex visibility polygons sent even when unchanged
- **Redundant vision data**: Full 3D vision rays sent when only 2D changes matter

## Optimization Strategy

### Phase 1: Delta/Patch Updates (Immediate - Largest Impact)
**Problem**: Sending ENTIRE snapshot on every change
**Solution**: Implement delta patching - only send what changed
- Track previous state revision
- Only include modified fields in updates
- Use sparse updates instead of full snapshots
- Should reduce data by **70-80%**

### Phase 2: Optimize Vision System (Good Impact)
**Problem**: Sending 256 individual ray objects per character
**Solution**: Send only essential visibility metadata instead
- Replace full ray arrays with visibility digest
- Send only center FOV polygon outline, not individual rays
- Calculate rays client-side from simple parameters
- Should reduce data by **40-50%** for vision

### Phase 3: Smart State Serialization (Quick Win)
**Problem**: Sending computed values that don't change mid-session
**Solution**: Strip transient computed data from wire
- Remove pre-calculated vision rays from broadcast payloads
- Remove debug light levels
- Remove computed geometry polygons
- Clients can recalculate if needed
- Should reduce data by **20-30%**

### Phase 4: Selective Broadcasting (Network Efficiency)
**Problem**: Sending full state to all players regardless of FOV
**Solution**: Already partially implemented, optimize further
- Only send visible character data per player
- Batch multiple updates into single message
- Use room-specific broadcasts
- Should reduce per-player data by **50%**

### Phase 5: Compression & Binary Protocol (Polish)
**Problem**: JSON overhead on large payloads
**Solution**: Optional gzip or msgpack for large updates
- Enable compression on server
- Use binary format for vision data only
- Should reduce network bandwidth by **30-40%**

## Implementation Priority
1. **Phase 1 (Delta Updates)**: ~4-6 hours - Affects ALL updates, 70% improvement
2. **Phase 2 (Vision optimization)**: ~3-4 hours - 40% improvement on vision data
3. **Phase 3 (State cleanup)**: ~2-3 hours - 20% improvement
4. **Phase 4 (Selective broadcast)**: Already mostly done - ~1 hour
5. **Phase 5 (Compression)**: ~2-3 hours - Optional enhancement

## Expected Results
- **Data per update**: 500KB → 50-100KB (80-90% reduction)
- **Latency**: 200-500ms → 50-100ms (75% improvement)
- **Bandwidth**: Proportional to data reduction
- **CPU**: Lower serialization overhead

## Technical Details
See detailed implementation files:
- `DELTA_UPDATES_IMPLEMENTATION.md` - Phase 1 details
- `VISION_OPTIMIZATION.md` - Phase 2 details
