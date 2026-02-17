const DEFAULT_LIGHTING = {
  enabled: true,
  source: { x: 0.22, y: -0.78 },
  ambient: 0.3,
  intensity: 0.5,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeLightingSource = (source = {}) => {
  const x = clamp(Number(source?.x) || 0, -1, 1);
  const y = clamp(Number(source?.y) || 0, -1, 1);
  const magnitude = Math.hypot(x, y);
  if (magnitude === 0 || magnitude <= 1) return { x, y };
  return {
    x: x / magnitude,
    y: y / magnitude,
  };
};

const normalizeLighting = (lighting = {}) => {
  const sourceInput =
    lighting?.source && typeof lighting.source === "object" && !Array.isArray(lighting.source)
      ? lighting.source
      : lighting;
  return {
    enabled: lighting?.enabled !== false,
    source: normalizeLightingSource(sourceInput),
    ambient: clamp(Number(lighting?.ambient) || DEFAULT_LIGHTING.ambient, 0, 0.9),
    intensity: clamp(Number(lighting?.intensity) || DEFAULT_LIGHTING.intensity, 0, 1),
  };
};

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
    const lightTilt = resolveLightTilt(lighting.source);
    const directionalStrength = clamp(lightTilt * lighting.intensity, 0, 1);

    const sourceDistance = Math.max(width, height) * (0.42 + directionalStrength * 0.35);
    const sourceX = centerX + lighting.source.x * sourceDistance;
    const sourceY = centerY + lighting.source.y * sourceDistance;
    const darkX = centerX - lighting.source.x * sourceDistance;
    const darkY = centerY - lighting.source.y * sourceDistance;

    ctx.save();
    if (directionalStrength > 0.01) {
      const directional = ctx.createLinearGradient(sourceX, sourceY, darkX, darkY);
      directional.addColorStop(0, `rgba(0,0,0,${clamp(lighting.ambient * 0.1, 0.01, 0.16)})`);
      directional.addColorStop(
        0.52,
        `rgba(0,0,0,${clamp(lighting.ambient * 0.38 + directionalStrength * 0.22, 0.05, 0.52)})`
      );
      directional.addColorStop(
        1,
        `rgba(0,0,0,${clamp(lighting.ambient * 0.62 + directionalStrength * 0.45, 0.1, 0.8)})`
      );
      ctx.fillStyle = directional;
      ctx.fillRect(0, 0, width, height);
    } else {
      const overheadDarkness = clamp(lighting.ambient * 0.35, 0.04, 0.22);
      ctx.fillStyle = `rgba(0,0,0,${overheadDarkness})`;
      ctx.fillRect(0, 0, width, height);
    }

    const vignette = ctx.createRadialGradient(
      centerX,
      centerY,
      Math.max(10, Math.min(width, height) * 0.15),
      centerX,
      centerY,
      Math.max(width, height) * 0.9
    );
    vignette.addColorStop(
      0,
      `rgba(0,0,0,${clamp(lighting.ambient * (0.08 + directionalStrength * 0.05), 0, 0.16)})`
    );
    vignette.addColorStop(
      1,
      `rgba(0,0,0,${clamp(lighting.ambient * 0.2 + directionalStrength * 0.18, 0.06, 0.34)})`
    );
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
};
