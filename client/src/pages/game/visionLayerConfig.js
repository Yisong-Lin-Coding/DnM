/**
 * Vision Layer Configuration & Controls
 * 
 * This file provides utilities for controlling vision layer visibility
 * and toggling vision debugging features in the game UI
 */

/**
 * Vision layer visibility modes
 */
export const VISION_VISIBILITY_MODES = {
    OFF: 'off',                      // Don't show any vision zones
    DM_ONLY: 'dm_only',              // Show only when DM is viewing
    SELECTED_ONLY: 'selected_only',  // Show only selected character vision
    ALWAYS: 'always',                // Always show for all characters (DM)
};

/**
 * Vision layer rendering options
 */
export const VISION_RENDER_OPTIONS = {
    showCloseRange: {
        label: 'Close-Range Zone',
        default: true,
        description: 'Omnidirectional circle around character'
    },
    showMainCone: {
        label: 'Main Vision Cone',
        default: true,
        description: 'Primary forward-facing cone with full visibility'
    },
    showPeripheral: {
        label: 'Peripheral Vision',
        default: false,
        description: 'Reduced visibility on left and right (DM only)'
    },
    showFacingIndicator: {
        label: 'Facing Direction',
        default: true,
        description: 'Line and dot showing character facing direction'
    },
    showDebugStats: {
        label: 'Debug Statistics',
        default: false,
        description: 'Display vision stats overlay (DM only)'
    },
};

/**
 * Storage key for vision preferences
 */
const VISION_PREFS_STORAGE_KEY = 'game_vision_preferences';

/**
 * Load vision preferences from localStorage
 */
export function loadVisionPreferences() {
    try {
        const stored = localStorage.getItem(VISION_PREFS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : getDefaultVisionPreferences();
    } catch (e) {
        console.warn('Failed to load vision preferences:', e);
        return getDefaultVisionPreferences();
    }
}

/**
 * Get default vision preferences
 */
export function getDefaultVisionPreferences() {
    const defaults = {};
    for (const [key, option] of Object.entries(VISION_RENDER_OPTIONS)) {
        defaults[key] = option.default;
    }
    return {
        visibilityMode: VISION_VISIBILITY_MODES.SELECTED_ONLY,
        alpha: 0.4,
        ...defaults,
    };
}

/**
 * Save vision preferences to localStorage
 */
export function saveVisionPreferences(prefs) {
    try {
        localStorage.setItem(VISION_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
        console.warn('Failed to save vision preferences:', e);
    }
}

/**
 * Update a single vision preference
 */
export function updateVisionPreference(key, value) {
    const prefs = loadVisionPreferences();
    prefs[key] = value;
    saveVisionPreferences(prefs);
    return prefs;
}

/**
 * Reset vision preferences to defaults
 */
export function resetVisionPreferences() {
    const defaults = getDefaultVisionPreferences();
    saveVisionPreferences(defaults);
    return defaults;
}

/**
 * Determine if vision layer should render based on mode and context
 */
export function shouldRenderVision(isDM, hasSelectedChar, mode) {
    switch (mode) {
        case VISION_VISIBILITY_MODES.OFF:
            return false;
        case VISION_VISIBILITY_MODES.DM_ONLY:
            return isDM;
        case VISION_VISIBILITY_MODES.SELECTED_ONLY:
            return hasSelectedChar;
        case VISION_VISIBILITY_MODES.ALWAYS:
            return isDM; // Only DM can see all vision zones
        default:
            return hasSelectedChar;
    }
}

/**
 * Generate UI options for vision layer control
 * Returns an array of {label, value, description} for use in dropdowns/checkboxes
 */
export function getVisionUIOptions() {
    const options = [];
    
    // Visibility mode options
    options.push({
        category: 'Visibility Mode',
        items: [
            {
                label: 'Off',
                value: VISION_VISIBILITY_MODES.OFF,
                description: 'No vision zones displayed'
            },
            {
                label: 'Selected Character Only',
                value: VISION_VISIBILITY_MODES.SELECTED_ONLY,
                description: 'Show selected character vision only'
            },
            {
                label: 'DM View',
                value: VISION_VISIBILITY_MODES.DM_ONLY,
                description: 'Show vision for all characters (DM)'
            },
            {
                label: 'Always On',
                value: VISION_VISIBILITY_MODES.ALWAYS,
                description: 'All characters visible (DM)'
            },
        ]
    });

    // Rendering options
    options.push({
        category: 'Vision Elements',
        items: Object.entries(VISION_RENDER_OPTIONS).map(([key, option]) => ({
            label: option.label,
            value: key,
            description: option.description,
            default: option.default,
        }))
    });

    return options;
}

/**
 * Create an updated vision layer state based on preferences
 * This would be used to update the vision layer rendering based on UI controls
 */
export function buildVisionLayerState(prefs, isDM, selectedChar, characters, camera) {
    const mode = prefs.visibilityMode || VISION_VISIBILITY_MODES.SELECTED_ONLY;
    const shouldRender = shouldRenderVision(isDM, !!selectedChar, mode);

    if (!shouldRender) {
        return null; // Don't render anything
    }

    // Return the state needed by the vision layer
    return {
        isDM,
        selectedChar,
        characters,
        camera,
        renderOptions: {
            showCloseRange: prefs.showCloseRange ?? true,
            showMainCone: prefs.showMainCone ?? true,
            showPeripheral: prefs.showPeripheral ?? false,
            showFacingIndicator: prefs.showFacingIndicator ?? true,
            showDebugStats: isDM && (prefs.showDebugStats ?? false),
            alpha: prefs.alpha ?? 0.4,
        },
        mode,
    };
}

/**
 * Format vision layer state as display string
 */
export function formatVisionLayerState(state) {
    if (!state) return 'Vision Layer: OFF';
    
    const parts = [];
    if (state.renderOptions.showCloseRange) parts.push('Close-Range');
    if (state.renderOptions.showMainCone) parts.push('Main Cone');
    if (state.renderOptions.showPeripheral) parts.push('Peripheral');
    if (state.renderOptions.showFacingIndicator) parts.push('Facing');
    
    return `Vision Layer: ${parts.join(', ')} (${state.mode})`;
}

/**
 * Get keyboard shortcut for toggling vision
 */
export function getVisionToggleShortcut() {
    return {
        key: 'V',
        ctrl: false,
        shift: true,
        description: 'Shift+V: Toggle vision layer'
    };
}

export default {
    VISION_VISIBILITY_MODES,
    VISION_RENDER_OPTIONS,
    loadVisionPreferences,
    getDefaultVisionPreferences,
    saveVisionPreferences,
    updateVisionPreference,
    resetVisionPreferences,
    shouldRenderVision,
    getVisionUIOptions,
    buildVisionLayerState,
    formatVisionLayerState,
    getVisionToggleShortcut,
};
