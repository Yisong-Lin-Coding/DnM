const mapImages = require.context("../images/game/maps", true, /\.(png|jpe?g|webp|svg)$/);

const toAssetKey = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.[^/.]+$/, "");

const mapImageMap = mapImages.keys().reduce((map, path) => {
  const fileName = path.split("/").pop() || "";
  const key = toAssetKey(fileName);
  if (!key) return map;
  map[key] = mapImages(path);
  return map;
}, {});

export const MAP_IMAGE_OPTIONS = Object.keys(mapImageMap).sort((a, b) => a.localeCompare(b));

export default function getMapImage(name) {
  const key = toAssetKey(name);
  return mapImageMap[key] || null;
}
