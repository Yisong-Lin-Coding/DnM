import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { michelangeloEngine } from "./michelangeloEngine";
import { GAME_LAYER_REGISTRY, bindLayerCanvases } from "./Map Layers/layerRegistry";
import getImage from "../../handlers/getImage";
import GameSidePanel from "../../pageComponents/game_sidepanel";
import { useGame } from "../../data/gameContext";
import { SocketContext } from "../../socket.io/context";
import { emitWithAck } from "../campaign/socketEmit";

const MIN_SIDE_WIDTH = 200;
const MAX_SIDE_WIDTH = 800;
const ZOOM_FACTOR = 1.1;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const PAN_SPEED = 13;
const CLICK_DRAG_THRESHOLD_PX = 6;
const MIN_RECT_WORLD_SIZE = 8;
const MIN_SHAPE_WORLD_SIZE = 4;
const AUTO_SAVE_DEBOUNCE_MS = 900;
const INFO_PANEL_WIDTH = 320;
const INFO_PANEL_MIN_LEFT = 12;
const INFO_PANEL_MIN_TOP = 12;
const INFO_PANEL_MAX_BOTTOM_PADDING = 120;
const RESIZE_HANDLE_HIT_RADIUS_PX = 15;
const HEIGHT_HANDLE_OFFSET_PX = 32;

const DEFAULT_MAX_HP_BY_TERRAIN = {
    floor: 500,
    wall: 1200,
    obstacle: 700,
};

function isPointInsideTriangle(worldX, worldY, objX, objY, size) {
    const p0 = { x: objX, y: objY - size };
    const p1 = { x: objX - size, y: objY + size };
    const p2 = { x: objX + size, y: objY + size };

    const area = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const p = { x: worldX, y: worldY };
    const s1 = area(p, p0, p1);
    const s2 = area(p, p1, p2);
    const s3 = area(p, p2, p0);
    const hasNeg = s1 < 0 || s2 < 0 || s3 < 0;
    const hasPos = s1 > 0 || s2 > 0 || s3 > 0;
    return !(hasNeg && hasPos);
}

function isPointInsideMapObject(worldX, worldY, obj) {
    if (!obj) return false;

    const type = String(obj?.hitbox?.type || obj.type || "circle").toLowerCase();
    const hitboxScale = Math.max(0.1, Number(obj?.hitbox?.scale) || 1);
    const x = (Number(obj.x) || 0) + (Number(obj?.hitbox?.offsetX) || 0);
    const y = (Number(obj.y) || 0) + (Number(obj?.hitbox?.offsetY) || 0);

    if (type === "rect") {
        const width = Math.max(1, (Number(obj.width) || 0) * hitboxScale);
        const height = Math.max(1, (Number(obj.height) || 0) * hitboxScale);
        return Math.abs(worldX - x) <= width / 2 && Math.abs(worldY - y) <= height / 2;
    }

    if (type === "triangle") {
        const size = Math.max(1, (Number(obj.size) || 0) * hitboxScale);
        return isPointInsideTriangle(worldX, worldY, x, y, size);
    }

    const radius = Math.max(1, (Number(obj.size) || 0) * hitboxScale);
    const dx = worldX - x;
    const dy = worldY - y;
    return dx * dx + dy * dy <= radius * radius;
}

function findTopMapObjectAt(worldX, worldY, mapObjects = []) {
    const terrainPriority = (terrainType) => {
        const terrain = String(terrainType || "").toLowerCase();
        if (terrain === "obstacle") return 3;
        if (terrain === "wall") return 2;
        if (terrain === "floor") return 1;
        return 0;
    };
    const sorted = [...mapObjects].sort((a, b) => {
        const zDiff = (Number(b?.z) || 0) - (Number(a?.z) || 0);
        if (zDiff !== 0) return zDiff;
        return terrainPriority(b?.terrainType) - terrainPriority(a?.terrainType);
    });
    return sorted.find((obj) => isPointInsideMapObject(worldX, worldY, obj)) || null;
}

function toEntityID(value) {
    return String(value ?? "").trim();
}

function isSameEntity(a, b) {
    if (!a || !b) return false;
    return String(a.type || "") === String(b.type || "") && toEntityID(a.id) === toEntityID(b.id);
}

function getObjectZLevel(obj) {
    return Math.round(Number(obj?.zLevel) || 0);
}

function getMapObjectBounds(obj) {
    const objectType = String(obj?.type || "circle").toLowerCase();
    const x = Number(obj?.x) || 0;
    const y = Number(obj?.y) || 0;

    if (objectType === "rect") {
        const halfWidth = Math.max(1, Number(obj?.width) || 0) / 2;
        const halfHeight = Math.max(1, Number(obj?.height) || 0) / 2;
        return {
            minX: x - halfWidth,
            maxX: x + halfWidth,
            minY: y - halfHeight,
            maxY: y + halfHeight,
        };
    }

    const radius = Math.max(1, Number(obj?.size) || 0);
    return {
        minX: x - radius,
        maxX: x + radius,
        minY: y - radius,
        maxY: y + radius,
    };
}

function doBoundsOverlap(a, b) {
    return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function isWallObject(obj) {
    return String(obj?.terrainType || "").trim().toLowerCase() === "wall";
}

function wouldWallOverlapAtPosition(candidate, objects = [], ignoreId = null) {
    if (!isWallObject(candidate)) return false;

    const candidateBounds = getMapObjectBounds(candidate);
    const candidateLevel = getObjectZLevel(candidate);
    const ignoreKey = ignoreId == null ? "" : toEntityID(ignoreId);

    return (Array.isArray(objects) ? objects : []).some((obj) => {
        if (!isWallObject(obj)) return false;
        if (getObjectZLevel(obj) !== candidateLevel) return false;
        if (ignoreKey && toEntityID(obj?.id) === ignoreKey) return false;
        return doBoundsOverlap(candidateBounds, getMapObjectBounds(obj));
    });
}

function worldToScreenWithCamera(cameraSnapshot, worldX, worldY) {
    return {
        x: worldX * cameraSnapshot.zoom - cameraSnapshot.x,
        y: worldY * cameraSnapshot.zoom - cameraSnapshot.y,
    };
}

function buildResizeHandlesForObject(obj, cameraSnapshot) {
    if (!obj || !cameraSnapshot) return [];
    const bounds = getMapObjectBounds(obj);
    const topLeft = worldToScreenWithCamera(cameraSnapshot, bounds.minX, bounds.minY);
    const topRight = worldToScreenWithCamera(cameraSnapshot, bounds.maxX, bounds.minY);
    const bottomRight = worldToScreenWithCamera(cameraSnapshot, bounds.maxX, bounds.maxY);
    const bottomLeft = worldToScreenWithCamera(cameraSnapshot, bounds.minX, bounds.maxY);
    const topCenter = worldToScreenWithCamera(
        cameraSnapshot,
        (bounds.minX + bounds.maxX) / 2,
        bounds.minY
    );

    return [
        { id: "nw", x: topLeft.x, y: topLeft.y },
        { id: "ne", x: topRight.x, y: topRight.y },
        { id: "se", x: bottomRight.x, y: bottomRight.y },
        { id: "sw", x: bottomLeft.x, y: bottomLeft.y },
        { id: "height", x: topCenter.x, y: topCenter.y - HEIGHT_HANDLE_OFFSET_PX },
    ];
}

function findResizeHandleAtScreenPoint(screenX, screenY, handles = []) {
    return handles.find((handle) => {
        const dx = screenX - handle.x;
        const dy = screenY - handle.y;
        return dx * dx + dy * dy <= RESIZE_HANDLE_HIT_RADIUS_PX * RESIZE_HANDLE_HIT_RADIUS_PX;
    }) || null;
}

function getResizeAnchorForHandle(handleID, bounds) {
    if (!bounds) return null;
    if (handleID === "nw") return { x: bounds.maxX, y: bounds.maxY };
    if (handleID === "ne") return { x: bounds.minX, y: bounds.maxY };
    if (handleID === "se") return { x: bounds.minX, y: bounds.minY };
    if (handleID === "sw") return { x: bounds.maxX, y: bounds.minY };
    return null;
}

function isTypingTarget(target) {
    if (!target || typeof target !== "object") return false;
    const tag = String(target.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return Boolean(target.isContentEditable);
}

function resolveDMPermission(response, playerID) {
    const explicitPermission = response?.permissions?.isDM;
    if (typeof explicitPermission === "boolean") return explicitPermission;
    if (typeof explicitPermission === "string") {
        const normalized = explicitPermission.trim().toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
    }

    const dmID = String(response?.campaign?.dmId || "").trim();
    const normalizedPlayerID = String(playerID || "").trim();
    return Boolean(dmID && normalizedPlayerID && dmID === normalizedPlayerID);
}

function buildPlacementFromDrag(placementConfig, startWorld, endWorld) {
    const type = String(placementConfig?.type || "circle").toLowerCase();
    const centerX = (startWorld.x + endWorld.x) / 2;
    const centerY = (startWorld.y + endWorld.y) / 2;
    const deltaX = Math.abs(endWorld.x - startWorld.x);
    const deltaY = Math.abs(endWorld.y - startWorld.y);

    if (type === "rect") {
        return {
            x: Math.round(centerX),
            y: Math.round(centerY),
            overrides: {
                width: Math.max(MIN_RECT_WORLD_SIZE, Math.round(deltaX)),
                height: Math.max(MIN_RECT_WORLD_SIZE, Math.round(deltaY)),
            },
        };
    }

    const size = Math.max(MIN_SHAPE_WORLD_SIZE, Math.round(Math.max(deltaX, deltaY) / 2));
    return {
        x: Math.round(centerX),
        y: Math.round(centerY),
        overrides: { size },
    };
}

function GameComponent() {
    const socket = useContext(SocketContext);
    const navigate = useNavigate();
    const { gameID, sessionID } = useParams();
    const playerID = localStorage.getItem("player_ID");

    const safeSessionID = sessionID || sessionStorage.getItem("session_ID") || "default";

    const {
    selectedChar,
    selectCharacter,
    fogEnabled,
    characters,
    lastMouse,
    setLastMouse,
    camera,
    handleCharacterAction,
    mapObjects,
    addMapObject,
    updateMapObject,
    deleteMapObject,
    updateCharacter,
    moveCharacter,
    isDM,
    setIsDM,
    backgroundKey,
    floorTypes,
    replaceFloorTypes,
    lighting,
    currentZLevel,
    stepZLevelUp,
    stepZLevelDown,
    mapObjectPlacement,
    clearMapObjectPlacement,
    placePendingMapObjectAt,
    lightPlacement,        // ADD THIS
    placeLightAt,          // ADD THIS
    clearLightPlacement,   // ADD THIS
    loadGameSnapshot,
    } = useGame();

    const [sideWidth, setSideWidth] = useState(320);
    const [dragging, setDragging] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [selectedEntity, setSelectedEntity] = useState(null);
    const [dragTarget, setDragTarget] = useState(null);
    const [gameContextError, setGameContextError] = useState("");
    const [loadingGameContext, setLoadingGameContext] = useState(true);
    const [placementDrag, setPlacementDrag] = useState(null);
    const [autoSaveStatus, setAutoSaveStatus] = useState("");
    const [turnNumber, setTurnNumber] = useState(1);
    const [infoPanelPosition, setInfoPanelPosition] = useState(null);
    const [infoPanelDrag, setInfoPanelDrag] = useState(null);
    const [blockedMovePreview, setBlockedMovePreview] = useState(null);
    const [resizeTarget, setResizeTarget] = useState(null);

    const isPanning = useRef(false);
    const layerRefs = useRef({});
    const layerBindingsRef = useRef([]);
    const prevStateRef = useRef(null);
    const applyingServerStateRef = useRef(false);
    const skipNextAutoSaveRef = useRef(false);
    const syncingWorldRef = useRef(false);
    const autoSavingRef = useRef(false);
    const autoSaveTimerRef = useRef(null);
    const hasAutoSaveBaselineRef = useRef(false);
    const latestSnapshotRef = useRef({
        mapObjects: [],
        backgroundKey: "",
        characters: [],
        floorTypes: [],
        currentZLevel: 0,
        lighting: null,
    });
    const keysPressed = useRef({
        KeyW: false,
        KeyA: false,
        KeyS: false,
        KeyD: false,
        KeyQ: false,
        KeyE: false,
    });

    const runAutoSave = useCallback(
        async (trigger = "map_change") => {
            if (!socket || !playerID || !gameID || !isDM || loadingGameContext) return;
            if (autoSavingRef.current) return;

            autoSavingRef.current = true;
            const now = new Date();
            const snapshotSource = latestSnapshotRef.current || {};
            const triggerLabel = trigger === "turn_done" ? "turn end" : "map change";

            const response = await emitWithAck(socket, "campaign_saveGame", {
                playerID,
                campaignID: gameID,
                name: `Auto Save ${now.toLocaleString()}`,
                description: "Automatic save from active game session",
                snapshot: {
                    mapObjects: Array.isArray(snapshotSource.mapObjects)
                        ? snapshotSource.mapObjects
                        : [],
                    backgroundKey: String(snapshotSource.backgroundKey || ""),
                    characters: Array.isArray(snapshotSource.characters)
                        ? snapshotSource.characters
                        : [],
                    currentZLevel: Number(snapshotSource.currentZLevel) || 0,
                    floorTypes: Array.isArray(snapshotSource.floorTypes)
                        ? snapshotSource.floorTypes
                        : [],
                    lighting:
                        snapshotSource.lighting && typeof snapshotSource.lighting === "object"
                            ? snapshotSource.lighting
                            : undefined,
                },
                metadata: {
                    source: "autosave",
                    trigger,
                },
                makeActive: true,
                isAutoSave: true,
            });

            autoSavingRef.current = false;

            if (!response?.success) {
                setAutoSaveStatus(`Autosave failed: ${response?.message || "Unknown error"}`);
                return;
            }

            setAutoSaveStatus(`Autosaved (${triggerLabel}) ${now.toLocaleTimeString()}`);
        },
        [socket, playerID, gameID, isDM, loadingGameContext]
    );

    const scheduleAutoSave = useCallback(
        (trigger = "map_change", options = {}) => {
            const immediate = Boolean(options?.immediate);
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }

            if (immediate) {
                runAutoSave(trigger);
                return;
            }

            setAutoSaveStatus("Autosave queued...");
            autoSaveTimerRef.current = setTimeout(() => {
                autoSaveTimerRef.current = null;
                runAutoSave(trigger);
            }, AUTO_SAVE_DEBOUNCE_MS);
        },
        [runAutoSave]
    );

    const handleTurnDone = useCallback(() => {
        if (!isDM) return;
        setTurnNumber((prev) => prev + 1);
        scheduleAutoSave("turn_done", { immediate: true });
    }, [isDM, scheduleAutoSave]);

    useEffect(
        () => () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
        },
        []
    );

    useEffect(() => {
        const selectedBackgroundKey = String(backgroundKey || "gray").toLowerCase();
        const backgroundImage = getImage(selectedBackgroundKey);
        if (!backgroundImage) {
            camera.current.bgImage = null;
            return;
        }

        const img = new Image();
        img.src = backgroundImage;
        img.onload = () => {
            camera.current.bgImage = img;
        };
    }, [backgroundKey, camera]);

    useEffect(() => {
        let cancelled = false;

        async function bootstrapGameContext() {
            if (!socket || !playerID || !gameID) {
                if (!cancelled) {
                    setLoadingGameContext(false);
                    setGameContextError("Missing game context. Rejoin from lobby.");
                }
                return;
            }

            const response = await emitWithAck(socket, "campaign_getGameContext", {
                playerID,
                campaignID: gameID,
            });

            if (cancelled) return;

            if (!response?.success) {
                setLoadingGameContext(false);
                setIsDM(false);
                setGameContextError(response?.message || "Failed to load campaign permissions");
                return;
            }

            const canEdit = resolveDMPermission(response, playerID);
            setIsDM(canEdit);
            setGameContextError("");
            setLoadingGameContext(false);

            if (Array.isArray(response?.floorTypes)) {
                replaceFloorTypes(response.floorTypes);
            }

            const initialSnapshot =
                response?.engineState?.snapshot && typeof response.engineState.snapshot === "object"
                    ? response.engineState.snapshot
                    : response?.snapshot || {};
            applyingServerStateRef.current = true;
            skipNextAutoSaveRef.current = true;
            loadGameSnapshot(initialSnapshot);
        }

        bootstrapGameContext();

        return () => {
            cancelled = true;
        };
    }, [socket, playerID, gameID, setIsDM, loadGameSnapshot, replaceFloorTypes]);

    useEffect(() => {
        if (!socket || !gameID) return undefined;

        const handleServerWorldUpdate = (payload = {}) => {
            if (String(payload?.campaignID || "") !== String(gameID)) return;
            const snapshot =
                payload?.engineState?.snapshot && typeof payload.engineState.snapshot === "object"
                    ? payload.engineState.snapshot
                    : null;
            if (!snapshot) return;

            if (Array.isArray(payload?.floorTypes)) {
                replaceFloorTypes(payload.floorTypes);
            }
            applyingServerStateRef.current = true;
            skipNextAutoSaveRef.current = true;
            loadGameSnapshot(snapshot);
        };

        socket.on("campaign_gameStateUpdated", handleServerWorldUpdate);
        return () => {
            socket.off("campaign_gameStateUpdated", handleServerWorldUpdate);
        };
    }, [socket, gameID, loadGameSnapshot, replaceFloorTypes]);

    useEffect(() => {
        if (!socket || !playerID || !gameID || !isDM || loadingGameContext) return undefined;
        if (applyingServerStateRef.current) {
            applyingServerStateRef.current = false;
            return undefined;
        }

        const timer = setTimeout(async () => {
            if (syncingWorldRef.current) return;
            syncingWorldRef.current = true;

            const response = await emitWithAck(socket, "campaign_gameSyncWorld", {
                playerID,
                campaignID: gameID,
                statePatch: {
                    mapObjects,
                    backgroundKey,
                    characters,
                    floorTypes,
                    lighting,
                },
            });
            syncingWorldRef.current = false;

            if (!response?.success) {
                if (response?.message) {
                    setGameContextError((prev) => prev || response.message);
                }
                return;
            }

            const snapshot =
                response?.engineState?.snapshot && typeof response.engineState.snapshot === "object"
                    ? response.engineState.snapshot
                    : null;
            if (!snapshot) return;

            setGameContextError("");

            if (Array.isArray(response?.floorTypes)) {
                replaceFloorTypes(response.floorTypes);
            }
            applyingServerStateRef.current = true;
            skipNextAutoSaveRef.current = true;
            loadGameSnapshot(snapshot);
        }, 160);

        return () => clearTimeout(timer);
    }, [
        socket,
        playerID,
        gameID,
        isDM,
        loadingGameContext,
        mapObjects,
        backgroundKey,
        characters,
        floorTypes,
        lighting,
        loadGameSnapshot,
        replaceFloorTypes,
    ]);

    useEffect(() => {
        if (!socket || !playerID || !gameID || !isDM || loadingGameContext) return;

        if (skipNextAutoSaveRef.current) {
            skipNextAutoSaveRef.current = false;
            hasAutoSaveBaselineRef.current = true;
            return;
        }

        if (!hasAutoSaveBaselineRef.current) {
            hasAutoSaveBaselineRef.current = true;
            return;
        }

        scheduleAutoSave("map_change");
    }, [
        socket,
        playerID,
        gameID,
        isDM,
        loadingGameContext,
        mapObjects,
        backgroundKey,
        characters,
        floorTypes,
        lighting,
        currentZLevel,
        scheduleAutoSave,
    ]);

    const formatCanvas = (canvas) => {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return ctx;
    };

    useEffect(() => {
        const resizeAllCanvases = () => {
            Object.values(layerRefs.current).forEach((canvas) => {
                if (canvas) formatCanvas(canvas);
            });
        };

        resizeAllCanvases();
        window.addEventListener("resize", resizeAllCanvases);
        return () => window.removeEventListener("resize", resizeAllCanvases);
    }, []);

    const worldToScreen = (worldX, worldY) => ({
        x: worldX * camera.current.zoom - camera.current.x,
        y: worldY * camera.current.zoom - camera.current.y,
    });

    const screenToWorld = (screenX, screenY) => ({
        x: (screenX + camera.current.x) / camera.current.zoom,
        y: (screenY + camera.current.y) / camera.current.zoom,
    });

    const getWorldFromMouseEvent = (event) => {
        const canvas = layerRefs.current.background;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        return screenToWorld(screenX, screenY);
    };

    const getScreenFromMouseEvent = (event) => {
        const canvas = layerRefs.current.background;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    };

    const isVisible = (x, y) => {
        if (!fogEnabled) return true;

        const playerChars = characters.filter((c) => c.team === "player");

        for (const char of playerChars) {
            const dx = x - char.position.x;
            const dy = y - char.position.y;
            const distSq = dx * dx + dy * dy;

            if (distSq <= char.visionDistance * char.visionDistance) {
                const angleToPoint = (Math.atan2(dy, dx) * 180) / Math.PI;
                let angleDiff = angleToPoint - char.rotation;

                while (angleDiff > 180) angleDiff -= 360;
                while (angleDiff < -180) angleDiff += 360;

                if (Math.abs(angleDiff) <= char.visionArc / 2) {
                    return true;
                }
            }
        }

        return false;
    };

    const findCharacterAt = (worldX, worldY, includeHidden = false) => {
        const list = includeHidden ? characters : characters.filter((char) => isVisible(char.position.x, char.position.y));
        for (let i = list.length - 1; i >= 0; i -= 1) {
            const char = list[i];
            const dx = worldX - char.position.x;
            const dy = worldY - char.position.y;
            const radius = Math.max(1, Number(char.size) || 0) / 2;
            if (dx * dx + dy * dy <= radius * radius) {
                return char;
            }
        }
        return null;
    };

    const activeMapObjects = useMemo(
        () => mapObjects.filter((obj) => getObjectZLevel(obj) === currentZLevel),
        [mapObjects, currentZLevel]
    );

    const floorTypesByID = useMemo(() => {
        const byID = new Map();
        (Array.isArray(floorTypes) ? floorTypes : []).forEach((entry) => {
            const id = String(entry?.id || "").trim();
            if (!id || byID.has(id)) return;
            byID.set(id, entry);
        });
        return byID;
    }, [floorTypes]);

    const findInteractionTargetAt = (worldX, worldY, includeHiddenCharacters = false) => {
        const characterTarget = findCharacterAt(worldX, worldY, includeHiddenCharacters);
        if (characterTarget) {
            return {
                type: "character",
                id: characterTarget.id,
            };
        }

        const mapObjectTarget = findTopMapObjectAt(worldX, worldY, activeMapObjects);
        if (mapObjectTarget) {
            return {
                type: "mapObject",
                id: mapObjectTarget.id,
            };
        }

        return null;
    };

    const selectedEntityData = useMemo(() => {
        if (!selectedEntity?.type) return null;

        if (selectedEntity.type === "character") {
            const character = characters.find(
                (char) => toEntityID(char?.id) === toEntityID(selectedEntity.id)
            );
            if (!character) return null;
            return {
                type: "character",
                id: character.id,
                entity: character,
            };
        }

        if (selectedEntity.type === "mapObject") {
            const object = mapObjects.find(
                (obj) => toEntityID(obj?.id) === toEntityID(selectedEntity.id)
            );
            if (!object) return null;
            const floorType = floorTypesByID.get(String(object?.floorTypeId || "").trim()) || null;
            return {
                type: "mapObject",
                id: object.id,
                entity: object,
                floorType,
            };
        }

        return null;
    }, [selectedEntity, characters, mapObjects, floorTypesByID]);

    useEffect(() => {
        latestSnapshotRef.current = {
            mapObjects,
            backgroundKey,
            characters,
            floorTypes,
            currentZLevel,
            lighting,
        };
    }, [mapObjects, backgroundKey, characters, floorTypes, currentZLevel, lighting]);

    useEffect(() => {
        if (!selectedEntity) return;
        if (selectedEntityData) return;
        setSelectedEntity(null);
    }, [selectedEntity, selectedEntityData]);

    const clampInfoPanelPosition = useCallback(
        (x, y) => {
            const maxX = Math.max(
                INFO_PANEL_MIN_LEFT,
                window.innerWidth - sideWidth - INFO_PANEL_WIDTH - INFO_PANEL_MIN_LEFT
            );
            const maxY = Math.max(
                INFO_PANEL_MIN_TOP,
                window.innerHeight - INFO_PANEL_MAX_BOTTOM_PADDING
            );
            return {
                x: Math.max(INFO_PANEL_MIN_LEFT, Math.min(Math.round(x), Math.round(maxX))),
                y: Math.max(INFO_PANEL_MIN_TOP, Math.min(Math.round(y), Math.round(maxY))),
            };
        },
        [sideWidth]
    );

    useEffect(() => {
        if (!selectedEntityData?.type) {
            setInfoPanelDrag(null);
            return;
        }
        setInfoPanelPosition((prev) => {
            if (prev && Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
                return clampInfoPanelPosition(prev.x, prev.y);
            }
            return clampInfoPanelPosition(
                window.innerWidth - sideWidth - INFO_PANEL_WIDTH - INFO_PANEL_MIN_LEFT,
                INFO_PANEL_MIN_TOP
            );
        });
    }, [selectedEntityData, sideWidth, clampInfoPanelPosition]);

    useEffect(() => {
        const onResize = () => {
            setInfoPanelPosition((prev) =>
                prev ? clampInfoPanelPosition(prev.x, prev.y) : prev
            );
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [clampInfoPanelPosition]);

    useEffect(() => {
        if (!infoPanelDrag) return undefined;

        const onMouseMove = (event) => {
            const next = clampInfoPanelPosition(
                event.clientX - infoPanelDrag.offsetX,
                event.clientY - infoPanelDrag.offsetY
            );
            setInfoPanelPosition(next);
        };

        const onMouseUp = () => setInfoPanelDrag(null);

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [infoPanelDrag, clampInfoPanelPosition]);

    useEffect(() => {
        if (!selectedChar) return;
        setSelectedEntity((prev) => {
            const next = { type: "character", id: selectedChar };
            if (isSameEntity(prev, next)) return prev;
            return next;
        });
    }, [selectedChar]);

    useEffect(() => {
        let raf;

        const loop = () => {
            const missingCanvas = GAME_LAYER_REGISTRY.some((entry) => !layerRefs.current[entry.name]);
            if (missingCanvas) {
                raf = requestAnimationFrame(loop);
                return;
            }

            if (!camera?.current) {
                raf = requestAnimationFrame(loop);
                return;
            }

            const needsRebind =
                layerBindingsRef.current.length !== GAME_LAYER_REGISTRY.length ||
                GAME_LAYER_REGISTRY.some((entry, index) => {
                    const binding = layerBindingsRef.current[index];
                    const canvas = layerRefs.current[entry.name];
                    return !binding || binding.canvas !== canvas || !binding.ctx;
                });

            if (needsRebind) {
                layerBindingsRef.current = bindLayerCanvases(
                    GAME_LAYER_REGISTRY,
                    layerRefs.current
                );
            }

            const layers = layerBindingsRef.current;

            const cameraSnapshot = {
                x: Number(camera.current.x) || 0,
                y: Number(camera.current.y) || 0,
                zoom: Number(camera.current.zoom) || 1,
                bgImage: camera.current.bgImage || null,
            };
            const selectedMapObjectID =
                selectedEntity?.type === "mapObject" ? toEntityID(selectedEntity.id) : "";

            const currentState = {
                bgImage: cameraSnapshot.bgImage,
                backgroundKey,
                camera: cameraSnapshot,
                mapObjects,
                floorTypes,
                currentZLevel,
                selectedMapObjectID,
                blockedMovePreview,
                lighting,
                showResizeHandles: isDM,
            };

            michelangeloEngine({
                layers,
                frame: {
                    state: currentState,
                    prevState: prevStateRef.current,
                    cache: {},
                },
            });

            prevStateRef.current = currentState;
            raf = requestAnimationFrame(loop);
        };

        loop();
        return () => cancelAnimationFrame(raf);
    }, [camera, mapObjects, floorTypes, currentZLevel, selectedEntity, blockedMovePreview, lighting, backgroundKey, isDM]);

    useEffect(() => {
        const onMouseMove = (event) => {
            if (dragging) {
                const newWidth = window.innerWidth - event.clientX;
                setSideWidth(Math.max(MIN_SIDE_WIDTH, Math.min(newWidth, MAX_SIDE_WIDTH)));
            }
        };

        const onMouseUp = () => {
            setDragging(false);
        };

        if (dragging) {
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [dragging]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (isTypingTarget(event.target)) return;
            if (keysPressed.current.hasOwnProperty(event.code)) {
                keysPressed.current[event.code] = true;
                event.preventDefault();
            }
        };

        const onKeyUp = (event) => {
            if (isTypingTarget(event.target)) return;
            if (keysPressed.current.hasOwnProperty(event.code)) {
                keysPressed.current[event.code] = false;
                event.preventDefault();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (isTypingTarget(event.target)) return;

            if (event.code === "Space") {
                event.preventDefault();
                stepZLevelUp();
                return;
            }

            if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
                event.preventDefault();
                stepZLevelDown();
                return;
            }

            const dx = PAN_SPEED;
            const dy = PAN_SPEED;

            if (keysPressed.current.KeyW) camera.current.y -= dy;
            if (keysPressed.current.KeyS) camera.current.y += dy;
            if (keysPressed.current.KeyA) camera.current.x -= dx;
            if (keysPressed.current.KeyD) camera.current.x += dx;

            if (keysPressed.current.KeyQ) {
                camera.current.zoom *= 1 / ZOOM_FACTOR;
                camera.current.zoom = Math.max(MIN_ZOOM, Math.min(camera.current.zoom, MAX_ZOOM));
            }
            if (keysPressed.current.KeyE) {
                camera.current.zoom *= ZOOM_FACTOR;
                camera.current.zoom = Math.max(MIN_ZOOM, Math.min(camera.current.zoom, MAX_ZOOM));
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [camera, stepZLevelDown, stepZLevelUp]);

    useEffect(() => {
        const onEscape = (event) => {
            if (event.key !== "Escape") return;
            setContextMenu(null);
            setDragTarget(null);
            setResizeTarget(null);
            setPlacementDrag(null);
            setBlockedMovePreview(null);
            setSelectedEntity(null);
            selectCharacter(null);
            clearMapObjectPlacement();
            clearLightPlacement();
        };

        window.addEventListener("keydown", onEscape);
        return () => window.removeEventListener("keydown", onEscape);
    }, [clearMapObjectPlacement, selectCharacter]);

    useEffect(() => {
        if (!mapObjectPlacement) {
            setPlacementDrag(null);
        }
    }, [mapObjectPlacement]);

    const selectEntity = useCallback(
        (target) => {
            if (!target?.type) {
                setSelectedEntity(null);
                selectCharacter(null);
                return;
            }

            const next = { type: target.type, id: target.id };
            setSelectedEntity(next);
            if (next.type === "character") {
                selectCharacter(next.id);
            } else {
                selectCharacter(null);
            }
        },
        [selectCharacter]
    );

    const handleMouseDown = (event) => {
        const world = getWorldFromMouseEvent(event);
        if (!world) return;
        setBlockedMovePreview(null);

        if (event.button === 2) {
            event.preventDefault();
            const target =
                findInteractionTargetAt(world.x, world.y, isDM) ||
                (selectedEntity?.type ? selectedEntity : null);
            if (target) {
                setContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    world: { x: world.x, y: world.y },
                    target: {
                        type: target.type,
                        id: target.id,
                    },
                });
            } else {
                setContextMenu(null);
            }
            return;
        }

        if (event.button === 1) {
            event.preventDefault();
            isPanning.current = true;
            return;
        }

        if (event.button !== 0) {
            return;
        }

        setContextMenu(null);

        if (isDM && mapObjectPlacement) {
            setPlacementDrag({
                startWorld: { x: world.x, y: world.y },
                currentWorld: { x: world.x, y: world.y },
                startClient: { x: event.clientX, y: event.clientY },
            });
            return;
        }
        if (isDM && lightPlacement) {
            placeLightAt(world.x, world.y);
            return;
        }

        if (isDM && selectedEntityData?.type === "mapObject") {
            const selectedObject = selectedEntityData.entity;
            if (selectedObject && getObjectZLevel(selectedObject) === currentZLevel) {
                const screen = getScreenFromMouseEvent(event);
                const cameraSnapshot = {
                    x: Number(camera.current?.x) || 0,
                    y: Number(camera.current?.y) || 0,
                    zoom: Number(camera.current?.zoom) || 1,
                };
                const handles = buildResizeHandlesForObject(selectedObject, cameraSnapshot);
                const hitHandle = screen
                    ? findResizeHandleAtScreenPoint(screen.x, screen.y, handles)
                    : null;
                if (hitHandle) {
                    setDragTarget(null);
                    setBlockedMovePreview(null);
                    if (hitHandle.id === "height") {
                        setResizeTarget({
                            type: "height",
                            id: selectedObject.id,
                            startClientY: event.clientY,
                            startHeight: Math.round(Number(selectedObject?.elevationHeight) || 0),
                        });
                        return;
                    }

                    const bounds = getMapObjectBounds(selectedObject);
                    const anchor = getResizeAnchorForHandle(hitHandle.id, bounds);
                    if (anchor) {
                        setResizeTarget({
                            type: "shape",
                            id: selectedObject.id,
                            handle: hitHandle.id,
                            anchorX: anchor.x,
                            anchorY: anchor.y,
                        });
                        return;
                    }
                }
            }
        }

        const target = findInteractionTargetAt(world.x, world.y, isDM);
        if (!target) {
            selectEntity(null);
            return;
        }

        selectEntity(target);

        if (!isDM) return;

        if (target.type === "mapObject") {
            const objectTarget = activeMapObjects.find(
                (obj) => toEntityID(obj?.id) === toEntityID(target.id)
            );
            if (!objectTarget) return;
            setDragTarget({
                type: "mapObject",
                id: objectTarget.id,
                offsetX: world.x - (Number(objectTarget.x) || 0),
                offsetY: world.y - (Number(objectTarget.y) || 0),
            });
            return;
        }

        if (target.type === "character") {
            const characterTarget = characters.find(
                (char) => toEntityID(char?.id) === toEntityID(target.id)
            );
            if (!characterTarget) return;
            setDragTarget({
                type: "character",
                id: characterTarget.id,
                offsetX: world.x - (Number(characterTarget?.position?.x) || 0),
                offsetY: world.y - (Number(characterTarget?.position?.y) || 0),
            });
        }
    };

    const handleMouseMove = (event) => {
        setLastMouse({ x: event.clientX, y: event.clientY });

        if (resizeTarget && isDM) {
            const objectTarget = mapObjects.find(
                (obj) => toEntityID(obj?.id) === toEntityID(resizeTarget.id)
            );
            if (!objectTarget) return;

            setBlockedMovePreview(null);

            if (resizeTarget.type === "height") {
                const zoom = Number(camera.current?.zoom) || 1;
                const deltaHeight = (resizeTarget.startClientY - event.clientY) / Math.max(0.1, zoom);
                const nextHeight = Math.max(
                    0,
                    Math.round((Number(resizeTarget.startHeight) || 0) + deltaHeight)
                );
                updateMapObject(resizeTarget.id, {
                    elevationHeight: nextHeight,
                });
                return;
            }

            const world = getWorldFromMouseEvent(event);
            if (!world) return;

            const anchorX = Number(resizeTarget.anchorX);
            const anchorY = Number(resizeTarget.anchorY);
            const minX = Math.min(anchorX, world.x);
            const maxX = Math.max(anchorX, world.x);
            const minY = Math.min(anchorY, world.y);
            const maxY = Math.max(anchorY, world.y);
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const objectType = String(objectTarget?.type || "circle").toLowerCase();

            if (objectType === "rect") {
                updateMapObject(resizeTarget.id, {
                    x: Math.round(centerX),
                    y: Math.round(centerY),
                    width: Math.max(MIN_RECT_WORLD_SIZE, Math.round(maxX - minX)),
                    height: Math.max(MIN_RECT_WORLD_SIZE, Math.round(maxY - minY)),
                });
                return;
            }

            updateMapObject(resizeTarget.id, {
                x: Math.round(centerX),
                y: Math.round(centerY),
                size: Math.max(
                    MIN_SHAPE_WORLD_SIZE,
                    Math.round(Math.max(maxX - minX, maxY - minY) / 2)
                ),
            });
            return;
        }

        if (placementDrag && isDM && mapObjectPlacement) {
            const world = getWorldFromMouseEvent(event);
            if (!world) return;

            setPlacementDrag((prev) =>
                prev
                    ? {
                          ...prev,
                          currentWorld: { x: world.x, y: world.y },
                      }
                    : prev
            );
            return;
        }

        if (dragTarget && isDM) {
            const world = getWorldFromMouseEvent(event);
            if (!world) return;
            const targetX = world.x - dragTarget.offsetX;
            const targetY = world.y - dragTarget.offsetY;

            if (dragTarget.type === "mapObject") {
                const objectTarget = mapObjects.find(
                    (obj) => toEntityID(obj?.id) === toEntityID(dragTarget.id)
                );
                if (!objectTarget) {
                    setBlockedMovePreview(null);
                    return;
                }
                const candidate = {
                    ...objectTarget,
                    x: Math.round(targetX),
                    y: Math.round(targetY),
                };
                if (wouldWallOverlapAtPosition(candidate, mapObjects, objectTarget.id)) {
                    setBlockedMovePreview(candidate);
                    return;
                }
                setBlockedMovePreview(null);
                updateMapObject(dragTarget.id, {
                    x: candidate.x,
                    y: candidate.y,
                });
                return;
            }

            if (dragTarget.type === "character") {
                setBlockedMovePreview(null);
                moveCharacter(dragTarget.id, Math.round(targetX), Math.round(targetY));
                return;
            }
        }

        if (isPanning.current) {
            const dx = event.clientX - lastMouse.x;
            const dy = event.clientY - lastMouse.y;
            camera.current.x -= dx;
            camera.current.y -= dy;
        }
    };

    const handleMouseUp = (event) => {
        if (placementDrag && isDM && mapObjectPlacement) {
            const fallbackWorld = placementDrag.currentWorld || placementDrag.startWorld;
            const releaseWorld = getWorldFromMouseEvent(event) || fallbackWorld;
            const endClientX =
                typeof event?.clientX === "number" ? event.clientX : placementDrag.startClient.x;
            const endClientY =
                typeof event?.clientY === "number" ? event.clientY : placementDrag.startClient.y;
            const dragDistancePx = Math.hypot(
                endClientX - placementDrag.startClient.x,
                endClientY - placementDrag.startClient.y
            );

            if (dragDistancePx <= CLICK_DRAG_THRESHOLD_PX) {
                placePendingMapObjectAt(placementDrag.startWorld.x, placementDrag.startWorld.y, {
                    zLevel: currentZLevel,
                });
            } else {
                const draggedPlacement = buildPlacementFromDrag(
                    mapObjectPlacement,
                    placementDrag.startWorld,
                    releaseWorld
                );
                placePendingMapObjectAt(
                    draggedPlacement.x,
                    draggedPlacement.y,
                    {
                        ...draggedPlacement.overrides,
                        zLevel: currentZLevel,
                    }
                );
            }

            setPlacementDrag(null);
        }

        isPanning.current = false;
        setDragTarget(null);
        setResizeTarget(null);
        setBlockedMovePreview(null);
    };

    const handleResizerMouseDown = (event) => {
        event.stopPropagation();
        setDragging(true);
    };

    const handleWheel = (event) => {
        event.preventDefault();
        setContextMenu(null);

        const worldX = (event.clientX + camera.current.x) / camera.current.zoom;
        const worldY = (event.clientY + camera.current.y) / camera.current.zoom;

        camera.current.zoom *= event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
        camera.current.zoom = Math.max(MIN_ZOOM, Math.min(camera.current.zoom, MAX_ZOOM));

        camera.current.x = worldX * camera.current.zoom - event.clientX;
        camera.current.y = worldY * camera.current.zoom - event.clientY;
    };

    const applyObjectHPDelta = async (objectID, amount) => {
        if (!socket || !playerID || !gameID) return;

        const response = await emitWithAck(socket, "campaign_gameDamageObject", {
            playerID,
            campaignID: gameID,
            objectID,
            amount,
        });

        if (!response?.success) {
            if (response?.message) {
                setGameContextError((prev) => prev || response.message);
            }
            return;
        }

        const snapshot =
            response?.engineState?.snapshot && typeof response.engineState.snapshot === "object"
                ? response.engineState.snapshot
                : null;
        if (!snapshot) return;
        applyingServerStateRef.current = true;
        skipNextAutoSaveRef.current = true;
        loadGameSnapshot(snapshot);
        setGameContextError("");
    };

    const handleContextAction = async (action) => {
        const target = contextMenu?.target;
        const contextWorld =
            contextMenu?.world &&
            Number.isFinite(Number(contextMenu.world.x)) &&
            Number.isFinite(Number(contextMenu.world.y))
                ? {
                      x: Number(contextMenu.world.x),
                      y: Number(contextMenu.world.y),
                  }
                : null;
        if (!target?.type) return;
        setContextMenu(null);

        if (target.type === "character") {
            const character = characters.find(
                (char) => toEntityID(char?.id) === toEntityID(target.id)
            );
            if (!character) return;

            if (action === "info") {
                selectEntity(target);
                return;
            }

            if (action === "center") {
                const zoom = Number(camera.current?.zoom) || 1;
                camera.current.x = (Number(character?.position?.x) || 0) * zoom - window.innerWidth / 2;
                camera.current.y = (Number(character?.position?.y) || 0) * zoom - window.innerHeight / 2;
                return;
            }

            if (action === "placeHere" && isDM && contextWorld) {
                moveCharacter(character.id, Math.round(contextWorld.x), Math.round(contextWorld.y));
                selectEntity({ type: "character", id: character.id });
                return;
            }

            if (action === "toggleTeam" && isDM) {
                const nextTeam = String(character?.team || "player").toLowerCase() === "enemy"
                    ? "player"
                    : "enemy";
                updateCharacter(character.id, { team: nextTeam });
                selectEntity({ type: "character", id: character.id });
                return;
            }

            if (action === "endTurn" && isDM) {
                handleTurnDone();
                return;
            }

            handleCharacterAction(character.id, action);
            return;
        }

        if (target.type === "mapObject") {
            const object = mapObjects.find((obj) => toEntityID(obj?.id) === toEntityID(target.id));
            if (!object) return;

            if (action === "inspect") {
                selectEntity(target);
                return;
            }

            if (action === "center") {
                const zoom = Number(camera.current?.zoom) || 1;
                camera.current.x = (Number(object?.x) || 0) * zoom - window.innerWidth / 2;
                camera.current.y = (Number(object?.y) || 0) * zoom - window.innerHeight / 2;
                return;
            }

            if (action === "damage10") {
                await applyObjectHPDelta(object.id, 10);
                return;
            }
            if (action === "heal10") {
                await applyObjectHPDelta(object.id, -10);
                return;
            }
            if (action === "delete" && isDM) {
                deleteMapObject(object.id);
                setSelectedEntity((prev) => (isSameEntity(prev, target) ? null : prev));
                return;
            }
            if (action === "duplicate" && isDM) {
                const clone = { ...object };
                delete clone.id;
                addMapObject({
                    ...clone,
                    x: Math.round(Number(object?.x) || 0) + 24,
                    y: Math.round(Number(object?.y) || 0) + 24,
                });
                return;
            }
            if (action === "bringForward" && isDM) {
                updateMapObject(object.id, {
                    z: Math.round(Number(object?.z) || 0) + 1,
                });
                return;
            }
            if (action === "sendBackward" && isDM) {
                updateMapObject(object.id, {
                    z: Math.round(Number(object?.z) || 0) - 1,
                });
                return;
            }
            if (action === "toggleIndestructible" && isDM) {
                if (object?.maxHP == null) {
                    const terrain = String(object?.terrainType || "obstacle").toLowerCase();
                    const restoredHP =
                        DEFAULT_MAX_HP_BY_TERRAIN[terrain] || DEFAULT_MAX_HP_BY_TERRAIN.obstacle;
                    updateMapObject(object.id, {
                        maxHP: restoredHP,
                        hp: restoredHP,
                    });
                } else {
                    updateMapObject(object.id, {
                        maxHP: null,
                        hp: null,
                    });
                }
            }
        }
    };

    const handleInfoPanelMouseDown = useCallback(
        (event) => {
            if (event.button !== 0) return;
            if (!infoPanelPosition) return;
            event.preventDefault();
            event.stopPropagation();
            setInfoPanelDrag({
                offsetX: event.clientX - infoPanelPosition.x,
                offsetY: event.clientY - infoPanelPosition.y,
            });
        },
        [infoPanelPosition]
    );

    const renderSelectedInfo = () => {
        if (!selectedEntityData?.type) return null;
        const panelPos =
            infoPanelPosition ||
            clampInfoPanelPosition(
                window.innerWidth - sideWidth - INFO_PANEL_WIDTH - INFO_PANEL_MIN_LEFT,
                INFO_PANEL_MIN_TOP
            );

        if (selectedEntityData.type === "character") {
            const char = selectedEntityData.entity;
            return (
                <div
                    className="absolute rounded border border-slate-600 bg-slate-900/95 text-white shadow-lg z-[132] w-[320px]"
                    style={{ left: panelPos.x, top: panelPos.y }}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <div
                        className="px-3 py-2 border-b border-slate-700 flex items-center justify-between cursor-move select-none"
                        onMouseDown={handleInfoPanelMouseDown}
                    >
                        <p className="text-sm font-semibold">Selected Character</p>
                        <button
                            type="button"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={() => selectEntity(null)}
                            className="text-xs text-slate-300 hover:text-white"
                        >
                            Close
                        </button>
                    </div>
                    <div className="px-3 py-2 text-xs space-y-1">
                        <p className="text-sm font-semibold">{char.name || "Unnamed Character"}</p>
                        <p>ID: {char.id}</p>
                        <p>Team: {char.team || "unknown"}</p>
                        <p>
                            Position: ({Math.round(Number(char?.position?.x) || 0)},{" "}
                            {Math.round(Number(char?.position?.y) || 0)})
                        </p>
                        <p>Size: {Math.round(Number(char?.size) || 0)}</p>
                        <p>Vision: {Math.round(Number(char?.visionDistance) || 0)}</p>
                        <p>Arc: {Math.round(Number(char?.visionArc) || 0)} deg</p>
                    </div>
                </div>
            );
        }

        if (selectedEntityData.type === "mapObject") {
            const obj = selectedEntityData.entity;
            const floorType = selectedEntityData.floorType;
            return (
                <div
                    className="absolute rounded border border-slate-600 bg-slate-900/95 text-white shadow-lg z-[132] w-[320px]"
                    style={{ left: panelPos.x, top: panelPos.y }}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <div
                        className="px-3 py-2 border-b border-slate-700 flex items-center justify-between cursor-move select-none"
                        onMouseDown={handleInfoPanelMouseDown}
                    >
                        <p className="text-sm font-semibold">Selected Object</p>
                        <button
                            type="button"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={() => selectEntity(null)}
                            className="text-xs text-slate-300 hover:text-white"
                        >
                            Close
                        </button>
                    </div>
                    <div className="px-3 py-2 text-xs space-y-1">
                        <p className="text-sm font-semibold">
                            {String(obj?.type || "object")} #{obj?.id}
                        </p>
                        <p>
                            Position: ({Math.round(Number(obj?.x) || 0)},{" "}
                            {Math.round(Number(obj?.y) || 0)})
                        </p>
                        <p>Terrain: {String(obj?.terrainType || "obstacle")}</p>
                        <p>Z Level: {Math.round(Number(obj?.zLevel) || 0)}</p>
                        <p>Z Index: {Math.round(Number(obj?.z) || 0)}</p>
                        <p>Elevation Height: {Math.round(Number(obj?.elevationHeight) || 0)}</p>
                        {String(obj?.type || "").toLowerCase() === "rect" ? (
                            <p>
                                Footprint: {Math.round(Number(obj?.width) || 0)} x{" "}
                                {Math.round(Number(obj?.height) || 0)}
                            </p>
                        ) : (
                            <p>Footprint Size: {Math.round(Number(obj?.size) || 0)}</p>
                        )}
                        <p>Floor Type: {floorType?.name || String(obj?.floorTypeId || "none")}</p>
                        <p>
                            HP:{" "}
                            {obj?.maxHP == null
                                ? "Indestructible"
                                : `${Math.round(Number(obj?.hp) || 0)} / ${Math.round(
                                      Number(obj?.maxHP) || 0
                                  )}`}
                        </p>
                        {isDM && (
                            <div className="mt-2 pt-2 border-t border-slate-700 space-y-2">
                                <div className="grid grid-cols-2 gap-2 items-center">
                                    <label className="text-[11px] text-slate-300">Object Height</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={Math.round(Number(obj?.elevationHeight) || 0)}
                                        onChange={(event) =>
                                            updateMapObject(obj.id, {
                                                elevationHeight: Math.max(
                                                    0,
                                                    Number(event.target.value) || 0
                                                ),
                                            })
                                        }
                                        className="w-full rounded bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100"
                                    />
                                </div>
                                {String(obj?.type || "").toLowerCase() === "rect" ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="number"
                                            min={MIN_RECT_WORLD_SIZE}
                                            value={Math.round(Number(obj?.width) || 0)}
                                            onChange={(event) =>
                                                updateMapObject(obj.id, {
                                                    width: Math.max(
                                                        MIN_RECT_WORLD_SIZE,
                                                        Number(event.target.value) || 0
                                                    ),
                                                })
                                            }
                                            className="w-full rounded bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100"
                                        />
                                        <input
                                            type="number"
                                            min={MIN_RECT_WORLD_SIZE}
                                            value={Math.round(Number(obj?.height) || 0)}
                                            onChange={(event) =>
                                                updateMapObject(obj.id, {
                                                    height: Math.max(
                                                        MIN_RECT_WORLD_SIZE,
                                                        Number(event.target.value) || 0
                                                    ),
                                                })
                                            }
                                            className="w-full rounded bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100"
                                        />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2 items-center">
                                        <label className="text-[11px] text-slate-300">Footprint Size</label>
                                        <input
                                            type="number"
                                            min={MIN_SHAPE_WORLD_SIZE}
                                            value={Math.round(Number(obj?.size) || 0)}
                                            onChange={(event) =>
                                                updateMapObject(obj.id, {
                                                    size: Math.max(
                                                        MIN_SHAPE_WORLD_SIZE,
                                                        Number(event.target.value) || 0
                                                    ),
                                                })
                                            }
                                            className="w-full rounded bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100"
                                        />
                                    </div>
                                )}
                                <p className="text-[11px] text-slate-400">
                                    Tip: drag corner handles to resize footprint, and drag the top square handle
                                    to edit object height.
                                </p>
                            </div>
                        )}
                        {floorType?.description && (
                            <p className="text-slate-300">Info: {floorType.description}</p>
                        )}
                    </div>
                </div>
            );
        }

        return null;
    };

    const placementPreview = (() => {
        if (!isDM || !mapObjectPlacement || !placementDrag) return null;
        const currentWorld = placementDrag.currentWorld || placementDrag.startWorld;
        const placement = buildPlacementFromDrag(
            mapObjectPlacement,
            placementDrag.startWorld,
            currentWorld
        );
        const center = worldToScreen(placement.x, placement.y);
        const zoom = Number(camera.current.zoom) || 1;
        const type = String(mapObjectPlacement.type || "circle").toLowerCase();
        const color = String(mapObjectPlacement.color || "#3B82F6");

        if (type === "rect") {
            const width = (Number(placement.overrides.width) || MIN_RECT_WORLD_SIZE) * zoom;
            const height = (Number(placement.overrides.height) || MIN_RECT_WORLD_SIZE) * zoom;
            return {
                type,
                color,
                x: center.x,
                y: center.y,
                width,
                height,
            };
        }

        const size = (Number(placement.overrides.size) || MIN_SHAPE_WORLD_SIZE) * zoom;
        if (type === "triangle") {
            return {
                type,
                color,
                points: `${center.x},${center.y - size} ${center.x - size},${center.y + size} ${center.x + size},${center.y + size}`,
            };
        }

        return {
            type: "circle",
            color,
            x: center.x,
            y: center.y,
            radius: size,
        };
    })();

    return (
        <div className="h-screen overflow-hidden">
            <div
                className="w-full h-full relative overflow-hidden"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onContextMenu={(event) => event.preventDefault()}
            >
                <div className="absolute top-3 left-3 z-[130] flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate(`/ISK/${safeSessionID}/lobby`)}
                        className="bg-gray-900/85 border border-gray-600 text-white text-xs px-3 py-2 rounded hover:bg-gray-800"
                    >
                        Exit to Lobby
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/ISK/${safeSessionID}/home`)}
                        className="bg-gray-900/85 border border-gray-600 text-white text-xs px-3 py-2 rounded hover:bg-gray-800"
                    >
                        Home
                    </button>
                    <span
                        className={`text-xs px-3 py-2 rounded border ${
                            isDM
                                ? "bg-emerald-900/70 border-emerald-500 text-emerald-200"
                                : "bg-slate-900/70 border-slate-500 text-slate-200"
                        }`}
                    >
                        {isDM ? "DM Mode" : "Player Mode"}
                    </span>
                    <span className="text-xs px-3 py-2 rounded border bg-slate-900/70 border-slate-500 text-slate-200">
                        Level {currentZLevel} (Space up, Shift down)
                    </span>
                    {isDM && (
                        <button
                            type="button"
                            onClick={handleTurnDone}
                            className="text-xs px-3 py-2 rounded border bg-amber-900/70 border-amber-500 text-amber-200 hover:bg-amber-800/80"
                        >
                            End Turn (Auto Save)
                        </button>
                    )}
                    {isDM && (
                        <span className="text-xs px-3 py-2 rounded border bg-slate-900/70 border-slate-500 text-slate-200">
                            Turn {turnNumber}
                        </span>
                    )}
                    {mapObjectPlacement && (
                        <span className="text-xs px-3 py-2 rounded border bg-blue-900/70 border-blue-500 text-blue-200">
                            Placement: {mapObjectPlacement.type} (click or drag on map)
                        </span>
                    )}
                    
                    {loadingGameContext && (
                        <span className="text-xs px-3 py-2 rounded border bg-slate-900/70 border-slate-500 text-slate-200">
                            Loading game context...
                        </span>
                    )}
                    {gameContextError && (
                        <span className="text-xs px-3 py-2 rounded border bg-red-900/70 border-red-500 text-red-200">
                            {gameContextError}
                        </span>
                    )}
                    {isDM && autoSaveStatus && (
                        <span className="text-xs px-3 py-2 rounded border bg-indigo-900/70 border-indigo-500 text-indigo-200">
                            {autoSaveStatus}
                        </span>
                    )}
                </div>

                {GAME_LAYER_REGISTRY.map((layer) => (
                    <canvas
                        key={layer.name}
                        ref={(el) => (layerRefs.current[layer.name] = el)}
                        className="absolute inset-0 w-full h-full"
                        style={{
                            zIndex: layer.zIndex,
                            backgroundColor: layer.name === "background" ? "#1f2937" : "transparent",
                        }}
                    />
                ))}

                {placementPreview && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-[25]">
                        {placementPreview.type === "rect" && (
                            <rect
                                x={placementPreview.x - placementPreview.width / 2}
                                y={placementPreview.y - placementPreview.height / 2}
                                width={placementPreview.width}
                                height={placementPreview.height}
                                fill={placementPreview.color}
                                fillOpacity="0.28"
                                stroke={placementPreview.color}
                                strokeWidth="2"
                                strokeDasharray="7 5"
                            />
                        )}
                        {placementPreview.type === "circle" && (
                            <circle
                                cx={placementPreview.x}
                                cy={placementPreview.y}
                                r={placementPreview.radius}
                                fill={placementPreview.color}
                                fillOpacity="0.28"
                                stroke={placementPreview.color}
                                strokeWidth="2"
                                strokeDasharray="7 5"
                            />
                        )}
                        {placementPreview.type === "triangle" && (
                            <polygon
                                points={placementPreview.points}
                                fill={placementPreview.color}
                                fillOpacity="0.28"
                                stroke={placementPreview.color}
                                strokeWidth="2"
                                strokeDasharray="7 5"
                            />
                        )}
                    </svg>
                )}

                <div
                    className="absolute bottom-4 z-[132] flex items-center gap-2"
                    style={{ right: Math.max(12, sideWidth + 12) }}
                >
                    <button
                        type="button"
                        onClick={stepZLevelDown}
                        className="h-9 min-w-9 px-2 rounded bg-gray-900/90 border border-slate-500 text-white text-sm hover:bg-gray-800"
                        title="Go down one z-level (Shift)"
                    >
                        Z-
                    </button>
                    <span className="h-9 px-3 flex items-center rounded bg-slate-900/90 border border-slate-500 text-slate-100 text-xs">
                        Level {currentZLevel}
                    </span>
                    <button
                        type="button"
                        onClick={stepZLevelUp}
                        className="h-9 min-w-9 px-2 rounded bg-gray-900/90 border border-slate-500 text-white text-sm hover:bg-gray-800"
                        title="Go up one z-level (Space)"
                    >
                        Z+
                    </button>
                </div>

                {contextMenu && (
                    <div
                        className="absolute bg-gray-800 border border-gray-600 rounded shadow-lg z-50"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onMouseLeave={() => setContextMenu(null)}
                        onContextMenu={(event) => event.preventDefault()}
                    >
                        <div className="py-1">
                            {contextMenu?.target?.type === "character" && (
                                <>
                                    {["move", "attack", "defend", "skills"].map((action) => (
                                        <button
                                            key={action}
                                            onClick={() => handleContextAction(action)}
                                            className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm"
                                        >
                                            {action.charAt(0).toUpperCase() + action.slice(1)}
                                        </button>
                                    ))}
                                    <div className="border-t border-gray-600 my-1" />
                                    <button
                                        onClick={() => handleContextAction("center")}
                                        className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm"
                                    >
                                        Center Camera
                                    </button>
                                    <button
                                        onClick={() => handleContextAction("info")}
                                        className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm"
                                    >
                                        Inspect
                                    </button>
                                    {isDM && (
                                        <>
                                            <div className="border-t border-gray-600 my-1" />
                                            <button
                                                onClick={() => handleContextAction("placeHere")}
                                                className="w-full px-4 py-2 text-left text-emerald-200 hover:bg-gray-700 text-sm"
                                            >
                                                Place Character Here
                                            </button>
                                            <button
                                                onClick={() => handleContextAction("toggleTeam")}
                                                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm"
                                            >
                                                Toggle Team
                                            </button>
                                            <button
                                                onClick={() => handleContextAction("endTurn")}
                                                className="w-full px-4 py-2 text-left text-amber-200 hover:bg-gray-700 text-sm"
                                            >
                                                End Turn + Autosave
                                            </button>
                                        </>
                                    )}
                                </>
                            )}

                            {contextMenu?.target?.type === "mapObject" && (
                                <>
                                    <button
                                        onClick={() => handleContextAction("inspect")}
                                        className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm"
                                    >
                                        Inspect
                                    </button>
                                    <button
                                        onClick={() => handleContextAction("center")}
                                        className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm"
                                    >
                                        Center Camera
                                    </button>
                                    {isDM && (
                                        <>
                                            <div className="border-t border-gray-600 my-1" />
                                            <button
                                                onClick={() => handleContextAction("damage10")}
                                                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm"
                                            >
                                                Damage 10
                                            </button>
                                            <button
                                                onClick={() => handleContextAction("heal10")}
                                                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm"
                                            >
                                                Heal 10
                                            </button>
                                            <button
                                                onClick={() => handleContextAction("delete")}
                                                className="w-full px-4 py-2 text-left text-red-300 hover:bg-gray-700 text-sm"
                                            >
                                                Delete Object
                                            </button>
                                            <button
                                                onClick={() => handleContextAction("duplicate")}
                                                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm"
                                            >
                                                Duplicate
                                            </button>
                                            <button
                                                onClick={() => handleContextAction("bringForward")}
                                                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm"
                                            >
                                                Bring Forward (Z+)
                                            </button>
                                            <button
                                                onClick={() => handleContextAction("sendBackward")}
                                                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm"
                                            >
                                                Send Backward (Z-)
                                            </button>
                                            <button
                                                onClick={() => handleContextAction("toggleIndestructible")}
                                                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm"
                                            >
                                                Toggle Indestructible
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {renderSelectedInfo()}
            </div>

            <div
                className="grid h-full min-h-0 overflow-hidden bg-gray-800 absolute top-0 right-0"
                style={{ gridTemplateColumns: `1fr 6px ${sideWidth}px`, zIndex: 120 }}
            >
                <div
                    className="bg-gray-700 cursor-col-resize hover:bg-gray-500 col-start-2"
                    onMouseDown={handleResizerMouseDown}
                />
                <GameSidePanel />
            </div>
        </div>
    );
}

export default GameComponent;

