# Vision System Setup & Integration Guide

## Quick Start

The advanced vision system has been fully implemented and is ready to use. Here's what was created and how to integrate it.

## Files Created

### Server-Side
1. **`server/worldEngine/visionSystem.js`** - Core vision system implementation
   - Main FOV calculations
   - Fuel-based visibility tracking
   - Cone and close-range detection
   - Environment modifier support

2. **`server/worldEngine/visionSystemUtils.js`** - Utility functions for testing/debugging
   - Test character creation
   - Visibility grid testing
   - Environmental impact analysis
   - Vision report generation

3. **`server/worldEngine/VISION_SYSTEM.md`** - Comprehensive documentation
   - Vision mechanics explained
   - Fuel system details
   - Integration guides
   - Customization examples

4. **`server/worldEngine/VISION_SYSTEM_EXAMPLES.js`** - Usage examples
   - Rendering integration
   - Server-side FOV filtering
   - Effect/modifier examples
   - Dynamic vision conditions

### Client-Side
1. **`client/src/pages/game/visionRenderer.js`** - Vision zone rendering
   - Cone visualization (main, peripheral, close-range)
   - Direction indicator rendering
   - Debug info display
   - Point visibility checking for rendering

### Modified Files
1. **`server/api/campaign_manager.js`** - Updated FOV system
   - Integrated new vision system import
   - Enhanced `isPointInFOV()` with fuel-aware checks
   - Added `getAdvancedPointVisibility()` for detailed info
   - Improved `filterSnapshotForFOV()` with visibility metadata

## How It Works

### Vision Structure

Each character has three vision zones based on their `vision()` getter:

```
┌─────────────────────────────────────────────┐
│ CHARACTER VISION ZONES                      │
├─────────────────────────────────────────────┤
│                                             │
│  Main Cone (Full Vision):                  │
│  - Angle: character.vision.angle           │
│  - Distance: character.vision.distance     │
│  - Visibility: 100%                        │
│                                             │
│  Peripheral (Reduced Vision):              │
│  - Angle: (character.vision.angle / 4)     │
│  - On each side of main cone               │
│  - Visibility: 50%                         │
│  - Cost: 1.2x fuel                         │
│                                             │
│  Close-Range (Omnidirectional):            │
│  - Radius: character.vision.radius         │
│  - No direction requirement                │
│  - Visibility: 100%                        │
│  - Cost: Free (no fuel)                    │
└─────────────────────────────────────────────┘
```

### Fuel System

Vision distance acts as "fuel" that gets consumed:

```
Fuel Cost = (distance_to_target × fuel_multiplier × luminosity_modifier) / max_distance

Range: 0 to 1.0
0   = free (close-range)
0.5 = 50% of fuel pool used
1.0 = complete fuel exhaustion (fully blocked)
```

## Integration Steps

### Step 1: Verify Character Vision Config

Your character's vision is automatically calculated from the `vision()` getter:

```javascript
// In server/worldEngine/Character/character.js
get vision() {
    const baseVision = {
        distance: (this.stats?.INT?.score ?? 0) * 100,
        angle: (this.stats?.INT?.score ?? 0) * 5,
        radius: (this.stats?.INT?.score ?? 0) * 5
    }
    const context = { base: baseVision, character: this };
    this.applyModifierPipeline('onVisionCalc', context);
    return context.base;
}
```

**Already integrated.** No changes needed unless you want to adjust the formula.

### Step 2: Server-Side FOV Filtering (Already Done)

The `campaign_manager.js` has been updated to use the new system automatically:

```javascript
// This now uses the advanced vision system internally
const filteredSnapshot = filterSnapshotForFOV(snapshot, {
    sourceIds: ['characterId'],
    visionContext: { lightLevel: 0.5 }
});
```

**Already integrated.** The system automatically applies when filtering game state for players.

### Step 3: Client-Side Vision Rendering (Optional)

To visualize vision zones, import the renderer in your game component:

```javascript
// In client/src/pages/game/game.jsx

import VisionRenderer from './visionRenderer.js';

// In your rendering loop (e.g., in a vision layer):
function renderVisionLayer() {
    if (isDM && selectedChar) {
        VisionRenderer.renderVisionZones(ctx, selectedChar, worldToScreen, {
            showCloseRange: true,
            showMainCone: true,
            showPeripheral: true,
            showFacingIndicator: true,
            alpha: 0.3
        });

        // Optional: Show debug info
        VisionRenderer.renderVisionDebugInfo(ctx, selectedChar, 20, 80);
    }
}
```

### Step 4: Testing the System

Use the utilities to test your vision setup:

```javascript
// In server code or debug console:
const VisionUtils = require('../server/worldEngine/visionSystemUtils');

// Create test character
const testChar = VisionUtils.createTestCharacter({
    position: { x: 0, y: 0 },
    vision: { distance: 1000, angle: 50, radius: 50 }
});

// Generate full report
const report = VisionUtils.generateVisionReport(testChar);
console.log(report.description);

// Visualize as ASCII
const viz = VisionUtils.visualizeVisionGrid(testChar, 5, 200);
console.log(viz);

// Test specific points
const result = VisionUtils.testPointVisibility(testChar, 500, 0);
console.log(result.description);
```

## Customization Examples

### Increase Vision Distance per INT Point

Edit `character.js`:

```javascript
get vision() {
    const baseVision = {
        distance: (this.stats?.INT?.score ?? 0) * 200,  // was 100, now 200
        angle: (this.stats?.INT?.score ?? 0) * 5,
        radius: (this.stats?.INT?.score ?? 0) * 5
    }
    // ... rest unchanged
}
```

### Create a "High Perception" Race

Add a modifier to race features:

```javascript
const highPerceptionRace = {
    name: 'Elven',
    visionModifier: {
        register: 'onVisionCalc',
        handler: (context) => {
            context.base.distance *= 1.5;  // 50% more distance
            context.base.angle += 20;      // +20 degrees
        }
    }
};
```

### Add Darkness Penalty

Apply when filtering FOV:

```javascript
const visionContext = VisionSystem.createVisionModifier({
    lightLevel: 0.2,
    isInDarkness: true
});

const filtered = filterSnapshotForFOV(snapshot, {
    sourceIds: charIds,
    visionContext: visionContext
});
// Results in ~2x fuel consumption
```

### Infravision Effect

```javascript
const infravisionModifier = {
    register: 'onVisionCalc',
    handler: (context) => {
        // Infravision sees heat signatures
        context.base.distance *= 1.2;  // Slight range boost
    }
};

// And in FOV filtering:
const visionContext = VisionSystem.createVisionModifier({
    lightLevel: 0,
    hasInfravision: true,
    isInDarkness: true
});
// Result: 70% of normal fuel cost even in darkness
```

## Performance Notes

- **Server-side**: Vision calculations are O(1) for points, O(n) for objects (where n = sample points, typically 4-5)
- **Client-side**: Canvas rendering is efficient; use `alpha` blending for performance
- **Memory**: Vision data is stored per-character but calculated on-demand for FOV
- **Scaling**: System handles hundreds of characters efficiently

## Debugging

### Quick Test

```bash
# In your Node.js console or server script:
const VisionUtils = require('./worldEngine/visionSystemUtils');

// Get vision stats for a character
const stats = VisionUtils.reportVisionStats(character);
console.log(stats.description);

// Test environment impact
const impact = VisionUtils.testEnvironmentalImpact(
    character,
    { x: 500, y: 0 }
);
Object.entries(impact).forEach(([scenario, result]) => {
    console.log(`${scenario}: ${result.description}`);
});
```

### ASCII Visualization

```javascript
// Display gridded vision zones
const visualization = VisionUtils.visualizeVisionGrid(character, 10, 100);
console.log(visualization);
// ◆ = character
// ● = main cone
// ◯ = peripheral
// ○ = close range
// · = not visible
```

### Enable Client-Side Rendering

```javascript
// In game.jsx, add a layer to render vision:
if (isDM) {
    // Render vision for debugging
    VisionRenderer.renderVisionZones(
        ctx,
        selectedChar,
        worldToScreen,
        { alpha: 0.4 }
    );
}
```

## Common Issues & Solutions

### Vision not updating for character

**Issue**: Character vision doesn't change when stats change.

**Solution**: Character's `_cache` needs to be invalidated:
```javascript
character.invalidateCache();
// Vision getter will be recalculated next access
```

### Characters can see through walls

**Note**: Current system doesn't include raycasting for occlusion. Line-of-sight blocking is a planned enhancement.

**Workaround**: Implement your own occlusion check:
```javascript
function isPointVisibleWithOcclusion(character, target, mapObjects) {
    const baseResult = VisionSystem.getPointVisibility(...);
    if (baseResult.visibility === 0) return false;
    
    // Check for blocking objects
    return !isBlockedByObject(character.position, target, mapObjects);
}
```

### Lighting/Environment conditions not affecting vision

**Issue**: Vision context not applied to FOV filtering.

**Solution**: Pass visionContext when filtering:
```javascript
const visionContext = VisionSystem.createVisionModifier({
    lightLevel: ambientLight,
    isInDarkness: ambientLight < 0.3
});

const filtered = filterSnapshotForFOV(snapshot, {
    sourceIds: charIds,
    visionContext: visionContext  // Add this
});
```

## Next Steps

1. **Test**: Use VisionUtils to verify character vision stats
2. **Customize**: Adjust the vision formula in character.js if needed
3. **Render** (Optional): Add vision renderer to your game layer for visual debugging
4. **Extend**: Add occlusion/raycasting when ready
5. **Optimize**: Implement spatial indexing for very large worlds

## API Quick Reference

### Server Functions

```javascript
// Core system
VisionSystem.getPointVisibility(px, py, character, visionConfig, context)
VisionSystem.isObjectVisible(character, object, context)
VisionSystem.createVisionModifier(conditions)
VisionSystem.getVisionStats(character)

// Campaign manager (updated)
filterSnapshotForFOV(snapshot, options)
getAdvancedPointVisibility(source, point, context)
isPointInFOV(source, point)
```

### Client Functions

```javascript
// Rendering
VisionRenderer.renderVisionZones(ctx, character, worldToScreen, options)
VisionRenderer.renderMainVisionCone(ctx, character, distance, angle, w2s)
VisionRenderer.renderPeripheralVisionCones(ctx, character, distance, angle, w2s)
VisionRenderer.renderCloseRangeVision(ctx, character, radius, w2s)
VisionRenderer.renderVisionDebugInfo(ctx, character, screenX, screenY)
```

### Utilities

```javascript
VisionUtils.generateVisionReport(character, testPoints)
VisionUtils.visualizeVisionGrid(character, gridSize, spacing, context)
VisionUtils.testPointVisibility(character, px, py, context)
VisionUtils.compareCharacterVision(char1, char2)
VisionUtils.testEnvironmentalImpact(character, point, scenarios)
```

## Files Reference

| File | Purpose | Type |
|------|---------|------|
| `visionSystem.js` | Core vision calculations | Module |
| `visionSystemUtils.js` | Testing & debugging utilities | Module |
| `visionRenderer.js` | Client-side rendering | Module |
| `VISION_SYSTEM.md` | Comprehensive documentation | Docs |
| `VISION_SYSTEM_EXAMPLES.js` | Code examples and patterns | Examples |
| `campaign_manager.js` | Updated with new FOV system | Modified |

## Support

For questions or issues:
1. Check `VISION_SYSTEM.md` for detailed documentation
2. Review `VISION_SYSTEM_EXAMPLES.js` for usage patterns
3. Run debug utilities from `visionSystemUtils.js`
4. Use `renderVisionDebugInfo()` for client-side verification
