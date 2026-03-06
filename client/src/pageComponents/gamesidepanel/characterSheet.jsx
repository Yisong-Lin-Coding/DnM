// c:\Projects\client\src\pageComponents\gamesidepanel\characterSheet.jsx
import { useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Eye, Gauge, Heart, Shield, Sparkles, Zap } from "lucide-react";
import { SocketContext } from "../../socket.io/context";
import { emitWithAck } from "../../pages/campaign/socketEmit";
import { useGame } from "../../data/gameContext";



const STAT_KEYS = ["STR", "DEX", "CON", "INT", "WIS", "CHA", "LUCK"];

const DAMAGE_GROUPS = [
  { key: "physical", label: "Physical", types: ["slashing", "piercing", "bludgeoning"] },
  {
    key: "magical",
    label: "Magical",
    types: [
      "cold",
      "fire",
      "lightning",
      "thunder",
      "poison",
      "acid",
      "necrotic",
      "radiant",
      "force",
      "psychic",
    ],
  },
];

const DAMAGE_LABELS = {
  physical: "Physical",
  slashing: "Slashing",
  piercing: "Piercing",
  bludgeoning: "Bludgeoning",
  magical: "Magical",
  cold: "Cold",
  fire: "Fire",
  lightning: "Lightning",
  thunder: "Thunder",
  poison: "Poison",
  acid: "Acid",
  necrotic: "Necrotic",
  radiant: "Radiant",
  force: "Force",
  psychic: "Psychic",
};

const DAMAGE_TONES = {
  physical: "text-amber-200",
  slashing: "text-amber-200",
  piercing: "text-amber-300",
  bludgeoning: "text-amber-100",
  magical: "text-indigo-200",
  cold: "text-cyan-200",
  fire: "text-red-300",
  lightning: "text-yellow-200",
  thunder: "text-violet-200",
  poison: "text-emerald-200",
  acid: "text-lime-300",
  necrotic: "text-fuchsia-200",
  radiant: "text-yellow-300",
  force: "text-sky-200",
  psychic: "text-pink-200",
};

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toTitleCase = (value) =>
  String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const hasDefenseValue = (value) => {
  if (value == null) return false;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.trim() !== "" && value !== "0";
  if (typeof value === "boolean") return value;
  return Boolean(value);
};

const formatDefenseValue = (value) => {
  if (value == null) return "";
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "Yes" : "";
  return String(value);
};

const buildDefenseEntries = (defenseMap = {}) => {
  const entries = [];
  const normalized = defenseMap && typeof defenseMap === "object" ? defenseMap : {};
  const used = new Set();

  DAMAGE_GROUPS.forEach((group) => {
    const groupValue = normalized[group.key];
    const children = group.types
      .map((typeKey) => ({
        key: typeKey,
        label: DAMAGE_LABELS[typeKey] || toTitleCase(typeKey),
        value: normalized[typeKey],
        tone: DAMAGE_TONES[typeKey] || "text-slate-200",
      }))
      .filter((entry) => hasDefenseValue(entry.value));

    if (hasDefenseValue(groupValue) || children.length > 0) {
      entries.push({
        key: group.key,
        label: group.label,
        value: groupValue,
        tone: DAMAGE_TONES[group.key] || "text-slate-200",
        children,
      });
    }
    used.add(group.key);
    group.types.forEach((typeKey) => used.add(typeKey));
  });

  Object.entries(normalized).forEach(([key, value]) => {
    if (used.has(key) || !hasDefenseValue(value)) return;
    entries.push({
      key,
      label: DAMAGE_LABELS[key] || toTitleCase(key),
      value,
      tone: DAMAGE_TONES[key] || "text-slate-200",
      children: [],
    });
  });

  return entries;
};

const renderDefenseList = (entries, emptyLabel) => {
  if (!entries.length) {
    return <div className="text-xs text-slate-500 italic">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div key={entry.key}>
          <div className={`text-[11px] font-semibold ${entry.tone}`}>
            {entry.label}
            {hasDefenseValue(entry.value) && (
              <span className="ml-2 rounded bg-slate-800/70 px-2 py-0.5 text-[10px] text-slate-200">
                {formatDefenseValue(entry.value)}
              </span>
            )}
          </div>
          {entry.children?.length > 0 && (
            <div className="mt-1 space-y-1 pl-3">
              {entry.children.map((child) => (
                <div key={child.key} className={`text-[10px] ${child.tone}`}>
                  {child.label}
                  <span className="ml-2 text-[10px] text-slate-300">
                    {formatDefenseValue(child.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};



export default function CharacterSheetPanel({ character }) {
  const socket = useContext(SocketContext);
  const { isDM, loadGameSnapshot } = useGame();
  const { gameID } = useParams();
  const playerID = localStorage.getItem("player_ID");

  const [effectName, setEffectName] = useState("");
  const [effectDuration, setEffectDuration] = useState("");
  const [effectStack, setEffectStack] = useState(1);
  const [effectsList, setEffectsList] = useState([]);
  const [effectError, setEffectError] = useState("");
  const [pendingResource, setPendingResource] = useState(false);
  const [pendingEffects, setPendingEffects] = useState(false);

  // Fetch the effects catalog once when the DM panel is active
  useEffect(() => {
    if (!isDM || !socket || !gameID || !playerID) return;
    let cancelled = false;
    emitWithAck(socket, "campaign_getEffectsList", {
      playerID,
      campaignID: gameID,
    }).then((res) => {
      if (!cancelled && res?.success && Array.isArray(res.effects)) {
        setEffectsList(res.effects);
      }
    });
    return () => { cancelled = true; };
  }, [isDM, socket, gameID, playerID]);

  const stats = useMemo(() => {
    const raw = character?.stats || {};
    const normalized = {};
    STAT_KEYS.forEach((key) => {
      const rawValue = raw[key] ?? raw[key.toLowerCase()];
      const value =
        typeof rawValue === "object"
          ? rawValue?.score ?? rawValue?.total ?? rawValue?.value ?? 10
          : rawValue ?? 10;
      normalized[key] = toNumber(value, 10);
    });
    return normalized;
  }, [character]);

  if (!character) {
    return (
      <div className="p-6 text-center text-slate-400 text-sm">
        No character selected.
      </div>
    );
  }

  

  const getMod = (val) => Math.floor((val - 10) / 2);
  const formatMod = (val) => (val >= 0 ? `+${val}` : val);

  const expCurrent = toNumber(character.exp ?? character.xp ?? 0, 0);
  const expMaxRaw = toNumber(character.expToNext ?? character.nextLevelExp ?? character.expMax ?? 0, 0);
  const expMax = expMaxRaw > 0 ? expMaxRaw : Math.max(1000, toNumber(character.level, 1) * 1000);
  const expRatio = expMax > 0 ? Math.min(1, expCurrent / expMax) : 0;

  const className =
    typeof character.classType === "object"
      ? character.classType?.name || "Adventurer"
      : character.classType || character.class || "Adventurer";
  const raceName =
    typeof character.race === "object"
      ? character.race?.name || "Unknown"
      : character.race || "Unknown";

  const arValues = character.AR || character.ar || {};
  const resistances = character.resistances || character.defenses?.resistances || {};
  const immunities = character.immunities || character.defenses?.immunities || {};

  const arEntries = buildDefenseEntries(arValues);
  const resistanceEntries = buildDefenseEntries(resistances);
  const immunityEntries = buildDefenseEntries(immunities);

  const statusEffects = Array.isArray(character.statusEffects)
    ? character.statusEffects
    : [];
  const classFeatures = Array.isArray(character.classFeatures)
    ? character.classFeatures
    : Object.values(character.classFeatures || {});
  const raceFeatures = Array.isArray(character.raceFeatures)
    ? character.raceFeatures
    : Object.values(character.raceFeatures || {});
  const passiveSkillsRaw = character.skills?.passive || [];
  const passiveSkills = Array.isArray(passiveSkillsRaw)
    ? passiveSkillsRaw
    : Object.values(passiveSkillsRaw || {});

  const proficiencies = character.skills?.proficiencies || {};
  const proficiencyEntries = Object.entries(proficiencies || {}).map(([category, list]) => {
    const items = Array.isArray(list) ? list : Object.values(list || {});
    return { category, items };
  });
  const hasProficiencies = proficiencyEntries.some((entry) => entry.items.length > 0);
  const proficiencyBonus =
    toNumber(character.proficiencyBonus, 0) ||
    (toNumber(character.level, 1) ? Math.ceil(toNumber(character.level, 1) / 4) + 1 : 0);

  const speed = toNumber(character.movementMax ?? character.movement ?? 0, 0);
  const visionRange = toNumber(character.vision?.distance ?? character.visionDistance ?? 0, 0);
  const rawInt =
    typeof character.stats?.INT === "object"
      ? character.stats?.INT?.score ?? character.stats?.INT?.total ?? character.stats?.INT?.value
      : character.stats?.INT ?? character.stats?.int;
  const perception = Number.isFinite(Number(character.perception))
    ? Number(character.perception)
    : Number.isFinite(Number(rawInt))
      ? Number(rawInt)
      : 0;

  const canDMEdit = Boolean(isDM && socket && gameID && playerID);

  const applyResourceDelta = async (resource, delta) => {
    if (!canDMEdit || pendingResource) return;
    setPendingResource(true);
    const response = await emitWithAck(socket, "campaign_adjustCharacterResource", {
      playerID,
      campaignID: gameID,
      characterID: character.id,
      resource,
      delta,
      field: "current",
    });
    if (response?.engineState?.snapshot) {
      loadGameSnapshot(response.engineState.snapshot);
    }
    setPendingResource(false);
  };

  const addStatusEffect = async () => {
    if (!canDMEdit || pendingEffects) return;
    const trimmed = effectName.trim();
    if (!trimmed) return;
    setEffectError("");
    setPendingEffects(true);
    const payload = {
      playerID,
      campaignID: gameID,
      characterID: character.id,
      action: "add",
      effect: trimmed,
      stack: Number(effectStack) >= 1 ? Number(effectStack) : 1,
    };
    const durationValue = Number(effectDuration);
    if (Number.isFinite(durationValue)) {
      payload.duration = durationValue;
    }
    const response = await emitWithAck(socket, "campaign_updateCharacterStatusEffects", payload);
    if (response?.success === false) {
      setEffectError(response.message || "Failed to add effect.");
    }
    if (response?.engineState?.snapshot) {
      loadGameSnapshot(response.engineState.snapshot);
    }
    if (response?.success !== false) {
      setEffectName("");
      setEffectDuration("");
      setEffectStack(1);
    }
    setPendingEffects(false);
  };

  const removeStatusEffect = async (effect) => {
    if (!canDMEdit || pendingEffects) return;
    const name = typeof effect === "string" ? effect : effect?.name;
    if (!name) return;
    setPendingEffects(true);
    const response = await emitWithAck(socket, "campaign_updateCharacterStatusEffects", {
      playerID,
      campaignID: gameID,
      characterID: character.id,
      action: "remove",
      effect: name,
    });
    if (response?.engineState?.snapshot) {
      loadGameSnapshot(response.engineState.snapshot);
    }
    setPendingEffects(false);
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto scrollbar-transparent px-4 py-4 space-y-4">
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 space-y-3">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-300">
            {character.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{character.name}</h3>
            <p className="text-xs text-slate-400">
              Level {character.level || 1} {className} · {raceName}
            </p>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase">
            <span>EXP</span>
            <span>
              {expCurrent}/{expMax}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${Math.round(expRatio * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-800 p-2 text-center border border-red-900/50">
          <div className="flex justify-center text-red-400 mb-1"><Heart size={16} /></div>
          <div className="text-sm font-bold text-white">
            {character.HP?.current ?? character.hp ?? 0}
          </div>
          <div className="text-[8px] text-slate-500">/ {character.HP?.max ?? character.maxHP ?? 0}</div>
          <div className="text-[10px] text-slate-400 uppercase font-bold">HP</div>
          {isDM && (
            <div className="mt-2 flex items-center justify-center gap-1 text-[10px]">
              {[-5, -1, 1, 5].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  disabled={!canDMEdit || pendingResource}
                  onClick={() => applyResourceDelta("HP", delta)}
                  className="rounded border border-red-900/60 px-1.5 py-0.5 text-red-200 hover:bg-red-900/30 disabled:opacity-50"
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-slate-800 p-2 text-center border border-blue-900/50">
          <div className="flex justify-center text-blue-400 mb-1"><Zap size={14} /></div>
          <div className="text-sm font-bold text-white">
            {character.MP?.current ?? 0}
          </div>
          <div className="text-[8px] text-slate-500">/ {character.MP?.max ?? 0}</div>
          <div className="text-[10px] text-slate-400 uppercase font-bold">MP</div>
          {isDM && (
            <div className="mt-2 flex items-center justify-center gap-1 text-[10px]">
              {[-5, -1, 1, 5].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  disabled={!canDMEdit || pendingResource}
                  onClick={() => applyResourceDelta("MP", delta)}
                  className="rounded border border-blue-900/60 px-1.5 py-0.5 text-blue-200 hover:bg-blue-900/30 disabled:opacity-50"
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-slate-800 p-2 text-center border border-yellow-900/50">
          <div className="flex justify-center text-yellow-400 mb-1"><Zap size={14} /></div>
          <div className="text-sm font-bold text-white">
            {character.STA?.current ?? 0}
          </div>
          <div className="text-[8px] text-slate-500">/ {character.STA?.max ?? 0}</div>
          <div className="text-[10px] text-slate-400 uppercase font-bold">STA</div>
          {isDM && (
            <div className="mt-2 flex items-center justify-center gap-1 text-[10px]">
              {[-5, -1, 1, 5].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  disabled={!canDMEdit || pendingResource}
                  onClick={() => applyResourceDelta("STA", delta)}
                  className="rounded border border-yellow-900/60 px-1.5 py-0.5 text-yellow-200 hover:bg-yellow-900/30 disabled:opacity-50"
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Ability Scores</h4>
        <div className="grid grid-cols-3 gap-3">
          {STAT_KEYS.map((key) => (
            <div key={key} className="text-center bg-slate-800/50 rounded p-2">
              <div className="text-[10px] uppercase text-slate-500 font-bold">{key}</div>
              <div className="text-lg font-bold text-white">{stats[key]}</div>
              <div className="text-xs text-slate-400">{formatMod(getMod(stats[key]))}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
          <Shield size={14} /> Armor Ratings
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className="text-[10px] uppercase text-slate-400 mb-2">AR</div>
            {arEntries.length === 0 ? (
              <div className="text-xs text-slate-500 italic">This character has no AR.</div>
            ) : (
              renderDefenseList(arEntries, "No armor ratings.")
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-400 mb-2">Resistances</div>
            {renderDefenseList(resistanceEntries, "No resistances.")}
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-400 mb-2">Immunities</div>
            {renderDefenseList(immunityEntries, "No immunities.")}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase">Calculated</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-slate-800/50 p-2 text-center">
            <Gauge size={16} className="mx-auto text-emerald-300" />
            <div className="text-sm font-semibold text-white">{speed}</div>
            <div className="text-[10px] text-slate-400 uppercase">Speed</div>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-2 text-center">
            <Eye size={16} className="mx-auto text-sky-300" />
            <div className="text-sm font-semibold text-white">{visionRange}</div>
            <div className="text-[10px] text-slate-400 uppercase">Vision</div>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-2 text-center">
            <Sparkles size={16} className="mx-auto text-purple-300" />
            <div className="text-sm font-semibold text-white">{perception}</div>
            <div className="text-[10px] text-slate-400 uppercase">Perception</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase">Proficiencies</h4>
        <div className="text-[11px] text-slate-300">
          Proficiency Bonus: <span className="text-emerald-300">+{proficiencyBonus}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {proficiencyEntries.map(({ category, items }) => {
            if (!items.length) return null;
            return (
              <div key={category} className="rounded-lg border border-slate-700 bg-slate-800/40 p-2">
                <div className="text-[10px] uppercase text-slate-400 mb-2">
                  {toTitleCase(category)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <span
                      key={`${category}_${item}`}
                      className="rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-200"
                    >
                      {toTitleCase(item)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {!hasProficiencies && (
            <div className="text-xs text-slate-500 italic">No proficiencies listed.</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 space-y-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase">Effects & Passives</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-[10px] uppercase text-slate-400">Effects</div>
            {statusEffects.length === 0 ? (
              <div className="text-xs text-slate-500 italic">No active effects.</div>
            ) : (
              <div className="space-y-1">
                {statusEffects.map((effect, index) => {
                  const name = typeof effect === "string" ? effect : effect?.name || "Effect";
                  const duration =
                    typeof effect === "object" && effect?.duration != null
                      ? effect.duration
                      : null;
                  return (
                    <div
                      key={`${name}_${index}`}
                      className="flex items-center justify-between rounded border border-slate-700 bg-slate-800/40 px-2 py-1 text-[11px] text-slate-200"
                    >
                      <span>
                        {name}
                        {duration != null && (
                          <span className="ml-2 text-[10px] text-slate-400">
                            {duration === -1 ? "∞" : `(${duration})`}
                          </span>
                        )}
                      </span>
                      {isDM && (
                        <button
                          type="button"
                          disabled={!canDMEdit || pendingEffects}
                          onClick={() => removeStatusEffect(effect)}
                          className="text-[10px] text-red-300 hover:text-red-200 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isDM && (
              <div className="mt-2 space-y-2 rounded-lg border border-slate-700 bg-slate-900/70 p-2">
                <div className="text-[10px] uppercase text-slate-400">Add Effect</div>

                {/* Effect dropdown */}
                <select
                  value={effectName}
                  onChange={(e) => { setEffectName(e.target.value); setEffectError(""); }}
                  className="w-full rounded border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="">— Select an effect —</option>
                  {effectsList.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}{e.tier ? ` (${e.tier})` : ""}
                    </option>
                  ))}
                </select>

                {/* Description hint */}
                {effectName && (() => {
                  const sel = effectsList.find((e) => e.id === effectName);
                  return sel?.description ? (
                    <div className="text-[10px] text-slate-400 italic">{sel.description}</div>
                  ) : null;
                })()}

                {/* Stack count (only for stackable effects) */}
                {effectName && (() => {
                  const sel = effectsList.find((e) => e.id === effectName);
                  return sel?.stackable ? (
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-slate-400 whitespace-nowrap">Stacks</label>
                      <input
                        type="number"
                        min={1}
                        max={sel.maxStacks ?? 99}
                        value={effectStack}
                        onChange={(e) => setEffectStack(Math.max(1, Number(e.target.value)))}
                        className="w-20 rounded border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      />
                      {sel.maxStacks != null && (
                        <span className="text-[10px] text-slate-500">max {sel.maxStacks}</span>
                      )}
                    </div>
                  ) : null;
                })()}

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Duration (-1 = ∞)"
                    value={effectDuration}
                    onChange={(e) => setEffectDuration(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-slate-200 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={!canDMEdit || pendingEffects || !effectName}
                    onClick={addStatusEffect}
                    className="rounded border border-emerald-500/40 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>

                {/* Validation error */}
                {effectError && (
                  <div className="text-[10px] text-red-400">{effectError}</div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase text-slate-400 mb-2">Class Features</div>
              {classFeatures.length === 0 ? (
                <div className="text-xs text-slate-500 italic">None listed.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {classFeatures.map((feature, index) => {
                    const name = feature?.name || feature?.id || feature?.title || feature;
                    return (
                      <span
                        key={`class_${name}_${index}`}
                        className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-200"
                      >
                        {toTitleCase(name)}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="text-[10px] uppercase text-slate-400 mb-2">Race Features</div>
              {raceFeatures.length === 0 ? (
                <div className="text-xs text-slate-500 italic">None listed.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {raceFeatures.map((feature, index) => {
                    const name = feature?.name || feature?.id || feature?.title || feature;
                    return (
                      <span
                        key={`race_${name}_${index}`}
                        className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-200"
                      >
                        {toTitleCase(name)}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="text-[10px] uppercase text-slate-400 mb-2">Passive Abilities</div>
              {passiveSkills.length === 0 ? (
                <div className="text-xs text-slate-500 italic">None listed.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {passiveSkills.map((feature, index) => {
                    const name = feature?.name || feature?.id || feature?.title || feature;
                    return (
                      <span
                        key={`passive_${name}_${index}`}
                        className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-200"
                      >
                        {toTitleCase(name)}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
