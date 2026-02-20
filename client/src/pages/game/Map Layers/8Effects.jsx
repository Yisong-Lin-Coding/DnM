import {
  drawBlockedMovePreview,
  drawResizeGuides,
  getMapRenderData,
  getObjectZLevel,
  shouldRedrawMapLayer,
} from "./mapLayerShared";

export const mapEffectsLayer = {
  id: "mapEffects",

  shouldRedraw(state, prevState) {
    return shouldRedrawMapLayer(state, prevState, {
      includeSelection: true,
      includeOverlay: true,
    });
  },

  draw(ctx, canvas, state, frame) {
    const renderData = getMapRenderData(state, frame);
    const {
      camera,
      currentZLevel,
      blockedMovePreview,
      showResizeHandles,
      selectedMapObjectID,
      selectedActiveObject,
    } = renderData;

    if (!camera || !canvas || canvas.width === 0 || canvas.height === 0) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (blockedMovePreview && getObjectZLevel(blockedMovePreview) === currentZLevel) {
      drawBlockedMovePreview(ctx, blockedMovePreview, camera);
    }

    if (showResizeHandles && selectedMapObjectID && selectedActiveObject) {
      drawResizeGuides(ctx, selectedActiveObject, camera);
    }
  },
};
