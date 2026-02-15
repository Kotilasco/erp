
const fs = require('fs');
const path = require('path');

const FILE_PATH = 'C:\\Users\\ze9167867\\Desktop\\java\\PROJECT UPDATE TAMPLETE.xlsx';
const OUTPUT_FILE = path.join(__dirname, 'output.json');

try {
    if (!fs.existsSync(FILE_PATH)) {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ error: 'File not found: ' + FILE_PATH }));
        process.exit(1);
    }

    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(FILE_PATH);
    const sheetNames = workbook.SheetNames;

    const result = {
        sheets: []
    };

    sheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        result.sheets.push({
            name: sheetName,
            data: data.slice(0, 50) // First 50 rows
        });
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    process.exit(0);

} catch (error) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ error: error.message, stack: error.stack }));
    process.exit(1);
}
