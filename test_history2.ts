import * as cheerio from 'cheerio';
import * as fs from 'fs';

let data = fs.readFileSync('test_horse_history.html', 'utf8');
// Wrap it in a table to be safe
data = '<table>' + data + '</table>';
const $ = cheerio.load(data);
const history: any[] = [];

console.log("Rows:", $('tr').length);

$('tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length > 10) {
        const date = $(tds[0]).text().trim();
        const city = $(tds[1]).text().trim();
        const distanceStr = $(tds[2]).text().trim();
        const distance = parseInt(distanceStr, 10);
        const time = $(tds[5]).text().trim();
        
        if (date && time && distance > 0) {
            history.push({ date, city, distance, time });
        }
    }
});

console.log("Total pushed:", history.length);
