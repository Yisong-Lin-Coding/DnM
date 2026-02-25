import { worldToScreen } from "./mapLayerShared";

const FOG_ALPHA = 0.78;

const drawVisionCone = (ctx, char, camera) => {
  const x = Number(char?.position?.x) || 0;
  const y = Number(char?.position?.y) || 0;
  const visionDistance = Number(char?.visionDistance) || 0;
  if (visionDistance <= 0) return;

  const arcDegrees = Math.max(0, Number(char?.visionArc) || 90);
  const screen = worldToScreen(camera, x, y);
  const radius = visionDistance * camera.zoom;

  ctx.beginPath();
  ctx.moveTo(screen.x, screen.y);
  if (arcDegrees >= 360) {
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  } else {
    const rotRad = ((Number(char?.rotation) || 0) - 90) * (Math.PI / 180);
    const arcHalf = (arcDegrees / 2) * (Math.PI / 180);
    ctx.arc(screen.x, screen.y, radius, rotRad - arcHalf, rotRad + arcHalf);
    ctx.closePath();
  }
  ctx.fill();
};

export const mapFogLayer = {
  id: "fog",

  shouldRedraw(state, prevState) {
    if (!prevState) return true;
    const c = state?.camera, p = prevState?.camera;
    if (!c || !p) return true;
    if (c.x !== p.x || c.y !== p.y || c.zoom !== p.zoom) return true;
    if (state.characters !== prevState.characters) return true;
    if (state.fogEnabled !== prevState.fogEnabled) return true;
    if (state.isDM !== prevState.isDM) return true;
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
    const playerChars = characters.filter(
      (char) => String(char?.team || "").toLowerCase() === "player"
    );

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(0,0,0,${FOG_ALPHA})`;
    ctx.fillRect(0, 0, width, height);

    if (playerChars.length > 0) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,1)";
      playerChars.forEach((char) => drawVisionCone(ctx, char, camera));
    }

    ctx.restore();
  },
};
