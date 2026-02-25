import { shouldRedrawMapLayer } from "./mapLayerShared";

// 7lighting.jsx
// Lighting layer for Michelangelo engine with proper point-light visibility

// ─── DEFAULT LIGHTING ─────────────────────────────
const DEFAULT_LIGHTING = {
  enabled: true,
  ambient: 0.24,
  sources: [
    {
      id: "sun",
      type: "directional",
      enabled: true,
      x: 0.5,
      y: -0.5,
      intensity: 0.8,
      blend: 0.7,
      color: "#ffffff",
    },
  ],
};

// ─── UTILITY FUNCTIONS ────────────────────────────
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const SCRATCH_POOL = {
  off: null,
  tint: null,
  width: 0,
  height: 0,
};

const getScratchCanvases = (width, height) => {
  if (!SCRATCH_POOL.off) SCRATCH_POOL.off = document.createElement("canvas");
  if (!SCRATCH_POOL.tint) SCRATCH_POOL.tint = document.createElement("canvas");
  if (SCRATCH_POOL.width !== width || SCRATCH_POOL.height !== height) {
    SCRATCH_POOL.width = width;
    SCRATCH_POOL.height = height;
    SCRATCH_POOL.off.width = width;
    SCRATCH_POOL.off.height = height;
    SCRATCH_POOL.tint.width = width;
    SCRATCH_POOL.tint.height = height;
  }
  return SCRATCH_POOL;
};

const hexToRgb = (hex) => {
  const normalized = String(hex || "#ffffff").trim();
  const match = normalized.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
};

const normalizeDirectionalVector = (value = {}) => {
  const x = clamp(Number(value?.x) || 0, -1, 1);
  const y = clamp(Number(value?.y) || 0, -1, 1);
  const mag = Math.hypot(x, y);
  if (mag === 0 || mag <= 1) return { x, y };
  return { x: x / mag, y: y / mag };
};

const normalizeTerrainType = (value) =>
  String(value || "obstacle").trim().toLowerCase();

const getObjectRotationRad = (obj) =>
  (Number(obj?.rotation) || 0) * (Math.PI / 180);

// ─── LIGHT SOURCE NORMALIZATION ───────────────────
const normalizeLightingSource = (raw = {}, fallbackIndex = 0) => {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};

  const type =
    String(source.type || "").trim().toLowerCase() === "point"
      ? "point"
      : "directional";

  const normalized = {
    id:
      String(source.id || `light_${fallbackIndex + 1}`).trim() ||
      `light_${fallbackIndex + 1}`,
    type,
    enabled:   source.enabled !== false,
    intensity: clamp(Number(source.intensity) || 0.8, 0, 2),
    blend:     clamp(Number(source.blend)     || 0.7, 0, 1),
    color:     String(source.color || "#ffffff").trim() || "#ffffff",
  };

  if (type === "point") {
    normalized.worldX  = Number(source.worldX ?? source.position?.x) || 0;
    normalized.worldY  = Number(source.worldY ?? source.position?.y) || 0;
    normalized.range   = clamp(Number(source.range) || 420, 10, 5000);
    normalized.zLevel  = Math.round(Number(source.zLevel) || 0);
  }
 else {
    const dir = normalizeDirectionalVector(source);
    normalized.x = dir.x;
    normalized.y = dir.y;
  }

  return normalized;
};

const normalizeLighting = (lighting = {}) => {
  const safe = lighting && typeof lighting === "object" ? lighting : {};
  const rawSources = Array.isArray(safe.sources) ? safe.sources : [];

  let sources = rawSources.map((entry, index) =>
    normalizeLightingSource(entry, index)
  );

  if (sources.length === 0) {
    sources = [normalizeLightingSource({ ...DEFAULT_LIGHTING.sources[0] }, 0)];
  }

  return {
    enabled: safe.enabled !== false,
    ambient: clamp(Number(safe.ambient) || DEFAULT_LIGHTING.ambient, 0, 0.9),
    sources,
  };
};

// ─── RAYCAST / VISIBILITY HELPERS ────────────────
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

export const getObjectSegmentsWorld = (obj, circleSegments = 16) => {
  const objectType = String(obj?.type || "circle").toLowerCase();
  const cx = Number(obj?.x) || 0;
  const cy = Number(obj?.y) || 0;
  const rotation = getObjectRotationRad(obj);
  const cos = rotation ? Math.cos(rotation) : 1;
  const sin = rotation ? Math.sin(rotation) : 0;
  const segs = [];

  const buildPolySegs = (pts) => {
    for (let i = 0; i < pts.length; i++)
      segs.push([pts[i], pts[(i + 1) % pts.length]]);
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
    const r   = Math.max(1, Number(obj?.size) || 0);
    const pts = [];
    for (let i = 0; i < circleSegments; i++) {
      const a = (i / circleSegments) * Math.PI * 2;
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
    buildPolySegs([
      { x: cx, y: cy - s }, { x: cx - s, y: cy + s }, { x: cx + s, y: cy + s },
    ]);
  }
  return segs;
};

// Returns world-space {angle, x, y} points — camera transform applied at draw time.
export const computeVisibilityPolygon = (lx, ly, segments, range) => {
  const ANGLE_EPSILON = 0.0001;
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
      if (dx * dx + dy * dy > range * range * 2.1) continue;
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

const buildObjectsByZLevel = (objects = []) => {
  const byZ = new Map();
  for (const obj of objects) {
    if (normalizeTerrainType(obj?.terrainType) === "floor") continue;
    const zl = Math.round(Number(obj?.zLevel) || 0);
    if (!byZ.has(zl)) byZ.set(zl, []);
    byZ.get(zl).push(obj);
  }
  return byZ;
};

// ─── POINT LIGHT ─────────────────────────────────
//
// Approach:
//   1. Build an offscreen canvas clipped to the visibility polygon.
//   2. Fill it with a radial gradient (bright at source → transparent at range).
//   3. Use destination-out on the main canvas to erase ambient darkness
//      proportionally — fully erased where the light is brightest.
//
// Winding order is irrelevant because destination-out is alpha-driven.
//
const drawPointLight = (ctx, width, height, source, worldPoints, camera) => {
  const sp = worldPoints.map((pt) => ({
    x: pt.x * camera.zoom - camera.x,
    y: pt.y * camera.zoom - camera.y,
  }));
  if (sp.length < 3) return;

  const lsx         = source.worldX * camera.zoom - camera.x;
  const lsy         = source.worldY * camera.zoom - camera.y;
  const screenRange = source.range * camera.zoom;
  const rgb         = hexToRgb(source.color);
  const intensity   = clamp(source.intensity, 0, 2);

  const { off, tint } = getScratchCanvases(width, height);
  const oc = off.getContext("2d");
  oc.setTransform(1, 0, 0, 1, 0, 0);
  oc.globalCompositeOperation = "source-over";
  oc.clearRect(0, 0, width, height);

  // ── Step 1: Fill the full radial gradient (no clip yet) ──────────────────
  // Steeper falloff so walls far from the source receive little light,
  // which prevents the "light extends all the way to the wall" look.
  const gradient = oc.createRadialGradient(lsx, lsy, 0, lsx, lsy, screenRange);
  gradient.addColorStop(0,    `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp(intensity, 0, 1)})`);
  gradient.addColorStop(0.25, `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp(intensity * 0.75, 0, 1)})`);
  gradient.addColorStop(0.55, `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp(intensity * 0.3, 0, 1)})`);
  gradient.addColorStop(0.8,  `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp(intensity * 0.08, 0, 1)})`);
  gradient.addColorStop(1,    `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
  oc.fillStyle = gradient;
  oc.fillRect(0, 0, width, height);

  // ── Step 2: Clip to visibility polygon ───────────────────────────────────
  // destination-in keeps only pixels inside the polygon, preserving
  // the gradient alpha values everywhere else as-is.
  oc.globalCompositeOperation = "destination-in";
  oc.beginPath();
  oc.moveTo(sp[0].x, sp[0].y);
  for (let i = 1; i < sp.length; i++) oc.lineTo(sp[i].x, sp[i].y);
  oc.closePath();
  oc.fillStyle = "rgba(0,0,0,1)";
  oc.fill();

  // ── Step 3: Soft circular edge fade ──────────────────────────────────────
  // A second destination-in multiplies the existing alpha by a radial
  // gradient that goes opaque→transparent near the range boundary.
  // This rounds off the hard polygon edge where it meets the range circle,
  // blending it naturally into the surrounding darkness.
  oc.globalCompositeOperation = "destination-in";
  const softEdge = oc.createRadialGradient(
    lsx, lsy, screenRange * 0.55,
    lsx, lsy, screenRange * 0.97
  );
  softEdge.addColorStop(0, "rgba(0,0,0,1)");
  softEdge.addColorStop(1, "rgba(0,0,0,0)");
  oc.fillStyle = softEdge;
  oc.fillRect(0, 0, width, height);

  // ── Carve lit area out of the ambient darkness layer ─────────────────────
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(off, 0, 0);

  // ── Colored tint (non-white lights only) ─────────────────────────────────
  if (!(rgb.r === 255 && rgb.g === 255 && rgb.b === 255)) {
    const tc = tint.getContext("2d");
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.globalCompositeOperation = "source-over";
    tc.clearRect(0, 0, width, height);

    tc.beginPath();
    tc.moveTo(sp[0].x, sp[0].y);
    for (let i = 1; i < sp.length; i++) tc.lineTo(sp[i].x, sp[i].y);
    tc.closePath();
    tc.clip();

    const tintGrad = tc.createRadialGradient(lsx, lsy, 0, lsx, lsy, screenRange * 0.8);
    const tintStrength = clamp(source.blend * 0.3, 0, 0.45);
    tintGrad.addColorStop(0,   `rgba(${rgb.r},${rgb.g},${rgb.b},${tintStrength})`);
    tintGrad.addColorStop(0.5, `rgba(${rgb.r},${rgb.g},${rgb.b},${tintStrength * 0.4})`);
    tintGrad.addColorStop(1,   `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    tc.fillStyle = tintGrad;
    tc.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = "lighten";
    ctx.drawImage(tint, 0, 0);
  }
};


// ─── LIGHTING LAYER ──────────────────────────────
export const lightingLayer = {
  id: "lighting",
  shouldRedraw(state, prevState) {
    if (!prevState) return true;
    if (state?.lighting?.enabled !== prevState?.lighting?.enabled) return true;
    return shouldRedrawMapLayer(state, prevState, {
      includeLighting: true,
      includeGeometry: true,
    });
  },
  draw(ctx, canvas, state) {
    if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0) return;

    const width  = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Defensive: if state.lighting is missing entirely, still apply ambient darkness
    // using the default so the layer is never invisible in a broken state.
    const lighting = normalizeLighting(state?.lighting ?? DEFAULT_LIGHTING);
    if (!lighting.enabled) return;

    const ambientAlpha = clamp(lighting.ambient, 0, 0.9);
    const camera       = state?.camera || { x: 0, y: 0, zoom: 1 };

    ctx.save();

    // ── Base darkness ─────────────────────────────────────────────────────
    // This is always drawn. If you can't see this dark overlay at all, the
    // lighting canvas isn't being composited onto the scene correctly —
    // check that the layer is registered and rendered above the map layers.
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(0,0,0,${ambientAlpha})`;
    ctx.fillRect(0, 0, width, height);

    // ── Build obstacle segments ───────────────────────────────────────────
    const cache =
      state?.lightingCache && typeof state.lightingCache === "object"
        ? state.lightingCache
        : null;
    const hasPointLights = lighting.sources.some(
      (source) => source.enabled && source.type === "point"
    );

    let objectsByZLevel = new Map();
    let segmentsByZLevel = new Map();
    let polygonCache = cache?.polygons || null;
    let objectsVersion = 0;

    if (hasPointLights) {
      const objects = Array.isArray(state?.mapGeometry)
        ? state.mapGeometry
        : state?.mapObjects || [];

      if (cache) {
        if (cache.objectsRef !== objects) {
          cache.objectsRef = objects;
          cache.objectsVersion = (cache.objectsVersion || 0) + 1;
          cache.objectsByZLevel = null;
          cache.segmentsByZLevel = null;
          cache.polygons = new Map();
        }
        objectsVersion = cache.objectsVersion || 0;
        if (!cache.objectsByZLevel) {
          cache.objectsByZLevel = buildObjectsByZLevel(objects);
        }
        objectsByZLevel = cache.objectsByZLevel;
        if (!cache.segmentsByZLevel) cache.segmentsByZLevel = new Map();
        segmentsByZLevel = cache.segmentsByZLevel;
        if (!cache.polygons) cache.polygons = new Map();
        polygonCache = cache.polygons;
      } else {
        objectsByZLevel = buildObjectsByZLevel(objects);
        segmentsByZLevel = new Map();
      }
    }

    const currentZLevel = Math.round(Number(state?.currentZLevel) || 0);

    lighting.sources.forEach((source) => {
      if (!source.enabled || source.type !== "point") return;

      const lightZLevel = Math.round(Number(source.zLevel) || 0);
      if (lightZLevel !== currentZLevel) return;

      const zLevelObjs = objectsByZLevel.get(lightZLevel) || [];
      let lightSegments = segmentsByZLevel.get(lightZLevel);
      if (!lightSegments) {
        lightSegments = [];
        for (const obj of zLevelObjs) lightSegments.push(...getObjectSegmentsWorld(obj));
        segmentsByZLevel.set(lightZLevel, lightSegments);
      }

      const cacheKey = `${source.worldX}|${source.worldY}|${source.range}|${lightZLevel}|${objectsVersion}`;
      const cached = polygonCache ? polygonCache.get(source.id) : null;
      let worldPoints = cached && cached.key === cacheKey ? cached.points : null;
      if (!worldPoints) {
        worldPoints = computeVisibilityPolygon(
          source.worldX, source.worldY, lightSegments, source.range
        );
        if (polygonCache) polygonCache.set(source.id, { key: cacheKey, points: worldPoints });
      }
      if (!worldPoints || worldPoints.length < 3) return;

      drawPointLight(ctx, width, height, source, worldPoints, camera);
    });



    // ── Directional lights ────────────────────────────────────────────────
    ctx.globalCompositeOperation = "lighten";
    lighting.sources.forEach((source) => {
      if (!source.enabled || source.type !== "directional") return;

      const rgb      = hexToRgb(source.color);
      const strength = clamp(source.intensity * source.blend * 0.4, 0, 1);
      const cx       = width / 2, cy = height / 2;
      const dist     = Math.max(width, height) * 0.8;
      const gradient = ctx.createLinearGradient(
        cx + source.x * dist, cy + source.y * dist,
        cx - source.x * dist, cy - source.y * dist
      );
      const maxLift = clamp(strength, 0.02, 0.9);
      gradient.addColorStop(0,   `rgba(${rgb.r},${rgb.g},${rgb.b},${maxLift})`);
      gradient.addColorStop(0.6, `rgba(${rgb.r},${rgb.g},${rgb.b},${maxLift * 0.4})`);
      gradient.addColorStop(1,   `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    });

    // ── Vignette ──────────────────────────────────────────────────────────
    ctx.globalCompositeOperation = "source-over";
    const vignette = ctx.createRadialGradient(
      width / 2, height / 2, Math.max(10, Math.min(width, height) * 0.22),
      width / 2, height / 2, Math.max(width, height) * 0.95
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, `rgba(0,0,0,${clamp(ambientAlpha * 0.22, 0.02, 0.2)})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  },
};
