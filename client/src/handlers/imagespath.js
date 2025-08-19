import placeholder from "../images/website/placeholder/empty_pfp.jpg"
import pfp from "../images/website/placeholder/empty_pfp.jpg";


const fs = require ('fs-plus');

module.exports = (filename) => {
    
    const images = fs.readdirSync('./client/src/images/website/placeholder');


    const imagePaths = images.map(image => `../images/website/placeholder/${image}`);
    const imagePath = imagePaths.find(path => path.includes(filename));

    if (imagePath.isArray && imagePath.length > 1) {
        console.log(`Multiple images found: ${imagePath.join(', ')}`);

    }

    if (imagePath.isArray && imagePath.length === 1) {
        console.log(`Image found: ${imagePath[0]}`);


        return imagePath[0]; 
    } 

    if (imagePath) {
        console.log(`Image found: ${imagePath}`);
        return imagePath; 
    } 
    else{
        console.warn(`Image not found: ${filename}. Using placeholder.`);
        return pfp; // Return a default placeholder image if not found
    }
}
