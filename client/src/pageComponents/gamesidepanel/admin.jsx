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
    characterPlacement,
    armCharacterPlacement,
    armEnemyPlacement,
    clearCharacterPlacement,
  } = useGame() || {};

  const [manualSaves, setManualSaves] = useState([]);
  const [autoSaves, setAutoSaves] = useState([]);
  const [activeGameSave, setActiveGameSave] = useState("");
  const [loadingSaves, setLoadingSaves] = useState(false);
  const [loadingSaveID, setLoadingSaveID] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [saveError, setSaveError] = useState("");
  const [autoSaveLimit, setAutoSaveLimit] = useState(FALLBACK_AUTO_SAVE_LIMIT);
  const [campaignAssignments, setCampaignAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [assignmentStatus, setAssignmentStatus] = useState("");
  const [enemies, setEnemies] = useState([]);
  const [loadingEnemies, setLoadingEnemies] = useState(false);
  const [enemyError, setEnemyError] = useState("");
  const [enemyStatus, setEnemyStatus] = useState("");
  const [enemyDraft, setEnemyDraft] = useState({
    name: "",
    level: 1,
    maxHP: 30,
    hp: 30,
    size: 30,
    visionDistance: 150,
    visionArc: 90,
  });
  const [fovMode, setFovMode] = useState("party");
  const [savingFovMode, setSavingFovMode] = useState(false);
  const [fovStatus, setFovStatus] = useState("");
  const [fovError, setFovError] = useState("");

  const cameraSnapshot = useMemo(
    () => ({
      x: Math.round(camera?.current?.x || 0),
      y: Math.round(camera?.current?.y || 0),
      zoom: Number(camera?.current?.zoom || 1).toFixed(2),
    }),
    [camera]
  );

  const applySnapshotFromResponse = useCallback(
    (response = {}) => {
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
    },
    [loadGameSnapshot, replaceFloorTypes]
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

  const loadAssignments = useCallback(async () => {
    if (!socket || !playerID || !gameID) return;
    setLoadingAssignments(true);
    setAssignmentError("");

    const response = await emitWithAck(socket, "campaign_getCharacterChoices", {
      playerID,
      campaignID: gameID,
    });

    setLoadingAssignments(false);

    if (!response?.success) {
      setAssignmentError(response?.message || "Failed to load campaign characters");
      return;
    }

    const assignments = Array.isArray(response?.assignments)
      ? response.assignments
      : Array.isArray(response?.campaign?.characterAssignments)
      ? response.campaign.characterAssignments
      : [];

    const nextFovMode = String(response?.campaign?.fovMode || "").trim();
    if (nextFovMode) {
      setFovMode(nextFovMode);
    }

    setCampaignAssignments(assignments);
    setAssignmentStatus(`Loaded ${assignments.length} characters`);
  }, [socket, playerID, gameID]);

  const updateFovMode = useCallback(
    async (nextMode, previousMode = null) => {
      if (!socket || !playerID || !gameID) return;
      const safeMode = String(nextMode || "party");
      setSavingFovMode(true);
      setFovError("");

      const response = await emitWithAck(socket, "campaign_setFovMode", {
        playerID,
        campaignID: gameID,
        fovMode: safeMode,
      });

      setSavingFovMode(false);

      if (!response?.success) {
        setFovError(response?.message || "Failed to update FOV mode");
        if (previousMode) {
          setFovMode(previousMode);
        }
        return;
      }

      const confirmedMode = String(response?.fovMode || safeMode);
      setFovMode(confirmedMode);
      setFovStatus(`FOV mode set to ${confirmedMode === "perPlayer" ? "Per-Player" : "Party"}.`);
    },
    [socket, playerID, gameID]
  );

  const handleFovModeChange = useCallback(
    (event) => {
      const nextMode = String(event.target.value || "party");
      const prevMode = fovMode;
      setFovMode(nextMode);
      updateFovMode(nextMode, prevMode);
    },
    [fovMode, updateFovMode]
  );

  const spawnCharacterAtCursor = useCallback(
    (characterId, characterName) => {
      if (!characterId) return;
      setAssignmentError("");
      armCharacterPlacement({
        characterId,
        name: characterName,
      });
      setAssignmentStatus(
        `Placement armed for ${characterName || "Character"}. Click the map to place.`
      );
    },
    [armCharacterPlacement]
  );

  const loadEnemies = useCallback(async () => {
    if (!socket || !playerID || !gameID) return;
    setLoadingEnemies(true);
    setEnemyError("");
    const response = await emitWithAck(socket, "campaign_listEnemies", {
      playerID,
      campaignID: gameID,
    });
    setLoadingEnemies(false);

    if (!response?.success) {
      setEnemyError(response?.message || "Failed to load enemies");
      return;
    }

    setEnemies(Array.isArray(response?.enemies) ? response.enemies : []);
    setEnemyStatus("Enemy list updated.");
  }, [socket, playerID, gameID]);

  const createEnemy = useCallback(
    async (event) => {
      event?.preventDefault?.();
      if (!socket || !playerID || !gameID) return;

      const response = await emitWithAck(socket, "campaign_createEnemy", {
        playerID,
        campaignID: gameID,
        enemy: enemyDraft,
      });

      if (!response?.success) {
        setEnemyError(response?.message || "Failed to create enemy");
        return;
      }

      setEnemyStatus(`Created enemy: ${response?.enemy?.name || "Enemy"}`);
      setEnemyDraft((prev) => ({
        ...prev,
        name: "",
      }));
      await loadEnemies();
    },
    [socket, playerID, gameID, enemyDraft, loadEnemies]
  );

  const deleteEnemy = useCallback(
    async (enemyId) => {
      if (!socket || !playerID || !gameID || !enemyId) return;
      const response = await emitWithAck(socket, "campaign_deleteEnemy", {
        playerID,
        campaignID: gameID,
        enemyID: enemyId,
      });
      if (!response?.success) {
        setEnemyError(response?.message || "Failed to delete enemy");
        return;
      }
      setEnemyStatus("Enemy deleted.");
      await loadEnemies();
    },
    [socket, playerID, gameID, loadEnemies]
  );

  const spawnEnemyAtCursor = useCallback(
    (enemyId, enemyName, enemySize) => {
      if (!enemyId) return;
      setEnemyError("");
      armEnemyPlacement({
        enemyId,
        name: enemyName,
        size: enemySize,
      });
      setEnemyStatus(
        `Placement armed for ${enemyName || "Enemy"}. Click the map to place.`
      );
    },
    [armEnemyPlacement]
  );

  useEffect(() => {
    if (!isDM) return;
    loadSaveList();
  }, [isDM, loadSaveList]);

  useEffect(() => {
    if (!isDM) return;
    loadAssignments();
    loadEnemies();
  }, [isDM, loadAssignments, loadEnemies]);

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

      {characterPlacement && (
        <div className="text-xs rounded border border-emerald-600 bg-emerald-900/40 p-3 flex items-center justify-between gap-2">
          <span className="text-emerald-200">
            Placing {characterPlacement.name || (characterPlacement.kind === "enemy" ? "Enemy" : "Character")}. Click the map to place.
          </span>
          <button
            type="button"
            onClick={clearCharacterPlacement}
            className="text-[11px] px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="text-sm space-y-1 rounded border border-gray-700 bg-gray-900/70 p-3">
        <p className="font-semibold">Camera</p>
        <p>X: {cameraSnapshot.x}</p>
        <p>Y: {cameraSnapshot.y}</p>
        <p>Zoom: {cameraSnapshot.zoom}</p>
      </div>

      <div className="text-sm space-y-2 rounded border border-gray-700 bg-gray-900/70 p-3">
        <p className="font-semibold">Vision</p>
        {fovError && <div className="text-xs text-red-200 bg-red-900/40 rounded p-2">{fovError}</div>}
        {fovStatus && (
          <div className="text-xs text-emerald-200 bg-emerald-900/30 rounded p-2">
            {fovStatus}
          </div>
        )}
        <label className="text-xs uppercase tracking-wide text-gray-400">FOV Mode</label>
        <select
          value={fovMode}
          onChange={handleFovModeChange}
          disabled={savingFovMode}
          className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-2 text-xs text-gray-100"
        >
          <option value="party">Shared Party FOV</option>
          <option value="perPlayer">Per-Player FOV</option>
        </select>
        <p className="text-[11px] text-gray-400">
          Party mode shares all player vision. Per-player restricts each player to their own
          vision sources.
        </p>
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
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">Campaign Characters</p>
          <button
            type="button"
            onClick={loadAssignments}
            disabled={loadingAssignments}
            className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:bg-gray-700"
          >
            {loadingAssignments ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {assignmentError && (
          <div className="text-xs text-red-200 bg-red-900/40 rounded p-2">{assignmentError}</div>
        )}
        {assignmentStatus && (
          <div className="text-xs text-emerald-200 bg-emerald-900/30 rounded p-2">
            {assignmentStatus}
          </div>
        )}

        <div className="space-y-2">
          {campaignAssignments.length > 0 ? (
            campaignAssignments.map((assignment) => {
              const characterId = String(assignment?.characterId || "");
              const characterName =
                assignment?.characterName ||
                assignment?.characterId?.name ||
                "Character";
              const playerName = assignment?.playerName || "Player";
              const isOnMap = characters.some(
                (char) => String(char?.id || "") === characterId
              );

              return (
                <div
                  key={`${assignment?.playerId || "player"}:${characterId}`}
                  className="p-2 rounded border border-gray-700 bg-gray-800/80 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{characterName}</p>
                      <p className="text-[11px] text-gray-400">
                        Owner: {playerName} | ID: {characterId || "Unknown"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isOnMap && (
                        <span className="text-[10px] px-2 py-1 rounded bg-emerald-900/70 text-emerald-200 border border-emerald-600">
                          On Map
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => spawnCharacterAtCursor(characterId, characterName)}
                        className="text-xs px-2 py-1 rounded bg-blue-700 hover:bg-blue-600"
                      >
                        Place on Map
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-gray-400">No assigned characters yet.</p>
          )}
        </div>
      </div>

      <div className="text-sm space-y-2 rounded border border-gray-700 bg-gray-900/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">Enemies</p>
          <button
            type="button"
            onClick={loadEnemies}
            disabled={loadingEnemies}
            className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:bg-gray-700"
          >
            {loadingEnemies ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {enemyError && (
          <div className="text-xs text-red-200 bg-red-900/40 rounded p-2">{enemyError}</div>
        )}
        {enemyStatus && (
          <div className="text-xs text-emerald-200 bg-emerald-900/30 rounded p-2">
            {enemyStatus}
          </div>
        )}

        <form onSubmit={createEnemy} className="space-y-2 rounded border border-gray-700 bg-gray-800/80 p-2">
          <p className="text-xs uppercase tracking-wide text-gray-400">Create Enemy</p>
          <input
            type="text"
            placeholder="Enemy name"
            value={enemyDraft.name}
            onChange={(event) =>
              setEnemyDraft((prev) => ({ ...prev, name: event.target.value }))
            }
            className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-gray-100"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={1}
              value={enemyDraft.level}
              onChange={(event) =>
                setEnemyDraft((prev) => ({
                  ...prev,
                  level: Number(event.target.value) || 1,
                }))
              }
              className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-gray-100"
              placeholder="Level"
            />
            <input
              type="number"
              min={1}
              value={enemyDraft.maxHP}
              onChange={(event) => {
                const nextMax = Number(event.target.value) || 1;
                setEnemyDraft((prev) => ({
                  ...prev,
                  maxHP: nextMax,
                  hp: Math.min(prev.hp || nextMax, nextMax),
                }));
              }}
              className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-gray-100"
              placeholder="Max HP"
            />
            <input
              type="number"
              min={0}
              value={enemyDraft.hp}
              onChange={(event) =>
                setEnemyDraft((prev) => ({
                  ...prev,
                  hp: Number(event.target.value) || 0,
                }))
              }
              className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-gray-100"
              placeholder="Current HP"
            />
            <input
              type="number"
              min={10}
              value={enemyDraft.size}
              onChange={(event) =>
                setEnemyDraft((prev) => ({
                  ...prev,
                  size: Number(event.target.value) || 30,
                }))
              }
              className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-gray-100"
              placeholder="Size"
            />
            <input
              type="number"
              min={10}
              value={enemyDraft.visionDistance}
              onChange={(event) =>
                setEnemyDraft((prev) => ({
                  ...prev,
                  visionDistance: Number(event.target.value) || 150,
                }))
              }
              className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-gray-100"
              placeholder="Vision Dist"
            />
            <input
              type="number"
              min={10}
              max={360}
              value={enemyDraft.visionArc}
              onChange={(event) =>
                setEnemyDraft((prev) => ({
                  ...prev,
                  visionArc: Number(event.target.value) || 90,
                }))
              }
              className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-gray-100"
              placeholder="Vision Arc"
            />
          </div>
          <button
            type="submit"
            className="w-full text-xs px-2 py-2 rounded bg-emerald-700 hover:bg-emerald-600"
          >
            Create Enemy
          </button>
        </form>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Enemy Library ({enemies.length})
          </p>
          {enemies.length > 0 ? (
            enemies.map((enemy) => (
              <div
                key={enemy._id}
                className="p-2 rounded border border-gray-700 bg-gray-800/80 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{enemy?.name || "Enemy"}</p>
                    <p className="text-[11px] text-gray-400">
                      HP {enemy?.HP?.current ?? 0}/{enemy?.HP?.max ?? 0} | Size {enemy?.size || 30}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        spawnEnemyAtCursor(enemy._id, enemy?.name, enemy?.size)
                      }
                      className="text-xs px-2 py-1 rounded bg-blue-700 hover:bg-blue-600"
                    >
                      Place on Map
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteEnemy(enemy._id)}
                      className="text-xs px-2 py-1 rounded bg-red-700 hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400">No enemies created yet.</p>
          )}
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
