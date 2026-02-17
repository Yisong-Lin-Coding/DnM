const TERRAIN_ORDER = {
  floor: 0,
  obstacle: 2,
  wall: 3,
};

const TERRAIN_STYLE = {
  floor: {
    fillAlpha: 1,
    strokeColor: "#7DD3FC",
    lineWidth: 1.5,
    lineDash: [6, 6],
    labelColor: "#7DD3FC",
  },
  wall: {
    fillAlpha: 1,
    strokeColor: "#FCA5A5",
    lineWidth: 3,
    lineDash: [],
    labelColor: "#FCA5A5",
  },
  obstacle: {
    fillAlpha: 0.42,
    strokeColor: "#E5E7EB",
    lineWidth: 2,
    lineDash: [3, 4],
    labelColor: "#E5E7EB",
  },
};

const FLOOR_EFFECT_STYLE = {
  fillAlpha: 0.34,
  strokeColor: "#FCD34D",
  lineWidth: 2,
  lineDash: [4, 4],
  labelColor: "#FCD34D",
};

const RESIZE_HANDLE_RADIUS_PX = 6;
const HEIGHT_HANDLE_OFFSET_PX = 28;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeTerrainType = (value) => {
  const terrainType = String(value || "").trim().toLowerCase();
  if (terrainType === "floor" || terrainType === "wall" || terrainType === "obstacle") {
    return terrainType;
  }
  return "obstacle";
};

const normalizeFloorVisualType = (value) =>
  String(value || "").trim().toLowerCase() === "effect" ? "effect" : "base";

const normalizeLighting = (lighting = {}) => {
  const sourceInput =
    lighting?.source && typeof lighting.source === "object" && !Array.isArray(lighting.source)
      ? lighting.source
      : lighting;
  const x = clamp(Number(sourceInput?.x) || 0, -1, 1);
  const y = clamp(Number(sourceInput?.y) || 0, -1, 1);
  const magnitude = Math.hypot(x, y);
  const source =
    magnitude <= 1 || magnitude === 0
      ? { x, y }
      : {
          x: x / magnitude,
          y: y / magnitude,
        };
  return {
    enabled: lighting?.enabled !== false,
    source,
    intensity: clamp(Number(lighting?.intensity) || 0.5, 0, 1),
  };
};

const getObjectZLevel = (obj) => Math.round(Number(obj?.zLevel) || 0);

const getObjectElevationHeight = (obj) => Math.max(0, Number(obj?.elevationHeight) || 0);

const getObjectRadiusLikeValue = (obj) => {
  if (!obj) return 20;
  if (String(obj.type || "circle").toLowerCase() === "rect") {
    return Math.max(20, Math.max(Number(obj.width) || 0, Number(obj.height) || 0) / 2);
  }
  return Math.max(20, Number(obj.size) || 0);
};

const getObjectBoundsWorld = (obj = {}) => {
  const objectType = String(obj?.type || "circle").toLowerCase();
  const x = Number(obj?.x) || 0;
  const y = Number(obj?.y) || 0;

  if (objectType === "rect") {
    const halfWidth = Math.max(1, Number(obj?.width) || 0) / 2;
    const halfHeight = Math.max(1, Number(obj?.height) || 0) / 2;
    return {
      minX: x - halfWidth,
      maxX: x + halfWidth,
      minY: y - halfHeight,
      maxY: y + halfHeight,
    };
  }

  const radius = Math.max(1, Number(obj?.size) || 0);
  return {
    minX: x - radius,
    maxX: x + radius,
    minY: y - radius,
    maxY: y + radius,
  };
};

const worldToScreen = (camera, worldX, worldY) => ({
  x: worldX * camera.zoom - camera.x,
  y: worldY * camera.zoom - camera.y,
});

const getLowerLevelOpacity = (distance) => {
  if (!Number.isFinite(distance) || distance <= 0) return 1;
  return Math.max(0.1, 0.26 - (distance - 1) * 0.05);
};

const buildFloorTypesByID = (floorTypes = []) => {
  const byID = new Map();
  (Array.isArray(floorTypes) ? floorTypes : []).forEach((entry) => {
    const id = String(entry?.id || "").trim();
    if (!id || byID.has(id)) return;
    byID.set(id, entry);
  });
  return byID;
};

const resolveFloorVisualType = (obj, floorTypesByID) => {
  if (normalizeTerrainType(obj?.terrainType) !== "floor") return "base";
  const floorTypeID = String(obj?.floorTypeId || "").trim();
  const floorType = floorTypesByID.get(floorTypeID);
  return normalizeFloorVisualType(floorType?.floorVisualType || floorType?.visualType);
};

const getTerrainSortOrder = (obj, floorTypesByID) => {
  const terrain = normalizeTerrainType(obj?.terrainType);
  if (terrain !== "floor") {
    return TERRAIN_ORDER[terrain] ?? 2;
  }
  const floorVisualType = resolveFloorVisualType(obj, floorTypesByID);
  return floorVisualType === "effect" ? 1 : 0;
};

const getTerrainStyle = (terrainType, floorVisualType = "base") => {
  const base = TERRAIN_STYLE[terrainType] || TERRAIN_STYLE.obstacle;
  if (terrainType === "floor" && floorVisualType === "effect") {
    return {
      ...base,
      ...FLOOR_EFFECT_STYLE,
    };
  }
  return base;
};

const drawObjectHPBar = (ctx, obj, camera, screenX, screenY) => {
  const maxHP = Number(obj?.maxHP);
  const hp = Number(obj?.hp);
  if (!Number.isFinite(maxHP) || maxHP <= 0 || !Number.isFinite(hp)) return;

  const ratio = Math.max(0, Math.min(1, hp / maxHP));
  const width = Math.max(18, Math.min(72, getObjectRadiusLikeValue(obj) * camera.zoom * 1.4));
  const height = 6;
  const y = screenY - getObjectRadiusLikeValue(obj) * camera.zoom - 14;
  const x = screenX - width / 2;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = ratio > 0.4 ? "#22c55e" : ratio > 0.15 ? "#f59e0b" : "#ef4444";
  ctx.fillRect(x, y, width * ratio, height);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
};

const drawShape = (ctx, obj, camera, style = {}) => {
  const screenX = (Number(obj?.x) || 0) * camera.zoom - camera.x;
  const screenY = (Number(obj?.y) || 0) * camera.zoom - camera.y;
  const objectType = String(obj?.type || "circle").toLowerCase();
  const fill = style.fill !== false;
  const stroke = style.stroke !== false;

  if (objectType === "circle") {
    const radius = (Number(obj?.size) || 0) * camera.zoom;
    ctx.beginPath();
    ctx.arc(screenX, screenY, Math.max(1, radius), 0, Math.PI * 2);
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
    return { screenX, screenY };
  }

  if (objectType === "rect") {
    const width = Math.max(1, (Number(obj?.width) || 0) * camera.zoom);
    const height = Math.max(1, (Number(obj?.height) || 0) * camera.zoom);
    if (fill) ctx.fillRect(screenX - width / 2, screenY - height / 2, width, height);
    if (stroke) ctx.strokeRect(screenX - width / 2, screenY - height / 2, width, height);
    return { screenX, screenY };
  }

  const size = Math.max(1, (Number(obj?.size) || 0) * camera.zoom);
  ctx.beginPath();
  ctx.moveTo(screenX, screenY - size);
  ctx.lineTo(screenX - size, screenY + size);
  ctx.lineTo(screenX + size, screenY + size);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
  return { screenX, screenY };
};

const drawObjectDirectionalShadow = (ctx, obj, camera, lighting, opacity = 1) => {
  if (!lighting?.enabled) return;
  const objectHeight = getObjectElevationHeight(obj);
  if (objectHeight <= 0) return;

  const zoom = Number(camera?.zoom) || 1;
  const sourceX = Number(lighting?.source?.x) || 0;
  const sourceY = Number(lighting?.source?.y) || 0;
  const lightTilt = clamp(Math.hypot(sourceX, sourceY), 0, 1);
  const intensity = clamp(Number(lighting?.intensity) || 0.5, 0, 1);

  const contactAlpha = clamp((0.08 + (objectHeight / 320) * 0.18) * opacity, 0.05, 0.35);
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.globalAlpha = contactAlpha;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = Math.max(1, Math.round(2 + zoom * 1.5));
  drawShape(ctx, obj, camera, { fill: true, stroke: false });
  ctx.restore();

  if (lightTilt < 0.025) return;

  const shadowReach = objectHeight * zoom * (0.18 + lightTilt * 0.55);
  const offsetX = -sourceX * shadowReach;
  const offsetY = -sourceY * shadowReach;
  const layers = Math.max(2, Math.round(2 + lightTilt * 4));
  const directionalAlpha = clamp(
    (0.05 + (objectHeight / 220) * (0.32 + intensity * 0.38)) * opacity,
    0.05,
    0.58
  );

  for (let index = 1; index <= layers; index += 1) {
    const t = index / layers;
    ctx.save();
    ctx.translate(offsetX * t, offsetY * t);
    ctx.fillStyle = "#000000";
    ctx.globalAlpha = directionalAlpha * (1 - t * 0.62);
    drawShape(ctx, obj, camera, { fill: true, stroke: false });
    ctx.restore();
  }
};

const drawResizeGuides = (ctx, obj, camera) => {
  const bounds = getObjectBoundsWorld(obj);
  const topLeft = worldToScreen(camera, bounds.minX, bounds.minY);
  const topRight = worldToScreen(camera, bounds.maxX, bounds.minY);
  const bottomLeft = worldToScreen(camera, bounds.minX, bounds.maxY);
  const bottomRight = worldToScreen(camera, bounds.maxX, bounds.maxY);
  const topCenter = worldToScreen(camera, (bounds.minX + bounds.maxX) / 2, bounds.minY);
  const heightHandle = {
    x: topCenter.x,
    y: topCenter.y - HEIGHT_HANDLE_OFFSET_PX,
  };

  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "#93c5fd";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    topLeft.x,
    topLeft.y,
    Math.max(1, topRight.x - topLeft.x),
    Math.max(1, bottomLeft.y - topLeft.y)
  );

  ctx.setLineDash([]);
  const cornerHandles = [topLeft, topRight, bottomRight, bottomLeft];
  cornerHandles.forEach((handle) => {
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.arc(handle.x, handle.y, RESIZE_HANDLE_RADIUS_PX, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.beginPath();
  ctx.moveTo(topCenter.x, topCenter.y);
  ctx.lineTo(heightHandle.x, heightHandle.y);
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#fbbf24";
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth = 1.5;
  ctx.fillRect(heightHandle.x - 5, heightHandle.y - 5, 10, 10);
  ctx.strokeRect(heightHandle.x - 5, heightHandle.y - 5, 10, 10);
  ctx.restore();
};

const drawMapObject = (ctx, obj, camera, options = {}) => {
  const {
    isGhost = false,
    showLabel = true,
    baseOpacity = 1,
    isSelected = false,
    floorVisualType = "base",
    lighting = null,
  } = options;
  const opacity = Math.max(0.05, Math.min(1, baseOpacity));
  const terrainType = normalizeTerrainType(obj?.terrainType);
  const terrainStyle = getTerrainStyle(terrainType, floorVisualType);
  const terrainLabel =
    terrainType === "floor" && floorVisualType === "effect"
      ? "FLOOR FX"
      : terrainType.toUpperCase();
  const objectHeight = Math.round(getObjectElevationHeight(obj));

  ctx.save();
  if (!isGhost) {
    drawObjectDirectionalShadow(ctx, obj, camera, lighting, opacity);
  }
  ctx.strokeStyle = terrainStyle.strokeColor;
  ctx.lineWidth = terrainStyle.lineWidth;
  ctx.setLineDash(terrainStyle.lineDash);
  ctx.fillStyle = obj?.color || "#3B82F6";
  ctx.globalAlpha = opacity * terrainStyle.fillAlpha;
  const point = drawShape(ctx, obj, camera, { fill: true, stroke: false });
  ctx.globalAlpha = opacity;
  drawShape(ctx, obj, camera, { fill: false, stroke: true });

  if (isSelected) {
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(4, terrainStyle.lineWidth + 2);
    ctx.strokeStyle = "#FDE047";
    drawShape(ctx, obj, camera, { fill: false, stroke: true });
  }

  if (showLabel && point) {
    ctx.setLineDash([]);
    ctx.fillStyle = terrainStyle.labelColor;
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.globalAlpha = opacity;
    const objectLabel = `${terrainLabel} | Z:${Math.round(Number(obj?.z) || 0)} | L:${Math.round(
      Number(obj?.zLevel) || 0
    )} | H:${objectHeight}`;
    ctx.fillText(
      objectLabel,
      point.screenX,
      point.screenY + getObjectRadiusLikeValue(obj) * camera.zoom + 14
    );
  }

  if (!isGhost && point) {
    drawObjectHPBar(ctx, obj, camera, point.screenX, point.screenY);
  }

  ctx.restore();
};

const drawBlockedMovePreview = (ctx, obj, camera) => {
  if (!obj || !camera) return;

  const point = {
    screenX: (Number(obj?.x) || 0) * camera.zoom - camera.x,
    screenY: (Number(obj?.y) || 0) * camera.zoom - camera.y,
  };

  ctx.save();
  ctx.strokeStyle = "#ef4444";
  ctx.fillStyle = "rgba(239,68,68,0.16)";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.globalAlpha = 0.95;
  drawShape(ctx, obj, camera, { fill: true, stroke: true });
  ctx.setLineDash([]);
  ctx.fillStyle = "#fecaca";
  ctx.font = "11px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    "Collision",
    point.screenX,
    point.screenY - getObjectRadiusLikeValue(obj) * camera.zoom - 10
  );
  ctx.restore();
};

export const mapObjectsLayer = {
  id: "mapObjects",

  shouldRedraw(state, prevState) {
    const c = state?.camera;
    const p = prevState?.camera;
    if (!c || !p) return true;

    return (
      c.x !== p.x ||
      c.y !== p.y ||
      c.zoom !== p.zoom ||
      state.mapObjects !== prevState.mapObjects ||
      state.floorTypes !== prevState.floorTypes ||
      state.currentZLevel !== prevState.currentZLevel ||
      state.selectedMapObjectID !== prevState.selectedMapObjectID ||
      state.blockedMovePreview !== prevState.blockedMovePreview ||
      state.lighting !== prevState.lighting ||
      state.showResizeHandles !== prevState.showResizeHandles
    );
  },

  draw(ctx, canvas, state) {
    const {
      camera,
      mapObjects = [],
      floorTypes = [],
      currentZLevel = 0,
      selectedMapObjectID = "",
      blockedMovePreview = null,
      lighting: rawLighting = null,
      showResizeHandles = false,
    } = state;

    if (!camera || !canvas || canvas.width === 0 || canvas.height === 0) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const lighting = normalizeLighting(rawLighting || {});
    const floorTypesByID = buildFloorTypesByID(floorTypes);
    const normalizedCurrentLevel = Math.round(Number(currentZLevel) || 0);
    const minVisibleLowerLevel = normalizedCurrentLevel >= 0 ? 0 : normalizedCurrentLevel;
    const sortedObjects = [...mapObjects].sort((a, b) => {
      const levelDiff = getObjectZLevel(a) - getObjectZLevel(b);
      if (levelDiff !== 0) return levelDiff;
      const zDiff = (Number(a?.z) || 0) - (Number(b?.z) || 0);
      if (zDiff !== 0) return zDiff;
      return getTerrainSortOrder(a, floorTypesByID) - getTerrainSortOrder(b, floorTypesByID);
    });

    const lowerLevelObjects = sortedObjects.filter((obj) => {
      const level = getObjectZLevel(obj);
      return level < normalizedCurrentLevel && level >= minVisibleLowerLevel;
    });
    const activeObjects = sortedObjects.filter((obj) => getObjectZLevel(obj) === normalizedCurrentLevel);

    lowerLevelObjects.forEach((obj) => {
      const distance = normalizedCurrentLevel - getObjectZLevel(obj);
      drawMapObject(ctx, obj, camera, {
        isGhost: true,
        showLabel: false,
        baseOpacity: getLowerLevelOpacity(distance),
        floorVisualType: resolveFloorVisualType(obj, floorTypesByID),
        lighting,
      });
    });

    activeObjects.forEach((obj) => {
      drawMapObject(ctx, obj, camera, {
        isGhost: false,
        showLabel: true,
        baseOpacity: 1,
        isSelected: String(obj?.id ?? "") === String(selectedMapObjectID ?? ""),
        floorVisualType: resolveFloorVisualType(obj, floorTypesByID),
        lighting,
      });
    });

    if (blockedMovePreview && getObjectZLevel(blockedMovePreview) === normalizedCurrentLevel) {
      drawBlockedMovePreview(ctx, blockedMovePreview, camera);
    }

    if (showResizeHandles && selectedMapObjectID) {
      const selectedObject = activeObjects.find(
        (obj) => String(obj?.id ?? "") === String(selectedMapObjectID ?? "")
      );
      if (selectedObject) {
        drawResizeGuides(ctx, selectedObject, camera);
      }
    }
  },
};
