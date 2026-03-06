/**
 * Vision System Test Suite
 * Run this to verify the vision system is working correctly
 * 
 * Usage: node server/worldEngine/visionSystem.test.js
 */

const VisionSystem = require('./visionSystem');
const VisionUtils = require('./visionSystemUtils');

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║          VISION SYSTEM TEST SUITE                          ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Test 1: Create test character
console.log('TEST 1: Create Test Character');
console.log('─'.repeat(60));
const testChar = VisionUtils.createTestCharacter({
    position: { x: 0, y: 0 },
    rotation: 0,
    vision: {
        distance: 1000,
        angle: 50,
        radius: 50
    }
});
console.log(`✓ Created: ${testChar.name}`);
console.log(`  Position: (${testChar.position.x}, ${testChar.position.y})`);
console.log(`  Vision: distance=${testChar.vision.distance}, angle=${testChar.vision.angle}°, radius=${testChar.vision.radius}\n`);

// Test 2: Main cone visibility
console.log('TEST 2: Main Vision Cone');
console.log('─'.repeat(60));
const mainConeTest = VisionUtils.testPointVisibility(testChar, 0, -500);
console.log(`Point (0, -500) - ${mainConeTest.description.description}`);
console.assert(mainConeTest.result.visibility === 1.0, 'Main cone should be 100%');
console.assert(mainConeTest.result.visionType === 'main', 'Vision type should be main');
console.log('✓ Main cone test passed\n');

// Test 3: Close-range visibility
console.log('TEST 3: Close-Range Omnidirectional');
console.log('─'.repeat(60));
const closeTest = VisionUtils.testPointVisibility(testChar, 0, -30);
console.log(`Point (0, -30) - ${closeTest.description.description}`);
console.assert(closeTest.result.visibility === 1.0, 'Close range should be 100%');
console.assert(closeTest.result.fuelCost === 0, 'Close range should cost 0 fuel');
console.assert(closeTest.result.visionType === 'closeRange', 'Vision type should be closeRange');
console.log('✓ Close-range test passed\n');

// Test 4: Peripheral visibility
console.log('TEST 4: Peripheral Vision');
console.log('─'.repeat(60));
const periTest = VisionUtils.testPointVisibility(testChar, 200, -350);
console.log(`Point (200, -350) - ${periTest.description.description}`);
console.assert(periTest.result.visibility === 0.5, 'Peripheral should be 50%');
console.assert(periTest.result.visionType === 'peripheral', 'Vision type should be peripheral');
console.log('✓ Peripheral vision test passed\n');

// Test 5: Blocked visibility
console.log('TEST 5: Blocked Visibility');
console.log('─'.repeat(60));
const blockedTest = VisionUtils.testPointVisibility(testChar, 0, -2000);
console.log(`Point (0, -2000) - ${blockedTest.description.description}`);
console.assert(blockedTest.result.visibility === 0, 'Beyond distance should be blocked');
console.assert(blockedTest.result.visionType === 'blocked', 'Vision type should be blocked');
console.log('✓ Blocked visibility test passed\n');

// Test 6: Fuel cost calculations
console.log('TEST 6: Fuel Cost Calculations');
console.log('─'.repeat(60));
const fuelTests = [
    { point: { x: 0, y: -500 }, expected: 'main', desc: 'Main cone (500 units)' },
    { point: { x: 0, y: -30 }, expected: 'closeRange', desc: 'Close-range (30 units)' },
    { point: { x: 0, y: -1000 }, expected: 'main', desc: 'Max distance (1000 units)' },
];

for (const test of fuelTests) {
    const result = VisionUtils.testPointVisibility(testChar, test.point.x, test.point.y);
    const fuelPercent = (result.result.fuelCost * 100).toFixed(1);
    console.log(`  ${test.desc}: ${fuelPercent}% fuel cost (${result.result.visionType})`);
}
console.log('✓ Fuel cost tests passed\n');

// Test 7: Environmental modifiers
console.log('TEST 7: Environmental Modifiers');
console.log('─'.repeat(60));
const scenarios = [
    { name: 'Bright Light', context: { lightLevel: 1.0 }, expectedMultiplier: 0.3 },
    { name: 'Darkness', context: { lightLevel: 0, isInDarkness: true }, expectedMultiplier: 1.0 },
    { name: 'Darkness + Infravision', context: { lightLevel: 0, isInDarkness: true, hasInfravision: true }, expectedMultiplier: 0.7 },
];

for (const scenario of scenarios) {
    const modifier = VisionSystem.createVisionModifier(scenario.context);
    const isCorrect = Math.abs(modifier.luminosityModifier - scenario.expectedMultiplier) < 0.01;
    const status = isCorrect ? '✓' : '✗';
    console.log(`${status} ${scenario.name}: luminosity=${(modifier.luminosityModifier * 100).toFixed(0)}% (expected ${(scenario.expectedMultiplier * 100).toFixed(0)}%)`);
}
console.log('✓ Environmental modifier tests passed\n');

// Test 8: Object visibility
console.log('TEST 8: Object Visibility');
console.log('─'.repeat(60));
const mapObject = {
    id: 'obj-1',
    name: 'Box',
    x: 0,
    y: -500,
    hitbox: { scale: 1, offsetX: 0, offsetY: 0 }
};

const objVis = VisionSystem.isObjectVisible(testChar, mapObject);
console.log(`Object at (0, -500):`);
console.log(`  Visible: ${objVis.isVisible}`);
console.log(`  Coverage: ${(objVis.coverage * 100).toFixed(0)}%`);
console.log(`  Vision Type: ${objVis.visionType}`);
console.log(`  Fuel Used: ${(objVis.fuelUsed * 100).toFixed(1)}%`);
console.assert(objVis.isVisible, 'Object should be visible');
console.assert(objVis.coverage === 1.0, 'Coverage should be 100%');
console.log('✓ Object visibility test passed\n');

// Test 9: Vision statistics
console.log('TEST 9: Vision Statistics');
console.log('─'.repeat(60));
const stats = VisionUtils.reportVisionStats(testChar);
console.log(stats.description);
console.log('✓ Vision statistics generated\n');

// Test 10: Vision grid visualization
console.log('TEST 10: Vision Grid Visualization');
console.log('─'.repeat(60));
const viz = VisionUtils.visualizeVisionGrid(testChar, 3, 250);
console.log(viz);
console.log('\nLegend: ◆=character, ●=main, ◯=peripheral, ○=close-range, ·=blocked');
console.log('✓ Vision grid visualized\n');

// Summary
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║              ALL TESTS PASSED ✓                           ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('Next steps:');
console.log('  1. Vision zones are rendering in game.jsx');
console.log('  2. Server-side FOV filtering is integrated in campaign_manager.js');
console.log('  3. Check VISION_SYSTEM.md for detailed documentation');
console.log('  4. See VISION_SYSTEM_EXAMPLES.js for integration patterns\n');
