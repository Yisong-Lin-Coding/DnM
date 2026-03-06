/**
 * Vision Layer - Renders vision zones for characters using server-side ray-casting
 * Ray endpoints are calculated on server and included in character tokens
 * Both DM and Character views use identical ray data from server
 * Includes main vision cone, peripheral flanks, and close-range circle
 */

import VisionRenderer from '../visionRenderer.js';

const resolveSelectedChar = (selectedChar, characters = []) => {
    if (!selectedChar) return null;
    if (typeof selectedChar === 'object') return selectedChar;
    const selectedId = String(selectedChar);
    return (Array.isArray(characters) ? characters : []).find(
        (char) => String(char?.id ?? '') === selectedId
    ) || null;
};

const getSelectedId = (selectedChar) => {
    if (!selectedChar) return '';
    if (typeof selectedChar === 'object') return String(selectedChar?.id ?? '');
    return String(selectedChar);
};

export const visionLayer = {
    name: 'visionLayer',
    zIndex: 5.5, // Between lighting and fog

    shouldRedraw(state, prevState) {
        if (!prevState) return true;
        if (state?.isDM !== prevState?.isDM) return true;
        const selectedId = getSelectedId(state?.selectedChar);
        const prevSelectedId = getSelectedId(prevState?.selectedChar);
        if (selectedId !== prevSelectedId) return true;
        if ((state?.debugLightSample?.timestamp ?? null) !== (prevState?.debugLightSample?.timestamp ?? null)) return true;
        const selectedToken = resolveSelectedChar(state?.selectedChar, state?.characters);
        const prevSelectedToken = resolveSelectedChar(prevState?.selectedChar, prevState?.characters);
        if ((selectedToken?.rotation ?? null) !== (prevSelectedToken?.rotation ?? null)) return true;
        const selectedPos = selectedToken?.position || {};
        const prevSelectedPos = prevSelectedToken?.position || {};
        if (selectedPos.x !== prevSelectedPos.x || selectedPos.y !== prevSelectedPos.y) return true;
        if ((selectedToken?.lightLevel ?? null) !== (prevSelectedToken?.lightLevel ?? null)) return true;
        if (JSON.stringify(state?.characters) !== JSON.stringify(prevState?.characters)) return true;
        const c = state?.camera, p = prevState?.camera;
        if (!c || !p) return true;
        if (c.x !== p.x || c.y !== p.y || c.zoom !== p.zoom) return true;
        return false;
    },
    
    draw: (ctx, canvas, state = {}) => {
        if (!ctx || !canvas) return;
        
        // Get state data
        const {
            isDM = false,
            selectedChar = null,
            characters = [],
            camera = { x: 0, y: 0, zoom: 1 },
            debugLightSample = null,
        } = state;
        const selectedToken = resolveSelectedChar(selectedChar, characters);

        // Helper to separate main and peripheral rays
        const separateRays = (rays) => {
            if (!Array.isArray(rays)) return { main: [], peripheral: [] };
            return {
                main: rays.filter(r => !r?.isPeripheral),
                peripheral: rays.filter(r => r?.isPeripheral),
            };
        };

        const getRaysForCharacter = (character) => {
            if (!character?.vision) return { main: [], peripheral: [] };
            const allRays = Array.isArray(character.visionRays) ? character.visionRays : [];
            return separateRays(allRays);
        };

        // Clear the layer
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // For DM: Show vision zones for all characters (faint)
        if (isDM && characters.length > 0) {
            for (const character of characters) {
                if (!character || !character.vision) continue;
                
                // Use server-side rays from character token
                const { main: mainRays, peripheral: peripheralRays } = getRaysForCharacter(character);
                
                ctx.globalAlpha = 0.2;
                // Render main vision cone using main rays
                VisionRenderer.renderRayBasedVisionCone(ctx, character, character.vision.distance, character.vision.angle, camera, mainRays);
                // Render peripheral rays (fainter)
                VisionRenderer.renderPeripheralRaysCone(ctx, character, camera, peripheralRays);
                // Render close-range circle
                VisionRenderer.renderCloseRangeVision(ctx, character, character.vision.radius, camera);
                ctx.globalAlpha = 1.0;
            }
        }

        // For all: Show vision for selected character (more opaque)
        if (selectedToken && selectedToken.vision) {
            // Use server-side rays from character token
            const { main: mainRays, peripheral: peripheralRays } = getRaysForCharacter(selectedToken);
            
            ctx.globalAlpha = 0.5;
            // Render main vision cone using main rays
            VisionRenderer.renderRayBasedVisionCone(ctx, selectedToken, selectedToken.vision.distance, selectedToken.vision.angle, camera, mainRays);
            // Render peripheral rays with light-aware distances
            VisionRenderer.renderPeripheralRaysCone(ctx, selectedToken, camera, peripheralRays);
            // Render close-range omnidirectional circle
            VisionRenderer.renderCloseRangeVision(ctx, selectedToken, selectedToken.vision.radius, camera);
            
            VisionRenderer.renderFacingDirection(ctx, selectedToken, selectedToken.vision.distance, camera);
            
            // Show debug info for selected character if DM
            if (isDM) {
                VisionRenderer.renderVisionDebugInfo(ctx, selectedToken, 20, 100);
                
                // Show detailed ray and vision info
                ctx.save();
                const debugFontSize = 12;
                const debugLineHeight = 16;
                ctx.font = `${debugFontSize}px "Cascadia Mono", "Consolas", "Menlo", monospace`;
                ctx.fillStyle = 'rgba(230, 230, 230, 0.98)';
                const charX = Number(selectedToken?.position?.x) || 0;
                const charY = Number(selectedToken?.position?.y) || 0;
                const serverLightLevel = Number.isFinite(Number(selectedToken?._debugLightLevel))
                    ? Number(selectedToken._debugLightLevel)
                    : null;
                const lightLevel = serverLightLevel ?? (Number(selectedToken?.lightLevel) || 0.5);
                const debugStartX = 20;
                let debugY = 118;
                
                ctx.fillText(`Char Pos: (${charX.toFixed(0)}, ${charY.toFixed(0)})`, debugStartX, debugY);
                debugY += debugLineHeight;
                ctx.fillText(`Light Level: ${(lightLevel * 100).toFixed(0)}%`, debugStartX, debugY);
                debugY += debugLineHeight;
                if (serverLightLevel != null) {
                    ctx.fillText(`Server Light: ${(serverLightLevel * 100).toFixed(0)}%`, debugStartX, debugY);
                    debugY += debugLineHeight;
                }
                ctx.fillText(`Vision Dist: ${selectedToken?.vision?.distance?.toFixed(0) || 'N/A'} ft`, debugStartX, debugY);
                debugY += debugLineHeight;
                ctx.fillText(`Main Rays: ${mainRays.length} | Peripheral: ${peripheralRays.length}`, debugStartX, debugY);
                debugY += debugLineHeight;
                
                // Show first and last main ray info
                if (mainRays.length > 0) {
                    const firstRay = mainRays[0];
                    const lastRay = mainRays[mainRays.length - 1];
                    ctx.fillText(`Ray 1: dist=${firstRay?.distance?.toFixed(0) || 'N/A'} end=(${firstRay?.endX?.toFixed(0)}, ${firstRay?.endY?.toFixed(0)})`, debugStartX, debugY);
                    debugY += debugLineHeight;
                    ctx.fillText(`Ray L: dist=${lastRay?.distance?.toFixed(0) || 'N/A'} end=(${lastRay?.endX?.toFixed(0)}, ${lastRay?.endY?.toFixed(0)})`, debugStartX, debugY);
                    debugY += debugLineHeight;
                }

                const sample = state?.debugLightSample;
                if (sample) {
                    const sampleLabel = sample.error
                        ? `Light Debug ERROR: ${sample.error}`
                        : `Light Debug @ (${Math.round(sample.worldX)}, ${Math.round(sample.worldY)})`;
                    ctx.fillText(sampleLabel, debugStartX, debugY);
                    debugY += debugLineHeight;
                    if (!sample.error) {
                        ctx.fillText(
                            `Level: ${(Number(sample.lightLevel || 0) * 100).toFixed(0)}% | Ambient: ${(Number(sample.ambient || 0) * 100).toFixed(0)}%`,
                            debugStartX,
                            debugY
                        );
                        debugY += debugLineHeight;
                        ctx.fillText(
                            `Lighting Enabled: ${sample.lightingEnabled ? "yes" : "no"} | Z: ${Number(sample.currentZLevel || 0)}`,
                            debugStartX,
                            debugY
                        );
                        debugY += debugLineHeight;
                    }
                }
                
                ctx.restore();
            }
            
            ctx.globalAlpha = 1.0;
        }

        if (isDM && debugLightSample) {
            ctx.save();
            ctx.globalAlpha = 1.0;
            const debugFontSize = 12;
            const debugLineHeight = 16;
            ctx.font = `${debugFontSize}px "Cascadia Mono", "Consolas", "Menlo", monospace`;
            ctx.fillStyle = 'rgba(240, 240, 240, 0.98)';
            const debugStartX = 20;
            let debugY = 20;

            if (debugLightSample.error) {
                ctx.fillStyle = 'rgba(255, 180, 180, 0.98)';
                ctx.fillText(`Light Debug ERROR: ${debugLightSample.error}`, debugStartX, debugY);
            } else {
                ctx.fillText(
                    `Light Debug @ (${Math.round(debugLightSample.worldX)}, ${Math.round(debugLightSample.worldY)})`,
                    debugStartX,
                    debugY
                );
                debugY += debugLineHeight;
                ctx.fillText(
                    `Level: ${(Number(debugLightSample.lightLevel || 0) * 100).toFixed(0)}% | Ambient: ${(Number(debugLightSample.ambient || 0) * 100).toFixed(0)}%`,
                    debugStartX,
                    debugY
                );
                debugY += debugLineHeight;
                ctx.fillText(
                    `Lighting Enabled: ${debugLightSample.lightingEnabled ? "yes" : "no"} | Z: ${Number(debugLightSample.currentZLevel || 0)}`,
                    debugStartX,
                    debugY
                );
            }

            ctx.restore();
        }
    }
};
