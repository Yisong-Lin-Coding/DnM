#!/usr/bin/env node
/**
 * Vision System Quick Start Guide
 * 
 * Follow these steps to get the vision system up and running!
 */

const fs = require('fs');
const path = require('path');

console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║          VISION SYSTEM - QUICK START GUIDE                        ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
`);

// Step 1: Verify files exist
console.log('STEP 1: Verifying Installation');
console.log('─'.repeat(67));

const requiredFiles = [
    'PROJECTS/server/worldEngine/visionSystem.js',
    'PROJECTS/server/worldEngine/visionSystemUtils.js',
    'PROJECTS/server/worldEngine/visionSystem.test.js',
    'PROJECTS/client/src/pages/game/visionRenderer.js',
    'PROJECTS/client/src/pages/game/Map Layers/9Vision.jsx',
    'PROJECTS/client/src/pages/game/visionLayerConfig.js',
];

let allPresent = true;
for (const file of requiredFiles) {
    const fullPath = path.join(__dirname, '..', file);
    const exists = fs.existsSync(fullPath);
    const status = exists ? '✓' : '✗';
    console.log(`${status} ${file}`);
    if (!exists) allPresent = false;
}

if (!allPresent) {
    console.log('\n⚠️  Some files are missing! Please re-run the installation.\n');
    process.exit(1);
}

console.log('\n✓ All files installed successfully!\n');

// Step 2: Show what the system provides
console.log('STEP 2: What You Get');
console.log('─'.repeat(67));

const features = [
    '✓ Main vision cone (full visibility at character facing)',
    '✓ Peripheral vision zones (50% visibility on flanks)',
    '✓ Close-range omnidirectional awareness circle',
    '✓ Fuel-based distance system (light affects consumption)',
    '✓ Server-side FOV filtering (automatic)',
    '✓ Client-side visualization (DM sees all, players see selected)',
    '✓ Environmental modifiers (light, darkness, infravision)',
    '✓ Complete testing suite',
    '✓ Comprehensive documentation',
];

features.forEach(f => console.log(f));

console.log();

// Step 3: How to test
console.log('STEP 3: Run Tests');
console.log('─'.repeat(67));

console.log(`
To verify the vision system is working:

  node server/worldEngine/visionSystem.test.js

Expected output:
  - 10 comprehensive tests
  - All tests should PASS ✓
  - Vision grid visualization
  - Fuel cost calculations

Run this command now to verify installation!
`);

// Step 4: How to enable it
console.log('STEP 4: It\'s Already Enabled!');
console.log('─'.repeat(67));

console.log(`
Vision is AUTOMATICALLY ACTIVE in your game:

  👁️  SERVER-SIDE:
     • Character vision calculated from character.vision()
     • Game state filtered based on FOV
     • Visibility metadata on each object

  👁️  CLIENT-SIDE:
     • Vision layer renders between lighting and characters
     • DM sees all character vision zones (faint)
     • Selected character shows brightly
     • Colors: 🔵 blue (close), 🟢 green (main), ⚫ grey (peripheral)

  👁️  ZERO CONFIGURATION NEEDED - It just works!
`);

// Step 5: Customization
console.log('STEP 5: Customize Vision');
console.log('─'.repeat(67));

console.log(`
To adjust how vision works:

  1. MODIFY CHARACTER VISION:
     Edit: server/worldEngine/Character/character.js
     Change the INT multipliers in the vision() getter
     
     Current: distance = INT × 100, angle = INT × 5, radius = INT × 5
     
     Examples:
     • More vision: distance = INT × 150, angle = INT × 10
     • Less vision: distance = INT × 50, angle = INT × 2

  2. ADD VISION EFFECTS:
     • Create effects that modify character.vision properties
     • Effects apply via the modifier pipeline
     • Examples: Eagle Eye, Infravision, Blindness

  3. CONTROL RENDERING:
     Use client/src/pages/game/visionLayerConfig.js
     
     import VisionConfig from './visionLayerConfig.js';
     
     // Load/save preferences
     const prefs = VisionConfig.loadVisionPreferences();
     
     // Update rendering
     VisionConfig.updateVisionPreference('showPeripheral', false);
`);

// Step 6: Documentation
console.log('STEP 6: Learn More');
console.log('─'.repeat(67));

const docs = [
    'VISION_SYSTEM_QUICK_REFERENCE.md - Visual quick reference',
    'VISION_SYSTEM_SETUP.md - Complete setup guide',
    'IMPLEMENTATION_COMPLETE.md - Full implementation details',
    'VISION_IMPLEMENTATION_CHECKLIST.md - What was implemented',
    'server/worldEngine/VISION_SYSTEM.md - Detailed technical docs',
    'server/worldEngine/VISION_SYSTEM_EXAMPLES.js - Code examples',
];

console.log('\nDocumentation files:');
docs.forEach(doc => console.log(`  📖 ${doc}`));

console.log();

// Step 7: Architecture
console.log('STEP 7: How It Works');
console.log('─'.repeat(67));

console.log(`
VISION ZONES:

  Main Cone (100%)           Peripheral (50%)        Close-Range (FREE)
  ┌─────────────────┐        ┌─────────────────┐     ┌─────────────┐
  │      ╱╲         │        │ ⚫ ╱╲ ⚫  ╱╲ ⚫    │     │     ○       │
  │     ╱●●╲        │        │  MAIN  PERI     │     │   ╱   ╲     │
  │    ╱●◆●●╲       │        └─────────────────┘     │  │ ◆ ○ │    │
  │   ╱────────╲    │                                 │   ╲   ╱     │
  └────────────────┘                                  │     ○       │
                                                      └─────────────┘
  
  Distance: max    Color: 🟢 Green  ││  Angles: angle/4 each  Color: ⚫ Grey  ││  Radius: varies  Color: 🔵 Blue
  Visible:  100%   Cost: 1.0x fuel ││  Distance: max         Visible: 50%    Cost: 1.2x fuel  ││  Visible: 100%   Cost: 0 fuel

FUEL SYSTEM:

  Fuel = character.vision.distance (units available)
  
  Consumption = (distance_to_target × lightModifier × fuelMultiplier) / maxDistance
  
  Light Effects:
    Bright:  0.3x (efficient)
    Normal:  0.65x
    Dark:    1.0x (full cost)
    Infrav:  0.7x (boost in darkness)

FOV FILTERING:

  1. Server calculates character.vision() based on INT
  2. For each game state update:
     - Filter objects based on FOV
     - Attach visibility metadata
     - Send filtered snapshot to player
  3. Client renders vision zones
     - DM sees all (20% opacity)
     - Selected character (40% opacity)
     - Facing direction indicator

RENDERING PIPELINE:

  Game Loop
    ↓
  Character Animation
    ↓
  FOV Filtering
    ↓
  Render State Build
    ↓
  Layer Rendering:
    [0] Lighting
    [5.5] ← VISION LAYER ← You are here
    [6] Fog
    [7] Characters
    [8] Effects
`);

// Step 8: Testing checklist
console.log('STEP 8: Verification Checklist');
console.log('─'.repeat(67));

const checks = [
    '[ ] Server: npm install (dependencies)',
    '[ ] Client: npm install (dependencies)',
    '[ ] Run: node server/worldEngine/visionSystem.test.js',
    '[ ] All tests pass ✓',
    '[ ] Start game server',
    '[ ] Start game client',
    '[ ] Join as DM',
    '[ ] See faint vision zones for all characters',
    '[ ] Select a character',
    '[ ] See selected character vision zone clearly',
    '[ ] Blue circle = close-range',
    '[ ] Green cone = main vision',
    '[ ] Grey areas = peripheral',
    '[ ] Arrow = facing direction',
];

checks.forEach(check => console.log(check));

console.log();

// Step 9: Next steps
console.log('STEP 9: Next Steps');
console.log('─'.repeat(67));

console.log(`
1. TEST EVERYTHING:
   node server/worldEngine/visionSystem.test.js

2. PLAY THE GAME:
   Start server and client, join and see vision zones render

3. CUSTOMIZE:
   Adjust vision formula in character.js if needed

4. ADD FEATURES:
   • Environmental lighting integration
   • Vision-based difficulty modifiers
   • Stealth system integration
   • Line-of-sight blocking
   • FOW (Fog of War) persistence

5. EXTEND:
   • Use visionLayerConfig.js for UI controls
   • Add vision-based status effects
   • Create specialized race/class vision bonuses
   • Implement darkness/bright light mechanics

6. READ DOCS:
   See all .md files in project root for details
`);

// Final message
console.log('═'.repeat(67));
console.log();
console.log('✅ VISION SYSTEM INSTALLATION COMPLETE!');
console.log();
console.log('   Your game now has an advanced vision system with:');
console.log('   • Three vision zones (main, peripheral, close-range)');
console.log('   • Fuel-based distance mechanic');
console.log('   • Light-aware perception');
console.log('   • Full server/client integration');
console.log('   • DM debug visualization');
console.log('   • Complete documentation');
console.log();
console.log('   Run: node server/worldEngine/visionSystem.test.js');
console.log();
console.log('═'.repeat(67));
console.log();
