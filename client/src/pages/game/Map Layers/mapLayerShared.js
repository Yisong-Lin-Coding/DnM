import getMapImage from "../../../handlers/getMapImage";

const TERRAIN_ORDER = {
  floor: 0,
  obstacle: 2,
  wall: 3,
};

export const HEIGHT_UNITS_PER_ZLEVEL = 3;
export const TOP_VISIBLE_FADE_LEVELS = 20;

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

const RESIZE_HANDLE_RADIUS_PX = 8;
const HEIGHT_HANDLE_OFFSET_PX = 32;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const normalizeTerrainType = (value) => {
  const terrainType = String(value || "").trim().toLowerCase();
  if (terrainType === "floor" || terrainType === "wall" || terrainType === "obstacle") {
    return terrainType;
  }
  return "obstacle";
};

const normalizeFloorVisualType = (value) =>
  String(value || "").trim().toLowerCase() === "effect" ? "effect" : "base";

const normalizeLightingDirection = (value = {}) => {
  const x = clamp(Number(value?.x) || 0, -1, 1);
  const y = clamp(Number(value?.y) || 0, -1, 1);
  const magnitude = Math.hypot(x, y);
  if (magnitude <= 1 || magnitude === 0) return { x, y };
  return { x: x / magnitude, y: y / magnitude };
};

const normalizeLightSourceType = (value) =>
  String(value || "").trim().toLowerCase() === "point" ? "point" : "directional";

export const normalizeLighting = (lighting = {}) => {
  const rawSources = Array.isArray(lighting?.sources) ? lighting.sources : [];
  let sources = rawSources.map((entry, index) => normalizeLightingSource(entry, index));

  if (sources.length === 0) {
    if (lighting?.source && typeof lighting.source === "object" && !Array.isArray(lighting.source)) {
      sources = [normalizeLightingSource(lighting.source, 0)];
    } else {
      sources = [normalizeLightingSource({ type: "directional", x: 0.5, y: -0.5 }, 0)];
    }
  }

  return {
    enabled:        lighting?.enabled !== false,
    ambient:        clamp(Number(lighting?.ambient)        || 0.24, 0, 0.95),
    shadowEnabled:  lighting?.shadowEnabled !== false,
    shadowStrength: clamp(Number(lighting?.shadowStrength) || 0.62, 0, 1),
    shadowSoftness: clamp(Number(lighting?.shadowSoftness) || 0.55, 0, 1),
    shadowLength:   clamp(Number(lighting?.shadowLength)   || 0.9,  0, 2),
    shadowBlend:    clamp(Number(lighting?.shadowBlend)    || 0.68, 0, 1),
    sources,
  };
};

const normalizeLightingSource = (raw = {}, fallbackIndex = 0) => {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const type = normalizeLightSourceType(source.type);

  const normalized = {
    id: String(source.id || `light_${fallbackIndex + 1}`).trim() || `light_${fallbackIndex + 1}`,
    name:
      String(source.name || (type === "point" ? `Lamp ${fallbackIndex + 1}` : `Light ${fallbackIndex + 1}`))
        .trim() || (type === "point" ? `Lamp ${fallbackIndex + 1}` : `Light ${fallbackIndex + 1}`),
    type,
    enabled:   source.enabled !== false,
    intensity: clamp(Number(source.intensity) || 0.8, 0, 2),
    blend:     clamp(Number(source.blend)     || 0.7, 0, 1),
    color:     String(source.color || "#ffffff").trim() || "#ffffff",
  };

  if (type === "point") {
    normalized.worldX  = Number(source.worldX ?? source.position?.x) || 0;
    normalized.worldY  = Number(source.worldY ?? source.position?.y) || 0;
    normalized.range   = Math.max(10, Number(source.range) || 420);
    normalized.zLevel  = Math.round(Number(source.zLevel) || 0);
  }
 else {
    const direction = normalizeLightingDirection({ x: source.x, y: source.y });
    normalized.x = direction.x;
    normalized.y = direction.y;
  }

  return normalized;
};

export const getObjectZLevel          = (obj) => Math.round(Number(obj?.zLevel) || 0);
export const getObjectElevationHeight = (obj) => Math.max(0, Number(obj?.elevationHeight) || 0);

export const getObjectRadiusLikeValue = (obj) => {
  if (!obj) return 20;
  if (String(obj.type || "circle").toLowerCase() === "rect") {
    return Math.max(20, Math.max(Number(obj.width) || 0, Number(obj.height) || 0) / 2);
  }
  return Math.max(20, Number(obj.size) || 0);
};

export const getObjectBoundsWorld = (obj = {}) => {
  const objectType = String(obj?.type || "circle").toLowerCase();
  const x = Number(obj?.x) || 0;
  const y = Number(obj?.y) || 0;

  if (objectType === "rect") {
    const halfWidth  = Math.max(1, Number(obj?.width)  || 0) / 2;
    const halfHeight = Math.max(1, Number(obj?.height) || 0) / 2;
    return { minX: x - halfWidth, maxX: x + halfWidth, minY: y - halfHeight, maxY: y + halfHeight };
  }

  const radius = Math.max(1, Number(obj?.size) || 0);
  return { minX: x - radius, maxX: x + radius, minY: y - radius, maxY: y + radius };
};

export const worldToScreen = (camera, worldX, worldY) => ({
  x: worldX * camera.zoom - camera.x,
  y: worldY * camera.zoom - camera.y,
});

const getObjectRotationRad = (obj) => (Number(obj?.rotation) || 0) * (Math.PI / 180);

export const getLowerLevelOpacity = (distance) => {
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

export const resolveFloorVisualType = (obj, floorTypesByID) => {
  if (normalizeTerrainType(obj?.terrainType) !== "floor") return "base";
  const floorTypeID = String(obj?.floorTypeId || "").trim();
  const floorType   = floorTypesByID.get(floorTypeID);
  return normalizeFloorVisualType(floorType?.floorVisualType || floorType?.visualType);
};

const getTerrainSortOrder = (obj, floorTypesByID) => {
  const terrain = normalizeTerrainType(obj?.terrainType);
  if (terrain !== "floor") return TERRAIN_ORDER[terrain] ?? 2;
  return resolveFloorVisualType(obj, floorTypesByID) === "effect" ? 1 : 0;
};

const getTerrainStyle = (terrainType, floorVisualType = "base") => {
  const base = TERRAIN_STYLE[terrainType] || TERRAIN_STYLE.obstacle;
  if (terrainType === "floor" && floorVisualType === "effect") return { ...base, ...FLOOR_EFFECT_STYLE };
  return base;
};

// Add this function near drawObjectHPBar
const drawHatchOverlay = (ctx, obj, camera) => {
  ctx.save();
  const objectType = String(obj?.type || "circle").toLowerCase();
  const screenX    = (Number(obj?.x) || 0) * camera.zoom - camera.x;
  const screenY    = (Number(obj?.y) || 0) * camera.zoom - camera.y;
  const rotation   = getObjectRotationRad(obj);

  if (rotation && objectType !== "circle") {
    ctx.translate(screenX, screenY);
    ctx.rotate(rotation);
  }

  // Clip to the object's shape
  ctx.beginPath();
  if (objectType === "circle") {
    const radius = Math.max(1, (Number(obj?.size) || 0) * camera.zoom);
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
  } else if (objectType === "rect") {
    const w = Math.max(1, (Number(obj?.width)  || 0) * camera.zoom);
    const h = Math.max(1, (Number(obj?.height) || 0) * camera.zoom);
    if (rotation) {
      ctx.rect(-w / 2, -h / 2, w, h);
    } else {
      ctx.rect(screenX - w / 2, screenY - h / 2, w, h);
    }
  } else {
    const s = Math.max(1, (Number(obj?.size) || 0) * camera.zoom);
    if (rotation) {
      ctx.moveTo(0, -s);
      ctx.lineTo(-s, s);
      ctx.lineTo(s, s);
      ctx.closePath();
    } else {
      ctx.moveTo(screenX,     screenY - s);
      ctx.lineTo(screenX - s, screenY + s);
      ctx.lineTo(screenX + s, screenY + s);
      ctx.closePath();
    }
  }
  ctx.clip();

  // Diagonal stripes across the bounding box
  let x0 = 0;
  let y0 = 0;
  let x1 = 0;
  let y1 = 0;

  if (objectType === "rect") {
    const w = Math.max(1, (Number(obj?.width)  || 0) * camera.zoom);
    const h = Math.max(1, (Number(obj?.height) || 0) * camera.zoom);
    if (rotation) {
      x0 = -w / 2;
      x1 = w / 2;
      y0 = -h / 2;
      y1 = h / 2;
    } else {
      x0 = screenX - w / 2;
      x1 = screenX + w / 2;
      y0 = screenY - h / 2;
      y1 = screenY + h / 2;
    }
  } else {
    const s = Math.max(1, (Number(obj?.size) || 0) * camera.zoom);
    if (rotation && objectType !== "circle") {
      x0 = -s;
      x1 = s;
      y0 = -s;
      y1 = s;
    } else {
      const bounds = getObjectBoundsWorld(obj);
      x0 = bounds.minX * camera.zoom - camera.x;
      y0 = bounds.minY * camera.zoom - camera.y;
      x1 = bounds.maxX * camera.zoom - camera.x;
      y1 = bounds.maxY * camera.zoom - camera.y;
    }
  }

  const w = x1 - x0;
  const h = y1 - y0;
  const step = 9;

  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  for (let i = -(h + w); i < w + h; i += step) {
    ctx.moveTo(x0 + i,     y0);
    ctx.lineTo(x0 + i + h, y1);
  }
  ctx.stroke();
  ctx.restore();
};

const drawObjectHPBar = (ctx, obj, camera, screenX, screenY) => {
  const maxHP = Number(obj?.maxHP);
  const hp    = Number(obj?.hp);
  if (!Number.isFinite(maxHP) || maxHP <= 0 || !Number.isFinite(hp)) return;

  const ratio  = Math.max(0, Math.min(1, hp / maxHP));
  const width  = Math.max(18, Math.min(72, getObjectRadiusLikeValue(obj) * camera.zoom * 1.4));
  const height = 6;
  const y      = screenY - getObjectRadiusLikeValue(obj) * camera.zoom - 14;
  const x      = screenX - width / 2;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = ratio > 0.4 ? "#22c55e" : ratio > 0.15 ? "#f59e0b" : "#ef4444";
  ctx.fillRect(x, y, width * ratio, height);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth   = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
};

const MAP_IMAGE_CACHE = new Map();
const normalizeMapAssetKey = (value) => String(value || "").trim().toLowerCase();

const getCachedMapImage = (mapAssetKey) => {
  const key = normalizeMapAssetKey(mapAssetKey);
  if (!key) return null;

  const existing = MAP_IMAGE_CACHE.get(key);
  if (existing) return existing.status === "ready" ? existing.image : null;

  const source = getMapImage(key);
  if (!source) { MAP_IMAGE_CACHE.set(key, { status: "missing", image: null }); return null; }
  if (typeof Image === "undefined") { MAP_IMAGE_CACHE.set(key, { status: "error", image: null }); return null; }

  const image = new Image();
  const entry = { status: "loading", image };
  MAP_IMAGE_CACHE.set(key, entry);
  image.onload  = () => { entry.status = "ready"; };
  image.onerror = () => { entry.status = "error"; };
  image.src = source;
  return null;
};

const drawRectMapImage = (ctx, obj, camera, image) => {
  if (!image) return null;
  const screenX = (Number(obj?.x) || 0) * camera.zoom - camera.x;
  const screenY = (Number(obj?.y) || 0) * camera.zoom - camera.y;
  const width   = Math.max(1, (Number(obj?.width)  || 0) * camera.zoom);
  const height  = Math.max(1, (Number(obj?.height) || 0) * camera.zoom);
  const rotation = getObjectRotationRad(obj);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (rotation) {
    ctx.translate(screenX, screenY);
    ctx.rotate(rotation);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
  } else {
    ctx.drawImage(image, screenX - width / 2, screenY - height / 2, width, height);
  }
  ctx.restore();
  return { screenX, screenY };
};

export const drawShape = (ctx, obj, camera, style = {}) => {
  const screenX    = (Number(obj?.x) || 0) * camera.zoom - camera.x;
  const screenY    = (Number(obj?.y) || 0) * camera.zoom - camera.y;
  const objectType = String(obj?.type || "circle").toLowerCase();
  const fill       = style.fill !== false;
  const stroke     = style.stroke !== false;
  const rotation   = getObjectRotationRad(obj);

  if (objectType === "circle") {
    const radius = (Number(obj?.size) || 0) * camera.zoom;
    ctx.beginPath();
    ctx.arc(screenX, screenY, Math.max(1, radius), 0, Math.PI * 2);
    if (fill)   ctx.fill();
    if (stroke) ctx.stroke();
    return { screenX, screenY };
  }

  if (objectType === "rect") {
    const width  = Math.max(1, (Number(obj?.width)  || 0) * camera.zoom);
    const height = Math.max(1, (Number(obj?.height) || 0) * camera.zoom);
    if (rotation) {
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(rotation);
      if (fill)   ctx.fillRect(  -width / 2, -height / 2, width, height);
      if (stroke) ctx.strokeRect(-width / 2, -height / 2, width, height);
      ctx.restore();
    } else {
      if (fill)   ctx.fillRect(  screenX - width / 2, screenY - height / 2, width, height);
      if (stroke) ctx.strokeRect(screenX - width / 2, screenY - height / 2, width, height);
    }
    return { screenX, screenY };
  }

  const size = Math.max(1, (Number(obj?.size) || 0) * camera.zoom);
  if (rotation) {
    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(-size, size);
    ctx.lineTo(size, size);
    ctx.closePath();
    if (fill)   ctx.fill();
    if (stroke) ctx.stroke();
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.moveTo(screenX,        screenY - size);
    ctx.lineTo(screenX - size, screenY + size);
    ctx.lineTo(screenX + size, screenY + size);
    ctx.closePath();
    if (fill)   ctx.fill();
    if (stroke) ctx.stroke();
  }
  return { screenX, screenY };
};


// ═════════════════════════════════════════════════════════════════════════════
// RAY CAST SHADOW ENGINE
// ─────────────────────────────────────────────────────────────────────────────
//
// POINT LIGHT SHADOW STRATEGY — "fill then cut":
//
//   Step 1. Paint the full shadow disk (dark radial gradient inside range circle).
//           This treats the entire light range as shadow to begin with.
//
//   Step 2. Cut out (destination-out) the VISIBILITY POLYGON — the region the
//           light actually reaches.
//
//   Result: shadow exists only where light can't reach. Winding order of the
//           polygon is irrelevant because destination-out uses alpha, not path
//           orientation. This replaces the previous evenodd approach which was
//           fragile due to canvas's Y-axis flip inverting polygon winding.
//
// DIRECTIONAL LIGHT SHADOWS — shadow volumes:
//   Find edges facing the light, extrude them away from the light direction.
//
// ═════════════════════════════════════════════════════════════════════════════


// ─── 1. OBJECT → SEGMENTS ────────────────────────────────────────────────────
const MAX_CIRCLE_SEGMENTS = 32;

const getObjectSegmentsWorld = (obj, circleSegmentsBase = 16) => {
  const objectType = String(obj?.type || "circle").toLowerCase();
  const cx = Number(obj?.x) || 0;
  const cy = Number(obj?.y) || 0;
  const rotation = getObjectRotationRad(obj);
  const cos = rotation ? Math.cos(rotation) : 1;
  const sin = rotation ? Math.sin(rotation) : 0;
  const segs = [];

  const buildPolySegs = (pts) => {
    for (let i = 0; i < pts.length; i++) segs.push([pts[i], pts[(i + 1) % pts.length]]);
  };

  const rotatePoint = (x, y) => ({
    x: cx + x * cos - y * sin,
    y: cy + x * sin + y * cos,
  });

  if (objectType === "rect") {
    const hw = Math.max(1, Number(obj?.width)  || 0) / 2;
    const hh = Math.max(1, Number(obj?.height) || 0) / 2;
    if (rotation) {
      buildPolySegs([
        rotatePoint(-hw, -hh),
        rotatePoint(hw, -hh),
        rotatePoint(hw, hh),
        rotatePoint(-hw, hh),
      ]);
    } else {
      buildPolySegs([
        { x: cx - hw, y: cy - hh }, { x: cx + hw, y: cy - hh },
        { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy + hh },
      ]);
    }
    return segs;
  }

  if (objectType === "circle") {
    const r = Math.max(1, Number(obj?.size) || 0);
    const n = Math.min(MAX_CIRCLE_SEGMENTS, Math.max(circleSegmentsBase, Math.ceil(r * 0.15)));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    buildPolySegs(pts);
    return segs;
  }

  const s = Math.max(1, Number(obj?.size) || 0);
  if (rotation) {
    buildPolySegs([
      rotatePoint(0, -s),
      rotatePoint(-s, s),
      rotatePoint(s, s),
    ]);
  } else {
    buildPolySegs([{ x: cx, y: cy - s }, { x: cx - s, y: cy + s }, { x: cx + s, y: cy + s }]);
  }
  return segs;
};

// ─── 2. MATH ─────────────────────────────────────────────────────────────────
const cross2d = (ax, ay, bx, by) => ax * by - ay * bx;

const raySegmentT = (ox, oy, dx, dy, ax, ay, bx, by) => {
  const rx = bx - ax, ry = by - ay;
  const denom = cross2d(dx, dy, rx, ry);
  if (Math.abs(denom) < 1e-10) return Infinity;
  const tx = ax - ox, ty = ay - oy;
  const t = cross2d(tx, ty, rx, ry) / denom;
  const u = cross2d(tx, ty, dx, dy) / denom;
  if (t < -1e-8 || u < -1e-8 || u > 1 + 1e-8) return Infinity;
  return Math.max(0, t);
};

const castRay = (ox, oy, dx, dy, segments, maxRange) => {
  let nearest = maxRange;
  for (const [a, b] of segments) {
    const t = raySegmentT(ox, oy, dx, dy, a.x, a.y, b.x, b.y);
    if (t < nearest) nearest = t;
  }
  return { x: ox + dx * nearest, y: oy + dy * nearest };
};

const castRayBeyond = (ox, oy, dx, dy, segments, maxRange, minT = 0.1) => {
  let nearest = maxRange;
  for (const [a, b] of segments) {
    const t = raySegmentT(ox, oy, dx, dy, a.x, a.y, b.x, b.y);
    if (t > minT && t < nearest) nearest = t;
  }
  return nearest;
};

// ─── 3. VISIBILITY POLYGON ───────────────────────────────────────────────────
// Returns world-space points sorted by angle. Camera transform NOT applied
// here so results can be cached and re-mapped at draw time.
const computeVisibilityPolygon = (lx, ly, segments, range) => {
  const ANGLE_EPSILON = 0.0002;
  const pad = 2;

  const bx0 = lx - range - pad, by0 = ly - range - pad;
  const bx1 = lx + range + pad, by1 = ly + range + pad;

  const boundary = [
    [{ x: bx0, y: by0 }, { x: bx1, y: by0 }],
    [{ x: bx1, y: by0 }, { x: bx1, y: by1 }],
    [{ x: bx1, y: by1 }, { x: bx0, y: by1 }],
    [{ x: bx0, y: by1 }, { x: bx0, y: by0 }],
  ];

  const allSegs = [...segments, ...boundary];
  const angles  = [];

  for (const [a, b] of allSegs) {
    for (const pt of [a, b]) {
      const dx = pt.x - lx, dy = pt.y - ly;
      if (dx * dx + dy * dy > range * range * 1.5) continue;
      const base = Math.atan2(dy, dx);
      angles.push(base - ANGLE_EPSILON, base, base + ANGLE_EPSILON);
    }
  }

  angles.sort((a, b) => a - b);

  const points = [];
  for (const angle of angles) {
    const hit = castRay(lx, ly, Math.cos(angle), Math.sin(angle), allSegs, range + pad);
    points.push({ angle, x: hit.x, y: hit.y });
  }

  return points; // world-space {angle, x, y}[]
};

// ─── 4. POINT LIGHT SHADOW ───────────────────────────────────────────────────
const drawPointLightRaycastShadow = (ctx, lightSource, allSegments, camera, lighting, opacity) => {
  if (!lightSource.enabled) return;

  const zoom      = camera.zoom;
  const lx        = Number(lightSource.worldX) || 0;
  const ly        = Number(lightSource.worldY) || 0;
  const range     = Math.max(10, Number(lightSource.range) || 420);
  const intensity = clamp(Number(lightSource.intensity) || 0.8, 0, 2);
  const blend     = clamp(Number(lightSource.blend)     || 0.7, 0, 1);

  const worldPoints = computeVisibilityPolygon(lx, ly, allSegments, range);
  if (worldPoints.length < 3) return;

  // World → screen at draw time (not baked into polygon).
  const sp  = worldPoints.map((pt) => ({ x: pt.x * zoom - camera.x, y: pt.y * zoom - camera.y }));
  const lsx = lx * zoom - camera.x;
  const lsy = ly * zoom - camera.y;
  const screenRange = range * zoom;

  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  const off = document.createElement("canvas");
  off.width = W; off.height = H;
  const oc = off.getContext("2d");

  const baseAlpha = clamp(lighting.shadowStrength * blend * intensity * opacity * 0.72, 0, 0.88);

  // ── STEP A: fill the entire range disk with shadow gradient ──────────────
  const grad = oc.createRadialGradient(lsx, lsy, 0, lsx, lsy, screenRange);
  grad.addColorStop(0,    `rgba(0,0,0,${baseAlpha})`);
  grad.addColorStop(0.6,  `rgba(0,0,0,${baseAlpha * 0.9})`);
  grad.addColorStop(0.88, `rgba(0,0,0,${baseAlpha * 0.4})`);
  grad.addColorStop(1,    "rgba(0,0,0,0)");

  oc.beginPath();
  oc.arc(lsx, lsy, screenRange, 0, Math.PI * 2);
  oc.fillStyle = grad;
  oc.fill();

  // ── STEP B: cut out the visibility polygon (the lit area) ────────────────
  // destination-out erases whatever was painted in STEP A inside the polygon.
  // Winding order does not matter — destination-out is alpha-driven only.
  oc.globalCompositeOperation = "destination-out";
  oc.beginPath();
  oc.moveTo(sp[0].x, sp[0].y);
  for (let i = 1; i < sp.length; i++) oc.lineTo(sp[i].x, sp[i].y);
  oc.closePath();
  oc.fill();

  // ── Composite shadow onto the shadow layer ───────────────────────────────
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(off, 0, 0);
  ctx.restore();
};

// ─── 5. DIRECTIONAL LIGHT ────────────────────────────────────────────────────
const drawDirectionalShadowVolumes = (ctx, obj, camera, lightSource, lighting, opacity, otherSegs) => {
  if (!lightSource.enabled) return;

  const objectHeight = getObjectElevationHeight(obj) * 10;
  if (objectHeight <= 0) return;

  const zoom        = camera.zoom;
  const lightX      = Number(lightSource.x) || 0;
  const lightY      = Number(lightSource.y) || 0;
  const lightLength = Math.hypot(lightX, lightY);
  const shadowDirX  = lightLength > 0 ? -lightX / lightLength : 0;
  const shadowDirY  = lightLength > 0 ? -lightY / lightLength : 0;
  const tilt        = lightLength > 0 ? Math.abs(lightY / lightLength) : 1;

  if (tilt > 0.96) {
    ctx.save();
    ctx.fillStyle   = "#000000";
    ctx.globalAlpha = clamp((objectHeight / 420) * 0.15 * opacity * lighting.shadowStrength, 0.01, 0.18);
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur  = Math.round(4 * lighting.shadowSoftness * zoom);
    drawShape(ctx, obj, camera, { fill: true, stroke: false });
    ctx.restore();
    return;
  }

  const intensity     = clamp(Number(lightSource.intensity) || 0.8, 0, 2);
  const blend         = clamp(Number(lightSource.blend)     || 0.7, 0, 1);
  const maxWorldReach = objectHeight * Math.pow(lightLength, 1.2) * (0.5 + intensity * 0.6) * lighting.shadowLength;
  const baseAlpha     = clamp((objectHeight / 200) * opacity * lighting.shadowStrength * blend * tilt * 0.5, 0.02, 0.45);
  const blurPx        = Math.round(2 + maxWorldReach * 0.03 * lighting.shadowSoftness);

  const segs = getObjectSegmentsWorld(obj);
  ctx.save();
  ctx.fillStyle   = "#000000";
  ctx.globalAlpha = baseAlpha;
  if (blurPx > 0) { ctx.shadowColor = "#000000"; ctx.shadowBlur = blurPx; }

  for (const [a, b] of segs) {
    const normalX = b.y - a.y, normalY = -(b.x - a.x);
    if (normalX * shadowDirX + normalY * shadowDirY <= 1e-8) continue;

    const objectSize = Math.max(obj.width || obj.size || 1, 1);
    const minT = Math.min(0.5, objectSize * 0.25);
    const tA = otherSegs ? castRayBeyond(a.x, a.y, shadowDirX, shadowDirY, otherSegs, maxWorldReach, minT) : maxWorldReach;
    const tB = otherSegs ? castRayBeyond(b.x, b.y, shadowDirX, shadowDirY, otherSegs, maxWorldReach, minT) : maxWorldReach;

    ctx.beginPath();
    ctx.moveTo(a.x * zoom - camera.x,                       a.y * zoom - camera.y);
    ctx.lineTo(b.x * zoom - camera.x,                       b.y * zoom - camera.y);
    ctx.lineTo((b.x + shadowDirX * tB) * zoom - camera.x,  (b.y + shadowDirY * tB) * zoom - camera.y);
    ctx.lineTo((a.x + shadowDirX * tA) * zoom - camera.x,  (a.y + shadowDirY * tA) * zoom - camera.y);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
};

// ─── 6. SHADOW LAYER ─────────────────────────────────────────────────────────
export const drawRaycastShadowLayer = (ctx, allSolids, camera, lighting, opacity = 1) => {
  if (!lighting?.enabled || !lighting?.shadowEnabled) return;
  if (!Array.isArray(lighting?.sources) || lighting.sources.length === 0) return;
  if (!allSolids || allSolids.length === 0) return;

  const segsByIndex = allSolids.map((solid) => getObjectSegmentsWorld(solid));

  lighting.sources.forEach((source) => {
    if (!source?.enabled || source.type !== "directional") return; // only directional

    allSolids.forEach((solid, i) => {
      const otherSegs = segsByIndex.filter((_, j) => j !== i).flat();
      drawDirectionalShadowVolumes(ctx, solid, camera, source, lighting, opacity, otherSegs);
    });
  });
};


// ─── 7. PER-OBJECT SHADOWS ───────────────────────────────────────────────────
export const drawObjectMultiSourceShadows = (ctx, obj, camera, lighting, opacity = 1) => {
  if (!lighting?.enabled || !lighting?.shadowEnabled) return;
  if (!Array.isArray(lighting?.sources) || lighting.sources.length === 0) return;

  lighting.sources.forEach((lightSource) => {
    if (!lightSource?.enabled) return;

    if (lightSource.type === "directional") {
      drawDirectionalShadowVolumes(ctx, obj, camera, lightSource, lighting, opacity, null);
    }

    if (lightSource.type === "point") {
      const objX   = Number(obj?.x)  || 0;
      const objY   = Number(obj?.y)  || 0;
      const lightX = Number(lightSource?.worldX) || 0;
      const lightY = Number(lightSource?.worldY) || 0;
      const range  = Math.max(10, Number(lightSource?.range) || 420);
      const dx = objX - lightX, dy = objY - lightY;
      const distance = Math.hypot(dx, dy);
      if (distance > range) return;

      const falloff = Math.max(0, 1 - distance / range);
      if (falloff < 0.05) return;

      const intensity  = clamp(Number(lightSource?.intensity) || 0.8, 0, 2);
      const blend      = clamp(Number(lightSource?.blend)     || 0.7, 0, 1);
      const shadowDirX = distance > 0 ? dx / distance : 0;
      const shadowDirY = distance > 0 ? dy / distance : 0;

      drawDirectionalShadowVolumes(ctx, obj, camera, {
        enabled: true,
        x: -shadowDirX,
        y: -shadowDirY,
        intensity: intensity * falloff,
        blend,
      }, lighting, opacity);
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// EVERYTHING BELOW THIS LINE IS UNCHANGED FROM THE ORIGINAL FILE
// ─────────────────────────────────────────────────────────────────────────────

export const drawResizeGuides = (ctx, obj, camera) => {
  const bounds       = getObjectBoundsWorld(obj);
  const topLeft      = worldToScreen(camera, bounds.minX, bounds.minY);
  const topRight     = worldToScreen(camera, bounds.maxX, bounds.minY);
  const bottomLeft   = worldToScreen(camera, bounds.minX, bounds.maxY);
  const bottomRight  = worldToScreen(camera, bounds.maxX, bounds.maxY);
  const topCenter    = worldToScreen(camera, (bounds.minX + bounds.maxX) / 2, bounds.minY);
  const heightHandle = { x: topCenter.x, y: topCenter.y - HEIGHT_HANDLE_OFFSET_PX };

  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "#93c5fd";
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(topLeft.x, topLeft.y, Math.max(1, topRight.x - topLeft.x), Math.max(1, bottomLeft.y - topLeft.y));

  ctx.setLineDash([]);
  [topLeft, topRight, bottomRight, bottomLeft].forEach((handle) => {
    ctx.beginPath();
    ctx.fillStyle   = "#ffffff";
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth   = 2;
    ctx.arc(handle.x, handle.y, RESIZE_HANDLE_RADIUS_PX, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.beginPath();
  ctx.moveTo(topCenter.x, topCenter.y);
  ctx.lineTo(heightHandle.x, heightHandle.y);
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  ctx.fillStyle   = "#fbbf24";
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth   = 1.5;
  ctx.fillRect(  heightHandle.x - 7, heightHandle.y - 7, 14, 14);
  ctx.strokeRect(heightHandle.x - 7, heightHandle.y - 7, 14, 14);
  ctx.restore();
};

export const drawMapObject = (ctx, obj, camera, options = {}) => {
const {
    isGhost          = false,
    isTallFromBelow  = false,
    depthDarkness    = 0,
    showLabel        = true,
    baseOpacity      = 1,
    isSelected       = false,
    floorVisualType  = "base",
    lighting         = null,
    drawShadows      = true,
  } = options;


  const opacity      = Math.max(0.05, Math.min(1, baseOpacity));
  const terrainType  = normalizeTerrainType(obj?.terrainType);
  const terrainStyle = getTerrainStyle(terrainType, floorVisualType);
  const terrainLabel = terrainType === "floor" && floorVisualType === "effect" ? "FLOOR FX" : terrainType.toUpperCase();
  const mapAssetKey      = normalizeMapAssetKey(obj?.mapAssetKey);
  const objectType       = String(obj?.type || "circle").toLowerCase();
  const mapImage         = objectType === "rect" ? getCachedMapImage(mapAssetKey) : null;
  const isMapImageObject = Boolean(mapImage);
  const objectHeight     = Math.round(getObjectElevationHeight(obj));

  ctx.save();

  if (drawShadows && !isGhost && lighting) {
    drawObjectMultiSourceShadows(ctx, obj, camera, lighting, opacity);
  }

  ctx.strokeStyle = terrainStyle.strokeColor;
  ctx.lineWidth   = terrainStyle.lineWidth;
  ctx.setLineDash(terrainStyle.lineDash);
  ctx.fillStyle   = obj?.color || "#3B82F6";
  ctx.globalAlpha = opacity * terrainStyle.fillAlpha;
  const point = isMapImageObject
    ? drawRectMapImage(ctx, obj, camera, mapImage)
    : drawShape(ctx, obj, camera, { fill: true, stroke: false });
  ctx.globalAlpha = opacity;
  drawShape(ctx, obj, camera, { fill: false, stroke: true });

  if (isSelected) {
    ctx.setLineDash([]);
    ctx.lineWidth   = Math.max(4, terrainStyle.lineWidth + 2);
    ctx.strokeStyle = "#FDE047";
    drawShape(ctx, obj, camera, { fill: false, stroke: true });
  }

  if (showLabel && point) {
    ctx.setLineDash([]);
    ctx.fillStyle   = terrainStyle.labelColor;
    ctx.font        = "12px Arial";
    ctx.textAlign   = "center";
    ctx.globalAlpha = opacity;
    const objectLabelType = mapAssetKey ? `MAP:${mapAssetKey}` : terrainLabel;
    ctx.fillText(
      `${objectLabelType} | Z:${Math.round(Number(obj?.z) || 0)} | L:${Math.round(Number(obj?.zLevel) || 0)} | H:${objectHeight}`,
      point.screenX,
      point.screenY + getObjectRadiusLikeValue(obj) * camera.zoom + 14
    );
  }

  if (!isGhost && point) drawObjectHPBar(ctx, obj, camera, point.screenX, point.screenY);

  // Tall-from-below indicator: hatch pattern + distinct dashed border
if (isTallFromBelow && point) {
    drawHatchOverlay(ctx, obj, camera);
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth   = 2.5;
    ctx.strokeStyle = "#60A5FA";
    ctx.globalAlpha = 0.9;
    drawShape(ctx, obj, camera, { fill: false, stroke: true });
    ctx.restore();
  }

  // Depth darkening — only for objects whose top is below the current floor.
  // depthDarkness 0 = top just below current (nearly clear), 1 = fully dark.
  if (depthDarkness > 0 && point) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.96, depthDarkness);
    ctx.fillStyle   = "#000000";
    drawShape(ctx, obj, camera, { fill: true, stroke: false });
    ctx.restore();
  }



  ctx.restore();

};

export const drawBlockedMovePreview = (ctx, obj, camera) => {
  if (!obj || !camera) return;
  const point = {
    screenX: (Number(obj?.x) || 0) * camera.zoom - camera.x,
    screenY: (Number(obj?.y) || 0) * camera.zoom - camera.y,
  };
  ctx.save();
  ctx.strokeStyle = "#ef4444";
  ctx.fillStyle   = "rgba(239,68,68,0.16)";
  ctx.lineWidth   = 3;
  ctx.setLineDash([8, 6]);
  ctx.globalAlpha = 0.95;
  drawShape(ctx, obj, camera, { fill: true, stroke: true });
  ctx.setLineDash([]);
  ctx.fillStyle = "#fecaca";
  ctx.font      = "11px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Collision", point.screenX, point.screenY - getObjectRadiusLikeValue(obj) * camera.zoom - 10);
  ctx.restore();
};

const buildMapRenderData = (state = {}, options = {}) => {
  const mapObjects = Array.isArray(options?.mapObjects)
    ? options.mapObjects
    : Array.isArray(state?.mapObjects)
    ? state.mapObjects
    : [];
  const floorTypes   = Array.isArray(state?.floorTypes)  ? state.floorTypes  : [];
  const floorTypesByID   = buildFloorTypesByID(floorTypes);
  const currentZLevel    = Math.round(Number(state?.currentZLevel) || 0);
  const minVisibleLowerLevel = currentZLevel >= 0 ? 0 : currentZLevel;
  const selectedMapObjectID  = String(state?.selectedMapObjectID ?? "");

  const sortedObjects = [...mapObjects].sort((a, b) => {
    const levelDiff = getObjectZLevel(a) - getObjectZLevel(b);
    if (levelDiff !== 0) return levelDiff;
    const zDiff = (Number(a?.z) || 0) - (Number(b?.z) || 0);
    if (zDiff !== 0) return zDiff;
    return getTerrainSortOrder(a, floorTypesByID) - getTerrainSortOrder(b, floorTypesByID);
  });

 const lowerLevelObjects = sortedObjects.filter((obj) => {
    const level = getObjectZLevel(obj);
    return level < currentZLevel && level >= minVisibleLowerLevel;
  });
  const activeObjects = sortedObjects.filter((obj) => getObjectZLevel(obj) === currentZLevel);

  // Objects on lower levels whose elevation height is tall enough to reach
  // the current z-level. Every HEIGHT_UNITS_PER_ZLEVEL of height = 1 z-level.
  // e.g. a wall with height 6 on zLevel 0 will appear on zLevel 1 and 2.
  const tallObjectsFromBelow = sortedObjects.filter((obj) => {
    const level = getObjectZLevel(obj);
    if (level >= currentZLevel) return false;
    if (level < minVisibleLowerLevel) return false;
    const elevHeight = getObjectElevationHeight(obj);
    const topZLevel  = level + Math.floor(elevHeight / HEIGHT_UNITS_PER_ZLEVEL);
    return topZLevel >= currentZLevel;
  });

  // Top visible from above: zLevel below current, top is entirely below current floor,
  // but within TOP_VISIBLE_FADE_LEVELS floors so it hasn't faded out completely.
  const topVisibleObjects = sortedObjects.filter((obj) => {
    const level = getObjectZLevel(obj);
    if (level >= currentZLevel) return false;
    if (normalizeTerrainType(obj?.terrainType) === "floor") return false;
    const elevHeight = getObjectElevationHeight(obj);
    const topZLevel  = level + Math.floor(elevHeight / HEIGHT_UNITS_PER_ZLEVEL);
    if (topZLevel >= currentZLevel) return false;
    return (currentZLevel - topZLevel) <= TOP_VISIBLE_FADE_LEVELS;
  });



return {
    camera:              state?.camera || null,
    floorTypesByID,
    currentZLevel,
    selectedMapObjectID,
    blockedMovePreview:  state?.blockedMovePreview || null,
    showResizeHandles:   Boolean(state?.showResizeHandles),
    lowerLevelFloors:    lowerLevelObjects.filter((obj) => normalizeTerrainType(obj?.terrainType) === "floor"),
    lowerLevelSolids:    lowerLevelObjects.filter((obj) => normalizeTerrainType(obj?.terrainType) !== "floor"),
    activeFloors:        activeObjects.filter((obj) => normalizeTerrainType(obj?.terrainType) === "floor"),
    activeSolids:        activeObjects.filter((obj) => normalizeTerrainType(obj?.terrainType) !== "floor"),
    activeObjects,
    selectedActiveObject: activeObjects.find((obj) => String(obj?.id ?? "") === selectedMapObjectID) || null,
    // Solids from lower levels that are tall enough to be visible on this floor.
    // Floors are never tall enough to poke through — only walls and obstacles.
    tallSolidsFromBelow: tallObjectsFromBelow.filter((obj) => normalizeTerrainType(obj?.terrainType) !== "floor"),
    topVisibleSolids:    topVisibleObjects,

  };

};

export const getMapRenderData = (state = {}, frame = null, options = {}) => {
  if (!frame || typeof frame !== "object") return buildMapRenderData(state, options);
  if (!frame.cache || typeof frame.cache !== "object") frame.cache = {};
  const cacheKey = String(options?.cacheKey || "mapRenderData");
  if (frame.cache[cacheKey]) return frame.cache[cacheKey];
  const data = buildMapRenderData(state, options);
  frame.cache[cacheKey] = data;
  return data;
};

export const shouldRedrawMapLayer = (state, prevState, options = {}) => {
  const {
    includeLighting = false,
    includeSelection = false,
    includeOverlay = false,
    includeVisibility = false,
    includeGeometry = false,
  } = options;
  const c = state?.camera, p = prevState?.camera;
  if (!c || !p) return true;
  if (c.x !== p.x || c.y !== p.y || c.zoom !== p.zoom) return true;
  if (state.mapObjects    !== prevState.mapObjects)    return true;
  if (includeGeometry && state.mapGeometry !== prevState.mapGeometry) return true;
  if (includeVisibility && state.visibleMapObjects !== prevState.visibleMapObjects) return true;
  if (state.floorTypes    !== prevState.floorTypes)    return true;
  if (state.currentZLevel !== prevState.currentZLevel) return true;
  if (includeSelection && state.selectedMapObjectID !== prevState.selectedMapObjectID) return true;
  if (includeOverlay) {
    if (state.blockedMovePreview !== prevState.blockedMovePreview) return true;
    if (state.showResizeHandles  !== prevState.showResizeHandles)  return true;
  }
  if (includeLighting && state.lighting !== prevState.lighting) return true;
  return false;
};
