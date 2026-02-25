import * as cheerio from 'cheerio';
import * as fs from 'fs';
let data = fs.readFileSync('test_horse_history.html', 'utf8');
const $ = cheerio.load('<table>' + data + '</table>');
const tr = $('tr').eq(1); // 0 is header, 1 is first data row usually. Wait, in history parsing we didn't check for header, meaning index 0 is first data row.
const trFirst = $('tr').first();
trFirst.find('td').each((i, td) => console.log(i + ': ' + $(td).text().trim().replace(/\s+/g, ' ')));
