images = require.context("../images", true, /\.(png|jpe?g|svg)$/);


export default function getImage(imageName) {

 const keys = images.keys();
  const match = keys.find(key => key.endsWith(imageName));
  return match ? images(match) : null;

}