
import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";

const toEntityID = (value) => String(value ?? "").trim();

const resolveFloorType = (floorTypesByID, id) => {
    const key = String(id || "").trim();
    if (!key) return null;
    if (floorTypesByID && typeof floorTypesByID.get === "function") {
        return floorTypesByID.get(key) || null;
    }
    if (floorTypesByID && typeof floorTypesByID === "object") {
        return floorTypesByID[key] || null;
    }
    return null;
};

const resolveOwnerEntry = (characterOwnershipById, characterId) => {
    if (!characterOwnershipById || !characterId) return null;
    const key = toEntityID(characterId);
    if (!key) return null;
    if (typeof characterOwnershipById.get === "function") {
        return characterOwnershipById.get(key) || null;
    }
    if (typeof characterOwnershipById === "object") {
        return characterOwnershipById[key] || null;
    }
    return null;
};

const toNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object") return Object.values(value);
    return [value];
};

const normalizeDefenseList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object") {
        return Object.entries(value)
            .filter(([, entry]) => Boolean(entry))
            .map(([key]) => key);
    }
    return [value];
};

const getStatScore = (stats, key) => {
    if (!stats) return 0;
    const direct =
        stats[key] ??
        stats[key?.toLowerCase?.()] ??
        stats[key?.toUpperCase?.()];
    if (direct && typeof direct === "object") {
        return toNumber(
            direct.score ?? direct.total ?? direct.value ?? direct.mod ?? direct.modifier,
            0
        );
    }
    return toNumber(direct, 0);
};

const getPerceptionScore = (character) => {
    if (!character) return 0;
    const direct = toNumber(character.perception, NaN);
    if (Number.isFinite(direct)) return direct;
    const skillValue = toNumber(character.skills?.perception, NaN);
    if (Number.isFinite(skillValue)) return skillValue;
    const wis = getStatScore(character.stats, "WIS");
    if (Number.isFinite(wis) && wis !== 0) return wis;
    const intScore = getStatScore(character.stats, "INT");
    return Number.isFinite(intScore) ? intScore : 0;
};

const getPassiveStealth = (character) => {
    if (!character) return 0;
    const dex = getStatScore(character.stats, "DEX");
    const wis = getStatScore(character.stats, "WIS");
    return dex + wis;
};

// Client-side range/obfuscation functions removed - server now handles all calculations
// Server sends pre-calculated range objects: { value, low, high, display }
// Client only displays the values using getDisplayValue() helper

export default function InfoWindows({
    infoPanels,
    setInfoPanels,
    clampInfoPanelPosition,
    closeInfoPanel,
    characters,
    mapObjects,
    floorTypesByID,
    isDM,
    updateMapObject,
    updateCharacter,
    minRectWorldSize = 8,
    minShapeWorldSize = 4,
    characterOwnershipById,
    playerID,
    selectedCharacterId,
}) {
    const [activePanelDrag, setActivePanelDrag] = useState(null);

    const clampPosition = useMemo(() => {
        if (typeof clampInfoPanelPosition === "function") {
            return clampInfoPanelPosition;
        }
        return (x, y) => ({ x: Math.round(x), y: Math.round(y) });
    }, [clampInfoPanelPosition]);

    const safeClosePanel = useMemo(() => {
        if (typeof closeInfoPanel === "function") return closeInfoPanel;
        return (key) => {
            if (typeof setInfoPanels !== "function") return;
            setInfoPanels((prev) => {
                if (!prev || typeof prev !== "object") return prev;
                const next = { ...prev };
                delete next[key];
                return next;
            });
        };
    }, [closeInfoPanel, setInfoPanels]);

    useEffect(() => {
        if (!activePanelDrag || typeof setInfoPanels !== "function") return undefined;
        const { key, offsetX, offsetY } = activePanelDrag;
        const onMouseMove = (e) => {
            const next = clampPosition(e.clientX - offsetX, e.clientY - offsetY);
            setInfoPanels((prev) =>
                prev && prev[key]
                    ? {
                          ...prev,
                          [key]: { ...prev[key], ...next },
                      }
                    : prev
            );
        };
        const onMouseUp = () => setActivePanelDrag(null);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [activePanelDrag, clampPosition, setInfoPanels]);

    useEffect(() => {
        if (typeof setInfoPanels !== "function") return undefined;
        const onResize = () => {
            setInfoPanels((prev) => {
                if (!prev || typeof prev !== "object") return prev;
                let changed = false;
                const next = {};
                Object.entries(prev).forEach(([key, panel]) => {
                    const clamped = clampPosition(panel.x, panel.y);
                    if (clamped.x !== panel.x || clamped.y !== panel.y) changed = true;
                    next[key] = { ...panel, ...clamped };
                });
                return changed ? next : prev;
            });
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [clampPosition, setInfoPanels]);

    useEffect(() => {
        if (typeof setInfoPanels !== "function") return undefined;
        setInfoPanels((prev) => {
            if (!prev || typeof prev !== "object") return prev;
            let changed = false;
            const next = {};
            Object.entries(prev).forEach(([key, panel]) => {
                const clamped = clampPosition(panel.x, panel.y);
                if (clamped.x !== panel.x || clamped.y !== panel.y) changed = true;
                next[key] = { ...panel, ...clamped };
            });
            return changed ? next : prev;
        });
    }, [clampPosition, setInfoPanels]);

    // Persist and restore panel positions so DM can move windows and have them remembered
    const savedPanelPositionsRef = useRef(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem("cc_infoPanelPositions");
            savedPanelPositionsRef.current = raw ? JSON.parse(raw) : {};
        } catch (e) {
            savedPanelPositionsRef.current = {};
        }
    }, []);

    // When panels first appear or change, apply any saved positions
    useEffect(() => {
        if (!savedPanelPositionsRef.current || typeof setInfoPanels !== "function") return;
        setInfoPanels((prev) => {
            if (!prev || typeof prev !== "object") return prev;
            let changed = false;
            const next = { ...prev };
            Object.entries(next).forEach(([key, panel]) => {
                const saved = savedPanelPositionsRef.current[key];
                if (saved && (panel.x !== saved.x || panel.y !== saved.y)) {
                    next[key] = { ...panel, x: saved.x, y: saved.y };
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [infoPanels, setInfoPanels]);

    // Save positions whenever panels move
    useEffect(() => {
        try {
            const map = {};
            Object.entries(infoPanels || {}).forEach(([key, panel]) => {
                if (panel && typeof panel === "object" && Number.isFinite(Number(panel.x)) && Number.isFinite(Number(panel.y))) {
                    map[key] = { x: panel.x, y: panel.y };
                }
            });
            localStorage.setItem("cc_infoPanelPositions", JSON.stringify(map));
        } catch (e) {
            // ignore
        }
    }, [infoPanels]);

    const panels = infoPanels && typeof infoPanels === "object" ? infoPanels : {};
    const entries = Object.entries(panels);

    if (entries.length === 0) return null;

    const panelClass =
        "absolute rounded-xl border border-website-highlights-500/30 bg-website-default-900/95 text-website-default-100 shadow-[0_18px_45px_rgba(15,52,96,0.35)] ring-1 ring-website-default-700/60 backdrop-blur-md z-[132] resize overflow-auto font-body text-[12px]";
    const panelStyleBase = { minWidth: 280, minHeight: 60 };

    return (
        <>
            {entries.map(([key, panel]) => {
                const { type, id, x, y } = panel;
                const headerBar = (label) => (
                                <div
                                    className="px-3 py-2 border-b border-website-highlights-500/30 flex items-center justify-between bg-gradient-to-r from-website-default-900/95 via-website-default-900/85 to-website-highlights-500/15 backdrop-blur-sm rounded-t select-none"
                                >
                                    <div
                                        className="flex items-center gap-2 cursor-move"
                                        onMouseDown={(e) => {
                                            if (e.button !== 0) return;
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setActivePanelDrag({
                                                key,
                                                offsetX: e.clientX - x,
                                                offsetY: e.clientY - y,
                                            });
                                        }}
                                        title="Drag to move"
                                    >
                                        <div className="w-6 h-6 flex items-center justify-center rounded bg-website-highlights-500/20 text-website-highlights-200">|||</div>
                                        <p className="text-[13px] font-semibold text-website-default-100">{label}</p>
                                    </div>
                                    <button
                                        type="button"
                                        aria-label="Close"
                                        onClick={() => safeClosePanel(key)}
                                        className="text-[11px] text-website-default-200 hover:text-website-default-100 px-2 py-1 rounded hover:bg-website-highlights-500/15"
                                    >
                                        X
                                    </button>
                                </div>
                            );

                const panelStyle = { ...panelStyleBase, left: x, top: y };

                if (type === "character") {
                    const char = (Array.isArray(characters) ? characters : []).find(
                        (c) => toEntityID(c?.id) === toEntityID(id)
                    );
                    if (!char) return null;
                    
                    const ownerEntry = resolveOwnerEntry(characterOwnershipById, char.id);
                    const ownerId = toEntityID(
                        ownerEntry?.playerId || ownerEntry?.playerID
                    );
                    const isOwnedByPlayer = ownerId && ownerId === toEntityID(playerID);
                    const ownerLabel = ownerEntry
                        ? isOwnedByPlayer
                            ? "You"
                            : ownerEntry.playerName ||
                              ownerEntry.playerId ||
                              ownerEntry.playerID ||
                              "Teammate"
                        : null;
                    const normalizedPlayerId = toEntityID(playerID);
                    const isTeammate = Boolean(ownerEntry) && !isOwnedByPlayer;
                    const isEnemy = String(char.team || "").toLowerCase() === "enemy";
                    const shouldObfuscate = !isDM && isEnemy && !isOwnedByPlayer && !isTeammate;

                    console.log(`[CLIENT PANEL] ${char.name}: isDM=${isDM}, isEnemy=${isEnemy}, isOwned=${isOwnedByPlayer}, isTeammate=${isTeammate}, shouldObfuscate=${shouldObfuscate}`);

                    const selectedOwnedCharacterId = selectedCharacterId
                        ? (() => {
                              const selectedOwner = resolveOwnerEntry(
                                  characterOwnershipById,
                                  selectedCharacterId
                              );
                              const selectedOwnerId = toEntityID(
                                  selectedOwner?.playerId || selectedOwner?.playerID
                              );
                              return selectedOwnerId && selectedOwnerId === normalizedPlayerId
                                  ? selectedCharacterId
                                  : null;
                          })()
                        : null;

                    const fallbackOwnedCharacterId = selectedOwnedCharacterId
                        ? null
                        : (Array.isArray(characters) ? characters : []).find((entry) => {
                              const owner = resolveOwnerEntry(characterOwnershipById, entry?.id);
                              const ownerId = toEntityID(owner?.playerId || owner?.playerID);
                              return ownerId && ownerId === normalizedPlayerId;
                          })?.id;

                    const viewerCharacterId =
                        selectedOwnedCharacterId || fallbackOwnedCharacterId || null;
                    const viewerCharacter = viewerCharacterId
                        ? (Array.isArray(characters) ? characters : []).find(
                              (entry) => toEntityID(entry?.id) === toEntityID(viewerCharacterId)
                          )
                        : null;
                    
                    // Server sends pre-calculated perception data for obfuscated enemies
                    const perceptionScore = getPerceptionScore(viewerCharacter);
                    const stealthPassive = char._stealthPassive !== undefined 
                        ? toNumber(char._stealthPassive, 0) 
                        : getPassiveStealth(char);
                    const perceptionRatio = char._perceptionRatio !== undefined 
                        ? toNumber(char._perceptionRatio, 0) 
                        : (stealthPassive > 0 ? Math.max(0, Math.min(1, perceptionScore / stealthPassive)) : 1);
                    const visibilityError = char._visibilityError !== undefined 
                        ? char._visibilityError 
                        : null;
                    
                    console.log(`[CLIENT DISPLAY] ${char.name}: perception=${perceptionScore}, stealth=${stealthPassive}, ratio=${(perceptionRatio*100).toFixed(1)}%, error=${visibilityError}`);

                    // NEVER provide defaults - only use what server sends
                    const hp = char.HP || null;
                    const mp = char.MP || null;
                    const sta = char.STA || null;
                    const stats = char.stats || null;
                    const actionPoints = char.actionPoints || null;
                    const statusEffects = normalizeList(
                        char.statusEffects ?? char.effects ?? char.statuses ?? char.conditions
                    );
                    const statusLabels = statusEffects
                        .map((effect) => effect?.name || effect?.id || effect?.title || effect?.label || effect)
                        .filter(Boolean);
                    const passiveSkills = normalizeList(char.skills?.passive || []);
                    const passiveLabels = passiveSkills
                        .map((feature) => feature?.name || feature?.id || feature?.title || feature?.label || feature)
                        .filter(Boolean);
                    const resistanceEntries = normalizeDefenseList(
                        char.resistances || char.defenses?.resistances
                    );
                    const immunityEntries = normalizeDefenseList(
                        char.immunities || char.defenses?.immunities
                    );
                    
                    const getMod = (val) => Math.floor((val - 10) / 2);
                    const formatMod = (val) => (val >= 0 ? `+${val}` : val);

                    // Helper to extract display value from server-calculated range objects
                    const getDisplayValue = (value) => {
                        if (value === null || value === undefined) return '?';
                        if (typeof value === 'object' && value.display !== undefined) {
                            return value.display; // Server-calculated range
                        }
                        return String(value); // Exact value
                    };

                    if (shouldObfuscate) {
                        const canSeeAnything = char._visibilityError !== null;
                        // Only show sections if server actually sent the data
                        const showHp = hp !== null;
                        const showStatus = char.statusEffects !== undefined;
                        const showMpSta = mp !== null && sta !== null;
                        const showRaceClass = char.race !== undefined;
                        const showLevelMaxHp = char.level !== undefined && hp !== null;
                        const showMaxMpSta = mp !== null && sta !== null;
                        const showPassives = char.skills !== undefined;
                        const showDefense = char.AR !== undefined;
                        const showStats = stats !== null;

                        console.log(`[CLIENT DISPLAY] ${char.name}: Displaying server-calculated values, error=${char._visibilityError}`);
                        console.log(`[CLIENT DATA] ${char.name}: hp=${!!hp}, mp=${!!mp}, sta=${!!sta}, stats=${!!stats}, race=${!!char.race}, AR=${!!char.AR}`);

                        if (!canSeeAnything) {
                            return (
                                <div
                                    key={key}
                                    className={panelClass}
                                    style={{ ...panelStyle, minWidth: 300 }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    {headerBar("Unknown")}
                                    <div className="px-3 py-3 text-[11px]">
                                        <div className="rounded-lg border border-website-specials-500/30 bg-website-default-800/40 p-3">
                                            <p className="text-[11px] font-semibold text-website-specials-300">
                                                No Read
                                            </p>
                                            <p className="text-[10px] text-website-default-400">
                                                Target is too elusive to identify.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={key}
                                className={panelClass}
                                style={{ ...panelStyle, minWidth: 320 }}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                {headerBar(char.name || "Enemy")}
                                <div className="px-3 py-3 text-[11px] space-y-3">
                                    {(showHp || showMpSta || showLevelMaxHp || showMaxMpSta) && (
                                        <div className="rounded-lg border border-website-default-700/40 bg-website-default-800/35 p-2">
                                            <p className="text-[10px] text-website-highlights-300 uppercase tracking-[0.24em] font-semibold mb-2">
                                                Vitals
                                            </p>
                                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                {showHp && hp && (
                                                    <p>
                                                        HP:{" "}
                                                        <span className="text-website-specials-200 font-semibold">
                                                            {getDisplayValue(hp.current)}
                                                        </span>
                                                    </p>
                                                )}
                                                {showLevelMaxHp && hp && (
                                                    <p>
                                                        Max HP:{" "}
                                                        <span className="text-website-specials-200 font-semibold">
                                                            {getDisplayValue(hp.max)}
                                                        </span>
                                                    </p>
                                                )}
                                                {showMpSta && mp && (
                                                    <p>
                                                        MP:{" "}
                                                        <span className="text-website-highlights-200 font-semibold">
                                                            {getDisplayValue(mp.current)}
                                                        </span>
                                                    </p>
                                                )}
                                                {showMaxMpSta && mp && (
                                                    <p>
                                                        Max MP:{" "}
                                                        <span className="text-website-highlights-200 font-semibold">
                                                            {getDisplayValue(mp.max)}
                                                        </span>
                                                    </p>
                                                )}
                                                {showMpSta && sta && (
                                                    <p>
                                                        STA:{" "}
                                                        <span className="text-website-default-100 font-semibold">
                                                            {getDisplayValue(sta.current)}
                                                        </span>
                                                    </p>
                                                )}
                                                {showMaxMpSta && sta && (
                                                    <p>
                                                        Max STA:{" "}
                                                        <span className="text-website-default-100 font-semibold">
                                                            {getDisplayValue(sta.max)}
                                                        </span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {(showRaceClass || showLevelMaxHp) && (
                                        <div className="rounded-lg border border-website-default-700/40 bg-website-default-800/35 p-2">
                                            <p className="text-[10px] text-website-highlights-300 uppercase tracking-[0.24em] font-semibold mb-2">
                                                Identity
                                            </p>
                                            <div className="space-y-1 text-[11px]">
                                                {showRaceClass && (
                                                    <p>
                                                        Race:{" "}
                                                        <span className="text-website-default-100 font-semibold">
                                                            {getDisplayValue(char.race) || "Unknown"}
                                                        </span>
                                                    </p>
                                                )}
                                                {showRaceClass && (
                                                    <p>
                                                        Class:{" "}
                                                        <span className="text-website-default-100 font-semibold">
                                                            {getDisplayValue(char.classType) || "Unknown"}
                                                        </span>
                                                    </p>
                                                )}
                                                {showLevelMaxHp && (
                                                    <p>
                                                        Level:{" "}
                                                        <span className="text-website-default-100 font-semibold">
                                                            {getDisplayValue(char.level) || 1}
                                                        </span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {showPassives && (
                                        <div className="rounded-lg border border-website-default-700/40 bg-website-default-800/35 p-2">
                                            <p className="text-[10px] text-website-highlights-300 uppercase tracking-[0.24em] font-semibold mb-2">
                                                Passives
                                            </p>
                                            {visibilityError && visibilityError > 0 ? (
                                                <p className="text-[11px] text-website-default-200">
                                                    Passive abilities:{" "}
                                                    <span className="text-website-highlights-200 font-semibold">
                                                        {getDisplayValue(passiveLabels.length)}
                                                    </span>
                                                </p>
                                            ) : passiveLabels.length === 0 ? (
                                                <p className="text-[11px] text-website-default-400">None observed.</p>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {passiveLabels.map((label, index) => (
                                                        <span
                                                            key={`passive_${label}_${index}`}
                                                            className="rounded-full bg-website-default-900/60 px-2 py-0.5 text-[10px] text-website-default-200"
                                                        >
                                                            {label}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {showDefense && (
                                        <div className="rounded-lg border border-website-default-700/40 bg-website-default-800/35 p-2">
                                            <p className="text-[10px] text-website-highlights-300 uppercase tracking-[0.24em] font-semibold mb-2">
                                                Defense
                                            </p>
                                            <div className="space-y-1 text-[11px]">
                                                {(char.AR?.physical?.total !== undefined && char.AR?.physical?.total !== null) && (
                                                    <p>
                                                        AR:{" "}
                                                        <span className="text-website-default-100 font-semibold">
                                                            {getDisplayValue(char.AR.physical.total)}
                                                        </span>
                                                    </p>
                                                )}
                                                <p>
                                                    Resistances:{" "}
                                                    <span className="text-website-default-100 font-semibold">
                                                        {visibilityError && visibilityError > 0
                                                            ? getDisplayValue(resistanceEntries.length)
                                                            : resistanceEntries.length
                                                            ? resistanceEntries.join(", ")
                                                            : "None"}
                                                    </span>
                                                </p>
                                                <p>
                                                    Immunities:{" "}
                                                    <span className="text-website-default-100 font-semibold">
                                                        {visibilityError && visibilityError > 0
                                                            ? getDisplayValue(immunityEntries.length)
                                                            : immunityEntries.length
                                                            ? immunityEntries.join(", ")
                                                            : "None"}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {showStatus && (
                                        <div className="rounded-lg border border-website-default-700/40 bg-website-default-800/35 p-2">
                                            <p className="text-[10px] text-website-highlights-300 uppercase tracking-[0.24em] font-semibold mb-2">
                                                Status Effects
                                            </p>
                                            {statusLabels.length === 0 ? (
                                                <p className="text-[11px] text-website-default-400">
                                                    None observed.
                                                </p>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {statusLabels.map((label, index) => (
                                                        <span
                                                            key={`status_${label}_${index}`}
                                                            className="rounded-full bg-website-default-900/60 px-2 py-0.5 text-[10px] text-website-default-200"
                                                        >
                                                            {label}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {showStats && stats && (
                                        <div className="rounded-lg border border-website-default-700/40 bg-website-default-800/35 p-2">
                                            <p className="text-[10px] text-website-highlights-300 uppercase tracking-[0.24em] font-semibold mb-2">
                                                Ability Scores
                                            </p>
                                            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                                                {Object.entries(stats).map(([key, val]) => {
                                                    const displayValue = getDisplayValue(val);
                                                    return (
                                                        <div key={key} className="bg-website-default-900/50 rounded p-1 text-center border border-website-default-700/50">
                                                            <div className="uppercase text-website-default-500 font-semibold text-[8px]">{key}</div>
                                                            <div className="font-semibold text-website-default-100">{displayValue}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {shouldObfuscate && (
                                        <div className="rounded-lg border border-website-default-700/40 bg-website-default-800/35 p-2">
                                            <p className="text-[10px] text-website-highlights-300 uppercase tracking-[0.24em] font-semibold mb-2">
                                                Perception Check
                                            </p>
                                            <div className="text-[10px] space-y-1">
                                                <p className="text-website-default-400">
                                                    Your Perception: <span className="text-website-highlights-300 font-semibold">{perceptionScore}</span>
                                                </p>
                                                <p className="text-website-default-400">
                                                    Target Stealth: <span className="text-website-specials-300 font-semibold">{stealthPassive}</span>
                                                </p>
                                                <p className="text-website-default-400">
                                                    Detection Ratio: <span className="text-website-default-100 font-semibold">{(perceptionRatio * 100).toFixed(0)}%</span>
                                                </p>
                                                {visibilityError !== null && visibilityError > 0 && (
                                                    <p className="text-website-default-500 text-[9px] italic">
                                                        ±{(visibilityError * 100).toFixed(0)}% margin of error
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div
                            key={key}
                            className={panelClass}
                            style={{ ...panelStyle, minWidth: 340 }}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            {headerBar(char.name || "Character")}
                            <div className="px-3 py-2 text-[11px] space-y-4">
                                {/* Basic Info */}
                                <div className="rounded-lg border border-website-default-700/40 bg-website-default-800/35 p-2">
                                    <p className="text-[10px] text-website-highlights-300 uppercase tracking-[0.24em] font-semibold mb-1">Basic Info</p>
                                    <div className="space-y-1 text-[11px]">
                                        <p><span className="text-website-default-400">Level:</span> <span className="text-website-default-100 font-semibold">{char.level || 1}</span></p>
                                        <p><span className="text-website-default-400">Class:</span> <span className="text-website-default-100 font-semibold">{char.classType || "Unknown"}</span></p>
                                        <p><span className="text-website-default-400">Race:</span> <span className="text-website-default-100 font-semibold">{char.race || "Unknown"}</span></p>
                                        <p><span className="text-website-default-400">Team:</span> <span className="text-website-default-100 font-semibold capitalize">{char.team || "Neutral"}</span></p>
                                        {ownerLabel && <p><span className="text-website-default-400">Owner:</span> <span className="text-website-default-100 font-semibold">{ownerLabel}</span></p>}
                                    </div>
                                </div>
                                
                                {/* Resources */}
                                {(hp || mp || sta) && (
                                    <div className="rounded-lg border border-website-default-700/40 bg-website-default-800/35 p-2">
                                        <p className="text-[10px] text-website-highlights-300 uppercase tracking-[0.24em] font-semibold mb-2">Resources</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {hp && (
                                                <div className="bg-website-specials-500/10 rounded p-1.5 border border-website-specials-500/50 ring-1 ring-website-specials-500/20">
                                                    <div className="text-[10px] text-website-specials-300 uppercase font-semibold">HP</div>
                                                    <div className="text-sm font-semibold text-website-default-100">{hp.current}</div>
                                                    <div className="text-[9px] text-website-default-500">/ {hp.max}</div>
                                                </div>
                                            )}
                                            {mp && (
                                                <div className="bg-website-highlights-500/10 rounded p-1.5 border border-website-highlights-500/50 ring-1 ring-website-highlights-500/20">
                                                    <div className="text-[10px] text-website-highlights-300 uppercase font-semibold">MP</div>
                                                    <div className="text-sm font-semibold text-website-default-100">{mp.current}</div>
                                                    <div className="text-[9px] text-website-default-500">/ {mp.max}</div>
                                                </div>
                                            )}
                                            {sta && (
                                                <div className="bg-website-default-700/30 rounded p-1.5 border border-website-default-600/40 ring-1 ring-website-default-600/20">
                                                    <div className="text-[10px] text-website-default-300 uppercase font-semibold">STA</div>
                                                    <div className="text-sm font-semibold text-website-default-100">{sta.current}</div>
                                                    <div className="text-[9px] text-website-default-500">/ {sta.max}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Combat Stats */}
                                <div className="rounded-lg border border-website-default-700/40 bg-website-default-800/35 p-2">
                                    <p className="text-[10px] text-website-highlights-300 uppercase tracking-[0.24em] font-semibold mb-2">Combat</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-website-default-900/50 rounded p-1.5 border border-website-default-700/50 ring-1 ring-website-default-600/20">
                                            <div className="text-[10px] text-website-default-400 uppercase font-semibold">AR</div>
                                            <div className="text-sm font-semibold text-website-default-100">{char.AR?.physical?.total ?? 0}</div>
                                        </div>
                                        <div className="bg-website-default-900/50 rounded p-1.5 border border-website-default-700/50 ring-1 ring-website-default-600/20">
                                            <div className="text-[10px] text-website-default-400 uppercase font-semibold">Speed</div>
                                            <div className="text-sm font-semibold text-website-default-100">{char.movement || 30} ft</div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Action Points - Only for owner or DM */}
                                {(isOwnedByPlayer || isDM) && actionPoints && (actionPoints.action !== undefined || actionPoints.bonusAction !== undefined || actionPoints.movement !== undefined) && (
                                    <div className="rounded-lg border border-website-default-700/40 bg-website-default-800/35 p-2">
                                        <p className="text-[10px] text-website-highlights-300 uppercase tracking-[0.24em] font-semibold mb-1">Actions</p>
                                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                                            {actionPoints.action !== undefined && <p><span className="text-website-default-400">Action:</span> <span className="text-website-default-100 font-semibold">{actionPoints.action}</span></p>}
                                            {actionPoints.bonusAction !== undefined && <p><span className="text-website-default-400">Bonus:</span> <span className="text-website-default-100 font-semibold">{actionPoints.bonusAction}</span></p>}
                                            {actionPoints.movement !== undefined && <p><span className="text-website-default-400">Move:</span> <span className="text-website-default-100 font-semibold">{actionPoints.movement}</span></p>}
                                            {actionPoints.reaction !== undefined && <p><span className="text-website-default-400">React:</span> <span className="text-website-default-100 font-semibold">{actionPoints.reaction}</span></p>}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Ability Scores */}
                                {stats && (
                                    <div className="rounded-lg border border-website-default-700/40 bg-website-default-800/35 p-2">
                                        <p className="text-[10px] text-website-highlights-300 uppercase tracking-[0.24em] font-semibold mb-2">Ability Scores</p>
                                        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                                            {Object.entries(stats).map(([key, val]) => {
                                                const statValue = typeof val === 'object' ? (val.total ?? val.score ?? 0) : (val ?? 0);
                                                return (
                                                    <div key={key} className="bg-website-default-900/50 rounded p-1 text-center border border-website-default-700/50 ring-1 ring-website-highlights-500/10">
                                                        <div className="uppercase text-website-default-500 font-semibold text-[8px]">{key}</div>
                                                        <div className="font-semibold text-website-default-100">{statValue}</div>
                                                        <div className="text-website-default-400 text-[8px]">{formatMod(getMod(statValue))}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Position & Vision Info - DM only */}
                                {isDM && (
                                    <div className="text-[10px] rounded-lg border border-website-default-700/40 bg-website-default-800/35 p-2">
                                        <p className="text-website-default-400">Position: <span className="text-website-default-100 font-semibold">({Math.round(Number(char?.position?.x) || 0)}, {Math.round(Number(char?.position?.y) || 0)})</span></p>
                                        <p className="text-website-default-400">Size: <span className="text-website-default-100 font-semibold">{Math.round(Number(char?.size) || 0)}</span></p>
                                        <p className="text-website-default-400">Vision: <span className="text-website-default-100 font-semibold">{Math.round(Number(char?.visionDistance) || 0)} ft @ {Math.round(Number(char?.visionArc) || 0)} deg</span></p>
                                        <div className="mt-2 space-y-1">
                                            <p className="text-website-default-400">
                                                Light Level:{" "}
                                                <span className="text-website-default-100 font-mono font-semibold">
                                                    {(Number(char?.lightLevel) || 0.5).toFixed(2)}
                                                </span>
                                            </p>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                defaultValue={Number(char?.lightLevel) || 0.5}
                                                onChange={(e) => {
                                                    const newLightLevel = parseFloat(e.target.value);
                                                    if (typeof updateCharacter === "function") {
                                                        updateCharacter(char.id, {
                                                            lightLevel: newLightLevel,
                                                        });
                                                    }
                                                }}
                                                className="w-full h-2 bg-website-default-700 rounded appearance-none cursor-pointer"
                                                title="Adjust light level (0=dark, 1=bright)"
                                            />
                                            <div className="flex justify-between text-[8px] text-website-default-500">
                                                <span>Dark</span>
                                                <span>Bright</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }

                if (type === "mapObject") {
                    const obj = (Array.isArray(mapObjects) ? mapObjects : []).find(
                        (o) => toEntityID(o?.id) === toEntityID(id)
                    );
                    if (!obj) return null;
                    const floorType = resolveFloorType(floorTypesByID, obj?.floorTypeId);
                    return (
                        <div
                            key={key}
                            className={panelClass}
                            style={panelStyle}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            {headerBar("Map Object")}
                            <div className="px-3 py-2 text-[11px] space-y-2">
                                <p className="text-[12px] font-semibold text-website-highlights-200">
                                    {String(obj?.type || "object")} #{obj?.id}
                                </p>
                                <p>
                                    Position: ({Math.round(Number(obj?.x) || 0)},{" "}
                                    {Math.round(Number(obj?.y) || 0)})
                                </p>
                                <p>Terrain: {String(obj?.terrainType || "obstacle")}</p>
                                <p>Z Level: {Math.round(Number(obj?.zLevel) || 0)}</p>
                                <p>Z Index: {Math.round(Number(obj?.z) || 0)}</p>
                                <p>
                                    Elevation Height:{" "}
                                    {Math.round(Number(obj?.elevationHeight) || 0)}
                                </p>
                                {String(obj?.type || "").toLowerCase() === "rect" ? (
                                    <p>
                                        Footprint: {Math.round(Number(obj?.width) || 0)} x{" "}
                                        {Math.round(Number(obj?.height) || 0)}
                                    </p>
                                ) : (
                                    <p>Footprint Diameter: {Math.round(Number(obj?.size) || 0)}</p>
                                )}
                                <p>
                                    Floor Type: {floorType?.name || String(obj?.floorTypeId || "none")}
                                </p>
                                <p>
                                    HP:{" "}
                                    {obj?.maxHP == null
                                        ? "Indestructible"
                                        : `${Math.round(Number(obj?.hp) || 0)} / ${Math.round(
                                              Number(obj?.maxHP) || 0
                                          )}`}
                                </p>
                                {isDM && typeof updateMapObject === "function" && (
                                    <div className="mt-3 rounded-lg border border-website-default-700/40 bg-website-default-800/30 p-2 space-y-2">
                                        <div className="grid grid-cols-2 gap-2 items-center">
                                            <label className="text-[11px] text-website-default-300">
                                                Object Height
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={Math.round(Number(obj?.elevationHeight) || 0)}
                                                onChange={(e) =>
                                                    updateMapObject(obj.id, {
                                                        elevationHeight: Math.max(
                                                            0,
                                                            Number(e.target.value) || 0
                                                        ),
                                                    })
                                                }
                                                className="w-full rounded bg-website-default-900 border border-website-default-700 px-2 py-1 text-xs text-website-default-100"
                                            />
                                        </div>
                                        {String(obj?.type || "").toLowerCase() === "rect" ? (
                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    type="number"
                                                    min={minRectWorldSize}
                                                    value={Math.round(Number(obj?.width) || 0)}
                                                    onChange={(e) =>
                                                        updateMapObject(obj.id, {
                                                            width: Math.max(
                                                                minRectWorldSize,
                                                                Number(e.target.value) || 0
                                                            ),
                                                        })
                                                    }
                                                    className="w-full rounded bg-website-default-900 border border-website-default-700 px-2 py-1 text-xs text-website-default-100"
                                                />
                                                <input
                                                    type="number"
                                                    min={minRectWorldSize}
                                                    value={Math.round(Number(obj?.height) || 0)}
                                                    onChange={(e) =>
                                                        updateMapObject(obj.id, {
                                                            height: Math.max(
                                                                minRectWorldSize,
                                                                Number(e.target.value) || 0
                                                            ),
                                                        })
                                                    }
                                                    className="w-full rounded bg-website-default-900 border border-website-default-700 px-2 py-1 text-xs text-website-default-100"
                                                />
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-2 items-center">
                                                <label className="text-[11px] text-website-default-300">
                                                    Footprint Size
                                                </label>
                                                <input
                                                    type="number"
                                                    min={minShapeWorldSize}
                                                    value={Math.round(Number(obj?.size) || 0)}
                                                    onChange={(e) =>
                                                        updateMapObject(obj.id, {
                                                            size: Math.max(
                                                                minShapeWorldSize,
                                                                Number(e.target.value) || 0
                                                            ),
                                                        })
                                                    }
                                                    className="w-full rounded bg-website-default-900 border border-website-default-700 px-2 py-1 text-xs text-website-default-100"
                                                />
                                            </div>
                                        )}
                                        <p className="text-[11px] text-website-default-400">
                                            Tip: drag corner handles to resize footprint.
                                        </p>
                                    </div>
                                )}
                                {floorType?.description && (
                                    <p className="text-website-default-300">Info: {floorType.description}</p>
                                )}
                            </div>
                        </div>
                    );
                }

                return null;
            })}
        </>
    );
}
