import * as xlsx from 'xlsx';

const workbook = xlsx.readFile('Stock and dividend overview_3Mar2026.xlsx');
const sheetName = 'Breakdow stocks - 3Mar26';
const sheet = workbook.Sheets[sheetName];

if (!sheet) {
    console.error(`Sheet "${sheetName}" not found.`);
    process.exit(1);
}

const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

// Extract headers (first row) and first few rows of data
const headers = data[0];
const sampleData = data.slice(1, 5);

console.log("HEADERS (Columns):");
console.log(headers);

console.log("\nSAMPLE DATA:");
sampleData.forEach((row, i) => {
    console.log(`Row ${i + 1}:`, row);
});

// To help identify columns O and U, print out the index map
console.log("\nCOLUMN MAP (Index -> Letter -> Header):");
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
(headers as string[]).forEach((header, index) => {
    let letter = "";
    if (index < 26) {
        letter = alphabet[index];
    } else {
        letter = alphabet[Math.floor(index / 26) - 1] + alphabet[index % 26];
    }
    console.log(`${index} -> ${letter} -> ${header}`);
});
