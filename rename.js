const fs = require('fs');
const path = require('path');

const directoryPath = 'e:/coding/react-node_projects/seo-rank-tracker';
const searchString = /Rank Pilot/g;
const replacementString = 'RankBoost';

function replaceInFile(filePath) {
    const ext = path.extname(filePath);
    if (!['.js', '.jsx', '.ts', '.tsx', '.json', '.md'].includes(ext)) return;

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.match(searchString)) {
            const newContent = content.replace(searchString, replacementString);
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log(`Updated ${filePath}`);
        }
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
    }
}

function processDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                processDirectory(fullPath);
            }
        } else {
            replaceInFile(fullPath);
        }
    });
}

processDirectory(directoryPath);
console.log('Replacement complete.');
