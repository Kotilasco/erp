
console.log('STARTING SCRIPT');
try {
    const fs = require('fs');
    console.log('FS required');
    const path = 'C:\\Users\\ze9167867\\Desktop\\java\\PROJECT UPDATE TAMPLETE.xlsx';
    if (fs.existsSync(path)) {
        console.log('File exists');
    } else {
        console.log('File NOT found');
    }
} catch (e) {
    console.log('Error: ' + e.message);
}
console.log('ENDING SCRIPT');
