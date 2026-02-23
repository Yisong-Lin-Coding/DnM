import { backgroundLayer } from "./0Background";
import { mapFloorLayer } from "./1Map";
import { mapSolidsLayer } from "./2Enviornment";
import { mapCharactersLayer } from "./3Characters";
import { mapShadowsLayer } from "./3Shadows";
import { gridlayer } from "./4Grid";
import { lightingLayer } from "./7lighting";
import { mapEffectsLayer } from "./8Effects";

export const GAME_LAYER_REGISTRY = [
  { name: "background", component: backgroundLayer, zIndex: 0 },
  { name: "grid", component: gridlayer, zIndex: 1 },
  { name: "mapFloors", component: mapFloorLayer, zIndex: 2 },
  { name: "mapShadows", component: mapShadowsLayer, zIndex: 3 },
  { name: "mapSolids", component: mapSolidsLayer, zIndex: 4 },
  { name: "lighting", component: lightingLayer, zIndex: 5 },
  { name: "mapCharacters", component: mapCharactersLayer, zIndex: 6 },
  { name: "mapEffects", component: mapEffectsLayer, zIndex: 7 },
];

export const bindLayerCanvases = (registry = [], layerRefs = {}) =>
  (Array.isArray(registry) ? registry : []).map((entry) => {
    const canvas = layerRefs?.[entry.name] || null;
    return {
      ...entry.component,
      ctx: canvas?.getContext("2d"),
      canvas,
    };
  });
