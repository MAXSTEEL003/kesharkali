// scripts/inspect_csv.cjs
const fs = require('fs');

function parseCsv(content) {
    const lines = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < content.length; i++) {
        const c = content[i];
        const next = content[i + 1];
        if (c === '"') {
            if (inQuotes && next === '"') {
                cell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            row.push(cell.trim());
            cell = '';
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && next === '\n') i++;
            row.push(cell.trim());
            cell = '';
            if (row.some(x => x.length > 0)) {
                lines.push(row);
            }
            row = [];
        } else {
            cell += c;
        }
    }
    if (cell.length > 0 || row.length > 0) {
        row.push(cell.trim());
        lines.push(row);
    }
    return lines;
}

const csvPath = 'c:/Users/TEJAS/Downloads/tejascanvassingone-main/tejascanvassingone-main/actual_data.csv';
const content = fs.readFileSync(csvPath, 'utf8');
const allRows = parseCsv(content);
const header = allRows[0];
console.log('Columns:');
header.forEach((h, i) => console.log(`  [${i}] ${h}`));

const bhagwatiRows = allRows.filter(r => r.some(col => col.toUpperCase().includes('BHAGWATI')));
console.log(`\nFound ${bhagwatiRows.length} rows mentioning BHAGWATI:\n`);

bhagwatiRows.forEach((r, idx) => {
    console.log(`Row #${idx + 1}: Month="${r[0]}", Date="${r[1]}", Miller="${r[2]}", Brand="${r[4]}", Buyer="${r[5]}", BillNo="${r[8]}", Qty="${r[9]}", Rate="${r[10]}", ExtraBuyer="${r[25]}", Date2="${r[26]}", Miller2="${r[27]}", Buyer2="${r[28]}"`);
});
