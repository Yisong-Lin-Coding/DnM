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

// ============================================================================
// LIGHTING NORMALIZATION FUNCTIONS
// ============================================================================

const normalizeLightingDirection = (value = {}) => {
  const x = clamp(Number(value?.x) || 0, -1, 1);
  const y = clamp(Number(value?.y) || 0, -1, 1);
  const magnitude = Math.hypot(x, y);
  if (magnitude <= 1 || magnitude === 0) return { x, y };
  return {
    x: x / magnitude,
    y: y / magnitude,
  };
};

const normalizeLightSourceType = (value) =>
  String(value || "").trim().toLowerCase() === "point" ? "point" : "directional";

const normalizeLightingSource = (raw = {}, fallbackIndex = 0) => {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const type = normalizeLightSourceType(source.type);
  const sourceInput =
    source?.source && typeof source.source === "object" && !Array.isArray(source.source)
      ? source.source
      : source;

  const normalized = {
    id: String(source.id || `light_${fallbackIndex + 1}`).trim() || `light_${fallbackIndex + 1}`,
    name:
      String(source.name || (type === "point" ? `Lamp ${fallbackIndex + 1}` : `Light ${fallbackIndex + 1}`))
        .trim() || (type === "point" ? `Lamp ${fallbackIndex + 1}` : `Light ${fallbackIndex + 1}`),
    type,
    enabled: source.enabled !== false,
    intensity: clamp(Number(source.intensity) || 0.8, 0, 2),
    blend: clamp(Number(source.blend) || 0.7, 0, 1),
    color: String(source.color || "#ffffff").trim(),
  };

  if (type === "point") {
    normalized.worldX = Number(source.worldX ?? source.position?.x) || 0;
    normalized.worldY = Number(source.worldY ?? source.position?.y) || 0;
    normalized.range = Math.max(10, Number(source.range) || 420);
  } else {
    const direction = normalizeLightingDirection({
      x: sourceInput?.x,
      y: sourceInput?.y,
    });
    normalized.x = direction.x;
    normalized.y = direction.y;
  }

  return normalized;
};

const normalizeLighting = (lighting = {}) => {
  const sourceInput =
    lighting?.source && typeof lighting.source === "object" && !Array.isArray(lighting.source)
      ? lighting.source
      : lighting;
  
  const rawSources = Array.isArray(lighting?.sources) ? lighting.sources : [];
  let sources = rawSources.map((entry, index) => normalizeLightingSource(entry, index));
  
  // Backward compatibility: if no sources array, create one from legacy format
  if (sources.length === 0) {
    sources = [
      normalizeLightingSource(
        {
          type: "directional",
          x: sourceInput?.x,
          y: sourceInput?.y,
          intensity: lighting?.intensity,
          blend: lighting?.blend,
        },
        0
      ),
    ];
  }

  return {
    enabled: lighting?.enabled !== false,
    ambient: clamp(Number(lighting?.ambient) || 0.3, 0, 0.95),
    shadowEnabled: lighting?.shadowEnabled !== false,
    shadowStrength: clamp(Number(lighting?.shadowStrength) || 0.72, 0, 1),
    shadowSoftness: clamp(Number(lighting?.shadowSoftness) || 0.55, 0, 1),
    shadowLength: clamp(Number(lighting?.shadowLength) || 0.8, 0, 2),
    shadowBlend: clamp(Number(lighting?.shadowBlend) || 0.6, 0, 1),
    sources,
  };
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

// ============================================================================
// MULTI-SOURCE SHADOW RENDERING
// ============================================================================

const drawObjectShadowFromDirectionalLight = (ctx, obj, camera, lightSource, lighting, opacity = 1) => {
  if (!lightSource.enabled) return;
  
  const objectHeight = getObjectElevationHeight(obj);
  if (objectHeight <= 0) return;

  const zoom = Number(camera?.zoom) || 1;
  const sourceX = Number(lightSource?.x) || 0;
  const sourceY = Number(lightSource?.y) || 0;
  const lightTilt = clamp(Math.hypot(sourceX, sourceY), 0, 1);
  const intensity = clamp(Number(lightSource?.intensity) || 0.8, 0, 2);
  const blend = clamp(Number(lightSource?.blend) || 0.7, 0, 1);

  // Contact shadow (directly under object)
  const contactAlpha = clamp(
    (0.08 + (objectHeight / 320) * 0.18) * opacity * lighting.shadowStrength * blend,
    0.05,
    0.35
  );
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.globalAlpha = contactAlpha;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = Math.max(1, Math.round((2 + zoom * 1.5) * lighting.shadowSoftness));
  drawShape(ctx, obj, camera, { fill: true, stroke: false });
  ctx.restore();

  if (lightTilt < 0.025) return;

  // Directional shadow (cast from light direction)
  const shadowReach = objectHeight * zoom * (0.18 + lightTilt * 0.55) * lighting.shadowLength;
  const offsetX = -sourceX * shadowReach;
  const offsetY = -sourceY * shadowReach;
  const layers = Math.max(2, Math.round((2 + lightTilt * 4) * lighting.shadowSoftness));
  const directionalAlpha = clamp(
    (0.05 + (objectHeight / 220) * (0.32 + intensity * 0.38)) * opacity * lighting.shadowStrength * blend,
    0.05,
    0.58
  );

  for (let index = 1; index <= layers; index += 1) {
    const t = index / layers;
    ctx.save();
    ctx.translate(offsetX * t, offsetY * t);
    ctx.fillStyle = "#000000";
    ctx.globalAlpha = directionalAlpha * (1 - t * 0.62) * lighting.shadowBlend;
    drawShape(ctx, obj, camera, { fill: true, stroke: false });
    ctx.restore();
  }
};

const drawObjectShadowFromPointLight = (ctx, obj, camera, lightSource, lighting, opacity = 1) => {
  if (!lightSource.enabled) return;
  
  const objectHeight = getObjectElevationHeight(obj);
  if (objectHeight <= 0) return;

  const zoom = Number(camera?.zoom) || 1;
  const objX = Number(obj?.x) || 0;
  const objY = Number(obj?.y) || 0;
  const lightX = Number(lightSource?.worldX) || 0;
  const lightY = Number(lightSource?.worldY) || 0;
  const range = Math.max(10, Number(lightSource?.range) || 420);

  // Calculate distance from light to object
  const dx = objX - lightX;
  const dy = objY - lightY;
  const distance = Math.hypot(dx, dy);

  // Skip if object is out of range
  if (distance > range) return;

  // Calculate light falloff
  const falloff = Math.max(0, 1 - (distance / range));
  if (falloff < 0.05) return;

  const intensity = clamp(Number(lightSource?.intensity) || 0.8, 0, 2);
  const blend = clamp(Number(lightSource?.blend) || 0.7, 0, 1);

  // Calculate shadow direction (away from light)
  const dirX = distance > 0 ? dx / distance : 0;
  const dirY = distance > 0 ? dy / distance : 0;

  // Contact shadow
  const contactAlpha = clamp(
    (0.08 + (objectHeight / 320) * 0.18) * opacity * lighting.shadowStrength * blend * falloff,
    0.05,
    0.35
  );
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.globalAlpha = contactAlpha;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = Math.max(1, Math.round((2 + zoom * 1.5) * lighting.shadowSoftness));
  drawShape(ctx, obj, camera, { fill: true, stroke: false });
  ctx.restore();

  // Directional shadow (cast away from point light)
  const shadowReach = objectHeight * zoom * (0.18 + 0.55) * lighting.shadowLength * falloff;
  const offsetX = dirX * shadowReach;
  const offsetY = dirY * shadowReach;
  const layers = Math.max(2, Math.round((2 + 4) * lighting.shadowSoftness));
  const directionalAlpha = clamp(
    (0.05 + (objectHeight / 220) * (0.32 + intensity * 0.38)) * opacity * lighting.shadowStrength * blend * falloff,
    0.05,
    0.58
  );

  for (let index = 1; index <= layers; index += 1) {
    const t = index / layers;
    ctx.save();
    ctx.translate(offsetX * t, offsetY * t);
    ctx.fillStyle = "#000000";
    ctx.globalAlpha = directionalAlpha * (1 - t * 0.62) * lighting.shadowBlend;
    drawShape(ctx, obj, camera, { fill: true, stroke: false });
    ctx.restore();
  }
};

const drawObjectMultiSourceShadows = (ctx, obj, camera, lighting, opacity = 1) => {
  if (!lighting?.enabled || !lighting?.shadowEnabled) return;
  if (!Array.isArray(lighting?.sources) || lighting.sources.length === 0) return;

  // Draw shadows from each enabled light source
  lighting.sources.forEach((lightSource) => {
    if (!lightSource || !lightSource.enabled) return;

    if (lightSource.type === "directional") {
      drawObjectShadowFromDirectionalLight(ctx, obj, camera, lightSource, lighting, opacity);
    } else if (lightSource.type === "point") {
      drawObjectShadowFromPointLight(ctx, obj, camera, lightSource, lighting, opacity);
    }
  });
};

// ============================================================================
// OBJECT DRAWING
// ============================================================================

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
  
  // Draw multi-source shadows
  if (!isGhost && lighting) {
    drawObjectMultiSourceShadows(ctx, obj, camera, lighting, opacity);
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

// ============================================================================
// LAYER EXPORT
// ============================================================================

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