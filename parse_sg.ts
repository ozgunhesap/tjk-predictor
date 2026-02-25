import * as cheerio from 'cheerio';
import * as fs from 'fs';
let data = fs.readFileSync('sg_cond2.html', 'utf8');
const $ = cheerio.load(data);
console.log("Looking for pist durumu...");
$('div').each((i, div) => {
    const text = $(div).text().replace(/\s+/g, ' ');
    if (text.toLowerCase().includes('pist:')) {
        console.log("Pist:", text.substring(0, 100));
    }
});
