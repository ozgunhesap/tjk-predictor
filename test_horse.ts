import * as cheerio from 'cheerio';
import * as fs from 'fs';

const data = fs.readFileSync('test_ajax.html', 'utf8');
const $ = cheerio.load(data);
const raceId = '223288';
const raceContainer = $(`div#kosubilgisi-${raceId}`);
console.log("Container found:", raceContainer.length);

const rows = raceContainer.find('table.tablesorter tbody tr');
console.log("Rows found:", rows.length);

rows.each((_, tr) => {
    const tds = $(tr).find('td');
    console.log("TDs length:", tds.length);
    if (tds.length > 5) {
        const num = $(tds[1]).text().trim();
        const horseLink = $(tds[2]).find('a').first();
        const horseName = horseLink.text().trim(); // simplify
        const href = horseLink.attr('href') || '';
        console.log(`Num: ${num}, Name: ${horseName}, href: ${href}`);
    }
});
