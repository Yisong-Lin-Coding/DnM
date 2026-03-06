import { worldToScreen } from "./mapLayerShared";

const FOG_EXPLORED_ALPHA = 0.65;
const FOG_PERIPHERAL_CLEAR = 0.55; // Portion of fog removed for peripheral vision
let exploredMaskCanvas = null;
let exploredMaskCtx = null;

const getCloseRangeRadius = (char) => {
  const radius = Number(char?.vision?.radius);
  if (Number.isFinite(radius) && radius > 0) return radius;
  const distance = Number(char?.visionDistance) || Number(char?.vision?.distance) || 0;
  return distance > 0 ? distance * 0.2 : 0;
};

const getVisionDistance = (char) =>
  Number(char?.visionDistance) || Number(char?.vision?.distance) || 0;

const getVisionAngle = (char) =>
  Number(char?.visionArc) || Number(char?.vision?.angle) || 0;

const resolveVisionRays = (char) =>
  Array.isArray(char?.visionRays) ? char.visionRays : [];

const splitRays = (rays = []) => {
  if (!Array.isArray(rays) || rays.length === 0) {
    return { main: [], peripheral: [] };
  }
  const hasPeripheralFlag = rays.some((ray) => ray?.isPeripheral != null);
  if (!hasPeripheralFlag) {
    return { main: rays, peripheral: [] };
  }
  return {
    main: rays.filter((ray) => !ray?.isPeripheral),
    peripheral: rays.filter((ray) => ray?.isPeripheral),
  };
};

const normalizeRad = (rad) => {
  let value = rad;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
};

const sortAndDedupeRays = (rays, charX, charY, facingRad) => {
  if (!Array.isArray(rays) || rays.length === 0) return [];
  const sorted = rays
    .map((ray) => {
      const angleRad = Math.atan2((ray?.endY ?? 0) - charY, (ray?.endX ?? 0) - charX);
      return {
        ...ray,
        _relAngle: normalizeRad(angleRad - facingRad),
      };
    })
    .sort((a, b) => a._relAngle - b._relAngle);

  const deduped = [];
  const EPS = 1e-4;
  for (const ray of sorted) {
    const last = deduped[deduped.length - 1];
    if (last && Math.abs(ray._relAngle - last._relAngle) < EPS) {
      if ((Number(ray?.distance) || 0) > (Number(last?.distance) || 0)) {
        deduped[deduped.length - 1] = ray;
      }
      continue;
    }
    deduped.push(ray);
  }
  return deduped;
};

const fillRayFan = (ctx, char, camera, rays) => {
  if (!camera) return false;
  const charX = Number(char?.position?.x) || 0;
  const charY = Number(char?.position?.y) || 0;
  const facingRad = ((Number(char?.rotation) || 0) - 90) * (Math.PI / 180);
  const sorted = sortAndDedupeRays(rays, charX, charY, facingRad);
  if (sorted.length === 0) return false;

  const screenX = charX * camera.zoom - camera.x;
  const screenY = charY * camera.zoom - camera.y;

  ctx.beginPath();
  ctx.moveTo(screenX, screenY);
  const first = sorted[0];
  ctx.lineTo(first.endX * camera.zoom - camera.x, first.endY * camera.zoom - camera.y);
  for (let i = 1; i < sorted.length; i++) {
    const ray = sorted[i];
    ctx.lineTo(ray.endX * camera.zoom - camera.x, ray.endY * camera.zoom - camera.y);
  }
  ctx.closePath();
  ctx.fill();
  return true;
};

const fillPeripheralFans = (ctx, char, camera, rays) => {
  if (!camera || !Array.isArray(rays) || rays.length === 0) return false;
  const charX = Number(char?.position?.x) || 0;
  const charY = Number(char?.position?.y) || 0;
  const facingRad = ((Number(char?.rotation) || 0) - 90) * (Math.PI / 180);
  const screenX = charX * camera.zoom - camera.x;
  const screenY = charY * camera.zoom - camera.y;

  const leftRays = [];
  const rightRays = [];

  rays.forEach((ray) => {
    const angle = Math.atan2((ray?.endY ?? 0) - charY, (ray?.endX ?? 0) - charX);
    const diff = normalizeRad(angle - facingRad);
    const entry = { ...ray, _relAngle: diff };
    if (diff < 0) {
      leftRays.push(entry);
    } else {
      rightRays.push(entry);
    }
  });

  leftRays.sort((a, b) => a._relAngle - b._relAngle);
  rightRays.sort((a, b) => a._relAngle - b._relAngle);

  const drawWedge = (wedgeRays) => {
    if (wedgeRays.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    for (const ray of wedgeRays) {
      ctx.lineTo(ray.endX * camera.zoom - camera.x, ray.endY * camera.zoom - camera.y);
    }
    ctx.closePath();
    ctx.fill();
  };

  drawWedge(leftRays);
  drawWedge(rightRays);
  return leftRays.length > 1 || rightRays.length > 1;
};

const fillCloseRange = (ctx, char, camera) => {
  const radius = getCloseRangeRadius(char);
  if (!camera || radius <= 0) return false;
  const x = Number(char?.position?.x) || 0;
  const y = Number(char?.position?.y) || 0;
  const screen = worldToScreen(camera, x, y);
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, radius * camera.zoom, 0, Math.PI * 2);
  ctx.fill();
  return true;
};

const fillArcCone = (ctx, char, camera, startRad, endRad, distance) => {
  if (!camera || distance <= 0) return false;
  const x = Number(char?.position?.x) || 0;
  const y = Number(char?.position?.y) || 0;
  const screen = worldToScreen(camera, x, y);
  ctx.beginPath();
  ctx.moveTo(screen.x, screen.y);
  ctx.arc(screen.x, screen.y, distance * camera.zoom, startRad, endRad);
  ctx.closePath();
  ctx.fill();
  return true;
};

const fillMainVision = (ctx, char, camera, mainRays) => {
  if (Array.isArray(mainRays) && mainRays.length > 0) {
    return fillRayFan(ctx, char, camera, mainRays);
  }
  const distance = getVisionDistance(char);
  const angle = getVisionAngle(char);
  if (distance <= 0 || angle <= 0) return false;
  const facingRad = ((Number(char?.rotation) || 0) - 90) * (Math.PI / 180);
  const half = (angle / 2) * (Math.PI / 180);
  return fillArcCone(ctx, char, camera, facingRad - half, facingRad + half, distance);
};

const fillPeripheralVision = (ctx, char, camera, peripheralRays) => {
  if (Array.isArray(peripheralRays) && peripheralRays.length > 0) {
    return fillPeripheralFans(ctx, char, camera, peripheralRays);
  }
  const distance = getVisionDistance(char);
  const angle = getVisionAngle(char);
  if (distance <= 0 || angle <= 0) return false;
  const facingRad = ((Number(char?.rotation) || 0) - 90) * (Math.PI / 180);
  const half = (angle / 2) * (Math.PI / 180);
  const peripheralArc = (angle / 4) * (Math.PI / 180);
  const leftStart = facingRad - half - peripheralArc;
  const leftEnd = facingRad - half;
  const rightStart = facingRad + half;
  const rightEnd = facingRad + half + peripheralArc;
  fillArcCone(ctx, char, camera, leftStart, leftEnd, distance);
  fillArcCone(ctx, char, camera, rightStart, rightEnd, distance);
  return true;
};

const traceExploredShape = (ctx, shape, camera) => {
  if (!camera || !shape) return;
  if (shape.type === "polygon" && Array.isArray(shape.points) && shape.points.length > 2) {
    ctx.beginPath();
    const first = shape.points[0];
    const firstScreen = worldToScreen(camera, Number(first.x) || 0, Number(first.y) || 0);
    ctx.moveTo(firstScreen.x, firstScreen.y);
    for (let i = 1; i < shape.points.length; i += 1) {
      const pt = shape.points[i];
      const screen = worldToScreen(camera, Number(pt.x) || 0, Number(pt.y) || 0);
      ctx.lineTo(screen.x, screen.y);
    }
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (shape.type === "circle") {
    const x = Number(shape?.x) || 0;
    const y = Number(shape?.y) || 0;
    const r = Math.max(0, Number(shape?.r) || 0);
    if (r <= 0) return;
    const screen = worldToScreen(camera, x, y);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, r * camera.zoom, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const x = Number(shape?.x) || 0;
  const y = Number(shape?.y) || 0;
  const r = Math.max(0, Number(shape?.r) || 0);
  const arc = Math.max(0, Number(shape?.arc) || 0);
  if (r <= 0 || arc <= 0) return;
  const rot = Number(shape?.rot) || 0;
  const screen = worldToScreen(camera, x, y);
  const radius = r * camera.zoom;
  const facingRad = (rot - 90) * (Math.PI / 180);

  ctx.beginPath();
  if (arc >= 360) {
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  } else {
    const half = (arc / 2) * (Math.PI / 180);
    ctx.moveTo(screen.x, screen.y);
    ctx.arc(screen.x, screen.y, radius, facingRad - half, facingRad + half);
    ctx.closePath();
  }
  ctx.fill();
};

const getExploredMask = (width, height) => {
  if (!exploredMaskCanvas) {
    exploredMaskCanvas = document.createElement("canvas");
    exploredMaskCtx = exploredMaskCanvas.getContext("2d");
  }
  if (exploredMaskCanvas.width !== width || exploredMaskCanvas.height !== height) {
    exploredMaskCanvas.width = width;
    exploredMaskCanvas.height = height;
  }
  return { canvas: exploredMaskCanvas, ctx: exploredMaskCtx };
};

export const mapFogLayer = {
  id: "fog",

  shouldRedraw(state, prevState) {
    if (!prevState) return true;
    const c = state?.camera, p = prevState?.camera;
    if (!c || !p) return true;
    if (c.x !== p.x || c.y !== p.y || c.zoom !== p.zoom) return true;
    if (state.characters !== prevState.characters) return true;
    // Check if any character's visionRays changed (light affects fog)
    const sources = Array.isArray(state?.visionSources) ? state.visionSources : state?.characters || [];
    const prevSources = Array.isArray(prevState?.visionSources) ? prevState.visionSources : prevState?.characters || [];
    if (JSON.stringify(sources.map((ch) => ch?.visionRays)) !==
        JSON.stringify(prevSources.map((ch) => ch?.visionRays))) return true;
    // Check if any character's lightLevel changed
    if (JSON.stringify(sources.map((ch) => ch?.lightLevel)) !==
        JSON.stringify(prevSources.map((ch) => ch?.lightLevel))) return true;
    if (state.fogEnabled !== prevState.fogEnabled) return true;
    if (state.isDM !== prevState.isDM) return true;
    if (state.exploredAreas !== prevState.exploredAreas) return true;
    return false;
  },

  draw(ctx, canvas, state) {
    if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const fogEnabled = state?.fogEnabled || false;
    const isDM = state?.isDM || false;
    const camera = state?.camera;
    if (!fogEnabled || isDM || !camera) return;

    const characters = state?.characters || [];
    const visionSources = Array.isArray(state?.visionSources) && state.visionSources.length > 0
      ? state.visionSources
      : characters.filter((char) => String(char?.team || "").toLowerCase() === "player");

    const explored = Array.isArray(state?.exploredAreas) ? state.exploredAreas : [];
    const exploredMask = explored.length > 0 ? getExploredMask(width, height) : null;
    if (exploredMask) {
      exploredMask.ctx.clearRect(0, 0, width, height);
      exploredMask.ctx.fillStyle = "rgba(0,0,0,1)";
      explored.forEach((shape) => traceExploredShape(exploredMask.ctx, shape, camera));
    }

    ctx.save();
    // 1) Full fog
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, width, height);

    // 2) Explored-but-not-currently-visible (darkened, constant alpha)
    if (exploredMask) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      ctx.drawImage(exploredMask.canvas, 0, 0);

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = FOG_EXPLORED_ALPHA;
      ctx.drawImage(exploredMask.canvas, 0, 0);
      ctx.globalAlpha = 1;
    }

    // 3) Main vision: full clear
    if (visionSources.length > 0) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,1)";
      visionSources.forEach((char) => {
        const { main } = splitRays(resolveVisionRays(char));
        fillMainVision(ctx, char, camera, main);
        fillCloseRange(ctx, char, camera);
      });
    }

    // 4) Peripheral vision: partial clear
    if (visionSources.length > 0) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0,0,0,${FOG_PERIPHERAL_CLEAR})`;
      visionSources.forEach((char) => {
        const { peripheral } = splitRays(resolveVisionRays(char));
        fillPeripheralVision(ctx, char, camera, peripheral);
      });
    }

    ctx.restore();
  },
};
