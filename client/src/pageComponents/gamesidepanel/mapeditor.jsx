import { useContext, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useGame } from "../../data/gameContext";
import { SocketContext } from "../../socket.io/context";
import { emitWithAck } from "../../pages/campaign/socketEmit";

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
        mapObjectPlacement,
        armMapObjectPlacement,
        clearMapObjectPlacement,
        placePendingMapObjectAt,
        characters,
    } = useGame();

    const [selectedObject, setSelectedObject] = useState(null);
    const [creationDraft, setCreationDraft] = useState({
        type: "circle",
        color: "#3B82F6",
        z: 0,
        size: 30,
        width: 50,
        height: 40,
    });
    const [saveName, setSaveName] = useState("");
    const [saveDescription, setSaveDescription] = useState("");
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");

    const selectedPlacementType = mapObjectPlacement?.type || "";

    const placementLabel = useMemo(() => {
        if (!mapObjectPlacement) return "";
        return `${mapObjectPlacement.type} @ (${Math.round(worldMouseCoords?.x || 0)}, ${Math.round(worldMouseCoords?.y || 0)})`;
    }, [mapObjectPlacement, worldMouseCoords]);

    const armPlacement = () => {
        setError("");
        armMapObjectPlacement(creationDraft);
        setStatus("Placement armed. Click on the map to place the object.");
    };

    const quickPlaceAtCursor = () => {
        if (!mapObjectPlacement) {
            setError("Arm placement first.");
            return;
        }
        const placed = placePendingMapObjectAt(worldMouseCoords?.x || 0, worldMouseCoords?.y || 0);
        if (placed) {
            setStatus(`Placed ${placed.type} #${placed.id}`);
            setError("");
            setSelectedObject(placed.id);
        }
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

    const sortedObjects = [...mapObjects].sort((a, b) => a.z - b.z);

    return (
        <div className="h-full flex flex-col bg-gray-900 text-white">
            <div className="p-4 border-b border-gray-700 space-y-4">
                <h2 className="text-xl font-bold">Map Editor</h2>

                <div className="text-sm bg-gray-800 p-3 rounded space-y-1">
                    <p>Map ID: {currentMapId}</p>
                    <p>
                        Cursor: ({Math.round(worldMouseCoords?.x || 0)}, {Math.round(worldMouseCoords?.y || 0)})
                    </p>
                    {mapObjectPlacement && (
                        <p className="text-emerald-300">Placement Active: {placementLabel}</p>
                    )}
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
                                <label className="text-xs">Height</label>
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
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <p className="font-semibold mb-2">Objects ({mapObjects.length})</p>
                <div className="space-y-2">
                    {sortedObjects.map((obj) => (
                        <div
                            key={obj.id}
                            className={`p-3 rounded cursor-pointer ${
                                selectedObject === obj.id
                                    ? "bg-blue-600"
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
                                        Pos: ({obj.x}, {obj.y}) Z: {obj.z}
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
                                    ×
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
                                                <label className="text-xs">Height</label>
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
    );
}

export default MapEditor;
