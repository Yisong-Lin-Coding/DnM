import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { michelangeloEngine } from "./michelangeloEngine";
import { backgroundLayer } from "./Map Layers/0Background";
import { gridlayer } from "./Map Layers/4Grid";
import getImage from "../../handlers/getImage";
import GameSidePanel from "../../pageComponents/game_sidepanel";
import { useGame } from "../../data/gameContext";
import { mapObjectsLayer } from "./Map Layers/2Enviornment";
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

const LAYER_CONFIG = [
    { name: "background", component: backgroundLayer, zIndex: 0 },
    { name: "grid", component: gridlayer, zIndex: 1 },
    { name: "mapObjects", component: mapObjectsLayer, zIndex: 2 },
];

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

    const type = String(obj.type || "circle").toLowerCase();
    const x = Number(obj.x) || 0;
    const y = Number(obj.y) || 0;

    if (type === "rect") {
        const width = Math.max(1, Number(obj.width) || 0);
        const height = Math.max(1, Number(obj.height) || 0);
        return Math.abs(worldX - x) <= width / 2 && Math.abs(worldY - y) <= height / 2;
    }

    if (type === "triangle") {
        const size = Math.max(1, Number(obj.size) || 0);
        return isPointInsideTriangle(worldX, worldY, x, y, size);
    }

    const radius = Math.max(1, Number(obj.size) || 0);
    const dx = worldX - x;
    const dy = worldY - y;
    return dx * dx + dy * dy <= radius * radius;
}

function findTopMapObjectAt(worldX, worldY, mapObjects = []) {
    const sorted = [...mapObjects].sort((a, b) => (Number(b.z) || 0) - (Number(a.z) || 0));
    return sorted.find((obj) => isPointInsideMapObject(worldX, worldY, obj)) || null;
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
        updateMapObject,
        moveCharacter,
        isDM,
        setIsDM,
        backgroundKey,
        mapObjectPlacement,
        clearMapObjectPlacement,
        placePendingMapObjectAt,
        loadGameSnapshot,
    } = useGame();

    const [sideWidth, setSideWidth] = useState(320);
    const [dragging, setDragging] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [dragTarget, setDragTarget] = useState(null);
    const [gameContextError, setGameContextError] = useState("");
    const [loadingGameContext, setLoadingGameContext] = useState(true);
    const [placementDrag, setPlacementDrag] = useState(null);

    const spacePressed = useRef(false);
    const isPanning = useRef(false);
    const layerRefs = useRef({});
    const prevStateRef = useRef(null);
    const keysPressed = useRef({
        KeyW: false,
        KeyA: false,
        KeyS: false,
        KeyD: false,
        KeyQ: false,
        KeyE: false,
    });

    useEffect(() => {
        const selectedBackgroundKey = String(backgroundKey || "calm1").toLowerCase();
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
            loadGameSnapshot(response?.snapshot || {});
        }

        bootstrapGameContext();

        return () => {
            cancelled = true;
        };
    }, [socket, playerID, gameID, setIsDM, loadGameSnapshot]);

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

    useEffect(() => {
        let raf;

        const loop = () => {
            if (!Object.values(layerRefs.current).every((canvas) => canvas)) {
                raf = requestAnimationFrame(loop);
                return;
            }

            if (!camera?.current) {
                raf = requestAnimationFrame(loop);
                return;
            }

            const layers = LAYER_CONFIG.map((config) => ({
                ...config.component,
                ctx: layerRefs.current[config.name]?.getContext("2d"),
                canvas: layerRefs.current[config.name],
            }));

            const cameraSnapshot = {
                x: Number(camera.current.x) || 0,
                y: Number(camera.current.y) || 0,
                zoom: Number(camera.current.zoom) || 1,
                bgImage: camera.current.bgImage || null,
            };

            const currentState = {
                bgImage: cameraSnapshot.bgImage,
                camera: cameraSnapshot,
                mapObjects,
            };

            michelangeloEngine({
                layers,
                state: currentState,
                prevState: prevStateRef.current,
            });

            prevStateRef.current = currentState;
            raf = requestAnimationFrame(loop);
        };

        loop();
        return () => cancelAnimationFrame(raf);
    }, [camera, mapObjects]);

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
            if (keysPressed.current.hasOwnProperty(event.code)) {
                keysPressed.current[event.code] = true;
                event.preventDefault();
            }
        };

        const onKeyUp = (event) => {
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
            if (event.code === "Space") {
                event.preventDefault();
                spacePressed.current = true;
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

        const onKeyUp = (event) => {
            if (event.code === "Space") {
                spacePressed.current = false;
                isPanning.current = false;
            }
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, [camera]);

    useEffect(() => {
        const onEscape = (event) => {
            if (event.key !== "Escape") return;
            setContextMenu(null);
            setDragTarget(null);
            setPlacementDrag(null);
            clearMapObjectPlacement();
        };

        window.addEventListener("keydown", onEscape);
        return () => window.removeEventListener("keydown", onEscape);
    }, [clearMapObjectPlacement]);

    useEffect(() => {
        if (!mapObjectPlacement) {
            setPlacementDrag(null);
        }
    }, [mapObjectPlacement]);

    const handleMouseDown = (event) => {
        const world = getWorldFromMouseEvent(event);
        if (!world) return;

        if (event.button === 2) {
            event.preventDefault();
            const targetChar = findCharacterAt(world.x, world.y, isDM);
            const contextCharId = targetChar?.id || selectedChar;
            if (contextCharId) {
                selectCharacter(contextCharId);
                setContextMenu({ x: event.clientX, y: event.clientY, charId: contextCharId });
            }
            return;
        }

        if (event.button === 1 || (event.button === 0 && spacePressed.current)) {
            event.preventDefault();
            isPanning.current = true;
            return;
        }

        if (event.button !== 0 || spacePressed.current) {
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

        if (isDM) {
            const objectTarget = findTopMapObjectAt(world.x, world.y, mapObjects);
            if (objectTarget) {
                setDragTarget({
                    type: "mapObject",
                    id: objectTarget.id,
                    offsetX: world.x - objectTarget.x,
                    offsetY: world.y - objectTarget.y,
                });
                return;
            }

            const characterTarget = findCharacterAt(world.x, world.y, true);
            if (characterTarget) {
                selectCharacter(characterTarget.id);
                setDragTarget({
                    type: "character",
                    id: characterTarget.id,
                    offsetX: world.x - characterTarget.position.x,
                    offsetY: world.y - characterTarget.position.y,
                });
                return;
            }
        }

        const visibleCharacter = findCharacterAt(world.x, world.y, false);
        selectCharacter(visibleCharacter?.id || null);
    };

    const handleMouseMove = (event) => {
        setLastMouse({ x: event.clientX, y: event.clientY });

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
                updateMapObject(dragTarget.id, {
                    x: Math.round(targetX),
                    y: Math.round(targetY),
                });
                return;
            }

            if (dragTarget.type === "character") {
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
                placePendingMapObjectAt(placementDrag.startWorld.x, placementDrag.startWorld.y);
            } else {
                const draggedPlacement = buildPlacementFromDrag(
                    mapObjectPlacement,
                    placementDrag.startWorld,
                    releaseWorld
                );
                placePendingMapObjectAt(
                    draggedPlacement.x,
                    draggedPlacement.y,
                    draggedPlacement.overrides
                );
            }

            setPlacementDrag(null);
        }

        isPanning.current = false;
        setDragTarget(null);
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

    const handleAction = (action) => {
        if (!contextMenu?.charId) return;
        handleCharacterAction(contextMenu.charId, action);
        setContextMenu(null);
    };

    const renderSelectedInfo = () => {
        if (!selectedChar) return null;
        const char = characters.find((c) => c.id === selectedChar);
        if (!char) return null;

        const screen = worldToScreen(char.position.x, char.position.y);
        const isLeft = screen.x < window.innerWidth / 2;

        return (
            <div
                className={`absolute top-16 bg-gray-800 text-white px-4 py-2 rounded shadow-lg z-50 ${
                    isLeft ? "left-4" : "right-4"
                }`}
                style={{ maxWidth: "220px" }}
            >
                Selected: {char.name}
            </div>
        );
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
        <div>
            <div
                className="w-full h-screen relative"
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
                </div>

                {LAYER_CONFIG.map((layer) => (
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

                {contextMenu && (
                    <div
                        className="absolute bg-gray-800 border border-gray-600 rounded shadow-lg z-50"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onMouseLeave={() => setContextMenu(null)}
                        onContextMenu={(event) => event.preventDefault()}
                    >
                        <div className="py-1">
                            {["move", "attack", "defend", "skills"].map((action) => (
                                <button
                                    key={action}
                                    onClick={() => handleAction(action)}
                                    className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center gap-2"
                                >
                                    <span>
                                        {action === "move" && "🚶"}
                                        {action === "attack" && "⚔️"}
                                        {action === "defend" && "🛡️"}
                                        {action === "skills" && "✨"}
                                    </span>
                                    {action.charAt(0).toUpperCase() + action.slice(1)}
                                </button>
                            ))}
                            <div className="border-t border-gray-600 my-1" />
                            <button
                                onClick={() => handleAction("info")}
                                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center gap-2"
                            >
                                <span>ℹ️</span> Info
                            </button>
                        </div>
                    </div>
                )}

                {renderSelectedInfo()}
            </div>

            <div
                className="grid max-h-screen bg-gray-800 absolute top-0 right-0 h-full"
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
