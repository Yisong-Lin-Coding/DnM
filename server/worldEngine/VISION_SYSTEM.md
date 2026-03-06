# Advanced Vision System Documentation

## Overview

The advanced vision system implements a sophisticated, scalable perception model based on character attributes with three distinct vision zones:

1. **Close-Range Perception** - Omnidirectional awareness circle
2. **Main Vision Cone** - Centered on character facing, full visibility
3. **Peripheral Vision Cones** - Reduced visibility on left and right flanks

## Vision Configuration

Vision is derived from the character's `vision()` getter in `character.js`:

```javascript
get vision() {
    const baseVision = {
        distance: (this.stats?.INT?.score ?? 0) * 100,  // Max perception distance in units
        angle: (this.stats?.INT?.score ?? 0) * 5,       // Main cone angle in degrees
        radius: (this.stats?.INT?.score ?? 0) * 5       // Close-range radius in units
    }
    const context = { base: baseVision, character: this };
    this.applyModifierPipeline('onVisionCalc', context);
    return context.base;
}
```

### Vision Parameters

- **distance**: Maximum distance the character can see (in world units)
  - Acts as the "fuel pool" for the vision system
  - Example: INT 10 → 1000 units of vision distance

- **angle**: Main vision cone angle in degrees
  - Total angle of the main cone centered on rotation
  - Example: INT 10 → 50 degrees (25° on each side of center)

- **radius**: Close-range perception radius
  - Minimum distance where vision works regardless of direction
  - Example: INT 10 → 50 units radius

## Vision Zones Explained

### 1. Close-Range Perception Circle

**Always active**: The character can see anything within this radius, regardless of facing direction or obstacles.

- **Visibility**: 100% (full)
- **Fuel Cost**: 0 (free, no distance consumed)
- **Mechanic**: Simple distance check from character position
- **Purpose**: Prevent "tunnel vision" - characters can always see immediate surroundings

**Example**: Character with radius=50 sees everything within 50 units, even behind them.

### 2. Main Vision Cone

**Directional perception**: Extends from character's facing direction in a cone shape.

- **Width**: Equal to the character's `angle` parameter
- **Visibility**: 100% (full clarity)
- **Fuel Consumption**: Proportional to distance traveled
- **Mechanic**: Point must be within the cone arc and within max distance
- **Purpose**: Primary sensory input

**Cone Structure**:
```
        Character (rotation = 0°, angle = 50°)
        
              Forward (0°) →
                  /\
                 /  \
                /    \
               /  ◊   \     ◊ = object at 50% distance
              /        \    Can see with full visibility
            -25°      +25°
```

### 3. Peripheral Vision Cones

**Reduced awareness**: Extends from edges of main cone, covering flanks.

- **Width**: Equal to **half** the main angle on each side
- **Visibility**: 50% (greyed out, reduced clarity)
- **Fuel Consumption**: 20% higher than main cone (1.2x multiplier)
- **Purpose**: Detect movement/shapes in the periphery without full detail
- **Mechanic**: Falls between main cone edge and main cone edge + (angle/4)

**Structure**:
```
          Main: angle/2 = 25°
          Peripheral: angle/4 = 12.5° per side

             /╲            ╱╲
            /  ╲  MAIN    /  ╲
           /    ╲        /    ╲
          ━━━━━━━━○━━━━━━━━━━
      PERI      -25°    +25°      PERI
      12.5°              12.5°
```

## Fuel-Based Vision System

Vision operates on a **fuel** mechanic where distance acts as a limited resource:

### Fuel Pool

- **Initial Fuel**: Equal to character's `distance` parameter
- **Represents**: Total perception capacity available

### Fuel Consumption

Fuel is consumed as the character attempts to perceive distant objects:

```
Fuel Cost = (distance_to_target * fuelCostMultiplier * luminosityModifier) / maxDistance
```

**Parameters**:
- `distance_to_target`: How far the object is from character
- `fuelCostMultiplier`: Base cost per unit (default 1.0)
- `luminosityModifier`: Light level adjustment (0.3 to 1.0)
  - 1.0 in darkness (full cost)
  - 0.3 in bright light (30% cost) - more efficient
- `maxDistance`: Character's vision distance

### Luminosity Modifier

Different light levels affect vision efficiency:

```javascript
// Light increases efficiency (lower fuel consumption)
lightLevel = 1.0    → modifier = 1.0   (normal conditions)
lightLevel = 0.5    → modifier = 0.65  (twilight)
lightLevel = 0      → modifier = 0.5   (darkness - doubles fuel consumption)
hasInfravision = true → modifier *= 0.7 (30% fuel reduction)
```

### Fuel Cost Examples

Character with:
- `distance = 1000` (1000 units fuel)
- `lightLevel = 1.0` (normal)

Checking visibility to object 500 units away:
```
fuelCost = (500 * 1.0 * 1.0) / 1000 = 0.5 (50% of fuel pool)
```

Same object in darkness:
```
fuelCost = (500 * 1.0 * 0.5) / 1000 = 0.25 (25% of fuel pool)
```

Same object with infravision in darkness:
```
fuelCost = (500 * 1.0 * 0.5 * 0.7) / 1000 = 0.175 (17.5% of fuel pool)
```

## Server-Side Vision Implementation

### Location
`server/worldEngine/visionSystem.js`

### Key Functions

#### `buildVisionZones(character, visionConfig)`
Constructs the three vision zones from character data.

```javascript
const zones = VisionSystem.buildVisionZones(character, character.vision);
// Returns: { main, peripheral, closeRange }
```

#### `getPointVisibility(px, py, character, visionConfig, visionContext)`
Determines if a point is visible and returns detailed visibility info.

```javascript
const result = VisionSystem.getPointVisibility(
    100, 50,                           // Point to check
    character,                          // Viewer character
    character.vision,                   // Vision config
    { luminosityModifier: 0.5 }        // Modifiers
);
// Returns: {
//   visibility: 0-1,           // 0 (blocked), 0.5 (peripheral), 1.0 (main)
//   visionType: string,        // 'main', 'peripheral', 'closeRange', 'blocked'
//   fuelCost: 0-1             // Fuel consumed (0 if close range, 1.0 if blocked)
// }
```

#### `isObjectVisible(character, targetObject, visionContext)`
Checks if an entire object is visible (samples multiple points).

```javascript
const result = VisionSystem.isObjectVisible(
    character,
    mapObject,
    { isInDarkness: true }
);
// Returns: {
//   isVisible: boolean,
//   visionType: string,
//   coverage: 0-1,            // How much of object is visible
//   fuelUsed: 0-1
// }
```

#### `createVisionModifier(conditions)`
Creates a vision context from environmental conditions.

```javascript
const modifier = VisionSystem.createVisionModifier({
    lightLevel: 0.5,
    isInDarkness: false,
    hasInfravision: true,
    isBlinded: false
});
```

## Client-Side Vision Rendering

### Location
`client/src/pages/game/visionRenderer.js`

### Rendering Functions

#### `renderVisionZones(ctx, character, worldToScreen, options)`
Renders all three vision zones.

```javascript
import { renderVisionZones } from './visionRenderer.js';

renderVisionZones(ctx, character, worldToScreen, {
    showCloseRange: true,
    showMainCone: true,
    showPeripheral: true,
    showFacingIndicator: true,
    alpha: 0.5
});
```

#### `renderCloseRangeVision(ctx, character, radius, worldToScreen)`
Renders only the close-range circle.

```javascript
renderCloseRangeVision(ctx, character, character.vision.radius, worldToScreen);
```

#### `renderMainVisionCone(ctx, character, distance, angle, worldToScreen)`
Renders the main vision cone.

```javascript
renderMainVisionCone(
    ctx,
    character,
    character.vision.distance,
    character.vision.angle,
    worldToScreen
);
```

#### `renderPeripheralVisionCones(ctx, character, distance, angle, worldToScreen)`
Renders peripheral vision zones on left and right.

```javascript
renderPeripheralVisionCones(
    ctx,
    character,
    character.vision.distance,
    character.vision.angle,
    worldToScreen
);
```

### Example Integration

Add to your game rendering layer:

```javascript
// In your canvas rendering loop
const visionRenderer = require('./visionRenderer.js');

// Render vision for selected character
if (selectedChar) {
    visionRenderer.renderVisionZones(ctx, selectedChar, worldToScreen, {
        showCloseRange: true,
        showMainCone: true,
        showPeripheral: isDM,  // Only show peripheral if DM
        showFacingIndicator: true,
        alpha: 0.3
    });
}

// Render debug info
visionRenderer.renderVisionDebugInfo(ctx, selectedChar, 10, 10);
```

## Integration with FOV Culling

### Campaign Manager Updates

The `campaign_manager.js` has been updated to use the new vision system:

#### `isPointInFOV(source, point)`
Simple boolean check using the vision system.

```javascript
if (isPointInFOV(character, targetPoint)) {
    // Object is visible
}
```

#### `getAdvancedPointVisibility(source, point, visionContext)`
Returns detailed visibility information with fuel cost.

```javascript
const result = getAdvancedPointVisibility(
    character,
    { x: 100, y: 200 },
    { luminosityModifier: 0.5 }
);
console.log(result.visibility);   // 0.5 (peripheral)
console.log(result.fuelCost);     // 0.3 (30% of fuel)
console.log(result.visionType);   // 'peripheral'
```

#### `filterSnapshotForFOV(snapshot, options)`
Filters game state objects based on FOV with enhanced metadata.

```javascript
const filteredSnapshot = filterSnapshotForFOV(gameSnapshot, {
    sourceIds: ['char1', 'char2'],
    visionContext: { lightLevel: 0.5 }
});

// Objects include vision metadata:
// obj._visionData = {
//   visibility: 0.5,
//   visionType: 'peripheral'
// }
```

## Scaling and Customization

### Modifying Base Vision

Adjust the vision formula in `character.js`:

```javascript
get vision() {
    const INT = this.stats?.INT?.score ?? 0;
    const baseVision = {
        distance: INT * 150,    // Increase from 100 to 150 per INT point
        angle: INT * 10,        // Increase from 5 to 10 degrees per INT point
        radius: INT * 10        // Increase from 5 to 10 units per INT point
    }
    const context = { base: baseVision, character: this };
    this.applyModifierPipeline('onVisionCalc', context);
    return context.base;
}
```

### Creating Vision Modifiers via Effects

Modifiers can be applied through the character's modifier pipeline:

```javascript
// In a modifier/effect:
this.register('onVisionCalc', (context) => {
    // Improve vision in your specialized class
    context.base.distance *= 1.5;
    context.base.angle += 20;
});
```

### Environmental Modifiers

Pass vision context to FOV filtering:

```javascript
const visionContext = VisionSystem.createVisionModifier({
    lightLevel: scene.lightLevel,
    isInDarkness: scene.isDark,
    hasInfravision: character.hasInfravision,
    isBlinded: character.statusEffects.some(e => e.type === 'blinded')
});

const filtered = filterSnapshotForFOV(snapshot, {
    sourceIds: ['char1'],
    visionContext
});
```

### Changing Fuel Cost Model

Modify `calculateFuelCost()` in `visionSystem.js`:

```javascript
function calculateFuelCost(distance, visionZone, context = {}) {
    const config = { ...DEFAULT_VISION_CONTEXT, ...context };
    
    // Exponential fuel consumption (more expensive at distance)
    const baseCost = Math.pow(distance / visionZone.distance, 2) * visionZone.distance;
    const adjustedCost = baseCost * config.luminosityModifier;
    
    return Math.min(1.0, adjustedCost / visionZone.distance);
}
```

## Common Use Cases

### Darkvision & Infravision

```javascript
const modifier = VisionSystem.createVisionModifier({
    lightLevel: 0,
    hasInfravision: true,
    isInDarkness: true
});

const result = VisionSystem.getPointVisibility(
    px, py, character, character.vision, modifier
);
// Infravision reduces fuel cost to 0.7x even in darkness
```

### Blind Condition

```javascript
const modifier = VisionSystem.createVisionModifier({
    isBlinded: true
});

const result = VisionSystem.getPointVisibility(
    px, py, character, character.vision, modifier
);
// Returns { visibility: 0, visionType: 'disabled', fuelCost: 1.0 }
```

### Dynamic Lighting Impact

```javascript
// Update vision as light changes
const lightLevel = calculateAmbientLight(character.position, mapLights);

const modifier = VisionSystem.createVisionModifier({
    lightLevel: lightLevel,
    isInDarkness: lightLevel < 0.3
});

const visible = VisionSystem.isObjectVisible(
    character,
    mapObject,
    modifier
);
```

## Performance Considerations

- Vision calculations are efficient: O(n) where n = number of sample points
- Close-range detection is O(1) distance check
- Cone detection is O(1) angle calculation
- Object visibility samples 4-5 points per object
- Server loads cached `vision` property from character stats
- Client renders zones efficiently using canvas arc operations

## Debugging

### Enable Vision Debug Rendering

```javascript
import { renderVisionDebugInfo } from './visionRenderer.js';

// In game.jsx rendering loop
if (isDM && selectedChar) {
    renderVisionDebugInfo(ctx, selectedChar, 10, 30);
}
```

### Log Visibility Calculations

```javascript
const result = VisionSystem.getPointVisibility(...);
console.log('Visibility:', result);
// {
//   visibility: 0.5,
//   visionType: 'peripheral',
//   fuelCost: 0.36
// }
```

### Test Vision System

```javascript
// Test character vision
const character = { 
    position: { x: 0, y: 0 }, 
    rotation: 0,
    vision: { distance: 1000, angle: 50, radius: 50 }
};

// Test point in main cone
const mainConeResult = VisionSystem.getPointVisibility(
    500, 0, character, character.vision, {}
);
console.assert(mainConeResult.visibility === 1.0); // Should be fully visible

// Test point in peripheral
const peripheralResult = VisionSystem.getPointVisibility(
    400, 400, character, character.vision, {}
);
console.assert(peripheralResult.visibility === 0.5); // Should be peripheral
```

## Future Enhancements

- **Occlusion System**: Raycast to detect obstacles blocking vision
- **Dynamic FOV**: Adjust cone angle based on focus/attention
- **Stealth Integration**: Visibility affects detection difficulty
- **Fog of War**: Persistent memory system for explored areas
- **Directional Lights**: More sophisticated shadow casting
- **Performance Optimization**: Quadtree-based spatial indexing for large scenes
