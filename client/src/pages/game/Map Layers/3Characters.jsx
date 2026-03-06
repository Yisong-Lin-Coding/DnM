import { worldToScreen } from "./mapLayerShared";

// ── Status-effect dot colours by school ──────────────────────────────────────
const EFFECT_SCHOOL_COLORS = {
  fire:        "#f97316",
  poison:      "#22c55e",
  necrotic:    "#a855f7",
  condition:   "#eab308",
  buff:        "#06b6d4",
  enchantment: "#ec4899",
  magic:       "#3b82f6",
};

const getEffectColor = (effect) => {
  const school = typeof effect === "object" ? String(effect?.school || "") : "";
  return EFFECT_SCHOOL_COLORS[school.toLowerCase()] || "#6b7280";
};

const MAX_EFFECT_DOTS = 6;

const drawStatusEffects = (ctx, char, camera, screenX, screenY, radius) => {
  const effects = Array.isArray(char?.statusEffects) ? char.statusEffects : [];
  if (effects.length === 0) return;

  const dotR  = Math.max(2.5, 3.5 * Math.min(camera.zoom, 1.5));
  const gap   = 2;
  const pitch = dotR * 2 + gap;
  const count = Math.min(effects.length, MAX_EFFECT_DOTS);
  // sit below the HP bar (barY = radius + 5, barH = 4) with 4px breathing room
  const dotsY = screenY + radius + 13 + dotR;
  const startX = screenX - ((count - 1) * pitch) / 2;

  for (let i = 0; i < count; i++) {
    const isOverflow = i === MAX_EFFECT_DOTS - 1 && effects.length > MAX_EFFECT_DOTS;
    const cx    = startX + i * pitch;
    const color = isOverflow ? "#94a3b8" : getEffectColor(effects[i]);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, dotsY, dotR, 0, Math.PI * 2);
    ctx.fillStyle   = color;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth   = 0.8;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (isOverflow) {
      const fs = Math.max(6, Math.round(6.5 * Math.min(camera.zoom, 1.5)));
      ctx.save();
      ctx.font         = `bold ${fs}px Arial`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle    = "#fff";
      ctx.fillText(`+${effects.length - MAX_EFFECT_DOTS + 1}`, cx, dotsY);
      ctx.restore();
    }
  }
};

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
  const { isSelected = false } = options;
  const x      = Number(char?.position?.x) || 0;
  const y      = Number(char?.position?.y) || 0;
  const radius = Math.max(4, (Number(char?.size) || 30) / 2 * camera.zoom);
  const screen = worldToScreen(camera, x, y);
  const colors = getTeamColors(char?.team);

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

  // -- Selection ring -------------------------------------------------------
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

  // -- Body -----------------------------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  ctx.fillStyle   = colors.fill;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth   = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // -- Direction indicator --------------------------------------------------
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

  // -- HP bar ---------------------------------------------------------------
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

  // -- Name label -----------------------------------------------------------
  ctx.save();
  ctx.font      = `bold ${Math.max(10, Math.round(11 * camera.zoom))}px Arial`;
  ctx.textAlign = "center";
  ctx.fillStyle = colors.label;
  ctx.shadowColor   = "rgba(0,0,0,0.8)";
  ctx.shadowBlur    = 3;
  const labelY = screen.y - radius - 6;
  ctx.fillText(String(char?.name || ""), screen.x, labelY);
  ctx.restore();

  // -- Status-effect dots ---------------------------------------------------
  drawStatusEffects(ctx, char, camera, screen.x, screen.y, radius);
};

const drawGhostCharacter = (ctx, char, camera) => {
  if (!char || !camera) return;
  const x = Number(char?.position?.x ?? char?.x) || 0;
  const y = Number(char?.position?.y ?? char?.y) || 0;
  const radius = Math.max(4, (Number(char?.size) || 30) / 2 * camera.zoom);
  const screen = worldToScreen(camera, x, y);

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(160,160,160,0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(110,110,110,0.9)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.font = `bold ${Math.max(10, Math.round(11 * camera.zoom))}px Arial`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(220,220,220,0.85)";
  ctx.fillText(String(char?.name || ""), screen.x, screen.y - radius - 6);
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
    if (state.selectedCharacterIds !== prevState.selectedCharacterIds) return true;
    if (state.fogEnabled    !== prevState.fogEnabled)    return true;
    if (state.isDM          !== prevState.isDM)          return true;
    if (state.controlledCharacterIDs !== prevState.controlledCharacterIDs) return true;
    if (state.ghostCharacters !== prevState.ghostCharacters) return true;
    if (state.visionVisibility !== prevState.visionVisibility) return true;
    return false;
  },

  draw(ctx, canvas, state) {
    if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const camera      = state?.camera;
    const characters  = state?.characters || [];
    const selectedId  = state?.selectedChar || null;
    const selectedIds = state?.selectedCharacterIds || new Set();
    const isDM        = state?.isDM        || false;
    const fogEnabled  = state?.fogEnabled  || false;

    if (!camera) return;

    const ghostCharacters = Array.isArray(state?.ghostCharacters) ? state.ghostCharacters : [];
    const visionVisibility = state?.visionVisibility || {};

    ghostCharacters.forEach((ghost) => {
      drawGhostCharacter(ctx, ghost, camera);
    });

    characters.forEach((char) => {
      // Fog of war: hide enemy characters not in any player's vision cone
      if (fogEnabled && !isDM && String(char?.team || "").toLowerCase() === "enemy") {
        const key = makeEntityKey("character", char?.id);
        const visible = (visionVisibility[key]?.visibility || 0) > 0;
        if (!visible) return;
      }

      const isSelected =
        toEntityID(char?.id) === toEntityID(selectedId) ||
        selectedIds.has(toEntityID(char?.id));
      drawCharacter(ctx, char, camera, { isSelected });
    });
  },
};

// Tiny helper â€” mirrors the one in GameComponent without importing it
const toEntityID = (v) => String(v ?? "").trim();
const makeEntityKey = (type, id) => `${String(type || "unknown")}:${toEntityID(id)}`;
