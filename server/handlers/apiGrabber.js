const fs = require('fs');
const path = require('path');

module.exports = () => {
   getFiles = (directory, foldersOnly = false) => {
        let fileNames = [];

        const files = fs.readdirSync(directory, { withFileTypes: true });

        for (const file of files) {
            const filePath = path.join(directory, file.name);

            if (foldersOnly) {
            if (file.isDirectory()) {
                fileNames.push(filePath);
            }
            } else {
            if (file.isFile()) {
                fileNames.push(filePath);
            }
            }
        }
        return fileNames;
        };
    const Allapi = getFiles(path.join(__dirname, '../api'), false);
        
    APIs = {}
    for (const i of Allapi) {
                
        const api = i.replace(/\\/g, '/').split('/').pop();
        APIs[api] = i
    }
    
    return APIs
}

