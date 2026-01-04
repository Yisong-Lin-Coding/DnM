import { useRef, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { michelangeloEngine } from "./michelangeloEngine";
import { backgroundLayer } from "./Map Layers/0Background";
import { gridlayer } from "./Map Layers/4Grid";
import getImage from "../../handlers/getImage";
import GameSidePanel from "../../pageComponents/game_sidepanel";
import { useGame } from "../../data/gameContext";
import { mapObjectsLayer } from "./Map Layers/2Enviornment";

// Configuration
const GRID_SIZE = 50;
const MIN_SIDE_WIDTH = 200;
const MAX_SIDE_WIDTH = 800;
const ZOOM_FACTOR = 1.1;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const PAN_SPEED = 13;

// Layer definitions - single source of truth
const LAYER_CONFIG = [
  { name: "background", component: backgroundLayer, zIndex: 0 },
  { name: "grid", component: gridlayer, zIndex: 1 },
  { name: "mapObjects", component: mapObjectsLayer, zIndex: 2 }
];

function GameComponent() {
  const { gameID } = useParams();

  // Get shared state from context
const {
  selectedChar,
  selectCharacter,
  fogEnabled,
  characters,
  lastMouse,
  setLastMouse,
  camera,
  worldMouseCoords,
  handleCharacterAction,
  mapObjects, // NEW
} =useGame()

  // Local UI state (not shared with other components)
  const [sideWidth, setSideWidth] = useState(320);
  const [dragging, setDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  // Refs
  const spacePressed = useRef(false);
  const isPanning = useRef(false);
  const layerRefs = useRef({});
  const keysPressed = useRef({
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    KeyQ: false,
    KeyE: false,
  });

  const mood = "calm1";

  // Load background image
  useEffect(() => {
    const img = new Image();
    img.src = getImage(mood);
    img.onload = () => {
      camera.current.bgImage = img;
    };
  }, [mood, camera]);

  // Canvas setup utilities
  const formatCanvas = (canvas) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  };

  // Initialize all canvases
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

  // Coordinate conversion utilities
  const degreeToRadian = (degrees) => (degrees * Math.PI) / 180;

  const worldToScreen = (worldX, worldY) => ({
    x: worldX * camera.current.zoom - camera.current.x,
    y: worldY * camera.current.zoom - camera.current.y,
  });

  const screenToWorld = (screenX, screenY) => ({
    x: (screenX + camera.current.x) / camera.current.zoom,
    y: (screenY + camera.current.y) / camera.current.zoom,
  });

  // Visibility check for fog of war
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

        // Normalize angle
        while (angleDiff > 180) angleDiff -= 360;
        while (angleDiff < -180) angleDiff += 360;

        if (Math.abs(angleDiff) <= char.visionArc / 2) {
          return true;
        }
      }
    }

    return false;
  };

  const prevStateRef = useRef({});
  // Main render loop
 useEffect(() => {
  let raf;

  const loop = () => {
    if (!Object.values(layerRefs.current).every((c) => c)) {
      raf = requestAnimationFrame(loop);
      return;
    }

    const layers = LAYER_CONFIG.map((config) => ({
      ...config.component,
      ctx: layerRefs.current[config.name]?.getContext("2d"),
      canvas: layerRefs.current[config.name],
    }));

    // Current state
    const currentState = {
      bgImage: camera.current.bgImage,
      camera: camera.current,
      mapObjects: mapObjects, // Objects from context
    };

    michelangeloEngine({
      layers,
      state: currentState,
      prevState: prevStateRef.current, // Pass previous state
    });

    // Store current state for next frame
    prevStateRef.current = currentState;

    raf = requestAnimationFrame(loop);
  };

  loop();
  return () => cancelAnimationFrame(raf);
}, [camera, mapObjects]);

  // Global mouse tracking for side panel resizing
  useEffect(() => {
    const onMouseMove = (e) => {
      if (dragging) {
        const newWidth = window.innerWidth - e.clientX;
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

  // Key press tracking
  useEffect(() => {
    const onKeyDown = (e) => {
      if (keysPressed.current.hasOwnProperty(e.code)) {
        keysPressed.current[e.code] = true;
        e.preventDefault();
      }
    };

    const onKeyUp = (e) => {
      if (keysPressed.current.hasOwnProperty(e.code)) {
        keysPressed.current[e.code] = false;
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Keyboard controls for camera movement
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
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

    const onKeyUp = (e) => {
      if (e.code === "Space") {
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

  // Mouse handlers
  const handleMouseDown = (e) => {
    if (e.button === 2) {
      e.preventDefault();
      if (selectedChar) {
        setContextMenu({ x: e.clientX, y: e.clientY, charId: selectedChar });
      }
      return;
    }

    if (e.button === 1 || (e.button === 0 && spacePressed.current)) {
      e.preventDefault();
      isPanning.current = true;
      return;
    }

    if (e.button === 0 && !spacePressed.current) {
      setContextMenu(null);
      const canvas = layerRefs.current.background;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const world = screenToWorld(screenX, screenY);

      let foundChar = null;
      for (const char of characters) {
        if (!isVisible(char.position.x, char.position.y)) continue;
        const distSq =
          (world.x - char.position.x) ** 2 + (world.y - char.position.y) ** 2;
        if (distSq <= (char.size / 2) ** 2) {
          foundChar = char.id;
          break;
        }
      }
      selectCharacter(foundChar); // Using context function
    }
  };

  const handleMouseMove = (e) => {
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    setLastMouse({ x: e.clientX, y: e.clientY }); // Updates context

    if (isPanning.current) {
      camera.current.x -= dx;
      camera.current.y -= dy;
    }
  };

  const handleMouseUp = () => {
    isPanning.current = false;
  };

  const handleResizerMouseDown = (e) => {
    e.stopPropagation();
    setDragging(true);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    setContextMenu(null);

    const worldX = (e.clientX + camera.current.x) / camera.current.zoom;
    const worldY = (e.clientY + camera.current.y) / camera.current.zoom;

    camera.current.zoom *= e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    camera.current.zoom = Math.max(MIN_ZOOM, Math.min(camera.current.zoom, MAX_ZOOM));

    camera.current.x = worldX * camera.current.zoom - e.clientX;
    camera.current.y = worldY * camera.current.zoom - e.clientY;
  };

  const handleAction = (action) => {
    handleCharacterAction(contextMenu.charId, action); // Using context function
    setContextMenu(null);
  };

  // Render selected character info
  const renderSelectedInfo = () => {
    if (!selectedChar) return null;
    const char = characters.find((c) => c.id === selectedChar);
    if (!char) return null;

    const screen = worldToScreen(char.position.x, char.position.y);
    const isLeft = screen.x < window.innerWidth / 2;

    return (
      <div
        className={`absolute top-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg z-50 ${
          isLeft ? "left-4" : "right-4"
        }`}
        style={{ maxWidth: "200px" }}
      >
        Selected: {char.name}
      </div>
    );
  };

  return (
    <div>
      <div
        className="w-full h-screen relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Dynamically render all canvas layers */}
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

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="absolute bg-gray-800 border border-gray-600 rounded shadow-lg z-50"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseLeave={() => setContextMenu(null)}
            onContextMenu={(e) => e.preventDefault()}
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
              <div className="border-t border-gray-600 my-1"></div>
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

      {/* Side Panel */}
      <div
        className="grid max-h-screen bg-gray-800 absolute top-0 right-0 h-full"
        style={{ gridTemplateColumns: `1fr 6px ${sideWidth}px`, zIndex: 100 }}
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