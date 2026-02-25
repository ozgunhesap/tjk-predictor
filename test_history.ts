import * as cheerio from 'cheerio';
import * as fs from 'fs';

const data = fs.readFileSync('test_horse_history.html', 'utf8');
const $ = cheerio.load(data);
const history: any[] = [];

console.log("Rows:", $('#tbody0 tr').length);

$('#tbody0 tr').each((_, tr) => {
    const tds = $(tr).find('td');
    console.log("TDS length:", tds.length);
    if (tds.length > 10) {
        const date = $(tds[0]).text().trim();
        const city = $(tds[1]).text().trim();
        const distanceStr = $(tds[2]).text().trim();
        const distance = parseInt(distanceStr, 10);
        const time = $(tds[5]).text().trim();
        
        console.log(`Parsed: date=${date}, dist=${distance}, time=${time}`);
        
        if (date && time && distance > 0) {
            history.push({ date, city, distance, time });
        }
    }
});

console.log("Total pushed:", history.length);
