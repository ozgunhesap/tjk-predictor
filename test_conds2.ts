import * as cheerio from 'cheerio';
import * as fs from 'fs';
let data = fs.readFileSync('test_ajax.html', 'utf8');
const $ = cheerio.load(data);
$('div.right').each((i, div) => {
    console.log($(div).text().replace(/\s+/g, ' ').substring(0, 50));
});
