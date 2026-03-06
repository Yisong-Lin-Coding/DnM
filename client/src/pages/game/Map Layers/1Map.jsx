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
    if (!prevState) return true;
    if (state?.ghostMapObjects !== prevState?.ghostMapObjects) return true;
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
    const ghostObjects = Array.isArray(state?.ghostMapObjects) ? state.ghostMapObjects : [];
    const ghostRenderData = getMapRenderData(state, frame, {
      mapObjects: ghostObjects,
      cacheKey: "mapRenderDataGhost",
    });
    const {
      camera,
      floorTypesByID,
      currentZLevel,
      selectedMapObjectID,
      lowerLevelFloors,
      activeFloors,
    } = renderData;
    const ghostFloors = ghostRenderData?.activeFloors || [];

    if (!camera || !canvas || canvas.width === 0 || canvas.height === 0) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ghostFloors.forEach((obj) => {
      drawMapObject(ctx, obj, camera, {
        isGhost: true,
        showLabel: false,
        baseOpacity: 0.45,
        floorVisualType: resolveFloorVisualType(obj, floorTypesByID),
        drawShadows: false,
      });
    });

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
