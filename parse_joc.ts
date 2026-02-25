import * as cheerio from 'cheerio';
import * as fs from 'fs';
let data = fs.readFileSync('temp_izmir.html', 'utf8');
const $ = cheerio.load(data);
$('td').each((i, td) => {
    const txt = $(td).text().trim().toLowerCase();
    if(txt.includes('kocakaya') || txt.includes('karataş')) {
        console.log("Jockey found in HTML:", txt);
    }
})
