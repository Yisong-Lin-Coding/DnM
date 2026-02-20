import getMapImage from "../../../handlers/getMapImage";

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
  return {
    x: x / magnitude,
    y: y / magnitude,
  };
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
    ambient:        clamp(Number(lighting?.ambient)        ?? 0.24, 0, 0.95),
    shadowEnabled:  lighting?.shadowEnabled !== false,
    shadowStrength: clamp(Number(lighting?.shadowStrength) ?? 0.62, 0, 1),
    shadowSoftness: clamp(Number(lighting?.shadowSoftness) ?? 0.55, 0, 1),
    shadowLength:   clamp(Number(lighting?.shadowLength)   ?? 0.9,  0, 2),
    shadowBlend:    clamp(Number(lighting?.shadowBlend)    ?? 0.68, 0, 1),
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
    enabled: source.enabled !== false,
    intensity: clamp(Number(source.intensity) ?? 0.8, 0, 2),
    blend:     clamp(Number(source.blend)     ?? 0.7, 0, 1),
    color: String(source.color || "#ffffff").trim() || "#ffffff",
  };

  if (type === "point") {
    normalized.worldX = Number(source.worldX ?? source.position?.x) || 0;
    normalized.worldY = Number(source.worldY ?? source.position?.y) || 0;
    normalized.range  = Math.max(10, Number(source.range) || 420);
  } else {
    const direction = normalizeLightingDirection({ x: source.x, y: source.y });
    normalized.x = direction.x;
    normalized.y = direction.y;
  }

  return normalized;
};

export const getObjectZLevel = (obj) => Math.round(Number(obj?.zLevel) || 0);

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

export const worldToScreen = (camera, worldX, worldY) => ({
  x: worldX * camera.zoom - camera.x,
  y: worldY * camera.zoom - camera.y,
});

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
  if (terrain !== "floor") {
    return TERRAIN_ORDER[terrain] ?? 2;
  }
  const floorVisualType = resolveFloorVisualType(obj, floorTypesByID);
  return floorVisualType === "effect" ? 1 : 0;
};

const getTerrainStyle = (terrainType, floorVisualType = "base") => {
  const base = TERRAIN_STYLE[terrainType] || TERRAIN_STYLE.obstacle;
  if (terrainType === "floor" && floorVisualType === "effect") {
    return { ...base, ...FLOOR_EFFECT_STYLE };
  }
  return base;
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

const normalizeMapAssetKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getCachedMapImage = (mapAssetKey) => {
  const key = normalizeMapAssetKey(mapAssetKey);
  if (!key) return null;

  const existing = MAP_IMAGE_CACHE.get(key);
  if (existing) {
    return existing.status === "ready" ? existing.image : null;
  }

  const source = getMapImage(key);
  if (!source) {
    MAP_IMAGE_CACHE.set(key, { status: "missing", image: null });
    return null;
  }

  if (typeof Image === "undefined") {
    MAP_IMAGE_CACHE.set(key, { status: "error", image: null });
    return null;
  }

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

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, screenX - width / 2, screenY - height / 2, width, height);
  return { screenX, screenY };
};

export const drawShape = (ctx, obj, camera, style = {}) => {
  const screenX    = (Number(obj?.x) || 0) * camera.zoom - camera.x;
  const screenY    = (Number(obj?.y) || 0) * camera.zoom - camera.y;
  const objectType = String(obj?.type || "circle").toLowerCase();
  const fill       = style.fill !== false;
  const stroke     = style.stroke !== false;

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
    if (fill)   ctx.fillRect(  screenX - width / 2, screenY - height / 2, width, height);
    if (stroke) ctx.strokeRect(screenX - width / 2, screenY - height / 2, width, height);
    return { screenX, screenY };
  }

  const size = Math.max(1, (Number(obj?.size) || 0) * camera.zoom);
  ctx.beginPath();
  ctx.moveTo(screenX,          screenY - size);
  ctx.lineTo(screenX - size,   screenY + size);
  ctx.lineTo(screenX + size,   screenY + size);
  ctx.closePath();
  if (fill)   ctx.fill();
  if (stroke) ctx.stroke();
  return { screenX, screenY };
};


// ═════════════════════════════════════════════════════════════════════════════
// RAY CAST SHADOW ENGINE
// ─────────────────────────────────────────────────────────────────────────────
//
// How it works (the simple version for a new programmer):
//
//   Imagine standing at a lamp in a dark room. You swing a flashlight beam
//   360°. Every time the beam hits a wall, it stops. The shape of all the
//   lit floor — formed by those stopping points — is the "visibility polygon."
//   Everything OUTSIDE that polygon is in shadow.
//
//   POINT LIGHTS  → full 2-D ray-cast visibility polygon.
//
//   DIRECTIONAL LIGHTS (sun) → "shadow volume" per edge: find which faces of
//   each object point toward the sun, then extrude those edges away from the
//   sun like a stretched shadow on the floor.
//
// Key terms:
//   segment  — a line from point A to point B (one wall / edge)
//   ray      — a line from the light in one direction (infinite to start)
//   t        — how far along the ray the hit is (t=0 is the light, t=1 is
//               one "unit" away)
//   angle    — direction of the ray measured in radians from the right (+X)
//   visibility polygon — the exact lit-area polygon, shaped by all the walls
//
// ═════════════════════════════════════════════════════════════════════════════


// ─── 1. CONVERT OBJECTS TO LINE SEGMENTS ─────────────────────────────────────
//
// Every solid object becomes a list of [A, B] edge pairs in WORLD coordinates.
// Circles are approximated as regular N-sided polygons (the eye can't tell the
// difference at typical zoom levels, and 16 sides is plenty).

/**
 * Returns all edges of `obj` as pairs of world-space {x, y} points.
 *
 * Supports: rect, circle (approximated), triangle (and any unknown type).
 *
 * @param {object} obj
 * @param {number} [circleSegments=16]  How many polygon sides to use for circles.
 *                                      Higher = smoother but more rays to cast.
 * @returns {Array<[{x,y},{x,y}]>}
 */
const getObjectSegmentsWorld = (obj, circleSegments = 16) => {
  const objectType = String(obj?.type || "circle").toLowerCase();
  const cx = Number(obj?.x) || 0;
  const cy = Number(obj?.y) || 0;
  const segs = [];

  // Helper: turn an array of corner points into closed polygon segments.
  // e.g. [A, B, C, D] → [[A,B], [B,C], [C,D], [D,A]]
  const buildPolySegs = (pts) => {
    for (let i = 0; i < pts.length; i++) {
      segs.push([pts[i], pts[(i + 1) % pts.length]]);
    }
  };

  if (objectType === "rect") {
    const hw = Math.max(1, Number(obj?.width)  || 0) / 2;
    const hh = Math.max(1, Number(obj?.height) || 0) / 2;
    // Corners in clockwise order (top-left → top-right → bottom-right → bottom-left).
    // CW winding matters for the directional shadow normal calculation below.
    buildPolySegs([
      { x: cx - hw, y: cy - hh },
      { x: cx + hw, y: cy - hh },
      { x: cx + hw, y: cy + hh },
      { x: cx - hw, y: cy + hh },
    ]);
    return segs;
  }

  if (objectType === "circle") {
    const r = Math.max(1, Number(obj?.size) || 0);
    const pts = [];
    for (let i = 0; i < circleSegments; i++) {
      const a = (i / circleSegments) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    buildPolySegs(pts);
    return segs;
  }

  // Triangle fallback — also used for any unrecognised shape.
  const s = Math.max(1, Number(obj?.size) || 0);
  buildPolySegs([
    { x: cx,     y: cy - s },
    { x: cx - s, y: cy + s },
    { x: cx + s, y: cy + s },
  ]);
  return segs;
};


// ─── 2. MATHS PRIMITIVES ─────────────────────────────────────────────────────

// The 2-D cross product of two vectors (ax,ay) and (bx,by).
//
// Think of it as: "how much does B veer to the left of A?"
//   positive → B is to the left of A
//   negative → B is to the right
//   zero     → B is parallel to A
//
// We use this to solve the system of equations for ray-segment intersection.
const cross2d = (ax, ay, bx, by) => ax * by - ay * bx;

/**
 * Finds the intersection of a ray with a line segment.
 *
 * Ray: starts at (ox, oy) and travels in direction (dx, dy).
 * Segment: runs from (ax, ay) to (bx, by).
 *
 * We parameterize both:
 *   Any point on the ray     = (ox, oy) + t * (dx, dy)  — t ≥ 0
 *   Any point on the segment = (ax, ay) + u * ((bx-ax), (by-ay))  — 0 ≤ u ≤ 1
 *
 * Setting them equal and solving gives us t and u.
 * If both are in range → they intersect.
 *
 * @returns {number}  Parameter `t` along the ray where the hit occurs,
 *                    or `Infinity` if no intersection.
 */
const raySegmentT = (ox, oy, dx, dy, ax, ay, bx, by) => {
  const rx    = bx - ax;
  const ry    = by - ay;
  const denom = cross2d(dx, dy, rx, ry);

  // If denom ≈ 0 the ray and segment are parallel — no intersection.
  if (Math.abs(denom) < 1e-10) return Infinity;

  const tx = ax - ox;
  const ty = ay - oy;

  const t = cross2d(tx, ty, rx, ry) / denom; // distance along ray
  const u = cross2d(tx, ty, dx, dy) / denom; // position along segment (0..1)

  // t < 0 means the hit is behind the ray origin.
  // u outside [0,1] means the hit is off the ends of the segment.
  if (t < -1e-8 || u < -1e-8 || u > 1 + 1e-8) return Infinity;

  return Math.max(0, t);
};

/**
 * Fires a ray from (ox,oy) in direction (dx,dy) and returns the world-space
 * point where it hits the nearest segment, or the `maxRange` endpoint if
 * nothing is in the way.
 *
 * Used by the visibility polygon: rays start at the light source and travel
 * outward, so every legitimate hit has t > 0.
 */
const castRay = (ox, oy, dx, dy, segments, maxRange) => {
  let nearest = maxRange;

  for (const [a, b] of segments) {
    const t = raySegmentT(ox, oy, dx, dy, a.x, a.y, b.x, b.y);
    if (t < nearest) nearest = t;
  }

  return { x: ox + dx * nearest, y: oy + dy * nearest };
};

/**
 * Like castRay but ignores hits closer than `minT`.
 *
 * Used by directional shadow clipping: the ray starts ON the surface of the
 * casting object, so its own edges register a hit at t ≈ 0.  Skipping those
 * near-zero hits means "don't clip the shadow against the object that casts it."
 *
 * A minT of 0.5 world-units is large enough to clear self-hits on any wall
 * thickness we use (walls are never thinner than 1 world-unit), and small
 * enough never to skip a legitimate nearby occluder.
 *
 * @returns {number} world-space distance t to the first real occluder, or maxRange
 */
const castRayBeyond = (ox, oy, dx, dy, segments, maxRange, minT = 0.5) => {
  let nearest = maxRange;

  for (const [a, b] of segments) {
    const t = raySegmentT(ox, oy, dx, dy, a.x, a.y, b.x, b.y);
    if (t > minT && t < nearest) nearest = t;
  }

  return nearest;
};


// ─── 3. COMPUTE VISIBILITY POLYGON ───────────────────────────────────────────
//
// This is the core of the ray-cast algorithm.
//
// The key insight: we only need to cast rays at CORNER ANGLES, not at every
// degree. Between any two corners, the nearest wall doesn't change, so the
// lit boundary is a straight line — no extra rays needed.
//
// We cast THREE rays per corner: one dead-on, one a hair to the left, one a
// hair to the right. Without the offset rays, we'd miss the thin slivers of
// light that peek through at wall edges.
//
// A boundary box at the light's range edge ensures every ray terminates within
// a finite area even when it misses all obstacles.

/**
 * @param {number}   lx         Light world X
 * @param {number}   ly         Light world Y
 * @param {Array}    segments   All obstacle segments: [ [{x,y},{x,y}], ... ]
 * @param {number}   range      World-unit radius
 * @param {object}   camera     { x, y, zoom }
 * @returns {Array}  Screen-space points [{x,y}], already sorted by angle,
 *                   forming the illuminated polygon.
 */
const computeVisibilityPolygon = (lx, ly, segments, range, camera) => {
  const ANGLE_EPSILON = 0.0001; // radians — tiny offset to capture wall edges

  // ── Build a bounding box just past the light's range ─────────────────────
  // Every ray must hit *something*, so we add four walls at the range edge.
  // Without this, a ray aimed into empty space would travel infinitely.
  const pad = 2; // small extra margin so the box itself casts no visible edge
  const bx0 = lx - range - pad;
  const by0 = ly - range - pad;
  const bx1 = lx + range + pad;
  const by1 = ly + range + pad;

  const boundaryCorners = [
    { x: bx0, y: by0 }, // top-left
    { x: bx1, y: by0 }, // top-right
    { x: bx1, y: by1 }, // bottom-right
    { x: bx0, y: by1 }, // bottom-left
  ];
  const boundarySegs = boundaryCorners.map((c, i) => [
    c,
    boundaryCorners[(i + 1) % 4],
  ]);

  // All segments: obstacle walls + bounding box
  const allSegs = [...segments, ...boundarySegs];

  // ── Collect every corner angle ────────────────────────────────────────────
  const angles = [];
  for (const [a, b] of allSegs) {
    for (const pt of [a, b]) {
      const distSq = (pt.x - lx) ** 2 + (pt.y - ly) ** 2;
      // Skip corners that are way beyond the light's reach (saves rays)
      if (distSq > (range * 1.6) ** 2) continue;

      const base = Math.atan2(pt.y - ly, pt.x - lx);
      angles.push(base - ANGLE_EPSILON);
      angles.push(base);
      angles.push(base + ANGLE_EPSILON);
    }
  }

  // Sort angles so we sweep around the light in order
  angles.sort((a, b) => a - b);

  // ── Cast a ray at every angle ─────────────────────────────────────────────
  const zoom   = camera.zoom;
  const camX   = camera.x;
  const camY   = camera.y;

  return angles.map((angle) => {
    const dx  = Math.cos(angle);
    const dy  = Math.sin(angle);
    const hit = castRay(lx, ly, dx, dy, allSegs, range + pad);

    // Convert world-space hit → screen-space for drawing
    return {
      angle,
      x: hit.x * zoom - camX,
      y: hit.y * zoom - camY,
    };
  });
};


// ─── 4. POINT LIGHT → RAY-CAST SHADOW ────────────────────────────────────────
//
// The shadow area = the light's range disc  MINUS  the visibility polygon.
//
// We draw both in the same canvas path and use the EVEN-ODD fill rule:
//
//   Sub-path 1 — range circle, any winding.
//   Sub-path 2 — visibility polygon, opposite winding so even-odd treats it
//                as a hole.
//
// Even-odd fill counting for any point P:
//   P outside circle                       → 0 crossings → transparent  ✓
//   P inside circle, outside vis-poly      → 1 crossing  → shadow       ✓
//   P inside circle AND inside vis-poly    → 2 crossings → transparent  ✓
//
// CRITICAL SIZING RULE
// ────────────────────
// The circle radius and the boundary box used inside computeVisibilityPolygon
// must agree exactly.  If the circle is even 1px larger than the vis-poly can
// reach, that rim is never punched out → permanent ring of shadow.
//
// computeVisibilityPolygon clips rays at (range + BOUNDARY_PAD) world units.
// The circle is drawn at range * zoom screen pixels.
// Since (range + BOUNDARY_PAD) * zoom > range * zoom, the vis-poly always
// extends a bit beyond the circle → the circle is always fully covered. ✓
//
// DO NOT add any extra pixels to the circle radius.  Even "+ 1" will break it.
//
// Edge softness is applied with ctx.shadowBlur AFTER the fill so it does not
// change the effective size of either sub-path.

const drawPointLightRaycastShadow = (
  ctx,
  lightSource,
  allSegments,
  camera,
  lighting,
  opacity
) => {
  if (!lightSource.enabled) return;

  const zoom      = camera.zoom;
  const lx        = Number(lightSource.worldX) || 0;
  const ly        = Number(lightSource.worldY) || 0;
  const range     = Math.max(10, Number(lightSource.range) || 420);
  const intensity = clamp(Number(lightSource.intensity) ?? 0.8, 0, 2);
  const blend     = clamp(Number(lightSource.blend)     ?? 0.7, 0, 1);

  const visPoints = computeVisibilityPolygon(lx, ly, allSegments, range, camera);
  if (visPoints.length < 3) return;

  const shadowAlpha = clamp(
    lighting.shadowStrength * blend * intensity * opacity * 0.78,
    0, 0.9
  );

  // Screen-space light position.
  // Circle radius MUST exactly match what computeVisibilityPolygon can cover.
  const lsx         = lx * zoom - camera.x;
  const lsy         = ly * zoom - camera.y;
  const screenRange = range * zoom; // ← no extra padding here

  // Softness via shadowBlur (applied post-fill, doesn't affect path geometry)
  const blurPx = Math.round(lighting.shadowSoftness * 6);

  ctx.save();
  ctx.fillStyle   = `rgba(0,0,0,${shadowAlpha})`;
  if (blurPx > 0) {
    ctx.shadowColor = `rgba(0,0,0,${shadowAlpha})`;
    ctx.shadowBlur  = blurPx;
  }

  ctx.beginPath();

  // Sub-path 1: range circle
  ctx.arc(lsx, lsy, screenRange, 0, Math.PI * 2, false);

  // Sub-path 2: visibility polygon in reverse order
  // The winding direction is opposite to the circle so even-odd treats the
  // overlap as empty (lit).  Reversing the sorted-by-angle array achieves this.
  const last = visPoints[visPoints.length - 1];
  ctx.moveTo(last.x, last.y);
  for (let i = visPoints.length - 2; i >= 0; i--) {
    ctx.lineTo(visPoints[i].x, visPoints[i].y);
  }
  ctx.closePath();

  ctx.fill("evenodd");
  ctx.restore();
};


// ─── 5. DIRECTIONAL LIGHT → SHADOW VOLUMES WITH WALL CLIPPING ───────────────
//
// For a parallel-rays sun/moon, we find which edges of each solid face the
// light (using outward normals), then extrude those edges in the shadow
// direction to form shadow quads on the floor.
//
// WALL CLIPPING (the new part):
// Before, we extruded every edge a fixed `shadowLength` and the shadow would
// pass straight through any blocking wall.  Now, for each shadow edge endpoint
// we cast a ray from that endpoint in the shadow direction through every OTHER
// object's segments.  We cap the extrusion at the nearest hit so the shadow
// stops when it reaches another wall.
//
//    Wall A casts shadow →→→[ Wall B ]
//                         ↑ shadow stops here
//
// The ray is cast using castRayBeyond (minT = 0.5 world-units) which skips
// the edge's own surface.  Without that skip, the edge endpoint would
// immediately "hit itself" and all shadows would have length zero.
//
// @param otherSegs  Segments belonging to every solid EXCEPT this one.
//                   Must be world-space.  Built by drawRaycastShadowLayer.

const drawDirectionalShadowVolumes = (
  ctx,
  obj,
  camera,
  lightSource,
  lighting,
  opacity,
  otherSegs   // ← new: segments of all OTHER solids for clipping
) => {
  if (!lightSource.enabled) return;

  const objectHeight = getObjectElevationHeight(obj) * 10;
  if (objectHeight <= 0) return;

  const zoom      = camera.zoom;
  const lightX    = Number(lightSource.x) || 0;
  const lightY    = Number(lightSource.y) || 0;
  const lightTilt = clamp(Math.hypot(lightX, lightY), 0, 1);

  if (lightTilt < 0.04) {
    ctx.save();
    ctx.fillStyle   = "#000000";
    ctx.globalAlpha = clamp(
      (objectHeight / 420) * 0.15 * opacity * lighting.shadowStrength *
        clamp(Number(lightSource.blend) ?? 0.7, 0, 1),
      0.01, 0.18
    );
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur  = Math.round(4 * lighting.shadowSoftness * zoom);
    drawShape(ctx, obj, camera, { fill: true, stroke: false });
    ctx.restore();
    return;
  }

  const intensity = clamp(Number(lightSource.intensity) ?? 0.8, 0, 2);
  const blend     = clamp(Number(lightSource.blend)     ?? 0.7, 0, 1);

  // Shadow direction is away from the light (unit vector in world space)
  const shadowDirX = -lightX / lightTilt;
  const shadowDirY = -lightY / lightTilt;

  // Maximum shadow reach in WORLD units (divide out the zoom factor)
  const maxWorldReach =
    objectHeight *
    Math.pow(lightTilt, 1.2) *
    (0.5 + intensity * 0.6) *
    lighting.shadowLength;

  const baseAlpha = clamp(
    (objectHeight / 200) * opacity * lighting.shadowStrength * blend * lightTilt * 0.5,
    0.02, 0.45
  );

  const blurPx = Math.round(2 + maxWorldReach * 0.03 * lighting.shadowSoftness);

  const segs = getObjectSegmentsWorld(obj);

  ctx.save();
  ctx.fillStyle   = "#000000";
  ctx.globalAlpha = baseAlpha;
  if (blurPx > 0) {
    ctx.shadowColor = "#000000";
    ctx.shadowBlur  = blurPx;
  }

  for (const [a, b] of segs) {
    // Outward normal of this edge (CW polygon → outward points away from interior)
    //   normalX =  (B.y - A.y)
    //   normalY = -(B.x - A.x)
    const normalX =  (b.y - a.y);
    const normalY = -(b.x - a.x);

    // Positive dot product → this face sees the light → it casts a shadow
    const facingLight = normalX * lightX + normalY * lightY;
    if (facingLight <= 0) continue;

    // ── Clip shadow length against other walls ──────────────────────────
    // Cast a ray from each world-space edge endpoint in the shadow direction.
    // The ray is allowed to travel at most maxWorldReach world-units.
    // castRayBeyond skips hits within 0.5 world-units of the start so the
    // edge doesn't clip against its own surface.
    const tA = (otherSegs && otherSegs.length > 0)
      ? castRayBeyond(a.x, a.y, shadowDirX, shadowDirY, otherSegs, maxWorldReach)
      : maxWorldReach;
    const tB = (otherSegs && otherSegs.length > 0)
      ? castRayBeyond(b.x, b.y, shadowDirX, shadowDirY, otherSegs, maxWorldReach)
      : maxWorldReach;

    // ── Convert to screen space ─────────────────────────────────────────
    // Edge base vertices
    const ax = a.x * zoom - camera.x;
    const ay = a.y * zoom - camera.y;
    const bx = b.x * zoom - camera.x;
    const by = b.y * zoom - camera.y;

    // Extruded (shadow-tip) vertices — clamped to the nearest occluding wall
    const ax2 = (a.x + shadowDirX * tA) * zoom - camera.x;
    const ay2 = (a.y + shadowDirY * tA) * zoom - camera.y;
    const bx2 = (b.x + shadowDirX * tB) * zoom - camera.x;
    const by2 = (b.y + shadowDirY * tB) * zoom - camera.y;

    // Draw the shadow quad: base-edge A → B, then shadow-tip B' → A'
    ctx.beginPath();
    ctx.moveTo(ax,  ay);
    ctx.lineTo(bx,  by);
    ctx.lineTo(bx2, by2);
    ctx.lineTo(ax2, ay2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
};


// ─── 6. PUBLIC ENTRY POINT FOR THE SHADOW LAYER ──────────────────────────────
//
// Call this ONCE with the complete set of solid objects for a z-level.
// Never call per-object — ray casting and directional wall-clipping both need
// global scene geometry.

export const drawRaycastShadowLayer = (
  ctx,
  allSolids,
  camera,
  lighting,
  opacity = 1
) => {
  if (!lighting?.enabled || !lighting?.shadowEnabled) return;
  if (!Array.isArray(lighting?.sources) || lighting.sources.length === 0) return;
  if (!allSolids || allSolids.length === 0) return;

  // ── Build per-object segment arrays ONCE ───────────────────────────────
  //
  // We need two things:
  //   allSegments  — flat list used by the point-light visibility polygon
  //   segsByIndex  — parallel array used by directional clipping, where
  //                  segsByIndex[i] holds only the segments of allSolids[i]
  //
  // Keeping per-object arrays means directional shadow clipping can pass
  // "every segment EXCEPT this object's own" to the ray test, preventing
  // a wall from clipping its own shadow at the base.

  const segsByIndex = allSolids.map((solid) => getObjectSegmentsWorld(solid));
  const allSegments = segsByIndex.flat();

  lighting.sources.forEach((source) => {
    if (!source?.enabled) return;

    if (source.type === "point") {
      drawPointLightRaycastShadow(ctx, source, allSegments, camera, lighting, opacity);
      return;
    }

    if (source.type === "directional") {
      allSolids.forEach((solid, i) => {
        // Build occluder list: all segments EXCEPT this solid's own.
        // This prevents the wall from treating its own back-face as a blocker
        // and collapsing its shadow to zero length.
        const otherSegs = [];
        for (let j = 0; j < segsByIndex.length; j++) {
          if (j !== i) {
            for (const seg of segsByIndex[j]) otherSegs.push(seg);
          }
        }
        drawDirectionalShadowVolumes(ctx, solid, camera, source, lighting, opacity, otherSegs);
      });
    }
  });
};


// ─────────────────────────────────────────────────────────────────────────────
// LEGACY PER-OBJECT SHADOW FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
//
// These are kept because drawMapObject (the inline map editor renderer) calls
// drawObjectMultiSourceShadows per-object for the immediate object preview.
// They are NOT used by mapShadowsLayer anymore.
//
// Note that per-object shadows can't do proper ray casting (no global geometry
// knowledge), so they still use the "shadow volume" approach for both light
// types — which is a good approximation for the editor's needs.

const drawObjectShadowFromDirectionalLight = (ctx, obj, camera, lightSource, lighting, opacity = 1) => {
  if (!lightSource.enabled) return;
  const objectHeight = getObjectElevationHeight(obj) * 10;
  if (objectHeight <= 0) return;
  // Legacy path: no otherSegs — shadows won't clip at walls but that's
  // acceptable for the per-object editor preview.
  drawDirectionalShadowVolumes(ctx, obj, camera, lightSource, lighting, opacity, null);
};

const drawObjectShadowFromPointLight = (ctx, obj, camera, lightSource, lighting, opacity = 1) => {
  if (!lightSource.enabled) return;
  const objectHeight = getObjectElevationHeight(obj) * 10;
  if (objectHeight <= 0) return;

  // Fallback: use directional-style shadow volume aimed away from the point light.
  // (True ray casting requires all geometry at once, unavailable here.)
  const zoom   = Number(camera?.zoom) || 1;
  const objX   = Number(obj?.x)  || 0;
  const objY   = Number(obj?.y)  || 0;
  const lightX = Number(lightSource?.worldX) || 0;
  const lightY = Number(lightSource?.worldY) || 0;
  const range  = Math.max(10, Number(lightSource?.range) || 420);

  const dx       = objX - lightX;
  const dy       = objY - lightY;
  const distance = Math.hypot(dx, dy);
  if (distance > range) return;

  const falloff   = Math.max(0, 1 - distance / range);
  if (falloff < 0.05) return;

  const intensity = clamp(Number(lightSource?.intensity) ?? 0.8, 0, 2);
  const blend     = clamp(Number(lightSource?.blend)     ?? 0.7, 0, 1);
  const shadowDirX = distance > 0 ? dx / distance : 0;
  const shadowDirY = distance > 0 ? dy / distance : 0;
  const tilt = falloff;

  // Synthesize a fake directional source pointing away from the light
  const fakeDirectional = {
    enabled:   true,
    x:         -shadowDirX,
    y:         -shadowDirY,
    intensity: intensity * falloff,
    blend,
  };

  drawDirectionalShadowVolumes(ctx, obj, camera, fakeDirectional, lighting, opacity);
};

export const drawObjectMultiSourceShadows = (ctx, obj, camera, lighting, opacity = 1) => {
  if (!lighting?.enabled || !lighting?.shadowEnabled) return;
  if (!Array.isArray(lighting?.sources) || lighting.sources.length === 0) return;

  lighting.sources.forEach((lightSource) => {
    if (!lightSource || !lightSource.enabled) return;
    if (lightSource.type === "directional") {
      drawObjectShadowFromDirectionalLight(ctx, obj, camera, lightSource, lighting, opacity);
      return;
    }
    if (lightSource.type === "point") {
      drawObjectShadowFromPointLight(ctx, obj, camera, lightSource, lighting, opacity);
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
  ctx.strokeRect(
    topLeft.x,
    topLeft.y,
    Math.max(1, topRight.x   - topLeft.x),
    Math.max(1, bottomLeft.y - topLeft.y)
  );

  ctx.setLineDash([]);
  const cornerHandles = [topLeft, topRight, bottomRight, bottomLeft];
  cornerHandles.forEach((handle) => {
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
    isGhost      = false,
    showLabel    = true,
    baseOpacity  = 1,
    isSelected   = false,
    floorVisualType = "base",
    lighting     = null,
    drawShadows  = true,
  } = options;
  const opacity      = Math.max(0.05, Math.min(1, baseOpacity));
  const terrainType  = normalizeTerrainType(obj?.terrainType);
  const terrainStyle = getTerrainStyle(terrainType, floorVisualType);
  const terrainLabel =
    terrainType === "floor" && floorVisualType === "effect"
      ? "FLOOR FX"
      : terrainType.toUpperCase();
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
    const objectLabel = `${objectLabelType} | Z:${Math.round(Number(obj?.z) || 0)} | L:${Math.round(
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
  ctx.fillStyle  = "#fecaca";
  ctx.font       = "11px Arial";
  ctx.textAlign  = "center";
  ctx.fillText(
    "Collision",
    point.screenX,
    point.screenY - getObjectRadiusLikeValue(obj) * camera.zoom - 10
  );
  ctx.restore();
};

const buildMapRenderData = (state = {}) => {
  const mapObjects         = Array.isArray(state?.mapObjects)  ? state.mapObjects  : [];
  const floorTypes         = Array.isArray(state?.floorTypes)  ? state.floorTypes  : [];
  const floorTypesByID     = buildFloorTypesByID(floorTypes);
  const currentZLevel      = Math.round(Number(state?.currentZLevel) || 0);
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

  const lowerLevelFloors  = lowerLevelObjects.filter(
    (obj) => normalizeTerrainType(obj?.terrainType) === "floor"
  );
  const lowerLevelSolids  = lowerLevelObjects.filter(
    (obj) => normalizeTerrainType(obj?.terrainType) !== "floor"
  );
  const activeFloors = activeObjects.filter((obj) => normalizeTerrainType(obj?.terrainType) === "floor");
  const activeSolids = activeObjects.filter((obj) => normalizeTerrainType(obj?.terrainType) !== "floor");
  const selectedActiveObject =
    activeObjects.find((obj) => String(obj?.id ?? "") === selectedMapObjectID) || null;

  return {
    camera: state?.camera || null,
    floorTypesByID,
    currentZLevel,
    selectedMapObjectID,
    blockedMovePreview:  state?.blockedMovePreview  || null,
    showResizeHandles:   Boolean(state?.showResizeHandles),
    lowerLevelFloors,
    lowerLevelSolids,
    activeFloors,
    activeSolids,
    activeObjects,
    selectedActiveObject,
  };
};

export const getMapRenderData = (state = {}, frame = null) => {
  if (!frame || typeof frame !== "object") {
    return buildMapRenderData(state);
  }

  if (!frame.cache || typeof frame.cache !== "object") {
    frame.cache = {};
  }

  if (frame.cache.mapRenderData) {
    return frame.cache.mapRenderData;
  }

  const data = buildMapRenderData(state);
  frame.cache.mapRenderData = data;
  return data;
};

export const shouldRedrawMapLayer = (state, prevState, options = {}) => {
  const {
    includeLighting  = false,
    includeSelection = false,
    includeOverlay   = false,
  } = options;

  const c = state?.camera;
  const p = prevState?.camera;
  if (!c || !p) return true;

  if (c.x !== p.x || c.y !== p.y || c.zoom !== p.zoom) return true;
  if (state.mapObjects   !== prevState.mapObjects)   return true;
  if (state.floorTypes   !== prevState.floorTypes)   return true;
  if (state.currentZLevel !== prevState.currentZLevel) return true;

  if (includeSelection && state.selectedMapObjectID !== prevState.selectedMapObjectID) {
    return true;
  }

  if (includeOverlay) {
    if (state.blockedMovePreview !== prevState.blockedMovePreview) return true;
    if (state.showResizeHandles  !== prevState.showResizeHandles)  return true;
  }

  if (includeLighting && state.lighting !== prevState.lighting) return true;

  return false;
};