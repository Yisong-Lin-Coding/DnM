import { useRef, useEffect, useState } from "react";
import { michelangeloEngine } from "./game/michelangeloEngine";
import { backgroundLayer } from "./game/Map Layers/0Background";
import { gridlayer } from "./game/Map Layers/4Grid";
import getImage from "../handlers/getImage";
import GameSidePanel from "../pageComponents/game_sidepanel";

// Configuration
const GRID_SIZE = 50;
const MIN_SIDE_WIDTH = 200;
const MAX_SIDE_WIDTH = 800;
const ZOOM_FACTOR = 1.1;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

// Layer definitions - single source of truth
const LAYER_CONFIG = [
  { name: "background", component: backgroundLayer, zIndex: 0 },
  { name: "grid", component: gridlayer, zIndex: 1 },
];

function Test() {
  // UI State
  const [sideWidth, setSideWidth] = useState(320);
  const [dragging, setDragging] = useState(false);
  const [fogEnabled, setFogEnabled] = useState(true);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedChar, setSelectedChar] = useState(null);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  // Refs
  const spacePressed = useRef(false);
  const isPanning = useRef(false);
  const camera = useRef({ x: 0, y: 0, zoom: 1, bgImage: null });
  const layerRefs = useRef({});

  const mood = "calm1";

  // Character data
  const characters = [
    {
      id: "char1",
      name: "Hero",
      position: { x: 25, y: 50 },
      size: 50,
      visionDistance: 200,
      rotation: 45,
      visionArc: 90,
      team: "player",
    },
    {
      id: "char2",
      name: "Ally",
      position: { x: 100, y: 100 },
      size: 20,
      visionDistance: 150,
      rotation: 180,
      visionArc: 120,
      team: "player",
    },
    {
      id: "char3",
      name: "Enemy",
      position: { x: 400, y: 300 },
      size: 30,
      visionDistance: 100,
      rotation: 270,
      visionArc: 90,
      team: "enemy",
    },
  ];

  // Load background image
  useEffect(() => {
    const img = new Image();
    img.src = getImage(mood);
    img.onload = () => {
      camera.current.bgImage = img;
    };
  }, [mood]);

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

  const worldMouseCoords = screenToWorld(lastMouse.x, lastMouse.y);

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

  // Main render loop
  useEffect(() => {
    let raf;

    const loop = () => {
      const layers = LAYER_CONFIG.map((config) => ({
        ...config.component,
        ctx: layerRefs.current[config.name]?.getContext("2d"),
        canvas: layerRefs.current[config.name],
      }));

      michelangeloEngine({
        layers,
        state: {
          bgImage: camera.current.bgImage,
          camera: camera.current,
        },
      });

      raf = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

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

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        spacePressed.current = true;
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
  }, []);

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
      setSelectedChar(foundChar);
    }
  };

  const handleMouseMove = (e) => {
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    setLastMouse({ x: e.clientX, y: e.clientY });

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
    const char = characters.find((c) => c.id === contextMenu.charId);
    console.log(`Action "${action}" on character:`, char?.name);
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
        className="grid min-h-screen bg-gray-800 absolute top-0 right-0"
        style={{ gridTemplateColumns: `1fr 6px ${sideWidth}px`, zIndex: 100 }}
      >
        <div
          className="bg-gray-700 cursor-col-resize hover:bg-gray-500 col-start-2"
          onMouseDown={handleResizerMouseDown}
        />

        <div className="bg-gray-800 p-4 overflow-y-auto">
          <h2 className="text-white text-xl font-bold mb-4">Side Panel</h2>
          <p className="text-gray-300 mb-4">Selected: {selectedChar || "None"}</p>

          <div className="space-y-4">
            <button
              onClick={() => setFogEnabled(!fogEnabled)}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              {fogEnabled ? "Disable" : "Enable"} Fog of War
            </button>

            <div className="text-gray-300 text-sm">
              <p className="font-semibold mb-2">Controls:</p>
              <ul className="space-y-1">
                <li>• Left click to select</li>
                <li>• Right click for actions</li>
                <li>• Space + drag to pan</li>
                <li>• Scroll to zoom</li>
                <li>• Green = Player team</li>
                <li>• Red = Enemy team</li>
              </ul>
            </div>

            <div className="text-gray-300 text-sm">
              <p className="font-semibold mb-2">Fog of War:</p>
              <p>Only player characters reveal the map. Enemy units are hidden in fog.</p>
            </div>

            <div className="text-gray-300 text-sm">
              <p className="font-semibold mb-2">Mouse Position:</p>
              <p>Screen: X:{Math.round(lastMouse.x)} Y:{Math.round(lastMouse.y)}</p>
              <p>
                World: X:{Math.round(worldMouseCoords.x)} Y:{Math.round(worldMouseCoords.y)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Test;