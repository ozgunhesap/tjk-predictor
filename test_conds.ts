import * as cheerio from 'cheerio';
import * as fs from 'fs';
let data = fs.readFileSync('test_ajax.html', 'utf8');
const $ = cheerio.load(data);
$('li').each((i, li) => {
    const text = $(li).text().replace(/\s+/g, ' ');
    if (text.includes('Kum') || text.includes('Sentetik') || text.includes('Çim')) {
        console.log(text.substring(0, 100));
    }
});
