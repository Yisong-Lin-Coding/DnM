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

const isPointInPolygon = (x, y, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
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

// ─── DIRECTIONAL LIGHT ───────────────────────────
const drawDirectionalLight = (ctx, width, height, source, shadowPolygons, camera) => {
  const { off } = getScratchCanvases(width, height);
  const oc = off.getContext("2d");
  oc.setTransform(1, 0, 0, 1, 0, 0);
  
  // 1. Fill with light color (intensity determines alpha)
  oc.globalCompositeOperation = "source-over";
  const rgb = hexToRgb(source.color);
  // Directional light intensity usually acts as a base lift. 
  // We map intensity to alpha: 0.8 intensity -> 0.8 alpha removal from darkness.
  const alpha = clamp(source.intensity * 0.8, 0, 1);
  oc.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
  oc.fillRect(0, 0, width, height);

  // 2. Cut out shadows (destination-out)
  // Shadows preserve the underlying darkness (by removing the light we just drew)
  oc.globalCompositeOperation = "destination-out";
  oc.fillStyle = "rgba(0,0,0,1)";
  (shadowPolygons || []).forEach(poly => {
    oc.beginPath();
    const start = worldToScreen(camera, poly[0].x, poly[0].y);
    oc.moveTo(start.x, start.y);
    for (let i = 1; i < poly.length; i++) {
      const p = worldToScreen(camera, poly[i].x, poly[i].y);
      oc.lineTo(p.x, p.y);
    }
    oc.closePath();
    oc.fill();
  });

  // 3. Apply to main canvas (remove darkness where lit)
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(off, 0, 0);
};

// Helper for worldToScreen inside this file if not imported
const worldToScreen = (camera, wx, wy) => ({
  x: wx * camera.zoom - camera.x,
  y: wy * camera.zoom - camera.y
});

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

    // ── Draw Point Lights (using server polygons) ─────────────────────────
    const lightingPolygons = state?.lightingPolygons || {};
    const currentZLevel = Math.round(Number(state?.currentZLevel) || 0);

    lighting.sources.forEach((source) => {
      if (!source.enabled || source.type !== "point") return;

      const lightZLevel = Math.round(Number(source.zLevel) || 0);
      if (lightZLevel !== currentZLevel) return;

      const worldPoints = lightingPolygons[source.id];
      if (!worldPoints || worldPoints.length < 3) return;
      drawPointLight(ctx, width, height, source, worldPoints, camera);
    });

    // ── Directional lights (using server shadow polygons) ─────────────────
    lighting.sources.forEach((source) => {
      if (!source.enabled || source.type !== "directional") return;

      // Directional lights store an array of polygons (one per obstacle)
      const shadowPolygons = lightingPolygons[source.id];
      // Even if no shadows (empty array), we still draw the light
      drawDirectionalLight(ctx, width, height, source, shadowPolygons, camera);
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

// ─── LIGHT CALCULATION UTILITY ────────────────────
export const calculateLightAtPoint = (worldX, worldY, state) => {
  const lighting = normalizeLighting(state?.lighting || {});
  if (!lighting.enabled) return 1.0;

  const lightingPolygons = state?.lightingPolygons || {};
  const currentZLevel = Math.round(Number(state?.currentZLevel) || 0);
  // Base brightness from ambient (1 - ambientAlpha)
  let brightness = 1 - clamp(lighting.ambient, 0, 1);

  // 1. Point Lights (with shadow checks)
  for (const source of lighting.sources) {
    if (!source.enabled || source.type !== "point") continue;
    if (Math.round(Number(source.zLevel) || 0) !== currentZLevel) continue;

    const dx = worldX - source.worldX;
    const dy = worldY - source.worldY;
    const dist = Math.hypot(dx, dy);
    if (dist > source.range) continue;

    // Check if point is inside the pre-computed visibility polygon
    const polygon = lightingPolygons[source.id];
    if (!polygon || !isPointInPolygon(worldX, worldY, polygon)) continue;

    // Calculate intensity falloff (approximating the visual gradient stops)
    const t = dist / source.range;
    let falloff = 0;
    if (t < 0.25) falloff = 1.0 - (t / 0.25) * 0.25;
    else if (t < 0.55) falloff = 0.75 - ((t - 0.25) / 0.3) * 0.45;
    else if (t < 0.8) falloff = 0.3 - ((t - 0.55) / 0.25) * 0.22;
    else falloff = 0.08 - ((t - 0.8) / 0.2) * 0.08;

    const lightAlpha = clamp(source.intensity * falloff, 0, 1);
    // "Screen" blend mode logic: Brightness increases asymptotically to 1
    brightness = 1 - (1 - brightness) * (1 - lightAlpha);
  }

  // 2. Directional Lights (Global illumination)
  for (const source of lighting.sources) {
    if (!source.enabled || source.type !== "directional") continue;
    
    // Check if point is inside any shadow polygon for this light
    const shadows = lightingPolygons[source.id] || [];
    const inShadow = shadows.some(poly => isPointInPolygon(worldX, worldY, poly));

    if (!inShadow) {
      const lightAlpha = clamp(source.intensity * 0.8, 0, 1);
      brightness = 1 - (1 - brightness) * (1 - lightAlpha);
    }
  }

  return clamp(brightness, 0, 1);
};
