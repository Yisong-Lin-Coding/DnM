import {
  drawMapObject,
  getLowerLevelOpacity,
  getMapRenderData,
  getObjectZLevel,
  resolveFloorVisualType,
  shouldRedrawMapLayer,
} from "./mapLayerShared";

export const mapFloorLayer = {
  id: "mapFloors",

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
      lowerLevelFloors,
      activeFloors,
    } = renderData;

    if (!camera || !canvas || canvas.width === 0 || canvas.height === 0) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    lowerLevelFloors.forEach((obj) => {
      const distance = currentZLevel - getObjectZLevel(obj);
      drawMapObject(ctx, obj, camera, {
        isGhost: true,
        showLabel: false,
        baseOpacity: getLowerLevelOpacity(distance),
        floorVisualType: resolveFloorVisualType(obj, floorTypesByID),
        drawShadows: false,
      });
    });

    activeFloors.forEach((obj) => {
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
