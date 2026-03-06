# Vision System Quick Reference Card

## Vision Zones at a Glance

### 1. Main Vision Cone ✓ (Full Visibility)

```
Characteristics:
├─ Angle: character.vision.angle degrees
├─ Distance: character.vision.distance units
├─ Visibility: 100% (full)
├─ Fuel Cost: 1.0x (normal)
└─ Priority: High (checked first after close-range)

Visual Representation (angle = 50°, distance = 1000):
          
           Forward (0°)
              ╱╲←── 25° each side
             ╱  ╲
            ╱    ╲  ───→ 1000 units max
           ╱ 100% ╲
          ╱________╲
```

**When does it apply?**
- Point is within the cone's angular range (±angle/2 from rotation)
- AND point is within distance range
- Examples: 
  - Looking straight ahead: ✓ Full vision
  - 20 degrees to the side: ✓ Full vision
  - 35 degrees to the side: ✗ Not in main cone

---

### 2. Peripheral Vision Zones ✓ (Reduced Visibility, 50%)

```
Characteristics:
├─ Angle: (character.vision.angle / 4) degrees per side
├─ Distance: character.vision.distance units
├─ Visibility: 50% (greyed out)
├─ Fuel Cost: 1.2x (20% more expensive)
├─ Position: Left and right flanks of main cone
└─ Priority: Medium (checked after main cone)

Visual Representation:
      Peripheral  Main  Peripheral
         ╱╲       ╱╲       ╱╲
        ╱  ╲     ╱  ╲     ╱  ╲
       ╱ 50%╲   ╱ 100%╲  ╱ 50%╲
      12.5°      25°     25°    12.5°
      ────────────────────────────────
              Facing
```

**When does it apply?**
- Point is beyond the main cone's angular range
- BUT within main_angle/2 + (main_angle/4) degrees
- AND point is within distance range
- Examples:
  - 45 degrees to the side: ✓ Peripheral vision
  - 60 degrees to the side: ✗ Too far
  - At max distance, 40 degrees: ✓ Peripheral

---

### 3. Close-Range Circle (Omnidirectional) ✓ (Full Visibility)

```
Characteristics:
├─ Radius: character.vision.radius units
├─ Visibility: 100% (full)
├─ Direction: ALL directions (omnidirectional)
├─ Fuel Cost: 0 (FREE - no fuel consumed)
├─ Priority: Highest (checked first)
└─ Use: Prevent tunnel vision, guarantee minimum awareness

Visual Representation:
          
           ○ ← radius = 50 units
          ╱ ╲
         │   │  Everything inside the circle
         │ ◆ │  is fully visible regardless
         │   │  of which way character faces
          ╲ ╱
           ○
```

**When does it apply?**
- Distance from character to point ≤ radius
- Examples:
  - Point 20 units away: ✓ Visible (close-range)
  - Point 50 units away: ✓ Visible (close-range)
  - Point 51 units away: ✗ Outside close-range, check main/peripheral

---

## Fuel Consumption Chart

```
FUEL COST CALCULATION
═════════════════════════════════════════════════════════════

Base Formula:
    Fuel Cost = (distance × multiplier × luminosity) / max_distance

Range: 0 to 1.0
    0   = FREE (close-range or very close)
    0.5 = MODERATE (half fuel pool)
    1.0 = EXHAUSTED (completely blocked, at/beyond max distance)

LIGHT LEVEL EFFECTS:
                     Luminosity    Fuel Cost Multiplier
Bright Light         1.0      →    0.3x (efficient)
Normal               0.5      →    0.65x
Twilight             0.3      →    0.8x
Darkness             0.0      →    1.0x (full cost)
Darkness+Infravision 0.0      →    0.7x (infravision helps)

EXAMPLE: Character with distance=1000
─────────────────────────────────────────────

Target at 500 units in bright light:
    (500 × 1.0 × 0.3) / 1000 = 0.15 (15% fuel)

Same target in darkness:
    (500 × 1.0 × 1.0) / 1000 = 0.5 (50% fuel)

Target at 1000 units (max) in darkness:
    (1000 × 1.0 × 1.0) / 1000 = 1.0 (FULLY BLOCKED)

Peripheral at 700 units (×1.2 multiplier) in normal:
    (700 × 1.2 × 0.65) / 1000 = 0.546 (54.6% fuel)
```

---

## Decision Tree: Is Point Visible?

```
                        START
                         │
                         ▼
            ┌─── Is point within radius? ───┐
            │                                │
        YES │                            NO │
            ▼                                ▼
        ┌─────────────┐          Is distance > max_distance?
        │ VISIBLE 100%│              │           │
        │ CLOSE-RANGE │          NO  │       YES │
        │ FUEL COST=0 │              ▼           │
        └─────────────┘     Is angle within main cone?
                                 │           │
                             YES │       NO │
                                 ▼         │
                            ┌─────────────┐│
                            │ VISIBLE 100%││
                            │ MAIN CONE   ││
                            │ FUEL COST=  ││
                            │ (distance   ││
                            │ / max) ×LUM ││
                            └─────────────┘│
                                           ▼
                            Is angle within peripheral?
                                │           │
                            YES │       NO │
                                ▼          ▼
                            ┌────────┐  ┌────────────┐
                            │VISIBLE │  │NOT VISIBLE │
                            │  50%   │  │ BLOCKED    │
                            │PERIPH. │  │FUEL COST=1 │
                            │FUEL1.2x│  └────────────┘
                            └────────┘
```

---

## Character Stats to Vision Parameters

```
Relationship: Vision comes from character.vision getter

Most Common Formula (based on INT score):
    distance = INT × 100
    angle    = INT × 5
    radius   = INT × 5

Examples:
    INT=5:  distance=500,   angle=25°,  radius=25
    INT=10: distance=1000,  angle=50°,  radius=50
    INT=20: distance=2000,  angle=100°, radius=100

Can be customized:
    - Through character modifiers
    - Via class/race features
    - Through magical effects
    - Via the modifier pipeline
```

---

## Visibility Type Summary

```
┌──────────────┬──────────┬──────────────┬──────────────┐
│ Vision Type  │ Coverage │ Description  │ How to Render│
├──────────────┼──────────┼──────────────┼──────────────┤
│ closeRange   │ 100%     │ Omnidirectional circle    │ Blue circle
│              │          │ No fuel cost             │ (fully opaque)
├──────────────┼──────────┼──────────────┼──────────────┤
│ main         │ 100%     │ Main cone with full      │ Green areas
│              │          │ visibility, normal cost  │ (fully opaque)
├──────────────┼──────────┼──────────────┼──────────────┤
│ peripheral   │ 50%      │ Flanks w/ reduced        │ Grey areas
│              │          │ visibility, 1.2x cost    │ (translucent)
├──────────────┼──────────┼──────────────┼──────────────┤
│ blocked      │ 0%       │ Not visible, beyond      │ Not rendered
│              │          │ all vision limits        │               
└──────────────┴──────────┴──────────────┴──────────────┘
```

---

## Rendering Color Guide

```
Client-side rendering uses these colors:

├─ Close-Range Omnidirectional:
│  └─ rgba(100, 200, 255, 0.1)  ← Blue tint
│
├─ Main Vision Cone:
│  └─ rgba(100, 255, 100, 0.15) ← Green tint
│
├─ Peripheral Vision:
│  └─ rgba(200, 200, 200, 0.08) ← Grey tint
│
└─ Facing Direction Indicator:
   └─ Line from character to center
      rgba(100, 255, 100, 0.6)  ← Bright green
```

---

## Testing Template

```javascript
// Test a character's vision

const testChar = {
    position: { x: 0, y: 0 },
    rotation: 0,                    // Facing right (0°)
    vision: {
        distance: 1000,             // Max 1000 units
        angle: 50,                  // 50° total cone
        radius: 50                  // 50 unit close-range
    }
};

// Main Cone Test (should be VISIBLE 100%)
const mainTest = VisionSystem.getPointVisibility(500, 0, testChar, testChar.vision);
console.assert(mainTest.visibility === 1.0, 'Main cone should be 100%');

// Close-Range Test (should be VISIBLE 100%, FUEL COST 0)
const closeTest = VisionSystem.getPointVisibility(30, 0, testChar, testChar.vision);
console.assert(closeTest.visibility === 1.0, 'Close range should be 100%');
console.assert(closeTest.fuelCost === 0, 'Close range should cost 0 fuel');

// Peripheral Test (should be VISIBLE 50%)
const periTest = VisionSystem.getPointVisibility(400, 400, testChar, testChar.vision);
console.assert(periTest.visibility === 0.5, 'Peripheral should be 50%');
console.assert(periTest.fuelCost > 0.3, 'Peripheral should cost fuel');

// Blocked Test (should be NOT VISIBLE)
const blockedTest = VisionSystem.getPointVisibility(2000, 0, testChar, testChar.vision);
console.assert(blockedTest.visibility === 0, 'Beyond distance should be blocked');

console.log('All vision tests passed! ✓');
```

---

## Integration Checklist

- [ ] Vision system module installed (`visionSystem.js`)
- [ ] Character.js has vision() getter (already implemented)
- [ ] Campaign_manager.js uses new FOV system (already integrated)
- [ ] Visibility metadata attached to snapshot objects
- [ ] (Optional) Vision renderer added to game layer
- [ ] (Optional) Debug rendering enabled for testing
- [ ] Character effects can modify vision (via modifier pipeline)
- [ ] Environmental conditions accounted for

---

## Performance Profile

```
Operation          Complexity  Time (typical)
─────────────────────────────────────────────
getPointVisibility    O(1)      < 0.1ms
isObjectVisible       O(n)      1-5ms (n=4-5 samples)
filterSnapshotForFOV  O(n×m)    10-50ms (n=objects, m=sources)
renderVisionZones     N/A       2-5ms (canvas ops)
```

---

## Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| Characters see too much | Distance/angle too high | Lower INT multipliers in vision() |
| Characters see too little | Distance/angle too low | Increase INT multipliers |
| Vision not updating | Cache not invalidated | Call `character.invalidateCache()` |
| Fuel cost doesn't matter | Context not passed | Pass `visionContext` to filterSnapshotForFOV |
| Peripheral not rendering | showPeripheral = false | Set `showPeripheral: true` in options |
| Vision zones offset | Camera wrong | Verify `worldToScreen` function |

---

## Key Numbers to Remember

- **Cone Sides**: angle / 2 (e.g., 50° angle = 25° each side of center)
- **Peripheral Width**: (angle / 2) / 2 = angle / 4 per side
- **Peripheral Cost**: 1.2x multiplier (20% more expensive)
- **Close-Range Cost**: 0 (always free)
- **Darkness Modifier**: 1.0 (full fuel cost)
- **Bright Modifier**: 0.3 (30% fuel cost)
- **Infravision**: ×0.7 (30% fuel reduction)
- **Max Fuel Cost**: 1.0 (complete exhaustion, not visible)

---

## Examples by Use Case

### DM Debugging
```javascript
// Show all vision zones for DM
VisionRenderer.renderVisionZones(ctx, character, w2s, {
    showCloseRange: true,
    showMainCone: true,
    showPeripheral: true,
    alpha: 0.5
});
```

### Player-Only Vision (No Peripheral)
```javascript
// Render less information to players
VisionRenderer.renderVisionZones(ctx, character, w2s, {
    showCloseRange: true,
    showMainCone: true,
    showPeripheral: false  // ← Hide peripheral details
});
```

### Darkness Penalty
```javascript
const context = VisionSystem.createVisionModifier({
    lightLevel: 0,
    isInDarkness: true
});
// Result: Double fuel consumption for same distance
```

### Infravision Boost
```javascript
const context = VisionSystem.createVisionModifier({
    lightLevel: 0,
    isInDarkness: true,
    hasInfravision: true  // ← 30% fuel reduction
});
// Result: 0.7x fuel cost despite darkness
```
