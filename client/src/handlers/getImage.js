const images = require.context('../images', true, /\.(png|jpe?g|svg)$/);

const imageMap = images.keys().reduce((map, path) => {
  const fileName = path.split('/').pop().replace(/\.[^/.]+$/, '').toLowerCase();
  map[fileName] = images(path);
  return map;
}, {});

export default function getImage(name) {
  const baseName = name.replace(/\.[^/.]+$/, '').toLowerCase();
  return imageMap[baseName] || null;
}