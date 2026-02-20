// Lighting layer with COLORED light support

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

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeDirectionalVector = (value = {}) => {
  const x = clamp(Number(value?.x) || 0, -1, 1);
  const y = clamp(Number(value?.y) || 0, -1, 1);
  const magnitude = Math.hypot(x, y);
  if (magnitude === 0 || magnitude <= 1) return { x, y };
  return { x: x / magnitude, y: y / magnitude };
};

const normalizeLightingSource = (raw = {}, fallbackIndex = 0) => {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const type = String(source.type || "").trim().toLowerCase() === "point" ? "point" : "directional";

  const normalized = {
    id:        String(source.id   || `light_${fallbackIndex + 1}`).trim() || `light_${fallbackIndex + 1}`,
    name:      String(source.name || `Light ${fallbackIndex + 1}`).trim() || `Light ${fallbackIndex + 1}`,
    type,
    enabled:   source.enabled !== false,
    intensity: clamp(Number(source.intensity) ?? 0.8, 0, 2),
    blend:     clamp(Number(source.blend)     ?? 0.7, 0, 1),
    color:     String(source.color || "#ffffff").trim() || "#ffffff",
  };

  if (type === "point") {
    normalized.worldX = Number(source.worldX ?? source.position?.x) || 0;
    normalized.worldY = Number(source.worldY ?? source.position?.y) || 0;
    normalized.range  = clamp(Number(source.range) || 420, 10, 5000);
    return normalized;
  }

  const direction = normalizeDirectionalVector(source);
  normalized.x = direction.x;
  normalized.y = direction.y;
  return normalized;
};

const normalizeLighting = (lighting = {}) => {
  const safe = lighting && typeof lighting === "object" ? lighting : {};
  const rawSources = Array.isArray(safe.sources) ? safe.sources : [];
  let sources = rawSources.map((entry, index) => normalizeLightingSource(entry, index));

  if (sources.length === 0) {
    if (safe.source && typeof safe.source === "object" && !Array.isArray(safe.source)) {
      sources = [normalizeLightingSource(safe.source, 0)];
    } else {
      sources = [normalizeLightingSource({ ...DEFAULT_LIGHTING.sources[0] }, 0)];
    }
  }

  return {
    enabled: safe.enabled !== false,
    ambient: clamp(Number(safe.ambient) ?? DEFAULT_LIGHTING.ambient, 0, 0.9),
    sources,
  };
};

// Parse hex color to RGB
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

const drawDirectionalLightContribution = (ctx, width, height, source, ambientAlpha) => {
  const direction = normalizeDirectionalVector(source);
  const tilt      = clamp(Math.hypot(direction.x, direction.y), 0, 1);
  const strength  = clamp(source.intensity * source.blend, 0, 2);
  const rgb       = hexToRgb(source.color);

  if (tilt < 0.02) {
    const overheadLift = clamp(strength * (0.08 + ambientAlpha * 0.22), 0.01, 0.18);
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${overheadLift})`;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const centerX        = width / 2;
  const centerY        = height / 2;
  const sourceDistance = Math.max(width, height) * (0.22 + tilt * 0.82);
  const lightX         = centerX + direction.x * sourceDistance;
  const lightY         = centerY + direction.y * sourceDistance;
  const darkX          = centerX - direction.x * sourceDistance;
  const darkY          = centerY - direction.y * sourceDistance;
  const gradient       = ctx.createLinearGradient(lightX, lightY, darkX, darkY);
  const maxLift        = clamp((0.1 + tilt * 0.85) * strength, 0.02, 0.9);

  gradient.addColorStop(0,    `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp(maxLift * 0.95, 0.01, 0.9)})`);
  gradient.addColorStop(0.58, `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp(maxLift * 0.45, 0.01, 0.7)})`);
  gradient.addColorStop(1,    `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
};

const drawPointLightContribution = (ctx, width, height, camera, source) => {
  const zoom     = Number(camera?.zoom) || 1;
  const camX     = Number(camera?.x)    || 0;
  const camY     = Number(camera?.y)    || 0;
  const centerX  = source.worldX * zoom - camX;
  const centerY  = source.worldY * zoom - camY;
  const radius   = Math.max(8, source.range * zoom);
  const strength = clamp(source.intensity * source.blend, 0, 2);
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  const rgb      = hexToRgb(source.color);

  gradient.addColorStop(0,    `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp(0.95 * strength, 0.02, 0.95)})`);
  gradient.addColorStop(0.62, `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp(0.28 * strength, 0.01, 0.50)})`);
  gradient.addColorStop(1,    `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);

  const minX = Math.max(0, centerX - radius);
  const minY = Math.max(0, centerY - radius);
  const boxW = Math.min(width - minX, radius * 2);
  const boxH = Math.min(height - minY, radius * 2);
  if (boxW <= 0 || boxH <= 0) return;

  ctx.fillStyle = gradient;
  ctx.fillRect(minX, minY, boxW, boxH);
};

export const lightingLayer = {
  id: "lighting",

  shouldRedraw() {
    return true;
  },

  draw(ctx, canvas, state) {
    if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0) return;

    const width  = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const lighting = normalizeLighting(state?.lighting || DEFAULT_LIGHTING);
    if (!lighting.enabled) return;

    const camera       = state?.camera || { x: 0, y: 0, zoom: 1 };
    const ambientAlpha = clamp(lighting.ambient, 0, 0.9);

    ctx.save();

    // Base darkness
    ctx.fillStyle = `rgba(0,0,0,${ambientAlpha})`;
    ctx.fillRect(0, 0, width, height);

    // Carve light out of darkness using destination-out, then add color with lighten
    ctx.globalCompositeOperation = "destination-out";
    lighting.sources.forEach((source) => {
      if (!source?.enabled) return;
      if (String(source.type) === "point") {
        drawPointLightContribution(ctx, width, height, camera, source);
        return;
      }
      drawDirectionalLightContribution(ctx, width, height, source, ambientAlpha);
    });

    // Now add colored light using lighten mode
    ctx.globalCompositeOperation = "lighten";
    lighting.sources.forEach((source) => {
      if (!source?.enabled) return;
      // Only add color if it's not white
      const rgb = hexToRgb(source.color);
      if (rgb.r === 255 && rgb.g === 255 && rgb.b === 255) return;
      
      if (String(source.type) === "point") {
        const zoom     = Number(camera?.zoom) || 1;
        const camX     = Number(camera?.x)    || 0;
        const camY     = Number(camera?.y)    || 0;
        const centerX  = source.worldX * zoom - camX;
        const centerY  = source.worldY * zoom - camY;
        const radius   = Math.max(8, source.range * zoom);
        const strength = clamp(source.intensity * source.blend * 0.3, 0, 1);
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

        gradient.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${strength})`);
        gradient.addColorStop(0.6, `rgba(${rgb.r},${rgb.g},${rgb.b},${strength * 0.3})`);
        gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);

        const minX = Math.max(0, centerX - radius);
        const minY = Math.max(0, centerY - radius);
        const boxW = Math.min(width - minX, radius * 2);
        const boxH = Math.min(height - minY, radius * 2);
        if (boxW > 0 && boxH > 0) {
          ctx.fillStyle = gradient;
          ctx.fillRect(minX, minY, boxW, boxH);
        }
      } else {
        // Directional colored light
        const direction = normalizeDirectionalVector(source);
        const tilt      = clamp(Math.hypot(direction.x, direction.y), 0, 1);
        if (tilt < 0.02) return;
        
        const strength = clamp(source.intensity * source.blend * 0.2, 0, 0.4);
        const centerX  = width / 2;
        const centerY  = height / 2;
        const sourceDistance = Math.max(width, height) * (0.22 + tilt * 0.82);
        const lightX   = centerX + direction.x * sourceDistance;
        const lightY   = centerY + direction.y * sourceDistance;
        const darkX    = centerX - direction.x * sourceDistance;
        const darkY    = centerY - direction.y * sourceDistance;
        const gradient = ctx.createLinearGradient(lightX, lightY, darkX, darkY);

        gradient.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${strength})`);
        gradient.addColorStop(0.6, `rgba(${rgb.r},${rgb.g},${rgb.b},${strength * 0.3})`);
        gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
    });

    ctx.globalCompositeOperation = "source-over";

    // Soft vignette
    const vignette = ctx.createRadialGradient(
      width / 2, height / 2, Math.max(10, Math.min(width, height) * 0.22),
      width / 2, height / 2, Math.max(width, height) * 0.95,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, `rgba(0,0,0,${clamp(ambientAlpha * 0.22, 0.02, 0.2)})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  },
};