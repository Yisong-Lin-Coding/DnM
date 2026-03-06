/**
 * Vision System Utilities and Helpers
 * Provides testing, debugging, and convenience functions for the vision system
 */

const VisionSystem = require('./visionSystem');

/**
 * Create a mock character for testing
 */
function createTestCharacter(overrides = {}) {
    return {
        id: 'test-char-' + Math.random().toString(36).substr(2, 9),
        name: 'Test Character',
        position: { x: 0, y: 0 },
        rotation: 0,
        vision: {
            distance: 1000,
            angle: 60,
            radius: 50,
        },
        ...overrides,
    };
}

/**
 * Test all vision zones for a point
 */
function testPointVisibility(character, px, py, visionContext = {}) {
    const result = VisionSystem.getPointVisibility(px, py, character, character.vision, visionContext);
    
    return {
        point: { x: px, y: py },
        result,
        description: describeVisibility(result),
    };
}

/**
 * Human-readable description of visibility result
 */
function describeVisibility(result) {
    const { visibility, visionType, fuelCost } = result;
    
    const typeDesc = {
        main: 'Full visibility in main cone',
        peripheral: 'Reduced visibility in peripheral cone (50%)',
        closeRange: 'Close-range omnidirectional perception',
        blocked: 'Not visible',
        disabled: 'Vision disabled (blinded)',
        noVision: 'Character has no vision config',
    };

    return `${typeDesc[visionType] || 'Unknown'} (Visibility: ${Math.round(visibility * 100)}%, Fuel Cost: ${(fuelCost * 100).toFixed(1)}%)`;
}

/**
 * Test a grid of points around character
 */
function testVisibilityGrid(character, gridSize = 10, gridSpacing = 100, visionContext = {}) {
    const results = [];
    const charX = character.position?.x || 0;
    const charY = character.position?.y || 0;

    for (let i = -gridSize; i <= gridSize; i++) {
        for (let j = -gridSize; j <= gridSize; j++) {
            const px = charX + i * gridSpacing;
            const py = charY + j * gridSpacing;
            results.push(testPointVisibility(character, px, py, visionContext));
        }
    }

    return results;
}

/**
 * Visualize vision grid as ASCII
 */
function visualizeVisionGrid(character, gridSize = 10, gridSpacing = 100, visionContext = {}) {
    const results = testVisibilityGrid(character, gridSize, gridSpacing, visionContext);
    
    const charX = character.position?.x || 0;
    const charY = character.position?.y || 0;
    const lines = [];
    
    for (let j = gridSize; j >= -gridSize; j--) {
        let line = '';
        for (let i = -gridSize; i <= gridSize; i++) {
            const result = results.find(r => 
                r.point.x === charX + i * gridSpacing &&
                r.point.y === charY + j * gridSpacing
            );
            
            if (!result) {
                line += '?';
                continue;
            }

            const { visionType, visibility } = result.result;
            
            if (i === 0 && j === 0) {
                line += '◆'; // Character position
            } else if (visionType === 'main') {
                line += '●'; // Main vision
            } else if (visionType === 'peripheral') {
                line += '◯'; // Peripheral vision
            } else if (visionType === 'closeRange') {
                line += '○'; // Close range
            } else {
                line += '·'; // Not visible
            }
        }
        lines.push(line);
    }
    
    return lines.join('\n');
}

/**
 * Report vision statistics for character
 */
function reportVisionStats(character) {
    const stats = VisionSystem.getVisionStats(character);
    
    return {
        characterId: character.id,
        characterName: character.name,
        stats: {
            ...stats,
            peripheralSize: `${stats.peripheralAngle}° on each side`,
            mainConeSize: `${stats.mainAngle}° total (${stats.mainAngle / 2}° each side)`,
        },
        description: `
Character: ${character.name} (${character.id})
Position: (${character.position?.x || 0}, ${character.position?.y || 0})
Facing: ${character.rotation}°

VISION CONFIGURATION:
- Main Cone: ${stats.mainAngle}° arc with full visibility
- Peripheral: ${stats.peripheralAngle}° arc on each side with 50% visibility
- Close Range: Omnidirectional circle with ${stats.closeRangeRadius} unit radius
- Max Distance: ${stats.distance} units
- Vision Fuel Pool: ${stats.fuelPool} units
        `.trim(),
    };
}

/**
 * Compare visibility between two characters
 */
function compareCharacterVision(char1, char2) {
    const stats1 = VisionSystem.getVisionStats(char1);
    const stats2 = VisionSystem.getVisionStats(char2);
    
    return {
        char1: {
            name: char1.name,
            ...stats1,
        },
        char2: {
            name: char2.name,
            ...stats2,
        },
        comparison: {
            distanceDifference: stats2.distance - stats1.distance,
            angleDifference: stats2.mainAngle - stats1.mainAngle,
            rangeRatioDifference: stats2.closeRangeRadius - stats1.closeRangeRadius,
            char1_IsBetter: (stats1.distance > stats2.distance) && 
                           (stats1.mainAngle > stats2.mainAngle),
            char2_IsBetter: (stats2.distance > stats1.distance) && 
                           (stats2.mainAngle > stats1.mainAngle),
        },
    };
}

/**
 * Test visibility with various environmental conditions
 */
function testEnvironmentalImpact(character, targetPoint, scenarios = []) {
    if (scenarios.length === 0) {
        scenarios = [
            { name: 'Bright Light', context: { lightLevel: 1.0 } },
            { name: 'Normal', context: { lightLevel: 0.5 } },
            { name: 'Twilight', context: { lightLevel: 0.3 } },
            { name: 'Darkness', context: { lightLevel: 0, isInDarkness: true } },
            { name: 'Darkness + Infravision', context: { lightLevel: 0, isInDarkness: true, hasInfravision: true } },
            { name: 'Blinded', context: { isBlinded: true } },
        ];
    }

    const results = {};
    
    for (const scenario of scenarios) {
        const visionContext = VisionSystem.createVisionModifier(scenario.context);
        const result = VisionSystem.getPointVisibility(
            targetPoint.x,
            targetPoint.y,
            character,
            character.vision,
            visionContext
        );
        
        results[scenario.name] = {
            context: scenario.context,
            ...result,
            description: describeVisibility(result),
        };
    }
    
    return results;
}

/**
 * Generate a detailed vision report
 */
function generateVisionReport(character, testPoints = []) {
    const stats = reportVisionStats(character);
    
    // Set default test points if none provided
    if (testPoints.length === 0) {
        const charX = character.position?.x || 0;
        const charY = character.position?.y || 0;
        const dist = character.vision?.distance || 1000;
        
        testPoints = [
            { name: 'Close (ahead)', point: { x: charX + 50, y: charY } },
            { name: 'Main cone (far)', point: { x: charX + dist * 0.8, y: charY } },
            { name: 'Peripheral (45°)', point: { x: charX + dist * 0.7, y: charY + dist * 0.7 } },
            { name: 'Behind', point: { x: charX - dist * 0.5, y: charY } },
            { name: 'At maximum distance', point: { x: charX + dist, y: charY } },
        ];
    }

    const pointResults = {};
    for (const { name, point } of testPoints) {
        pointResults[name] = testPointVisibility(character, point.x, point.y);
    }

    return {
        ...stats,
        testPoints: pointResults,
        environmentalScenarios: testEnvironmentalImpact(character, testPoints[0].point),
    };
}

/**
 * Export vision data as JSON for debugging
 */
function visionToJSON(character) {
    return {
        id: character.id,
        name: character.name,
        position: character.position,
        rotation: character.rotation,
        vision: character.vision,
        stats: VisionSystem.getVisionStats(character),
    };
}

/**
 * Validate vision configuration
 */
function validateVisionConfig(visionConfig) {
    const errors = [];
    const warnings = [];

    if (!visionConfig) {
        errors.push('Vision config is missing');
        return { valid: false, errors, warnings };
    }

    if (visionConfig.distance <= 0) {
        errors.push('Vision distance must be positive');
    } else if (visionConfig.distance < 100) {
        warnings.push('Very short vision distance (< 100 units)');
    } else if (visionConfig.distance > 10000) {
        warnings.push('Very long vision distance (> 10000 units)');
    }

    if (visionConfig.angle <= 0) {
        errors.push('Vision angle must be positive');
    } else if (visionConfig.angle > 360) {
        warnings.push('Vision angle > 360° (exceeds full rotation)');
    }

    if (visionConfig.radius < 0) {
        errors.push('Close-range radius cannot be negative');
    } else if (visionConfig.radius === 0) {
        warnings.push('Zero close-range radius (no omnidirectional vision)');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

module.exports = {
    createTestCharacter,
    testPointVisibility,
    testVisibilityGrid,
    visualizeVisionGrid,
    reportVisionStats,
    compareCharacterVision,
    testEnvironmentalImpact,
    generateVisionReport,
    visionToJSON,
    validateVisionConfig,
    describeVisibility,
};
