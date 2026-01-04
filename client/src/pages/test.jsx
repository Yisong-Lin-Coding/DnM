import { useRef, useEffect, useState } from "react"
import { michelangeloEngine } from "./game/michelangeloEngine";
import { backgroundLayer } from "./game/Map Layers/0Background";
import { gridlayer} from "./game/Map Layers/4Grid"
import getImage from "../handlers/getImage";



function Test() {
  const [sideWidth, setSideWidth] = useState(320);
  const [dragging, setDragging] = useState(false);
  const [fogEnabled, setFogEnabled] = useState(true);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, charId }
  const spacePressed = useRef(false);
  const camera = useRef({ x: 0, y: 0, zoom: 1 });
  const isPanning = useRef(false);
  const [lastMouse, setLastMouse ]= useState({ x: 0, y: 0 });
  const [popUp, setPopUp] = useState([])
  const mood ="calm1"



    useEffect(() => {
      const img = new Image();
      img.src = getImage(`calm1`);
      console.log("BG IMAGE URL:", getImage(`calm1`))

      img.onload = () => {
        camera.current.bgImage = img;
      };
    }, [mood]);


  function formatSingleCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width  = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return ctx;
}
  function useCanvasLayers(layerRefs) {
  const layers = useRef({});

  useEffect(() => {
    for (const [name, ref] of Object.entries(layerRefs)) {
      const canvas = ref.current;
      if (!canvas) continue;

      const ctx = formatSingleCanvas(canvas);

      layers.current[name] = {
        canvas,
        ctx,
      };
    }
  }, []);

  return layers.current;
}

const layers = useCanvasLayers({
  background: bgCanvasRef,
  grid: gridCanvasRef,
  fog: fogCanvasRef,
});

useEffect(() => {
  const resize = () => {
    for (const layer of Object.values(layers.current)) {
      formatSingleCanvas(layer.canvas);
    }
  };

  window.addEventListener("resize", resize);
  return () => window.removeEventListener("resize", resize);
}, []);



  

  const gridSize = 50;
  const canvasRef = useRef(null);
  const [selectedChar, setSelectedChar] = useState(null);

  const CharacterPlaceholder = [
    {
      id: 'char1',
      name: 'Hero',
      position: { x: 25, y: 50 },
      sprite: null,
      size: 50,
      visionRange: 200,
      visiondistance: 200,
      rotation: 45, // degrees
      visionarc: 90, // degrees (cone angle)
      team: 'player'
    },
    {
      id: 'char2',
      name: 'Ally',
      position: { x: 100, y: 100 },
      sprite: null,
      size: 20,
      visionRange: 150,
      visiondistance: 150,
      rotation: 180,
      visionarc: 120,
      team: 'player'
    },
    {
      id: 'char3',
      name: 'Enemy',
      position: { x: 400, y: 300 },
      sprite: null,
      size: 30,
      visionRange: 100,
      visiondistance: 100,
      rotation: 270,
      visionarc: 90,
      team: 'enemy'
    },
  ]




  const bgCanvasRef = useRef(null);
  const gridCanvasRef = useRef(null)

      

  // Helper: Convert degrees to radians
  const degreeToRadian = (degrees) => (degrees * Math.PI) / 180;

  // Helper: Convert world coords to screen coords
  const worldToScreen = (worldX, worldY) => ({
    x: worldX * camera.current.zoom - camera.current.x,
    y: worldY * camera.current.zoom - camera.current.y
  });

  // Helper: Convert screen coords to world coords
  const screenToWorld = (screenX, screenY) => ({
    x: (screenX + camera.current.x) / camera.current.zoom,
    y: (screenY + camera.current.y) / camera.current.zoom
  });


  const worldMouseCords = screenToWorld(lastMouse.x,lastMouse.y)




  // Check if a point is visible to any player character (cone-based)
  const isVisible = (x, y) => {
    if (!fogEnabled) return true;

    const playerChars = CharacterPlaceholder.filter(c => c.team === 'player');
    
    for (const char of playerChars) {
      const dx = x - char.position.x;
      const dy = y - char.position.y;
      const distSq = dx * dx + dy * dy;
      
      // Check if within vision distance
      if (distSq <= char.visiondistance * char.visiondistance) {
        // Check if within vision cone
        const angleToPoint = Math.atan2(dy, dx) * (180 / Math.PI);
        let angleDiff = angleToPoint - char.rotation;
        
        // Normalize angle difference to -180 to 180
        while (angleDiff > 180) angleDiff -= 360;
        while (angleDiff < -180) angleDiff += 360;
        
        if (Math.abs(angleDiff) <= char.visionarc / 2) {
          return true;
        }
      }
    }
    
    return false;
  };


  useEffect(() => {







  }, [selectedChar]);













  // LAYER RENDERING FUNCTIONS
  const drawGrid = (ctx, canvas) => {
    const startX = -camera.current.x % (gridSize * camera.current.zoom);
    const startY = -camera.current.y % (gridSize * camera.current.zoom);

    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;

    for (let x = startX; x < canvas.width; x += gridSize * camera.current.zoom) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = startY; y < canvas.height; y += gridSize * camera.current.zoom) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  };

  const drawShadows = (ctx) => {
    for (const char of CharacterPlaceholder) {
      // Only render if visible
      if (!isVisible(char.position.x, char.position.y)) continue;

      const screen = worldToScreen(char.position.x, char.position.y);
      const size = char.size * camera.current.zoom;

      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y + size * 0.3, size * 0.4, size * 0.15, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();
    }
  };

  const drawCharacters = (ctx) => {
    for (const char of CharacterPlaceholder) {
      // Only render if visible
      if (!isVisible(char.position.x, char.position.y)) continue;

      const screen = worldToScreen(char.position.x, char.position.y);
      const size = char.size * camera.current.zoom;

      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size / 2, 0, Math.PI * 2);
      
      // Color based on team
      if (char.team === 'player') {
        ctx.fillStyle = selectedChar === char.id ? '#3B82F6' : '#10B981';
      } else {
        ctx.fillStyle = '#EF4444';
      }
      ctx.fill();

      // Selection ring
      if (selectedChar === char.id) {
        ctx.strokeStyle = '#60A5FA';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  };

  const drawLabels = (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';

    for (const char of CharacterPlaceholder) {
      // Only render if visible
      if (!isVisible(char.position.x, char.position.y)) continue;

      const screen = worldToScreen(char.position.x, char.position.y);
      const size = char.size * camera.current.zoom;

      ctx.font = `${Math.max(12, 14 * camera.current.zoom)}px Arial`;
      ctx.fillText(char.name, screen.x, screen.y + size / 2 + 15 * camera.current.zoom);
    }
  };

  const drawVisionRanges = (ctx) => {
    const playerChars = CharacterPlaceholder.filter(c => c.team === 'player');
    
    for (const char of playerChars) {
      const screen = worldToScreen(char.position.x, char.position.y);
      const radius = char.visiondistance * camera.current.zoom;
      
      const startAngle = degreeToRadian(char.rotation - char.visionarc / 2);
      const endAngle = degreeToRadian(char.rotation + char.visionarc / 2);

      // Draw vision cone outline
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y);
      ctx.arc(screen.x, screen.y, radius, startAngle, endAngle);
      ctx.lineTo(screen.x, screen.y);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw direction line
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y);
      const dirX = screen.x + Math.cos(degreeToRadian(char.rotation)) * radius;
      const dirY = screen.y + Math.sin(degreeToRadian(char.rotation)) * radius;
      ctx.lineTo(dirX, dirY);
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  };

  // Create offscreen canvas for fog (reuse it)
  const fogCanvasRef = useRef(null);
  
  const drawFogOfWar = (ctx, canvas) => {
    if (!fogEnabled) return;
    if (canvas.width === 0 || canvas.height === 0) return; // Skip if canvas not ready

    // Create or reuse offscreen canvas
    if (!fogCanvasRef.current) {
      fogCanvasRef.current = document.createElement('canvas');
      fogCanvasRef.current.width = canvas.width;
      fogCanvasRef.current.height = canvas.height;
    }
    const fogCanvas = fogCanvasRef.current;
    
    // Resize if needed
    if (fogCanvas.width !== canvas.width || fogCanvas.height !== canvas.height) {
      fogCanvas.width = canvas.width;
      fogCanvas.height = canvas.height;
    }
    
    // Don't draw if still 0
    if (fogCanvas.width === 0 || fogCanvas.height === 0) return;
    
    const fogCtx = fogCanvas.getContext('2d');
    
    // Clear and draw fog on offscreen canvas
    fogCtx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
    fogCtx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
    
    // Cut out vision areas using destination-out
    fogCtx.globalCompositeOperation = 'destination-out';
    
    const playerChars = CharacterPlaceholder.filter(c => c.team === 'player');
    for (const char of playerChars) {
      const screen = worldToScreen(char.position.x, char.position.y);
      const coneRadius = char.visiondistance * camera.current.zoom;
      const circleRadius = 100 * camera.current.zoom;
      
      const startAngle = degreeToRadian(char.rotation - char.visionarc / 2);
      const endAngle = degreeToRadian(char.rotation + char.visionarc / 2);

      // Erase cone area from fog
      fogCtx.fillStyle = 'black';
      fogCtx.beginPath();
      fogCtx.moveTo(screen.x, screen.y);
      fogCtx.arc(screen.x, screen.y, coneRadius, startAngle, endAngle);
      fogCtx.lineTo(screen.x, screen.y);
      fogCtx.fill();
      
      // Erase circle area from fog
      fogCtx.beginPath();
      fogCtx.arc(screen.x, screen.y, circleRadius, 0, Math.PI * 2);
      fogCtx.fill();
    }
    
    // Reset composite operation
    fogCtx.globalCompositeOperation = 'source-over';
    
    // Now draw the completed fog canvas onto main canvas
    ctx.drawImage(fogCanvas, 0, 0);
  };




  useEffect(() => {
      const bgCanvas = bgCanvasRef.current
      const gridCanvas = gridCanvasRef.current

      const bgctx = bgCanvas.getContext("2d") 
      const gridctx = gridCanvas.getContext("2d")

      

    let raf;
    const loop = () => {
      michelangeloEngine({
        layers: [
          {
            ...backgroundLayer,
            ctx:bgctx,
            canvas: bgCanvas,
          },
          {
            ...gridlayer,
            ctx: gridctx ,
            canvas: gridCanvas,
          },
        ],
        state: {
          bgImage: camera.current.bgImage,
          camera:camera.current
        },
      });

      raf = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

useEffect(() => {
  const resizeCanvas = () => {
    const bgCanvas = bgCanvasRef.current;
    const gridCanvas = gridCanvasRef.current;

    bgCanvas.width = bgCanvas.clientWidth;
    bgCanvas.height = bgCanvas.clientHeight;

    gridCanvas.width = gridCanvas.clientWidth;
    gridCanvas.height = gridCanvas.clientHeight;
  };

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  return () => window.removeEventListener('resize', resizeCanvas);
}, []);





  useEffect(() => {
    function onMouseMove(e) {
      const mousePosition = { x: e.clientX, y: e.clientY };
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      setLastMouse(mousePosition)



      if (!dragging) return;
      const newWidth = window.innerWidth - e.clientX;
      setSideWidth(Math.max(200, Math.min(newWidth, 800)));
    }

    function onMouseUp() {
      setDragging(false);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.code === 'Space') {
        e.preventDefault();
        spacePressed.current = true;
      }
    }

    function onKeyUp(e) {
      if (e.code === 'Space') {
        spacePressed.current = false;
        isPanning.current = false;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  function onMouseDown(e) {
    // Right click - open context menu if character is selected
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
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }

    if (e.button === 0 && !spacePressed.current) {
      // Close context menu on left click
      setContextMenu(null);

      const canvas = bgCanvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const world = screenToWorld(screenX, screenY);
      
      let foundChar = null;

      for (const char of CharacterPlaceholder) {
        // Only allow selecting visible characters
        if (!isVisible(char.position.x, char.position.y)) continue;

        const distSq = (world.x - char.position.x) ** 2 + (world.y - char.position.y) ** 2;
        if (distSq <= (char.size / 2) ** 2) {
          foundChar = char.id;
          break;
        }
      }

      setSelectedChar(foundChar);
    }
  }

  function onMouseMove(e) {
    if (!isPanning.current) return;

const dx = e.clientX - lastMouse.x;
const dy = e.clientY - lastMouse.y;

    camera.current.x -= dx;
    camera.current.y -= dy;

    setLastMouse({ x: e.clientX, y: e.clientY });

  }

  function onMouseUp() {
    isPanning.current = false;
  }

  function onWheel(e) {
    e.preventDefault();
    setContextMenu(null); // Close menu on zoom
    
    const zoomFactor = 1.1;
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const worldX = (mouseX + camera.current.x) / camera.current.zoom;
    const worldY = (mouseY + camera.current.y) / camera.current.zoom;

    if (e.deltaY < 0) {
      camera.current.zoom *= zoomFactor;
    } else {
      camera.current.zoom /= zoomFactor;
    }

    camera.current.zoom = Math.max(0.25, Math.min(camera.current.zoom, 4));

    camera.current.x = worldX * camera.current.zoom - mouseX;
    camera.current.y = worldY * camera.current.zoom - mouseY;
  }

  const handleAction = (action) => {
    const char = CharacterPlaceholder.find(c => c.id === contextMenu.charId);
    console.log(`Action "${action}" on character:`, char?.name);
    // Add your action logic here
    setContextMenu(null);
  };

  return (
    <div>
      <div className="w-full h-screen relative"
      onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}>

        <canvas ref={bgCanvasRef} className="absolute inset-0 bg-gray-900 w-full h-full" />
       <canvas ref={gridCanvasRef} className="absolute inset-0 w-full h-full" />


        {/* Context Menu */}
        {contextMenu && (
          <div
            className="absolute bg-gray-800 border border-gray-600 rounded shadow-lg z-50"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseLeave={() => setContextMenu(null)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="py-1">
              <button
                onClick={() => handleAction('move')}
                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center gap-2"
              >
                <span>🚶</span> Move
              </button>
              <button
                onClick={() => handleAction('attack')}
                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center gap-2"
              >
                <span>⚔️</span> Attack
              </button>
              <button
                onClick={() => handleAction('defend')}
                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center gap-2"
              >
                <span>🛡️</span> Defend
              </button>
              <button
                onClick={() => handleAction('skills')}
                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center gap-2"
              >
                <span>✨</span> Skills
              </button>
              <div className="border-t border-gray-600 my-1"></div>
              <button
                onClick={() => handleAction('info')}
                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center gap-2"
              >
                <span>ℹ️</span> Info
              </button>
            </div>
          </div>
        )}

          {selectedChar && (() => {
            const char = CharacterPlaceholder.find(c => c.id === selectedChar);
            if (!char) return null;
            
            const screen = worldToScreen(char.position.x, char.position.y);
            const isLeft = screen.x < (canvasRef.width / 2);
            
            return (
              <div 
                className={`absolute top-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg z-50 ${isLeft ? 'left-4' : 'right-4'}`}
                style={{ maxWidth: '200px' }}
              >
                Selected: {char.name}
              </div>
            );
          })()}

      </div>

      <div
        className="grid min-h-screen bg-gray-800 absolute top-0 right-0"
        style={{ gridTemplateColumns: `1fr 6px ${sideWidth}px` }}>

        <div
          className="bg-gray-700 cursor-col-resize hover:bg-gray-500 col-start-2"
          onMouseDown={() => setDragging(true)}
        />

        <div className="bg-gray-800 p-4 overflow-y-auto">
          <h2 className="text-white text-xl font-bold mb-4">Side Panel</h2>
          <p className="text-gray-300 mb-4">Selected: {selectedChar || 'None'}</p>
          
          <div className="space-y-4">
            <button
              onClick={() => setFogEnabled(!fogEnabled)}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              {fogEnabled ? 'Disable' : 'Enable'} Fog of War
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
              X:{lastMouse.x} 
              Y:{lastMouse.y}
              <p>World Cords</p>
              X:{worldMouseCords.x} 
              Y:{worldMouseCords.y}

            </div>



          </div>
        </div>
      </div>
    </div>
  );
}

export default Test;