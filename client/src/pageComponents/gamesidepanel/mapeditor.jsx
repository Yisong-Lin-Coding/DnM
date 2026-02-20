import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useGame } from "../../data/gameContext";
import { SocketContext } from "../../socket.io/context";
import { emitWithAck } from "../../pages/campaign/socketEmit";

const DEFAULT_MAX_HP_BY_TERRAIN = {
    floor: 500,
    wall: 1200,
    obstacle: 700,
};

const DEFAULT_ELEVATION_HEIGHT_BY_TERRAIN = {
    floor: 0,
    wall: 150,
    obstacle: 80,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const LIGHT_WHEEL_SIZE = 92;
const LIGHT_WHEEL_INNER_MARGIN = 12;
const LIGHT_WHEEL_KNOB_SIZE = 16;
const LIGHT_WHEEL_DEADZONE = 0.12;

const clampDirectionalToUnitDisk = (xValue, yValue) => {
    const x = clamp(toNumber(xValue, 0), -1, 1);
    const y = clamp(toNumber(yValue, 0), -1, 1);
    const magnitude = Math.hypot(x, y);
    if (magnitude === 0 || magnitude <= 1) {
        return { x, y };
    }
    return {
        x: x / magnitude,
        y: y / magnitude,
    };
};

const withFixedDirectionalX = (nextXValue, currentYValue) => {
    const nextX = clamp(toNumber(nextXValue, 0), -1, 1);
    const currentY = clamp(toNumber(currentYValue, 0), -1, 1);
    const maxY = Math.sqrt(Math.max(0, 1 - nextX * nextX));
    return {
        x: nextX,
        y: clamp(currentY, -maxY, maxY),
    };
};

const withFixedDirectionalY = (nextYValue, currentXValue) => {
    const nextY = clamp(toNumber(nextYValue, 0), -1, 1);
    const currentX = clamp(toNumber(currentXValue, 0), -1, 1);
    const maxX = Math.sqrt(Math.max(0, 1 - nextY * nextY));
    return {
        x: clamp(currentX, -maxX, maxX),
        y: nextY,
    };
};

function MapEditor() {
    const socket = useContext(SocketContext);
    const { gameID } = useParams();
    const playerID = localStorage.getItem("player_ID");

    const {
          isDM,
    worldMouseCoords,
    mapObjects,
    updateMapObject,
    deleteMapObject,
    replaceAllMapObjects,
    currentMapId,
    backgroundKey,
    setBackgroundKey,
    backgroundOptions,
    mapImageOptions,
    floorTypes,
    lighting,
    replaceLighting,
    addLightSource,
    updateLightSource,
    removeLightSource,
    armLightPlacement,  // ADD THIS
    mapObjectPlacement,
    armMapObjectPlacement,
    clearMapObjectPlacement,
    placePendingMapObjectAt,
    currentZLevel,
    stepZLevelUp,
    stepZLevelDown,
    characters,
    } = useGame();

    const [selectedObject, setSelectedObject] = useState(null);
    const [creationDraft, setCreationDraft] = useState({
        type: "circle",
        terrainType: "obstacle",
        floorTypeId: "woodenCrate",
        zLevel: 0,
        color: "#3B82F6",
        z: 0,
        size: 30,
        width: 50,
        height: 40,
        mapAssetKey: "",
        elevationHeight: 80,
        maxHP: 700,
        hp: 700,
        hitboxScale: 1,
    });
    const [saveName, setSaveName] = useState("");
    const [saveDescription, setSaveDescription] = useState("");
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");
    const [selectedLightID, setSelectedLightID] = useState("");
    const [directionWheelDragging, setDirectionWheelDragging] = useState(false);
    const directionWheelRef = useRef(null);

    const selectedPlacementType = mapObjectPlacement?.type || "";

    const placementLabel = useMemo(() => {
        if (!mapObjectPlacement) return "";
        return `${mapObjectPlacement.type} / ${mapObjectPlacement.terrainType || "obstacle"} / L${mapObjectPlacement.zLevel ?? 0} @ (${Math.round(worldMouseCoords?.x || 0)}, ${Math.round(worldMouseCoords?.y || 0)})`;
    }, [mapObjectPlacement, worldMouseCoords]);

    const floorTypesByTerrain = useMemo(() => {
        const byTerrain = {
            floor: [],
            wall: [],
            obstacle: [],
        };
        (Array.isArray(floorTypes) ? floorTypes : []).forEach((entry) => {
            const terrain = String(entry?.terrainType || "obstacle").toLowerCase();
            if (!byTerrain[terrain]) return;
            byTerrain[terrain].push(entry);
        });
        return byTerrain;
    }, [floorTypes]);

    const creationFloorTypeOptions = useMemo(() => {
        const terrain = String(creationDraft.terrainType || "obstacle").toLowerCase();
        const typedList = floorTypesByTerrain[terrain] || [];
        if (typedList.length > 0) return typedList;
        return Array.isArray(floorTypes) ? floorTypes : [];
    }, [creationDraft.terrainType, floorTypesByTerrain, floorTypes]);
    const availableMapImages = useMemo(
        () =>
            (Array.isArray(mapImageOptions) ? mapImageOptions : [])
                .map((entry) => String(entry || "").trim().toLowerCase())
                .filter(Boolean),
        [mapImageOptions]
    );

    useEffect(() => {
        setCreationDraft((prev) => ({ ...prev, zLevel: currentZLevel }));
    }, [currentZLevel]);

    useEffect(() => {
        setCreationDraft((prev) => {
            const terrain = String(prev.terrainType || "obstacle").toLowerCase();
            const available = floorTypesByTerrain[terrain] || [];
            if (!available.length) return prev;
            const stillValid = available.some((entry) => entry.id === prev.floorTypeId);
            if (stillValid) return prev;
            return {
                ...prev,
                floorTypeId: available[0].id,
            };
        });
    }, [floorTypesByTerrain, creationDraft.terrainType]);

    const normalizedLighting = useMemo(() => {
        const safe = lighting && typeof lighting === "object" ? lighting : {};
        return {
            enabled: safe.enabled !== false,
            ambient: clamp(toNumber(safe.ambient, 0.24), 0, 0.9),
            shadowEnabled: safe.shadowEnabled !== false,
            shadowStrength: clamp(toNumber(safe.shadowStrength, 0.62), 0, 1),
            shadowSoftness: clamp(toNumber(safe.shadowSoftness, 0.55), 0, 1),
            shadowLength: clamp(toNumber(safe.shadowLength, 0.9), 0, 2),
            shadowBlend: clamp(toNumber(safe.shadowBlend, 0.68), 0, 1),
            sources: Array.isArray(safe.sources) ? safe.sources : [],
        };
    }, [lighting]);

    const lightSources = normalizedLighting.sources;

    useEffect(() => {
        if (!lightSources.length) {
            setSelectedLightID("");
            return;
        }
        const stillExists = lightSources.some((source) => source.id === selectedLightID);
        if (!stillExists) {
            setSelectedLightID(String(lightSources[0]?.id || ""));
        }
    }, [lightSources, selectedLightID]);

    const selectedLightSource = useMemo(
        () => lightSources.find((source) => String(source?.id || "") === String(selectedLightID || "")) || null,
        [lightSources, selectedLightID]
    );
    const selectedLightSourceID = String(selectedLightSource?.id || "");
    const selectedLightType = String(selectedLightSource?.type || "").toLowerCase();
    const directionalLightVector = useMemo(
        () =>
            clampDirectionalToUnitDisk(
                toNumber(selectedLightSource?.x, 0),
                toNumber(selectedLightSource?.y, 0)
            ),
        [selectedLightSource?.x, selectedLightSource?.y]
    );
    const directionalLightTilt = useMemo(
        () => Math.hypot(directionalLightVector.x, directionalLightVector.y),
        [directionalLightVector]
    );
    const lightWheelRadius = useMemo(() => LIGHT_WHEEL_SIZE / 2 - LIGHT_WHEEL_INNER_MARGIN, []);
    const lightWheelKnobOffset = useMemo(
        () => ({
            x: directionalLightVector.x * lightWheelRadius,
            y: directionalLightVector.y * lightWheelRadius,
        }),
        [directionalLightVector, lightWheelRadius]
    );

    const patchLightingGlobal = (updates = {}) => {
        replaceLighting({
            ...normalizedLighting,
            ...updates,
            sources: normalizedLighting.sources,
        });
    };

    const createDirectionalLight = () => {
        const nextIndex =
            lightSources.filter((source) => String(source?.type || "") === "directional").length + 1;
        addLightSource({
            id: `dir_${Date.now()}`,
            name: `Directional ${nextIndex}`,
            type: "directional",
            enabled: true,
            x: 0,
            y: 0,
            intensity: 0.8,
            blend: 0.7,
            color: "#ffffff",
        });
        setStatus("Directional light source added.");
        setError("");
    };

const createPointLight = () => {
    armLightPlacement({
        color: "#ffffff",
        intensity: 0.9,
        blend: 0.75,
        range: 420,
    });
    setStatus("Light placement armed. Click on map to place.");
    setError("");
};

const lightPresets = [
    { name: "White", color: "#ffffff", intensity: 0.8, range: 420 },
    { name: "Fire", color: "#ff8800", intensity: 1.0, range: 350 },
    { name: "Blue", color: "#4488ff", intensity: 0.9, range: 400 },
    { name: "Green", color: "#44ff88", intensity: 1.1, range: 450 },
];

    const patchSelectedLight = useCallback(
        (updates = {}) => {
            if (!selectedLightSourceID) return;
            updateLightSource(selectedLightSourceID, updates);
        },
        [selectedLightSourceID, updateLightSource]
    );

    const updateDirectionalFromClientPoint = useCallback(
        (clientX, clientY) => {
            if (selectedLightType !== "directional") return;
            if (!directionWheelRef.current) return;

            const rect = directionWheelRef.current.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const maxDistance = Math.max(1, rect.width / 2 - LIGHT_WHEEL_INNER_MARGIN);
            let dx = clientX - centerX;
            let dy = clientY - centerY;
            const distance = Math.hypot(dx, dy);

            if (distance <= maxDistance * LIGHT_WHEEL_DEADZONE) {
                patchSelectedLight({ x: 0, y: 0 });
                return;
            }

            if (distance > maxDistance && distance > 0) {
                const ratio = maxDistance / distance;
                dx *= ratio;
                dy *= ratio;
            }

            const next = clampDirectionalToUnitDisk(dx / maxDistance, dy / maxDistance);
            patchSelectedLight(next);
        },
        [patchSelectedLight, selectedLightType]
    );

    const handleDirectionalWheelMouseDown = useCallback(
        (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            setDirectionWheelDragging(true);
            updateDirectionalFromClientPoint(event.clientX, event.clientY);
        },
        [updateDirectionalFromClientPoint]
    );

    useEffect(() => {
        if (!directionWheelDragging) return undefined;

        const onMouseMove = (event) => {
            updateDirectionalFromClientPoint(event.clientX, event.clientY);
        };
        const onMouseUp = () => setDirectionWheelDragging(false);

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [directionWheelDragging, updateDirectionalFromClientPoint]);

    useEffect(() => {
        if (selectedLightType === "directional") return;
        setDirectionWheelDragging(false);
    }, [selectedLightType]);

    const removeSelectedLight = () => {
        if (!selectedLightSource?.id) return;
        removeLightSource(selectedLightSource.id);
        setStatus(`Removed light source: ${selectedLightSource.name || selectedLightSource.id}`);
        setError("");
    };

    const armPlacement = () => {
        setError("");
        armMapObjectPlacement(creationDraft);
        setStatus("Placement armed. Click for default size, or drag on the map to size the shape.");
    };

    const armMapStampPlacement = () => {
        const mapAssetKey = String(creationDraft.mapAssetKey || "").trim().toLowerCase();
        if (!mapAssetKey) {
            setError("Select a map image first.");
            return;
        }
        const floorOptions = floorTypesByTerrain.floor || [];
        const defaultFloorTypeId = floorOptions[0]?.id || "stoneFloor";
        const floorTypeId =
            floorOptions.some((entry) => entry.id === creationDraft.floorTypeId)
                ? creationDraft.floorTypeId
                : defaultFloorTypeId;

        const mapDraft = {
            ...creationDraft,
            type: "rect",
            terrainType: "floor",
            floorTypeId,
            mapAssetKey,
            color: "#ffffff",
            zLevel: currentZLevel,
            elevationHeight: Math.max(0, Number(creationDraft.elevationHeight) || 0),
            width: Math.max(80, Number(creationDraft.width) || 600),
            height: Math.max(80, Number(creationDraft.height) || 400),
        };
        setCreationDraft(mapDraft);
        setError("");
        armMapObjectPlacement(mapDraft);
        setStatus("Map placement armed. Click to place or drag to size.");
    };

    const quickPlaceAtCursor = () => {
        if (!mapObjectPlacement) {
            setError("Arm placement first.");
            return;
        }
        const placed = placePendingMapObjectAt(worldMouseCoords?.x || 0, worldMouseCoords?.y || 0, {
            zLevel: currentZLevel,
        });
        if (placed) {
            setStatus(`Placed ${placed.type} #${placed.id}`);
            setError("");
            setSelectedObject(placed.id);
        }
    };

    const applyObjectHPDelta = async (objectID, amount) => {
        if (!socket || !playerID || !gameID) {
            setError("Missing game session context.");
            return;
        }

        const response = await emitWithAck(socket, "campaign_gameDamageObject", {
            playerID,
            campaignID: gameID,
            objectID,
            amount,
        });

        if (!response?.success) {
            setError(response?.message || "Failed to update object HP");
            return;
        }

        if (response?.engineState?.snapshot) {
            replaceAllMapObjects(response.engineState.snapshot.mapObjects || []);
        }
        setStatus(`Object #${objectID} HP updated`);
        setError("");
    };

    const exportMap = () => {
        const json = JSON.stringify(mapObjects, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `map_${currentMapId}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const importMap = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result || "[]");
                if (!Array.isArray(data)) {
                    throw new Error("Map file must contain an array of objects");
                }
                replaceAllMapObjects(data);
                setStatus(`Imported ${data.length} objects`);
                setError("");
            } catch (err) {
                setError(err.message || "Invalid JSON file");
            }
        };
        reader.readAsText(file);
    };

    const saveToCampaign = async () => {
        if (!socket || !playerID || !gameID) {
            setError("Missing game session context.");
            return;
        }

        setSaving(true);
        setError("");
        const response = await emitWithAck(socket, "campaign_saveGame", {
            playerID,
            campaignID: gameID,
            name: saveName.trim() || `Map Save ${new Date().toLocaleString()}`,
            description: saveDescription.trim() || "Saved from in-game map editor",
            snapshot: {
                mapObjects,
                backgroundKey,
                characters,
                currentZLevel,
                floorTypes,
                lighting,
            },
            metadata: {
                source: "map_editor",
                objectCount: mapObjects.length,
            },
            makeActive: true,
            isAutoSave: false,
        });
        setSaving(false);

        if (!response?.success) {
            setError(response?.message || "Failed to save map to campaign");
            return;
        }

        setStatus(`Saved: ${response?.gameSave?.name || "Campaign save updated"}`);
        setSaveName("");
        setSaveDescription("");
    };

    if (!isDM) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-900 text-white p-6 text-center">
                <div className="space-y-3">
                    <h2 className="text-xl font-bold">Map Editor Locked</h2>
                    <p className="text-sm text-gray-400">
                        Only the DM can edit world objects, move tokens, and change backgrounds.
                    </p>
                </div>
            </div>
        );
    }

    const sortedObjects = [...mapObjects].sort((a, b) => {
        const levelDiff = (Number(a?.zLevel) || 0) - (Number(b?.zLevel) || 0);
        if (levelDiff !== 0) return levelDiff;
        return (Number(a?.z) || 0) - (Number(b?.z) || 0);
    });

    return (
        <div className="h-full min-h-0 bg-gray-900 text-white p-4">
            <div className="h-full min-h-0 rounded-xl border border-gray-700/80 bg-gray-900/80 p-3">
                <div className="h-full min-h-0 overflow-y-auto scrollbar-transparent pr-1">
                    <div className="space-y-4">
                <h2 className="text-xl font-bold">Map Editor</h2>

                <div className="text-sm bg-gray-800 p-3 rounded space-y-1">
                    <p>Map ID: {currentMapId}</p>
                    <p>Active Z Level: {currentZLevel}</p>
                    <p>
                        Cursor: ({Math.round(worldMouseCoords?.x || 0)}, {Math.round(worldMouseCoords?.y || 0)})
                    </p>
                    <p className="text-xs text-gray-400">
                        DM placement: click for quick drop, or click-drag to define shape size.
                    </p>
                    {mapObjectPlacement && (
                        <p className="text-emerald-300">Placement Active: {placementLabel}</p>
                    )}
                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={stepZLevelDown}
                            className="flex-1 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs"
                        >
                            Level Down
                        </button>
                        <button
                            type="button"
                            onClick={stepZLevelUp}
                            className="flex-1 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs"
                        >
                            Level Up
                        </button>
                    </div>
                </div>

                <div className="bg-gray-800 p-3 rounded space-y-3">
                    <p className="font-semibold text-sm">Background</p>
                    <select
                        value={backgroundKey}
                        onChange={(e) => setBackgroundKey(e.target.value)}
                        className="w-full bg-gray-700 px-3 py-2 rounded text-sm"
                    >
                        {(backgroundOptions || []).map((bg) => (
                            <option key={bg} value={bg}>
                                {bg}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="bg-gray-800 p-3 rounded space-y-3">
                    <p className="font-semibold text-sm">Map Layer Image</p>
                    <select
                        value={creationDraft.mapAssetKey || ""}
                        onChange={(e) =>
                            setCreationDraft((prev) => ({
                                ...prev,
                                mapAssetKey: String(e.target.value || "").trim().toLowerCase(),
                            }))
                        }
                        className="w-full bg-gray-700 px-3 py-2 rounded text-sm"
                    >
                        <option value="">No map image</option>
                        {availableMapImages.map((assetKey) => (
                            <option key={assetKey} value={assetKey}>
                                {assetKey}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-400">
                        Place world-anchored map stamps on top of background. They move with camera.
                    </p>
                    <button
                        type="button"
                        onClick={armMapStampPlacement}
                        disabled={!creationDraft.mapAssetKey}
                        className="w-full bg-cyan-700 hover:bg-cyan-600 disabled:bg-gray-700 px-3 py-2 rounded text-sm"
                    >
                        Arm Map Placement
                    </button>
                    {availableMapImages.length === 0 && (
                        <p className="text-xs text-amber-300">
                            Add images to `client/src/images/game/maps` to populate this list.
                        </p>
                    )}
                </div>

                <div className="bg-gray-800 p-3 rounded space-y-3">
                    <p className="font-semibold text-sm">Lighting</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={normalizedLighting.enabled}
                                onChange={(e) => patchLightingGlobal({ enabled: e.target.checked })}
                            />
                            Lighting Enabled
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={normalizedLighting.shadowEnabled}
                                onChange={(e) =>
                                    patchLightingGlobal({ shadowEnabled: e.target.checked })
                                }
                            />
                            Shadows Enabled
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="text-xs">Ambient</label>
                        <input
                            type="range"
                            min="0"
                            max="0.9"
                            step="0.01"
                            value={normalizedLighting.ambient}
                            onChange={(e) =>
                                patchLightingGlobal({
                                    ambient: clamp(Number(e.target.value), 0, 0.9),
                                })
                            }
                        />
                        <label className="text-xs">Shadow Strength</label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={normalizedLighting.shadowStrength}
                            onChange={(e) =>
                                patchLightingGlobal({
                                    shadowStrength: clamp(Number(e.target.value), 0, 1),
                                })
                            }
                        />
                        <label className="text-xs">Shadow Softness</label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={normalizedLighting.shadowSoftness}
                            onChange={(e) =>
                                patchLightingGlobal({
                                    shadowSoftness: clamp(Number(e.target.value), 0, 1),
                                })
                            }
                        />
                        <label className="text-xs">Shadow Length</label>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.01"
                            value={normalizedLighting.shadowLength}
                            onChange={(e) =>
                                patchLightingGlobal({
                                    shadowLength: clamp(Number(e.target.value), 0, 2),
                                })
                            }
                        />
                        <label className="text-xs">Shadow Blend</label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={normalizedLighting.shadowBlend}
                            onChange={(e) =>
                                patchLightingGlobal({
                                    shadowBlend: clamp(Number(e.target.value), 0, 1),
                                })
                            }
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={createDirectionalLight}
                            className="flex-1 bg-amber-700 hover:bg-amber-600 px-2 py-1 rounded text-xs"
                        >
                            Add Directional
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                            {lightPresets.map((preset) => (
                                <button
                                    key={preset.name}
                                    type="button"
                                    onClick={() => armLightPlacement(preset)}
                                    className="px-2 py-1 rounded text-xs bg-cyan-700 hover:bg-cyan-600"
                                >
                                    {preset.name} Light
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="text-xs">Selected Light</label>
                        <select
                            value={selectedLightID}
                            onChange={(e) => setSelectedLightID(e.target.value)}
                            className="w-full bg-gray-700 px-2 py-1 rounded text-xs"
                        >
                            {lightSources.length === 0 ? (
                                <option value="">No lights</option>
                            ) : (
                                lightSources.map((source) => (
                                    <option key={source.id} value={source.id}>
                                        {source.name || source.id} ({source.type})
                                    </option>
                                ))
                            )}
                        </select>
                    </div>

                    {selectedLightSource && (
                        <div className="rounded border border-gray-700 bg-gray-900/50 p-2 space-y-2">
                            <div className="grid grid-cols-2 gap-2 items-center">
                                <label className="text-xs">Name</label>
                                <input
                                    type="text"
                                    value={selectedLightSource.name || ""}
                                    onChange={(e) => patchSelectedLight({ name: e.target.value })}
                                    className="w-full bg-gray-700 px-2 py-1 rounded text-xs"
                                />
                                <label className="text-xs">Type</label>
                                <select
                                    value={String(selectedLightSource.type || "directional")}
                                    onChange={(e) => {
                                        const nextType = e.target.value;
                                        if (nextType === "directional") {
                                            patchSelectedLight({
                                                type: "directional",
                                                x: 0,
                                                y: 0,
                                            });
                                        } else {
                                            patchSelectedLight({
                                                type: "point",
                                                worldX: Math.round(toNumber(worldMouseCoords?.x, 0)),
                                                worldY: Math.round(toNumber(worldMouseCoords?.y, 0)),
                                                range: 420,
                                            });
                                        }
                                    }}
                                    className="w-full bg-gray-700 px-2 py-1 rounded text-xs"
                                >
                                    <option value="directional">directional</option>
                                    <option value="point">point</option>
                                </select>
                                <label className="text-xs">Enabled</label>
                                <input
                                    type="checkbox"
                                    checked={selectedLightSource.enabled !== false}
                                    onChange={(e) =>
                                        patchSelectedLight({ enabled: e.target.checked })
                                    }
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2 items-center">
                                <label className="text-xs">Intensity</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.01"
                                    value={clamp(toNumber(selectedLightSource.intensity, 0.8), 0, 2)}
                                    onChange={(e) =>
                                        patchSelectedLight({
                                            intensity: clamp(Number(e.target.value), 0, 2),
                                        })
                                    }
                                />
                                <label className="text-xs">Blend</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={clamp(toNumber(selectedLightSource.blend, 0.7), 0, 1)}
                                    onChange={(e) =>
                                        patchSelectedLight({
                                            blend: clamp(Number(e.target.value), 0, 1),
                                        })
                                    }
                                />
                                <label className="text-xs">Color</label>
                                <input
                                    type="color"
                                    value={String(selectedLightSource.color || "#ffffff")}
                                    onChange={(e) => patchSelectedLight({ color: e.target.value })}
                                    className="w-full h-8 rounded cursor-pointer"
                                />
                            </div>

                            {selectedLightType === "directional" ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <div
                                            ref={directionWheelRef}
                                            aria-label="Directional light wheel"
                                            tabIndex={0}
                                            onMouseDown={handleDirectionalWheelMouseDown}
                                            onKeyDown={(event) => {
                                                const step = 0.08;
                                                let nextX = directionalLightVector.x;
                                                let nextY = directionalLightVector.y;
                                                if (event.key === "ArrowLeft") nextX -= step;
                                                if (event.key === "ArrowRight") nextX += step;
                                                if (event.key === "ArrowUp") nextY -= step;
                                                if (event.key === "ArrowDown") nextY += step;
                                                if (
                                                    event.key === "ArrowLeft" ||
                                                    event.key === "ArrowRight" ||
                                                    event.key === "ArrowUp" ||
                                                    event.key === "ArrowDown"
                                                ) {
                                                    event.preventDefault();
                                                    patchSelectedLight(
                                                        clampDirectionalToUnitDisk(nextX, nextY)
                                                    );
                                                }
                                            }}
                                            className={`relative rounded-full border border-amber-200/60 bg-gray-950/85 ${
                                                directionWheelDragging ? "cursor-grabbing" : "cursor-grab"
                                            }`}
                                            style={{
                                                width: LIGHT_WHEEL_SIZE,
                                                height: LIGHT_WHEEL_SIZE,
                                            }}
                                        >
                                            <div
                                                className="absolute rounded-full border border-gray-600/80"
                                                style={{
                                                    left: LIGHT_WHEEL_INNER_MARGIN,
                                                    top: LIGHT_WHEEL_INNER_MARGIN,
                                                    width: LIGHT_WHEEL_SIZE - LIGHT_WHEEL_INNER_MARGIN * 2,
                                                    height: LIGHT_WHEEL_SIZE - LIGHT_WHEEL_INNER_MARGIN * 2,
                                                }}
                                            />
                                            <div
                                                className="absolute rounded-full border border-amber-100 bg-amber-300 shadow"
                                                style={{
                                                    width: LIGHT_WHEEL_KNOB_SIZE,
                                                    height: LIGHT_WHEEL_KNOB_SIZE,
                                                    left:
                                                        LIGHT_WHEEL_SIZE / 2 +
                                                        lightWheelKnobOffset.x -
                                                        LIGHT_WHEEL_KNOB_SIZE / 2,
                                                    top:
                                                        LIGHT_WHEEL_SIZE / 2 +
                                                        lightWheelKnobOffset.y -
                                                        LIGHT_WHEEL_KNOB_SIZE / 2,
                                                }}
                                            />
                                        </div>
                                        <div className="text-[11px] text-gray-300 leading-5">
                                            <p>X: {directionalLightVector.x.toFixed(2)}</p>
                                            <p>Y: {directionalLightVector.y.toFixed(2)}</p>
                                            <p>Tilt: {directionalLightTilt.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400">
                                        Center is overhead sun. Drag the wheel or use arrow keys.
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-xs">Direction X</label>
                                        <input
                                            type="range"
                                            min="-1"
                                            max="1"
                                            step="0.01"
                                            value={directionalLightVector.x}
                                            onChange={(e) =>
                                                patchSelectedLight(
                                                    withFixedDirectionalX(
                                                        Number(e.target.value),
                                                        directionalLightVector.y
                                                    )
                                                )
                                            }
                                        />
                                        <label className="text-xs">Direction Y</label>
                                        <input
                                            type="range"
                                            min="-1"
                                            max="1"
                                            step="0.01"
                                            value={directionalLightVector.y}
                                            onChange={(e) =>
                                                patchSelectedLight(
                                                    withFixedDirectionalY(
                                                        Number(e.target.value),
                                                        directionalLightVector.x
                                                    )
                                                )
                                            }
                                        />
                                        <button
                                            type="button"
                                            onClick={() => patchSelectedLight({ x: 0, y: 0 })}
                                            className="col-span-2 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs"
                                        >
                                            Set Overhead (0, 0)
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2 items-center">
                                    <label className="text-xs">World X</label>
                                    <input
                                        type="number"
                                        value={Math.round(toNumber(selectedLightSource.worldX, 0))}
                                        onChange={(e) =>
                                            patchSelectedLight({ worldX: Number(e.target.value) })
                                        }
                                        className="w-full bg-gray-700 px-2 py-1 rounded text-xs"
                                    />
                                    <label className="text-xs">World Y</label>
                                    <input
                                        type="number"
                                        value={Math.round(toNumber(selectedLightSource.worldY, 0))}
                                        onChange={(e) =>
                                            patchSelectedLight({ worldY: Number(e.target.value) })
                                        }
                                        className="w-full bg-gray-700 px-2 py-1 rounded text-xs"
                                    />
                                    <label className="text-xs">Range</label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="5000"
                                        step="10"
                                        value={clamp(toNumber(selectedLightSource.range, 420), 10, 5000)}
                                        onChange={(e) =>
                                            patchSelectedLight({
                                                range: clamp(Number(e.target.value), 10, 5000),
                                            })
                                        }
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            patchSelectedLight({
                                                worldX: Math.round(toNumber(worldMouseCoords?.x, 0)),
                                                worldY: Math.round(toNumber(worldMouseCoords?.y, 0)),
                                            })
                                        }
                                        className="col-span-2 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs"
                                    >
                                        Move Point Light To Cursor
                                    </button>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={removeSelectedLight}
                                className="w-full bg-red-700 hover:bg-red-600 px-2 py-1 rounded text-xs"
                            >
                                Remove Selected Light
                            </button>
                        </div>
                    )}
                </div>

                <div className="bg-gray-800 p-3 rounded space-y-3">
                    <p className="font-semibold text-sm">Create Object</p>
                    <div className="grid grid-cols-3 gap-2">
                        {["circle", "rect", "triangle"].map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setCreationDraft((prev) => ({ ...prev, type }))}
                                className={`px-2 py-2 rounded text-sm ${
                                    creationDraft.type === type
                                        ? "bg-blue-600"
                                        : "bg-gray-700 hover:bg-gray-600"
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="text-xs">Terrain Type</label>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                            {["floor", "wall", "obstacle"].map((terrainType) => (
                                <button
                                    key={terrainType}
                                    type="button"
                                    onClick={() =>
                                        setCreationDraft((prev) => {
                                            const defaultHP =
                                                DEFAULT_MAX_HP_BY_TERRAIN[terrainType] ||
                                                DEFAULT_MAX_HP_BY_TERRAIN.obstacle;
                                            return {
                                                ...prev,
                                                terrainType,
                                                elevationHeight:
                                                    DEFAULT_ELEVATION_HEIGHT_BY_TERRAIN[terrainType] ??
                                                    DEFAULT_ELEVATION_HEIGHT_BY_TERRAIN.obstacle,
                                                maxHP: prev.maxHP ?? defaultHP,
                                                hp: prev.hp ?? defaultHP,
                                            };
                                        })
                                    }
                                    className={`px-2 py-2 rounded text-xs ${
                                        creationDraft.terrainType === terrainType
                                            ? "bg-purple-600"
                                            : "bg-gray-700 hover:bg-gray-600"
                                    }`}
                                >
                                    {terrainType}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="text-xs">Floor Type</label>
                        <select
                            value={creationDraft.floorTypeId}
                            onChange={(e) =>
                                setCreationDraft((prev) => ({ ...prev, floorTypeId: e.target.value }))
                            }
                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                        >
                            {creationFloorTypeOptions.map((entry) => (
                                <option key={entry.id} value={entry.id}>
                                    {entry.name}
                                    {entry.floorVisualType === "effect" ? " (Effect)" : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="text-xs">Map Image</label>
                        <select
                            value={creationDraft.mapAssetKey || ""}
                            onChange={(e) =>
                                setCreationDraft((prev) => ({
                                    ...prev,
                                    mapAssetKey: String(e.target.value || "").trim().toLowerCase(),
                                }))
                            }
                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                        >
                            <option value="">None</option>
                            {availableMapImages.map((assetKey) => (
                                <option key={assetKey} value={assetKey}>
                                    {assetKey}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="text-xs">Z-Level</label>
                        <input
                            type="number"
                            value={creationDraft.zLevel}
                            onChange={(e) =>
                                setCreationDraft((prev) => ({
                                    ...prev,
                                    zLevel: Number(e.target.value),
                                }))
                            }
                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="text-xs">Elevation Height</label>
                        <input
                            type="number"
                            min="0"
                            value={creationDraft.elevationHeight}
                            onChange={(e) =>
                                setCreationDraft((prev) => ({
                                    ...prev,
                                    elevationHeight: Number(e.target.value),
                                }))
                            }
                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs">Max HP</label>
                            <input
                                type="number"
                                value={creationDraft.maxHP ?? ""}
                                onChange={(e) =>
                                    setCreationDraft((prev) => ({
                                        ...prev,
                                        maxHP: e.target.value === "" ? null : Number(e.target.value),
                                    }))
                                }
                                className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs">HP</label>
                            <input
                                type="number"
                                value={creationDraft.hp ?? ""}
                                onChange={(e) =>
                                    setCreationDraft((prev) => ({
                                        ...prev,
                                        hp: e.target.value === "" ? null : Number(e.target.value),
                                    }))
                                }
                                className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="text-xs">Hitbox Scale</label>
                        <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="5"
                            value={creationDraft.hitboxScale}
                            onChange={(e) =>
                                setCreationDraft((prev) => ({
                                    ...prev,
                                    hitboxScale: Number(e.target.value),
                                }))
                            }
                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="text-xs">Color</label>
                        <input
                            type="color"
                            value={creationDraft.color}
                            onChange={(e) =>
                                setCreationDraft((prev) => ({ ...prev, color: e.target.value }))
                            }
                            className="w-full h-9 rounded cursor-pointer"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center">
                        <label className="text-xs">Z-Index</label>
                        <input
                            type="number"
                            value={creationDraft.z}
                            onChange={(e) =>
                                setCreationDraft((prev) => ({ ...prev, z: Number(e.target.value) }))
                            }
                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                        />
                    </div>

                    {creationDraft.type === "rect" ? (
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs">Width</label>
                                <input
                                    type="number"
                                    value={creationDraft.width}
                                    onChange={(e) =>
                                        setCreationDraft((prev) => ({
                                            ...prev,
                                            width: Number(e.target.value),
                                        }))
                                    }
                                    className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs">Footprint Height</label>
                                <input
                                    type="number"
                                    value={creationDraft.height}
                                    onChange={(e) =>
                                        setCreationDraft((prev) => ({
                                            ...prev,
                                            height: Number(e.target.value),
                                        }))
                                    }
                                    className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="text-xs">Size</label>
                            <input
                                type="number"
                                value={creationDraft.size}
                                onChange={(e) =>
                                    setCreationDraft((prev) => ({ ...prev, size: Number(e.target.value) }))
                                }
                                className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                            />
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={armPlacement}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded text-sm"
                        >
                            Arm Placement
                        </button>
                        <button
                            type="button"
                            onClick={quickPlaceAtCursor}
                            disabled={!mapObjectPlacement}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 px-3 py-2 rounded text-sm"
                        >
                            Place Now
                        </button>
                    </div>

                    {selectedPlacementType && (
                        <button
                            type="button"
                            onClick={clearMapObjectPlacement}
                            className="w-full bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-sm"
                        >
                            Cancel Placement
                        </button>
                    )}
                </div>

                <div className="bg-gray-800 p-3 rounded space-y-2">
                    <p className="font-semibold text-sm">Save Campaign Snapshot</p>
                    <input
                        type="text"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        placeholder="Save name (optional)"
                        className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                    />
                    <input
                        type="text"
                        value={saveDescription}
                        onChange={(e) => setSaveDescription(e.target.value)}
                        placeholder="Save description (optional)"
                        className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                    />
                    <button
                        type="button"
                        onClick={saveToCampaign}
                        disabled={saving}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 px-3 py-2 rounded text-sm"
                    >
                        {saving ? "Saving..." : "Save to Campaign"}
                    </button>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={exportMap}
                            className="flex-1 text-xs bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded"
                        >
                            Export JSON
                        </button>
                        <label className="flex-1 text-xs bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded cursor-pointer text-center">
                            Import JSON
                            <input type="file" accept=".json" onChange={importMap} className="hidden" />
                        </label>
                    </div>
                </div>

                        {error && <div className="text-sm text-red-300 bg-red-900/40 rounded p-2">{error}</div>}
                        {status && <div className="text-sm text-emerald-300 bg-emerald-900/30 rounded p-2">{status}</div>}

                        <div className="bg-gray-800 p-3 rounded space-y-2">
                            <p className="font-semibold mb-1">Objects ({mapObjects.length})</p>
                            <div className="max-h-[42vh] min-h-[220px] overflow-y-auto scrollbar-transparent pr-1 space-y-2">
                    {sortedObjects.map((obj) => (
                        <div
                            key={obj.id}
                            className={`p-3 rounded cursor-pointer ${
                                selectedObject === obj.id
                                    ? "bg-blue-700 ring-2 ring-yellow-300 border border-yellow-200/70"
                                    : "bg-gray-800 hover:bg-gray-700"
                            }`}
                            onClick={() => setSelectedObject(obj.id)}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className="font-semibold">
                                        {obj.type} #{obj.id}
                                    </span>
                                    <p className="text-xs text-gray-400">
                                        Pos: ({obj.x}, {obj.y}) L:{obj.zLevel ?? 0} Z:{obj.z} H:{Math.round(Number(obj.elevationHeight) || 0)} {obj.terrainType ? `| ${obj.terrainType}` : ""} {obj.floorTypeId ? `| ${obj.floorTypeId}` : ""} {obj.mapAssetKey ? `| MAP ${obj.mapAssetKey}` : ""} {obj.maxHP != null ? `| HP ${obj.hp ?? 0}/${obj.maxHP}` : "| Indestructible"}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteMapObject(obj.id);
                                        if (selectedObject === obj.id) {
                                            setSelectedObject(null);
                                        }
                                    }}
                                    className="text-red-400 hover:text-red-300 text-xl"
                                >
                                    x
                                </button>
                            </div>

                            {selectedObject === obj.id && (
                                <div className="mt-2 space-y-2 border-t border-gray-700 pt-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs">X</label>
                                            <input
                                                type="number"
                                                value={obj.x}
                                                onChange={(e) =>
                                                    updateMapObject(obj.id, { x: Number(e.target.value) })
                                                }
                                                className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs">Y</label>
                                            <input
                                                type="number"
                                                value={obj.y}
                                                onChange={(e) =>
                                                    updateMapObject(obj.id, { y: Number(e.target.value) })
                                                }
                                                className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs">Terrain Type</label>
                                        <select
                                            value={obj.terrainType || "obstacle"}
                                            onChange={(e) =>
                                                updateMapObject(obj.id, {
                                                    terrainType: e.target.value,
                                                })
                                            }
                                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                        >
                                            <option value="floor">floor</option>
                                            <option value="wall">wall</option>
                                            <option value="obstacle">obstacle</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs">Floor Type</label>
                                        <select
                                            value={obj.floorTypeId || ""}
                                            onChange={(e) =>
                                                updateMapObject(obj.id, {
                                                    floorTypeId: e.target.value,
                                                })
                                            }
                                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                        >
                                            {(floorTypesByTerrain[obj.terrainType || "obstacle"] || floorTypes).map((entry) => (
                                                <option key={entry.id} value={entry.id}>
                                                    {entry.name}
                                                    {entry.floorVisualType === "effect" ? " (Effect)" : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs">Map Image</label>
                                        <select
                                            value={String(obj.mapAssetKey || "").trim().toLowerCase()}
                                            onChange={(e) =>
                                                updateMapObject(obj.id, {
                                                    mapAssetKey: String(e.target.value || "")
                                                        .trim()
                                                        .toLowerCase(),
                                                })
                                            }
                                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                        >
                                            <option value="">None</option>
                                            {availableMapImages.map((assetKey) => (
                                                <option key={assetKey} value={assetKey}>
                                                    {assetKey}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs">Z-Level</label>
                                        <input
                                            type="number"
                                            value={obj.zLevel ?? 0}
                                            onChange={(e) =>
                                                updateMapObject(obj.id, {
                                                    zLevel: Number(e.target.value),
                                                })
                                            }
                                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs">Elevation Height</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={Math.round(Number(obj.elevationHeight) || 0)}
                                            onChange={(e) =>
                                                updateMapObject(obj.id, {
                                                    elevationHeight: Number(e.target.value),
                                                })
                                            }
                                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs">Max HP</label>
                                            <input
                                                type="number"
                                                value={obj.maxHP ?? ""}
                                                onChange={(e) =>
                                                    updateMapObject(obj.id, {
                                                        maxHP:
                                                            e.target.value === ""
                                                                ? null
                                                                : Number(e.target.value),
                                                    })
                                                }
                                                className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs">HP</label>
                                            <input
                                                type="number"
                                                value={obj.hp ?? ""}
                                                onChange={(e) =>
                                                    updateMapObject(obj.id, {
                                                        hp:
                                                            e.target.value === ""
                                                                ? null
                                                                : Number(e.target.value),
                                                    })
                                                }
                                                className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => applyObjectHPDelta(obj.id, 10)}
                                            className="bg-red-700/70 hover:bg-red-700 text-xs px-2 py-1 rounded"
                                        >
                                            Damage 10
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyObjectHPDelta(obj.id, -10)}
                                            className="bg-emerald-700/70 hover:bg-emerald-700 text-xs px-2 py-1 rounded"
                                        >
                                            Heal 10
                                        </button>
                                    </div>

                                    <div>
                                        <label className="text-xs">Hitbox Scale</label>
                                        <input
                                            type="number"
                                            min="0.1"
                                            max="5"
                                            step="0.1"
                                            value={obj?.hitbox?.scale ?? 1}
                                            onChange={(e) =>
                                                updateMapObject(obj.id, {
                                                    hitbox: {
                                                        ...(obj.hitbox || {}),
                                                        scale: Number(e.target.value),
                                                    },
                                                })
                                            }
                                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs">Z-Index</label>
                                        <input
                                            type="number"
                                            value={obj.z}
                                            onChange={(e) =>
                                                updateMapObject(obj.id, { z: Number(e.target.value) })
                                            }
                                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                        />
                                    </div>

                                    {obj.type === "rect" ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs">Width</label>
                                                <input
                                                    type="number"
                                                    value={obj.width}
                                                    onChange={(e) =>
                                                        updateMapObject(obj.id, { width: Number(e.target.value) })
                                                    }
                                                    className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs">Footprint Height</label>
                                                <input
                                                    type="number"
                                                    value={obj.height}
                                                    onChange={(e) =>
                                                        updateMapObject(obj.id, { height: Number(e.target.value) })
                                                    }
                                                    className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="text-xs">Size</label>
                                            <input
                                                type="number"
                                                value={obj.size}
                                                onChange={(e) =>
                                                    updateMapObject(obj.id, { size: Number(e.target.value) })
                                                }
                                                className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-xs">Color</label>
                                        <input
                                            type="color"
                                            value={obj.color}
                                            onChange={(e) =>
                                                updateMapObject(obj.id, { color: e.target.value })
                                            }
                                            className="w-full h-8 rounded cursor-pointer"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MapEditor;

