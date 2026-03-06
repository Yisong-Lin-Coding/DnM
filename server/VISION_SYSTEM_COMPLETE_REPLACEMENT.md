# Vision System Complete Integration & Replacement

## Changes Completed

### 1. ✅ Vision Renderer Rewritten (`visionRenderer.js`)
**Major fixes applied:**
- **Coordinate transformation**: Now uses `screenX = worldX * camera.zoom - camera.x` instead of passing external worldToScreen function
- **Camera scaling**: All distances scaled by `camera.zoom` to render correctly at any zoom level
- **Rotation correction**: Uses `getFacingAngleRad(rotation)` which returns `(rotation - 90) * π/180` to match game rotation convention:
  - Game: rotation=0 faces UP, rotation=90 faces RIGHT
  - Canvas: angle=0 faces RIGHT, angle=π/2 faces DOWN
- **Parameters changed**: All render functions now take `camera` object instead of `worldToScreen` function

**New method signatures:**
```javascript
renderVisionZones(ctx, character, camera, options)
renderCloseRangeVision(ctx, character, radius, camera)
renderMainVisionCone(ctx, character, distance, angle, camera)
renderPeripheralVisionCones(ctx, character, distance, angle, camera)
renderFacingDirection(ctx, character, distance, camera)
```

### 2. ✅ Vision Layer Updated (`9Vision.jsx`)
**Changes:**
- Updated `draw` method signature parameters
- Now passes `camera` object to `VisionRenderer.renderVisionZones()` instead of worldToScreen
- Added `shouldRedraw` optimization to only redraw when relevant state changes
- Updated opacity: DM sees all vision at alpha 0.2, selected char at alpha 0.5

### 3. ✅ Old Vision Rendering Removed (`3Characters.jsx`)
**Removed:**
- Deleted the old vision cone drawing code that used `visionDistance` and `visionArc`
- Removed `showVision` parameter from `drawCharacter` calls
- Old system was rendering on top of characters layer - now consolidated into dedicated vision layer

### 4. ✅ Server Character Token Updated (`campaign_manager.js`)
**Added:**
```javascript
vision: {
    distance: visionDistance,  // Max distance in world units
    angle: visionArc,          // Cone angle in degrees
    radius: visionDistance * 0.2  // Close-range radius
}
```

## Architecture

### Data Flow (Old → New)
```
OLD SYSTEM (Still works):
  server: visionDistance, visionArc
  ↓
  client: game.jsx checks isVisible()
  ↓
  characters layer: draws old vision cones
  ↓ 
  fog layer: uses visionDistance/visionArc

NEW SYSTEM (Replaces rendering):
  server: visionDistance, visionArc → vision object
  ↓
  client: visionLayer.draw()
  ↓
  visionRenderer: proper coordinate transforms
  ↓
  canvas: correctly positioned and rotated vision cones
```

### Rendering Pipeline
```
game.jsx state
  ├─ characters[] (each has vision property)
  ├─ selectedChar (has vision property)
  ├─ isDM flag
  └─ camera { x, y, zoom }
    ↓
michelangeloEngine(layers, state)
  └─ visionLayer.draw(ctx, canvas, state)
      └─ VisionRenderer.renderVisionZones()
          └─ Calls all render functions with camera params
              ├─ renderMainVisionCone(): green cone at (rotation - 90)°
              ├─ renderPeripheralVisionCones(): grey flanks
              ├─ renderCloseRangeVision(): blue circle
              └─ renderFacingDirection(): direction indicator
```

## Coordinate System Understanding

### Game Rotation Convention
- rotation = 0: Facing UP (negative Y / north)
- rotation = 90: Facing RIGHT (positive X / east)
- rotation = 180: Facing DOWN (positive Y / south)
- rotation = 270: Facing LEFT (negative X / west)

### Canvas Angle Convention
- angle = 0: Facing RIGHT (positive X)
- angle = π/2: Facing DOWN (positive Y)
- angle = π: Facing LEFT (negative X)
- angle = 3π/2: Facing UP (negative Y)

### Conversion
```javascript
canvasAngle = (rotation - 90) * π/180
```
This shifts the game convention to match canvas convention.

### World to Screen Transformation
```javascript
screenX = worldX * camera.zoom - camera.x
screenY = worldY * camera.zoom - camera.y
screenRadius = worldRadius * camera.zoom
```

## Vision Properties

### Character.vision Object
```javascript
{
  distance: 150,    // Max vision distance (world units)
  angle: 90,        // Main cone angle (degrees)
  radius: 30        // Close-range circle radius (world units)
}
```

### Vision Zones
1. **Close-Range** (Blue Circle)
   - Always visible around character
   - Omnidirectional
   - Radius = character.vision.radius
   - Fuel cost: 0 (free)

2. **Main Cone** (Green)
   - Direction focused based on rotation
   - Angle = character.vision.angle
   - Distance = character.vision.distance
   - Visibility: 100%
   - Fuel cost: 1.0x

3. **Peripheral Cones** (Grey Flanks)
   - Left: from (facing - angle/2 - angle/4) to (facing - angle/2)
   - Right: from (facing + angle/2) to (facing + angle/2 + angle/4)
   - Visibility: 50% (greyed out)
   - Fuel cost: 1.2x

## Fog of War Integration

The new vision system **does not replace** the fog of war system:
- **FOG LAYER** (6Fog.jsx): Still uses visionDistance/visionArc to determine what areas are explored
- **VISION LAYER** (9Vision.jsx): NEW - Shows visual representation of vision zones
- **FOV CULLING** (game.jsx isVisible): Still uses old logic for determining object visibility

The systems complement each other:
- Server-side FOV filtering limits what players see (visionDistance/visionArc)
- Client-side fog of war shows explored areas (drawn as darkness)
- Client-side vision layer shows current vision zones visually (new system)

## Rendering Differences

### Old System (Removed)
- Rendered in characters layer
- Did not apply camera.zoom to radius
- Used raw rotation without -90 adjustment
- Only showed for selected characters

### New System (Active)
- Rendered in dedicated vision layer
- Applies camera.zoom for all distances
- Uses correct rotation formula (rotation - 90)
- Shows for DM (all characters faint) + selected character (opaque)
- Shows debug info for DM

## Testing Checklist

- [ ] Vision cones point in the correct direction (same as character rotation arrow)
- [ ] Vision cones scale correctly when camera zooms in/out
- [ ] Green main cone is the primary vision direction
- [ ] Grey peripheral cones appear on flanks (DM only when selected)
- [ ] Blue close-range circle appears around character
- [ ] DM sees all characters' vision zones faintly
- [ ] Selected character shows vision more prominently
- [ ] Debug info displays correctly for selected char (DM only)
- [ ] No old vision cones render in character layer
- [ ] Fog of war still works correctly
- [ ] FOV culling still hides distant objects from players

## Files Modified

| File | Changes |
|------|---------|
| `visionRenderer.js` | Complete rewrite with camera transforms |
| `9Vision.jsx` | Updated to pass camera param, added shouldRedraw |
| `3Characters.jsx` | Removed old vision cone drawing code |
| `campaign_manager.js` | Added vision property to character tokens |

## Files Already in Place

- `layerRegistry.js` - Vision layer at z-index 5.5 ✅
- `6Fog.jsx` - Fog of war using old system ✅
- `visionLayerConfig.js` - Configuration system (optional) ✅
- `visionSystem.js` (server) - FOV calculations ✅
