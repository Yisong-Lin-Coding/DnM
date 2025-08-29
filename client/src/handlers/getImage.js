const images = require.context('../images', true, /\.(png|jpe?g|svg)$/);

export default function getImage(name) {
  const baseName = name.replace(/\.[^/.]+$/, '').toLowerCase();

  const key = images.keys().find((k) => {
    const fileName = k.split('/').pop().replace(/\.[^/.]+$/, '').toLowerCase();
    return fileName === baseName;
  });

  return key ? images(key) : null;
}