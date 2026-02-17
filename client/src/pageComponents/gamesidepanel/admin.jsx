import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useGame } from "../../data/gameContext";
import { SocketContext } from "../../socket.io/context";
import { emitWithAck } from "../../pages/campaign/socketEmit";

const FALLBACK_AUTO_SAVE_LIMIT = 5;

function toTimestamp(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTime(value) {
  const timestamp = toTimestamp(value);
  if (!timestamp) return "Unknown";
  return new Date(timestamp).toLocaleString();
}

function normalizeSaveCollection(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const aTime = toTimestamp(a?.updatedAt || a?.createdAt);
    const bTime = toTimestamp(b?.updatedAt || b?.createdAt);
    return bTime - aTime;
  });
}

function SaveRow({ save, activeSaveID, loading, onLoad }) {
  return (
    <div className="p-2 rounded border border-gray-700 bg-gray-800/90 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{save?.name || "Untitled Save"}</p>
          <p className="text-[11px] text-gray-400">{formatDateTime(save?.updatedAt || save?.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {String(save?._id || "") === String(activeSaveID || "") && (
            <span className="text-[10px] px-2 py-1 rounded bg-emerald-900/70 text-emerald-200 border border-emerald-600">
              Active
            </span>
          )}
          <button
            type="button"
            onClick={() => onLoad(save?._id)}
            disabled={loading}
            className="text-xs px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700"
          >
            {loading ? "Loading..." : "Load"}
          </button>
        </div>
      </div>
      {save?.description && <p className="text-xs text-gray-300 break-words">{save.description}</p>}
    </div>
  );
}

function Admin() {
  const socket = useContext(SocketContext);
  const { gameID } = useParams();
  const playerID = localStorage.getItem("player_ID");

  const {
    isDM = false,
    characters = [],
    lastMouse = { x: 0, y: 0 },
    worldMouseCoords = { x: 0, y: 0 },
    camera,
    loadGameSnapshot = () => {},
    replaceFloorTypes = () => {},
  } = useGame() || {};

  const [manualSaves, setManualSaves] = useState([]);
  const [autoSaves, setAutoSaves] = useState([]);
  const [activeGameSave, setActiveGameSave] = useState("");
  const [loadingSaves, setLoadingSaves] = useState(false);
  const [loadingSaveID, setLoadingSaveID] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [saveError, setSaveError] = useState("");
  const [autoSaveLimit, setAutoSaveLimit] = useState(FALLBACK_AUTO_SAVE_LIMIT);

  const cameraSnapshot = useMemo(
    () => ({
      x: Math.round(camera?.current?.x || 0),
      y: Math.round(camera?.current?.y || 0),
      zoom: Number(camera?.current?.zoom || 1).toFixed(2),
    }),
    [camera]
  );

  const hydrateSaveLists = useCallback((response = {}) => {
    const allSaves = normalizeSaveCollection(response?.gameSaves);
    const manual = Array.isArray(response?.manualSaves)
      ? normalizeSaveCollection(response.manualSaves)
      : allSaves.filter((save) => !save?.isAutoSave);
    const limit = Number(response?.autoSaveLimit) || FALLBACK_AUTO_SAVE_LIMIT;
    const auto = Array.isArray(response?.autoSaves)
      ? normalizeSaveCollection(response.autoSaves)
      : normalizeSaveCollection(allSaves.filter((save) => save?.isAutoSave)).slice(0, limit);

    setManualSaves(manual);
    setAutoSaves(auto.slice(0, limit));
    setAutoSaveLimit(limit);
    setActiveGameSave(String(response?.activeGameSave || ""));
  }, []);

  const loadSaveList = useCallback(async () => {
    if (!socket || !playerID || !gameID) return;

    setLoadingSaves(true);
    setSaveError("");
    const response = await emitWithAck(socket, "campaign_listGameSaves", {
      playerID,
      campaignID: gameID,
    });
    setLoadingSaves(false);

    if (!response?.success) {
      setSaveError(response?.message || "Failed to load campaign saves");
      return;
    }

    hydrateSaveLists(response);
    setSaveStatus(`Loaded saves at ${new Date().toLocaleTimeString()}`);
  }, [socket, playerID, gameID, hydrateSaveLists]);

  const loadSave = useCallback(
    async (gameSaveID) => {
      const safeSaveID = String(gameSaveID || "").trim();
      if (!safeSaveID || !socket || !playerID || !gameID) return;

      setLoadingSaveID(safeSaveID);
      setSaveError("");
      const response = await emitWithAck(socket, "campaign_loadGame", {
        playerID,
        campaignID: gameID,
        gameSaveID: safeSaveID,
      });
      setLoadingSaveID("");

      if (!response?.success) {
        setSaveError(response?.message || "Failed to load save");
        return;
      }

      if (Array.isArray(response?.floorTypes)) {
        replaceFloorTypes(response.floorTypes);
      }

      const snapshot =
        response?.engineState?.snapshot && typeof response.engineState.snapshot === "object"
          ? response.engineState.snapshot
          : response?.snapshot;
      if (snapshot && typeof snapshot === "object") {
        loadGameSnapshot(snapshot);
      }

      setActiveGameSave(String(response?.activeGameSave || safeSaveID));
      setSaveStatus(`Loaded save: ${response?.gameSave?.name || safeSaveID}`);

      await loadSaveList();
    },
    [socket, playerID, gameID, loadGameSnapshot, replaceFloorTypes, loadSaveList]
  );

  useEffect(() => {
    if (!isDM) return;
    loadSaveList();
  }, [isDM, loadSaveList]);

  if (!isDM) {
    return (
      <div className="h-full min-h-0 flex items-center justify-center px-4 text-center text-gray-300">
        <p>Admin tools are available to the DM only.</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto scrollbar-transparent p-4 text-white space-y-4">
      <h3 className="text-lg font-bold">Admin Tools</h3>

      <div className="text-sm space-y-1 rounded border border-gray-700 bg-gray-900/70 p-3">
        <p className="font-semibold">Mouse</p>
        <p>
          Screen: X:{Math.round(lastMouse?.x || 0)} Y:{Math.round(lastMouse?.y || 0)}
        </p>
        <p>
          World: X:{Math.round(worldMouseCoords?.x || 0)} Y:{Math.round(worldMouseCoords?.y || 0)}
        </p>
      </div>

      <div className="text-sm space-y-1 rounded border border-gray-700 bg-gray-900/70 p-3">
        <p className="font-semibold">Camera</p>
        <p>X: {cameraSnapshot.x}</p>
        <p>Y: {cameraSnapshot.y}</p>
        <p>Zoom: {cameraSnapshot.zoom}</p>
      </div>

      <div className="text-sm space-y-2 rounded border border-gray-700 bg-gray-900/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">Saves</p>
          <button
            type="button"
            onClick={loadSaveList}
            disabled={loadingSaves}
            className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:bg-gray-700"
          >
            {loadingSaves ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {saveError && <div className="text-xs text-red-200 bg-red-900/40 rounded p-2">{saveError}</div>}
        {saveStatus && <div className="text-xs text-emerald-200 bg-emerald-900/30 rounded p-2">{saveStatus}</div>}

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-gray-400">Manual Saves ({manualSaves.length})</p>
          <div className="max-h-48 overflow-y-auto scrollbar-transparent pr-1 space-y-2">
            {manualSaves.length > 0 ? (
              manualSaves.map((save) => (
                <SaveRow
                  key={save._id}
                  save={save}
                  activeSaveID={activeGameSave}
                  loading={loadingSaveID === String(save._id || "")}
                  onLoad={loadSave}
                />
              ))
            ) : (
              <p className="text-xs text-gray-400">No manual saves yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Auto Saves (Last {autoSaveLimit})
          </p>
          <div className="max-h-40 overflow-y-auto scrollbar-transparent pr-1 space-y-2">
            {autoSaves.length > 0 ? (
              autoSaves.map((save) => (
                <SaveRow
                  key={save._id}
                  save={save}
                  activeSaveID={activeGameSave}
                  loading={loadingSaveID === String(save._id || "")}
                  onLoad={loadSave}
                />
              ))
            ) : (
              <p className="text-xs text-gray-400">No autosaves yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="text-sm space-y-2 rounded border border-gray-700 bg-gray-900/70 p-3">
        <p className="font-semibold">Characters ({characters.length})</p>
        {characters.length > 0 ? (
          <div className="max-h-56 overflow-y-auto scrollbar-transparent pr-1 space-y-2">
            {characters.map((char) => (
              <div key={char.id} className="p-2 bg-gray-700/70 rounded">
                <p className="font-medium">
                  {char.name} ({char.team})
                </p>
                <p className="text-xs text-gray-300">
                  ID: {char.id} | Pos: ({Math.round(char?.position?.x || 0)}, {Math.round(char?.position?.y || 0)})
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">No characters</p>
        )}
      </div>
    </div>
  );
}

export default Admin;
