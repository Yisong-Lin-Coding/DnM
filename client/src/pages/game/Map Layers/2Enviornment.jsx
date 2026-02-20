import {
  drawMapObject,
  getLowerLevelOpacity,
  getMapRenderData,
  getObjectZLevel,
  resolveFloorVisualType,
  shouldRedrawMapLayer,
} from "./mapLayerShared";

export const mapSolidsLayer = {
  id: "mapSolids",

  shouldRedraw(state, prevState) {
    return shouldRedrawMapLayer(state, prevState, {
      includeSelection: true,
    });
  },

  draw(ctx, canvas, state, frame) {
    const renderData = getMapRenderData(state, frame);
    const {
      camera,
      floorTypesByID,
      currentZLevel,
      selectedMapObjectID,
      lowerLevelSolids,
      activeSolids,
    } = renderData;

    if (!camera || !canvas || canvas.width === 0 || canvas.height === 0) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    lowerLevelSolids.forEach((obj) => {
      const distance = currentZLevel - getObjectZLevel(obj);
      drawMapObject(ctx, obj, camera, {
        isGhost: true,
        showLabel: false,
        baseOpacity: getLowerLevelOpacity(distance),
        floorVisualType: resolveFloorVisualType(obj, floorTypesByID),
        drawShadows: false,
      });
    });

    activeSolids.forEach((obj) => {
      drawMapObject(ctx, obj, camera, {
        isGhost: false,
        showLabel: true,
        baseOpacity: 1,
        isSelected: String(obj?.id ?? "") === String(selectedMapObjectID ?? ""),
        floorVisualType: resolveFloorVisualType(obj, floorTypesByID),
        drawShadows: false,
      });
    });
  },
};
