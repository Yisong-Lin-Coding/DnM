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
    return shouldRedrawMapLayer(state, prevState, { includeLighting: true, includeGeometry: true });
  },

  draw(ctx, canvas, state, frame) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Shadows are now handled by the lighting layer (7lighting.jsx) via light subtraction.
  },
};
