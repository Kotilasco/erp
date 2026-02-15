const XLSX = require('xlsx');
const filename = "C:\\Users\\ze9167867\\Desktop\\java\\Barmlo Qoutation 2025 Revised Tamplete For Software.xlsx";

try {
    const workbook = XLSX.readFile(filename);
    console.log("Sheet Names:", workbook.SheetNames);

    // Get the name of the second sheet (index 1)
    const secondSheetName = workbook.SheetNames[1];
    if (!secondSheetName) {
        throw new Error("Second sheet not found in the workbook.");
    }

    // Get the worksheet object for the second sheet
    const worksheet = workbook.Sheets[secondSheetName];

    // Convert the worksheet to JSON data
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Print rows 300-350 of sheet 2
    console.log("Rows 300-350 of sheet '" + secondSheetName + "':");
    data.slice(300, 350).forEach((row, index) => {
        console.log(`Row ${300 + index}:`, row);
    });
} catch (error) {
    console.error("Error reading file:", error.message);
}
