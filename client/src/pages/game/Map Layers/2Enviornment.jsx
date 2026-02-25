import {
  drawMapObject,
  getMapRenderData,
  getObjectZLevel,
  HEIGHT_UNITS_PER_ZLEVEL,
  TOP_VISIBLE_FADE_LEVELS,
  resolveFloorVisualType,
  shouldRedrawMapLayer,
} from "./mapLayerShared";


export const mapSolidsLayer = {
  id: "mapSolids",

  shouldRedraw(state, prevState) {
    return shouldRedrawMapLayer(state, prevState, {
      includeSelection: true,
      includeVisibility: true,
    });
  },

  draw(ctx, canvas, state, frame) {
    const renderData = getMapRenderData(state, frame, {
      mapObjects: state?.visibleMapObjects,
      cacheKey: "mapRenderDataVisible",
    });
    const {
      camera,
      floorTypesByID,
      currentZLevel,
      selectedMapObjectID,
      activeSolids,
      tallSolidsFromBelow,
      topVisibleSolids,
    } = renderData;



    if (!camera || !canvas || canvas.width === 0 || canvas.height === 0) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

const HEIGHT_UNITS_PER_ZLEVEL = 3;

(topVisibleSolids || []).forEach((obj) => {
      const level        = getObjectZLevel(obj);
      const elevHeight   = Number(obj?.elevationHeight) || 0;
      const topZLevel    = level + Math.floor(elevHeight / HEIGHT_UNITS_PER_ZLEVEL);
      const floorsBelow  = currentZLevel - topZLevel;               // >= 1
      const depthDarkness = Math.min(1, (floorsBelow - 1) / (TOP_VISIBLE_FADE_LEVELS - 1));

      if (depthDarkness >= 1) return;

      drawMapObject(ctx, obj, camera, {
        isGhost:         false,
        isTallFromBelow: false,
        depthDarkness,
        showLabel:       false,
        baseOpacity:     1,
        isSelected:      String(obj?.id ?? "") === String(selectedMapObjectID ?? ""),
        floorVisualType: resolveFloorVisualType(obj, floorTypesByID),
        drawShadows:     false,
      });
    });

    // ── 2. Tall solids clipping through from below ────────────────────────
    // Hash + dashed border. No darkening — we're inside the object's body.
    (tallSolidsFromBelow || []).forEach((obj) => {
      drawMapObject(ctx, obj, camera, {
        isGhost:         false,
        isTallFromBelow: true,
        depthDarkness:   0,
        showLabel:       false,
        baseOpacity:     1,
        isSelected:      String(obj?.id ?? "") === String(selectedMapObjectID ?? ""),
        floorVisualType: resolveFloorVisualType(obj, floorTypesByID),
        drawShadows:     false,
      });
    });

    // ── 3. Active-level solids ────────────────────────────────────────────
    // Objects on the current floor. If the object extends above this floor,
    // add a hash to show it continues upward.
    activeSolids.forEach((obj) => {
      const elevHeight = Number(obj?.elevationHeight) || 0;
      const topZLevel  = getObjectZLevel(obj) + Math.floor(elevHeight / HEIGHT_UNITS_PER_ZLEVEL);
      const extendsAbove = topZLevel > currentZLevel;

      drawMapObject(ctx, obj, camera, {
        isGhost:         false,
        isTallFromBelow: extendsAbove,
        depthDarkness:   0,
        showLabel:       true,
        baseOpacity:     1,
        isSelected:      String(obj?.id ?? "") === String(selectedMapObjectID ?? ""),
        floorVisualType: resolveFloorVisualType(obj, floorTypesByID),
        drawShadows:     false,
      });
    });



  },
};
