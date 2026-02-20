import {
  drawRaycastShadowLayer,
  getLowerLevelOpacity,
  getMapRenderData,
  getObjectZLevel,
  normalizeLighting,
  shouldRedrawMapLayer,
} from "./mapLayerShared";

// IMPORTANT — LAYER ORDER:
// This layer MUST be registered between the floors layer and the solids
// (environment) layer. Shadows fall on the floor and should be covered by
// the walls/obstacles that cast them, not drawn on top of them.
//
// Correct order:  0Background → 1Map → 2Shadows → 3Environment → ...
// Wrong order:    0Background → 1Map → 3Environment → 3Shadows → ...

export const mapShadowsLayer = {
  id: "mapShadows",

  shouldRedraw(state, prevState) {
    return shouldRedrawMapLayer(state, prevState, { includeLighting: true });
  },

  draw(ctx, canvas, state, frame) {
    // Always clear first — stale shadows from the previous frame must never persist.
    if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const renderData = getMapRenderData(state, frame);
    const { camera, currentZLevel, lowerLevelSolids, activeSolids } = renderData;

    if (!camera) return;

    const lighting = normalizeLighting(state?.lighting || {});
    if (!lighting?.enabled || !lighting?.shadowEnabled) return;

    ctx.save();

    // ── Lower-level solids ──────────────────────────────────────────────────
    //
    // Objects on floors BELOW the current z-level cast faint shadows upward.
    // We group them by their z-level so each group gets the right opacity.
    //
    // Why group by level instead of per-object?
    //   Ray casting needs ALL geometry for a given pass so walls occlude each
    //   other correctly. Grouping by z-level is the natural batch boundary —
    //   objects on the same level share the same light occlusion context.
    if (lowerLevelSolids.length > 0) {
      // Build a Map: zLevel → [solids at that level]
      const byLevel = new Map();
      lowerLevelSolids.forEach((obj) => {
        const level = getObjectZLevel(obj);
        if (!byLevel.has(level)) byLevel.set(level, []);
        byLevel.get(level).push(obj);
      });

      byLevel.forEach((solids, level) => {
        const distance = currentZLevel - level; // how many floors below
        const opacity  = getLowerLevelOpacity(distance) * 0.82;
        drawRaycastShadowLayer(ctx, solids, camera, lighting, opacity);
      });
    }

    // ── Active-level solids ─────────────────────────────────────────────────
    //
    // Objects on the current floor cast full-strength ray-cast shadows.
    // Pass the ENTIRE activeSolids array at once — the algorithm needs global
    // geometry so that walls properly block each other's shadows.
    if (activeSolids.length > 0) {
      drawRaycastShadowLayer(ctx, activeSolids, camera, lighting, 1);
    }

    ctx.restore();
  },
};