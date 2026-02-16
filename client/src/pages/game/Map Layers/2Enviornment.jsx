const TERRAIN_ORDER = {
  floor: 0,
  obstacle: 1,
  wall: 2,
};

const TERRAIN_STYLE = {
  floor: {
    fillAlpha: 0.2,
    strokeColor: "#7DD3FC",
    lineWidth: 1.5,
    lineDash: [6, 6],
    labelColor: "#7DD3FC",
  },
  wall: {
    fillAlpha: 0.7,
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

const normalizeTerrainType = (value) => {
  const terrainType = String(value || "").trim().toLowerCase();
  if (terrainType === "floor" || terrainType === "wall" || terrainType === "obstacle") {
    return terrainType;
  }
  return "obstacle";
};

const getObjectZLevel = (obj) => Math.round(Number(obj?.zLevel) || 0);

const getObjectRadiusLikeValue = (obj) => {
  if (!obj) return 20;
  if (String(obj.type || "circle").toLowerCase() === "rect") {
    return Math.max(20, Math.max(Number(obj.width) || 0, Number(obj.height) || 0) / 2);
  }
  return Math.max(20, Number(obj.size) || 0);
};

const getLowerLevelOpacity = (distance) => {
  if (!Number.isFinite(distance) || distance <= 0) return 1;
  return Math.max(0.1, 0.26 - (distance - 1) * 0.05);
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

const drawMapObject = (ctx, obj, camera, options = {}) => {
  const {
    isGhost = false,
    showLabel = true,
    baseOpacity = 1,
  } = options;
  const opacity = Math.max(0.05, Math.min(1, baseOpacity));
  const screenX = (Number(obj?.x) || 0) * camera.zoom - camera.x;
  const screenY = (Number(obj?.y) || 0) * camera.zoom - camera.y;
  const terrainType = normalizeTerrainType(obj?.terrainType);
  const terrainStyle = TERRAIN_STYLE[terrainType] || TERRAIN_STYLE.obstacle;
  const objectType = String(obj?.type || "circle").toLowerCase();

  ctx.save();
  ctx.strokeStyle = terrainStyle.strokeColor;
  ctx.lineWidth = terrainStyle.lineWidth;
  ctx.setLineDash(terrainStyle.lineDash);
  ctx.fillStyle = obj?.color || "#3B82F6";
  ctx.globalAlpha = opacity;

  if (objectType === "circle") {
    const radius = (Number(obj?.size) || 0) * camera.zoom;
    ctx.beginPath();
    ctx.arc(screenX, screenY, Math.max(1, radius), 0, Math.PI * 2);
    ctx.globalAlpha = opacity * terrainStyle.fillAlpha;
    ctx.fill();
    ctx.globalAlpha = opacity;
    ctx.stroke();
  } else if (objectType === "rect") {
    const width = Math.max(1, (Number(obj?.width) || 0) * camera.zoom);
    const height = Math.max(1, (Number(obj?.height) || 0) * camera.zoom);
    ctx.globalAlpha = opacity * terrainStyle.fillAlpha;
    ctx.fillRect(screenX - width / 2, screenY - height / 2, width, height);
    ctx.globalAlpha = opacity;
    ctx.strokeRect(screenX - width / 2, screenY - height / 2, width, height);
  } else {
    const size = Math.max(1, (Number(obj?.size) || 0) * camera.zoom);
    ctx.beginPath();
    ctx.moveTo(screenX, screenY - size);
    ctx.lineTo(screenX - size, screenY + size);
    ctx.lineTo(screenX + size, screenY + size);
    ctx.closePath();
    ctx.globalAlpha = opacity * terrainStyle.fillAlpha;
    ctx.fill();
    ctx.globalAlpha = opacity;
    ctx.stroke();
  }

  if (showLabel) {
    ctx.setLineDash([]);
    ctx.fillStyle = terrainStyle.labelColor;
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.globalAlpha = opacity;
    const objectLabel = `${terrainType.toUpperCase()} | Z:${Math.round(Number(obj?.z) || 0)} | L:${Math.round(Number(obj?.zLevel) || 0)}`;
    ctx.fillText(
      objectLabel,
      screenX,
      screenY + getObjectRadiusLikeValue(obj) * camera.zoom + 14
    );
  }

  if (!isGhost) {
    drawObjectHPBar(ctx, obj, camera, screenX, screenY);
  }

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
      state.currentZLevel !== prevState.currentZLevel
    );
  },

  draw(ctx, canvas, state) {
    const { camera, mapObjects = [], currentZLevel = 0 } = state;

    if (!camera || !canvas || canvas.width === 0 || canvas.height === 0) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const normalizedCurrentLevel = Math.round(Number(currentZLevel) || 0);
    const sortedObjects = [...mapObjects].sort((a, b) => {
      const levelDiff = getObjectZLevel(a) - getObjectZLevel(b);
      if (levelDiff !== 0) return levelDiff;
      const zDiff = (Number(a?.z) || 0) - (Number(b?.z) || 0);
      if (zDiff !== 0) return zDiff;
      return (
        (TERRAIN_ORDER[normalizeTerrainType(a?.terrainType)] ?? 1) -
        (TERRAIN_ORDER[normalizeTerrainType(b?.terrainType)] ?? 1)
      );
    });

    const lowerLevelObjects = sortedObjects.filter((obj) => getObjectZLevel(obj) < normalizedCurrentLevel);
    const activeObjects = sortedObjects.filter((obj) => getObjectZLevel(obj) === normalizedCurrentLevel);

    lowerLevelObjects.forEach((obj) => {
      const distance = normalizedCurrentLevel - getObjectZLevel(obj);
      drawMapObject(ctx, obj, camera, {
        isGhost: true,
        showLabel: false,
        baseOpacity: getLowerLevelOpacity(distance),
      });
    });

    activeObjects.forEach((obj) => {
      drawMapObject(ctx, obj, camera, {
        isGhost: false,
        showLabel: true,
        baseOpacity: 1,
      });
    });
  },
};
