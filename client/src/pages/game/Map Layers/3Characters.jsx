import { worldToScreen } from "./mapLayerShared";

const TEAM_COLORS = {
  player:  { fill: "#3B82F6", stroke: "#93C5FD", label: "#DBEAFE" },
  enemy:   { fill: "#EF4444", stroke: "#FCA5A5", label: "#FEE2E2" },
  neutral: { fill: "#A855F7", stroke: "#D8B4FE", label: "#F3E8FF" },
};

const FACE_DOT_OFFSET_PX = 10;
const FACE_DOT_RADIUS_PX = 4;
const GRID_SIZE = 50;
const FEET_PER_GRID = 5;
const WORLD_UNITS_PER_FT = GRID_SIZE / FEET_PER_GRID;
const DEFAULT_MOVEMENT_FT = 30;
const ATTACK_RADIUS_FT = 5;

const getTeamColors = (team) =>
  TEAM_COLORS[String(team || "").toLowerCase()] || TEAM_COLORS.neutral;

const drawCharacter = (ctx, char, camera, options = {}) => {
  const { isSelected = false, showVision = false } = options;
  const x      = Number(char?.position?.x) || 0;
  const y      = Number(char?.position?.y) || 0;
  const radius = Math.max(4, (Number(char?.size) || 30) / 2 * camera.zoom);
  const screen = worldToScreen(camera, x, y);
  const colors = getTeamColors(char?.team);

  // ── Vision arc (faint) ──────────────────────────────────────────────────
  if (showVision) {
    const visionR   = (Number(char?.visionDistance) || 150) * camera.zoom;
    const rotRad    = ((Number(char?.rotation) || 0) - 90) * (Math.PI / 180);
    const arcHalf   = ((Number(char?.visionArc) || 90) / 2) * (Math.PI / 180);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y);
    ctx.arc(screen.x, screen.y, visionR, rotRad - arcHalf, rotRad + arcHalf);
    ctx.closePath();
    ctx.fillStyle   = `${colors.fill}18`;
    ctx.strokeStyle = `${colors.stroke}40`;
    ctx.lineWidth   = 1;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // -- Movement + attack ranges (selected) ----------------------------------
  if (isSelected) {
    const movementFt = Math.max(0, Number(char?.movement) || DEFAULT_MOVEMENT_FT);
    const movementR = movementFt * WORLD_UNITS_PER_FT * camera.zoom;
    const attackR = ATTACK_RADIUS_FT * WORLD_UNITS_PER_FT * camera.zoom;

    ctx.save();
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, movementR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(34,197,94,0.65)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, attackR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(239,68,68,0.85)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
  }

  // ── Selection ring ──────────────────────────────────────────────────────
  if (isSelected) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = "#FDE047";
    ctx.lineWidth   = 2.5;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.restore();
  }

  // ── Body ────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  ctx.fillStyle   = colors.fill;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth   = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // ── Direction indicator ─────────────────────────────────────────────────
  const rotRad = ((Number(char?.rotation) || 0) - 90) * (Math.PI / 180);
  const dotDistance = radius + FACE_DOT_OFFSET_PX;
  const dotX = screen.x + Math.cos(rotRad) * dotDistance;
  const dotY = screen.y + Math.sin(rotRad) * dotDistance;
  const dotRadius = isSelected ? FACE_DOT_RADIUS_PX + 2 : FACE_DOT_RADIUS_PX;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(screen.x, screen.y);
  ctx.lineTo(dotX, dotY);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth   = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle   = "#ffffff";
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth   = 1.5;
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // ── HP bar ──────────────────────────────────────────────────────────────
  if (char?.maxHP != null && char?.hp != null) {
    const ratio  = Math.max(0, Math.min(1, char.hp / char.maxHP));
    const barW   = radius * 2;
    const barH   = 4;
    const barX   = screen.x - radius;
    const barY   = screen.y + radius + 5;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = ratio > 0.5 ? "#22c55e" : ratio > 0.25 ? "#f59e0b" : "#ef4444";
    ctx.fillRect(barX, barY, barW * ratio, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth   = 0.5;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.restore();
  }

  // ── Name label ──────────────────────────────────────────────────────────
  ctx.save();
  ctx.font      = `bold ${Math.max(10, Math.round(11 * camera.zoom))}px Arial`;
  ctx.textAlign = "center";
  ctx.fillStyle = colors.label;
  ctx.shadowColor   = "rgba(0,0,0,0.8)";
  ctx.shadowBlur    = 3;
  const labelY = screen.y - radius - 6;
  ctx.fillText(String(char?.name || ""), screen.x, labelY);
  ctx.restore();
};

export const mapCharactersLayer = {
  id: "mapCharacters",

  shouldRedraw(state, prevState) {
    if (!prevState) return true;
    const c = state?.camera, p = prevState?.camera;
    if (!c || !p) return true;
    if (c.x !== p.x || c.y !== p.y || c.zoom !== p.zoom) return true;
    if (state.characters    !== prevState.characters)    return true;
    if (state.selectedChar  !== prevState.selectedChar)  return true;
    if (state.fogEnabled    !== prevState.fogEnabled)    return true;
    if (state.isDM          !== prevState.isDM)          return true;
    if (state.controlledCharacterIDs !== prevState.controlledCharacterIDs) return true;
    return false;
  },

  draw(ctx, canvas, state) {
    if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const camera      = state?.camera;
    const characters  = state?.characters || [];
    const selectedId  = state?.selectedChar || null;
    const isDM        = state?.isDM        || false;
    const fogEnabled  = state?.fogEnabled  || false;
    const controlledIds = new Set(
      (state?.controlledCharacterIDs || []).map((id) => toEntityID(id))
    );

    if (!camera) return;

    characters.forEach((char) => {
      const x  = Number(char?.position?.x) || 0;
      const y  = Number(char?.position?.y) || 0;

      // Fog of war: hide enemy characters not in any player's vision cone
      if (fogEnabled && !isDM && String(char?.team || "").toLowerCase() === "enemy") {
        const playerChars = characters.filter((c) => c.team === "player");
        const visible = playerChars.some((pc) => {
          const dx  = x - (Number(pc?.position?.x) || 0);
          const dy  = y - (Number(pc?.position?.y) || 0);
          const d2  = dx * dx + dy * dy;
          const vd  = Number(pc?.visionDistance) || 150;
          if (d2 > vd * vd) return false;
          const ang    = (Math.atan2(dy, dx) * 180) / Math.PI;
          let diff     = ang - ((Number(pc?.rotation) || 0) - 90);
          while (diff >  180) diff -= 360;
          while (diff < -180) diff += 360;
          return Math.abs(diff) <= (Number(pc?.visionArc) || 90) / 2;
        });
        if (!visible) return;
      }

      const isSelected = toEntityID(char?.id) === toEntityID(selectedId);
      drawCharacter(ctx, char, camera, {
        isSelected,
        showVision: isSelected || isDM || controlledIds.has(toEntityID(char?.id)),
      });
    });
  },
};

// Tiny helper — mirrors the one in GameComponent without importing it
const toEntityID = (v) => String(v ?? "").trim();
