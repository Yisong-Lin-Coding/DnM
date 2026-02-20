
import React, { useState } from "react";

export function LightingPanel({ 
  isDM, 
  lighting, 
  startLightPlacement, 
  updateLightSource,
  deleteLightSource,
  setLighting 
}) {
  const [showLightingPanel, setShowLightingPanel] = useState(false);

  if (!isDM) return null;

  const handleAddLight = (preset) => {
    startLightPlacement(preset);
  };

  const toggleLighting = () => {
    setLighting((prev) => ({
      ...(prev || {}),
      enabled: !(prev?.enabled ?? true),
    }));
  };

  const updateAmbient = (value) => {
    setLighting((prev) => ({
      ...(prev || {}),
      ambient: parseFloat(value),
    }));
  };

  const lightPresets = [
    { name: "White Light", color: "#ffffff", intensity: 0.8, range: 420 },
    { name: "Warm Fire", color: "#ff8800", intensity: 1.0, range: 350 },
    { name: "Blue Torch", color: "#4488ff", intensity: 0.9, range: 400 },
    { name: "Green Magic", color: "#44ff88", intensity: 1.1, range: 450 },
    { name: "Red Glow", color: "#ff4444", intensity: 0.7, range: 300 },
    { name: "Purple Mystic", color: "#aa44ff", intensity: 0.9, range: 380 },
  ];

  const pointLights = (lighting?.sources || []).filter((light) => String(light?.type) === "point");

  return (
    <div className="border-t border-gray-600 bg-gray-800">
      <button
        type="button"
        onClick={() => setShowLightingPanel(!showLightingPanel)}
        className="w-full px-4 py-3 flex items-center justify-between text-white hover:bg-gray-700"
      >
        <span className="text-sm font-semibold">💡 Lighting System</span>
        <span className="text-xs">{showLightingPanel ? "▼" : "▶"}</span>
      </button>

      {showLightingPanel && (
        <div className="px-4 py-3 space-y-3 bg-gray-750">
          {/* Global Lighting Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">Lighting Enabled</span>
            <button
              type="button"
              onClick={toggleLighting}
              className={`px-3 py-1 rounded text-xs font-medium ${
                lighting?.enabled ?? true
                  ? "bg-green-600 text-white"
                  : "bg-gray-600 text-gray-300"
              }`}
            >
              {lighting?.enabled ?? true ? "ON" : "OFF"}
            </button>
          </div>

          {/* Ambient Light Control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-300">Ambient Darkness</label>
              <span className="text-xs text-gray-400">
                {Math.round((lighting?.ambient ?? 0.24) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.9"
              step="0.05"
              value={lighting?.ambient ?? 0.24}
              onChange={(e) => updateAmbient(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Light Placement Presets */}
          <div className="space-y-2">
            <p className="text-xs text-gray-300 font-semibold">Place Light Source:</p>
            <div className="grid grid-cols-2 gap-2">
              {lightPresets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleAddLight(preset)}
                  className="px-2 py-2 rounded text-xs font-medium border border-gray-600 hover:bg-gray-700 text-white"
                  style={{
                    background: `linear-gradient(135deg, ${preset.color}33, #374151)`,
                  }}
                >
                  <div className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: preset.color }}
                    />
                    <span>{preset.name}</span>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 italic">
              Click a preset, then click the map to place
            </p>
          </div>

          {/* Existing Point Lights List */}
          {pointLights.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-300 font-semibold">
                Point Lights ({pointLights.length}):
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {pointLights.map((light) => (
                  <div
                    key={light.id}
                    className="flex items-center gap-2 px-2 py-1 rounded bg-gray-700 text-xs"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: light.color || "#ffffff" }}
                    />
                    <span className="flex-1 text-gray-200 truncate">
                      {light.name || "Light"}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateLightSource(light.id, { enabled: !light.enabled })}
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        light.enabled
                          ? "bg-green-600 text-white"
                          : "bg-gray-600 text-gray-300"
                      }`}
                    >
                      {light.enabled ? "ON" : "OFF"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteLightSource(light.id)}
                      className="px-2 py-0.5 rounded text-[10px] bg-red-600 text-white hover:bg-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}