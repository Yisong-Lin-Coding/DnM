/**
 * Vision System Integration Examples
 * 
 * This file demonstrates how to integrate the advanced vision system
 * into your game component and rendering layers.
 */

// ============================================================================
// SETUP / IMPORTS
// ============================================================================

// Server-side
const VisionSystem = require('../worldEngine/visionSystem');
const VisionUtils = require('../worldEngine/visionSystemUtils');

// Client-side
const VisionRenderer = require('./visionRenderer');

// ============================================================================
// EXAMPLE 1: Rendering Vision Zones in Game Layer
// ============================================================================

/**
 * Add to your map rendering layer (e.g., in game.jsx or a dedicated vision layer)
 * This renders the vision zones for debugging or showing the DM
 */
function renderCharacterVision(ctx, character, camera, isDM, isSelected) {
    if (!character || !character.vision || !isDM && !isSelected) {
        return;
    }

    // Convert world to screen coordinates
    const worldToScreen = (worldX, worldY) => ({
        x: worldX * camera.zoom - camera.x,
        y: worldY * camera.zoom - camera.y,
    });

    // Render with appropriate transparency
    const alpha = isSelected ? 0.5 : 0.2;
    
    VisionRenderer.renderVisionZones(ctx, character, worldToScreen, {
        showCloseRange: true,
        showMainCone: true,
        showPeripheral: isDM, // Only show peripheral details to DM
        showFacingIndicator: true,
        alpha: alpha,
    });

    // Show vision stats for selected character
    if (isSelected) {
        VisionRenderer.renderVisionDebugInfo(ctx, character, 20, 80);
    }
}

// ============================================================================
// EXAMPLE 2: Using Vision System for FOV Culling (Server)
// ============================================================================

/**
 * Server-side: Filter game state for player based on their character vision
 */
async function filterGameStateForPlayer(gameSnapshot, campaign, playerID, environmentalConditions = {}) {
    // Get assigned characters for this player
    const characterIDs = getAssignedCharacterIDsForPlayer(campaign, playerID);
    
    // Build vision context from environmental data
    let visionContext = {};
    if (environmentalConditions) {
        visionContext = VisionSystem.createVisionModifier({
            lightLevel: environmentalConditions.ambientLight || 1.0,
            isInDarkness: environmentalConditions.isDark || false,
            hasInfravision: environmentalConditions.hasGlobalInfravision || false,
        });
    }

    // Filter snapshot using advanced FOV system
    const filteredSnapshot = filterSnapshotForFOV(gameSnapshot, {
        sourceIds: characterIDs,
        viewerTeam: 'player',
        visionContext: visionContext,
    });

    return filteredSnapshot;
}

// ============================================================================
// EXAMPLE 3: Checking Object Visibility with Full Details
// ============================================================================

/**
 * Get complete visibility information for an object
 */
function getObjectVisibilityStatus(character, mapObject, environmentalConditions = {}) {
    // Create vision context from environment
    const visionContext = VisionSystem.createVisionModifier({
        lightLevel: environmentalConditions.lightLevel || 1.0,
        isInDarkness: environmentalConditions.isDark,
        hasInfravision: character.status?.hasInfravision || false,
        isBlinded: character.status?.conditions?.includes('blinded'),
    });

    // Check visibility
    const result = VisionSystem.isObjectVisible(
        character,
        mapObject,
        visionContext
    );

    return {
        object: mapObject.id,
        isVisible: result.isVisible,
        coverage: result.coverage,
        visionType: result.visionType,
        fuelUsed: result.fuelUsed,
        description: VisionUtils.describeVisibility(result),
    };
}

// ============================================================================
// EXAMPLE 4: Testing Vision (Development/Debugging)
// ============================================================================

/**
 * Generate a debug report for a character's vision
 */
function debugCharacterVision(character) {
    console.log('\n=== VISION DEBUG REPORT ===\n');
    
    const report = VisionUtils.generateVisionReport(character);
    console.log(report.description);
    
    console.log('\nTEST RESULTS:');
    for (const [testName, testResult] of Object.entries(report.testPoints)) {
        console.log(`  ${testName}: ${testResult.description.description}`);
    }

    console.log('\nENVIRONMENTAL SCENARIOS:');
    for (const [scenario, result] of Object.entries(report.environmentalScenarios)) {
        console.log(`  ${scenario}: Fuel Cost = ${(result.fuelCost * 100).toFixed(1)}%`);
    }
    
    console.log('\n');
    return report;
}

/**
 * Visualize vision zones as ASCII art
 */
function debugVisualizeVision(character) {
    console.log('\n=== VISION VISUALIZATION ===\n');
    const visualization = VisionUtils.visualizeVisionGrid(character, 5, 200);
    console.log(visualization);
    console.log('\nLegend: ◆ = character, ● = main, ◯ = peripheral, ○ = close-range, · = hidden\n');
}

/**
 * Test visibility to many points
 */
function debugTestManyPoints(character, numTests = 100) {
    console.log(`\nTesting ${numTests} random points around character...\n`);
    
    const charX = character.position?.x || 0;
    const charY = character.position?.y || 0;
    const maxDist = character.vision?.distance || 1000;

    const results = {
        main: 0,
        peripheral: 0,
        closeRange: 0,
        blocked: 0,
        fuelUsageTotal: 0,
    };

    for (let i = 0; i < numTests; i++) {
        const angle = (Math.random() * Math.PI * 2);
        const dist = Math.random() * maxDist;
        const px = charX + Math.cos(angle) * dist;
        const py = charY + Math.sin(angle) * dist;

        const result = VisionSystem.getPointVisibility(
            px, py,
            character,
            character.vision,
            {}
        );

        results[result.visionType]++;
        results.fuelUsageTotal += result.fuelCost;
    }

    console.log('Results:');
    console.log(`  Main Cone: ${results.main} (${(results.main / numTests * 100).toFixed(1)}%)`);
    console.log(`  Peripheral: ${results.peripheral} (${(results.peripheral / numTests * 100).toFixed(1)}%)`);
    console.log(`  Close Range: ${results.closeRange} (${(results.closeRange / numTests * 100).toFixed(1)}%)`);
    console.log(`  Blocked: ${results.blocked} (${(results.blocked / numTests * 100).toFixed(1)}%)`);
    console.log(`  Average Fuel Usage: ${(results.fuelUsageTotal / numTests * 100).toFixed(1)}%\n`);
}

// ============================================================================
// EXAMPLE 5: Modifying Vision Through Effects/Modifiers
// ============================================================================

/**
 * Example effect that enhances vision
 */
function createEagleEyeEffect() {
    return {
        id: 'eagle-eye',
        name: 'Eagle Eye',
        duration: 600, // 10 minutes
        hooks: {
            'onVisionCalc': (context) => {
                // Double the vision distance
                context.base.distance *= 2;
                // Increase peripheral angle by 10 degrees
                context.base.angle += 10;
            }
        }
    };
}

/**
 * Example effect for blindness
 */
function createBlindnessEffect() {
    return {
        id: 'blindness',
        name: 'Blindness',
        duration: 300,
        hooks: {
            'onVisionCalc': (context) => {
                // Completely disable vision
                context.base.distance = 0;
                context.base.angle = 0;
                context.base.radius = 0;
            }
        }
    };
}

/**
 * Example effect for low-light adaptation
 */
function createLowLightAdaptationEffect() {
    return {
        id: 'low-light-adaptation',
        name: 'Low Light Adaptation',
        duration: 1200,
        hooks: {
            'onVisionCalc': (context) => {
                // Slightly increase distance
                context.base.distance *= 1.2;
            }
        }
    };
}

// ============================================================================
// EXAMPLE 6: Comparing Vision Between Characters
// ============================================================================

/**
 * Compare vision capabilities of multiple characters
 */
function compareCharacterVisions(characters) {
    console.log('\n=== CHARACTER VISION COMPARISON ===\n');
    
    if (characters.length < 2) {
        console.log('Need at least 2 characters to compare');
        return;
    }

    // Compare first two
    const comparison = VisionUtils.compareCharacterVision(characters[0], characters[1]);
    
    console.log(`${comparison.char1.name}:`);
    console.log(`  Distance: ${comparison.char1.distance}`);
    console.log(`  Angle: ${comparison.char1.mainAngle}°`);
    console.log(`  Close Range: ${comparison.char1.closeRangeRadius}`);

    console.log(`\n${comparison.char2.name}:`);
    console.log(`  Distance: ${comparison.char2.distance}`);
    console.log(`  Angle: ${comparison.char2.mainAngle}°`);
    console.log(`  Close Range: ${comparison.char2.closeRangeRadius}`);

    console.log('\nComparison:');
    console.log(`  Distance difference: ${comparison.comparison.distanceDifference > 0 ?
        '+' + comparison.comparison.distanceDifference :
        comparison.comparison.distanceDifference}`);
    console.log(`  Winner: ${comparison.comparison.char1_IsBetter ? comparison.char1.name :
        comparison.comparison.char2_IsBetter ? comparison.char2.name :
        'Tied'}\n`);
}

// ============================================================================
// EXAMPLE 7: Dynamic Vision Based on Conditions
// ============================================================================

/**
 * Build a dynamic vision context from scene data
 */
function buildDynamicVisionContext(scene, character) {
    // Calculate ambient light at character position
    const ambientLight = calculateAmbientLightAtPosition(scene, character.position);
    
    // Check if character is in darkness
    const isDark = ambientLight < 0.3;
    
    // Check for buffs/debuffs
    const hasInfravision = character.effects?.some(e => e.type === 'infravision');
    const isBlinded = character.statusEffects?.some(e => e.type === 'blinded');

    return VisionSystem.createVisionModifier({
        lightLevel: ambientLight,
        isInDarkness: isDark,
        hasInfravision: hasInfravision,
        isBlinded: isBlinded,
    });
}

/**
 * Stub - implement based on your lighting system
 */
function calculateAmbientLightAtPosition(scene, position) {
    // This would integrate with your lighting system
    // For now, return based on time of day
    if (scene.timeOfDay === 'day') return 1.0;
    if (scene.timeOfDay === 'dusk') return 0.5;
    if (scene.timeOfDay === 'night') return 0.2;
    return 1.0;
}

// ============================================================================
// EXAMPLE 8: Integration with Game Loop
// ============================================================================

/**
 * Called during each game update to refresh visibility
 */
function updateVisibility(gameState) {
    // Get current environmental conditions
    const environmentalConditions = {
        lightLevel: gameState.scene?.ambientLight || 1.0,
        isDark: gameState.scene?.isDark || false,
        hasGlobalInfravision: gameState.scene?.hasInfravision || false,
    };

    // For each player, filter their game state
    for (const player of gameState.players) {
        const playerSnapshot = filterGameStateForPlayer(
            gameState.snapshot,
            gameState.campaign,
            player.id,
            environmentalConditions
        );

        // Send to player via socket
        io.to(player.socketId).emit('game:update', {
            snapshot: playerSnapshot,
            timestamp: Date.now(),
        });
    }
}

// ============================================================================
// EXAMPLE 9: Integration with Selection/Inspection UI
// ============================================================================

/**
 * Get visibility details for UI display
 */
function getVisibilityDetailsForUI(viewerCharacter, targetObject) {
    if (!viewerCharacter || !targetObject) return null;

    const visibility = VisionSystem.isObjectVisible(
        viewerCharacter,
        targetObject,
        {}
    );

    return {
        objectName: targetObject.name || 'Unknown',
        isVisible: visibility.isVisible,
        details: {
            'Visibility': `${(visibility.coverage * 100).toFixed(0)}%`,
            'Vision Type': visibility.visionType.charAt(0).toUpperCase() + 
                          visibility.visionType.slice(1),
            'Fuel Cost': `${(visibility.fuelUsed * 100).toFixed(1)}%`,
        }
    };
}

// ============================================================================
// EXPORT
// ============================================================================

module.exports = {
    // Rendering
    renderCharacterVision,
    
    // Server-side FOV
    filterGameStateForPlayer,
    getObjectVisibilityStatus,
    
    // Debugging
    debugCharacterVision,
    debugVisualizeVision,
    debugTestManyPoints,
    
    // Effects
    createEagleEyeEffect,
    createBlindnessEffect,
    createLowLightAdaptationEffect,
    
    // Comparison
    compareCharacterVisions,
    
    // Dynamic
    buildDynamicVisionContext,
    
    // Game loop
    updateVisibility,
    
    // UI
    getVisibilityDetailsForUI,
};
