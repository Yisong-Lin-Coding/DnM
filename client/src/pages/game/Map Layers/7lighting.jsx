const DEFAULT_LIGHTING = {
  enabled: true,
  ambient: 0.24,
  sources: [
    {
      id: "sun",
      type: "directional",
      enabled: true,
      x: 0,
      y: 0,
      intensity: 0.8,
    },
  ],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeLightingSourceDirection = (source = {}) => {
  const x = clamp(Number(source?.x) || 0, -1, 1);
  const y = clamp(Number(source?.y) || 0, -1, 1);
  const magnitude = Math.hypot(x, y);
  if (magnitude === 0 || magnitude <= 1) return { x, y };
  return {
    x: x / magnitude,
    y: y / magnitude,
  };
};

const normalizeDirectionalLight = (raw = {}, fallback = {}) => {
  const direction = normalizeLightingSourceDirection({
    x: raw?.x ?? fallback?.x,
    y: raw?.y ?? fallback?.y,
  });
  return {
    ...direction,
    intensity: clamp(Number(raw?.intensity ?? fallback?.intensity) || 0.8, 0, 2),
  };
};

const resolvePrimaryDirectionalLight = (lighting = {}) => {
  const sources = Array.isArray(lighting?.sources) ? lighting.sources : [];
  const directionalSource =
    sources.find(
      (source) =>
        source &&
        String(source?.type || "").toLowerCase() === "directional" &&
        source.enabled !== false
    ) || null;

  if (directionalSource) {
    return normalizeDirectionalLight(directionalSource, { x: 0, y: 0, intensity: 0.8 });
  }

  const sourceInput =
    lighting?.source && typeof lighting.source === "object" && !Array.isArray(lighting.source)
      ? lighting.source
      : lighting;
  return normalizeDirectionalLight(sourceInput, { x: 0, y: 0, intensity: sourceInput?.intensity ?? 0.8 });
};

const normalizeLighting = (lighting = {}) => ({
  enabled: lighting?.enabled !== false,
  ambient: clamp(Number(lighting?.ambient) || DEFAULT_LIGHTING.ambient, 0, 0.9),
  primaryDirectional: resolvePrimaryDirectionalLight(lighting),
});

const resolveLightTilt = (source = {}) =>
  clamp(Math.hypot(Number(source?.x) || 0, Number(source?.y) || 0), 0, 1);

export const lightingLayer = {
  id: "lighting",

  shouldRedraw() {
    return true;
  },

  draw(ctx, canvas, state) {
    if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const lighting = normalizeLighting(state?.lighting || DEFAULT_LIGHTING);
    if (!lighting.enabled) return;

    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const light = lighting.primaryDirectional;
    const tilt = resolveLightTilt(light);
    const directionalStrength = clamp(tilt * (light.intensity || 0.8), 0, 1.5);

    const baseDarkness = clamp(lighting.ambient * (0.06 + tilt * 0.94), 0.008, 0.42);
    const sourceDistance = Math.max(width, height) * (0.22 + tilt * 0.75);
    const sourceX = centerX + light.x * sourceDistance;
    const sourceY = centerY + light.y * sourceDistance;
    const darkX = centerX - light.x * sourceDistance;
    const darkY = centerY - light.y * sourceDistance;

    ctx.save();
    if (directionalStrength > 0.015) {
      const directional = ctx.createLinearGradient(sourceX, sourceY, darkX, darkY);
      directional.addColorStop(0, `rgba(0,0,0,${clamp(baseDarkness * 0.45, 0.005, 0.22)})`);
      directional.addColorStop(
        0.58,
        `rgba(0,0,0,${clamp(baseDarkness + directionalStrength * 0.16, 0.02, 0.46)})`
      );
      directional.addColorStop(
        1,
        `rgba(0,0,0,${clamp(baseDarkness + directionalStrength * 0.34, 0.04, 0.66)})`
      );
      ctx.fillStyle = directional;
      ctx.fillRect(0, 0, width, height);
    } else {
      // Center means overhead sun: keep lighting soft and almost even.
      const overheadDarkness = clamp(baseDarkness * 0.72, 0.006, 0.12);
      ctx.fillStyle = `rgba(0,0,0,${overheadDarkness})`;
      ctx.fillRect(0, 0, width, height);
    }

    const vignetteStrength = clamp(
      baseDarkness * (0.04 + tilt * 0.5) + directionalStrength * 0.07,
      0.006,
      0.22
    );
    const vignette = ctx.createRadialGradient(
      centerX,
      centerY,
      Math.max(10, Math.min(width, height) * 0.18),
      centerX,
      centerY,
      Math.max(width, height) * 0.92
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, `rgba(0,0,0,${vignetteStrength})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
};
